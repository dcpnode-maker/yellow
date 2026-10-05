# Order558 independent review — ACCEPT

Reviewer: Codex `/root/astra_review`, independent non-implementer. Date:2026-09-21.

Verdict: **ACCEPT** the final frozen source and migration0096 for the bounded inspected-arrival/continuous-conversation contract. No deployment or public-data mutation was performed or approved by this review. No whole-PMS/PMS01 completion claim.

## Scope and final source binding

Read canonical PROJECT.md, AGENTS.md, Order558 (including its explicit0096 scope amendment), relevant decision search, check-in service, owner-mediated migration, conversation code and tests. Used engineering code-review and Yellow entity/PostgreSQL skills. `bash ./state.sh` remains unavailable: WSL cannot execute `/bin/bash`; a separate personally executed fresh database referee below does pass.

Runtime root: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

| File | Final SHA256 |
|---|---|
| src/contexts/stay-operations/checkin.ts | B198FE443391A22C959EBB6FE928F183FCC5279AEA6A8C84340A19A4BB104033 |
| migrations/0096_governed_checkin_room_condition_lock.sql | 3D0C1B99445620CA972CCD971D94F5847D2C983E0EB0B2F6E2EB09ED02093F1A |
| frontend/yellow/src/App.tsx | 2EB5B38B6997C9BF73DC256588D9A17B6B3040556EB4B9157AE4258D5C573F6E |
| tests/stay-checkin.integration.test.ts | C4B8147058E187DD868194FBC5EAD6FFE22987F222CE5E74ABEC9550B6287CDB |
| tests/order558-inspected-checkin-continuity.test.ts | B192CCF15923F1978E9D3CD007705DF38C874FA41CB40190E55D46BE03C1020A |

Hashes personally rechecked after final execution. Reviewer changed no implementation file.

## Initial findings and failed attempts retained

1. Initial service A435D6DF… reread condition without locking it. Static inspection identified a condition-change race; before the reviewer could execute the original race, the implementer replaced those bytes. Do not claim an executable race failure on the original source.
2. Initial next-step helper ignored an existing task on the dirty-room branch and repeated attendant-selection guidance after task creation/start. The final helper loads current task truth and directs the separate Start/Complete declaration. Clean directs separate supervisor Verify. It never performs that declaration itself.
3. Interim direct `unit_condition FOR UPDATE` repair A2D6D1B2… failed the reviewer's actual database run with42501 translated to CheckInNotFoundError. UPDATE was deliberately revoked by0026; the reviewer rejected restoring broad DML. The implementer explicitly expanded Order558 to0096, adding a narrow owner-mediated lock/read capability while preserving revocations. Final authored check-in proof and both observed races now pass.
4. The supplied existing seeded database was unsuitable for a clean referee replay: first reviewer run stopped on Windows cp1252 printing an arrow after TC12.1. UTF-8 rerun found an already occupied exclusive fixture (0 winners) and a pre-sealed2026-09-15 business day. These are recorded setup/replay failures, not558 product failures. Final referee used an independently created fresh database and clean seed.
5. A reviewer harness initially stalled because Bun's `.rejects` received a lazy SQL query directly. No active/idle-in-transaction work remained; only the verified reviewer child process was stopped. Wrapping that query in an awaited async function fixed the harness, and the full final race/security/rollback run exited0. An initial controlled UI stub replaced a function after a render-frame capture instead of updating its returned server state; corrected that test fixture and reran the whole actual-effect chain. Neither was a product defect.

## Personally executed isolated PostgreSQL proof

Verified container `yellow-order558-postgres` binds PostgreSQL only to127.0.0.1:55458. Existing protected deploy/runtime passwords were read only in the reviewer process from the designated env file. Only those fields were used to construct loopback test URLs in memory; no URL or secret was printed or persisted. The reviewer-owned runner redacts credentials from child output.

With explicit coordinator authorization, created fresh reviewer databases `yellow_order558_astra_final_20260921` and `yellow_order558_astra_referee_20260921` in that disposable container, using the normal migration runner. Both independently applied96/discovered96 migrations. Only the second received `tests/seed_fixture.sql`, once, before its referee. The original shared fixture was not reset. Container and both reviewer databases remain in place, as requested. Check-in test fixtures clean up their own dedicated tenants. Final diagnostic found0 idle-in-transaction sessions.

Commands (runtime cwd unless absolute):

```text
bun D:/Yellow/temp/astra-order558-isolated-runner.ts init
bun D:/Yellow/temp/astra-order558-isolated-runner.ts
bun D:/Yellow/temp/astra-order558-isolated-runner.ts race
bun D:/Yellow/temp/astra-order558-isolated-runner.ts init-referee
bun D:/Yellow/temp/astra-order558-isolated-runner.ts referee
```

The runner's normal mode personally invokes `bun test tests/stay-checkin.integration.test.ts --timeout 120000`; race mode invokes the retained reviewer test with its exact `reviewer condition race` name filter; referee mode invokes `python tests/run_invariants.py` with UTF-8 output and the in-memory isolated DSN.

