# Order572 — independent cashier receivable review

## R1 — REJECT / CHANGES REQUIRED — 2026-09-21

Reviewer `/root/astra_review`, independent of implementation. Read PROJECT.md and Order572, ran state.ps1, inspected receivable decisions and the existing financial contract/service/tests, and read the mandatory yellow compliance/entity/Postgres skills. The financial invariants require exact displayed consent and reliable reconciliation, not merely server rejection of unsafe states. No implementation edits or public deployment/financial requests by this reviewer.

All four requested frozen SHA-256 values matched before and after executable proof:

- App.tsx `C2D84854601C605051CDE3720F25E8D24BACC01E9E0CB2D20F507B4C01CBE561`.
- styles.css `AB2CB747BC06938532B7742BB7A04C22D791DDAE9E28048AFC71208EDD046339`.
- yellow-cashier-receivable-workbench.test.ts `F8ACE8C3E6CD15A6D5488A4C71FB0172478CE1BAE0B44EF354C8D8CBE3C59D69`.
- yellow-next-finance-workspace.test.ts `F234F8AEACE3EF845654982D608702F649F473DDFBAEB15567C628650D0B4594`.

## Blocking findings

### P1 — the new exact financial preview rounds away money

New transfer/exposure/limit/projected-exposure fields use existing `money()`, which converts bigint through Number, always divides by100 and renders maximumFractionDigits0. Personally executed actual extracted formatter: SAR2549 minor displays **SAR25**, SAR1 displays **SAR0**, JPY2500 displays **¥25**, and SAR900719925474099301 loses precision. Operator confirmation says exact balance while showing a different amount. This is newly consequential use of an inherited helper, not a claim this order originally introduced the helper.

Use an exact bigint-safe, currency-exponent-aware representation for every new monetary value, or show exact minor-unit strings with currency and explicit minor-unit labels. Unsupported exponents must fail closed rather than assume100. Permanent tests must include fractional SAR and values above Number.MAX_SAFE_INTEGER.

### P1 — unresolved transfer can be replaced by a new key/body

`transferDirectBilling` releases its shared busy state on every error but retains no unresolved-attempt guard. Target change, audit-reason change, a new preview, or stay/window selection can clear the retained key. `uncertain` from fetch/5xx is never consumed. Successful malformed JSON/receipt also has no durable uncertain classification. The extracted actual handler proof simulated503, applied the exact current reason-change reset, and retried: **two different yellow-receivable-transfer keys** were used while the first outcome remained unknown. A successful lost response followed by later activity can therefore create a second transfer rather than reconcile the first.

Retain the immutable attempted folio/target/reason/body/key and uncertainty latch through malformed2xx, network/5xx, reconciliation failure and later rejection. Disable unrelated changes/actions until that attempt is authoritatively reconciled; same-key replay must not depend on a still-positive preview or disappear once the first transfer has zeroed the folio. Apply equivalent safe retry handling to approval-request uncertainty. Tests must execute effects, not just find idempotency variable names.

### P1 — receipt and journal evidence are not bound to the confirmed proposal

The transport validates structural fields and folio/account identity, but never binds returned amount, currency, Party/role, approval semantics or exposure fields to the confirmed preview. The handler checks only matching journalId somewhere in the statement plus zero total. Reviewer-controlled actual handler with confirmed SAR2549 accepted a receipt for USD9900/wrong Party and a zero statement containing that journalId, then emitted **Direct billing recorded to Target A. The guest folio is now zero.** This is a controlled dependency/effect proof, not a claim the current canonical server normally emits that malformed receipt.

Validate coherent fresh target/preview and command receipt against frozen consent. Reconcile exact folio/currency/journal/transfer evidence and amount, not an arbitrary matching journal ID. Current transfer service derives the then-current full balance and the UI does no fresh comparison immediately before write; stale cached folio+preview may both still match each other. Do not describe a changed server amount as the exact confirmed transfer. Any extra atomic CAS authority beyond the existing endpoint requires a separately explicit scope decision, not an invented client field.

### P2 — pending read/approval work can overwrite a newer selected stay

