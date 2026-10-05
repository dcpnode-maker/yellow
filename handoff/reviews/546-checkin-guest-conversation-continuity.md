# Order 546 — independent check-in guest-conversation continuity review

Reviewer: Codex Astra `/root/astra_review`, independent non-implementer. Date: 2026-09-21.

**ACCEPT for the exact source below and bounded no-write continuity proof.** No implementation edits, database operations, public app access or deployment were performed. The order's desktop/375px non-mutating public browser and release/postflight gates remain separate.

## Frozen bytes

Runtime root: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

| File | SHA-256 |
| --- | --- |
| frontend/yellow/src/App.tsx | `663B9F7C21FD78A646FE314A260136F9EF6C2288D6B207AA668F05194CD596E0` |
| frontend/yellow/src/voice.ts, unchanged parser | `4375EF4C6834C262E2CDEF82DCE5E93019A27FCB44D7DBC9AC96DB5565DB7C67` |
| tests/yellow-conversational-guest-allocation.test.ts | `70315DB7CA88B0F8EB52D65A7FC14263ADAFD0CC61259B9A4214FDA2028D86E7` |
| tests/yellow-voice-routing.test.ts | `862F810041413FAA460119A5F58DA75DBF4F5EC29070CCA2DE9A72C37E77AB05` |

Read PROJECT.md and Order546, searched applicable decisions, and applied code-review/Yellow entity-pattern guidance. `bash ./state.sh` failed because WSL `/bin/bash` is unavailable; no referee11/11 claim.

## Source findings

No blocking finding. Active guest context now falls back from ordinary `reservationId` to `checkInReservationId`. With no guest proposal, the existing finite arrival yes/no/room/prepare branch still dispatches unchanged to `setArrivalConversation`. While a guest proposal exists, arrival confirmation dispatch is suppressed; guest confirmation additionally requires that proposal's reservation ID equal the active reservation before any write. A stale foreign-reservation proposal therefore cannot authorize a write.

Proposal, successful update, already-applied reconciliation and stale-stop cards carry the original `checkInReservationId`; text-only denials/cancellation leave that live card context intact. Ordinary reservation cards remain ordinary. The existing keyed Overwatch component and canonical readiness authority remain intact; no guest path invokes check-in, room assignment or folio opening.

Success and already-applied reconciliation await invalidation of ordinary reservation, Overwatch reservation, Overwatch check-in readiness, board and command-index queries before reporting refreshed success. Stale-stop invalidates ordinary/Overwatch detail and readiness and retains the journey. Query keys match the actual Overwatch `useQuery` declarations. Unchanged guest-service boundary, visible proposal, stable key, canonical matching and synchronous shared mutation lock remain in force. This adds neither server CAS semantics nor any financial/domain/database authority.

## Personally executed evidence

From the runtime root, each command exited 0:

```powershell
bun D:/Yellow/temp/astra-order546-continuity-proof.ts
bun D:/Yellow/temp/astra-order544-conversation-proof.ts
bun test tests/yellow-conversational-guest-allocation.test.ts tests/yellow-reservation-guests.test.ts tests/yellow-voice-routing.test.ts tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-next-finance-workspace.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order546-reviewed-build
```

- Focused/adjacent suite: **47 pass, 0 fail, 369 assertions**, seven files.
- Strict frontend/root TypeScript: no diagnostics.
- Production build: 469 modules, main asset `index-B21UjzKk.js`, CSS `index-Dl8Wzuow.css`; reviewer-owned build directory only.
- New reviewer-owned harness transpiles the actual current `ask` and share/matching helpers and imports the actual parser. Eight controlled groups pass: unchanged arrival yes/no/room/prepare dispatch without a guest proposal; guest yes exclusively invokes guest replacement and retains the refreshed journey; guest no cancels only guest proposal; stale baseline refuses without writing and refreshes Overwatch; already-applied retry reconciles without another write; denial retains guest proposal/check-in context; committed uncertain response reconciles in the journey; ordinary reservation flow stays ordinary.
- The existing reviewer-owned Order544 hostile harness was personally rerun against the new App hash: all ten groups pass, including supersession, old-authority clearing, bare yes, identity hostility, committed/uncommitted retry and synchronous duplicate/cancel exclusion.

Reviewer artifact `D:/Yellow/temp/astra-order546-continuity-proof.ts` SHA-256: `314B66007EEDD9B506D8D69127BF6024C7ECC8484527F8C13273FA2A3CECB5DD`. Reused Order544 harness SHA-256: `3B145A42FBD554A54AAC57844BA70785DF4C6037773D3E26688462E046BCB19E`.

These controlled executions run real extracted candidate code with controlled services, not rendered-browser or real-database mutations. Order544's fresh isolated authenticated API/DB proof remains separately recorded; it was not represented as newly executed for this UI-only continuity change. No whole-PMS readiness, public deployment acceptance or independent mobile browser proof is implied.
