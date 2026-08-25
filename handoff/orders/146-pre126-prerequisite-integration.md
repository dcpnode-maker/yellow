# Order 146 — Integrate approved prerequisites before Order 126

**Status:** BUILT-UNREVIEWED
**Phase:** 5 · Cyber remediation integration
**Branch:** `phase-5/pre126-prerequisite-integration`
**Base:** `2faf5e8db8264af59e65effdfcb5603da628a181` — independently approved
Order-143 metadata frontier
**Risk tier:** 3 — synthetic integration of reservation lifecycle and occupancy
choke-point test prerequisites
**Owner:** Codex integration; independent non-implementing Tier-3 review required

## Admission — D-387

Orders 144 and 145 were independently approved from the same exact Base and own
disjoint product paths. This order creates one synthetic latest-owner composition for
future Order-126 resumption without merging either source ancestry.

Approved sources are fixed:

- Order 144 executable `93069db186af231622e0419c82516e59e437d5e4` and corrected
  approval metadata `e80d1feef9bb3d27076dd0a4220ff65d2d98a829` under D-383/D-386;
- Order 145 executable `81369f7c5ac8f572700ad44a9e47d11a6f7048d0` and approval
  metadata `d1399596dfe65b917b38234f8bf5c7eaf9241cb7` under D-384/D-385.

The admission itself adds no source overlay. D-383 through D-386, approved source
orders/reviews, Question-148 provenance and their ledger records are restored only in
the separately committed executable composition. D-382 belongs to the excluded
Order-126 admission branch and is deliberately not imported; the decision-number gap
is explicit rather than filled with unrelated or rewritten prose.

## Exact latest-owner manifest

Only these product blobs may differ from Base:

```text
fa425138a33fe35017e36012d2fd63b5175a9bb5  src/contexts/reservations/lifecycle.ts                       <- 93069db
67f344e3d33913687e372ec4adca762306c7d6f5  tests/reservation-lifecycle.integration.test.ts             <- 93069db
096968d226fef8a356572e1c1f2e547aef9544cd  tests/operational-blocks.integration.test.ts                <- 81369f7
6d2e9f0c24fe14345aead862487bd2f928b04443  tests/security-definer-containment.integration.test.ts      <- 81369f7
```

Exact approved governance blobs are:

```text
36c85f8e409e4dffd0491fbbf0e2fcfc50d80909  handoff/orders/144-reservation-lifecycle-parent-before-occupancy.md
9d3c96aab579505652845343de65cba9ce6c6a6f  handoff/reviews/144-reservation-lifecycle-parent-before-occupancy.md
c425ac69cdb7675be07c4ef0814f19f3436c76dd  handoff/orders/145-typed-parent-compatibility-fixtures.md
f139140c8561a975aaa5c5cd3ce8a87206c70148  handoff/reviews/145-typed-parent-compatibility-fixtures.md
26bc1ea8547d19e6602d5857ec2c898f597b7e10  handoff/questions/148-order126-strict-parent-compatibility-predecessors.md
```

`DECISIONS.log` may receive only the exact source lines D-383/D-386 from corrected
Order-144 metadata, exact D-384/D-385 from Order-145 approval metadata, and this
D-387. `handoff/LEDGER.md` may receive only the exact three Order-144 and four
Order-145 source rows plus additive Order-146 rows. Each restored decision must occur
exactly once; ledger rows must be byte-exact and unique.

## Exact scope and exclusions

Implementation/governance changes are limited to:

- the four product paths and five exact approved governance blobs above;
- `DECISIONS.log` and `handoff/LEDGER.md` additive union;
- this Order-146 admission/evidence file;
- `handoff/reviews/146-pre126-prerequisite-integration.md` when written by the
  independent reviewer.

Every other path is forbidden: all migrations and Order-126 files, runtime/status,
dependencies/locks, protected referee/architect fixtures, other source/tests,
finance/Order-127 artifacts and excluded ancestry. No source order may overwrite the
other source's owned path. No merge, rebase or cherry-pick is authorized.

## Pre-registered proof

### P0 — provenance and executable composition

Commit this admission before overlays. Restore each file with `apply_patch`, then
prove every final blob equals its named owner. Compare Base-to-executable paths to the
complete allowlist; require zero missing or unexpected paths. Prove Base is an
ancestor of both executables, metadata heads contain their named executable, and no
unapproved source content entered the composition.

### P1 — governance uniqueness and exclusions

Require D-383, D-384, D-385, D-386 and D-387 exactly once each, D-382 absent, source
order/review/Question blobs exact, and the ledger union byte-exact without duplicates.
Require no migration, Order-126, runtime/status, dependency, protected or other source
path in the diff.

### P2 — static composition proof

With Docker off, run the three focused test files with database requirements unset,
typecheck, import boundaries, standing tests, licences/audit, protected hashes and
diff checks. The Order-144 ordering canary must pass while all database cases remain
labelled skips. Record exact results and executable SHA before any database window.

### P3 — database and independent review

Only after coordinator authorization, run fresh isolated combined lifecycle,
operational-block and security-definer proofs plus affected reservation/holds,
cumulative matrix, schema and pristine referee proportionately. A non-implementing
Tier-3 reviewer must independently reproduce provenance, composition and executable
proof before approval. No source approval substitutes for integration review.

