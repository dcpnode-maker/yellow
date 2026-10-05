# Order580 — independent financial UI review

## R1 — REJECT / CHANGES REQUIRED,2026-09-21

Reviewer: independent Codex Astra `/root/astra_review`, not the implementer. Read PROJECT.md, ran Windows state ritual, read Order580 and relevant decisions, and applied the Yellow compliance/entity/PostgreSQL skills. Inspected the exact frozen serving-source files. No implementation changes, deployment, provider interaction or database mutation. The finance-entry test was initially absent from the order's Scope; coordinator explicitly added it during review. Its implementation bytes remained frozen.

### Executable mounted proof method

Reviewer-owned `D:/Yellow/temp/astra580-browser.cjs`, installed Playwright/Chrome, serves the independently built candidate assets by browser interception over the existing loopback read surface. Synthetic hosted-deposit workbench/status/receipt responses are intercepted. Existing reservation/statement GET responses are transformed only in reviewer browser memory for hostility. **All create/application POSTs are fulfilled locally, never forwarded.** All other operational methods are aborted; only automatic session entry and existing GETs reach the app. No public deposit/provider/bearer was created or opened. The synthetic handoff string in the harness is not a credential.

Command for each case: `$env:REVIEW_MODE='<mode>'; node D:/Yellow/temp/astra580-browser.cjs`. Modes listed below completed exit0; their reported failures are observed product behavior, not harness exceptions. Browser logs showed no unexpected operational requests/page errors.

### Blocking findings

1. **P1 — an already-applied uncertain outcome cannot be replayed and strands the operator.** `AdvanceDepositWorkbench.run` re-applies new-command eligibility before retained replay and clears `applyProposal` on balance/remainder drift. Actual `apply-503` case: initial captured5000/remaining5000, folio balance2500; confirmed2500 POST returns503 while following authoritative reads reflect applied2500/remaining2500 and balance0. Clicking retained retry sends no second POST, deletes its own retry button, and leaves parent navigation locked. Output `posts:1, buttonCount:0, parentDisabled:true`. The message claims same-key reconciliation or safe cancellation, but neither control remains (no safe-cancel implementation exists). Separate first-submit fresh consent from unresolved replay/reconciliation; keep exact request/key available when its own successful effect changes eligibility.

2. **P1 — accepted application followed by reconciliation read failure loses uncertainty and unlocks unrelated work.** In `apply-read-fail`, intercepted201 has a valid exact application receipt; the subsequent statement GET returns503. `loadFolioStatement` throws a generic error without an uncertainty tag, and the catch relies on selected message words instead of an accepted-receipt/submission latch. Observed old `Apply confirmed deposit` UI, no retained retry, unchecked consent, `parentDisabled:false`, POST count1. The accepted financial operation is unresolved, yet `attempt.current` is discarded. Every post-boundary/accepted-receipt reconciliation failure must retain the same body/key and lock, irrespective of wording/status of the failed read. The same discipline must cover create status-read validation/network failures.

3. **P1 — false success from an unrelated/mismatched reconciliation response.** Actual `apply-forged`: a valid application receipt was followed by a statement with **another folio ID, USD currency, balance0, and a +1 row carrying the receipt journal ID**. UI nevertheless said `Captured deposit applied and reconciled to the immutable folio statement.` and unlocked parent. Current check only tests numeric balance difference and existence of any matching journal ID. It does not bind statement folio/currency/account or exact journal row amount/sign/count. Status checks likewise use inequalities rather than exact baseline→after conservation and omit request/operation/generation identity. Bind and validate complete canonical evidence before success; do not accept a +1 unrelated-currency row as a SAR2500 application.

   Actual `create-forged` also accepted a status carrying the wrong requestId, generation99 and an expired date inconsistent with the receipt, then displayed `Secure deposit handoff is ready` and the synthetic bearer. `loadHostedDepositStatus` does not bind the returned request ID to its requested ID; create compares only folio/amount/currency/operation. Receipt generation/expiry/bearer/replayed coherence also needs strict validation. Positive receipt-shaped data is not sufficient proof of the exact operation.

