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
