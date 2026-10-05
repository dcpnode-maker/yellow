# Independent review — Order 096 operator reservation guest/share workbench

**Result:** APPROVED

**Reviewed tip:** `d9ad13b`

**Implementation base:** `80a1992`

**Correction base:** `ca6d38b`

**Reviewer:** independent non-implementing Codex reviewer

**Date:** 2026-08-24

The reviewer did not implement Order 096. The first review rejected `ca6d38b` because
browser guidance used floating-point `Number`/`toFixed` arithmetic and guest-row removal
did not transfer focus. Corrected tip `d9ad13b` closes both findings: canonical share
strings are parsed and formatted only as `BigInt` basis points, and removal chooses the
next row, previous row or Add guest control before removing the active row.

The reviewer added test-only hostile canaries to the scoped asset proof. They execute the
helpers extracted from the production asset and prove `33.33 + 33.33 + 33.34` becomes
`3333n + 3333n + 3334n = 10000n`, formats as `100.00`, rejects a noncanonical `33.3`,
and contains no `Number`, `parseFloat`, `Math.round` or `toFixed` path. A second runtime
canary executes the extracted production removal callback and proves first, middle, last
and sole-row removal focus the middle, last, middle and Add guest targets respectively.
The complete asset file passed **6/6 with 72 assertions**.

On fresh isolated PostgreSQL project `yellow-order096-rereview`, port 5500, migrations
0001–0007 applied to a new database and the focused HTTP proof passed **4/4 with 22
assertions**. Exact confirmation lookup, distinct read/write and hierarchical property
authority, strict body/query/path handling, server-derived tenant/actor/property, primary
preservation, canonical shares, replay/conflict, terminal rejection and publisher rollback
all remained green.

The reviewer personally executed and passed:

- `bun test tests/operator-assets-security.test.ts` — 6 passed, 0 failed, 72 assertions;
- `bun run typecheck` — passed after correcting only the reviewer canary's strict types;
- `bun run boundaries` — 59 TypeScript files scanned;
- `bun test` — 123 passed, 336 skipped, 0 failed, 1,575 assertions across 73 files;
- fresh deployment migration/seed and `tests/database-acceptance.integration.test.ts` —
  4 passed, 0 failed, 10 assertions;
- normalized `pg_dump` against `tests/schema/expected.sql` — exact match;
- `bun run license-check` — 23 installed packages passed, and `bun audit` found no
  vulnerabilities;
- a separate pristine app-never-started 84-table referee database — **11 passed, 0
  failed of 11**.

`git diff --check 80a1992..d9ad13b` passed. Migration 0001, the untouched referee,
schema snapshot, package/lock files, Compose/CI, kernel and all other forbidden surfaces
were unchanged. SHA-256 remained
`FE2A9FC949C6BACDED3F8D3FC4D14FC596A83EBDE9AEB043EB10845F07B30923` for migration
0001 and `3228279BD99A8F9B6AF99748F31D4D4B482A8E627E16D92644D9D859AD8BEFA1` for the
referee. Disposable reviewer infrastructure was removed after proof.

## Exclusive Order 096 discharge

- 096