4. **P1 — preflight does not bind consent to the exact reservation and masked instrument evidence.** Actual `foreign-preflight`: the fresh reservation GET returned a different reservationId while carrying the expected folio in its list; one create POST was still sent and success shown. The caller never compares the fresh reservation ID to the selected reservation. Actual `metadata-drift`: the same instrument UUID's brand/last4 changed from Reviewer Card/1234 to Different card/9876 after confirmation; one POST was still sent without reconfirmation because only instrumentId membership is checked. Order580 explicitly requires reservation/account/state/instrument drift refusal. Freeze the relevant displayed evidence and compare the exact fresh identity/topology/metadata before the first write, not just presence of IDs.

5. **P1 — read errors hide the narrow recovery action.** Actual `create-503-background`: after503 retained recovery, waited16s and made workbench reconnect reads return503. `workbench.isError` hides the entire branch containing the proposal/retry, even though retained attempt state remains. Output `retryCount:0, parentDisabled:true`; only error text remains. Preserve the recovery surface through refresh failures, distinguish stale data from new-command authority, and keep a usable same-key path. Do not unlock just to escape the error. This repeats the category fixed for primary-folio recovery in Order577, now in the new deposit panel.

6. **P2 — successful application does not refresh the visible authoritative folio.** `apply-success` with coherent status/statement after2500 application reaches success, but the parent cashier still says `Balance SAR25 · Window1` while the freshly fetched statement used for reconciliation is balance0. The component only refetches its own workbench; the parent query cache/statement is not updated or invalidated. It therefore still offers `Prepare deposit application` using stale positive statement balance. Refresh/publish the exact authoritative statement to the parent before claiming the UI is reconciled; do not leave contradictory financial truth visible.

7. **P2 — required confirmation disclosure is incomplete.** Mounted create proposal shows guest/confirmation/window number, amount and brand but no audit reason or exact folio reference, and application proposal shows only amount and before balance. It omits the required after balance and before/after captured-liability application/remainder. No audit-reason control or fixed audit-reason disclosure exists. Keep the canonical API body unchanged unless separately governed; resolve the order's reason requirement explicitly and display the exact consent facts. Message promising a safe cancellation must not be shown without a defined safe control.

### Passing controls and limitations

- `create-success`: initially honest empty list, server-returned masked card, no pasted instrument UUID/input, separate unchecked confirmation; exact canonical create endpoint/body `{instrumentId,amountMinor:"1000"}` and idempotency header. Coherent status permits the one-time handoff warning/link. No browser return is represented as capture. Handoff was not opened.
- `create-replay`: structurally valid replay response without bearer is reconciled through status and explicitly says the one-time bearer is not recoverable; no fabricated link.
- `create-malformed`: malformed201 JSON retains locked recovery, and another click emits identical key/body; two intercepted requests, retry remains visible and parent stay controls disabled. This positive case does not cover the failing already-applied/read-error branches above.
- `drift`: removing the selected instrument entirely on fresh preflight refuses with0 POST. The weaker same-ID metadata check fails as described above.
- `secret`: adding an unexpected synthetic `token` field to an instrument makes the entire workbench incoherent and does not render the marker. `unavailable`:503 is displayed as unavailable, never as empty/zero. Valid masked last4/expiry appear; no real token/provider credential was read or exposed.
- `apply-success`: maximum was bounded by min(captured remaining5000, positive folio balance2500) and required a fresh separate confirmation. Coherent receipt/status/statement path executes; visible-cache defect remains. No actual capture/application occurred.
-375/1440 document width equals scrollWidth. Request/apply buttons44px, instrument label47.14px, amount input minimum44px (enclosing label63px), confirmation49px mobile/44px desktop. Exact SAR10.00/SAR25.00/SAR50.00 text uses minor-unit formatting without float arithmetic. These controlled finite values do not establish every currency/huge-value edge.
- Timed polling control personally observed: ready create workbench GET count3→4 over11s; captured application count remains3→3. `refetchInterval` checks ready/processing only. The full inactive-Yellow/unmount and every terminal-state polling matrix was not completed after blocking financial failures; no blanket polling acceptance is claimed. The manual Finance surface was used for these timings.
- Identity-switch/concurrent manual-operation matrix, every declined/expired/revoked/zero/closed case and every receipt field hostility require executable regression on repaired bytes. No fresh PostgreSQL mutation proof was run because the task expressly uses intercepted mutations and changes no canonical backend. Existing Order578/backend acceptance is not a waiver for unsafe frontend orchestration.

### Personally executed source gates

From `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`:

