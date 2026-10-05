# Order575 independent review

## R1 — CHANGES REQUIRED — 2026-09-21

Reviewer `/root/astra_review`, independent non-implementer. Read Order575, prior accepted transfer review and D-492/canonical contracts; applies PROJECT invariants and Yellow entity/PostgreSQL/compliance boundaries. No implementation edit, public deployment or public financial mutation. Frozen bytes preserved.

### Personally verified hashes, before and after proof

- App.tsx `841089AD84D5A054BCFCED6509E13B8BB726C55587EF0398E52FB9A9FB59BB83`.
- voice.ts `EF48FB33090BC97C83A165C69F0288080AC6BC4A8D7DC9929F83FC0929471A24`.
- styles.css `436C2B4FD537A48EBB001AD7FECF405021D4E3EF3D919117282EA72D2A0AC5EB`.
- yellow-voice-bill-window-allocation.test.ts `437ADF2C65BBE5C2F2E57CC9AC11D1EE6CE37829D3C6F16F2C58340A9A83CF0E`.
- yellow-voice-routing.test.ts `1A33610A2C4C27560599F79F996F1EDC729E126EC33C705C140C65CB8BA6B2E7`.

### Personally executed gates

- `bun test tests/yellow-voice-bill-window-allocation.test.ts tests/yellow-cashier-bill-window-allocation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-next-finance-workspace.test.ts`: **54 passed,0 failed,449 assertions**.
- `bunx tsc --project frontend/yellow/tsconfig.json`: exit0.
- `bunx vite build --config frontend/yellow/vite.config.ts`: exit0,469 modules; index-D-wrvuQq.js / index-NPwD1YbL.css.
- `bun D:/Yellow/temp/astra573-db.ts`: isolated loopback5442 PostgreSQL16.15/migration97, fixture absent initially; actual `bun test tests/financial-folio-transfers.integration.test.ts --timeout 120000` with required flag: **8 passed,0 failed,47 assertions,8.20s**. Real immutable/balanced/concurrency/replay/rollback/hostility transfer cases rerun, not implementer evidence.
- `bun D:/Yellow/temp/astra575-parser.ts`: actual imported parser and extracted complete-group resolver; outputs below. One exact eligible group resolves, two separate same-description groups are ambiguous, ineligible group not_found. Half/currency-amount and trailing operational clause refusal pass; percent-symbol gap fails.
- `$env:REVIEW_MODE='<mode>'; node D:/Yellow/temp/astra575-render.cjs` personally run with `new`, `existing`, `malformed`, `retry`. Candidate assets substituted only in reviewer browser; financial endpoints locally fulfilled, all other operational writes blocked. New-window separate-yes success:1 preview/0 commands before yes, then2 previews/1 command and matching dual statements yields explicit success. Existing-window refusal, malformed/503 recovery and manual-navigation failures below. Final runs exit0,0 unexpected operational requests/page errors. An intermediate external harness regex syntax error and Finance locator matching both nav copies were corrected in the harness; final navigation uses the visible desktop control.
- `$env:REVIEW_MODE='mismatch'; node D:/Yellow/temp/astra575-mismatch-render.cjs`: exit0, accepted-shape but wrong-currency receipt recovery failure below.
- `$env:REVIEW_MODE='new'; node D:/Yellow/temp/astra575-drift-render.cjs`: exit0; changed preview revision at confirmation produces **2 previews,0 commands**, clears proposal and shows TRANSFER PREVIEW DRIFTED.375/375 and1440/1440 containment; composer buttons44×44. No public preview/transfer request sent in any browser proof.

### P1 — manual navigation discards unresolved financial operation

Voice confirmation `finally` always calls `setReservationLifecycleFlight(false)`, even when the proposal remains postingAttempted and uncertain. The voice ask branch blocks unrelated spoken commands, but the parent/manual navigation capture is released. Actual mounted malformed200 and503 flows each correctly replayed the same body/key on a second yes (2 previews/2 intercepted commands), then clicking desktop **Finance** succeeded, changed the URL to `today?workspace=finance`, removed the reconciliation card and recreated the manual workbench. The pending voice attempt was no longer protected across that navigation.

Keep the shared/manual mutation/navigation lock for every unresolved financial attempt. Expose a narrow same-key conversational recovery path through that lock so yes/reconciliation still works, without making unrelated navigation/manual posting available. Prove actual parent+voice+manual interaction, not only a proposal-state check in ask.

### P2 — existing-window voice workflow cannot run on coherent live topology

