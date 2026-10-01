import dataclasses
from contextlib import redirect_stderr
import hashlib
import io
import json
import tempfile
import unittest
from unittest import mock
from pathlib import Path

import recover_synthetic_origin as recovery


def valid_admission():
    return recovery.Admission(
        source_head=recovery.SOURCE,
        source_dirty=False,
        source_pg_id=recovery.SOURCE_PG_ID,
        source_pg_image=recovery.SOURCE_PG_IMAGE,
        source_pg_name=recovery.SOURCE_PG_NAME,
        source_pg_running=True,
        old_app_id=recovery.OLD_APP_ID,
        old_app_image=recovery.OLD_APP_IMAGE,
        old_app_revision=recovery.OLD_APP_REVISION,
        old_app_name=recovery.OLD_APP_NAME,
        old_app_running=True,
        origin_id=recovery.ORIGIN_ID,
        origin_image=recovery.APP_IMAGE_ID,
        origin_revision=recovery.SOURCE,
        origin_name=recovery.ORIGIN_NAME,
        origin_running=True,
        new_names_absent=True,
        network_absent=True,
        volume_absent=True,
        archive_hash=recovery.ARCHIVE_SHA256,
        manifest_hash=recovery.OCI_MANIFEST_SHA256,
        config_hash=recovery.OCI_CONFIG_SHA256,
        private_path_fresh=True,
        paths_safe=True,
        pg_image_id=recovery.PG_IMAGE_ID,
        app_image_id=recovery.APP_IMAGE_ID,
        app_tag_safe=True,
        retained_service_metadata=("pg", "old", "origin"),
        conflicting_environment=False,
    )


def valid_source_role_metadata():
    roles = [
        {"name": "yellow_deploy", "oid": 10, "superuser": True, "login": True},
        {"name": "app_role", "oid": None, "superuser": False, "login": False},
        {"name": "yellow_runtime", "oid": None, "superuser": False, "login": True},
        {"name": "pg_monitor", "oid": None, "superuser": False, "login": False},
        {"name": "pg_read_all_settings", "oid": None, "superuser": False, "login": False},
        {"name": "pg_read_all_stats", "oid": None, "superuser": False, "login": False},
        {"name": "pg_stat_scan_tables", "oid": None, "superuser": False, "login": False},
    ]
    memberships = [
        {"role": "pg_read_all_settings", "member": "pg_monitor", "grantor": "yellow_deploy",
         "admin": False, "inherit": True, "set": True},
        {"role": "pg_read_all_stats", "member": "pg_monitor", "grantor": "yellow_deploy",
         "admin": False, "inherit": True, "set": True},
        {"role": "pg_stat_scan_tables", "member": "pg_monitor", "grantor": "yellow_deploy",
         "admin": False, "inherit": True, "set": True},
        {"role": "app_role", "member": "yellow_runtime", "grantor": "yellow_deploy",
         "admin": False, "inherit": False, "set": True},
    ]
    return {"roles": roles, "memberships": memberships}


