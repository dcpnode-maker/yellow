import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReservedSQL } from "bun";
import { preparePriceLabsArchive, renderPriceLabsPreview, PriceLabsImportError } from "./pricelabs-import";

const here = dirname(fileURLToPath(import.meta.url));
export const PRICELABS_SOURCE_COMMIT = "b235e94de6626e2724e7c7984d794d45b20c058a";
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function fail(code: string): never { throw new PriceLabsImportError(code); }

// Explicitly admitted Windows toolchain (PowerShell 7.6.5); updates need a new
// executable proof, not an arbitrary executable supplied by an environment flag.
const VALIDATOR_PWSH_SHA256 = "362a356ce7f0940ec74f73a8fc2c990a2cc24a38a11c90bbd8eca947110ad139";
export function verifiedPriceLabsPowerShell(path = process.env.YELLOW_PRICELABS_PWSH): string {
  if (!path || !isAbsolute(path) || !lstatSync(path).isFile() ||
      lstatSync(path).isSymbolicLink() || digest(readFileSync(path)) !== VALIDATOR_PWSH_SHA256) {
    fail("native_pwsh_not_verified");
  }
  return path;
}

/** Version the whole receiving implementation, not merely the upstream parser. */
export function priceLabsImplementationHash(): string {
  return digest(["pricelabs-import.ts", "pricelabs-staging.ts",
    "pricelabs-staging-schema.sql", "pricelabs-windows-intake.ps1"]
    .map(path => path + "\0" + digest(readFileSync(join(here, path)))).join("\n"));
}

export function preparePriceLabsDatabaseBundle(archive: string) {
  const prepared = preparePriceLabsArchive(archive);
  const stagingJson = JSON.stringify(prepared.staging, null, 2) + "\n";
  const receiptJson = JSON.stringify(prepared.receipt, null, 2) + "\n";
  const preview = renderPriceLabsPreview(prepared.staging);
  const identity = {
    manifestSha256: prepared.staging.provenance.manifestSha256,
    importerSha256: priceLabsImplementationHash(),
    archiveSha256: prepared.staging.provenance.archiveHashSha256,
    stagingSha256: digest(stagingJson), receiptSha256: digest(receiptJson),
    previewSha256: digest(preview), sourceCommit: PRICELABS_SOURCE_COMMIT,
  };
  return { ...prepared, stagingJson, receiptJson, preview, identity };
}

