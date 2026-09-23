# Order462 — independent source review: PriceLabs intake

**Reviewer:** Codex independent reviewer (`/root/phase1_6_gap_map`), not the
Order462 implementer.  
**Date:** 2026-09-09  
**Scope inspected:** `scripts/research/pricelabs-staging.ts`,
`scripts/research/pricelabs-staging-schema.sql`, and the new
`preparePriceLabsArchive` export in `scripts/research/pricelabs-import.ts`.
The Windows wrapper was read only for the TypeScript launcher interaction.

## Verdict: CHANGES REQUIRED before any private archive or database intake

The parser/preparation path has good static containment, raw-byte retention, and
bound SQL values.  The database schema and runtime isolation guard, however, do
not yet enforce the staging ownership/access preconditions required by Order462.
They must be repaired and independently proven on a disposable staging database
before a real archive is handled.

## Findings

### P1 — schema cannot establish the ownership expected by the loader

`pricelabs-staging-schema.sql:5-8,32-44` creates the schema and tables as the
role running the file.  It neither creates under nor transfers ownership to the
documented `yellow_pricelabs_stage_owner` NOLOGIN role.  In contrast,
`pricelabs-staging.ts:57-60` rejects every catalogue unless both tables are
owned by that role.  Applying the supplied SQL as a normal provisioner therefore
does not produce a loadable catalogue, and applying it as the loader risks making
the loader the schema owner.  Make the required role/owner transition explicit
(with a fail-closed prerequisite when the role is absent), and assert schema as
well as table ownership.

### P1 — isolation guard proves only PUBLIC CONNECT, not the required private boundary

Order462 requires PUBLIC `CONNECT` **and `TEMP`** revocation and no operational
app-role access.  `pricelabs-staging.ts:38-50` checks only the PUBLIC `CONNECT`
ACL and the current loader's superuser/bypass-RLS flags.  The catalogue check at
`:51-60` checks names and table owners only; it does not inspect schema/table ACLs,
PUBLIC `TEMP`, schema ownership, or grants held by operational application roles.
`pricelabs-staging-schema.sql:5-64` likewise revokes only schema/table privileges
from PUBLIC and leaves database-level CONNECT/TEMP and role grants to an
unspecified provisioner.  A database with PUBLIC TEMP or an app-role SELECT/USAGE
grant could pass the current runtime guard, contrary to the Order462 staging
contract.  Add exact catalogue/ACL assertions covering database CONNECT+TEMP,
schema owner/USAGE, table grants, and the prohibited operational roles.

## Static observations

- `preparePriceLabsArchive` verifies a complete declared inventory, rejects
  manifest traversal, symlinks and unlisted/missing files, preserves original
  bytes in `archiveFiles`, and does not write an output directory
  (`pricelabs-import.ts:461-493,737-764`).
- The database loader uses fixed SQL text with positional parameters for all
  archive-derived strings, JSON and bytes (`pricelabs-staging.ts:65-101`); no
  archive value is interpolated as SQL or an identifier.  Its insert/readback
  check is a sensible idempotent identity check once the isolation defect is
  corrected.
- Raw source retention is designed as immutable `bytea` rows with a length/hash
  recheck (`pricelabs-staging-schema.sql:32-44`,
  `pricelabs-staging.ts:76-110`).  The append-only triggers protect subsequent
  UPDATE/DELETE/TRUNCATE (`:46-59`).
- The Windows handoff uses an argv array, not shell composition
  (`pricelabs-staging.ts:143-148`), and invokes the wrapper's `ValidateOnly`
  boundary before writing.  This review did not execute it.  Its exit-code-only
  handshake is not substitute proof that the wrapper validated the expected ACL
  predicates; the required native ACL test remains separate.

## Reviewer-executed source proof

Command executed from the active checkout:

```text
C:/Users/astha/.bun/bin/bun.exe test tests/pricelabs-import.test.ts
```

Result: **9 pass, 6 skip, 0 fail; 77 assertions** on Bun 1.3.14.  The passing
portable cases cover deterministic read-only preparation, raw byte/hash
preservation, malformed inventory/hash rejection, traversal/duplicate-manifest
rejection, unexpected/missing payload rejection, CSV fidelity and preview
neutralisation.  The six skips are platform-gated POSIX/output-writer cases in
this Windows checkout; this command did not execute the separate Windows ACL
suite.

## Explicit non-claims / required proof