```text
bun test tests/yellow-advance-deposit-workbench.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-reservation-finance-entry.test.ts tests/yellow-next-property-settings.test.ts tests/yellow-next-performance-dialog.test.ts tests/yellow-cashier-bill-window-allocation.test.ts tests/yellow-voice-bill-window-allocation.test.ts tests/yellow-voice-routing.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx vite build --config frontend/yellow/vite.config.ts
```

**64 pass,0 fail,587 assertions**, eight files. Strict frontend TS exit0. Vite exit0,469 modules; candidate `index-Cc4SICoo.js` / `index-CObuiWcE.css`, used in the actual mounted proof. Authored deposit tests are source-string contracts and passed despite all reproduced failures. Add durable actual-effects tests for the failure sequences, not just additional matching strings.

### Frozen identity

Hashes personally matched at start and end; implementation was not edited:

| File | SHA-256 |
| --- | --- |
| frontend/yellow/src/App.tsx | F90DDA9122D3082102D18F89515D73E7549B4A4E1DBD75BBDA98179B867BF014 |
| frontend/yellow/src/styles.css | CCCE33997A5B089C766D4FFD46222C667FB949C242CA6FA291878742D658273E |
| tests/yellow-advance-deposit-workbench.test.ts | 12AAE2051E044A8E366995C4EC967D83E556DA321BA75FA89766FE097215A131 |
| tests/yellow-next-finance-workspace.test.ts | 275625F4B0B37227F58E30C14C009BE4C75C3BD762583DC19A148E789F705E07 |
| tests/yellow-reservation-finance-entry.test.ts | 2B09B62DDEEABE59315ACF99CC5C8AC40F0A214FD13958CAC786A381922A2E31 |

**Verdict: CHANGES REQUIRED.** No public promotion/payment/provider action accepted. Preserve this R1 record; request a fresh freeze and independent re-execution after repairs. The findings concern client consent, exact financial reconciliation and uncertain-operation retention; they do not assert that canonical server accounting or RLS was bypassed in this review.

## R2 — CHANGES REQUIRED, 2026-09-21

Reviewer: independent Codex Astra `/root/astra_review`, not the implementer. R1 remains intact. Personally inspected the remediation, reran the source gates and mounted the independently built frozen candidate. Applied the same Yellow compliance/entity/PostgreSQL review boundaries. No implementation edit, deployment, provider interaction, database command or operational public write occurred.

### Frozen identity and executed gates

Start/end SHA-256 matched:

| File | SHA-256 |
| --- | --- |
| frontend/yellow/src/App.tsx | D4D6B396CC5DF3380E1DFDDC708D5698619392DAA51D4C69519496E70489833F |
| frontend/yellow/src/styles.css | CCCE33997A5B089C766D4FFD46222C667FB949C242CA6FA291878742D658273E |
| tests/yellow-advance-deposit-workbench.test.ts | 473595AD2D9C6E4D569ACA8EC159DCAD95D4B456CAA54F4892521DD17E452559 |
| tests/yellow-next-finance-workspace.test.ts | 275625F4B0B37227F58E30C14C009BE4C75C3BD762583DC19A148E789F705E07 |
| tests/yellow-reservation-finance-entry.test.ts | 2B09B62DDEEABE59315ACF99CC5C8AC40F0A214FD13958CAC786A381922A2E31 |

Personally reran the exact eight-file Bun command, strict frontend `bunx tsc --project frontend/yellow/tsconfig.json`, and `bunx vite build --config frontend/yellow/vite.config.ts` printed in R1, from the same D serving-source directory. Results: **64 pass, 0 fail, 587 assertions; strict TS exit0; Vite exit0, 469 modules**, `index-eFkHsoIi.js` / `index-CObuiWcE.css`. These green source gates do not cover the mounted failures below.

Reviewer-owned mounted harness: `D:/Yellow/temp/astra580-r2-browser.cjs`. Each command was `$env:REVIEW_MODE='<mode>'; node D:/Yellow/temp/astra580-r2-browser.cjs`. It uses the actual candidate bundle and effects, not a reimplementation of `run`. All financial POSTs were intercepted and fulfilled in browser memory; every other operational method except automatic demo entry was blocked. GETs used the loopback read surface, with controlled synthetic response transformations. No synthetic bearer was opened. Harness logs for the completed matrix show no unexpected operational request or page error.