/** Shared fail-closed privilege check, usable before any archive is loaded. */
export async function assertPriceLabsStagingIsolation(tx: ReservedSQL): Promise<void> {
  const guard = await tx.unsafe(`
    SELECT current_database() AS database_name, current_user AS actor,
      r.rolsuper, r.rolbypassrls,
      EXISTS (SELECT 1 FROM pg_database d,
        LATERAL aclexplode(coalesce(d.datacl, acldefault('d',d.datdba))) a
        WHERE d.datname=current_database() AND a.grantee=0
          AND a.privilege_type IN ('CONNECT','TEMPORARY')) AS public_database_access
    FROM pg_roles r WHERE r.rolname = current_user
  `);
  const identity = guard[0];
  if (guard.length !== 1 || identity.database_name !== "yellow_pricelabs_staging" ||
      identity.actor !== "yellow_pricelabs_loader" || identity.rolsuper ||
      identity.rolbypassrls || identity.public_database_access) fail("staging_database_not_isolated");
  const tables = await tx.unsafe(`
    SELECT n.nspname AS schema_name, c.relname AS table_name, pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_toast'
      AND c.relkind IN ('r','p','v','m','f') ORDER BY n.nspname,c.relname
  `);
  if (tables.length !== 2 || tables.some((row: {schema_name: string; table_name: string; owner: string}, index: number) =>
    row.schema_name !== "pricelabs_staging" ||
    row.table_name !== ["archive_file", "import_bundle"][index] ||
    row.owner !== "yellow_pricelabs_stage_owner")) fail("unexpected_staging_catalogue");
  const isolation = await tx.unsafe(`
    SELECT
      (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())
        = 'yellow_pricelabs_stage_owner' AS database_owner_ok,
      (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='pricelabs_staging')
        = 'yellow_pricelabs_stage_owner' AS schema_owner_ok,
      NOT EXISTS (
        SELECT 1 FROM pg_roles r WHERE r.rolname IN
          ('yellow_pricelabs_stage_owner','yellow_pricelabs_loader','yellow_pricelabs_reader')
          AND (r.rolsuper OR r.rolbypassrls OR r.rolcanlogin OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)
      ) AS role_flags_ok,
      (SELECT count(*)=3 FROM pg_roles WHERE rolname IN
        ('yellow_pricelabs_stage_owner','yellow_pricelabs_loader','yellow_pricelabs_reader')) AS roles_exist,
      NOT EXISTS (
        SELECT 1 FROM pg_roles r WHERE NOT r.rolsuper AND r.rolname NOT IN
          ('yellow_pricelabs_stage_owner','yellow_pricelabs_loader','yellow_pricelabs_reader',
           'pg_database_owner','pg_read_all_data','pg_write_all_data')
        AND (has_database_privilege(r.oid,current_database(),'CONNECT')
          OR has_database_privilege(r.oid,current_database(),'TEMP')
          OR has_schema_privilege(r.oid,'pricelabs_staging','USAGE')
          OR has_schema_privilege(r.oid,'pricelabs_staging','CREATE')
          OR pg_has_role(r.oid,'yellow_pricelabs_stage_owner','MEMBER')
          OR pg_has_role(r.oid,'yellow_pricelabs_loader','MEMBER')
          OR pg_has_role(r.oid,'yellow_pricelabs_reader','MEMBER')
          OR pg_has_role(r.oid,'pg_database_owner','MEMBER')
          OR pg_has_role(r.oid,'pg_read_all_data','MEMBER')
          OR pg_has_role(r.oid,'pg_write_all_data','MEMBER')
          OR has_table_privilege(r.oid,'pricelabs_staging.import_bundle','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_table_privilege(r.oid,'pricelabs_staging.archive_file','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
      ) AS other_roles_denied,
      -- These predefined capability roles intrinsically see all data/ownership;
      -- they are not users. Exempt only their own catalogue entries, never a
      -- LOGIN principal or a member capable of SET ROLE (including NOINHERIT).
      NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN
        ('pg_database_owner','pg_read_all_data','pg_write_all_data') AND rolcanlogin)
        AS predefined_capabilities_not_login,
      NOT EXISTS (
        SELECT 1 FROM pg_roles r WHERE r.rolname IN ('yellow_pricelabs_loader','yellow_pricelabs_reader')
        AND (has_database_privilege(r.oid,current_database(),'CREATE,TEMP')
          OR has_schema_privilege(r.oid,'pricelabs_staging','CREATE')
          OR has_schema_privilege(r.oid,'public','CREATE')
          OR pg_has_role(r.oid,'yellow_pricelabs_stage_owner','MEMBER')
          OR has_table_privilege(r.oid,'pricelabs_staging.import_bundle','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_table_privilege(r.oid,'pricelabs_staging.archive_file','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
      ) AS write_escalation_denied,
      NOT has_table_privilege('yellow_pricelabs_reader','pricelabs_staging.import_bundle','INSERT')
        AND NOT has_table_privilege('yellow_pricelabs_reader','pricelabs_staging.archive_file','INSERT')
        AS reader_insert_denied,
      NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname IN ('dblink','postgres_fdw')) AS no_cross_database_extension
  `);
  if (isolation.length !== 1 || Object.values(isolation[0]).some(value => value !== true)) {
    fail("staging_privileges_not_isolated");
  }
}

