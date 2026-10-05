# Order 504 — independent conversational arrival review

Reviewer: Astra (`/root/astra_review`), independent non-implementer. Date: 2026-09-20.

## Verdict: REJECT / BLOCKED

The new conversation path reaches only existing canonical command helpers, but its consent and freshness boundary is unsafe. Passing source-string tests and typechecks do not validate this stateful orchestration. No public application/database, operational HTTP command, or runtime source was changed by this review. A reviewer-owned extracted-component test was created outside the runtime and uses only local stubs.

## Blocking findings

1. **P1 — Prefix matching is not explicit consent.** `App.tsx` around 1276 accepts any message beginning with yes/go ahead/confirm. Independently reproduced: after the check-in proposal, `yes, do not check in` calls the check-in helper. An affirmative prefix cannot safely override negation or a different requested scope. Use a finite affirmative grammar or a typed confirmation tied to the exact pending proposal; reject ambiguous/mixed utterances.
2. **P1 — Proposal survives withdrawal or changed intent.** `no, cancel` has no cancellation branch and does not clear `conversationProposal`; independently reproduced a later `yes` committing that old proposal. After proposing room405, `room999` reports that the new room is not eligible but retains room405's proposal: a later yes assigns405. Invalidate pending consent on cancellation, replacement, invalid replacement, target/context changes and superseding requests, and make the exact pending operation visible.
3. **P1 — Stale/error preflight can still trigger a command.** The effect only requires `detail.data`/`readiness.data`, not successful current reads. Folio/check-in use cached `canOpenFolio`/`canCheckIn`, with fresh refetch only after the command. Independently reproduced a check-in helper call while both queries report authoritative read failure, with zero fresh detail/readiness reads before execution. Assignment refreshes candidates, but does not compare fresh reservation evidence to the frozen body before issuing its CAS command. Backend validation remains the final guard; that does not satisfy the order's fresh, fail-closed conversational preflight requirement. Load fresh detail/readiness/candidates as applicable, refuse errors/stale body mismatch, and only then issue the approved operation.
4. **P1 — Named target can be intercepted by an older active arrival.** `ask` around 2403 routes any message containing prepare/check-in/arrival or a room-like number to `assistantCard.checkInReservationId` before `reservationVoiceAction` resolves the named reservation. With Alice active, `check in Bob` is handed to Alice's journey and creates its proposal. The proposal reply omits the reservation's identity. Bind every command and proposal to an explicitly resolved reservation and resolve a changed unique target before the active-context shortcut. The command object currently contains only id/text, not reservation or proposal identity; do not replay stale command state on a newly keyed journey.
5. **P1 — Interim speech can reach the new mutation path.** `listener.interimResults=true`; `onresult` concatenates all results and the pause timer calls `ask(words)` without testing `isFinal`. Although this capture code predates the new actions, it can now turn an interim `yes` into operational consent. Only finalized, visibly surfaced transcript turns may confirm a proposal; interim and canceled recognition must never execute it. No actual microphone action was taken in this review.

Further proof needed: a single in-flight operation guard across manual/conversational paths, no new proposal while a previous command is pending, confirmation/selection reset after conversational success/denial, and ordered progress text after successful authoritative refresh. Current messages claim the arrival was refreshed before `await refresh()` runs. Current numeric command ID uses `crypto.randomUUID().length + Date.now()` (UUID length is constant), so same-millisecond commands can collide. These do not weaken the five blockers above.

## Positive bounded checks

- Bare yes with no proposal issues no command (personally executed).
- Updated cached readiness with canCheckIn=false stops check-in (personally executed).
- Fresh candidates excluding the selected room stop assignment (personally executed).
- Assignment proposal body is frozen; identical JSON bodies reuse the existing assignment key. Folio/check-in keys remain per-mount refs. Helpers retain canonical endpoint/Bearer/idempotency behavior; there is no new direct DML, occupancy function, posting, or event implementation in this frontend slice.
- Existing server invariants are not claimed bypassed by these frontend defects. The issue is staff authority/freshness before an otherwise authorized canonical command.

## Personally executed proof

Runtime cwd: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

```powershell
bun D:/Yellow/temp/astra-order504-conversation-proof.ts
bun test tests/yellow-voice-routing.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-ambient-ai-mode.test.ts tests/yellow-next-public-surface.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx tsc --noEmit
```

- Reviewer extracted-component harness: exit0; three safety controls pass and four defects reproduced: negated yes, canceled proposal, authoritative read-error/cached readiness execution, and invalid replacement room retaining prior proposal. This harness asserts current defects to capture reproducible evidence; exit0 is **not** an acceptance result. It transpiles the actual current component and drives local React-hook substitutes; no HTTP/database/browser proof is claimed.
- Repository focused suite: **22 pass, 0 fail, 147 assertions** across five files. New conversational assertions are source-string checks, not an execution of proposal/confirmation transitions.
- Strict frontend and root typechecks: exit0, no diagnostics.
- No fresh PostgreSQL proof was run: frontend consent failures block acceptance before operational proof. Prior canonical-service proofs must not be presented as proof of this new conversational authority boundary.

