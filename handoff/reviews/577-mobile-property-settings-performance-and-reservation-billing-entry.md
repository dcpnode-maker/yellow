# Order 577 — independent review

## R1 — REJECT / CHANGES REQUIRED (2026-09-21)

Reviewer: independent Codex Astra agent `/root/astra_review`, not the implementer. Reviewed the order and frozen serving-source files under the PROJECT.md/Yellow skill constraints. No implementation edits, deployment or operational database writes. Mounted tests served candidate compiled assets through browser interception over the existing loopback app's read endpoints. Every primary-folio POST was fulfilled locally by the reviewer harness; every other operational non-read request was aborted. Only automatic session entry reached the app. These are controlled UI-effect proofs, not real public folio creation.

### Findings

1. **P1 — named consent carries over to another cached reservation.** `PrimaryBillingWindowAction` keeps `confirmed` in component state, has no reservation-identity reset, and is rendered at App.tsx:6214 without a reservation key. Actual mounted reproduction: visit Meera's no-folio record to cache it; return to Omar; check the confirmation naming Omar; switch to cached Meera. The label now names Meera, but the checkbox remains checked and `Open confirmed primary window` remains enabled. Zero POST was needed to demonstrate the defect. Bind/reset consent and draft state to the exact reservation identity; keep uncertain attempts separately protected. Add an executable cached-A→B regression, not just a source-string assertion.

2. **P1 — a later denial forgets an earlier uncertain command and permits a new key.** In `PrimaryBillingWindowAction.submit`, `uncertain` is based only on the current invocation's boundary/error. The catch's non-uncertain branch clears `attempt.current`, recovery state and parent lock even if the earlier attempt was unresolved. Actual mounted proof: first intercepted POST503, canonical detail still no folio; first retry uses identical key/body but returns403. Recovery warning disappears, confirmation resets, and a third confirmation emits a **different key** for the same reservation/body. Exit Yellow then succeeds. The first503's outcome was never reconciled. Before the second attempt, Exit Yellow correctly remained blocked, so this is a demonstrated loss of an initially working lock. Latch uncertainty across retries/preflight failures until authoritative reconciliation resolves the retained attempt; preserve exact key/body and parent/manual navigation lock.

3. **P2 — the required expanded-row billing entry is unreachable.** The new `Open cashier & billing` action is in `ReservationBoardRow`, which has no call site. The actual `ReservationBoardWorkspace` renders `MovementGrid`; its row click opens the full reservation sheet. Mounted `/reservations` showed22 rendered rows, zero `.reservation-board-item` components, zero `Expand record` buttons and zero `Open cashier & billing` buttons. The new source-string test passes on dead JSX. Connect the required entry to the actual rendered board/expanded context, with exact reservation navigation, or obtain an explicit order disposition rather than claiming it is delivered.

4. **P2 — mobile named confirmation target is below44px.** On the actual mounted375px candidate, the clickable primary-window confirmation label measured207×31.875px. Submit measured207×68px; document width/scrollWidth375/375. The checkbox/label target needs the44px minimum, not only the button. At desktop the wrapped label happened to be47.8125px; this does not fix mobile.

Additional copy note: the primary-window action's state caption is hard-coded `PRE-ARRIVAL BILLING` even though the component also permits in_house/due_out. Its paragraph and surrounding Finance context are conditional; make the caption consistent too.

### Personally executed tests/build

In the D: serving source:

```text
bun test tests/yellow-next-property-settings.test.ts tests/yellow-next-performance-dialog.test.ts tests/yellow-reservation-finance-entry.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-voice-bill-window-allocation.test.ts tests/yellow-cashier-bill-window-allocation.test.ts tests/yellow-voice-routing.test.ts
```

Result: **61 pass, 0 fail, 536 assertions**, seven files. `bunx tsc --project frontend/yellow/tsconfig.json`: exit0, also rerun independently at the end. `bunx vite build --config frontend/yellow/vite.config.ts`: exit0,469 modules; candidate assets `index-DOsjF_7z.js` / `index-CQnHrDS9.css`. The focused source tests do not cover the mounted failures above.

### Personally executed mounted checks

Reviewer-owned harness: `D:/Yellow/temp/astra577-browser.cjs`, installed Playwright/Chrome, viewport375×812 initially and1440×900. Commands: `node D:/Yellow/temp/astra577-browser.cjs` for uncertain mode; PowerShell `$env:REVIEW_MODE='<mode>'; node D:/Yellow/temp/astra577-browser.cjs` for `settings`, `settings-error`, `performance`, `drift`, `foreign`, `success`, `identity`, `detail`, `board`.