/** A dedicated provisioner must first prove database/role isolation. No CREATE here. */
export async function loadPriceLabsStaging(tx: ReservedSQL, archive: string) {
  await assertPriceLabsStagingIsolation(tx);
  const bundle = preparePriceLabsDatabaseBundle(archive);
  const i = bundle.identity;
  const fileBytes = bundle.archiveFiles.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  await tx.unsafe("BEGIN ISOLATION LEVEL SERIALIZABLE");
  try {
    const inserted = await tx.unsafe(`
      INSERT INTO pricelabs_staging.import_bundle
        (manifest_sha256, importer_sha256, archive_sha256, staging_sha256, receipt_sha256,
         preview_sha256, source_commit, research_date, file_count, file_bytes,
         staging_document, receipt_document)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
      ON CONFLICT (manifest_sha256, importer_sha256) DO NOTHING RETURNING manifest_sha256
    `, [i.manifestSha256, i.importerSha256, i.archiveSha256, i.stagingSha256,
      i.receiptSha256, i.previewSha256, i.sourceCommit, bundle.staging.source.researchDate,
      bundle.archiveFiles.length, String(fileBytes), bundle.stagingJson, bundle.receiptJson]);
    if (inserted.length === 1) {
      for (const file of bundle.archiveFiles) {
        await tx.unsafe(`
          INSERT INTO pricelabs_staging.archive_file
            (manifest_sha256, importer_sha256, path, manifest_listed, byte_length, sha256, content)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [i.manifestSha256, i.importerSha256, file.path, file.manifestListed,
          String(file.bytes.byteLength), file.sha256, Buffer.from(file.bytes)]);
      }
    }
    const rows = await tx.unsafe(`
      SELECT archive_sha256, staging_sha256, receipt_sha256, preview_sha256, source_commit,
        file_count, file_bytes::text,
        staging_document = $3::jsonb AS staging_matches,
        receipt_document = $4::jsonb AS receipt_matches
      FROM pricelabs_staging.import_bundle WHERE manifest_sha256=$1 AND importer_sha256=$2
    `, [i.manifestSha256, i.importerSha256, bundle.stagingJson, bundle.receiptJson]);
    const row = rows[0];
    if (rows.length !== 1 || row.archive_sha256 !== i.archiveSha256 ||
        row.staging_sha256 !== i.stagingSha256 || row.receipt_sha256 !== i.receiptSha256 ||
        row.preview_sha256 !== i.previewSha256 || row.source_commit !== i.sourceCommit ||
        row.file_count !== bundle.archiveFiles.length || row.file_bytes !== String(fileBytes) ||
        row.staging_matches !== true || row.receipt_matches !== true) fail("staging_identity_conflict");
    const stored = await tx.unsafe(`
      SELECT path, manifest_listed, byte_length::text, sha256, content
      FROM pricelabs_staging.archive_file WHERE manifest_sha256=$1 AND importer_sha256=$2
    `, [i.manifestSha256, i.importerSha256]);
    const byPath = new Map(bundle.archiveFiles.map(file => [file.path, file]));
    if (stored.length !== byPath.size) fail("staging_file_count_mismatch");
    for (const file of stored) {
      const expected = byPath.get(file.path);
      if (!expected || file.manifest_listed !== expected.manifestListed ||
          file.byte_length !== String(expected.bytes.byteLength) ||
          file.sha256 !== expected.sha256 || digest(file.content) !== expected.sha256) {
        fail("staging_file_integrity_mismatch");
      }
    }
    await tx.unsafe("COMMIT");
    return { status: inserted.length === 1 ? "imported" as const : "unchanged" as const,
      operationalWrites: false, files: stored.length, ...i };
  } catch (error) {
    await tx.unsafe("ROLLBACK");
    throw error;
  }
}

function contained(parent: string, child: string): boolean {
  const part = relative(parent, child);
  return part === "" || (!isAbsolute(part) && part !== ".." && !part.startsWith(".." + sep));
}

/** Verify permissions again at the actual write boundary, never trust a flag. */
function verifyPrivatePaths(archive: string, output: string, written = false): void {
  for (const target of [archive, output]) {
    let current = resolve(target);
    while (true) {
      if (lstatSync(current).isSymbolicLink()) fail("private_path_symlink");
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
    if (!lstatSync(target).isDirectory()) fail("private_path_not_directory");
  }
  const input = realpathSync(archive), destination = realpathSync(output);
  if (contained(input, destination) || contained(destination, input)) fail("archive_output_overlap");
  if (process.platform === "win32") {
    const pwsh = verifiedPriceLabsPowerShell();
    const result = Bun.spawnSync([pwsh,
      "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", join(here, "pricelabs-windows-intake.ps1"),
      "-Action", written ? "ValidateWritten" : "ValidateOnly", "-Archive", input, "-Output", destination],
      { stdout: "pipe", stderr: "pipe", timeout: 15000 });
    if (result.exitCode !== 0) fail("private_ntfs_acl_not_verified");
  } else {
    for (const target of [input, destination]) {
      const stat = lstatSync(target);
      if (stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) fail("private_posix_mode_not_verified");
    }
  }
}

export function writePreparedPriceLabsFiles(archive: string, output: string) {
  verifyPrivatePaths(archive, output);
  if (readdirSync(output).length !== 0) fail("output_not_empty");
  const bundle = preparePriceLabsDatabaseBundle(archive);
  verifyPrivatePaths(archive, output);
  const files: Array<[string, string]> = [
    ["staging.json", bundle.stagingJson], ["receipt.json", bundle.receiptJson],
    ["preview.html", bundle.preview],
    ["database-bundle.json", JSON.stringify({
      schemaVersion: "yellow.pricelabs-database-bundle/v1", databaseLoaded: false,
      operationalWrites: false, ...bundle.identity,
      archiveFiles: bundle.archiveFiles.map(file => ({
        path: file.path, bytes: file.bytes.byteLength, sha256: file.sha256,
        manifestListed: file.manifestListed,
      })),
    }, null, 2) + "\n"],
  ];
  for (const [path, contents] of files) {
    writeFileSync(join(output, path), contents, { flag: "wx", mode: 0o600 });
  }
  verifyPrivatePaths(archive, output, true);
  // Preserve partial output on failure. Never recursively delete an arbitrary path.
  return { ...bundle.receipt, databaseLoaded: false };
}

if (import.meta.main) {
  try {
    const argv = process.argv.slice(2);
    if (argv.length !== 4 || argv[0] !== "--archive" || argv[2] !== "--output") fail("invalid_cli_arguments");
    const result = writePreparedPriceLabsFiles(argv[1]!, argv[3]!);
    process.stdout.write(JSON.stringify({ files: result.verifiedFileCount,
      counts: result.counts, operationalWrites: false, databaseLoaded: false }) + "\n");
  } catch (error) {
    process.stderr.write("PriceLabs preparation failed: " +
      (error instanceof PriceLabsImportError ? error.code : "intake_failed") + "\n");
    process.exitCode = 1;
  }
}