- Authored actual PostgreSQL suite: **8 pass,0 fail,45 assertions**. Inspected success; exact same-key replay; wrong state/assignment/folio denial without evidence writes; dirty override denied without authority/reason and accepted with attributable reason; clean+valid identity still refused with exactly `room_inspection_required`; later inspected success; missing identity and foreign property/tenant/actor concealment; raw runtime UPDATE42501; twenty contenders produce exactly one state/fact/outbox effect.
- Reviewer-owned actual PostgreSQL proof: **4 pass,0 fail,31 assertions** (8 copied authored tests intentionally filtered, not claimed executed in this run). Uses real connections and `pg_blocking_pids`, not timing alone:
  - Check-in-first: paused immediately before actual outbox publication, another connection's condition UPDATE is observably blocked by the check-in PID; it cannot change the condition before check-in commits. Exactly one fact/event accompanies in-house state.
  - Condition-first: another connection holds an uncommitted clean condition; check-in is observably blocked, then sees committed clean and refuses `room_inspection_required`. Reservation/segment/fact/event/occupancy/journal/posting snapshot is unchanged.
  - Helper catalogue: owner yellow_owner, SECURITY DEFINER=true, exact `search_path=pg_catalog, public, pg_temp`; app_role EXECUTE only, raw yellow_runtime and PUBLIC no EXECUTE. Runtime/app_role unit_condition UPDATE remains false. Wrong property returns no rows; wrong tenant, empty/malformed/foreign context, privileged wrong session and raw runtime entry reject42501. Direct app_role condition UPDATE rejects42501.
  - Forced outbox publication failure after state/fact preparation rolls reservation/segment/facts/events and idempotency count back exactly. Same-key retry succeeds once; identical replay after a later condition change returns the original operation receipt without a second effect. Journal/posting/occupancy counts remain zero for these dedicated service fixtures.
- Final ledger query: count96,min1,max96; applied0096 checksum `3d0c1b99445620ca972ccd971d94f5847d2c983e0eb0b2f6e2eb09ed02093f1a`, exactly matching reviewed source.
- Fresh referee: **11 passed,0 failed**. Includes50-thread occupancy, mixed/private capacity exclusion, direct occupancy DML denial,162 throughput commits, unbalanced rejection/balanced commit, sealed-day denial,100 gapless numbers, all119 tenant tables' RLS/policies and both security-invoker views' two-tenant isolation. Referee fixture cleanup is confined to the fresh reviewer database; no public data was accessed.

## Personally executed UI/source proof

```text
bun D:/Yellow/temp/astra-order558-continuity-proof.ts
bun D:/Yellow/temp/astra-order558-effects-proof.ts
bun test tests/order558-inspected-checkin-continuity.test.ts tests/yellow-checkin-cleaning-conversation.test.ts tests/yellow-housekeeping-task-progression.test.ts tests/yellow-voice-routing.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-reservation-lifecycle-actions.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order558-final-reviewed-build
```

- Extracted actual next-step helper:10 controlled groups pass. Fresh Start/Complete/Verify guidance; no inspection inference without authority; inspected+sole folio blocker proposes only folio; all-ready proposes only check-in; missing identity refuses; multiple rooms are listed but never selected; no-longer-due-in clears proposal; held authoritative read produces no premature reply. Zero real PMS writes.
- Extracted actual child effect: inherited held replacement/supersession, finite confirmation, inactive/nonstaff/ambiguous identity, nine incoherent receipt variants, held refresh, stale candidate/no authority, existing-task convergence and stable-key uncertain retry all pass. Additional full room→folio→check-in simulation proves exactly one canonical command per separate yes; fresh detail/readiness is fetched between steps; each next proposal remains visible and unexecuted until the next confirmation. These are controlled command doubles, not a browser or real physical-cleaning claim.
- Focused/adjacent suite: **52 pass,0 fail,395 assertions**.
- Strict frontend and root TypeScript: both exit0, no diagnostics.
- Production Vite: exit0,469 modules. Reviewer-owned build outputs JS `index-BPw72iaf.js`, CSS `index-HgZI0zi4.css`. No output was promoted to the public app.

## Contract assessment and limits

The new clean blocker is non-sensitive and cannot be bypassed by dirty-room override authority; only dirty/pickup preserve the explicit pre-existing exception with authority plus reason. Service rechecks under reservation/segment and owner-mediated condition locks, then commits state/fact/outbox/idempotency atomically. The helper does not change condition, inspect a room, create a task or grant direct DML. Existing API/property/actor boundaries remain authoritative.

The retained Yellow journey reports clean as awaiting inspection, uses server allowedActions for the next declaration, preserves the shared mutation lock and stable per-operation retries, and never chooses among rooms/attendants or combines writes. Fresh next-step proposals are advisory until their own explicit confirmation and fresh preflight. No new financial semantics, identity capture, provider action or automatic physical-work assertion.

No remaining blocking finding for this bounded source freeze. This is not a live/public postflight or whole-application acceptance. Permanent authored conversation tests remain largely static; reviewer actual-effect and concurrency harnesses below supply executable evidence and should be retained with the review. No implementation, public DB or container-removal action was performed by the reviewer.

## Retained reviewer proof hashes

| Artifact | SHA256 |
|---|---|
| D:/Yellow/temp/astra-order558-isolated-runner.ts | 691326C9D23953649DE55D2C9BC653BBB350E93B1CC50B3C732486A2B50CED5B |
| D:/Yellow/temp/astra-order558-race.test.ts | 993A606B6B431BFEE4B75CEAEC19491A61673E77A40FBBA80E336FB4408A545C |
| D:/Yellow/temp/astra-order558-continuity-proof.ts | 8A25F74743027125EF76C28D7259870B5F2876C804800F047DDA496B0793F728 |
| D:/Yellow/temp/astra-order558-effects-proof.ts | 122A6EC69CEECF682C3D892F212FA08DEE2E98E5AB693E75BA1E6501486AB013 |