## Definition of done

- [x] Exact approved Base and four approved source SHAs are fixed.
- [x] Admission is committed before overlays.
- [x] Exact latest-owner overlay and governance union are committed separately.
- [x] P0-P2 pass on one immutable executable with Docker off.
- [ ] P3 and independent Tier-3 integration review approve that executable.
- [x] No migration/Order126/merge/push/deployment/live/Cyber closure is claimed.

## Builder evidence — 2026-08-25

Admission `550fb9960195aa69ff48c22012e742b8c1942bec` precedes immutable
executable `483d4f18247058374fd427e1d49ef3cb0b3372d4`. Against Base, the
executable has the exact twelve-path allowlist: this order, the four registered product
paths, five registered approved governance artifacts and additive `DECISIONS.log` /
`handoff/LEDGER.md`. All nine registered source/governance blobs match exactly. Base is
an ancestor of both source executables, and each source executable is an ancestor of its
named approval metadata. Strict forbidden-path count is zero.

D-382 has zero decision headings; D-383 through D-387 each have exactly one. The exact
source ledger union contains three Order-144 rows, four Order-145 rows and one Order-146
admission row. Source decision and ledger rows compare byte-for-byte with their approved
metadata. `git diff --check` reports only the five intentional two-space Markdown line
endings already owned by exact approved Order-144 review blob
`9d3c96aab579505652845343de65cba9ce6c6a6f`; changing them would break provenance.

With database variables unset and Docker down:

- focused composition: 1 passed, 15 skipped, 0 failed; the Order-144
  parent-before-claim ordering canary is the passing case and all database cases remain
  explicit skips;
- standing suite: 174 passed, 422 skipped, 0 failed, 1,983 assertions across 92 files;
- typecheck passed; import boundaries passed for 64 TypeScript files;
- frozen install and licence policy passed for 23 packages; dependency audit found no
  vulnerabilities;
- all four protected SHA-256 values match the approved frontier: migration 0001
  `fe2a9fc...0923`, referee `2afa95bb...418d`, seed fixture `bf71d8fc...4c62` and
  expected schema `a5ffe526...d59a`;
- `state.ps1` reports this branch clean at the executable and app/PostgreSQL/Valkey down.

`bun run schema:check` correctly stopped with `YELLOW_SCHEMA_DATABASE is required`;
database schema/referee/combined dynamic proof belongs to P3 and was not attempted while
Docker was unauthorized. This record is `IMPLEMENTED-NONDB`, not review-ready or
`BUILT-UNREVIEWED`.

## Database builder evidence — 2026-08-25

After explicit coordinator authorization, the builder proved the unchanged executable
`483d4f18247058374fd427e1d49ef3cb0b3372d4` against the shared PostgreSQL 16.15
service using only isolated `yellow_o146b_*` databases, except the separately authorized
unchanged migration suite's repository-owned `yellow_migrate_*` prefix. Compose was not
reconfigured or stopped and no app container was started.

- On canonical migrations 0001–0013, the combined lifecycle, operational-block and
  security-definer suites passed 16/16 with 130 assertions.
- Exact strict migration blob `83fd6d4f4e99db52dc5670a2741dfa4455867d13` from
  `b96101f` was streamed only into a disposable proof database, never imported into the
  worktree. The same combined suites passed 16/16 with 130 assertions under that strict
  validation, proving the approved lifecycle sequencing and both compatibility fixtures
  compose together.
- Reservation commit 5/5 (106), commit HTTP 5/5 (61), Order-129 parents 7/7 (45) and
  Order-143 segment changes 7/7 (115) passed. An initial six-file shared-database bundle
  also produced two setup-only `23503` failures because unseeded holds/inventory fixtures
  reuse canonical tenant/property ids; the correction used separate freshly migrated,
  canonically fixture-seeded databases and passed holds 9/9 (32) and inventory 6/6 (30).
  No executable or test file changed.
- The 19-suite phase matrix was remapped to fresh `yellow_o146b_m01`–`m19` databases;
  all 19 suites passed and every database was dropped after its suite.
- The unchanged 17-case migration suite passed 16/17 on Windows with only the known OS
  symlink `EPERM` at line 870, then passed 17/17 with 95 assertions unchanged under WSL.
- Fresh migration/seed acceptance passed 6/6 with 13 assertions. Schema drift matched
  `tests/schema/expected.sql` exactly.
- A separate app-never-started, fixture-seeded setup-equivalent database had 85 public
  tables and 75 RLS tables/policies; the protected referee passed 11/11.
- The final standing recomputation passed 174/422/0 with 1,983 assertions across 92
  files. Typecheck, 64 import boundaries, 23-package licence policy and dependency audit
  remained green; the protected hashes and exact composition manifest remain unchanged.

All controlled `yellow_o146b_*` and authorized `yellow_migrate_*` databases were
independently queried after cleanup: zero remained. PostgreSQL and Valkey were left
healthy for the coordinator. This builder proof advances only to `BUILT-UNREVIEWED`;
the unchecked P3 item still requires a non-implementing Tier-3 reviewer to personally
reproduce the exact integration proof.
