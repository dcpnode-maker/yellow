# HANDOFF LEDGER — one line per order. Append only; union-merged.
# format: DATE · ORDER · phase · branch · builder → reviewer · verdict · note

2026-08-14 · 000 · setup · main · — → — · BOOTSTRAP · repo created, battery 11/11, Phase 0 not started
2026-08-15 · 008 · 0 · phase-0/invariant-battery-integrity · codex → claude · ORDER-WRITTEN · architect-only TC-12.3 cleanup identity and TC-12.5 monotonic timing; D-72; implementation pending
2026-08-15 · 009 · 0 · phase-0/context-import-boundaries · codex → claude · ORDER-WRITTEN · 13 contexts + kernel + executable import-boundary guard; D-67; depends on 008
2026-08-15 · 010 · 0 · phase-0/bun-sql-migration-runner · codex → claude · ORDER-WRITTEN · reserved-connection session lock, checksummed per-file migration runner; D-73; depends on 009
2026-08-15 · 011 · 0 · phase-0/bootstrap-seed · codex → claude · ORDER-WRITTEN · deterministic UUIDv5 app-role demo tenant/property seed; D-74; depends on 010
2026-08-15 · 012 · 0 · phase-0/database-ci-schema-drift · codex → claude · ORDER-WRITTEN · pinned fresh-DB CI, single RLS oracle, ACL-aware schema drift; D-75; depends on 011
2026-08-15 · 013 · 0 · phase-0/finalize-bootstrap-loop · codex → claude · ORDER-WRITTEN · worktree-safe setup/state and Phase-0 DoD reconciliation; D-76; depends on 012
2026-08-15 · 008 · 0 · phase-0/invariant-battery-integrity · codex → claude · APPROVED · referee preconditions exceed the order; D-72 corrects D-69's mechanism; reviewed in 008-015 cumulative
2026-08-15 · 009 · 0 · phase-0/context-import-boundaries · codex → claude · APPROVED · boundary gate green, 14 files scanned
2026-08-15 · 010 · 0 · phase-0/bun-sql-migration-runner · codex → claude · APPROVED · 12/12 reproduced incl. lock release on kill, rollback, collision hard-fail
2026-08-15 · 011 · 0 · phase-0/bootstrap-seed · codex → claude · APPROVED · 9/9 reproduced, rerun exact no-op
2026-08-15 · 012 · 0 · phase-0/database-ci-schema-drift · codex → claude · APPROVED · 4/4, snapshot SHA three-way match with committed expected.sql
2026-08-15 · 013 · 0 · phase-0/finalize-bootstrap-loop · codex → claude · APPROVED · onboarding paths verified consistent; 81 = 80 + schema_migration
2026-08-15 · 014 · 0 · phase-0/ci-compose-health-correction · codex → claude · APPROVED-AS-SCOPED · Compose-resolved postgres health reproduced; F8 leaves app port and DSN hardcoded — Order 016
2026-08-15 · 015 · 0 · phase-0/windows-walkthrough-correction · codex → claude · APPROVED · docker compose exec + 81 explained inline
2026-08-15 · 008-015 · 0 · phase-0/review-009-cumulative · — → claude · REVIEWED-NOT-MERGED · full range b602af9..7e7b19b reproduced first-hand, 11/11 on runner-built DB; merge blocked pending second-vendor Tier-3 reviewer per D-59
2026-08-15 · 016 · 0 · phase-0/ci-compose-port-resolution · claude → codex · ORDER-WRITTEN · resolve CI app/db ports through Compose; from F8 and D-81; negative test is the deliverable; required before Phase 1, not before 008-015 merges
2026-08-15 · 017 · 0 · phase-0/state-open-work-accuracy · claude → codex · ORDER-WRITTEN · state.sh must report open vs total handoff items; D-82; open→closed→open transition is the test
2026-08-15 · — · 1 · — · claude → — · PHASE-PLANNED · handoff/PHASE-1-PLAN.md sequences orders 018-025 with tiers and deferred decisions; D-83; not issued until Phase 0 merges
2026-08-15 · 007 · 0 · — · — → claude · QUESTION-CLOSED · A→D-67, E→D-68, B/C/D→D-73/74/75 reviewed with proof
2026-08-15 · 008 · 0 · — · — → claude · QUESTION-CLOSED · all five gates discharged; D-72 corrected the architect, see D-80
2026-08-15 · — · — · — · founder → claude · ROSTER-AMENDED · D-84: Tier 3 = one architect reviewer + reviewer-executed proof; cross-vendor requirement dropped, executable half made non-waivable; review 008-015 unblocked
2026-08-15 · 016 · 0 · phase-0/ci-compose-port-resolution · codex → claude · APPROVED · negative test reproduced by reviewer (200 on 3000 from another project, step still failed); URI-form YELLOW_DSN verified 11/11 against referee
2026-08-15 · 017 · 0 · phase-0/state-open-work-accuracy · codex → claude · APPROVED · bash transition reproduced incl. reviewer-added near-miss case; state.ps1 inspected not executed — see F9/D-85
2026-08-15 · 018 · 0 · phase-0/powershell-coverage-split · claude → codex · ORDER-WRITTEN · windows-state CI job covers state.ps1; setup.ps1 parity claim withdrawn; D-86 closes D-85; deliberately-weakened run is the deliverable
2026-08-15 · — · all · — · claude → — · ROADMAP-WRITTEN · handoff/ROADMAP.md: tier-batched review cadence (D-87), self-check, phase gates, ~88 orders / ~33 gates; Phase 1 renumbered 019-026 (supersedes the 018-025 line above)
2026-08-15 · 010 · 0 · phase-0/powershell-coverage-split · codex → claude · QUESTION-ANSWERED · self-check precondition vs assertion; D-88 amends D-87; builder was right, rule was wrong; renumbered from 009 (collision)
2026-08-15 · 018 · 0 · phase-0/powershell-coverage-split · codex → claude · APPROVED · windows-state job covers state.ps1; scripts byte-identical; red proof is a CI record, not reviewer-executed — D-89 records the structural limit
2026-08-15 · 001-018 · 0 · phase-0/powershell-coverage-split · — → claude · MERGE-PREPARED · all 18 orders marked ## MERGED; single cumulative integration to main per D-90; PRs #15 and #16 close as superseded
2026-08-15 · 011 · 1 · phase-1/tenant-context-middleware · codex → claude · QUESTION-ANSWERED · builder preflight found 9 order defects + the approval contradiction; ALL NINE CORRECT; D-93 approval lifecycle/storage, D-94 nine corrections; orders 019-026 amended; STATE-MACHINES §9 added; Phase 1 unblocked
2026-08-15 · 019 · 1 · phase-1/tenant-context-middleware · claude → codex · ORDER-WRITTEN · T3, TenantResolver port, six pre-registered proofs; P3 leak and P5 error-path are the load-bearing ones; D-91 D-92
2026-08-15 · 020 · 1 · phase-1/auth-jwt · claude → codex · ORDER-WRITTEN · T3, D-91 claim set exactly; alg:none and algorithm-confusion proofs required; Ed25519 probe is DoD item 1
2026-08-15 · 021 · 1 · phase-1/fact-log-audit · claude → codex · ORDER-WRITTEN · T2, audit envelope in-transaction before anything mutates
2026-08-15 · 022 · 1 · phase-1/eventbus-outbox · claude → codex · ORDER-WRITTEN · T2, EventBus port so D-14's NATS swap stays a config change
2026-08-15 · 023 · 1 · phase-1/outbox-relay · claude → codex · ORDER-WRITTEN · T3, SIGKILL mid-batch proof; dedupe key = outbox row id, at-least-once never exactly-once
2026-08-15 · 024 · 1 · phase-1/extension-registry · claude → codex · ORDER-WRITTEN · T2, runtime type registration + JSON-Schema validation before write
2026-08-15 · 025 · 1 · phase-1/approval-request · claude → codex · ORDER-WRITTEN · T2, insert-only, self-approval rejected at the primitive
2026-08-15 · 026 · 1 · phase-1/org-ltree · claude → codex · ORDER-WRITTEN · T2, GiST index proof + tenant-scoped paths; completes Phase 1
2026-08-22 · 043 · 2 · phase-2/local-service-loopback-hardening · codex → codex · ORDER-WRITTEN · bind local PostgreSQL and Valkey host ports to IPv4 loopback; independent review deferred under D-115
2026-08-22 · 027 · 1 · phase-1/constitution-assessment · codex → — · BUILT-UNREVIEWED · a055d4b; constitutional assessment; review debt recorded by Claude at a113ca8
2026-08-22 · 028 · 2 · phase-2/inventory-commands · codex → — · BUILT-UNREVIEWED · a241ab1; tenant-safe inventory configuration; D-115 review debt
2026-08-22 · 029 · 2 · phase-2/hold-expiry-hardening · codex → — · BUILT-UNREVIEWED · b4717ab; legacy expiry privilege hardening; D-115 review debt
2026-08-22 · 030 · 2 · phase-2/audited-holds · codex → — · BUILT-UNREVIEWED · 22d2b2d; audited cart-hold lifecycle; D-115 review debt
2026-08-22 · 031 · 2 · phase-2/truth-availability · codex → — · BUILT-UNREVIEWED · f00fe4e; PostgreSQL-truth availability; D-115 review debt
2026-08-22 · 032 · 2 · phase-2/rate-configuration · codex → — · BUILT-UNREVIEWED · f1bfb11; audited policy/rate-plan configuration; D-115 review debt
2026-08-22 · 033 · 2 · phase-2/rate-prices · codex → — · BUILT-UNREVIEWED · 2bef22b; exact bigint rate prices; D-115 review debt
2026-08-22 · 034 · 2 · phase-2/rate-price-supersession · codex → — · BUILT-UNREVIEWED · a87a687; race-safe price supersession; D-115 review debt
2026-08-22 · 035 · 2 · phase-2/inventory-controls · codex → — · BUILT-UNREVIEWED · 0bd9585; atomic restriction configuration; D-115 review debt
2026-08-22 · 036 · 2 · phase-2/restriction-evaluation · codex → — · BUILT-UNREVIEWED · fb4d014; restriction evaluation; Question 041 remains open
2026-08-22 · 037 · 2 · phase-2/ooo-oos-lifecycle · codex → — · BUILT-UNREVIEWED · def27b8; audited OOO/OOS lifecycle; D-115 review debt
2026-08-22 · 038 · 2 · phase-2/oos-sellability-policy · codex → — · BUILT-UNREVIEWED · 2d370be; configurable OOS policy; D-115 review debt
2026-08-22 · 039 · 2 · phase-2/oos-sellability-policy · codex → — · BUILT-UNREVIEWED · 2d370be; deadlock classification correction in same bounded commit
2026-08-22 · 040 · 2 · phase-2/operational-block-availability · codex → — · BUILT-UNREVIEWED · ec3e6b3; operational blocks composed into availability
2026-08-22 · 041 · 2 · phase-2/operational-block-availability · codex → — · BUILT-UNREVIEWED · aabf113; PowerShell state exit isolation
2026-08-22 · 042 · 2 · phase-2/operator-login-availability · codex → — · BUILT-UNREVIEWED · 6003c7d; authenticated themed local operator workbench; PR #23
2026-08-22 · 043 · 2 · phase-2/local-service-loopback-hardening · codex → — · BUILT-UNREVIEWED · 9839c27; loopback-only local data services; PR #24
2026-08-22 · 044 · 2 · phase-2/handoff-state-accuracy · codex → codex · ORDER-WRITTEN · accurate phase/review-debt reporting and ledger backfill
2026-08-22 · 048 · 2 · phase-2/handoff-state-accuracy · codex → codex · QUESTION-ANSWERED · live app exhausted referee connection headroom; D-160 requires isolated unchanged rerun
2026-08-22 · 019–026 · 1 · review/architect-019-044 · codex → claude · APPROVED · 52 reviewer-executed proofs, zero failures; review fd2b9cf
2026-08-22 · 027–044 · 2 · review/architect-019-044 · codex → claude · CHANGES-REQUIRED · 81 reviewer-executed proofs green; F10 Windows state partial-report success blocks integration
2026-08-22 · D-95–D-160 · cross-phase · review/architect-019-044 · codex → claude · RATIFIED-WITH-AMENDMENTS · D-89 narrowed and D-152 amended; review fd2b9cf
2026-08-22 · 045 · 2 · phase-2/windows-state-fail-closed · codex → claude · ORDER-WRITTEN · correct F10 with real missing-Git Windows proof; independent correction review deferred
2026-08-22 · 046 · 2 · phase-2/local-review-demo-inventory · codex → — · ORDER-WRITTEN · deterministic local review user and audited real inventory; independent review debt explicit
2026-08-22 · 047 · 2 · phase-2/api-idempotency-foundation · codex → — · ORDER-WRITTEN · durable tenant-scoped 24-hour command replay foundation before operator inventory writes; independent review debt explicit
2026-08-22 · 050 · 2 · phase-2/api-idempotency-foundation · codex → codex · QUESTION-ANSWERED · P3 probe corrected from nonexistent id to key_hash; full proof restart required by D-166
2026-08-22 · 051 · 2 · phase-2/api-idempotency-foundation · codex → codex · QUESTION-ANSWERED · corrected nonexistent schema snapshot path to tests/schema/expected.sql before generation
2026-08-22 · 052 · 2 · phase-2/api-idempotency-foundation · codex → codex · QUESTION-ANSWERED · CI exact-ledger failure adds only 0004 checksum to database acceptance; full restart required
2026-08-22 · 048 · 2 · phase-2/operator-inventory-management · codex → — · ORDER-WRITTEN · authenticated idempotent inventory snapshot/create workbench; independent review debt explicit
2026-08-22 · 053 · 2 · phase-2/operator-inventory-management · codex → codex · QUESTION-ANSWERED · mutation failure must escape for rollback; browser SQL probe narrowed; focused restart required
2026-08-22 · 049 · 2 · phase-2/operator-restriction-management · codex → — · ORDER-WRITTEN · authenticated idempotent restriction read/create workbench; independent review debt explicit
2026-08-22 · 050 · 2 · phase-2/operator-rate-plan-management · codex → — · ORDER-WRITTEN · validated idempotent policy/base-plan workbench; prices and derivation remain separate
2026-08-22 · 051 · 2 · phase-2/operator-rate-price-management · codex → — · ORDER-WRITTEN · exact bigint-safe price creation and current lookup workbench; correction remains separate
2026-08-22 · 052 · 2 · phase-2/operator-rate-price-correction · codex → — · ORDER-WRITTEN · race-safe immutable price correction with dynamic typed editor; independent review debt explicit
2026-08-22 · 053 · 2 · phase-2/operator-operational-block-management · codex → — · ORDER-WRITTEN · authenticated idempotent OOO/OOS lifecycle through the existing occupancy choke point; independent review debt explicit
2026-08-22 · 057 · 2 · phase-2/operator-operational-block-management · codex → codex · QUESTION-ANSWERED · correct two nonexistent proof-query columns without weakening event or permission assertions; full focused restart required
2026-08-22 · 058 · 2 · phase-2/operator-operational-block-management · codex → codex · QUESTION-ANSWERED · inherited operator files require recreated databases because their canonical fixtures mutate; no code or assertion change
2026-08-22 · 054 · 2 · phase-2/operator-oos-sellability-policy · codex → — · ORDER-WRITTEN · authenticated per-property OOS sellability selection through existing audited policy service; OOO remains immutable physical truth
2026-08-22 · 059 · 2 · phase-2/operator-oos-sellability-policy · codex → codex · QUESTION-ANSWERED · correct whole-payload and all-claim proof queries without changing product behavior; full focused restart required
2026-08-22 · 060 · 2 · phase-2/operator-oos-sellability-policy · codex → codex · QUESTION-ANSWERED · use established strict JSON boundary adapter after compiler rejection; restart standing check from top
2026-08-22 · 055 · 3 · phase-2/operator-cart-hold-management · codex → — · ORDER-WRITTEN · ten-minute place/list/release through existing audited occupancy-backed HoldService; independent review debt explicit
2026-08-22 · 061 · 3 · phase-2/operator-cart-hold-management · codex → codex · QUESTION-ANSWERED · allow read-only server expiry display while still forbidding client expiry/TTL; full focused restart required
2026-08-22 · 062 · 3 · phase-2/operator-cart-hold-management · codex → codex · QUESTION-ANSWERED · correct foreign-property test helper literal inference; focused and compiler restart required
2026-08-22 · 063 · 3 · phase-2/operator-cart-hold-management · codex → codex · QUESTION-ANSWERED · complete foreign-property path-helper string annotation; focused and compiler restart required
2026-08-22 · 064 · 3 · phase-2/operator-cart-hold-management · codex → codex · QUESTION-ANSWERED · isolate immutable 100-client referee from the persistent ten-connection app pool; full setup restart required
2026-08-22 · 056 · 3 · phase-2/audited-hold-expiry-worker · codex → — · ORDER-WRITTEN · supervised bounded due-scope discovery with audited tenant-local HoldService expiry; independent review debt explicit
2026-08-22 · 065 · 3 · phase-2/audited-hold-expiry-worker · codex → codex · QUESTION-ANSWERED · complete cross-tenant helper and SQL result types after compiler stop; full focused/compiler restart required
2026-08-22 · 057 · 3 · phase-2/operator-bulk-room-creation · codex → — · ORDER-WRITTEN · atomic idempotent 1–200 exclusive-room setup through existing InventoryService commands; independent review debt explicit
2026-08-22 · 066 · 3 · phase-2/operator-bulk-room-creation · codex → codex · QUESTION-ANSWERED · inherit selected fixture occupancy and make publisher rollback idempotency probe order-independent; full focused restart required
2026-08-22 · 067 · 3 · phase-2/operator-bulk-room-creation · codex → codex · QUESTION-ANSWERED · annotate malformed-property POST helper after compiler literal inference; D-197 readback correction; focused/compiler restart required
2026-08-22 · 068 · 3 · phase-2/operator-bulk-room-creation · codex → codex · QUESTION-ANSWERED · update stale review-seed exact scope expectation to established fifteen-scope role; inherited restart required
2026-08-22 · 069 · 3 · phase-2/operator-bulk-room-creation · codex → independent reviewer · REVIEW-REQUESTED · Order 057 builder proofs, 11/11 referee, browser evidence and derived-map limitation recorded; no approval or merge
2026-08-22 · 058 · 3 · phase-2/availability-projection-rebuild · codex → — · ORDER-WRITTEN · exact RLS-scoped replacement of projection-safe nightly inventory from PostgreSQL truth; unsafe configurations remain truth-only; independent review debt explicit
2026-08-22 · 070 · 3 · phase-2/availability-projection-rebuild · codex → codex · QUESTION-ANSWERED · use PostgreSQL's explicit one-day interval overload in production and independent DST probe; recreate and restart focused proof
2026-08-22 · 071 · 3 · phase-2/availability-projection-rebuild · codex → codex · QUESTION-ANSWERED · remove invented unit_type status predicate while retaining actual sellable/space activity gates; recreate and restart focused proof
2026-08-22 · 072 · 3 · phase-2/availability-projection-rebuild · codex → codex · QUESTION-ANSWERED · cast the independent DST probe's generated timestamp to date before adding one day; recreate and restart focused proof
2026-08-22 · 073 · 3 · phase-2/availability-projection-rebuild · codex → codex · QUESTION-ANSWERED · label the independent DST probe with the projection's exact local date key; recreate and restart focused proof