class AdmissionGuardTests(unittest.TestCase):
    def assert_rejects_without_start(self, **changes):
        called = []
        candidate = dataclasses.replace(valid_admission(), **changes)
        with self.assertRaises(recovery.GuardError):
            recovery.validate_admission(candidate)
        self.assertEqual(called, [])

    def test_complete_expected_admission_is_accepted(self):
        recovery.validate_admission(valid_admission())

    def test_main_red_admission_does_not_copy_inputs_or_cleanup(self):
        rejected = dataclasses.replace(valid_admission(), network_absent=False)
        with mock.patch.object(recovery, "_collect_admission", return_value=rejected), \
             mock.patch.object(recovery, "_private_copy_inputs") as copy_inputs, \
             mock.patch.object(recovery, "_cleanup") as cleanup, \
             redirect_stderr(io.StringIO()):
            self.assertEqual(recovery._main(), 1)
        copy_inputs.assert_not_called()
        cleanup.assert_not_called()

    def test_failure_keeps_original_stage_when_source_after_diagnostic_fails(self):
        previous_handler = recovery.signal.getsignal(recovery.signal.SIGTERM)
        with tempfile.TemporaryDirectory() as directory:
            private = Path(directory)
            copied = {"archive_sha256": recovery.ARCHIVE_SHA256,
                      "oci_manifest_sha256": recovery.OCI_MANIFEST_SHA256,
                      "oci_config_sha256": recovery.OCI_CONFIG_SHA256, "oci_layer_count": 11}
            stderr = io.StringIO()
            try:
                with mock.patch.object(recovery, "PRIVATE_DIR", private), \
                     mock.patch.object(recovery, "ENV_FILE", private / "recovery.env"), \
                     mock.patch.object(recovery, "_collect_admission", return_value=valid_admission()), \
                     mock.patch.object(recovery, "_private_copy_inputs", return_value=copied), \
                     mock.patch.object(recovery, "snapshot_database",
                                       side_effect=[{"roles_memberships_database_acl": valid_source_role_metadata()},
                                                    RuntimeError("diagnostic failed")]), \
                     mock.patch.object(recovery, "_write_private"), \
                     mock.patch.object(recovery, "_copy_global_roles", side_effect=ValueError("primary failure")), \
                     redirect_stderr(stderr):
                    self.assertEqual(recovery._main(), 1)
            finally:
                recovery.signal.signal(recovery.signal.SIGTERM, previous_handler)
            self.assertIn("ERROR stage=source-backup type=ValueError", stderr.getvalue())
            failure_log = (private / "failure.log").read_text()
            self.assertIn("stage=source-backup type=ValueError", failure_log)
            self.assertIn("source_after_diagnostic=failed", failure_log)

    def test_source_and_retained_service_identity_changes_reject(self):
        for field, value in (
            ("source_head", "0" * 40),
            ("source_dirty", True),
            ("source_pg_id", "a" * 64),
            ("source_pg_image", "sha256:" + "b" * 64),
            ("source_pg_name", "/other-postgres"),
            ("source_pg_running", False),
            ("old_app_id", "c" * 64),
            ("old_app_revision", "d" * 40),
            ("old_app_running", False),
            ("origin_id", "e" * 64),
            ("origin_revision", "f" * 40),
            ("origin_running", False),
        ):
            self.assert_rejects_without_start(**{field: value})

    def test_names_volume_network_and_port_collisions_reject(self):
        for field in ("new_names_absent", "network_absent", "volume_absent"):
            self.assert_rejects_without_start(**{field: False})

    def test_archive_manifest_config_corruption_rejects(self):
        for field in ("archive_hash", "manifest_hash", "config_hash"):
            self.assert_rejects_without_start(**{field: "0" * 64})

    def test_fresh_private_path_and_symlink_guards_reject(self):
        self.assert_rejects_without_start(private_path_fresh=False)
        self.assert_rejects_without_start(paths_safe=False)

    def test_wrong_pinned_images_or_tag_collision_reject(self):
        self.assert_rejects_without_start(pg_image_id="sha256:" + "a" * 64)
        self.assert_rejects_without_start(app_image_id="mismatch")
        self.assert_rejects_without_start(app_tag_safe=False)
        self.assert_rejects_without_start(conflicting_environment=True)

    def test_image_template_handles_nil_labels_without_weakening_app_revision_pin(self):
        template = recovery.IMAGE_IDENTITY_FORMAT
        source = Path(__file__).with_name("recover_synthetic_origin.py").read_text()
        self.assertIn("{{if .Config.Labels}}", template)
        self.assertIn('org.opencontainers.image.revision', template)
        self.assertIn("image_revision == SOURCE", source)
        self.assertIn("app[5] != SOURCE", source)


