# Order552 — independent React/Yellow housekeeping progression review

Current verdict: **ACCEPT for the final frozen candidate in the R3 section below.** Earlier REQUEST CHANGES findings are retained as historical evidence.

Reviewer: Codex Astra `/root/astra_review`, non-implementer. Date: 2026-09-21.

**REQUEST CHANGES. Public promotion remains prohibited.** No implementation edits or public/database target operations were performed. Database execution was confined to a fresh reviewer-owned database on isolated loopback55643.

## Source binding and findings

Read governance PROJECT.md, Order552 and existing Order201 service/HTTP semantics; used code-review and Yellow Postgres/entity guidance. Runtime source root: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

Initial App SHA256 `DA8FE8FC23EBFF263D7897FF6BE3128B66C1FBFD10AC7C7596B04B91C01DC15F` / progression test `ADF82256E2486BE51B363D95AE80C1C0AE207EF781B43CB9A8BCCDD6BF81035D` had a legitimate-receipt rejection: start hardcoded next allowedActions to complete. Canonical service permits assigned clean/inspected task start, which yields no next action. The reviewer personally exercised the actual validator and demonstrated rejection of that valid receipt. The implementer repaired this during review; the initial executable failure remains evidence, not a claim about corrected bytes.

The subsequent integrated cross-flow reproduction and final passing source/type/build commands bind to:

- App: `CC039935CE343D1C959822B1EA33D24978D89034D573B3DEFB1A05539067385A`
- voice: `EB671471FF0625085AEDBE086DE68147D3EF504306D32C9FAEA6F515EA8DD2C5`
- styles: `7122408221B3E0D36C644856AE6060AC4B33C987108A6B3A570B7C8BA7ECAF1F`
- progression test: `B4A9585B012A7D8379B8DB08889A182A249D168BD5070D552BF28EC0C1C8AB25`
- voice test: `540670A3A21DCD17FC6A4CAB3E5A47B044AD22CC14C64577DB563EE1C99FA96F`

### Blocking: confirmed housekeeping action does not hold the parent mutation lock

Actual extracted outer `ask` plus child effects, wired to controlled promises/state and the shared generation, reproduced this sequence:

1. Prepare `mark room clean`, confirm yes, hold the housekeeping transition response in flight.
2. Parent accepts `add New Guest as accompanying` and displays/speaks a guest-allocation confirmation question while the confirmed housekeeping action is still running.
3. Release the housekeeping response. The older action announces completion over that newer guest confirmation question.

Child `conversationInFlight` is local and does not own parent `reservationLifecycleBusyRef`; generation invalidation protects pending lookup, not an already-confirmed action's completion reply. A competing command can therefore create confusing overlapping authority. The implementer acknowledged this blocker. Confirmed child and manual housekeeping operations must acquire/release the shared synchronous mutation ownership through canonical refresh, with controls and parent command entry guarded, and independently reproduce rejection of overlapping commands before approval.

The task remains a staff declaration, not actor==assignee evidence; clean remains distinct from inspected and no extra inspection prerequisite is invented. Source inspection found only existing authenticated task detail/transition endpoints, exact expected status/condition/timestamp, canonical refresh and idempotency. No direct task/condition/occupancy/financial DML was added. Static44px proposal controls and wrapping styles exist, but no independent rendered375px browser containment proof is asserted.

## Personally executed actual-function proof

```powershell
bun D:/Yellow/temp/astra-order552-ui-proof.ts
bun D:/Yellow/temp/astra-order552-crossflow-proof.ts
```

The first harness executes actual manual handlers plus actual HTTP/detail/receipt helpers with controlled fetch: unchecked confirmation refuses; assigned/dirty start, pickup complete, done/clean verify pass; stale timestamp causes zero POST;403 refuses automatic retry/success; uncertain immediate and human retries retain exact key/body; hostile receipt refuses success; malformed exact task DTOs are rejected. It positively reproduces the initial assigned/clean receipt defect on AppDA8FE8FC.

The second harness reruns15 inherited cleaning/guest supersession groups successfully and positively reproduces the confirmed-housekeeping/parent overlap against AppCC039935. Its first attempt used unsupported parser wording `mark physically clean`; switching the reviewer instruction to supported `mark room clean` produced the stated reproduction. This was a harness instruction correction, not a product fix. No actual guest/task write was sent by these harnesses.

Artifact hashes:

- `D:/Yellow/temp/astra-order552-ui-proof.ts`: `3EFFAD291C257C68FBBDFD8DD2388371C7367EA06C7920F187F6CD7C711A471E`
- `D:/Yellow/temp/astra-order552-crossflow-proof.ts`: `3E0904F680C647596B26063570458B8A622DFF02D497A3DF646C51A0069DDCC1`

## Personally executed fresh PG16 lifecycle proof