Preparation requires `detail.reservation.folios.filter(status=open).length === 1`. A legal existing distinct open sibling implies at least **two** open folios for the same reservation account. A coherent browser fixture exposing both open source and destination in detail and statement is therefore refused before preview: **0 previews,0 commands**, with “more than one open folio; say exact folio reference.” The grammar offers no source-folio-reference branch that can resolve this instruction. This also blocks useful subsequent transfers after the first new window is created.

Resolve one unambiguous source from actual eligible complete-group evidence across the returned open windows, or add the governed explicit source selector/grammar within order scope. Preserve refusal when multiple valid sources/groups remain. Do not test existing-window success with an inconsistent fixture that hides its open destination from reservation detail.

### P1/P2 — mismatched but structurally valid receipt is cached forever

The confirmation path assigns/stores `receipt` before `receiptMatchesVoiceTransfer`. If a successful-shaped response has valid USD instead of confirmed SAR, the match fails and catch retains that untrusted receipt. On the next yes, `if (!receipt)` is false, so no canonical idempotent retry occurs; the same invalid cached object fails forever. Actual browser output: initial confirmation and second yes yield **2 previews but only1 command**, then the unresolved card persists. This is distinct from malformed JSON/shape, which correctly retries because no receipt was assigned.

Cache a receipt for read-only reconciliation only after it has matched the retained exact proposal. On mismatch keep the original body/key and uncertainty, but discard the unverified receipt so a subsequent explicit retry can retrieve the canonical idempotent result. Prove a mismatched first response followed by correct same-key receipt and exact dual-statement reconciliation releases the lock.

### P2 — percentage-symbol partial syntax is not refused

Executed parser results:

- `Move 50% Laundry for Omar Siddiqui to window 2`: partial=false, parsed chargeQuery=`50% Laundry`.
- `Move Laundry for Omar Siddiqui to a new bill called Personal 50%`: partial=false, parsed whole Laundry move with destination name=`Personal 50%`.

The percent alternative is followed by a word boundary, which does not exist between `%` and whitespace/end. Thus a partial instruction can be reinterpreted as a whole-group command/new-window name instead of explicit refusal. Exact server description matching happens to reject the first example on ordinary Laundry, but does not protect the second. Repair symbol/token boundaries and test `%` at whitespace/end plus other supported partial forms; retain ordinary window numbers.

### P2 — operation card does not show the exact submitted audit reason

Source inspection: draft reason is `Yellow voice: move complete ${groupResolution.label} charge group`; card instead prints the different generic text `audit reason: Yellow voice complete-group transfer`. Order575 requires the preview's audit reason. Render `proposal.draft.reason` verbatim as consent evidence, not a summary advertised as the actual reason. No financial-service change needed.

### Positive evidence and limits

The new-window happy path uses a separate finite yes, repeats canonical source/preview, posts only existing governed transfer endpoint with bearer/idempotency, and reconciles source/destination IDs/currency/balances/journal/stay total. Drift refusal and canonical complete-group ambiguity are correct in the cases executed. Existing response validators retain malformed-2xx uncertainty, and unchanged-request voice retry itself works while mounted. No new financial/occupancy/schema/API authority is introduced. However those positives do not satisfy cross-surface recovery or the existing-window workflow, and source-string tests missed these actual effects.

**CHANGES REQUIRED.** Preserve R1 frozen evidence, repair within scope, then request fresh hashes and independent retest. No public preview, transfer, posting, deployment or source edit was performed by reviewer. Real financial mutation proof was isolated5442 only. No whole-PMS/public-release acceptance or complete repository-wide typecheck claim.

---

## R2 — ACCEPT (final stable freeze) — 2026-09-21

Same independent reviewer; all R1 failure evidence retained. An earlier R2 attempt on App02B936… was explicitly paused when the source/build changed during review. Its expected index-DRB6U37e asset disappeared and three browser launches failed before proof. No verdict was issued for those bytes. That preliminary actual-parser/resolver run found mixed2+1 group ambiguity and percentage-before-punctuation gaps. Both are repaired and rerun below against the **new stable freeze**, not inferred from implementer reports.

### Final binding, personally hashed before and after proof

- App `04AC13428858FA26C9FE7F488AD5E0B0E2FA63916E2FD9AB3952B98597D90761`.
- voice `F993BC79655812C985123AD8761D364309852CDA50B606F528FCBAF97BBE1F8D`.
- CSS `436C2B4FD537A48EBB001AD7FECF405021D4E3EF3D919117282EA72D2A0AC5EB`.
- Voice allocation test `923C8EC235B09543E7C39D3DCF6C6F8ED94834A1F13AEAF826AA3A92F7F344B9`.
- Routing test `3F72D99425797D7A78043C98045394F1D3C1EE68D95B787B307F2287EBBC991B`.