No database, server, service, network call, real Drive archive, live SQL, schema
application, database idempotence race, role/ACL isolation, or Windows ACL wrapper
test was executed by this reviewer.  Consequently this is a source review only,
not acceptance of real intake.  After both P1 findings are repaired, a distinct
reviewer must apply the exact schema to a disposable dedicated staging database and
personally prove catalogue ownership, denied PUBLIC/app-role access (including
TEMP), loader-only insert/read, same-archive no-op, conflicting identity failure,
raw-byte retention, rollback, and no operational PMS writes.  The native Windows
ACL suite must also run before any private archive is materialized or written.

---

## Re-review — 2026-09-09

**Reviewer:** same independent Codex reviewer.  
**Current verdict:** **CHANGES REQUIRED for the direct TypeScript Windows writer;
the two original database-isolation P1 findings are repaired in source.**

### Original P1 findings: repaired by source inspection

- The schema now starts atomically, requires the exact staging database, switches
  to `yellow_pricelabs_stage_owner`, creates the schema under that owner and grants
  only the named loader/reader roles
  (`pricelabs-staging-schema.sql:6-18,72-76`).  The loader now checks database,
  schema and table ownership (`pricelabs-staging.ts:51-66`).
- The loader now fails closed on PUBLIC CONNECT **or TEMP**, privileged/login-capable
  staging roles, other non-superuser role membership/database/schema/table access,
  loader/reader escalation, reader INSERT, and dblink/postgres_fdw presence
  (`pricelabs-staging.ts:38-103`).  This addresses the earlier missing PUBLIC-TEMP
  and operational-role checks statically.  Values remain bound positional SQL
  parameters; archive-derived values are not interpolated into SQL.

### Residual P1 — direct TypeScript Windows path trusts an arbitrary executable

`pricelabs-staging.ts:183-191` accepts `YELLOW_PRICELABS_PWSH` when it is merely
an absolute regular file, then treats its zero exit code as ACL verification.  A
direct invocation of `writePreparedPriceLabsFiles`/the TypeScript CLI can set that
environment variable to an unrelated executable which returns zero, bypassing the
native ACL predicate before source-derived files are written.  The native wrapper
sets this variable to its own `pwsh.exe` process (`pricelabs-windows-intake.ps1:203-215`),
so the reviewed wrapper path is materially stronger; the exported/direct TypeScript
path nevertheless is not fail-closed as required by Order462.  Restrict the writer
to a wrapper-authenticated launch or authenticate/validate the wrapper result rather
than accepting an arbitrary exit-zero executable.  Add a synthetic regression that
sets this variable to a non-PowerShell executable and proves no write occurs.

### Reviewer-executed synthetic proof

```text
C:/Users/astha/.bun/bin/bun.exe test tests/pricelabs-windows-intake.test.ts tests/pricelabs-import.test.ts
```

Result: **15 pass, 6 skip, 0 fail; 108 assertions; 21 tests; 11.03 s** on Bun
1.3.14.  The native Windows tests personally exercised protected-NTFS validation,
literal argv handoff, child-output suppression, traversal/existing-output rejection,
reparse rejection and broad-ACE rejection.  The preparation tests exercised
deterministic no-write archive preparation, raw-byte/hash retention, malformed
inventory, traversal, duplicate identity and preview neutralisation.  The six skips
remain the POSIX/output-writer cases gated off on Windows.

### Exact source/test hashes reviewed (SHA-256)

```text
scripts/research/pricelabs-staging-schema.sql  63089227E1638669B20243A3ACEC3933E05F9203DDF14227D18B33DF0EF29F58
scripts/research/pricelabs-staging.ts           3A62269E4E10A9D50296F46EF915F8AF0C30212035B30965953EA23D08BE045B
scripts/research/pricelabs-import.ts            38AEA4911C9EC5F164AD083BA2C2C4FDD8A8C6C0B5300D4B3DA30DFEF641AF97
scripts/research/pricelabs-windows-intake.ps1   D0A141551F28E54FA8993C95FA9B8C65C0D36190A1B968C27FDEB77BE51598CC
tests/pricelabs-import.test.ts                  BDFFD700C30847BD2A29E55DAA9BC372450F2D7E60F718904AFFFDDF6590242E
tests/pricelabs-windows-intake.test.ts          BD3088ACB0055C349E3F445A50D4F517D77F82DD3B5420C3D312D6AA2EA75CC7
```