Started only retained reviewer container `yellow-astra-order543-pg` (`postgres:16-alpine`, exactly127.0.0.1:55643). Initial connection/test attempt returned57P03 startup errors before fixture work; after `docker exec yellow-astra-order543-pg pg_isready` accepted connections, created fresh `yellow_astra_order552` and migrated normally:

```powershell
docker start yellow-astra-order543-pg
docker exec yellow-astra-order543-pg pg_isready
bun -e "import{SQL}from'bun';import{runMigrations}from'./scripts/migrate.ts';const s=new SQL('postgres://yellow_deploy@127.0.0.1:55643/postgres');await s.unsafe('CREATE DATABASE yellow_astra_order552 OWNER yellow_deploy');await s.close();const r=await runMigrations({databaseUrl:'postgres://yellow_deploy@127.0.0.1:55643/yellow_astra_order552',logger:()=>{}});console.log(JSON.stringify({applied:r.appliedFiles.length,discovered:r.discoveredFiles}));"
$env:YELLOW_DEPLOY_DATABASE_URL='postgres://yellow_deploy@127.0.0.1:55643/yellow_astra_order552'
$env:YELLOW_RUNTIME_DATABASE_URL='postgres://yellow_runtime@127.0.0.1:55643/yellow_astra_order552'
$env:YELLOW_HOUSEKEEPING_URL=$env:YELLOW_RUNTIME_DATABASE_URL
$env:YELLOW_REQUIRE_HOUSEKEEPING='1'
bun test tests/housekeeping-task-lifecycle.integration.test.ts --timeout 120000
```

Migration output:95 applied/discovered. Final required DB suite: **5 pass, 0 fail, 35 assertions**. Actual database groups prove owner-contained capability/direct task and condition DML denial; start/dirty+pickup complete/clean verify with actor/time evidence; publication failure rolling task, condition, facts, outbox and idempotency back; stale/malformed/inactive/foreign refusal; exact replay/request drift and twenty contenders yielding one winner. This is personally rerun existing canonical service proof, not a pasted implementer result or an HTTP-authority test.

Personally inspected container binding, then `docker stop yellow-astra-order543-pg` exited0. Reviewer database/container retained stopped, nothing deleted. No public port55432 or shared app database port5442 was used. `bash ./state.sh` unavailable because WSL `/bin/bash` is missing; referee11/11 is not claimed.

## Source/type/build checks

```powershell
bun test tests/yellow-housekeeping-task-progression.test.ts tests/yellow-checkin-cleaning-conversation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-conversational-guest-allocation.test.ts tests/yellow-reservation-guests.test.ts tests/yellow-next-checkout-confirmation.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order552-reviewed-build
```

All exit0: **55 pass, 0 fail, 385 assertions**, six files; strict frontend/root types clean; Vite469 modules, JS `index-Dop27QvS.js`, CSS `index-BOEBTG0V.css`. These do not override the independent concurrency blocker. A new frozen review is required after remediation; no public, browser, whole-PMS or final source acceptance is granted.

## R2 controlled retest — 2026-09-21 (pending final adjacent/mobile corrections)

Candidate App `9A8EB00C8A33739C622A84D52282774C832D34A390ABAF35E85B56ADA55B7871` corrects both original behavioral findings. Reviewer personally passed actual manual handlers and actual parent shell lock/ask/capture with held transition and held refresh; competing parent commands and UI capture are blocked until finally releases the lock. Actual parent/child integrated prior overlap likewise passes, plus inherited lookup/proposal supersession cases. Canonical dirty/pickup/clean/inspected start receipts all validate; stale,403, uncertain exact-key retry, malformed DTO and hostile receipt controls pass.

Reviewer artifacts:

- `D:/Yellow/temp/astra-order552-r2-ui-proof.ts`, SHA256 `07C4D81984BB8C5CDB3FEF0BC374DEFB0ED3A2AAAA5CA4842AE0ACCDCA6E3F56`
- `D:/Yellow/temp/astra-order552-r2-crossflow-proof.ts`, SHA256 `B9F975566AABAF3D483B1E3B475827E4744F49B12F5440E7D503F5B526FC86EA`

Rerun commands were `bun` followed by each full artifact path. Reviewer-harness adaptation initially used an absolute generation-count assumption and an obsolete component delimiter; correcting those harness-only assumptions gave final exit0. Candidate implementation was never edited by reviewer.

Personally restarted only reviewer PG16, checked `pg_isready`, and reran the same required lifecycle integration command/env against isolated `yellow_astra_order552`: **5 pass, 0 fail, 35 assertions** again. Its beforeAll recreates the isolated fixture and afterAll cleans it. Container was stopped again; public target untouched. Frontend/root strict TypeScript passed and Vite469 built `index-DbIEfoAo.js` under reviewer directory `D:/Yellow/temp/astra-order552-r2-reviewed-build`.

