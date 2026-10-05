# Order 245 — Parking occupancy definer-path repair

**Status:** BUILT-UNREVIEWED-D639
**Phase:** 7 — Tax engine and India IRP prerequisite hygiene
**Branch:** `phase-7/parking-occupancy-definer-path-repair`
**Base:** Order244 implementation `1cef833`
**Risk tier:** 3 — forward repair to occupancy SECURITY DEFINER configuration
**Owner:** Codex implementation; independent high-risk review deferred by founder build-first direction

## Outcome

Restore the standing SECURITY DEFINER gate for the two Order236 parking occupancy
functions before Order244 can close. One forward-only migration adds explicit
`pg_temp`-last search paths to the existing private seven-argument occupancy recorder
and public-name two-argument release wrapper. Their bodies, signatures, owners, ACLs
and product behavior remain unchanged.

## Fixed policy

- Never edit applied migration0037.
- Migration0039 changes only `proconfig` for the two exact function signatures.
- The standing migration proof must count the added occupancy overload explicitly and
  require every named definer to use `pg_catalog, public, pg_temp`.
- No occupancy, vehicle, reservation, tax, financial, document, HTTP, UI, local or
  seed behavior changes.

## Exact scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, and narrow Phase-7/build evidence;
- `migrations/0039_parking_occupancy_definer_path_repair.sql`;
- exact migration ledger/checksum, generated schema and setup migration-number
  fixtures;
- the existing migration SECURITY DEFINER assertion, updated from six to seven exact
  named overloads while preserving zero unsafe configuration.

## Forbidden

- editing migration0037 or any existing function body/signature/owner/ACL;
- new table, policy, event, state, permission, source service, route, UI or seed;
- parking/occupancy/reservation/tax/financial/document product behavior;
- local promotion, merge, deployment, Phase7 or application-complete claim.

## Pre-registered proof

- **P0:** fresh migration suite is red at 35/36 because count is seven and exactly two
  Order236 functions omit explicit `pg_temp`.
- **P1:** migration0039 is forward-only and applies once with an exact ledger hash.
- **P2:** both exact signatures have `search_path=pg_catalog, public, pg_temp`; all
  seven named definers are safe, PUBLIC execution remains zero and app execution two.
- **P3:** generated schema changes only the two function configurations plus migration
  ledger fixtures; table/policy counts remain 94/84.
- **P4:** full migration/acceptance/referee and standing gates return green.

## Definition of done

- [x] Forward repair and exact fixtures are executable.
- [x] Fresh migration suite, acceptance and 94-table referee are green.
- [x] Order closes only built-unreviewed pending independent Tier-3 review.

## Built checkpoint

Migration0039 changes only the exact seven-argument `record_occupancy` and two-argument
`release_occupancy` function configurations to `pg_catalog, public, pg_temp`. The
generated schema diff contains only those two configuration changes; all bodies,
signatures, owners and ACLs remain unchanged. Its SHA-256 is
`365ffb951f4ea5f4febac97ed7a4d86d5c342891d0d5464e8a36a73653c1b841`.

Fresh PostgreSQL proves 94 tables and 84 RLS policies, migration integration 36/36
with 160 assertions, canonical database acceptance 8/8 with 18 assertions and the
adversarial referee 11/11. The standing suite passes 822/822 plus 717 expected
database skips with 8,372 assertions across 1,539 tests/278 files; typecheck, 91
import boundaries, 23-package licence policy, zero-vulnerability audit, all four
JavaScript syntax checks and diff hygiene are green. Disposable proof databases were
removed and the sole port-3000 app was untouched. Independent Tier-3 review remains
deferred; no approval, product behavior, local promotion, merge, deployment, Phase7
or application-complete claim is made.