### Remaining blocking findings

1. **P1 — first application consent does not bind the fresh folio balance.** `apply-balance-drift` displayed and confirmed SAR25.00 → SAR0.00, then supplied fresh preflight balance3000 instead of2500. `run` checks only that amount2500 fits the new balance; it sends the application POST anyway. The coherent real after-balance500 then fails reconciliation against the old proposal's expected0, leaving recovery locked after a write already occurred. First submission must compare the fresh balance to `proposal.balanceBeforeMinor` and refuse/reconfirm on any drift, rather than discovering changed consent after mutation. Retained uncertain replay must remain distinct from this first-submit check. Source location: `AdvanceDepositWorkbench.run` apply preflight near line5789.

2. **P1 — internally impossible application status is still accepted as financial success.** `apply-status-forged` kept request/operation/folio/currency/generation and applied/remainder deltas consistent, but changed status to `declined`, capturedMinor to0, requested amountMinor to1 and expiry to2020-01-01. It nevertheless displayed `Captured deposit applied and reconciled to the immutable folio statement.`, updated the parent balance to0, discarded recovery and unlocked the parent. `validDepositStatus` validates shape, not nonnegative/conserved financial quantities; application reconciliation omits captured/requested amounts, state and relevant immutable status identity from its original snapshot. Validate canonical state/numeric coherence and all immutable financial snapshot fields before success. A valid-shaped but impossible status is not authoritative evidence. Source: `validDepositStatus` near1384 and apply receipt reconciliation near5810.

3. **P1 — create uncertainty can still erase its only recovery action.** `create-503-instrument-drift`: initial createPOST503 retained the attempt; the next fresh workbench omitted the instrument. Clicking the same-key retry then unconditionally cleared `requestProposal` and confirmation in the instrument-eligibility branch. Output: only1 POST, retry buttonCount0, parentDisabled true. No reconciliation or safe escape remains. Instrument drift must refuse a *new* command, but cannot erase a possibly committed retained create. Preserve exact attempt/body/key and an actionable reconciliation surface when eligibility changes after an uncertain submission. Source near5784.

4. **P2 — first-success bearer/receipt coherence remains incomplete.** `create-missing-bearer` and `create-empty-bearer` each supplied `replayed:false`201 with a missing/empty bearer and otherwise coherent ready status. Both were accepted, unlocked and discarded the attempt as though the documented replay-without-bearer case applied. The canonical first-create service returns a bearer; only replay omits it. Require a nonempty bearer for a first non-replayed receipt, or an explicitly governed recovery disposition rather than silently accepting malformed first success. Current parser permits undefined or any string regardless of false replay. This finding does not claim a token leak or a fabricated link: the UI correctly showed no link, but accepted an invalid first-success contract.

### R1 closure and mounted regression results

| Executed mode(s) | Personally observed result |
| --- | --- |
| `apply-503`, `apply-503-recovered` | Already-applied fresh balance0 no longer prevents retained replay. Second POST uses identical key/body. Repeated503 keeps recovery/parent lock; coherent replay201 reconciles and unlocks. |
| `apply-read-fail`, `apply-status-read-fail` | Accepted201 followed by statement503 or status503 retains proposal/retry and parent lock, with no success claim. |
| `apply-forged` | Wrong folio/USD/+1 receipt-journal row now fails exact reconciliation and retains recovery. |
| `create-forged`, `create-generation`, `create-expiry` | Wrong request identity, generation or receipt/status expiry mismatch now refuses success and keeps locked recovery; no handoff link. |
| `foreign-preflight`, `metadata-drift`, `drift` | Wrong fresh reservation, same-ID instrument brand/last4 drift, and missing instrument before first submission all refuse with0 POST and clear consent. |
| `create-503-background` | After503, waited16s then made reconnect workbench GET503. Retry remains mounted (count1), parent stays disabled and an explicit stale-refresh warning appears. This closes R1's hidden-recovery rendering failure. |
| `create-malformed`, `apply-malformed` | Malformed201 JSON keeps recovery. Actual second button click emits identical key/body, and retry/parent lock remain after another malformed response. |
| `apply-success` | Exact valid status/statement refresh updates visible parent balance SAR25 → SAR0 before success. No new application preparation remains at zero balance. Captured-state polling GET count3 →3 over11s. |
| `create-success`, `create-replay` | Coherent first success displays one-time handoff warning/link; replay without bearer resolves through status and displays no fabricated link. Ready-state polling count3 →4 over11s. No link opened. |
| `secret`, `unavailable` | Unexpected instrument token field rejects the workbench without rendering the marker;503 remains explicitly unavailable rather than empty/zero. Both0 POST. |
| `before-write-cancel` | Unchecking confirmation disables submission; editing amount clears the prepared proposal, leaves parent unlocked and produces0 POST. No post-uncertainty cancellation claim/control was used. |