class OwnershipAndInputTests(unittest.TestCase):
    def test_only_exact_yellow_deploy_create_is_removed_and_all_other_statements_remain(self):
        metadata = valid_source_role_metadata()
        dump = (b"-- PostgreSQL role dump\nCREATE ROLE yellow_deploy;\nCREATE ROLE app_role;\n"
                b"ALTER ROLE yellow_deploy WITH SUPERUSER;\n"
                b"GRANT app_role TO yellow_runtime WITH INHERIT FALSE GRANTED BY yellow_deploy;\n")
        definitions = recovery._roles_definition_sql(dump, metadata)
        self.assertNotIn(b"CREATE ROLE yellow_deploy;", definitions)
        self.assertIn(b"CREATE ROLE app_role;", definitions)
        self.assertIn(b"ALTER ROLE yellow_deploy WITH SUPERUSER;", definitions)
        self.assertIn(b"GRANT app_role TO yellow_runtime", definitions)
        with self.assertRaises(recovery.GuardError):
            recovery._roles_definition_sql(b"CREATE ROLE \"yellow_deploy\";\n", metadata)
        wrong_oid = {**metadata, "roles": [dict(role, oid=11) if role["name"] == "yellow_deploy" else role
                                            for role in metadata["roles"]]}
        with self.assertRaises(recovery.GuardError):
            recovery._roles_definition_sql(dump, wrong_oid)

    def test_membership_sql_uses_original_validated_grantor_and_options(self):
        metadata = valid_source_role_metadata()
        sql = recovery.build_membership_restore_sql(metadata).decode()
        self.assertIn('GRANT "app_role" TO "yellow_runtime" WITH INHERIT FALSE, SET OPTION;', sql)
        self.assertIn('GRANT "pg_read_all_settings" TO "pg_monitor" WITH INHERIT OPTION, SET OPTION;', sql)
        self.assertNotIn("SET ROLE", sql)
        self.assertEqual(sql.count("GRANT "), 4)
        self.assertNotIn("GRANTED BY", sql)
        bad = {**metadata, "memberships": [dict(metadata["memberships"][0], grantor="yellow_runtime")]}
        with self.assertRaises(recovery.GuardError):
            recovery.build_membership_restore_sql(bad)
        extra = {**metadata, "memberships": metadata["memberships"] + [
            {"role": "pg_monitor", "member": "yellow_runtime", "grantor": "yellow_deploy",
             "admin": False, "inherit": True, "set": True}
        ]}
        with self.assertRaises(recovery.GuardError):
            recovery.build_membership_restore_sql(extra)

    def test_membership_identifier_quoting_doubles_quotes_and_rejects_controls(self):
        self.assertEqual(recovery._quote_identifier('odd"role'), '"odd""role"')
        with self.assertRaises(recovery.GuardError):
            recovery._quote_identifier("role\nGRANT superuser")

    def test_role_definitions_and_all_memberships_use_original_fresh_yellow_deploy(self):
        with tempfile.TemporaryDirectory() as directory:
            globals_path = Path(directory) / "roles.sql"
            globals_path.write_bytes(
                b"CREATE ROLE yellow_deploy;\nALTER ROLE yellow_deploy WITH SUPERUSER;\n"
                b"GRANT app_role TO yellow_runtime WITH INHERIT FALSE GRANTED BY yellow_deploy;\n")
            with mock.patch.object(recovery, "GLOBALS_FILE", globals_path), \
                 mock.patch.object(recovery, "_run") as run:
                recovery._run_roles_restore(1000.0, valid_source_role_metadata())
            self.assertEqual(run.call_count, 1)
            restore_roles_call = run.call_args_list[0]
            roles_command = restore_roles_call.args[0]
            self.assertIn("yellow_deploy", roles_command)
            self.assertIn("--no-password", roles_command)
            self.assertIn("/var/run/postgresql", roles_command)
            restored_roles = restore_roles_call.kwargs["input_bytes"]
            self.assertNotIn(b"CREATE ROLE yellow_deploy;", restored_roles)
            self.assertIn(b"ALTER ROLE yellow_deploy WITH SUPERUSER;", restored_roles)
            self.assertIn(b"GRANT app_role TO yellow_runtime", restored_roles)

            dump_path = Path(directory) / "database.dump"
            dump_path.write_bytes(b"private dump fixture")
            with mock.patch.object(recovery, "DUMP_FILE", dump_path), \
                 mock.patch.object(recovery, "_run") as restore_run:
                recovery._restore_database(1000.0)
            restore_command = restore_run.call_args.args[0]
            self.assertIn("pg_restore", restore_command)
            self.assertIn("yellow_deploy", restore_command)
            self.assertNotIn("yellow_recovery_bootstrap", restore_command)
            self.assertIn("/var/run/postgresql", restore_command)

    def test_verified_fresh_container_ownership_precedes_role_and_database_restore(self):
        source = Path(recovery.__file__).read_text()
        verify = source.index('network_id = _verify_fresh_pg_ownership(created_ids["pg"], nonce')
        roles_restore = source.index("_run_roles_restore(work_deadline")
        database_restore = source.index("_restore_database(work_deadline)")
        self.assertLess(verify, roles_restore)
        self.assertLess(verify, database_restore)

    @staticmethod
    def _schema_dump(sql: str, token: str = "a1b2c3") -> bytes:
        return ("\\restrict " + token + "\n" + sql + "\n\\unrestrict " + token + "\n").encode()

    def test_schema_ast_ignores_only_scanner_coordinates_and_restrict_tokens(self):
        first = self._schema_dump("CREATE TABLE public.t (amount integer CHECK (amount >= 0));")
        second = self._schema_dump("-- harmless source offset\nCREATE TABLE public.t (amount integer CHECK (amount >= 0));",
                                   token="different99")
        count_a, hash_a, ast_a = recovery.schema_ast_summary(first)
        count_b, hash_b, ast_b = recovery.schema_ast_summary(second)
        self.assertEqual(count_a, 1)
        self.assertEqual(count_b, 1)
        self.assertEqual(hash_a, hash_b)
        self.assertEqual(ast_a, ast_b)

    def test_schema_ast_rejects_numeric_rls_owner_grant_and_function_body_mutations(self):
        baseline_sql = ("CREATE TABLE public.t (amount integer CHECK (amount >= 0));\n"
                        "ALTER TABLE public.t ENABLE ROW LEVEL SECURITY;\n"
                        "ALTER TABLE public.t OWNER TO yellow_deploy;\n"
                        "GRANT SELECT ON public.t TO yellow_runtime;\n"
                        "CREATE FUNCTION public.f() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;")
        baseline = self._schema_dump(baseline_sql)
        _, baseline_hash, _ = recovery.schema_ast_summary(baseline)
        hostile_variants = (
            baseline_sql.replace("amount >= 0", "amount >= 1"),
            baseline_sql.replace("ENABLE ROW LEVEL SECURITY", "DISABLE ROW LEVEL SECURITY"),
            baseline_sql.replace("OWNER TO yellow_deploy", "OWNER TO yellow_runtime"),
            baseline_sql.replace("GRANT SELECT", "GRANT UPDATE"),
            baseline_sql.replace("SELECT 1", "SELECT 2"),
        )
        for sql in hostile_variants:
            _, changed_hash, _ = recovery.schema_ast_summary(self._schema_dump(sql))
            self.assertNotEqual(baseline_hash, changed_hash)

    def test_schema_parser_failure_is_a_guard_error(self):
        with self.assertRaisesRegex(recovery.GuardError, "schema AST parse failed"):
            recovery.schema_ast_summary(self._schema_dump("CREATE TABLE public.t ("))

    def test_v4_known_constraint_dump_pair_passes_exact_full_ast_gate(self):
        v4_private = Path(recovery.ORDER_DIR.parent / "synthetic-recovery-v4" / "private-recovery-v4")
        source_dump = (v4_private / "source-schema-only.sql").read_bytes()
        restored_dump = (v4_private / "restored-schema-only.sql").read_bytes()
        proof = recovery.schema_proof(source_dump, restored_dump)
        self.assertFalse(proof["byte_equal_after_dump_control_normalization"])
        self.assertEqual(proof["line_diff_count"], 20)
        self.assertEqual(proof["source_statement_count"], 2449)
        self.assertEqual(proof["restored_statement_count"], 2449)
        self.assertTrue(proof["full_ast_equal_after_scanner_coordinates_removed"])
        self.assertTrue(proof["strict_full_schema_equivalence_passed"])
        self.assertTrue(all(set(row) == {"line_number", "constraint_name", "source_line_sha256",
                                         "restored_line_sha256"}
                            for row in proof["line_differences_sha256"]))

    def test_schema_proof_runs_full_ast_even_when_normalized_bytes_match(self):
        dump = self._schema_dump("CREATE TABLE public.t (amount integer CHECK (amount >= 0));")
        normalized_hash = hashlib.sha256(recovery._normalize_schema_dump(dump)).hexdigest()
        with mock.patch.object(recovery, "SOURCE_SCHEMA_SHA256", normalized_hash), \
             mock.patch.object(recovery, "SOURCE_SCHEMA_STATEMENT_COUNT", 1):
            proof = recovery.schema_proof(dump, dump)
        self.assertTrue(proof["byte_equal_after_dump_control_normalization"])
        self.assertEqual(proof["source_statement_count"], 1)
        self.assertTrue(proof["full_ast_equal_after_scanner_coordinates_removed"])
        self.assertTrue(proof["strict_full_schema_equivalence_passed"])

    def test_restore_comparison_persists_only_hashes_and_component_equalities(self):
        globals_db = {
            "roles": [{"name": "yellow_deploy", "superuser": True}],
            "memberships": [{"role": "app_role", "member": "yellow_runtime", "grantor": "yellow_deploy",
                             "admin": False, "inherit": False, "set": True}],
            "settings": [{"role": "yellow_deploy", "database": "yellow_dev",
                          "config": ["statement_timeout=9000"]}],
            "database": {"name": "yellow_dev", "owner": "yellow_deploy", "acl": []},
        }
        source = {
            "identity": {"database": "yellow_dev", "user": "yellow_deploy", "version": "18.1",
                         "frontier": 100, "table_count": 130},
            "tables": ["sample_table"], "ledger": [{"version": 100, "sha256": "a" * 64}],
            "table_digests": [{"table": "sample_table", "rows": 1, "sha256": "b" * 64}],
            "schema_sha256": "c" * 64, "public_sequences": {"count": 0, "state_sha256": "d" * 64},
            "roles_memberships_database_acl": globals_db,
        }
        changed_globals = {**globals_db, "settings": [{"role": "yellow_deploy", "database": "yellow_dev",
                                                          "config": ["statement_timeout=12000"]}]}
        restored = {**source, "identity": {**source["identity"], "user": "yellow_recovery_bootstrap"},
                    "schema_sha256": "e" * 64, "roles_memberships_database_acl": changed_globals}
        fingerprints, summary = recovery.build_restore_comparison(source, restored)
        comparisons = summary["comparisons"]
        self.assertTrue(comparisons["identity_equal"])
        self.assertTrue(comparisons["tables_equal"])
        self.assertTrue(comparisons["ledger_equal"])
        self.assertFalse(comparisons["schema_equal"])
        self.assertTrue(comparisons["sequences_equal"])
        self.assertFalse(comparisons["global_settings_equal"])
        self.assertEqual(fingerprints["schema"], "yellow-synthetic-restore-fingerprint/v5")
        serialized = json.dumps({"fingerprints": fingerprints, "summary": summary})
        self.assertNotIn("statement_timeout", serialized)
        self.assertNotIn("sample_table", serialized)
        self.assertTrue(all(set(item) == {"path", "source_sha256", "restored_sha256"}
                            for item in summary["differing_paths_and_hashes"]))
        self.assertIn("schema", {item["path"] for item in summary["differing_paths_and_hashes"]})

    def test_failure_receipt_preserves_safe_static_guard_reason_only(self):
        receipt = recovery.safe_failure_receipt(
            recovery.GuardError("restored schema/table/migration fingerprint differs"),
            "restore-comparison", "completed", restored_fingerprint_saved=True,
            comparison_summary_saved=True, schema_diff_saved=True)
        self.assertEqual(receipt["guard_reason"], "restored schema/table/migration fingerprint differs")
        self.assertTrue(receipt["comparison_summary_saved"])
        self.assertFalse(receipt["raw_business_rows_or_settings_or_credentials_included"])
        self.assertTrue(receipt["schema_proof_saved"])
        unsafe = recovery.safe_failure_receipt(recovery.GuardError("token=secret"), "stage", "skipped",
                                               restored_fingerprint_saved=False,
                                               comparison_summary_saved=False,
                                               schema_diff_saved=False)
        self.assertEqual(unsafe["guard_reason"], "guard error")
        unexpected = recovery.safe_failure_receipt(RuntimeError("private value"), "stage", "skipped",
                                                   restored_fingerprint_saved=False,
                                                   comparison_summary_saved=False,
                                                   schema_diff_saved=False)
        self.assertIsNone(unexpected["guard_reason"])

    def test_main_saves_diagnostics_before_first_restore_equality_guard(self):
        source = Path(recovery.__file__).read_text(encoding="utf-8")
        fingerprint_write = source.index("_write_private(RESTORED_FINGERPRINT_FILE")
        summary_write = source.index("_write_private(COMPARISON_FILE")
        schema_diff_write = source.index("_write_private(SCHEMA_PROOF_FILE")
        identity_guard = source.index("if any(source_identity[key] != restored_identity[key]")
        roles_guard = source.index("if not role_metadata_matches(expected_roles, roles_db)")
        self.assertLess(fingerprint_write, identity_guard)
        self.assertLess(summary_write, identity_guard)
        self.assertLess(schema_diff_write, identity_guard)
        self.assertLess(summary_write, roles_guard)

    def test_container_cleanup_requires_exact_full_id_image_name_labels_and_nonce(self):
        cid = "a" * 64
        nonce = "1234567890abcdef" * 2 + "12345678"
        exact = (cid, recovery.APP_IMAGE_ID, "/" + recovery.APP_NAME,
                 recovery.JOB, recovery.SOURCE, nonce)
        self.assertTrue(recovery.owned_cleanup(
            exact, expected_id=cid, expected_image=recovery.APP_IMAGE_ID,
            expected_name="/" + recovery.APP_NAME, nonce=nonce))
        for index, wrong in ((0, "b" * 64), (1, "sha256:" + "c" * 64),
                             (2, "/unrelated"), (3, "other-job"),
                             (4, "0" * 40), (5, "other-nonce")):
            row = list(exact)
            row[index] = wrong
            self.assertFalse(recovery.owned_cleanup(
                tuple(row), expected_id=cid, expected_image=recovery.APP_IMAGE_ID,
                expected_name="/" + recovery.APP_NAME, nonce=nonce))
        self.assertFalse(recovery.owned_cleanup(
            None, expected_id=cid, expected_image=recovery.APP_IMAGE_ID,
            expected_name="/" + recovery.APP_NAME, nonce=nonce))

    def test_fresh_pg_ownership_requires_nonce_and_exact_resources(self):
        source = Path(__file__).with_name("recover_synthetic_origin.py").read_text()
        self.assertIn("_verify_fresh_pg_ownership(created_ids[\"pg\"], nonce", source)
        self.assertIn(".Mounts", source)
        self.assertIn(".NetworkSettings.Networks", source)
        self.assertIn(".HostConfig.PortBindings", source)
        self.assertIn("Internal", source)
        self.assertIn("def _verify_fresh_app_ownership", source)
        self.assertIn("ports in (None, {})", source)
        self.assertIn('"exec", app_id, "bun", "-e", HTTP_PROOF_JS', source)

    def test_network_and_volume_cleanup_require_nonce_and_exact_names(self):
        nonce = "safe-nonce"
        self.assertTrue(recovery.owned_network(("d" * 64, recovery.NETWORK_NAME, recovery.JOB,
                                                recovery.SOURCE, nonce), nonce))
        self.assertFalse(recovery.owned_network(("d" * 64, "unrelated", recovery.JOB,
                                                 recovery.SOURCE, nonce), nonce))
        self.assertFalse(recovery.owned_network(("d" * 64, recovery.NETWORK_NAME, recovery.JOB,
                                                 "wrong-source", nonce), nonce))
        self.assertFalse(recovery.owned_network(("d" * 64, recovery.NETWORK_NAME, recovery.JOB,
                                                 recovery.SOURCE, "wrong"), nonce))
        self.assertTrue(recovery.owned_volume((recovery.VOLUME_NAME, "local", recovery.JOB,
                                               recovery.SOURCE, nonce), nonce))
        self.assertFalse(recovery.owned_volume((recovery.VOLUME_NAME, "nfs", recovery.JOB,
                                                recovery.SOURCE, nonce), nonce))
        self.assertFalse(recovery.owned_volume((recovery.VOLUME_NAME, "local", recovery.JOB,
                                                "wrong-source", nonce), nonce))
        self.assertFalse(recovery.owned_volume((recovery.VOLUME_NAME, "local", recovery.JOB,
                                                recovery.SOURCE, "wrong"), nonce))

    def test_hash_guard_detects_a_corrupted_copy(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / "private-copy"
            artifact.write_bytes(b"known artifact")
            good = recovery.sha256_file(artifact)
            artifact.write_bytes(b"corrupt artifact")
            self.assertNotEqual(good, recovery.sha256_file(artifact))

    def test_source_before_after_must_match_exactly(self):
        snapshot = {"rows": [{"table": "synthetic", "sha256": "safe"}],
                    "public_sequences": {"count": 2, "state_sha256": "state"}}
        self.assertTrue(recovery._database_before_after_match(snapshot, dict(snapshot)))
        self.assertFalse(recovery._database_before_after_match(snapshot, {"rows": []}))
        self.assertFalse(recovery._database_before_after_match(
            snapshot, {**snapshot, "public_sequences": {"count": 2, "state_sha256": "changed"}}))

    def test_role_metadata_requires_exact_roles_and_memberships(self):
        source = {"roles": [{"name": "yellow_deploy"}], "settings": [], "database": {"owner": "yellow_deploy"},
                  "memberships": [
                      {"role": role, "member": "pg_monitor", "grantor": "yellow_deploy",
                       "admin": False, "inherit": True, "set": True}
                      for role in ("pg_read_all_settings", "pg_read_all_stats", "pg_stat_scan_tables")
                  ] + [{"role": "yellow_app_runtime", "member": "yellow_runtime", "grantor": "yellow_deploy",
                        "admin": False, "inherit": False, "set": True}]}
        exact = {**source, "memberships": list(source["memberships"])}
        self.assertTrue(recovery.role_metadata_matches(source, exact))
        altered = {"role": "pg_read_all_settings", "member": "pg_monitor",
                   "grantor": "yellow_recovery_bootstrap", "admin": False, "inherit": True, "set": True}
        self.assertFalse(recovery.role_metadata_matches(
            source, {**source, "memberships": source["memberships"] + [altered]}))
        for changed in (
            {**source["memberships"][0], "role": "pg_monitor"},
            {**source["memberships"][0], "member": "yellow_runtime"},
            {**source["memberships"][0], "grantor": "postgres"},
            {**source["memberships"][0], "admin": True},
            {**source["memberships"][0], "inherit": False},
            {**source["memberships"][0], "set": False},
        ):
            rows = list(source["memberships"])
            rows[0] = changed
            self.assertFalse(recovery.role_metadata_matches(source, {**source, "memberships": rows}))
        changed_source = [dict(row) for row in source["memberships"]]
        changed_source[-1]["inherit"] = True
        self.assertFalse(recovery.role_metadata_matches(source, {**source, "memberships": changed_source}))
        self.assertFalse(recovery.role_metadata_matches(
            source, {**source, "memberships": []}))

    def test_container_local_http_proof_requires_safe_expected_summary(self):
        paths = ("/.git/config", "/.env", "/.codex/config.toml", "/src/server.ts", "/src/server.ts.map")
        proof = {
            "health": {"status": 200, "body": {"status": "ok"}},
            "ready": {"status": 200, "target": "yellow_runtime_database", "revision": recovery.SOURCE,
                      "expectedMigrationFrontier": recovery.FRONTIER},
            "anonymous_properties": {"status": 401},
            "private_paths": {path: 404 for path in paths},
            "ui": {"status": 200, "content_type": "text/html", "sha256": "a" * 64, "bytes": 100},
            "asset": {"path": "/assets/app.js", "status": 200, "content_type": "text/javascript",
                      "sha256": "b" * 64, "bytes": 200},
        }
        self.assertEqual(recovery.validate_http_proof(proof)["asset"]["path"], "/assets/app.js")
        for change in (
            {"anonymous_properties": {"status": 200}},
            {"asset": {**proof["asset"], "path": "//external.invalid/a.js"}},
            {"asset": {**proof["asset"], "path": "/assets/app.js?token=private"}},
            {"ui": {**proof["ui"], "body": "not permitted"}},
            {"private_paths": {"/.env": 200}},
        ):
            with self.assertRaises(recovery.GuardError):
                recovery.validate_http_proof({**proof, **change})

    def test_source_postgres_commands_target_exact_container_socket(self):
        command = recovery._source_pg_command("psql", "--no-password", "-h", "/var/run/postgresql")
        self.assertEqual(command[:5], ["docker", "--host", recovery.DOCKER_SOCKET,
                                       "exec", recovery.SOURCE_PG_ID])
        self.assertIn("/var/run/postgresql", command)
        self.assertNotIn("PGPASSWORD", recovery._source_pg_command("psql", "--no-password"))

    def test_asset_path_rejects_external_origin_and_traversal(self):
        self.assertEqual(recovery.validate_asset_path("assets/app.js"), "/assets/app.js")
        self.assertEqual(recovery.validate_asset_path("/assets/app.js?v=1"), "/assets/app.js?v=1")
        for path in ("//evil.invalid/app.js", "https://evil.invalid/app.js", "/assets/../.env"):
            with self.assertRaises(recovery.GuardError):
                recovery.validate_asset_path(path)

    def test_every_docker_cli_call_uses_the_local_unix_socket(self):
        self.assertEqual(recovery._docker(["ps", "-q"]), [
            "docker", "--host", "unix:///var/run/docker.sock", "ps", "-q"
        ])

    def test_compose_has_only_private_fresh_resources_and_exact_image_pins(self):
        compose = (Path(__file__).parent / "compose.yml").read_text(encoding="utf-8")
        self.assertIn("image: " + recovery.APP_IMAGE_ID, compose)
        self.assertIn("image: " + recovery.PG_IMAGE_ID, compose)
        self.assertNotIn("ports:", compose)
        self.assertNotIn("53011", compose)
        self.assertIn("internal: true", compose)
        self.assertIn("name: " + recovery.NETWORK_NAME, compose)
        self.assertIn("name: " + recovery.VOLUME_NAME, compose)
        self.assertNotIn("55442:", compose)
        self.assertNotIn("yellow-catalogue-referee_default", compose)
        self.assertNotIn("build:", compose)
        self.assertIn("yellow.recovery.nonce:", compose)
        self.assertIn('YELLOW_FISCAL_SUBMISSION_WORKER: "0"', compose)
        self.assertIn('YELLOW_PUBLIC_DEMO_AUTOMATIC_LOGIN: "0"', compose)
        self.assertIn("YELLOW_RUNTIME_DATABASE_URL:", compose)
        self.assertIn("YELLOW_EXTENSION_REGISTRAR_DATABASE_URL:", compose)
        self.assertIn("YELLOW_TOKEN_SECRET:", compose)
        self.assertIn("shared_preload_libraries=pg_stat_statements", compose)
        self.assertIn("POSTGRES_USER: yellow_deploy", compose)
        self.assertIn("YELLOW_DEPLOY_DATABASE_PASSWORD", compose)
        self.assertNotIn("yellow_recovery_bootstrap", compose)
        self.assertIn("--no-build", Path(__file__).with_name("recover_synthetic_origin.py").read_text())
        self.assertIn("--pull", Path(__file__).with_name("recover_synthetic_origin.py").read_text())
        self.assertIn("verified_archive_loaded_even_if_cached", Path(__file__).with_name("recover_synthetic_origin.py").read_text())
        self.assertNotIn("BOOTSTRAP_INIT_MEMBERSHIPS", Path(__file__).with_name("recover_synthetic_origin.py").read_text())
        self.assertIn('"origin_scope": "container-local only"', Path(__file__).with_name("recover_synthetic_origin.py").read_text())
        source = Path(__file__).with_name("recover_synthetic_origin.py").read_text()
        self.assertIn("public_sequences", source)
        self.assertIn("ORDER BY CASE WHEN x.grantee=0 THEN 'PUBLIC'", source)


if __name__ == "__main__":
    unittest.main()