## Frozen SHA256

| File | SHA256 |
| --- | --- |
| frontend/yellow/src/App.tsx | AF76ECFFE7F171CBE4236A821696B24A5D6128DE7133F0532B2BD85AAF6CF958 |
| frontend/yellow/src/voice.ts | D7142173F3BE4FF625F42025B47508F4ADF0A7793F5857BCA61DD3522B16EFC6 |
| tests/yellow-voice-routing.test.ts | 0CDB044663C23A9931A2B2FA4DC0D2A9E558BA2B8CB3B30D158091B0B7E49ED1 |
| reviewer-owned conversation-proof.ts | EFE51784B4B016CA6ABF0BC27298963AB7C85F5672A8F24368A7D522A5F12462 |

Remediation requires executable behavioral tests for these exact hostile inputs/context changes and fresh-read failures, followed by independent rerun. No source acceptance, operational deployment, visual acceptance, or full arrival-automation claim is granted.

## Second independent review — remediation candidate: still BLOCKED

Same reviewer/date. This is the current result; original findings/results above refer to the earlier bytes.

### Independently verified improvements

Reviewer-owned r2 actual-component harness personally passed eight checks: bare yes without proposal refuses; negated affirmative does not immediately execute; exact `cancel` clears proposal; invalid replacement room clears the old proposal; failed direct fresh preflight refuses and refreshes; changed readiness refuses; removed fresh candidate refuses; and identical failed assignment retry retains exact body/key and refetches all three queries. Direct detail/readiness requests now precede every conversational command. Source inspection confirms named resolution precedes the active-arrival shortcut, explicit proposal text names the reservation confirmation, and only final recognition results are passed by the voice timer.

### Remaining blockers, personally reproduced

1. **Fresh assignment comparison is incomplete.** It checks only fresh segment existence and segmentId, not booked unit type or period against the frozen proposal body. The r2 harness changes the fresh segment's end date from 2026-09-21 to 2026-10-02 while preserving segmentId/current candidate. Confirmation still calls assignment with expectedPeriod.to=2026-09-21. The canonical CAS should reject this; the order requires stale orchestration to stop before issuing the stale command. Compare every frozen CAS field to fresh evidence and require renewed proposal/consent after change.
2. **In-flight guard starts too late.** `committing/openingFolio/assigningRoom` are set only after awaited fresh preflight. With the two fresh reads deliberately held, a second prepare/yes pair is accepted; releasing the reads produces two overlapping check-in helper calls. The same idempotency key is retained, mitigating duplicate canonical effects, but it does not serialize the orchestration or prevent contradictory proposals/progress during preflight. Acquire a synchronous attempt ref before the first await and hold it through command plus refresh; apply the guard across conversational/manual actions, and add a permanent deferred-promise regression.

Residual conditions: broad natural cancellation such as `no, cancel` is not the finite `cancel` command and is not forwarded to this component; do not claim all withdrawal phrases are recognized. Command state is still not explicitly reservation/proposal-bound, same-millisecond IDs still use constant UUID length plus Date.now, and progress text still claims refresh before awaiting it. Those should be covered in retained executable orchestration tests rather than source substring checks. Final-result filtering does not by itself prove a real browser/microphone turn lifecycle; no audio capture was performed.

### Exact independent execution

```powershell
bun D:/Yellow/temp/astra-order504-conversation-proof-r2.ts
bun test tests/yellow-voice-routing.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-ambient-ai-mode.test.ts tests/yellow-next-public-surface.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx tsc --noEmit
```

r2 harness exit0: eight passing safety/retention checks plus two defects deliberately asserted/reproduced (not acceptance). Repository suite: **22 pass, 0 fail, 155 assertions**. Both typechecks exit0/no diagnostics. No runtime source change, deployment, public request or database command. No canonical invariant/PG acceptance is inferred from mocked command counters.

| Current file | SHA256 |
| --- | --- |
| App.tsx | BE3165D25C9D8BBA2EACC678D4E1679C4773B584DA459D2479C9003467C9CA5C |
| yellow-voice-routing.test.ts | 48D36528C55C4F8118C9B2016CFAC15DAC61DDD7DEC61E63309313CEB8F6F06B |
| reviewer conversation-proof-r2.ts | EB95DB960EF808C31D71AAE5107274900A64068F57441B43F9EA625A01E9774D |

## Third independent review — evidence comparison fixed; in-flight boundary incomplete

