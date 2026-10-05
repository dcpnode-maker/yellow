# Review 609 — reservation lifecycle create/edit surface

## Status

Accepted at independent R2 on 2026-09-23. R1 remains below as the audit record of
the rejected intermediate candidate and the defects subsequently repaired.

## Candidate

`D:\Yellow\temp\order609-four-day-sprint-source`, copied from the independently
accepted Order605 release source at revision
`344ab3485bf4a9da3d27ffca4cabbce75c36151b`.

Before this preflight the candidate differed from that source only by the copied
Order609 order file; `robocopy /L /E` reported 2,392 matching source files, zero
copies, zero mismatches, zero failures and one 2.7 KiB extra metadata file.

## Verified existing authority

- `ReservationCommitService` and `POST /api/v1/reservations:commit` own creation,
  inventory arbitration, idempotency and the server confirmation.
- `ReservationLifecycleService.modify` and the property/reservation `PATCH` route
  already own compare-and-set lifecycle edits and exact replay behavior.
- Party search, availability search, reservation detail reread and the current
  create wizard already exist in the React client.
- `reservation-lifecycle.integration.test.ts` already proves frozen policy evidence,
  exact replay, stale expected-state rejection and publication rollback at the
  domain boundary. Order609 must not duplicate that authority in the browser.

## Missing behavior at preflight

- the React API does not expose the existing lifecycle `PATCH` route as a typed
  full-reservation edit operation;
- the create wizard treats a commit response as final success without an
  authoritative reservation reread and exact receipt reconciliation;
- unknown commit outcomes do not recover by rereading/replaying the same stable key;
- offer/policy changes and all missing required fields are not presented as one
  finite proposal before confirmation;
- duplicate Party candidates are displayed as ordinary results without an explicit
  duplicate-evidence warning;
- Overwatch has no bounded create/edit proposal intent with the same confirmation,
  current-preflight and reconciliation gates;
- mounted 240 CSS-pixel proof is absent.

## Frozen closed file list

No product edit may begin until this list is treated as the complete writer scope.
A required file outside it stops into `handoff/questions/`.

1. `frontend/yellow/src/App.tsx`
2. `frontend/yellow/src/workspaces/ReservationWorkspace.tsx`
3. `frontend/yellow/src/yellow-api.tsx`
4. `frontend/yellow/src/voice.ts`
5. `frontend/yellow/src/styles.css`
6. `src/overwatch/index.ts`
7. `tests/yellow-native-reservation-creation.test.ts`
8. `tests/yellow-reservation-operational-details.test.ts`
9. `tests/jarvis.test.ts`
10. `tests/order609-reservation-create-edit.test.ts` (new)
11. `tests/order609-reservation-create-edit.browser.test.ts` (new)
12. `handoff/orders/609-reservation-lifecycle-create-edit-surface.md`
13. `handoff/reviews/609-reservation-lifecycle-create-edit-surface.md`

Generated public assets are deliberately deferred to Order614 so the first writer
scope remains exact and no hashed output name is guessed before a verified build.

## Required focused proof

- source/mounted tests: create and edit success, complete missing-field disclosure,
  duplicate Party evidence, changed offer/policy, stale response suppression,
  same-key replay and unknown-result recovery;
- procedural Overwatch tests: proposal only, explicit yes/no confirmation, current
  preflight, cancel/no zero-write and post-write reread reconciliation;
- browser proof at 240, 375 and 1440 CSS pixels with a mutation guard and no
  horizontal overflow;
- strict TypeScript, boundaries and frontend build;
- independent non-implementing reviewer personally executes the focused and browser
  proofs and checks that no new domain authority was introduced.

## Worker history

- Goose/OmniRoute read-only discovery reached the real React and API files but the
  selected explicit-free provider entered cooldown before returning the required
  six-field contract. Its incomplete output is not accepted as proof.
- DSH `0.1.5-rc.2` is installed in an isolated pinned location and reached the same
  loopback OmniRoute provider under a read-only PowerShell sandbox. The same provider
  cooldown prevented model completion; no candidate product file was changed.

## Independent review R1 — 2026-09-23

### Verdict

**CHANGES REQUIRED.** The source-level compilation, boundary, focused-test and
external-build gates are green, and the React client continues to call the existing
canonical commit and lifecycle-PATCH endpoints. The candidate does not yet satisfy
the frozen Order609 acceptance proof, however: stale failed offer searches can still
repaint current state, the added Overwatch reservation procedure is an unused helper
rather than a production Overwatch surface, and the browser test mounts a handwritten
HTML fixture instead of the actual React route. No independent approval is granted.

Reviewer: Codex independent non-implementing reviewer
`/root/order593_http_proof`. The reviewer made no product, test, runtime or database
change. This review record is the only file changed by the reviewer.