Create/application cards now disclose the exact folio reference and a fixed audit purpose; application shows applied/remainder and folio before→after amounts. This addresses R1's missing disclosure, subject to the stale-balance defect above. At375 and1440 the document scrollWidth equals viewport width. Observed request/application buttons44px, instrument label47.14px, confirmation49px mobile/44px desktop; amount enclosing label63px. No provider/secret is needed for these geometry checks.

### Limits and disposition

The completed matrix reruns all seven R1 failure categories and the additional modes above, but is not a blanket acceptance of every state/currency/identity-switch combination. Inactive-Yellow/unmount polling and same-event synchronous overlapping manual-command races were not exhaustively executed; parent stay controls and retained recovery were observed after actual effects. Source still propagates the busy lock through a React effect, so repaired acceptance must include an actual integrated overlap proof rather than assume synchronous exclusion. Background-read recovery was proved mounted through failure; its subsequent successful read plus retry should be retained as a durable regression. No backend integration mutation was necessary or authorized for this frontend-only intercepted review.

**R2 verdict: CHANGES REQUIRED.** Do not promote these bytes. Preserve this record and provide a new frozen candidate with actual-effects regressions for exact first-submit balance consent, coherent application financial status, create uncertainty under instrument drift, and first-success bearer coherence. No public action/deployment is approved. The findings are frontend consent/reconciliation/recovery defects, not evidence of a server accounting or RLS bypass.

## R3 — CHANGES REQUIRED, 2026-09-21

Reviewer: independent Codex agent `/root/hk_progression_discovery`, not the Order580
implementer. R1 and R2 remain intact. I read the order and both prior reviews, applied
the Yellow payment/compliance fail-closed rules, inspected the frozen source, built it,
and personally exercised the actual React effects in a mounted hostile browser. I did
not edit implementation, call a provider, deploy, open a synthetic bearer, or allow a
financial POST to reach the server. Every hosted-deposit POST was intercepted and
fulfilled in browser memory; unexpected operational methods were blocked.

### Blocking finding

1. **P1 — the shared parent/manual mutation lock is still asynchronous, so an
   in-flight financial command can be abandoned before reconciliation.** R2 explicitly
   required an integrated same-event overlap proof because `AdvanceDepositWorkbench`
   propagates `busy || locked` to its parent only from a React effect. The reviewer-owned
   `sync-parent` mode synchronously invoked the confirmed create action and the parent
   reservation selector while holding the POST response for 600 ms. One exact create
   POST crossed the boundary, then the parent selection unmounted the entire deposit
   panel (`panelCount:0`) before the accepted receipt/status could display or reconcile.
   In a real first-create success this can discard the one-time bearer and removes the
   only local attempt/recovery state while unrelated work becomes reachable. The
   companion `sync-overlap` mode invoked the action twice plus the parent selector in
   one task and observed two POSTs with the same body/key before the panel unmounted.
   Server idempotency protects against two creations, but it does not satisfy the
   order's shared mutation-lock requirement or preserve the client reconciliation and
   one-time handoff lifecycle. Source evidence is the effect-only propagation at
   `AdvanceDepositWorkbench` lines 5754–5758 and parent checks at lines 5965–5983.
   Acquire a parent-visible lock synchronously before the first await (including a
   synchronous shared ref/lease consulted by parent handlers), retain it through
   reconciliation/uncertainty, and add a mounted regression that fires the confirmed
   action and unrelated parent action in the same task and proves the panel/attempt
   cannot be abandoned. The test must also prove rapid duplicate activation cannot
   establish two concurrent client runs, even though the retained key remains stable.

### R2 closure and retained R1 controls

- `apply-balance-drift` changed the fresh balance from 2500 to 3000 and produced
  **zero POSTs**, cleared consent, and left the parent unlocked.