Preview uses component state without a request generation or immutable identity revalidation. It sets only local receivableBusy, while stay/window selection and parent commands remain available; approval request likewise omits the shared mutation lock. Executed held-preview proof: start for folioA, select folioB/reset, resolve old request; **folioA preview publishes after folioB selection**. The mismatch guard can block some transfers but does not prevent misleading stale evidence or stale approval messages. Exact-folio search similarly has no generation cancellation and does not call resetReceivableDraft.

Guard all awaited identity-sensitive reads with current generation/folio/target evidence; clear obsolete results. Acquire shared synchronous mutation lock before approval writes and preserve exact pending attempt identity. Test held response → changed stay/window/parent command and approval overlap in actual effects.

## Personally executed proof

Working directory for project commands: `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

- `bun test tests/yellow-cashier-receivable-workbench.test.ts tests/yellow-next-finance-workspace.test.ts tests/operator-receivables-workbench.integration.test.ts` — **10 passed,0 failed,144 assertions**. These files are source/contract tests; the operator file's name does not make it an actual database test.
- `bunx tsc --project frontend/yellow/tsconfig.json` — exit0, no diagnostics.
- `bunx vite build --config frontend/yellow/vite.config.ts` — exit0,469 modules, index-CJS62w1N.js / index-CHlhbfBB.css. Candidate asset build only.
- `bun D:/Yellow/temp/astra572-hostility.ts` — exit0, actual extracted formatter, preview and transfer handler probes reproduced all four findings above. No network or DB writes in this harness.
- `bun D:/Yellow/temp/astra572-db.ts` — reviewer-owned wrapper privately loads `.yellow/runtime-database-authority.env`, resolves the designated isolated order460 container's database in memory, pins both connection URLs to loopback5442, checks fixture tenant absent, and executes `bun test tests/financial-receivable-transfers.integration.test.ts --timeout 120000` with `YELLOW_REQUIRE_FINANCIAL_RECEIVABLE=1`, deploy/runtime authority set privately. **10 passed,0 failed,45 assertions,2.95s**.

Database preflight personally observed PostgreSQL16.15, migration97, dedicated Order198 fixture tenant count0. This was the authorized existing isolated cluster, **not a newly created cluster**. Existing test creates/cleans its bounded fixture. Actual proof covers app-role capability/raw approval denial, exact positive transfer/zero settlement, ineligible targets/zero/stale/self-approval denials, distinct-user approval, shared-credit concurrent winner, idempotent commands, approval/journal fact/outbox evidence and rejected approval unusability. No public DB access and no public financial action. Database pass does not close the new UI blockers.

## Rendered preparation evidence

`node D:/Yellow/temp/astra572-render.cjs` — exit0 using existing installed Chrome/bundled Playwright. Browser-only final local JS/CSS substitution into the public read-only cashier; absent targets and preview supplied as clearly fictional route fixtures. Preview POST was fulfilled locally, never sent to public server. All other non-GET/HEAD/OPTIONS requests except automatic demo session entry were blocked. Observed operational attempts0 and page errors0. No checkbox checked or transfer submitted.

Flow: Ask Yellow → open current fictional cashier → choose reviewer fixture target → preview → enter preparation-only audit reason. At375x812 document/scroll375/375, desktop1440/1440. Preview/transfer buttons44px, textarea64px, confirmation label63.5px mobile/49px desktop; all measured within viewport. Transfer remains disabled before confirmation. Screenshot personally viewed: `D:/Yellow/temp/astra572-mobile.png`. These checks establish candidate layout and initial confirmation behavior, **not real eligible public target configuration, public deployment identity, or successful transfer correctness**.

## Positive boundaries and disposition

Only existing server endpoints are called, with bearer session and server-returned target IDs. No frontend self-approve call is added. Over-limit UI offers request only, explains distinct supervisor, and does not directly transfer. No physical PM room, occupancy, financial DML, payment, checkout or new accounting primitive is added. Drawer absence is independent. Search uses returned guest/confirmation/unit/type/source/channel/market values and explicit result selection; exact folio is a separate canonical lookup in the same field, not automatic company inference.

**R1 REJECT.** Preserve this evidence. Correct the four behavior gaps within admitted scope, add executable regression cases, freeze new hashes and request a fresh independent review. Do not promote or claim financial workbench acceptance from the green static suite, database service proof or mobile geometry alone.

---

## R2 — REJECT / CHANGES REQUIRED — 2026-09-21

Same independent reviewer, new inspection and personally rerun evidence; R1 preserved. All four R2 frozen hashes match, rechecked after proof:

- App.tsx `85E0A6FB608823462D910B3CBEDA56C72818A83666A2A63339DE245EDEE8BADC`.
- styles.css `4C10F1658E11575B8630452C43E4E4D5912D815F3222DDDD3D2E14178DF9A2D9`.
- receivable test `650F4F7B9EBAEF59C7403D9A0956E701396A1F9476A4E3D6B7FC432C386D092F`.
- finance test unchanged `F234F8AEACE3EF845654982D608702F649F473DDFBAEB15567C628650D0B4594`.

### Personally executed

- Same R1 three-file focused command: **12 passed,0 failed,159 assertions**. Strict frontend `bunx tsc --project frontend/yellow/tsconfig.json`: exit0. `bunx vite build --config frontend/yellow/vite.config.ts`: exit0,469 modules; index-Cva3lfYU.js / index-DyJx7-FL.css.
- `bun D:/Yellow/temp/astra572-db.ts`: privately supplied isolated loopback5442 authority, PostgreSQL16.15/migration97, bounded fixture initially absent; actual `bun test tests/financial-receivable-transfers.integration.test.ts --timeout 120000` with required flag: **10 passed,0 failed,45 assertions,2.28s**. No public DB access.
- `bun D:/Yellow/temp/astra572-r2-hostility.ts`: exit0, personally inspected actual extracted-function outputs below. Helpers include actual submitReceivableTransfer, parser, uncertainty classifier, preview/approval/transfer handlers, retry predicate and formatter. No external request or DB action in this harness.
- `node D:/Yellow/temp/astra572-r2-render.cjs`: exit0; actual React/browser effects using R2 built-asset substitution plus locally fulfilled fictional targets/preview and **locally fulfilled503 transfer response**. The simulated financial POST never reached the public server. All other operational writes were blocked. Public reads/demo session only; no page errors.375/375 and1440/1440 containment, minimum44px controls, initial unchecked/disabled transfer pass. After the locally simulated uncertain result, actual Yellow command `Show arrivals` replaces/removes the cashier and its retained attempt. Screenshot: `D:/Yellow/temp/astra572-r2-mobile.png`.

### Verified repairs

Exact formatter now returns SAR25.49 for2549, SAR0.01 for1, JPY2,500 for2500 and preserves SAR9,007,199,254,740,993.01 exactly for900719925474099301. The original wrong currency/amount receipt now rejects with uncertain=true. Explicitly advancing the preview generation suppresses the held old result. Within the still-mounted cashier, uncertainty makes reason read-only and target/stay selection disabled; immediate same-key retry is offered while the cached folio remains positive.

### Residual blockers

1. **P1: financial uncertainty is still lost.** Actual malformed200 JSON throws SyntaxError with uncertain=false because `receivableResponse(...).json()` occurs before the new protected validation try/catch. A valid receipt followed by statement GET failure likewise becomes uncertain=false. Executed503→403 sequence produces uncertainty true→false, erasing knowledge that the first request may already have committed. These paths unlock changed inputs/new keys. Preserve a monotonic unresolved-attempt latch once dispatched unless exact durable reconciliation resolves it; classify parsing, receipt and post-commit-read failures as uncertain.
2. **P1: parent navigation discards unresolved financial attempt.** Every transfer finally calls parent busy false, including503. No higher-level pending-attempt store or navigation guard exists. Personally rendered local503 showed `Outcome not yet verified`, read-only reason and enabled retry; typing `Show arrivals` then removed `.cashier-receivable`, losing the component-local key/proposal. Thus the visible assertion that Yellow has locked this attempt is false outside its local inputs. Protect parent command/navigation and keep recovery available without freezing its own retry control; test actual parent+child behavior.
3. **P1: successful-but-unacknowledged zero balance prevents recovery.** `canTransferReceivable` still requires cached balance===old preview amount; positive-balance rendering encloses the retry panel. Controlled canonical balance update to0 while uncertainty=true makes canRetry=false and hides the positive-balance branch. This is precisely the expected postcondition of a transfer whose response was lost. Reconciliation must use retained request/receipt evidence independently of current balance eligibility; it must neither generate a new key nor require a new positive transfer.
4. **P1/P2: approval mutations remain outside the claimed recovery/lock correction.** Actual extracted requestDirectBillingApproval with503 yields uncertainty=false, shared-lock calls=[],busy=false. Its malformed/changed receipt path is also an ordinary error. Parent replacement can discard the approval key while it is pending, and target/repreview can reset it after failure. Implement the same bounded immutable-attempt/lock/reconciliation discipline for approval creation; never add self-approval. Generation checks only suppress late UI results and do not cancel an already-dispatched mutation.

The R1 requirement for fresh consent/evidence remains only partly met: no fresh preview comparison occurs before first transfer, and post-write statement validation still checks only folio id, zero total and existence of journalId, not exact currency/transfer line evidence. The new receipt comparisons are useful but detect changed server balance/exposure only **after** dispatch. Do not claim atomic amount CAS from this endpoint, whose existing contract derives the then-current full balance; any stronger authority is a scope decision. R2 does not close this limitation merely by rejecting an unexpected receipt.

**R2 REJECT.** Money and several parser/generation cases are repaired; unresolved financial recovery and parent-workflow correctness are not. Green DB invariants prove the existing canonical service, not the new UI lifecycle. Keep frozen evidence and add actual-effect regressions covering these failures before R3. Reviewer edited only review and external proof artifacts; no implementation/public deployment/public financial data changes.

---

## R3 — REJECT / CHANGES REQUIRED — 2026-09-21

Independent reviewer `/root/astra_review`; R1/R2 preserved. Verified frozen App `CAF09F58DB536C2ECFC76F0CF347D2FB5E4EA2C7F27864309C14E591A9C283A6`, CSS `4C10F1658E11575B8630452C43E4E4D5912D815F3222DDDD3D2E14178DF9A2D9`, receivable test `CD5D5F293241D26F59B5E3C4EBCA45882CC83522B9496912773AEDFEC8C0B3D2`, unchanged finance test `F234F8AEACE3EF845654982D608702F649F473DDFBAEB15567C628650D0B4594`. App rehashed after proof, unchanged.

### Personally executed gates

- Same three-file focused command as R1/R2: **12 passed,0 failed,163 assertions**.
- `bunx tsc --project frontend/yellow/tsconfig.json`: exit0.
- `bunx vite build --config frontend/yellow/vite.config.ts`: exit0,469 modules; index-DKCcXy1D.js / index-DyJx7-FL.css.
- `bun D:/Yellow/temp/astra572-db.ts`: authorized isolated port5442 PostgreSQL16.15/migration97 and initially absent fixture; actual financial receivable suite **10 passed,0 failed,45 assertions,2.31s**. No public DB access.
- `bun D:/Yellow/temp/astra572-r3-hostility.ts`: final exit0. Reviewer adapted the retained R2 harness and personally executed current functions. An initial harness adaptation omitted the derived receivableAttemptUncertain boolean for the preview subtest; corrected only the external harness and reran. This harness error is not a candidate finding.
- `node D:/Yellow/temp/astra572-r3-render.cjs`: exit0, actual rendered candidate with browser-local fictional targets/preview/503 response. Operational POST was fulfilled entirely inside the reviewer browser; no transfer sent to the public server. Page errors0, non-fixture operational requests0.375/375,1440/1440,44px minimum controls and unchecked/disabled initial transfer remain green. Retained screenshot `D:/Yellow/temp/astra572-r3-mobile.png`.

### Repairs independently confirmed

Malformed200 and mismatched receipt now classify uncertain. Valid receipt followed by failed statement read retains operation=transfer and parent lock.503→403 preserves transfer uncertainty and same retained key. Zero-balance predicate now permits a transfer retry, and the positive-balance/target-list branches preserve retained UI. Approval503 retains operation=approval and parent lock. Exact money and generation suppression remain correct.

### P1 — rendered recovery deadlocks under its own parent lock

Actual React/browser sequence: prepare fixture target, confirm, click transfer; local route returns503. UI displays Outcome not yet verified and an **enabled** Retry and reconcile same transfer button. Click that real button. Instrumented locally intercepted transfer attempts remain **1, expected2**. `guardReservationLifecycleFlight` unconditionally prevents/stops every click and submit whenever the retained parent lock is true. Thus neither transfer retry nor approval retry can reach its handler. Parent Show arrivals now correctly leaves the component mounted, but the operator has no working recovery path.

Do not repair by blanket-unlocking uncertain work. Provide a narrowly scoped, identity-bound recovery interaction through the guard while all unrelated navigation/commands/mutations remain blocked. Execute integrated parent+child pointer and keyboard retry tests proving the same request/key reaches the stub exactly once per intentional retry, then successful reconciliation releases the lock.

### P2 — statement error still hides retained recovery

Source `cashier-posting` outer conditional remains `folio.isError || !folio.data ? <error> : <entire workbench>`. The new retained overrides are deeper and only bypass positive-balance/target-query gates. A background statement refetch error therefore removes the retry control while the parent remains locked, even with cached data. Retained reconciliation must render independently of ordinary statement loading/error state, as well as zero balance and missing targets. This is a source finding; the renderer above exercised503 transfer with a healthy statement, not this additional failure state.

R1/R2's fresh-preflight and exact statement-line evidence limitations also remain: transfer still dispatches directly from cached preview and verifies only journalId presence/zero balance after receipt validation. No new atomic amount CAS or full journal-evidence proof is claimed by this review.

**R3 REJECT.** Helper-level financial recovery is improved; actual integrated UI recovery is not executable. Preserve these frozen bytes/evidence, address the scoped lock and retained-rendering behavior, and request a new frozen review. Reviewer made no implementation or deployment change.

---

## R4 — CHANGES REQUIRED — 2026-09-21

Reviewer `/root/astra_review` independently executed current bytes. Hashes match: App `4C19B90717C6D696053FC41A45CE8E7550C57FA6EA4FD72BAF1D3217BBDA4256`, CSS `4C10F1658E11575B8630452C43E4E4D5912D815F3222DDDD3D2E14178DF9A2D9`, receivable test `39C958C6BD112C83EF8DD0A7F7F09552C821DFE48C3372B9653665C960B19364`, finance test `F234F8AEACE3EF845654982D608702F649F473DDFBAEB15567C628650D0B4594`.

### R3 integrated failures closed

`node D:/Yellow/temp/astra572-r4-render.cjs` completed exit0. Actual pointer retry after browser-local503 emitted **two** intercepted POSTs with identical body and key. Parent Show arrivals remained blocked. A deliberately failed statement refetch with stale data displayed the refresh warning and retained the working recovery button. The first attempt to trigger this used window visibility, but the app intentionally disables focus refetch; the final harness invokes the mounted React Query client's real refetchQueries for the exact cashier statement key, with its network response fault-injected locally. An intermediate external harness string-replacement syntax error was repaired only in the harness. No source change or real public financial request occurred.

375/375 and1440/1440 containment, minimum44px controls, initial confirmation disabled, page errors0. Assets substituted only in reviewer browser: index-2JWh7qXF.js / index-DyJx7-FL.css. Screenshot `D:/Yellow/temp/astra572-r4-mobile.png`. This is independently executed candidate integration proof, not public deployment acceptance.

### Gates rerun

- R1/R2 three-file focused command: **12 passed,0 failed,166 assertions**.
- Frontend strict TypeScript: exit0. Vite: exit0,469 modules.
- `bun D:/Yellow/temp/astra572-db.ts`: authorized isolated port5442, initially absent fixture; PostgreSQL receivable proof **10 passed,0 failed,45 assertions,2.11s**.
- `bun D:/Yellow/temp/astra572-r3-hostility.ts` and `bun D:/Yellow/temp/astra572-r4-hostility.ts`: exit0. Prior money/receipt rejection/uncertainty-latch/zero-retry/approval-lock/generation repairs stay green. The latter adds executed retained financial evidence gaps below.

### Retained financial findings not yet closed

1. **P1 — first dispatch still authorizes stale cached evidence without a fresh comparison.** The actual handler performs zero preview reads before the first command. A user may leave the displayed preview open while another writer changes the full folio balance or exposure. Existing canonical endpoint derives current full balance; detecting a changed receipt only after mutation is not protection for the UI's claim that the exact displayed balance was authorized. At least re-read canonical preview and compare every material bound field before first dispatch, require reconfirmation on drift, and never do that refresh for a retained replay. Explicitly resolve the remaining atomic full-current-balance vs exact quoted-amount contract; client-only preflight cannot create server CAS. This limitation has been retained since R1 and is not waived by fixing recovery.
2. **P1/P2 — statement truthfulness still accepts incoherent evidence.** Actual extracted handler with a correct receipt for SAR2500, but statement currency USD and an unrelated positive1 charge row sharing its journalId plus zero balance, emits `Direct billing recorded to Test. The guest folio is now zero.` Receipt validation alone does not validate subsequent statement data. Require the exact folio/currency, correct transfer-kind debit/credit direction and amount/journal evidence supplied by the canonical statement contract, and reject incompatible or incomplete evidence as unresolved. This is hostile controlled-response proof, not a claim the canonical server currently emits such a response.

**R4 CHANGES REQUIRED.** R3's two blockers are resolved and recovery now works; the prior consent-freshness and full statement-binding gaps remain. Preserve R1–R4 and request a fresh frozen review after bounded correction or an explicit governance resolution of the endpoint semantics. No public financial data, schema or deployment was changed by this reviewer.

---

## R5 — CHANGES REQUIRED — 2026-09-21

Independent reviewer `/root/astra_review`; no implementation edits. R1–R4 retained. Personally matched and rehashed after proof: App `F0D4EE8FAEDA33CA2F7CC2446455097028FD01988969BE12BB53DBC90F9BF494`; CSS `4C10F1658E11575B8630452C43E4E4D5912D815F3222DDDD3D2E14178DF9A2D9`; receivable test `762630ECE18465B5BEB95B3BE02D4C39C289F577670E185B4AD3D04502B600D9`; finance test `F234F8AEACE3EF845654982D608702F649F473DDFBAEB15567C628650D0B4594`.

### Personally executed evidence

- `bun test tests/yellow-cashier-receivable-workbench.test.ts tests/yellow-next-finance-workspace.test.ts tests/operator-receivables-workbench.integration.test.ts`: **12 passed,0 failed,173 assertions**.
- `bunx tsc --project frontend/yellow/tsconfig.json`: exit0.
- `bunx vite build --config frontend/yellow/vite.config.ts`: exit0,469 modules; index-BqHOYGwe.js / index-DyJx7-FL.css.
- `bun D:/Yellow/temp/astra572-db.ts`: isolated loopback5442 PostgreSQL16.15/migration97, initially absent bounded fixture; personally executed `bun test tests/financial-receivable-transfers.integration.test.ts --timeout 120000` with required flag and protected authority: **10 passed,0 failed,45 assertions,2.29s**. No public DB connection.
- `bun D:/Yellow/temp/astra572-r5-hostility.ts`: exit0; current extracted functions, no network/DB. Exact money, malformed200/mismatched receipt uncertainty, valid-receipt/read-failure lock,503→403 latch, zero-balance retained retry, approval503 lock and superseded preview all remain green. Correct SAR2500/negative2500 single-journal zero statement releases the lock and claims success. Wrong currency, wrong amount and duplicate same-journal rows refuse success and retain uncertainty/parent lock. Initial harness state setters were adjusted to preserve React's captured-render value when assessing the successful branch; candidate source was not edited.
- `node D:/Yellow/temp/astra572-r5-render.cjs`: exit0. Actual parent/child React effects with local candidate-asset substitution and browser-only fictional targets/preview/503 responses. First dispatch performs a second preview; retry does not: **2 previews,2 intercepted transfers, identical body/key**. Forced failed statement refetch still retains working retry; unrelated Show arrivals stays blocked.375/375 and1440/1440 containment, minimum44px controls, initial unchecked/disabled transfer, zero page errors/non-fixture operational requests. Screenshot `D:/Yellow/temp/astra572-r5-mobile.png` (also reused by drift harness).
- `node D:/Yellow/temp/astra572-r5-drift-render.cjs`: exit0; actual drift/reconfirmation failure below. All mutation routes are fulfilled locally or blocked; no public transfer/approval request reaches the server. Automatic demo session and public reads only.
- Additional repository-wide `bun run typecheck`: **exit1**, unrelated out-of-scope `tests/india-native-fiscal-credit-note-list.test.ts(57,37): TS2540 Cannot assign to actorId because it is a read-only property`. Do not claim a green repository-wide typecheck. Scoped strict frontend check is green.

### R4 financial findings closed at the UI boundary

First submission now re-reads and compares the complete canonical preview, refuses changed evidence before any transfer and clears confirmation. Retained uncertain retries correctly skip re-preview and retain the original body/key. Refreshed statement now binds folio, currency, zero balance, exactly one returned-journal row and exact negative receipt amount. These repairs pass independent actual-effect proof. This does not add an atomic server amount CAS: the canonical command still derives current full balance, and no stronger concurrency guarantee is claimed.

### P2 — refreshed proposal cannot actually be reconfirmed after balance drift

Personally rendered initial preview SAR25.00, then locally supplied SAR99.00 at pre-submit recheck. Result: **zero transfers**, confirmation correctly unchecked and visible new SAR99.00 proposal plus “Review the refreshed exact proposal and confirm it again.” Checking the box again leaves Transfer disabled. `canTransferReceivable` compares new preview9900 against old cached `folio.data.balanceMinor`2500, which this branch never refreshes. Clicking Preview exact transfer again makes a third preview call, removes the proposal and reports “The live folio changed ... Refresh and preview again”; it likewise does not refresh the stale statement. No working refresh control is offered in this workflow. The query disables focus-refetch, so this is not repaired by simply returning focus to the page.

Preserve the no-write/cleared-consent behavior, but reconcile the authoritative statement/cache on detected drift or provide an explicit working refresh-and-repreview path, then require a new confirmation. Test actual mounted UI with coherent new server statement plus changed preview: first attempt0 writes, new proposal unchecked, operator can intentionally reconfirm after exact fresh evidence. Do not bypass the balance guard or refresh/rewrite a retained uncertain attempt.

**R5 CHANGES REQUIRED** for that reproducible recovery defect. Financial safety repairs and isolated canonical service proof are green; candidate is not accepted for promotion yet. Repository-wide unrelated typecheck failure is separately disclosed, not attributed to this order. No implementation, public financial data, schema or deployment changed by this reviewer.

---

## R6 — ACCEPT (bounded source/UI slice) — 2026-09-21

Independent reviewer `/root/astra_review`, not the implementer. R1–R5 evidence preserved. All four frozen hashes personally verified before and after proof:

- App.tsx `C677358ED4D50717896A58CBC6BD87BAFEA96CD16356D8D428F51D628CD0F02F`.
- styles.css `4C10F1658E11575B8630452C43E4E4D5912D815F3222DDDD3D2E14178DF9A2D9`.
- yellow-cashier-receivable-workbench.test.ts `F186957E6C2FA34038DB9F0830C97229D20D6EFD8B985775405659735BF6742C`.
- yellow-next-finance-workspace.test.ts `F234F8AEACE3EF845654982D608702F649F473DDFBAEB15567C628650D0B4594`.

### Personally executed final proof

1. `bun test tests/yellow-cashier-receivable-workbench.test.ts tests/yellow-next-finance-workspace.test.ts tests/operator-receivables-workbench.integration.test.ts`: **12 passed,0 failed,176 assertions**.
2. `bunx tsc --project frontend/yellow/tsconfig.json`: exit0.
3. `bunx vite build --config frontend/yellow/vite.config.ts`: exit0,469 modules; **index-DgR-zKvS.js / index-DyJx7-FL.css**.
4. `bun D:/Yellow/temp/astra572-db.ts`: isolated loopback5442 PostgreSQL16.15/migration97, bounded fixture absent at start. Executes `bun test tests/financial-receivable-transfers.integration.test.ts --timeout 120000` with required flag and privately loaded isolated authority: **10 passed,0 failed,45 assertions,2.66s**. Personally observed app-role/raw-lineage denial, balance and exposure changes, invalid target/currency/self-approval rejection, distinct-user approval, shared-credit concurrency, idempotency and transactional journal/fact/outbox proof. No public DB access.
5. `bun D:/Yellow/temp/astra572-r6-hostility.ts`: exit0. Current actual extracted functions retain all R5 money/receipt/latch/parent-lock/zero-retry/approval/supersession repairs. Correct bound statement succeeds/unlocks; wrong currency, amount and duplicate journal rows remain unresolved/locked. Coherent drift refreshes cached statement2500→9900, produces0 submissions, clears confirmation and permits new confirmation. Inconsistent preview9900/statement2500 produces0 submissions and removes proposal/consent.
6. `node D:/Yellow/temp/astra572-r6-render.cjs`: exit0. Actual mounted parent+child candidate, browser-only asset/fixture/failure substitution. **2 previews total;2 intercepted transfers with identical body and key**. Retry remains accessible after forced statement-refetch failure; unrelated parent navigation remains blocked.375/375 and1440/1440 containment, minimum44px controls, initial unchecked/disabled submit,0 page errors. Screenshot `D:/Yellow/temp/astra572-r6-mobile.png`.
7. `node D:/Yellow/temp/astra572-r6-drift-render.cjs`: exit0. Independently authored coherent drift fixture changes both canonical preview and statement to9900. First confirmation makes0 submissions, refetches statement, clears consent; new explicit confirmation enables submission. Final **3 previews,1 intercepted503 transfer**, no unexpected effects/errors.
8. `$env:REVIEW_INCONSISTENT='1'; node D:/Yellow/temp/astra572-r6-drift-render.cjs`: exit0. Separate inconsistent statement case: **2 previews,0 transfers,proposal removed**, no page errors. No blanket enablement or weakening of equality checks.
9. Additional `bun run typecheck`: exit1, same unrelated out-of-scope `tests/india-native-fiscal-credit-note-list.test.ts(57,37) TS2540` readonly actorId assignment. Scoped frontend typecheck is green; repository-wide green is **not** claimed.

### Findings and limits

R5's recovery defect is closed: drift now refreshes authoritative folio before presenting the changed proposal, validates exact identity/currency/balance, and requires fresh unchecked consent. Incoherent evidence fails closed; retained uncertain attempts never take this new-preview path. Existing server-only target selection, separate approval request without self-approval, exact money, stable retry body/key, uncertainty lock, receipt and statement binding, drawer independence and mobile controls remain intact. No blocking finding remains in the reviewed UI slice.

**ACCEPT for these exact Order572 source bytes.** This is not public deployment or operational-action authorization. Browser financial POSTs were fulfilled entirely inside the reviewer browser; no public transfer, approval or charge was submitted. Canonical PostgreSQL proof used only isolated5442. Browser reads/demo-session establishment do not constitute a published-candidate claim. As throughout review, the canonical server command transfers the current full balance; the client preflight does not supply atomic amount CAS and this acceptance makes no new exact-quote concurrency guarantee. Any public promotion requires its target-bound checks and disposition of the separately disclosed repository-wide test debt; no whole-PMS or full-repository-green claim. Reviewer changed only this review and external proof artifacts.