### Candidate and scope inspection

- Candidate: `D:\Yellow\temp\order609-four-day-sprint-source`.
- Accepted base:
  `D:\Yellow\runtime\order605-344ab3485bf4a9da3d27ffca4cabbce75c36151b-source`.
- Excluding `.git`, `node_modules`, `.yellow`, logs and generated public output, the
  source delta is confined to the frozen list: `App.tsx`, `styles.css`,
  `ReservationWorkspace.tsx`, `yellow-api.tsx`, `src/overwatch/index.ts`, the two new
  Order609 tests and the copied Order609 order. `voice.ts` and the three named legacy
  test files are unchanged. No second reservation domain command or endpoint was
  introduced.
- Reviewed candidate SHA-256 values:
  - `App.tsx` — `9DE9FC41B25133BBDFEA49C606934CEB5561AA4EEA09C6631E9BBEDD79FD8AF3`
  - `styles.css` — `71CE423D62057E9F9182D7C9CA69AB229027CF7EC62C9F453B555EAFC10BCC25`
  - `ReservationWorkspace.tsx` — `A5665D1EDCFA5A53F41B891567B0CC784B60C8FFE27F4B07F494C07B9F262586`
  - `yellow-api.tsx` — `A5167275CE1A8C744BD8D19B7D3434C2ACAA57AB87B1101039D4CD3D2BBB3CD5`
  - `src/overwatch/index.ts` — `C6A5F787E88C9E678B7963122FE93CE88337E3EA7D4EED2EAC0C314DC38151EB`
  - source proof — `56554E6FF186EB8B858E141CB09684C22ABBB8D191A5B6D00C7F20063553DC5C`
  - browser proof — `CD2998194E2DE8E00C773F0355F8671B3636891710D7487BEE0DC40BF9BE6082`
- Generated-output drift was present during the initial independent inspection:
  candidate `public/yellow-next/index.html` referenced `index-DbEaxexQ.js` and
  `index-BF7gFfCX.css`, neither of which existed in its assets directory. The
  coordinator then restored this deliberately deferred tree from the accepted
  Order605 source. The reviewer personally repeated a recursive SHA-256 manifest:
  candidate 13 files, base 13 files, **zero path/hash differences**. Generated output
  is therefore no longer a current finding and remains correctly outside Order609's
  source delta; Order614 still owns generation of new release assets.

### Personally executed gates

From the candidate root:

1. `bun run typecheck` — exit `0`.
2. `bunx tsc -p frontend/yellow/tsconfig.json --noEmit` — exit `0`.
3. `bun run boundaries` — exit `0`; 203 TypeScript files checked.
4. `bun test tests/order609-reservation-create-edit.test.ts tests/order609-reservation-create-edit.browser.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-reservation-operational-details.test.ts tests/jarvis.test.ts`
   — **37 passed, 0 failed, 122 expectations, 5 files**.
5. `bunx vite build --outDir C:\Users\astha\AppData\Local\Temp\yellow-order609-review-build-cd1a16e08b684dd09bae6e55d3a13883 --emptyOutDir`
   from `frontend/yellow` — exit `0`; 484 modules transformed, 13 files emitted,
   build completed in approximately 590 ms. Output was external to the candidate.

### Blocking findings

1. **Stale failed offer searches can repaint the active workspace.**
   `ReservationWorkspace.tsx:2870-2896` allocates and checks an
   `offerSearchGeneration` only on the successful response path. Its `catch` always
   calls `setError(...)`, and its `finally` always calls `setWorking(false)`. After a
   reset or newer generation, an older rejected request can therefore surface its old
   error and clear the newer request's busy state. This directly misses Order609's
   stale-response suppression requirement. Guard both paths with the captured
   generation and add a deterministic rejected-stale-request proof.

2. **The Overwatch reservation implementation is not connected to Overwatch or to
   the canonical reservation commands.** `src/overwatch/index.ts:35-92` exports
   `prepareOverwatchReservationProposal` and `executeOverwatchReservationProposal`,
   but repository usage is limited to the new source test. No production service,
   legacy Overwatch route, React assistant or command dispatcher invokes either
   function. The executor accepts an arbitrary injected `execute` callback, so its
   unit test does not prove that Overwatch calls the existing
   `POST /api/v1/reservations:commit` or property/reservation `PATCH` authority. Wire
   the bounded proposal/confirmation/preflight/reconciliation path into the real
   Overwatch surface without adding a domain authority, then prove that mounted path.