- `apply-status-forged` supplied the formerly accepted impossible declined/zero-capture/
  amount-1/old-expiry status. It was rejected, retained the recovery UI and parent lock,
  and a real retry emitted the identical key/body.
- `create-503-instrument-drift` retained its proposal, retry and parent lock when the
  instrument disappeared after an uncertain POST; retry performed no unsafe new POST.
- `create-missing-bearer` and `create-empty-bearer` treated non-replayed 201 receipts as
  uncertain, retained the lock, and retried with identical key/body.
- `apply-503`/`apply-503-recovered`, accepted-receipt statement/status read failures,
  `apply-forged`, `create-forged`, generation/expiry mismatch, foreign reservation,
  same-ID brand/last4 drift, full kind/brand/last4/expiry/PSP drift, missing instrument,
  malformed 201s, background cached-read failure, replay-without-bearer, secret-field
  rejection, unavailable reads, and pre-write cancellation all retained their R2-safe
  outcomes. Coherent application refreshed the visible parent balance SAR25 to SAR0.
- Disclosures showed folio reference, audit purpose, exact liability/remainder and
  folio before/after amounts. Unchecking confirmation and editing the draft produced
  zero POSTs and removed the proposal without claiming cancellation after submission.
- At 375 and 1440 px, document width equalled viewport width; action controls were at
  least 44 px and exact SAR money remained readable. Ready and processing states
  refetched once over 11 seconds; captured, declined, expired and revoked did not.
  Navigating away unmounted the panel and produced no further workbench read over
  11 seconds. Browser logs contained no page errors or unexpected operational writes.

Reviewer harness: `D:/Yellow/temp/codex580-r3-browser.cjs`. Representative commands:

```text
$env:REVIEW_MODE='<mode>'; node D:/Yellow/temp/codex580-r3-browser.cjs

bun test tests/yellow-advance-deposit-workbench.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-reservation-finance-entry.test.ts tests/yellow-next-property-settings.test.ts tests/yellow-next-performance-dialog.test.ts tests/yellow-cashier-bill-window-allocation.test.ts tests/yellow-voice-bill-window-allocation.test.ts tests/yellow-voice-routing.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx vite build --config frontend/yellow/vite.config.ts
```

Source gates: **64 pass, 0 fail, 587 assertions** across the mandated eight files;
strict frontend TypeScript exit 0; production build exit 0 with 469 modules and
reviewed assets `index-COMQseMs.js` / `index-CObuiWcE.css`.

Start and end hashes matched:

| File | SHA-256 |
| --- | --- |
| `frontend/yellow/src/App.tsx` | `51219F99E0819DBA539BCA220D918C7A5868C09CF2E5CDB3030712B9609858A6` |
| `frontend/yellow/src/styles.css` | `CCCE33997A5B089C766D4FFD46222C667FB949C242CA6FA291878742D658273E` |
| `tests/yellow-advance-deposit-workbench.test.ts` | `473595AD2D9C6E4D569ACA8EC159DCAD95D4B456CAA54F4892521DD17E452559` |
| `tests/yellow-next-finance-workspace.test.ts` | `275625F4B0B37227F58E30C14C009BE4C75C3BD762583DC19A148E789F705E07` |
| `tests/yellow-reservation-finance-entry.test.ts` | `2B09B62DDEEABE59315ACF99CC5C8AC40F0A214FD13958CAC786A381922A2E31` |

**R3 verdict: CHANGES REQUIRED.** The four R2 blockers are closed, but the explicit
shared parent/manual lock is not yet safe at the synchronous command boundary. Do not
promote these bytes. Because the review is not accepted, the order and ledger are not
closed or marked accepted by this reviewer.

## R4 — ACCEPT, 2026-09-22

Reviewer: independent Codex Astra `/root/astra_review`, not the implementer. This
section preserves all R1–R3 failures. Review began on September21 and the interrupted
final gates were personally resumed on September22 against unchanged frozen bytes.
PROJECT/Order580 and the Yellow compliance/entity/PostgreSQL rules were applied.
This review file is expressly in scope. No implementation file was edited, no
deployment occurred, and no public financial, database or provider mutation was made.

### Frozen source and personally built artifacts

Start/resumption/end hashes matched:

| File | SHA-256 |
| --- | --- |
| `frontend/yellow/src/App.tsx` | `7E771F88D8CFE69C2378898B44DB550B1B4D785550390AA08B2ABA1E8A08EE77` |
| `frontend/yellow/src/styles.css` | `CCCE33997A5B089C766D4FFD46222C667FB949C242CA6FA291878742D658273E` |
| `tests/yellow-advance-deposit-workbench.test.ts` | `6A4551A38DBAF8941D773EAE542F1F7C7C424C5B2A27F6298EE45C1406CBE94D` |
| `tests/yellow-next-finance-workspace.test.ts` | `6A2B04B8A8E537C97DFF4C30CC02861F5328461776E4993FC1022586008C81D1` |
| `tests/yellow-reservation-finance-entry.test.ts` | `2B09B62DDEEABE59315ACF99CC5C8AC40F0A214FD13958CAC786A381922A2E31` |
| Built `index-DA4PEzGO.js` | `5E9DB16CCE703BBA1DCC798DF65DB1C78D62F1F09C45E2956BA393D4A3631EC6` |
| Built `index-CObuiWcE.css` | `C2D278C19F4B37E724C45F7BD452BEFD690BD1D25E6744D47CE096B562755370` |

### Executed commands and source gates

Working directory: the designated D serving-source checkout.

```powershell
$env:YELLOW_ORDER580_MOUNTED_HARNESS='D:/Yellow/temp/astra580-r4-browser.cjs'
bun test tests/yellow-advance-deposit-workbench.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-reservation-finance-entry.test.ts tests/yellow-next-property-settings.test.ts tests/yellow-next-performance-dialog.test.ts tests/yellow-cashier-bill-window-allocation.test.ts tests/yellow-voice-bill-window-allocation.test.ts tests/yellow-voice-routing.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx vite build --config frontend/yellow/vite.config.ts
bun run typecheck
```

- Final focused/adjacent result: **65 pass, 1 skip, 0 fail, 602 assertions**, eight
  files. The skipped optional direct-Playwright test requires separate environment
  flags; the reviewer-owned mounted test actually ran both synchronous overlap cases.
- Strict frontend TypeScript: exit0, no diagnostics. Vite: exit0, **469 modules**,
  exact artifacts above.
- Root `bun run typecheck`: exit1, the already-recorded two **TS6142** diagnostics in
  `yellow-cashier-bill-window-allocation.test.ts:11` and
  `yellow-voice-bill-window-allocation.test.ts:14`: their App.tsx imports meet a root
  tsconfig without JSX. This inherited adjacent configuration debt is not a new
  deposit implementation failure; root-wide TypeScript is **not** claimed green.

### Actual mounted proof and R3 closure

The reviewer personally executed the retained R3 browser harness and reviewer-owned
R4 matrix, serving the newly built candidate assets through browser interception on
the existing loopback3010 read surface. Hosted-deposit GET fixtures and every create/
application POST were fulfilled in browser memory. All other operational methods
were aborted; only existing read requests and automatic demo-session entry could
reach the app. Synthetic one-time handoffs were never opened. No token was captured.

```powershell
# Original retained reproduction, personally rerun before the resumed final gates:
$env:REVIEW_MODE='sync-parent'; node D:/Yellow/temp/codex580-r3-browser.cjs
$env:REVIEW_MODE='sync-overlap'; node D:/Yellow/temp/codex580-r3-browser.cjs

# Retained reviewer assertion runner; each mode also retains a sanitized JSONL trace.
node D:/Yellow/temp/astra580-r4-matrix.cjs sync-parent sync-overlap apply-503-recovered apply-forged apply-status-forged apply-balance-drift create-503-instrument-drift create-missing-bearer create-empty-bearer create-forged create-generation create-expiry foreign-preflight metadata-drift metadata-full-drift drift secret unavailable before-write-cancel create-malformed apply-malformed apply-503 apply-read-fail apply-status-read-fail create-replay create-success apply-success create-503-background poll-ready poll-processing poll-captured poll-declined poll-expired poll-revoked poll-inactive

# Remainder/retry after an isolated initial-navigation timeout:
node D:/Yellow/temp/astra580-r4-matrix.cjs apply-503 create-replay create-success apply-success create-503-background poll-ready poll-processing poll-captured poll-declined poll-expired poll-revoked poll-inactive

# Final resumed same-task proof and corrected terminal polling fixture:
node D:/Yellow/temp/astra580-r4-matrix.cjs sync-parent sync-overlap poll-captured poll-expired poll-revoked poll-inactive

# Independently extended double-activation case for application, not only create:
$env:REVIEW_MODE='apply-sync-overlap'
node -r D:/Yellow/temp/astra580-r4-log.cjs D:/Yellow/temp/astra580-r4-apply-sync.cjs
```