- **Settings pass:** real existing API summaries returned property identity/timezone/currency,3 room types/20 spaces/20 sellable units,1 BAR plan,0 restrictions and0 OOO/OOS blocks. Missing configuration APIs are explicitly disclosed. Four governed-workflow buttons measured44px high at375 and1440; document width matched viewport at both. Inspection confirms links use existing inventory/rates/restrictions/housekeeping paths rather than raw configuration writes. Injected inventory-policy503 rendered `Property setup summaries are unavailable for this operator.` The first unavailable-state harness attempt timed out waiting for networkidle; switching the harness to DOM readiness plus the actual error locator passed. No product claim was based on that harness timeout.
- **Performance pass:** all six headers are scope=col, Period cells scope=rowgroup and Measure scope=row. At375, wrapper clientWidth321/scrollWidth760; document375/375. Header and first-row x positions exactly matched at27,123.25,281.65625,407.984375,534.3125,660.640625; subsequent Measure/Actual cells retain their corresponding columns. At1440, wrapper1048/1048 and document1440/1440; all six header/body positions also matched. Thus narrow-screen scrolling is internal, not a missing-column or document-overflow workaround.
- **Exact full-detail entry pass:** the actual in-house reservation's full-sheet button navigated to Finance with exact reservation `fbe1dc20-456e-5345-8d7d-420b41685955`; the selected record showed `In-house billing context` and the server-authority disclaimer. Zero operational POST. The expanded-row counterpart failed as described above.
- **Preparation/denial pass:** controlled no-folio reserved record displays named, initially unchecked confirmation with disabled submit. Cancelled status at fresh preflight produced0 POST and a live-state-change refusal. Wrong reservation ID from fresh detail also produced0 POST and identity refusal. This is actual component execution, not only helper reasoning.
- **Authoritative-success pass:** one intercepted canonical primary-folio POST with body`{}`/Bearer/idempotency header followed by exact reservation reread containing open windowNo1 switched to that folio and rendered the existing statement/workbench. No success was inferred merely from the HTTP201. The synthetic response reused the existing read-only statement for UI rendering; it did not create a database folio.
- **Uncertainty and identity failures:** executed as findings1/2; two initial attempts had identical key and empty body, third attempt used a new key, and parent navigation became available. No intercepted command was forwarded. Browser logs for the completed runs had no page errors or unexpected operational request.

The initial uncertainty harness attempted a nav control covered by Yellow's active result canvas and timed out; that was a harness targeting issue. The final run used the visible Exit Yellow control, waited for its exit animation, and positively observed locked-before/available-after behavior. It also directly captured the third changed key.

### Source binding and remaining gates

All five requested hashes matched before and after proof:

| File | SHA-256 |
| --- | --- |
| frontend/yellow/src/App.tsx | 0A4CC6797E4B3DEDF46F8E9A2ACB78126018A683E46F09D0D3D47D8C877F7F09 |
| frontend/yellow/src/styles.css | 545572F3735C102E0772BAFC611C71D7078B2754E61EB15DAE170DD07910FDA5 |
| tests/yellow-next-property-settings.test.ts | 7D1BB9E73DD83900A74EABD8144FCAC229C765526CA0D7FF0B29107837A19169 |
| tests/yellow-next-performance-dialog.test.ts | 301CB8E7DB23D5BDBD3A9D7B28E4F37130E31464BFF14DA91CFEF784C8C1C846 |
| tests/yellow-reservation-finance-entry.test.ts | 280BD3CE1C78C042EDB22E6C67582EA0807B5F7A6CC74CD9961821DD2007477E |

The canonical mutation path remains POST `/api/v1/properties/:property/reservations/:reservation/primary-folio`, empty body, Bearer and stable key within an unresolved first retry. There is no new deposit, payment, settlement, fiscal or database API in this order. However the new caller's consent/recovery guarantees are not sound yet. No new isolated PostgreSQL mutation/API proof was attempted after the blocking UI findings; no public/database mutation was authorized by this review. Re-review must use a new freeze, mounted cached-identity/retry/manual-lock regressions, the actual board entry and mobile target geometry, then complete any remaining canonical integration gate before promotion. Preserve this R1 failure history.

## R2 — REJECT / CHANGES REQUIRED (2026-09-21)