Same reviewer/date. **Still BLOCKED for the remaining in-flight/cancellation case.** Fresh segment comparison now includes unit type, unassigned expectation, from/to; command IDs are UUID strings. The reviewer harness was updated to expect refusal of stale-period assignment and one execution for overlapping conversational confirmations; both now pass. Ten controlled safety/retention cases pass in total.

The synchronous ref is checked only inside `execute`, not before the cancel/propose branches or in the manual command handlers. Additional personally executed deferred-read case: prepare check-in, yes, hold fresh reads, cancel, then release reads. The component announces “cancelled the pending action ... did not change this arrival,” but subsequently invokes check-in. This violates the promised cancellation result and leaves the in-flight boundary incomplete. Reject all new conversational instructions truthfully while the confirmed attempt is underway (or implement safe pre-write cancellation); include the same guard in manual action handlers so the two surfaces cannot interleave. A guard inside only the affirmative branch is insufficient.

Personally reran `bun D:/Yellow/temp/astra-order504-conversation-proof-r2.ts`: exit0, ten PASS cases and the cancellation defect deliberately reproduced. Personally reran the same five-file repository test command: **22 pass, 0 fail, 155 assertions**; both frontend/root typechecks exit0. No public/network/DB action or runtime edit.

SHA256: App.tsx `D5B3A0DBC45CBEB127E6999D4CB22A940DA1555087F0B8EADF94A0EB8E27A542`; voice-routing test `48D36528C55C4F8118C9B2016CFAC15DAC61DDD7DEC61E63309313CEB8F6F06B`; updated reviewer r2 harness `395CA29C6C0E9CA41B20C0C9B0F26A4D579F12A7CE3703F7E296C0639A586377`.

## Fourth independent review — ACCEPT bounded source safety slice

Same independent reviewer/date. This is the current verdict for the finite proposal/confirmation, fresh-preflight and shared in-flight boundary. Earlier rejection sections remain historical and are superseded for their specifically repaired defects.

The synchronous ref now guards all conversational command branches before cancel/proposal handling and all three manual handlers acquire/check/release that same ref. It spans fresh preflight through command/refetch/finally. Personally re-executed the updated actual-component harness: **14 PASS cases**, no reproduced safety defect in those cases:

- Bare yes without proposal, negated affirmative, exact cancellation, invalid replacement candidate.
- Failed fresh reads, changed readiness, removed fresh candidate and changed fresh stay period refuse commands.
- Overlapping conversational confirmation is refused while preflight is held.
- Identical failed assignment retry retains its exact body/idempotency key and refreshes all three queries.
- Cancellation during an authorized pending operation is truthfully refused as in-progress, rather than falsely announced as canceled.
- Manual check-in, primary folio, and room assignment each cannot interleave with a held conversational preflight; the authorized operation completes once.

Commands personally rerun:

```powershell
bun D:/Yellow/temp/astra-order504-conversation-proof-r2.ts
bun test tests/yellow-voice-routing.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-ambient-ai-mode.test.ts tests/yellow-next-public-surface.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx tsc --noEmit
```

Repository result: **22 pass, 0 fail, 155 assertions**. Both TypeScript checks exit0/no diagnostics. Harness exit0 with 14 PASS summaries. Tests use the actual transpiled component with controlled hook/command substitutes, not a rewritten state-machine model.

### Bounds / remaining product and proof work

This accepts the reviewed finite-command frontend safety change, not a complete end-to-end conversational arrival product or public release. Existing canonical authenticated helpers and server invariants remain the command boundary; no backend/migration/financial semantic change is approved. No fresh real-PG preservation battery, browser interaction, actual microphone lifecycle, or deployment proof was performed this round. The frozen source's repository test remains mostly string assertions; retain/port the reviewer behavioral cases as permanent regressions.

Do not claim arbitrary natural-language consent/cancellation: only the finite recognized grammar is admitted. The initial named request opens the journey but does not itself dispatch a new prepare command, and commands are individual proposal/confirmation steps rather than a demonstrated fully automatic preparation chain. Progress wording that announces refresh before its await should be made temporally accurate. Old Order503 visual/route findings are outside and not cleared by this approval.

| Accepted current file | SHA256 |
| --- | --- |
| App.tsx | E7AE012BBE065575B3D40BB98EE275508E351A78F4F65C1A8E6242D6C65FE4D0 |
| yellow-voice-routing.test.ts | 48D36528C55C4F8118C9B2016CFAC15DAC61DDD7DEC61E63309313CEB8F6F06B |
| reviewer conversation-proof-r2.ts | 4068DB2836EBC31E05EA2D940E48B6775B0DC3352C760B993B9CF2E946CF10D9 |

Only reviewer artifacts were edited. No runtime source/public/DB/tunnel operation was performed.