No real PriceLabs archive, database, SQL statement, server/service, network call,
schema application, database idempotence/isolation proof or operational PMS write
was run by this reviewer.  The passing Windows suite created only its admitted
synthetic ACL fixtures under `D:\\Yellow\\temp\\order462-acl-tests`; it is not real
archive evidence.  The required live-isolation proof remains a later, separate
disposable-database review after the residual Windows launcher defect is fixed.

---

## Final re-review — 2026-09-09

**Reviewer:** same independent Codex reviewer.  
**Verdict:** **APPROVE — bounded source and synthetic Windows-intake proof.**
This approval supersedes the residual direct-TypeScript Windows-launcher finding
above.  It does **not** approve a real PriceLabs archive, a database/schema run,
or operational application use.

### Residual launcher finding: repaired

`verifiedPriceLabsPowerShell()` now rejects missing, relative, symlinked and
non-regular candidates, then hashes the executable and accepts only the admitted
PowerShell 7.6.5 SHA-256 (`pricelabs-staging.ts:13-22`).  The write boundary uses
that verifier for each before/after ACL validation (`:180-201`).  The new negative
test proves the current Bun executable and a relative executable are rejected
(`tests/pricelabs-import.test.ts:384-387`); therefore an arbitrary exit-zero
environment executable cannot satisfy the validation precondition.

The canonical Windows wrapper/importer test also now runs a complete **synthetic**
archive through the protected `D:\\Yellow\\temp\\order462-acl-tests` fixture,
checks `completed`, the non-operational staging counts, `databaseLoaded:false`, raw
archive index size and the staging digest
(`tests/pricelabs-import.test.ts:409-458`).  The current test fixture uses
`FileSystemAclExtensions`; no production ACL predicate was changed for that test
fixture correction.

### Reviewer-executed current-byte proof

```text
C:/Users/astha/.bun/bin/bun.exe test tests/pricelabs-windows-intake.test.ts tests/pricelabs-import.test.ts
```

Actual result: **19 pass, 6 skip, 0 fail; 141 assertions; 25 tests; 16.45 s** on
Bun 1.3.14.  The count includes both suites (the six native ACL tests plus the
import/preparation suite); the six skips are the POSIX-only cases on Windows.

### Exact final reviewed hashes (SHA-256)

```text
scripts/research/pricelabs-staging-schema.sql  63089227E1638669B20243A3ACEC3933E05F9203DDF14227D18B33DF0EF29F58
scripts/research/pricelabs-staging.ts           53075F76E68890787F3084C8CC202102FE90387CDD7B9221109B5DDCBE0104A2
scripts/research/pricelabs-import.ts            38AEA4911C9EC5F164AD083BA2C2C4FDD8A8C6C0B5300D4B3DA30DFEF641AF97
scripts/research/pricelabs-windows-intake.ps1   D0A141551F28E54FA8993C95FA9B8C65C0D36190A1B968C27FDEB77BE51598CC
tests/pricelabs-import.test.ts                  6DE89CDBD045F3BAA61E41069637C2EBD28605BA12DFF78AC57292FDB6A2A8AB
tests/pricelabs-windows-intake.test.ts          BD3088ACB0055C349E3F445A50D4F517D77F82DD3B5420C3D312D6AA2EA75CC7
```

No PostgreSQL connection, `CREATE`/schema SQL, real archive materialization,
network request, service/server or operational PMS write occurred in this review.
The mandatory independent disposable-database isolation/idempotence proof remains
separate and is not implied by this approval.

---

## Independent live PostgreSQL re-review — 2026-09-09

**Reviewer/executor:** Codex (`/root/pricelabs_contract_intake`), independent of
the staging schema, loader and provisioner implementation.  
**Verdict:** **APPROVE the dedicated PostgreSQL staging boundary for synthetic
intake proof.**  This does not approve loading the private PriceLabs archive or
starting the operational application.

The reviewer inspected the frozen loader/schema/provisioner/driver, then
personally ran the root-authorized native sequence against the retained PG 16.15
host at the exact local endpoint.  Read-only inspection first proved the target
database and all three staging roles absent.  Provision then created exactly
`yellow_pricelabs_staging` and the three NOLOGIN, non-superuser,
non-BYPASSRLS roles; it applied the reviewed two-table schema once and reported
unchanged pre-existing role/database catalogues.  No reprovision, reset or drop
was performed.

### Final reviewer-executed proof