### Personally executed final commands/results

1. `bun test tests/yellow-voice-bill-window-allocation.test.ts tests/yellow-cashier-bill-window-allocation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-next-finance-workspace.test.ts`: **55 passed,0 failed,474 assertions**.
2. `bunx tsc --project frontend/yellow/tsconfig.json`: exit0.
3. `bunx vite build --config frontend/yellow/vite.config.ts`: exit0,469 modules; **index-Ao_Ku-Rh.js / index-NPwD1YbL.css**.
4. `bun D:/Yellow/temp/astra573-db.ts`: isolated loopback5442 PostgreSQL16.15/migration97, bounded fixture absent initially. Actual canonical `financial-folio-transfers.integration.test.ts` with required flag: **8 passed,0 failed,47 assertions,7.47s**. Immutable balanced transfers, complete corrected-pair groups, same-key replay/conflict, real concurrency, rollback and hostile boundary/lineage proof personally rerun.
5. `bun D:/Yellow/temp/astra575-r2-parser.ts`: exit0. Actual imported parser refuses percent with whitespace/end **and sentence punctuation** (`50%`, `50%.`, `50%!`), returning partial=true and parse=null. Actual extracted source resolver returns ambiguous for two singly matching sources and mixed sourceA-two-matching-groups/sourceB-one-matching-group. No silent fallback to B. Prior finite half/amount/quantity and malformed-command authored cases remain green.
6. `$env:REVIEW_MODE='<mode>'; node D:/Yellow/temp/astra575-r2-final-render.cjs`, personally run for `existing`, `new`, `ambiguous`, `malformed`, `retry`, `mismatch`; all final runs exit0:
   - Coherent existing-window fixture includes both open source and destination in reservation detail and their authoritative statements. Existing and new modes each show1 preview/0 commands before separate yes, then2 previews/1 locally intercepted command and successful dual-statement reconciliation.
   - Ambiguous multi-source fixture:0 previews/0 commands and explicit ambiguity refusal.
   - Malformed200,503 and valid-shaped mismatched USD receipt modes: first outcome retained; manual Finance navigation leaves URL/card unchanged. Conversational cancel sends no additional command and truthfully preserves unresolved outcome. Subsequent yes sends the **second POST with identical key/body**, without a new preview; corrected receipt+dual statements produce reconciled success. Finance navigation works only after resolution. Each recovery run:2 previews/2 commands.
   - Every proposal visibly renders the exact `Yellow voice: move complete Laundry charge group` reason; intercepted draft reason matches.375/375 and1440/1440 containment;0 page errors/unexpected operational requests.
7. `$env:REVIEW_MODE='new'; node D:/Yellow/temp/astra575-r2-drift-render.cjs`: exit0; revision drift on repeated preview clears proposal with **2 previews,0 commands**. Composer buttons44×44;375/375 and1440/1440 containment.
8. `$env:REVIEW_MODE='retry'; node D:/Yellow/temp/astra575-r2-manual-lock.cjs`: exit0. Actual underlying manual cashier charge was prepared only in browser state before the voice request. After voice503, dispatched click and bubbling submit on that real prepared form produce **zero financial network attempts**. Manual navigation also blocked. Cancel and same-key yes recovery still work;2 previews/2 transfer attempts total; lock releases after verified outcome. All financial endpoints were locally fulfilled or guarded against transmission.

### Review disposition

All five R1 findings are closed on these exact bytes. The independent recovery ref protects shared manual click/submit/navigation while narrowly allowing the conversational recovery composer. Receipt is cached only after exact proposal binding, so a mismatched response can be recovered through the original request/key. Source resolution considers the actual multi-window family and fails closed on group ambiguity. Partial-percentage refusal includes punctuation, and the visible reason is the submitted reason. Existing canonical transfer authorization, generation/revision checks, complete groups, immutable journals and no partial money routing remain unchanged.

**ACCEPT this bounded Order575 source/UI slice.** This is not public promotion or public financial-action authorization. Browser tests used actual mounted candidate components but substituted assets and synthetic financial responses solely inside reviewer Chrome; no preview/transfer/charge reached the public financial server. Other operational writes were blocked, ordinary GET/demo session only. Real PostgreSQL mutation proof was isolated5442. No schema, implementation or public data edited. Whole-PMS readiness and repository-wide typecheck green are not claimed; any promotion requires separate target-bound postflight.
