from __future__ import annotations

import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).absolute().parent
SPEC = importlib.util.spec_from_file_location("verify_candidate_oci", ROOT / "verify_candidate_oci.py")
verify_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verify_module)


class CandidateExportProofTests(unittest.TestCase):
    def make_layout(self, root: Path):
        (root / "blobs" / "sha256").mkdir(parents=True)
        (root / "oci-layout").write_text('{"imageLayoutVersion":"1.0.0"}')
        config = b'{"config":{"Env":["opaque sentinel"]}}'
        config_hash = hashlib.sha256(config).hexdigest()
        (root / "blobs" / "sha256" / config_hash).write_bytes(config)
        diff_ids = []
        layers = []
        for index in range(verify_module.EXPECTED_LAYER_COUNT):
            raw = ("layer-" + str(index)).encode()
            diff_id = hashlib.sha256(raw).hexdigest()
            compressed = gzip.compress(raw, mtime=0)
            compressed_hash = hashlib.sha256(compressed).hexdigest()
            diff_ids.append("sha256:" + diff_id)
            (root / "blobs" / "sha256" / compressed_hash).write_bytes(compressed)
            layers.append({"mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
                           "digest": "sha256:" + compressed_hash, "size": len(compressed)})
        manifest = {"schemaVersion": 2, "mediaType": "application/vnd.oci.image.manifest.v1+json",
                    "config": {"mediaType": "application/vnd.oci.image.config.v1+json",
                               "digest": "sha256:" + config_hash, "size": len(config)},
                    "layers": layers}
        manifest_bytes = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
        manifest_hash = hashlib.sha256(manifest_bytes).hexdigest()
        (root / "blobs" / "sha256" / manifest_hash).write_bytes(manifest_bytes)
        index = {"schemaVersion": 2, "manifests": [{
            "mediaType": "application/vnd.oci.image.manifest.v1+json",
            "digest": "sha256:" + manifest_hash, "size": len(manifest_bytes)}]}
        (root / "index.json").write_text(json.dumps(index))
        return "sha256:" + config_hash, diff_ids

    def test_independent_proof_hashes_opaque_config_and_all_ordered_layers(self):
        with tempfile.TemporaryDirectory() as temp:
            layout = Path(temp) / "layout"
            image_id, diff_ids = self.make_layout(layout)
            proof = verify_module.verify(layout, image_id, diff_ids)
            self.assertTrue(proof["passed"])
            self.assertFalse(proof["config_bytes_interpreted"])
            self.assertFalse(proof["config_env_inspected"])
            self.assertEqual(proof["layer_count"], 11)
            self.assertEqual([row["diff_id"] for row in proof["layers"]], diff_ids)
            self.assertNotIn("opaque sentinel", json.dumps(proof))

    def test_independent_proof_rejects_layer_mutation_wrong_diffid_and_extra_blob(self):
        with tempfile.TemporaryDirectory() as temp:
            layout = Path(temp) / "layout"
            image_id, diff_ids = self.make_layout(layout)
            first = layout / "blobs" / "sha256" / next(
                row["compressed_sha256"] for row in verify_module.verify(layout, image_id, diff_ids)["layers"])
            first.write_bytes(first.read_bytes() + b"tamper")
            with self.assertRaises(ValueError):
                verify_module.verify(layout, image_id, diff_ids)
        with tempfile.TemporaryDirectory() as temp:
            layout = Path(temp) / "layout"
            image_id, diff_ids = self.make_layout(layout)
            wrong = list(diff_ids)
            wrong[0] = "sha256:" + "0" * 64
            with self.assertRaises(ValueError):
                verify_module.verify(layout, image_id, wrong)
            (layout / "blobs" / "sha256" / ("f" * 64)).write_bytes(b"extra")
            with self.assertRaises(ValueError):
                verify_module.verify(layout, image_id, diff_ids)

    def test_independent_proof_rejects_symlinked_ancestors_and_oversized_index(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            layout = root / "layout"
            image_id, diff_ids = self.make_layout(layout)
            outside = root / "outside"
            outside.mkdir()
            (layout / "blobs" / "sha256").rename(outside / "sha256")
            (layout / "blobs" / "sha256").symlink_to(outside / "sha256", target_is_directory=True)
            with self.assertRaises(ValueError):
                verify_module.verify(layout, image_id, diff_ids)
        with tempfile.TemporaryDirectory() as temp:
            layout = Path(temp) / "layout"
            image_id, diff_ids = self.make_layout(layout)
            (layout / "index.json").write_bytes(b" " * (verify_module.MAX_JSON_BYTES + 1))
            with self.assertRaises(ValueError):
                verify_module.verify(layout, image_id, diff_ids)
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            layout = root / "layout"
            image_id, diff_ids = self.make_layout(layout)
            manifest_digest = json.loads((layout / "index.json").read_text())["manifests"][0]["digest"][7:]
            manifest_path = layout / "blobs" / "sha256" / manifest_digest
            outside_manifest = root / "manifest.json"
            outside_manifest.write_bytes(manifest_path.read_bytes())
            manifest_path.unlink()
            manifest_path.symlink_to(outside_manifest)
            with self.assertRaises(ValueError):
                verify_module.verify(layout, image_id, diff_ids)

    def test_builder_uses_pinned_base_proof_and_never_starts_or_inspects_env(self):
        source = (ROOT / "build_and_export_candidate.py").read_text()
        self.assertIn("BASE_IMAGE_ID = \"sha256:1e522a8ab84af27ddc57d4aef3e7f6a383d254be15225a8c9df1722df87d7bc9\"", source)
        self.assertIn('CANDIDATE_SOURCE = "444072ffdff2b7745345d88f71b603c17e11ace6"', source)
        self.assertIn("PRODUCT_SOURCE_EQUIVALENCE_444.json", source)
        self.assertIn('"build", "--network=none", "--pull=false"', source)
        self.assertIn('FROM " + BASE_IMAGE_TAG', source)
        self.assertIn("ENV YELLOW_BUILD_SHA=", source)
        self.assertNotIn('"RUN ', source)
        self.assertIn('"save", "--output"', source)
        self.assertIn('candidate.get("candidate_source") == CANDIDATE_SOURCE', source)
        self.assertNotIn(".Config.Env", source)
        self.assertIn('"runtime_launched": False', source)

    def test_public_equivalence_is_test_only_and_product_paths_match(self):
        from build_and_export_candidate import load_public_inputs
        base, equivalence = load_public_inputs()
        self.assertEqual(equivalence["product_base"], "b9ba702a074a487feeafa056abb49abcdcf01ba8")
        self.assertEqual(equivalence["laptop_latest_test_only_revision"], "444072ffdff2b7745345d88f71b603c17e11ace6")
        self.assertEqual(equivalence["product_changed_files"], [])
        self.assertTrue(base["passed"])


if __name__ == "__main__":
    unittest.main()