Expanded adjacent command:

```powershell
bun test tests/yellow-housekeeping-task-progression.test.ts tests/yellow-checkin-cleaning-conversation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-conversational-guest-allocation.test.ts tests/yellow-reservation-guests.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-next-finance-workspace.test.ts
```

Result **60 pass, 1 fail, 485 assertions**. Failure is the stale lifecycle oracle at line37 expecting3 total `onLifecycleBusyChange={setReservationLifecycleFlight}` bindings; legitimate housekeeping integration now has6. Reported to implementer for a scoped semantic-oracle repair, not hidden or skipped.

Source/CSS also shows new task-list preparation buttons lack a44px sizing rule: only proposal Confirm/Cancel buttons have it; global button rules set font/cursor only. Requested a scoped preparation-control style/regression before final mobile-source acceptance. No rendered375px proof is claimed. Final acceptance remains withheld until these adjacent/mobile corrections are frozen and re-executed, despite the substantive concurrency and database proof being green.

## R3 — final frozen independent review, 2026-09-21

**ACCEPT — all identified source/behavior/test blockers are resolved for these exact bytes.** Reviewer: Codex Astra `/root/astra_review`, independent non-implementer. Earlier failure evidence remains intact.

| File | Final SHA256 |
| --- | --- |
| App.tsx | `362C024EF6765291D8F1976ED0637E3DB4FB9C9BFBE83AE48E7F93AF29BF755B` |
| voice.ts | `EB671471FF0625085AEDBE086DE68147D3EF504306D32C9FAEA6F515EA8DD2C5` |
| styles.css | `C3DB9CFEDD56AE442DB8E1ABD55BD3392E07D061DE60082B6EFDEDEFC9405AB1` |
| yellow-housekeeping-task-progression.test.ts | `D0CAC6AD81F01B80EDB7AB0998A7AF0B2F3F4F12070205FBDC54274B3C4384BA` |
| yellow-voice-routing.test.ts | `9DD7EA0AD35C65A2F0DCDE834224D39BA1AB4A4B821619C1BED1C0637E8E34B9` |
| yellow-reservation-lifecycle-actions.test.ts | `CC100A0A228F1D6808A7F77CCD10276158827DA22FFF30D847CBB35641F39008` |

Verified Order552 explicitly scopes the adjacent lifecycle-oracle correction. The new oracle checks three ReservationWorkspace callbacks, two HousekeepingWorkspace callbacks and the Overwatch callback within its actual JSX tag rather than a global count. The new task preparation class is applied to actual allowedActions buttons and has scoped44px minimum height; proposal controls retain44px targets. The change does not introduce imagery or modify the procedural neon behavior. Rendered375px/browser release proof remains separate; this is source/CSS containment review, not a fabricated browser measurement.

### Personally rerun final-byte proof

```powershell
bun D:/Yellow/temp/astra-order552-r2-ui-proof.ts
bun D:/Yellow/temp/astra-order552-r2-crossflow-proof.ts
bun test tests/yellow-housekeeping-task-progression.test.ts tests/yellow-checkin-cleaning-conversation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-conversational-guest-allocation.test.ts tests/yellow-reservation-guests.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-next-finance-workspace.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order552-final-reviewed-build
```

All exited0. Both reviewer-owned actual-function harnesses print final App362C024E hash and pass: manual start/complete/verify and receipt/denial/retry controls; manual parent lock and shell capture through held transition/refresh; inherited guest/cleaning supersession; original confirmed-child overlap now refusing parent guest/cancel commands until canonical completion and lock release. No real HTTP/database mutation is made by these harnesses.

Expanded source suite: **61 pass, 0 fail, 492 assertions**, nine files. Strict frontend and root TypeScript clean. Vite production build469 modules; main JS `index-mcBSNQiI.js`, CSS `index-zZmt1wDz.css`, reviewer-owned directory only. Rehashed all six candidate files after execution; they match the freeze.

The independently executed fresh95-migration PG16 lifecycle proof and its personal R2 rerun remain applicable to unchanged server/migration bytes: each final database run **5 pass, 0 fail, 35 assertions**, including actual transitions, actor/time fact/event evidence, condition/event/idempotency atomic rollback, stale/foreign/inactive denial, exact replay and twenty-contender convergence. They were not repeated or relabeled as new database work for the final CSS/oracle-only correction. Reviewer container remains stopped and retained.

Acceptance is bounded to Order552's existing governed task progression and exact reviewed React/conversation source. It grants no new endpoint, database authority, task reassignment/cancellation, physical-completion inference, occupancy or financial change. No implementation edits, public data mutation, public deployment or provider call was made. No referee11/11, independent rendered375px measurement, whole-PMS readiness or target-release acceptance is claimed; those separate release/browser gates remain with the implementation owner.