3. **The browser proof does not mount the application under review.**
   `tests/order609-reservation-create-edit.browser.test.ts:26-40` writes a standalone
   static HTML approximation to a temporary file. The real React component, router,
   state machine and API layer never execute. The mutation counter only proves that a
   statically disabled test button did not fire. Although real Chrome successfully
   measures that fixture at 240, 375 and 1440 CSS pixels, this is not executable proof
   of the actual create/edit surface or its zero-write confirmation guard. Serve the
   externally built application (or mount the actual React application in the real
   browser), enter the real reservation route, intercept/count mutation requests,
   and prove containment plus no-write behavior at all three widths.

4. **The new focused proof is not mounted HTTP proof.** The added source test covers
   pure helpers and source-string delegation assertions. Existing `jarvis.test.ts`
   proves the legacy Overwatch ask route, not Order609 reservation creation/editing.
   Add focused executable proof through the production app/API boundary showing that
   the Overwatch path delegates to the one canonical commit/PATCH authority and that
   cancel, stale preflight and unknown-result handling do not create an alternate
   write path.

### Confirmed nonblocking behavior

- React creation still calls only `POST /api/v1/reservations:commit` and sends the
  stable `idempotency-key`; edit still calls the existing property/reservation
  lifecycle `PATCH`. Backend route/domain files are otherwise unchanged.
- The manual create flow performs a current offer reread before commit, preserves the
  same key for an uncertain result, and requires an authoritative reservation reread
  matching the commit receipt before presenting success.
- Duplicate Party evidence is advisory grouping only: all canonical profile and Party
  identifiers remain separate, and no merge/write operation is introduced.
- The successful-response generation checks prevent an older successful guest/offer
  search from replacing newer results. Finding 1 is specifically the unguarded
  rejected-response/finally path.
- The external Vite build proves the edited source is buildable without legitimizing
  the stale/incomplete checked-in `public/yellow-next` output.

## Independent review R2 — 2026-09-23

### Verdict

**ACCEPTED.** The current candidate closes every R1 blocker without creating a new
reservation authority. The reviewer personally inspected the current source, the
exact delta from the accepted Order605 base, the mounted HTTP proof and the real-app
browser proof, then reran every requested gate against the final App hash. Order609
may continue to Order610.

Reviewer: Codex independent non-implementing reviewer
`/root/order593_http_proof`. The reviewer did not implement the R2 repairs and made
no product, test, runtime or database change. This appended R2 record is the only
reviewer write.

### Final reviewed identity and scope

- Candidate: `D:\Yellow\temp\order609-four-day-sprint-source`.
- Base:
  `D:\Yellow\runtime\order605-344ab3485bf4a9da3d27ffca4cabbce75c36151b-source`.
- Current non-generated delta has nine unique paths, all inside the frozen closed
  list: `App.tsx`, `styles.css`, `ReservationWorkspace.tsx`, `yellow-api.tsx`,
  `src/overwatch/index.ts`, `tests/jarvis.test.ts`, the two new Order609 tests and
  the copied Order609 order. `voice.ts` and the two older reservation test files are
  byte-identical to the accepted base. No migration, schema, seed, permission,
  dependency, domain service or alternative reservation endpoint changed.
- Current reviewed SHA-256 values:
  - `App.tsx` — `AE2EE8C04473EC976223AAF3C087A6CF63FD483517D3CEE7CDCAE5BEF794B247`
  - `styles.css` — `71CE423D62057E9F9182D7C9CA69AB229027CF7EC62C9F453B555EAFC10BCC25`
  - `ReservationWorkspace.tsx` — `8DF0FAF7392CF1E988E3ABCE114991D57A9680910B78A8260E04A0CDC4096F44`
  - `yellow-api.tsx` — `A5167275CE1A8C744BD8D19B7D3434C2ACAA57AB87B1101039D4CD3D2BBB3CD5`
  - `src/overwatch/index.ts` — `E406A3461E2C3F678C3FE3461E8EB243D8703B6EE705F961AF363816362C236F`
  - `tests/jarvis.test.ts` — `2867EB73D69D0CC55F696FC911270E2019A98E797EEA8B0B9B576C60214A890A`
  - Order609 source proof — `40574DC74F70E24EADEF697F0B5A8459BB5A02B878319BCF823E6B9A987D33AA`
  - Order609 browser proof — `02AEBDBA8513BC3B4E5FBCBAAB34E1742622CD030A5E0EDE101BBD42F6999B58`
- The reviewer repeated a recursive generated-tree manifest after all R2 changes:
  candidate `public/yellow-next` 13 files, accepted base 13 files, **zero path/hash
  differences**. The build executed for this review wrote only to an external temp
  directory.

### R1 blocker closure