The final integration source hash was
`f08ae487cec18d3b17a65eba3752a41da92c851fe8e77af1db81481333cd35a5`.
The protected log is
`D:\Yellow\temp\order462-private-proof-20260909\integration-20260909T0956533296026Z.json`,
SHA-256
`c9fcb596980df10da64f1c5197595bc591de8ead8a2b3a9ccf2c8b8caaa68bac`.
Actual result on Bun 1.3.14: **2 pass, 0 fail, 182 assertions, 2.13 s**.

The proof established:

- an exact, unique synthetic bundle loaded once and the identical second load
  was a no-op, with per-run row-count deltas rather than an empty-database
  assumption;
- every original archive byte string, path, length and SHA-256 round-tripped,
  including large identifiers, BOM/CSV quoting, embedded newline, blank, zero,
  `NA` and `-NA` distinctions;
- owner UPDATE/DELETE/TRUNCATE, reader INSERT and operational `app_role`
  schema/table access were denied;
- a committed test-only CONNECT fault was rejected by the real loader guard,
  then revoked and independently shown restored;
- a rollback-only `GRANT pg_read_all_data TO app_role` fault was visible inside
  one native `psql` transaction, rejected by the unchanged exported
  `assertPriceLabsStagingIsolation`, and rolled back.  A separate session then
  proved both membership and `app_role` CONNECT false;
- read-only logical fingerprints of the host catalogue and serving PMS database
  `yellow_order444_review_a10851786f17` matched before/after, and all proof
  connections/pools closed.

The rollback-only capability-role case used the pinned native executable
`E:\yellow\toolchains\postgresql-16.15\pgsql\bin\psql.exe`, SHA-256
`e7acd0437ac9a15e4821c39dac3e51939a0d16e09ea0d9bb106ad2c8645626ac`.
Its password was passed only through the owned child environment, never argv or
output; stdout/stderr and runtime were bounded, and child termination implies
transaction rollback.  The permanent test adapter accepts only uncommented,
single SELECT guard statements and returns JSON rows to the real exported guard.

### Exact live-proof pins

```text
scripts/research/pricelabs-staging.ts                    ba508afcc6ea4a1e2c450dea98beb24f7d404b5110cc9e6addd247350b4af9e0
scripts/research/pricelabs-staging-schema.sql             63089227e1638669b20243a3acec3933e05f9203ddf14227d18b33df0ef29f58
tests/pricelabs-staging.integration.test.ts               f08ae487cec18d3b17a65eba3752a41da92c851fe8e77af1db81481333cd35a5
.yellow/evidence/order462/provision-staging.ts            04b67b6aafa9c7861f63678a3bc78fcc63c4688f54044f98bb9a750b51595aa2
.yellow/evidence/order462/invoke-staging-proof.ps1        e7e9dda192d7b6ff2c6f4cc621ccf20a59492ffdbd1eb25e1a39b9704e0842de
restart receipt                                           cd80d994c334ce4810014f3c54f133ab4a3bac795dc4b23c97c748c5167c2fea
```

The successful preflight inspection log was
`inspect-20260909T0912238816974Z.json` (SHA-256
`d068ea77766afbb4484f865e6b97e568632ec8bfd107b9d7ea4a4b8c79180857`),
and the one-time provision log was `provision-20260909T0912545181255Z.json`
(SHA-256
`995e3933f9a41f57f52dca32e8ac163a1ae119bab5fa65fc0a64fa22bc1029c1`).

### Retained failure evidence and scope limits

Earlier immutable logs retain the initial Bun SQLSTATE-shape failure, three
client-side transaction timeouts and two fast native-adapter validation failures.
The timeouts left PostgreSQL `idle in transaction` awaiting the Bun client; the
owned client was killed and disconnect rolled the transaction back.  Independent
postchecks found zero residual staging sessions, no `pg_read_all_data` membership
and no `app_role` CONNECT.  The native adapter failures were traced to its safety
check treating a semicolon inside the frozen guard's explanatory line comment as
statement syntax; stripping line comments before single-SELECT validation fixed
that test-only adapter without changing the production guard.

No real client archive was read or written, no operational PMS row was changed,
no application process was started, no extension/new operational role was
created, and no database or staging role was dropped.  Because PostgreSQL has no
per-role CONNECT deny that overrides PUBLIC, the three NOLOGIN staging roles can
still inherit PUBLIC CONNECT on older operational databases; this review did not
alter operational database ACLs.  Their containment here is NOLOGIN, zero role
membership and the exact staging database/runtime guard.