Harness files are `D:/Yellow/temp/astra580-r4-browser.cjs`,
`astra580-r4-matrix.cjs`, `astra580-r4-log.cjs`, and
`astra580-r4-apply-sync.cjs`; per-mode evidence is
`D:/Yellow/temp/astra580-r4-<mode>.jsonl`.

- **R3 P1 closed:** `sync-parent` and `sync-overlap` fire confirmed create, optionally
  a second activation, then unrelated parent selection in the same JavaScript task.
  Each produced exactly **one intercepted POST**, retained the original panel
  (`panelCount=1`) and reservation context, and reconciled the first one-time handoff.
  The apply double-activation variant likewise produced one application POST,
  retained its panel, reconciled status/statement, and released the parent lock only
  after success. No page errors or unexpected operational requests occurred.
- Source corroboration: `AdvanceDepositWorkbench.run` checks `running.current`,
  acquires the parent's synchronous lease before its first await, and retains the
  lease through uncertain outcomes. The parent sets its ref plus the outer synchronous
  lifecycle ref immediately. Parent selection/manual handlers consult the ref; outer
  capture guards consult the lifecycle ref. Recovery is narrowly admitted by the
  recovery region. Before-write refusal releases the lease; successful canonical
  reconciliation releases it; uncertain results do not.
- 503/malformed201, missing/empty first-success bearer, impossible application
  status and valid-shaped mismatched receipt/status/statement remained uncertain.
  Actual retry sent the identical key/body and retained parent lock. A coherent
  replay after503 and already-applied balance0 reconciled and released it.
- Accepted application followed by statement/status read failure retained the
  proposal/recovery/parent lock. Wrong folio/USD/positive journal row and wrong
  request/generation/expiry could not produce success. A coherent application
  updated the parent SAR25 balance to SAR0 and removed application eligibility.
- Foreign reservation, changed full instrument metadata or eligibility, and
  first-submit balance2500→3000 caused **zero POSTs**, discarded stale consent and
  unlocked the parent. An instrument disappearing after an uncertain write instead
  retained its exact proposal/key/retry/lock and refused an unsafe new POST.
- Cached workbench failure after503 kept the retry mounted and showed the stale
  warning. Empty/unavailable and secret-key payload cases were explicit, not zero
  or fabricated data. Replay without bearer showed honest nonrecoverability.
- Before-write uncheck disabled the action; editing the amount cleared the proposal,
  emitted zero POSTs and left the parent unlocked. There is no unsafe post-uncertainty
  cancellation path. Exact folio reference, audit purpose, amount, liability/remainder
  and folio before/after disclosures were visible.
- At375 and1440, document scrollWidth matched viewport width. Action buttons were
  at least44px; instrument label47.14px and confirmation49px/44px. Ready/processing
  refetched once over11 seconds; captured/declined/expired/revoked did not. Navigating
  away unmounted the panel and produced no later workbench read over11 seconds.

### Retained execution limitations and verdict

The initial parallel matrix had one panel-load timeout (`apply-503`); the same case
was rerun successfully with identical-key recovery. A terminal polling fixture
incorrectly combined `captured` with zero captured funds and was correctly rejected
by the candidate. Only the temporary reviewer fixture was corrected to coherent
captured1000/remaining1000; the final terminal/no-poll assertion passed. These failed
attempts are disclosed, not represented as product passes. Polling evidence concerns
the mounted route and actual unmount, not suspension/crash recovery across a browser
restart. Recovery state remains an in-memory active-screen guarantee.

**R4 verdict: ACCEPT for the bounded Order580 frozen source.** R1/R2/R3 blocking
findings are closed by personally executed actual-effects evidence, not source tests
alone. No remaining reproduced blocker was found in this slice. This does not claim
live provider readiness, a public financial posting, backend ledger proof, public
deployment acceptance, or whole-repository green status. The current assignment is
review-only; no order, ledger, deployment or public configuration was changed.