Reviewer: independent Codex Astra `/root/astra_review`, not the implementer. R1 remains intact. Personally re-inspected the corrected source and ran the current compiled candidate in installed Chrome using reviewer-owned `D:/Yellow/temp/astra577-r2-browser.cjs`. Candidate assets were locally fulfilled over the loopback app's existing read routes; primary-folio POSTs were intercepted and fulfilled by the harness, all other operational writes aborted, and only automatic session entry reached the app. No public/database mutation, deployment, implementation edit or new PostgreSQL mutation proof occurred.

### Remaining blocker

**P1 — a background detail-query failure destroys unresolved operation recovery.** At App.tsx:6223, `detail.isError` replaces the entire reservation panel even when cached `detail.data` exists. The retained operation lives solely inside `PrimaryBillingWindowAction` (including its ref/key/recovery state), so this unmount loses it. Personally executed actual mounted sequence:

1. Prepare an exact reserved/no-folio reservation; check named confirmation; intercepted primary-folio POST returns503. The existing retry UI and parent lock appear correctly.
2. Allow the normal15s detail query stale time to elapse. Set only reservation GETs to503 and dispatch normal offline/online events. React Query's reconnect refetch retries and then marks the detail query erroneous.
3. Observed `reads:5`, primary action count0, retained retry count0; the panel contains only `Reservation details are unavailable.`
4. Restore reservation GET success and dispatch offline/online. Observed primary action count1, retained retry count0, checkbox false, POST count still1. The component has remounted with a fresh ref rather than the unresolved original operation. The parent lifecycle lock has not been authoritatively resolved; ordinary controls cannot safely replace the missing recovery action.

Command: `$env:REVIEW_MODE='reconnect'; node D:/Yellow/temp/astra577-r2-browser.cjs` — exit0 with those observations. The initial mutation was never forwarded to the server. Preserve the mounted recovery owner and its exact attempt through background errors (or lift its ownership above all transient query branches); show an honest refresh warning without destroying the narrow same-key recovery. Add this actual-effect regression. Do not simply unlock navigation on the read error: the earlier503 is still unresolved.

### R1 corrections independently verified

- **Cached identity:** Meera cached → Omar consent checked → cached Meera now yields checkbox false and disabled submit,0 POST. The exact reservation key and reset close R1 consent carryover.
- **Uncertainty latch:** intercepted503→403→third retry emitted3 requests with identical canonical path, key and body`{}`. Recovery remained visible after the403; native Exit Yellow remained blocked before and after the retries. This fixes the specific R1 later-denial loss, but not the new background-query unmount above.
- **Actual board:** searched the rendered `MovementGrid` for exact confirmation, clicked its real `Open cashier and billing for L3R-DI-0015` button, and reached Finance with exact reservation UUID.0 POST and no page errors. Button83×44 at375 and1440; document scrollWidth equalled viewport. This is executable reachable JSX proof, not the old dead-component string oracle.
- **Full detail:** actual `Open cashier · in-house billing` action navigated to the same exact Finance reservation and rendered the server-authority disclaimer;0 POST.
- **Touch/copy:** confirmation label237×44 at375 and215.75×44 at1440; submit68px high. No document overflow. Controlled reserved context shows PRE-ARRIVAL; controlled in_house/no-folio context shows IN-HOUSE. Cancelled initial context has no action;0 POST.
- **Fresh denial:** cancelled preflight and foreign reservation identity each refused with0 POST. No optimistic success.
- **Authoritative success:** one intercepted201 followed by exact reservation reread with open primary windowNo1 entered the existing statement/workbench. Canonical HTTP response alone was insufficient. No folio was created in any database.

### Settings and performance rerun

Settings used actual existing API GETs: canonical property/timezone/SAR identity,3 room types/20 rooms/20 sellable units,1 BAR plan,0 restrictions/OOO/OOS, explicit missing-API disclosure. Four linked governed-workflow controls44px at375 and1440; document375/375 and1440/1440. Injected inventory-policy503 showed the honest unavailable message. The first parallel Settings probe captured its loading state too early; the completed rerun awaited actual buttons and established these results. A parallel success-mode run also timed out awaiting its panel; the independent sequential rerun completed correctly. Neither harness readiness issue was counted as product success/failure.

Performance retained six scope=col headers, Period scope=rowgroup and Measure scope=row. At375 its321px wrapper scrolls the760px table internally; header/body x positions match exactly (27,123.25,281.65625,407.984375,534.3125,660.640625), and subsequent measure/value rows align. At1440 the1048px table fits its wrapper, all header/body columns align, and document width remains1440.

