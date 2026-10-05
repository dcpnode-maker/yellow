# Order550 — independent arrival cleaning conversation review

Reviewer: Codex Astra `/root/astra_review`, non-implementer. 2026-09-21.

**CHANGES REQUIRED.** No implementation edits, database operations, public app access or deployment occurred.

## Reviewed candidate

Read PROJECT.md, Order550, D-601/D-602; applied code-review and Yellow entity-pattern guidance. Runtime root is `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

| File | SHA256 |
| --- | --- |
| frontend/yellow/src/App.tsx | `730DDB205EEEF74CC5C2E54C35AEF8C73D39BAAE8B85DA08052DFBEEE6A1B556` |
| frontend/yellow/src/voice.ts | `648E1756B873DCC2041A7C1003CC3FCE288B3E2DD0428AA5A823198E1C025B32` |
| tests/yellow-checkin-cleaning-conversation.test.ts | `ABB0652771141262B1A4E2011308575B50578334700D61E16BFAC834931D7FC6` |
| tests/yellow-voice-routing.test.ts | `C62510A9292E41F7DD5936071DF4C80B71393FF9C386C85E52F5EF681D872E9C` |

## Blocking findings

1. **Old attendant confirmation survives replacement lookup.** Personally executed the actual extracted Overwatch conversation effect: prepare staff A, start a held lookup for staff B, then say yes before that lookup resolves. The candidate submits cleaning creation for A. `conversationProposal` is not cleared synchronously when a new cleaning instruction begins. Supersession generation prevents the later lookup from reviving, but does not prevent execution of the old proposal in the meantime. Clear old authority before any replacement lookup; add a controlled pending-lookup/yes regression, including an old non-cleaning proposal.
2. **Receipt validation is incomplete and can claim incoherent success.** Personally executed the same real extracted effect with a receipt retaining its four checked fields but `taskId:null`, wrong `dueAt`, and string rather than boolean created/replayed flags. It reports task creation success. Validate complete coherent receipt identity, due time and primitive flags before reporting a task; refresh/reconcile uncertainty safely. Current success wording is emitted before `refresh()` finishes and should not claim the journey has already refreshed until that work completes.
3. **The new attendant command is unreachable through outer conversation routing.** Source inspection at the outer `ask` active-arrival dispatch shows only finite yes/no, room number and prepare-check-in admitted. `arrivalCleaningAttendantIntent` is not used there. Consequently `assign cleaning to <staff>` never reaches the new Overwatch effect through that path; `assign` can instead be interpreted by generic named-reservation resolution or housekeeping routing. Route the bounded cleaning intent to the current journey explicitly, retaining mutually exclusive proposal authority and named-reservation safety.

These findings block approval even though authored source-marker tests pass. The first two are actual candidate-function controlled reproductions, not real task writes. The third is source-routing evidence, not a claimed browser reproduction.

## Executed proof and results

```powershell
bun D:/Yellow/temp/astra-order550-controlled-proof.ts
bun test tests/yellow-checkin-cleaning-conversation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-conversational-guest-allocation.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-reservation-guests.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order550-reviewed-build
```

Controlled harness exited0 after positively asserting both defective outcomes against the printed App730DDB hash. It transpiles the actual candidate effect, controls only services/state, and performs no HTTP/database writes. Authored/adjacent suite: **48 pass, 0 fail, 312 assertions**. Strict frontend/root types clean. Vite469 modules; reviewer output `index-CTrBhRVs.js`, no deployment.

Positive inspection: candidate loads only for exact dirty-room blocker on a due-in; read GET is no-store/Bearer; create POST uses existing endpoint, attendant-only body, Bearer and idempotency header. Staff resolver requires exact identity, active status and staff role; partial/inactive/nonstaff/ambiguous resolution fails. Candidate comparison and retained key exist, and existing task short-circuits duplication. No new task lifecycle, condition update, schema or server authority was found. These do not establish acceptance while the blocking authority/routing/receipt defects remain.

Remaining successful-path/hostility proof must be rerun against corrected frozen bytes before approval, including integrated outer routing, stale candidate refusal, existing-task convergence, stable unchanged retry, response rejection and awaited refresh. No API/DB proof, browser acceptance, referee11/11 or whole-PMS readiness is claimed for this review.

At review recording, App had already changed to `428D52BD984D22820D2600E4FF587FED7EA0EA8448AF654557C79179AD73461C` during implementer remediation. The controlled failure evidence explicitly printed and binds the earlier730DDB hash; passing suite/type/build outputs above must not be represented as a final frozen-candidate approval. A fresh freeze and rerun are required. Reviewer harness SHA256: `5DE18E50CD7BDB67CE226CEBEBF64E9E58FE255E46E02FFA6719EB40B3AD8D54`.

## R2 — frozen-candidate independent review, 2026-09-21

**CHANGES REQUIRED — original defects fixed, but integrated cross-flow confirmation still fails.** Prior failure evidence above is preserved. Reviewer remains the non-implementing Astra agent; no public or database actions.

Frozen hashes verified before controlled execution and after suite/build:

- App.tsx: `D8251A0E8C6C6377411D2F01DAA2E094E3B43F698D0239507926C015C188FE0B`
- voice.ts: `648E1756B873DCC2041A7C1003CC3FCE288B3E2DD0428AA5A823198E1C025B32`
- yellow-checkin-cleaning-conversation.test.ts: `A0E7654EB9998D5495B6495E92B017D9B7134EDE06BE9370E99CEB460DCCF81D`
- yellow-voice-routing.test.ts: `C62510A9292E41F7DD5936071DF4C80B71393FF9C386C85E52F5EF681D872E9C`

### New blocking finding: parent guest command does not supersede pending child cleaning lookup

Personally integrated the actual extracted outer `ask` function with the actual Overwatch conversation effect, controlling only service promises and React-state equivalents:

1. Ask `assign cleaning to Staff Fictional`; hold its staff lookup unresolved.
2. Ask `add Guest Fictional as accompanying`; canonical guest resolution produces a parent guest-allocation proposal.
3. Release the older staff lookup. Child `conversationGeneration` did not advance for the parent guest command, so the old lookup creates a cleaning proposal and speaks the latest prompt: “Shall I create this exact cleaning task?”
4. Ask `yes`. The parent sees `guestAllocationProposal` and executes guest allocation, not the cleaning action just spoken.

The controlled harness asserts exactly one guest replacement and zero cleaning POSTs after this sequence. This is conflicting confirmation authority, not merely stale display. No real guest/task mutation occurred. Introduce shared parent/child proposal supersession so newer guest/other parent commands invalidate pending child lookup and prior arrival consent before asynchronous work can speak or accept confirmation. Add this integrated interleaving as a regression and rerun the final proof.

### Verified repairs and other controlled cases

Twelve earlier controlled groups pass against r2: replacement cleaning lookup clears both old cleaning and old check-in proposal immediately; held replacement plus yes refuses; superseded lookup cannot revive within the child command stream; exact active staff/ID resolution and missing/inactive/nonstaff/partial/ambiguous refusal; nine receipt hostilities (taskId null/malformed, dueAt, created/replayed types, reservation/space/condition/attendant); success conversation reply waits for a held refresh to finish; candidate field drift/lost authority refuses; existing task avoids POST; unchanged re-proposal retry retains exact key/body; dirty/authority/existing-task guidance; finite yes/no and bare-yes refusal; outer ask routes exact cleaning command ahead of same-name reservation inference and clears guest proposal. No cleaning branch invoked room, folio or check-in helpers in these probes.

### Personally executed commands and output

```powershell
bun D:/Yellow/temp/astra-order550-r2-controlled-proof.ts
bun test tests/yellow-checkin-cleaning-conversation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-conversational-guest-allocation.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-reservation-guests.test.ts tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-next-finance-workspace.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order550-r2-reviewed-build
```

Harness exit0 confirms the twelve passing groups and positively reproduces the cross-flow defect. Suite **55 pass, 0 fail, 418 assertions**, eight files; strict frontend/root types clean; Vite469, `index-CcXVbm0m.js`. Passing authored tests do not cover the failing interleaving and do not override rejection.

Retained reviewer harness SHA256 `A016C1B3387731745E9503774BDFFD872709E8D77D7138324CD35102D5DCC109`. No source edits, task lifecycle/condition mutation, deployment or database operations. Approval remains blocked solely on corrected, independently re-executed cross-flow authority and any findings that emerge on its fresh review.

## R3 — independent final bounded verdict, 2026-09-21

**ACCEPT for the exact corrected candidate and controlled conversational proof below.** R1 and R2 rejections remain intact as historical evidence. No remaining blocking finding in this UI-orchestration scope; this is not a public deployment, browser or new database-command approval.

Verified frozen SHA256 before execution and after suite/build:

- App.tsx: `5E310246AA3281AD144173CF0A6A2DB8CAB153DE5AF59BAC6997DF223C7D6D85`
- voice.ts: `648E1756B873DCC2041A7C1003CC3FCE288B3E2DD0428AA5A823198E1C025B32`
- yellow-checkin-cleaning-conversation.test.ts: `A884F6C2F5C6F2E9C0A1C8762D94697347AE43634F4ED4C8887E0E77F3BE3A01`
- yellow-voice-routing.test.ts: `C62510A9292E41F7DD5936071DF4C80B71393FF9C386C85E52F5EF681D872E9C`

### Cross-flow correction and personal execution

The child receives the parent's `assistantOperationGeneration` reference. Each command captures it; delayed staff success/error paths compare both local command and shared parent generation. The rendered-authority effect clears prior unconfirmed child proposals. The reviewer harness extracts both actual child effects and the complete actual parent `ask`, models render-time closure snapshots separately from queued state updates, and connects the shared reference rather than testing disconnected copies.

Personally passed all prior r2 successful controlled groups plus these three integrated cases:

1. **Original failure:** hold staff lookup, issue newer guest command, resolve older staff lookup, say yes. The old lookup stays silent and creates no child proposal; the latest visible/spoken question remains the guest proposal; only its controlled guest replacement executes, with zero cleaning calls.
2. **Inverse:** hold guest lookup, issue newer cleaning instruction, resolve older guest lookup, say yes. The older guest result stays silent and creates no guest proposal; only the latest controlled cleaning call executes.
3. **Existing consent plus failed replacement:** prepare cleaning, issue a newer missing-guest instruction, then bare yes. Rendered shared authority clears the old child consent, no guest proposal exists, and no mutation helper executes.

The other controlled groups reprove replacement lookup authority withdrawal, non-cleaning proposal withdrawal, exact active staff/ID resolution, inactive/nonstaff/missing/partial/ambiguous refusal, nine receipt-hostility variants, awaited refresh before success speech, all compared candidate-field changes and lost authority refusing POST, existing-task no-duplicate convergence, unchanged key/body retry, dirty/authority/existing-task guidance, finite yes/no refusal, integrated outer routing and retained active-arrival context. The cleaning branch did not call room assignment, folio or check-in helpers; no task-completion or condition-write endpoint was added. The existing authenticated/no-store candidate and attendant-only idempotent POST remain the sole cleaning surfaces.

### Commands and results

```powershell
bun D:/Yellow/temp/astra-order550-r3-controlled-proof.ts
bun test tests/yellow-checkin-cleaning-conversation.test.ts tests/yellow-voice-routing.test.ts tests/yellow-conversational-guest-allocation.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-reservation-guests.test.ts tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-next-finance-workspace.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order550-r3-reviewed-build
```

All final commands exit0: controlled proof **15 PASS groups**; suite **55 pass, 0 fail, 424 assertions** across eight files; strict frontend/root types clean; Vite469 modules with `index-CVq_C1fs.js`. Reviewer harness SHA256 `DB0CD52C4E580C895BC1ED3663D9ABDED334ACCBFE80EF20301BF09E24252D52`. Two initial syntax mistakes while constructing this reviewer-owned harness were corrected before execution; they were harness-only failures, not candidate failures.

The reproduction invokes controlled service functions only: no real HTTP/database task or guest write. No implementation edits, public target actions, provider calls or deployment occurred. Acceptance does not assert atomic server CAS between candidate GET and POST, physical cleaning/inspection, real browser speech integration, a new API/DB proof, referee11/11 or whole-PMS readiness. Separate deployment/browser gates and unchanged canonical server authority remain mandatory.
