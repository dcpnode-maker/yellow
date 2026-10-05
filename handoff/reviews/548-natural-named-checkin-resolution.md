# Order548 — independent named check-in resolution review

Reviewer: Codex Astra `/root/astra_review`, non-implementer. Date: 2026-09-21.

**CHANGES REQUIRED / REJECT for current candidate.** No implementation edit, database access, public app access or deployment was performed.

## Bound source

Runtime root: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

- `frontend/yellow/src/voice.ts`: `19F75B011374701A4B2271FE62E9473F0937CA02D09DCBA41808710C5CF64576`
- `tests/yellow-voice-routing.test.ts`: `BE3AC79294318B96C09AF3626FFA5BFEE57A120E76835ABE5BD28CB6DB61828E`

Read PROJECT.md, Order548 and relevant decisions; applied code-review and Yellow entity-pattern review guidance. Earlier source changed during initial inspection; all results below bind only these final hashes, not the initial `8949A62E...` snapshot. The final source correctly denies unknown status.

## Blocking finding: explicit ineligible identity falls through to eligible prefix

Order548 requirement3 says an exact confirmation can resolve only an eligible due-in. The implementation filters ineligible reservations out before identity scoring, then uses `query.includes(normalise(reservation.confirmationNo))`. Thus an exact request for an ineligible reservation can select a different eligible reservation whose confirmation is its prefix.

Personally executed actual-parser reproduction from runtime root:

```powershell
bun -e "import{reservationVoiceAction}from'./frontend/yellow/src/voice.ts'; const due={reservationId:'due',confirmationNo:'ARR-100',primaryPartyName:'Current Fictional',status:'due_in'}; const future={reservationId:'future',confirmationNo:'ARR-100-FUTURE',primaryPartyName:'Future Fictional',status:'reserved'}; console.log(JSON.stringify(reservationVoiceAction('prepare check-in ARR-100-FUTURE',[due,future])));"
```

Exit0 returned `{reservation:{reservationId:'due',confirmationNo:'ARR-100',...},workbench:'check-in'}` instead of null. This is wrong-reservation preparation, not a demonstrated unauthorized check-in write: the later readiness/confirmation gate remains. Nevertheless it violates the order's identity requirement and is not safe to promote as corrected resolution.

Required correction: identify an explicitly named canonical confirmation before eligible name scoring, reject if that exact identity is ineligible, and prevent an eligible shorter-prefix confirmation from replacing it. Add regression coverage for ineligible exact references sharing an eligible prefix; retain ordinary-open and checkout behavior.

## Personally executed passing checks (do not override blocker)

```powershell
bun D:/Yellow/temp/astra-order548-parser-proof.ts
bun test tests/yellow-voice-routing.test.ts tests/yellow-conversational-guest-allocation.test.ts tests/yellow-reservation-guests.test.ts tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-next-finance-workspace.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order548-reviewed-build
```

All exit0: 49 tests, 0 failures, 375 assertions; strict frontend/root types clean; Vite469 modules, `index-B_Dv1T-d.js`. Reviewer-owned pure parser probes passed repeat/history/future name eligibility, two-current-due-in ambiguity, noncolliding exact references, unknown-state denial, operationalState precedence, ordinary-open and checkout boundaries, bare-yes refusal. The subsequently added prefix reproduction exposes a gap in those positive checks.

Reviewer artifact `D:/Yellow/temp/astra-order548-parser-proof.ts` SHA256 `833A01CF147B23BEA136ADBF7699FA90237F4FC70D845CC67A7B2005F0F6EF8A`. No new API/domain/state/permission/write authority was found in this pure parser scope. No browser, database, referee11/11, deployment or whole-PMS acceptance is claimed.

## R2 — independent corrected-candidate verdict, 2026-09-21

**ACCEPT for the following corrected bytes only.** The original rejection and reproduction above are retained as failure evidence. No implementation file was edited by the reviewer.

- `frontend/yellow/src/voice.ts`: `F76AC196349A3BE7A953B152CCEABD2504464F51B3050D37D707CA3471B3E233`
- `tests/yellow-voice-routing.test.ts`: `7DFDEF7A9286E42BB73A5D902D3428B7E9CEC8191293A8A17C8CE94B63D9B91F`

The briefly inspected intermediate `13C2FEA...` candidate was superseded before executable proof. The actual-parser harness printed the final `F76AC196...` hash, and all following suite/types/build results bind to the final candidate, independently rehashed afterward.

### Correction and independent hostility

Explicit known confirmation matching now considers the complete reservation collection before selecting an eligible action: one longest known match takes precedence over name scoring; ineligible exact identity returns null; multiple equal matches or unrelated explicit confirmations return null. This prevents the rejected `ARR-100-FUTURE` request from falling through to the shorter eligible `ARR-100`. Name-only check-in selection still filters strictly to `(operationalState ?? status) === 'due_in'` before scoring. Missing/unknown state is not eligibility. Ordinary open keeps all-status lookup, and checkout retains due-out/in-house eligibility; neither performs a write.

Personally reran the original wrong-identity case in both collection orders, eligible longer-prefix selection, ordinary opening of the longer future confirmation, checkout refusal for the longer ineligible confirmation, and ineligible exact reference combined with a matching eligible name. All pass. Duplicate known confirmations and unrelated explicit references fail closed. Independently retested repeat history/future exclusion, two current same-name due-ins, exact eligible selection, operational-state override in both directions, missing/empty state, ordinary-open states, checkout states/ambiguity, and bare yes. No remaining blocking finding within Order548's bounded parser scope.

### Personally executed commands/results

```powershell
bun D:/Yellow/temp/astra-order548-parser-proof.ts
bun test tests/yellow-voice-routing.test.ts tests/yellow-conversational-guest-allocation.test.ts tests/yellow-reservation-guests.test.ts tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-next-finance-workspace.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order548-r2-reviewed-build
```

All exited0: **49 pass, 0 fail, 377 assertions**; strict frontend/root types clean; Vite469 modules, `index-CpdoCT72.js`. Pure reviewer parser probe passed. Supplemental actual-parser inline command:

```powershell
bun -e "import assert from 'node:assert/strict';import{reservationVoiceAction as f}from'./frontend/yellow/src/voice.ts';const a={reservationId:'a',confirmationNo:'ARR-1',primaryPartyName:'One Fictional',status:'due_in'};const b={reservationId:'b',confirmationNo:'OTHER-200',primaryPartyName:'Two Fictional',status:'due_in'};for(const s of ['prepare check-in ARR-1 and OTHER-200','open ARR-1 and OTHER-200'])assert.equal(f(s,[a,b]),null);console.log('PASS unrelated explicit confirmations fail closed');"
```

Exit0/PASS. Updated reviewer harness SHA256: `275792D4948366313E86CF0E3DAEF108929D133C8EF5F14143C24F5218082EAD`. The source changes only reservation selection for preparing an existing governed journey; no commit, authority, API, database or final confirmation change. All original review limitations remain: no DB/public operation, deployment, new browser acceptance or whole-PMS readiness claim.
