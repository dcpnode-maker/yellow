# PriceLabs receiving integration — 9 September 2026

## Current result

Order462 resumes the founder's checkpoint. The existing market source is now
present in the active receiving checkout; this is not a main-branch merge, live
provider activation, actual client import or application-screen availability.

Imported source: dcpnode-maker/yellow, phase-9/live-market-adapters,
b235e94de6626e2724e7c7984d794d45b20c058a. This includes the dbc249f6 foundation.
The receiving changes are a read-only archive preparation interface, native NTFS
output boundary, complete raw-evidence database bundle, and an isolated PostgreSQL
schema/loader. No runtime dependency or second application instance was added.

## Source and data flow

Private archive → verified manifest/inventory/hashes → lossless research bundle
→ isolated research PostgreSQL database → explicit authorized property mapping
→ later RMS evidence consumption.

Synthetic isolated database provisioning and load are now executed; the real
archive, authorized property mapping and RMS consumption are not yet wired. A customer archive is not
an operational PMS backup. Unavailable dates do not prove bookings, source listing
identities do not prove physical rooms, and source amounts do not establish Yellow
gross/net/tax/commission semantics.

### Why PostgreSQL

Retain the existing PostgreSQL stack. The research database is a separate
database on the existing native Yellow cluster, not another server or operational
authority. No SQLite, data warehouse, container, ORM or extra package is introduced.
The app remains unavailable while Order460 promotion is pending.

### Lossless storage

Two append-only research tables:

- import_bundle: manifest + receiving-implementation fingerprint, source commit,
  derived hashes, complete typed staging and receipt documents.
- archive_file: every original file byte including manifest.json and otherwise
  unrecognized but manifest-listed evidence, with path/length/hash/provenance.

Exact duplicate identity is a no-op only after metadata, documents, file count
and every stored file hash are rechecked. A conflict fails without updates.
Serializable transaction failure is surfaced; no hidden data-changing retry.

The implementation fingerprint covers parser, receiver, schema and Windows
boundary, so a code change cannot masquerade as the original importer version.
Source IDs/amounts/missing markers remain strings. No tenant or property UUID is
invented from customer file content.

## Windows boundary

The upstream POSIX writer still rejects Windows. The native receiving path uses:

1. Existing protected NTFS parent under the order's exact D: research/test roots.
2. Current-user and SYSTEM-only ACLs, non-reparse ancestry and archive members.
3. A newly created private output; no overwrite or recursive failure cleanup.
4. Literal Bun child arguments with child stdout/stderr suppressed.
5. Independent validation at the real write boundary and after all four outputs.

Outputs: staging.json, receipt.json, preview.html, database-bundle.json.
The last file records hashes/inventory and explicitly databaseLoaded=false;
it is not a database-import receipt.
The TypeScript boundary verifies the admitted PowerShell 7.6.5 executable hash;
an arbitrary executable provided through environment configuration cannot approve
an ACL check. Future toolchain upgrades require explicit re-verification.

Original POSIX-output tests remain platform-skipped on Windows; new portable
verification and native full-path tests do not relabel those historical skips.
The first synthetic fixture setup failed because Set-Acl requested a privilege
unavailable to this process. Fixture-only FileSystemAclExtensions handling fixed
the setup; production privacy rules were not relaxed.

## Database isolation and executed proof

Schema SQL is explicitly NOT a PMS migration. It refuses any database other than
yellow_pricelabs_staging, operates as its dedicated NOLOGIN owner, revokes PUBLIC
database/schema privileges, grants loader SELECT+INSERT and reader SELECT only.
The loader checks database/schema/table ownership, restricted role flags,
PUBLIC CONNECT/TEMP, operational-role access and indirect membership, read/write
privilege escalation, and cross-database extensions before beginning a transaction.

Independent review originally found missing ownership and incomplete ACL checks;
both source issues were corrected, preserving the review history. The independent
provisioner has now created the one database, three NOLOGIN roles and two tables.
Its receipt995e3933 proves the empty loader guard and unchanged prior database/
role catalogues. No existing PMS database ACL was changed. The research roles
cannot log in and have no members; PostgreSQL's inherited PUBLIC permissions on
other databases are not falsely described as a per-role cross-database DENY.

The final combined live synthetic suite passes2/0 (182 assertions), protected log
integration-20260909T0956533296026Z.json, SHA-256
c9fcb596980df10da64f1c5197595bc591de8ead8a2b3a9ccf2c8b8caaa68bac.
It proves lossless import, exact duplicate no-op, raw bytes/large IDs/missing
markers, append-only owner denials, reader/app-role denial, deliberate CONNECT
grant rejection/restoration, and unchanged final PMS/cluster fingerprints.
The rollback-only predefined-role grant case initially encountered a Bun1.3.14
client settlement hang. The final test uses the existing hash-pinned native psql
client through a bounded private process; the actual exported guard rejects the
visible injected capability and rollback restores membership. No global grant
is committed, assertion waived, production guard replaced or dependency added.
Repeated failures and synthetic batches are retained. Final postchecks confirm
no leaked membership, CONNECT grant or session.
No client archive is loaded and no actual RMS/operational wiring is claimed.

## Real archive access

The authenticated Drive connector locates the private research ZIP (978,895 bytes)
and returns a user-scoped file reference, but this session exposes no supported
local materializer. No inline base64, public link, credential extraction or
unofficial download workaround was used. The founder has been asked to download
the ZIP to this laptop's Downloads folder. Public documentation contains no
private Drive ID, URL, guest details or source rows.

September12 recheck: the current connector returns404 for the saved private
archive reference and no results for a targeted PriceLabs metadata search. The
local receiving directory still contains no real archive. The earlier locator
result does not establish current access;404 does not establish deletion. No
raw download, permission change or client import was attempted or claimed.

## Phase sequence retained

1. Finish this PriceLabs intake and integrate the received pipeline requirements.
2. Close current-line Phase4 integration; audit affected Phase1–6 contracts without
   reopening unchanged independently accepted Phases1–3/5/6.
3. Close Phase7 and the preserved Order460 runtime checkpoint.
4. Continue the founder's RMS/AI direction and prior 11→13→17 priorities with
   documented dependencies; no scope is removed.

Still unimplemented: authenticated scheduling/property mapping, durable distributed
leases, production provider access, real customer load, actual RMS consumers and
operator market-intelligence screens. Imported contract tests prove the source
components, not these pending integrations.
