# Q225 — Order447 direct credit lifecycle recovery proof

**Status:** RESOLVED bounded test implementation scope. Date2026-09-08.

The unchanged engine has executed invoice proofs for version isolation, pruning,
authenticated rejection and abandoned lease recovery. Those are not direct credit
or actual process-death evidence. Complete Order447 acceptance3 without altering
the accounting/submission state machine by admitting:

- tests/india-native-credit-submission-recovery.integration.test.ts (new)
- tests/fixtures/order447-credit-claim-child.ts (new, bounded owned test child)
- this question and Order447/review447 evidence
- .github/workflows/ci.yml and tests/fiscal-replay-workflow.test.ts (Lane C only,
  add the mandatory recovery suite to the already admitted isolated current88 step)

SQL builder owns the two new files; Lane C retains its existing shared fixture
and workflow ownership. Reuse existing exported native credit scenario, real
crypto protocols, worker/repository, authorized receipt read and existing outbox
pruning capability; do not edit production code or old fixtures. Coordinate any
necessary additional shared fixture change before editing.

Cases: (1) exact pending CRN with wrong registered provider version produces no
claim/transport effect, then exact registration succeeds; (2) accepted CRN survives
actual bounded published-outbox pruning with byte-equal signed receipt GET and
immutable original request replay; (3) real encrypted/authenticated ErrorDetails
produce rejected/none, exact codes and no IRN or resend; (4) an owned child exits
after its committed genuine CRN claim and before transport, then a fresh worker
after real database-clock lease expiry performs lookup only with the exact wire.
Do not manually rewrite the stored expiry or use a mocked claim for case4.

All cases use new synthetic cohorts, full financial/origin fingerprints and exact
current target admission. No business or fiscal record deletion; prune only the
test's eligible outbox rows through the existing mechanism. Child receives only
the necessary protected runtime URL and synthetic IDs via environment, emits no
secrets, is bounded and reaped in finally; never terminates an unrelated process.
Native execution requires separate snapshot/target/preservation handoff. Pure or
skipped tests are not an execution claim. No UI, new dependency/cluster/app,
provider activation, altered retry semantics or changed taxpayer policy.

## Exact independent native execution admission

After Q224 completed, coordinator and nonimplementing reviewer personally read
the entire Recovery-only helper path and both new tests. Admit one independent
Recovery execution with runner451c9383eb96c2509d56aa0f173de96fac7cdb68613a2c009a3d119a8bd80ec0
and proof5f9e49884a4c68938172c74ff0da908ede7c15c6641cce092baa062e844b13b6.
Combined native-logs/20260907-205116-973-RecoveryPreflight.json SHA256
8bd88a9522eece8ef26062d70c50113126899f2a6ad55c99212d36b20bc93e2a
contains exact16-source pins and the complete canonical snapshot. Its nested
ff1fdca77a6b9fd6988fae3bc5c772f6e8eceb98b97f4578938a4a3ec3a733b8
is byte-identical to Q224's final preserved state.

The sole mutable target is existing yellow_order446_credit_upgrade_20260907 at
ledger87/b34,1950rows,17permissions, using new synthetic cohorts only. Test/child
hashes are1243d900062b063b3b8c2696b82576a1f643ab8c12bb56bc1a6a4ee3082c885b
and1c7479862334f5674d36ea95bbcf2cff39a9fad015a24e73dd18c2e6e18b353b.
Actual runtime-only child commits its claim then exits before any send; after
natural lease expiry, authenticated not-found must remain unresolved/lookup-only,
not invent acceptance or resend. A global-prune proof must first lock and prove
its entire eligible deletion set consists only of the three fresh cohort events.
Every pre-existing candidate row must remain byte-identical afterward; no financial
record deletion or replacement is admitted.

Existing companion yellow_order446_referee87_20260907 is now canonical88/1375;
clean yellow_order447_referee88_20260908 is88/1262; pristine template is77/90.
All three are read-only and exact throughout. Preserve all database/role/settings
outside state, source/migration hashes, complete ledger/functions/ACL/catalogue,
zero sessions after closing, and the unchanged Q224 host/app identities. Only
candidate deploy/runtime URLs reach the test; child receives runtime only. Require
native-draft mode and YELLOW_REQUIRE_ORDER447_RECOVERY=1, no DB skips.

ExecuteAfterHandoff with the exact reviewed combined snapshot is mandatory.
Before writing, recapture and require complete equality. Capture/compare again in
finally even if tests fail. Retain failures and classify read-only; no blind rerun,
reseed, database creation/drop/reset, arbitrary expiry rewrite or other-process
termination. A repaired test or source needs a fresh reviewed admission.

## First execution and exact assertion repair

The first admitted run is4pass/1fail/84 assertions: log
a7223aab159ccfad04867bd2736489dda4a896543695c883a99de68d9734b287.
The genuine child committed and exited; the head was correctly submitted/lookup
with sequence text"2". The test's incorrect numeric bigint annotation/assertion
stopped before natural lease-expiry recovery. Admit only transition_seq's raw SQL
type number→string and the matching expected"2"; no production/SQL/child change.
All baseline rows survived and the four protected databases, ledger/catalogues,
roles and live processes remained exact. The candidate's retained new test cohorts
increased1950→2424rows; do not delete or reset them. Fresh source+state preflight
must be reviewed before any retry. This failure remains separate from later proof.