1. **Stale rejected offer search — closed.**
   `ReservationWorkspace.tsx:2870-2897` now checks the captured
   `offerSearchGeneration` before both the rejection-side `setError` and the
   `finally`-side `setWorking(false)`. The real-app browser proof deliberately holds
   an older availability request, invalidates it, releases it as a 503, and verifies
   that the current workspace still has no old error, remains busy and retains the
   current message before completing the newer request. This is deterministic
   executable proof, not a source-string assertion.

2. **Production Overwatch wiring — closed.** The unused generic proposal/executor
   and arbitrary injected write callback are gone. `reservationOperationFor` is a
   bounded deterministic multilingual classifier that returns only `create`, `edit`
   or `null`; it neither creates evidence nor writes. The mounted legacy
   `/api/v1/jarvis:ask` response carries that operation class and always requires
   confirmation for it. The production React assistant opens the actual lazy-loaded
   `ReservationCreateWorkspace` for creation. Both named and explicit server-returned
   edit intent open the governed reservations workspace so the operator selects the
   canonical reservation before the existing confirmation-gated PATCH editor opens.

3. **Actual browser proof — closed.** The browser test now invokes Vite on the real
   Yellow React application, serves those external build artifacts plus bounded API
   fixtures, navigates the actual `/p/{property}/reservations` route and enters the
   real `ReservationCreateWorkspace`. Real headless Chrome executes the live React
   state machine at 240, 375 and 1440 CSS pixels. At each width it proves zero
   horizontal overflow, usable 44-pixel controls, one-column mobile/two-column
   desktop layout, disabled mutation before the separate confirmation, no mutation
   merely from confirming, exactly one canonical commit after the explicit commit
   click, and success only after the authoritative reservation GET. Runtime exception
   collection is empty.

4. **Mounted HTTP authority proof — closed.** `tests/jarvis.test.ts` mounts
   `createApp`, exercises `/api/v1/jarvis:ask`, and observes zero commit/PATCH calls
   from guidance. It then calls only the production
   `POST /api/v1/reservations:commit` and property/reservation `PATCH` routes and
   observes exactly one call to each existing injected canonical operator method.
   `/api/v1/overwatch:ask` remains absent. The frontend client likewise retains only
   those canonical paths and stable `idempotency-key` headers.

### Authority and reconciliation findings

- Party duplicate evidence groups normalized display names for warning only. The
  separate canonical Party IDs remain visible and selectable; there is no merge,
  guessed identity or write path.
- The create proposal enumerates every missing required field and displays the
  selected property, canonical Party, stay, occupancy, room/rate, total and policy
  evidence before the separate checkbox confirmation.
- `ReservationWorkspace.tsx:2916-2957` fingerprints the finite proposal, retains its
  key while unchanged, rereads current availability/price/policy immediately before
  commit and calls only `commitReservation` with that retained key. A changed or
  missing offer returns to selection and writes nothing.
- `ReservationWorkspace.tsx:2960-2992` accepts success only after `loadReservation`
  and an exact receipt/evidence match. Network, server, invalid-receipt and interrupted
  reread outcomes retain confirmation and the same key for reconciliation; no new key
  is allocated unless the proposal fingerprint changes.
- The existing edit flow builds compare-and-set `expected` and `changes`, retains a
  stable key for the unchanged edit, invokes only the existing lifecycle PATCH, and
  rereads the authoritative detail before success. Its server-owned stale/replay
  semantics remain the already accepted `ReservationLifecycleService` authority.

### Personally executed final-hash gates

All commands ran from the candidate unless another working directory is stated:

1. `bun run typecheck` — exit `0`.
2. `bunx tsc -p frontend/yellow/tsconfig.json --noEmit` — exit `0`.
3. `bun run boundaries` — exit `0`; 203 TypeScript files scanned.
4. `bun test tests/order609-reservation-create-edit.test.ts tests/order609-reservation-create-edit.browser.test.ts tests/yellow-native-reservation-creation.test.ts tests/yellow-reservation-operational-details.test.ts tests/jarvis.test.ts`
   — **37 passed, 0 failed, 152 expectations, 5 files**. The real-app browser proof
   completed in approximately 4.17 seconds.
5. `bunx vite build --outDir C:\Users\astha\AppData\Local\Temp\yellow-order609-r2-current-0644ce3fc3ae4cc6a5cae9e9d9756660 --emptyOutDir`
   from `frontend/yellow` — exit `0`; 484 modules transformed, 13 files emitted,
   build completed in 357 ms.
6. Recursive SHA-256 comparison of candidate and accepted-base
   `public/yellow-next` — candidate 13 files, base 13 files, difference count `0`.

### Findings

- Blocking: none.
- Nonblocking: Order609 deliberately does not publish its external reviewer build;
  Order614 remains the owner of generated release assets. This does not weaken the
  accepted source or browser proof and the retained public tree is byte-identical to
  the accepted Order605 base.