Mounted mode commands were `$env:REVIEW_MODE='<mode>'; node D:/Yellow/temp/astra577-r2-browser.cjs`, for `identity`, `uncertain`, `board`, `detail`, `settings`, `settings-error`, `performance`, `inhouse`, `ineligible`, `drift`, `foreign`, `success`, and `reconnect`. Completed runs had no unexpected operational requests/page errors; intercepted writes are UI simulations, not durable API/DB proof.

### Personally executed gates and scope correction

Initial expanded9-file run:67 pass/1 fail/619 assertions. The failure was the adjacent actionable-readiness literal `Open cashier & billing` oracle, not a reproduced product defect. The coordinator explicitly added that file to Order577 scope and supplied a new test freeze, retaining product bytes unchanged. Personally reran the exact final command:

```text
bun test tests/yellow-next-property-settings.test.ts tests/yellow-next-performance-dialog.test.ts tests/yellow-reservation-finance-entry.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-reservation-command-surface.test.ts tests/yellow-cashier-bill-window-allocation.test.ts tests/yellow-voice-bill-window-allocation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-today-workspace.test.ts tests/yellow-next-mobile-navigation.test.ts tests/yellow-reservation-actionable-readiness.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx vite build --config frontend/yellow/vite.config.ts
```

Final: **80 pass,0 fail,659 assertions** across11 files; strict frontend TypeScript exit0; Vite exit0,469 modules, assets `index-B7lYAnkJ.js` and `index-CpNcxK9z.css`. These source tests do not catch the mounted reconnect failure.

### Frozen source binding

All hashes personally matched and were recomputed after proof:

| File | SHA-256 |
| --- | --- |
| frontend/yellow/src/App.tsx | 2B114D2145E81E4744165336FCB0019915D1DB8B59C47617C954AA7E627A81EF |
| frontend/yellow/src/styles.css | 500FC20ED8F723668E845F53A4DBB35B465C38E538C314BBB5876394F6E53B8B |
| tests/yellow-next-property-settings.test.ts | 7D1BB9E73DD83900A74EABD8144FCAC229C765526CA0D7FF0B29107837A19169 |
| tests/yellow-next-performance-dialog.test.ts | 301CB8E7DB23D5BDBD3A9D7B28E4F37130E31464BFF14DA91CFEF784C8C1C846 |
| tests/yellow-reservation-finance-entry.test.ts | B0FE0142D87B7CF6C4920B00780894917D095598C2EB81C4399691D5DF855E7A |
| tests/yellow-reservation-actionable-readiness.test.ts | 2A033A09813FA2617D0CCC697128D33F2842E31B44F68F06A644C49511324187 |

**Verdict: CHANGES REQUIRED.** All original R1 cases are corrected, but unresolved financial-operation recovery must survive normal background read failure/reconnect. No public promotion or operational action is approved by this review. No new deposit, settlement, fiscal, posting or database authority is introduced; no whole-PMS readiness claim is made.

## R3 — ACCEPT, bounded source/UI review (2026-09-21)

Reviewer: independent Codex Astra `/root/astra_review`; did not implement the change. R1/R2 failures remain above. Personally inspected the frozen repair and reran the actual mounted effects rather than relying on implementer outputs. No implementation edits, deployment, operational public request or database mutation.

### Reconnect blocker closed by executable proof

Reviewer harness `D:/Yellow/temp/astra577-r3-browser.cjs` serves the current compiled candidate through local browser route fulfillment, intercepts every primary-folio mutation, aborts other operational writes, and permits only automatic session entry plus existing GETs to reach the loopback app. Command:

```text
$env:REVIEW_MODE='reconnect'; node D:/Yellow/temp/astra577-r3-browser.cjs
```

Result exit0. After intercepted primary-folio503, waited16s for query staleness, returned503 for background reservation reads and dispatched offline/online. At the same failing R2 point, observed `reads:5, actions:1, retry:1`, not0/0. The stale-refresh warning was present. Native Exit Yellow remained blocked. After restoring GET success and reconnecting, observed `actions:1, retry:1, checked:true, posts:1`. Clicking retained retry sent a second intercepted request with **exactly the original key/body**, received403, and still retained recovery. Assertions proved `sameKey:true, sameBody:true, recoveryRetained:true`, no unexpected requests/page errors, no optimistic success.

