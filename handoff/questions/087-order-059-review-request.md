# Question 087 — Order 059 independent review request

**Status:** OPEN — independent architect review required
**Branch:** `phase-2/availability-projection-consumer`
**Implementation commit:** `1b6523b`
**Order commit:** `7cc613e`
**Base:** `77a54d0` (`phase-2/availability-projection-rebuild`)
**Tier:** 3

## Review request

Please independently review Order 059 and execute its Tier-3 proofs. Codex acted as
temporary architect and builder under D-95/D-115; every result below is builder-asserted,
not independent approval. Codex has not approved or merged this branch.

The implementation adds the named `availability-projection` durable EventBus consumer.
It derives strict finite half-open property-local date envelopes through PostgreSQL,
calls Order 058's projection service inside the EventBus-supplied tenant transaction,
and commits projection replacement, processed marker and cursor together. Inventory-shape
events rebuild only an existing horizon, unrelated events are acknowledged no-ops, and
projection remains acceleration rather than booking authority. Runtime is doubly opt-in.

## Builder evidence

- P0 on a fresh 0001–0005 database: the complete new proof failed red because
  `AvailabilityProjectionConsumer` was not exported (`0 pass / 1 fail`).
- Final P1–P6 on a recreated 0001–0005 database: `6 pass, 0 fail, 30 expect()`.
  This includes canonical hold placement/release, OOO/OOS and policy convergence,
  PostgreSQL DST/midnight envelopes, malformed/foreign/transient rollback, strict `[)`
  validation, same-name concurrency, bounded retry/abort, and polling with no `onResult`
  observer.
- Deployed Compose proof, without an HTTP trigger: the new cursor reached outbox maximum
  `24/24` and `consumer_processed` held exactly 24 markers. The restored workbench was
  healthy, `/health` returned 200, and local login returned 200.
- Recreated inherited sequence with the canonical fixture:
  - Order 058 projection rebuild: `6 pass, 0 fail, 45 expect()`.
  - Order 022 EventBus: `7 pass, 0 fail, 24 expect()`.
  - Order 023 relay: `6 pass, 0 fail, 19 expect()`; the 10,000-row backlog proof
    completed in 41.86 seconds.
- Standing checks restarted from the lockfile after final production SQL: frozen install
  unchanged, TypeScript green, boundaries green across 40 files, default tests
  `49 pass / 238 skip / 0 fail` with 189 expectations, licence policy green for 23
  packages, `bun audit` found no vulnerabilities, and schema drift matched exactly.
- Fresh canonical `./setup.sh --db-only`, with explicit local ports and the app stopped
  per D-191: `11 passed, 0 failed of 11`. The app was then rebuilt and restored with both
  workers enabled; health/login/cursor evidence remained green.
- Protected hashes remained exact:
  - `migrations/0001_init.sql` — `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
  - `tests/run_invariants.py` — `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`

## Stops and corrections to inspect

Questions 075–086 and D-205–D-216 preserve the complete red-to-green trail. In
particular, early fake-attempt and loop-guard hypotheses were disproven rather than hidden;
D-210 corrected the focused proof's promise scheduling; and deployed cursor evidence then
found the real runtime defect. D-214 records the actual JavaScript mechanism:
`onResult?.(await drainOnce())` skipped `drainOnce()` when runtime supplied no result
observer. The final loop always drains before optional notification, and P6 proves it.

Question 085 preserves a supplemental inherited 6/7 red run caused by omitting the
canonical `tests/seed_fixture.sql` precondition; the full recreated sequence then passed.
Question 086 added strict half-open-range rejection during final source review. No proof,
migration, producer, occupancy logic, RLS rule, event catalogue or authority boundary was
weakened.

Graphify was refreshed after final source with `--update --no-viz --code-only` and
`cluster-only`: 3,295 nodes / 4,856 edges / 336 communities. Its ignored, disposable map
still warns that three SQL files are absent because `tree_sitter_sql` is not installed;
do not use Graphify as migration or schema evidence.

## Deliberately deferred

Initial projection-horizon policy, Valkey/NATS cache selection and benchmark, offline
leases, overbooking, reservations, operator projection diagnostics, approval, integration
and merge remain outside Order 059. The PostgreSQL projection is disposable and cannot
authorize a hold or booking. Independent review debt remains open for the complete stacked
Phase 1/2 branch chain.