Source now keeps a last-confirmed detail bound to the selected reservation, renders that same keyed recovery component through transient refresh failure, supplies an honest warning, and disables ordinary no-folio action when its read is unavailable. This retains recovery without treating stale data as new-command authority: every submit still makes the canonical fresh reservation preflight and verifies identity/status/topology. Cached data from another reservation is excluded from the fallback.

### R1 and adjacent mounted regressions rerun

Same harness with `$env:REVIEW_MODE='<mode>'` for `identity`, `uncertain`, `board`, `detail`, `settings`, `settings-error`, `performance`, `drift`, `foreign`, `success`, `inhouse`, `ineligible`; all completed exit0.

- Cached Meera → Omar named consent → cached Meera: checkbox false, submit disabled,0 POST.
-503→403→third request: all3 intercepted requests retain identical key/body; recovery remains and Exit is blocked. No authority inferred from denial.
- Actual MovementGrid Cashier button83×44 at375 and1440 navigates to the exact selected reservation's Finance URL;0 POST. Full-detail in-house action independently reaches the same exact context.
- Named confirmation44px and submit68px at both viewports; document scrollWidth equals375/1440. In-house and pre-arrival captions agree with supplied canonical status. Initially cancelled context exposes no primary-window action.
- Fresh cancelled status or foreign reservation identity refuses with0 POST. Initially unchecked confirmation disables submit. The successful intercepted201 case enters the existing folio only after an exact reread proves its open primary windowNo1, not from the response alone.
- Settings real API summaries and honest unavailable503 state both pass. Four governed-workflow controls remain44px; no horizontal document overflow at375/1440; absent settings APIs remain explicitly disclosed.
- Performance retains the six semantic columns with exact header/body alignment at375/1440. The phone wrapper is321px with760px internal scroll; desktop wrapper/table1048px. Scope=col/rowgroup/row remains correct.

The endpoint remains the existing POST `/api/v1/properties/:property/reservations/:reservation/primary-folio`, Bearer-authenticated, empty body and stable actor-bound idempotency. No deposit, financial posting, settlement, fiscal, account or schema semantics were added. Browser interception establishes client effects only; it is not evidence of a real new folio, numbering increment or persisted DB replay. No new PG mutation/referee run was performed for this frontend-only order, and none is claimed. Existing canonical backend authority is reused unchanged.

### Personally executed gates

In the frozen D: serving source:

```text
bun test tests/yellow-next-property-settings.test.ts tests/yellow-next-performance-dialog.test.ts tests/yellow-reservation-finance-entry.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-reservation-command-surface.test.ts tests/yellow-cashier-bill-window-allocation.test.ts tests/yellow-voice-bill-window-allocation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-today-workspace.test.ts tests/yellow-next-mobile-navigation.test.ts tests/yellow-reservation-actionable-readiness.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx vite build --config frontend/yellow/vite.config.ts
```

**80 pass,0 fail,664 assertions**,11 files. Strict frontend TypeScript exit0. Vite exit0,469 modules; exact assets `index-BPW7uegm.js` / `index-CIPsAHTT.css`, used by the mounted proof. This closes the bounded Order577 review, not any unrelated repository-wide gate.

### Final frozen hashes

Personally matched before proof and recomputed afterward:

| File | SHA-256 |
| --- | --- |
| frontend/yellow/src/App.tsx | B759369CF9BFCAFF52C085262FE9224C9A03A55BFC517922B64908C0FFAB217A |
| frontend/yellow/src/styles.css | 847AD24EE339CA38B84F9E8F329D5F43A8F35394205DA87CF510C7ADCDE1C4F1 |
| tests/yellow-next-property-settings.test.ts | 7D1BB9E73DD83900A74EABD8144FCAC229C765526CA0D7FF0B29107837A19169 |
| tests/yellow-next-performance-dialog.test.ts | 301CB8E7DB23D5BDBD3A9D7B28E4F37130E31464BFF14DA91CFEF784C8C1C846 |
| tests/yellow-reservation-finance-entry.test.ts | F14D2F722FDA04B6C7B43506178E2F0A3324A7EF091248D5C5008752E6F42EBE |
| tests/yellow-reservation-actionable-readiness.test.ts | 2A033A09813FA2617D0CCC697128D33F2842E31B44F68F06A644C49511324187 |

**Verdict: ACCEPT for the exact Order577 candidate and bounded source/mounted-UI guarantees.** No remaining reproduced blocking finding. Public promotion and any real primary-folio operation remain separately governed; this review neither executes nor authorizes an unconfirmed public operation. No whole-PMS, deposit or payment readiness claim.
