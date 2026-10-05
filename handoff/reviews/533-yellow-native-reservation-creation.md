# Order 533 — independent native reservation creation review

Reviewer: Astra (`/root/astra_review`), independent non-implementer. Date: 2026-09-21.

## Current verdict: ACCEPT bounded 533/534 candidate — 2026-09-21 final mobile repair

Independent source/component/API proof is personally executed; root's375px native browser navigation/hit-test evidence is explicitly attributed and its retained screenshots independently inspected. No blocking finding remains in this bounded candidate review. Public deployment remains a separate target-bound action; a browser click on final Confirm and visible post-submit success were not executed in this final mobile check. Historical blocked findings below are superseded by later addenda, not erased.

## Initial verdict: bounded source checks pass; full acceptance / public deployment BLOCKED

The final inspected UI uses existing canonical Party search, server offers and reservation commit helpers, visible unchecked confirmation, server arbitration, and command-bound idempotency. The independent live create/replay proof could not reach a legal commit: both currently displayed demo properties return `publication_unavailable`, zero bookable options. No reservation-create request was sent. Therefore no same-reservation replay, single occupancy claim, or fact/outbox preservation result is claimed. The required 375px complete visible browser flow was also not executed by this reviewer.

## Findings repaired during review

- Initial offer-search navigation allowed returning to/editing Stay while an older search was pending. Current source disables Back/Close/guest changes while working and invalidates stale offer generations.
- Initial key reset on identical offer reselection defeated uncertain retries. Current command fingerprint retains the key for the same operation.
- Intermediate fingerprint included optionRef, although that is absent from the commit body. Server optionRef is quoteHash, which includes bookingInstant; refreshing offers could therefore change the retry key for an unchanged command. Personally reproduced this with the actual extracted component, then personally verified the fix excludes optionRef and retains the key.
- Initial strict frontend typecheck failed on readonly Lane and possibly-undefined operating-performance summaries. Final source fixes both. Root `bun run typecheck` alone did not establish frontend strictness; the explicit frontend-project command is now independently green.

No remaining blocking defect was reproduced in the final controlled creation cases. These are not a substitute for real commit/replay or rendered mobile proof.

## Personally executed source/component proof

Runtime cwd: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

```powershell
bun test tests/yellow-native-reservation-creation.test.ts
bun D:/Yellow/temp/astra-order533-component-proof.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order533-r2-build-20260921
```

- Focused test: **2 pass, 0 fail, 23 assertions** on final bytes.
- Reviewer-owned actual-component harness: four PASS groups covering canonical Party/offer selection, unchecked consent, uncertain retry, identical offer reselection, refreshed quote reference with unchanged command, 409 discarding offers/consent while retaining guest, in-flight navigation guards, and successful result/board-refetch wiring. All HTTP/DB helpers are controlled substitutes in this component proof; no mocked call is described as an operational reservation.
- Explicit frontend strict typecheck and root typecheck: exit0/no diagnostics on final source.
- Production Vite build: exit0, 469 modules, temporary output only. Entry `index-D3x1QVdZ.js`, CSS `index-Bl6mCUnW.css`; no served artifact or container was changed.
- Session ritual `bash ./state.sh` remained unavailable because WSL has no `/bin/bash`; no full referee/standing gate is claimed.

Source inspection confirms property-local date conversion, server-only bookability, promise=false/commit-arbitration disclosure, Party ID selection, no new direct occupancy/DML path, and POST `/api/v1/reservations:commit` with Bearer session/idempotency. On409, the stay/guest survive and stale offers are removed. The existing commit remains PostgreSQL-authoritative; this UI adds no new rate/occupancy semantics. CSS includes single-column phone fields and wrapped review values, but that is not measured 375px overflow evidence.

## Independent live API attempt — blocked before mutation

Command:

```powershell
bun D:/Yellow/temp/astra-order533-api-proof.ts
$env:REVIEW_PROPERTY='01e4e102-c54f-5205-9542-d84d103084f8'
bun D:/Yellow/temp/astra-order533-api-proof.ts
```

Used the running synthetic demo app at loopback3010 (Docker app healthy). GET health200; POST automatic demo entry200; authenticated GET granted properties200; canonical Party search200 selected an existing profile without creating/changing any Party. Token remained in process memory and was not logged. The script contains no commit call while its offer prerequisite is unmet.

For both current showcase properties `6081b544-22a1-534f-a86d-bb1ae0519e14` and `01e4e102-c54f-5205-9542-d84d103084f8`, a future Sep27–28 request returned HTTP200 with:

```text
inventory_options=3; candidate_pairs=3; evaluated_pairs=0
bookable=0; publication_unavailable=1
issues=[publication_unavailable]; options=[]
```

Earlier read-only attempts at the older showcase property for Oct12–14 and Sep27–28 also returned no offers. Future dates were used to avoid current arrivals. No dates, rates, release, room inventory, or projection were changed to manufacture a bookable response. Canonical offer-service source shows a missing active rate release can yield this publication-unavailable outcome; the API explicitly distinguishes it from inventory absence.

Read-only Docker PostgreSQL checks inspected schema definitions/counts and availability coverage only, using `BEGIN READ ONLY` where querying coverage; no data was modified. One metadata query failed because extension has no `kind` column and was abandoned. No sensitive profile/contact values were emitted. Concurrent system activity means these observations are not a global before/after preservation proof.

### Remaining gate

Use a separately authorized, governed rate-publication fixture or an equivalent isolated environment with valid published offers. Then the independent reviewer must execute one distinct canonical future reservation commit and identical-key/body replay, verify same reservation/confirmation plus one reservation/segment/occupancy claim and applicable event evidence, and retain commands/results. Do not silently substitute a direct unpriced commit or raw DB insert. Complete the required 375px browser flow before release. This review approves neither deployment nor whole-PMS readiness/modification/cancellation/no-show completion.

## Final source/evidence SHA-256

| File | SHA-256 |
| --- | --- |
| frontend/yellow/src/App.tsx | 2F7921453D95C309190BD5E41189C528D445BDDDAC2BD070E34DC92A199E26C2 |
| frontend/yellow/src/styles.css | E765D6584C081BB87C748996633DB863BC0638C41B30B186A4C05125CD7ABC4E |
| tests/yellow-native-reservation-creation.test.ts | 8EFAC55DC07CEBCFF70E3515FB86CD8C99D6F88AE9D4FFB4EB9512D8D4F93080 |
| reviewer component-proof.ts | 2928017CD4469BD86976212B42CE0817A0637CEE35AB1A1117D8143EC037C234 |
| reviewer api-proof.ts | DD7FA18154357DA72E18A1F3DAB785C8372B6E9F42B7DF9B7778C45DD121B15B |

Implementation was not edited by this reviewer. Only temporary reviewer proof/build artifacts and this review record were written. The entity/PostgreSQL skills constrained the review to existing canonical services and prevented treating availability guidance or mock counters as occupancy proof.

## Post-Order534 source-binding addendum — 2026-09-21

Reviewer: independent Codex Astra agent `/root/astra_review`; not the implementer. **Bounded source/component checks remain accepted; full Order533 acceptance and deployment remain BLOCKED** on the real published-offer/create/replay/occupancy evidence and rendered mobile-flow gates above.

Personally re-inspected the current reservation creation component and visual state wiring after Order534. The inspected `yellowVisualState` derives classes from existing listening, thinking and assistant-card state; `shellClassName`, AI-mode classes and the decorative field do not themselves add a command, request, state setter or database path. The controlled creation behavior remains green. No retained pre534 whole App source exists for an exact byte diff, so this is **semantic inspection plus current-byte executable proof**, not certification that every changed App byte is limited to that wiring. Order534 aesthetics are outside this addendum.

Personally executed in the runtime source directory:

```powershell
bun test tests/yellow-native-reservation-creation.test.ts
bun D:/Yellow/temp/astra-order533-component-proof.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order533-post534-final-build-20260921
```

Results: focused test **2 pass / 0 fail / 23 assertions**; reviewer actual-component harness **four PASS groups** (including stable retry for identical commit semantics despite refreshed quote reference); frontend strict and root typechecks **exit 0, no diagnostics**; production build **exit 0, 469 modules**. Final temporary build entry is `index-B5WuVvaW.js`, CSS `index-iakjGWTg.css`. A CSS-only update was detected after the earlier temporary build, so the production build was repeated against its final hash below. No served build, app, API or database was modified or accessed in this addendum.

Final current-source SHA-256 (rechecked after build):

| File | SHA-256 |
| --- | --- |
| frontend/yellow/src/App.tsx | 1CBF0D82B29173D79DFDD704D14F305FD116F023C13AF872701AF57CE2E6DA98 |
| frontend/yellow/src/styles.css | A0F54B6291F7E33C71937989D4904152A5DC8335BAC7A2DE2BF61F95C7D21310 |
| tests/yellow-native-reservation-creation.test.ts | 8EFAC55DC07CEBCFF70E3515FB86CD8C99D6F88AE9D4FFB4EB9512D8D4F93080 |

The previously observed `publication_unavailable` prerequisite remains unresolved; this addendum makes no new live-state observation and does not replace the required independent commit/replay proof. No whole-PMS readiness or release approval is implied.

## Order535 prerequisite review — 2026-09-21

Independent review of the proposed six-price provisioner rejected its first frozen source (`0D029C5A...`) for incomplete overlap preflight, incomplete pricing equality and ambiguous price-unit wording. Actual dry preflight reported six planned/zero exact-existing rows at its queried first date; no apply was performed. See `handoff/reviews/535-public-showcase-governed-bar-prices.md` for personally executed controlled reproductions. Consequently no new Order533 live reservation create/replay or occupancy claim proof was attempted in this continuation; the prior acceptance blockers remain.

### Revised Order535 applied; Order533 still blocked

Reviewer personally accepted and executed revised535 hash `7DE95B01...` after2196 date checks and a zero-overlap tenant-scoped all-history census. Six scenario price rows now exist with exact actor-bound fact/outbox/idempotency evidence and independently verified identical-key/body replay. The single apply run nevertheless exited1 at its availability gate. Fresh Order533 API attempts for both showcase properties returned HTTP200, inventory_options3/candidate_pairs3 but evaluated_pairs0/bookable0/options0/publication_unavailable1. Current tenant reservation651/occupancy230/journal0 counts stayed unchanged through price insertion/replay.

This establishes that missing price rows were not the complete publication prerequisite. No reservation commit, reservation replay or occupancy proof was attempted without a canonical offer; no375px complete reservation flow is claimed. Source-only acceptance and the remaining live/mobile release blockers are unchanged. See revised535 review for exact personally executed commands and partial-outcome evidence.

### Order536 partial release workflow — still no published prerequisite

Independent execution of corrected Order536 created only Locanda's immutable model/target/release drafts and one pending approval before stopping at the distinct approver inbox. Read-only evidence proves the configured approver has no matching org-subtree grants for either target property. No release was activated, London history remains empty, and reservation/occupancy/journal counts remain651/230/0. Review536 records exact commands, successful draft/request replay and requester self-decision denial, partial state and remaining authorization/recovery gate. Order533 live create/replay and375px complete flow remain unproved; no reservation command was sent.

## Final live create/replay proof after governed Order537 recovery

Independent reviewer Codex Astra `/root/astra_review` personally completed Order537's exact two-row grant/replay/fingerprint proof and governed two-actor rate-release recovery; see Review537. Both showcase properties now return canonical priced offers. This supersedes the prior publication-unavailable blocker, not the earlier historical observations.

Command personally executed once:

```powershell
bun D:/Yellow/temp/astra-order533-commit-replay-proof.ts
```

Authenticated automatic demo entry, canonical Party search selecting the existing synthetic profile, and live availability:search preceded the write. Selected L1BR offer85000SAR minor units for two adults, no children; from2026-09-27T12:00:00.000Z to2026-09-28T08:00:00.000Z (property-local15:00→11:00). Offer was bookable, priced, promise=false and commit-arbitration-required. No current arrivals or price/inventory configuration were edited.

POST `/api/v1/reservations:commit` used the same actual UI command shape, Bearer session and distinct reviewer key `astra-independent-order533-future-create-20260921-6a12d781`. First HTTP201/replayed=false; exact-body/key retry HTTP201/replayed=true and byte-equivalent parsed complete response.

- Reservation: `5c9c905f-5699-4573-b709-1512dd0e9d53`.
- Confirmation: `Y-5C9C905F56994573B7091512DD0E9D53`.
- Segment: `684ad0b6-c76f-48c0-a1de-220cd0788392`.
- Read-only tenant-scoped PostgreSQL evidence: exactly1 reservation with correct property/Party/reserved status;1 correctly bound segment and exact period;1 primary guest;1 segment occupancy row with exact period;1 reservation.confirmed fact and1 outbox matching current session actor/property;1 completed matching-key reservation.commit idempotency record.
- Tenant counts before→after both requests: reservations651→652; segments651→652; occupancy230→231; journals0→0. The retry did not create a second reservation, segment or occupancy claim. This is the material authorized synthetic reservation addition; it was not cancelled or deleted afterwards.

**Verdict: source/control and independent live commit/replay gates pass; final UI/mobile release acceptance remains BLOCKED.** The375px complete visible flow has not run. Reviewer read the browser skill and its core workflow; it reports no configured browsers/no API key. Independent CUA `getState()` returned apps[]/browsers[]. No browser provisioning was silently performed, and no screenshot/layout/mobile outcome is claimed. No frontend deployment or whole-PMS readiness is approved by this proof.

## Final mobile repair / source-binding review

Reviewer: Codex Astra `/root/astra_review`, independent non-implementer. No implementation, deployment, API or DB mutation was performed in this final review turn.

Inspected mobile rule `@media (max-width: 760px) .reservation-create-next`: padding is now `14px 14px calc(104px + env(safe-area-inset-bottom))`. This adds scrollable space beneath the creation card's final controls while preserving inline padding, width containment and desktop styling. It leaves the fixed navigation, pointer routing, checkbox, idempotency and all commit behavior unchanged. The App source hash is identical to the previously reviewed1CBF... bytes; the patch is CSS-only at runtime.

Personally executed in runtime cwd:

```powershell
bun test tests/yellow-native-reservation-creation.test.ts tests/yellow-stateful-neon-bloom.test.ts tests/yellow-next-public-surface.test.ts tests/yellow-voice-routing.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bun D:/Yellow/temp/astra-order533-component-proof.ts
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order533-534-final-mobile-build-20260921
```

Final combined suite **34pass/0fail/225assertions**. Isolated533/534 tests4pass/0fail/43assertions. Strict frontend/root TypeScript each exit0; actual-component harness four PASS groups; production build exit0/469modules, isolated entry `index-CXK5UbRY.js` and CSS `index-Dmh56QZw.css`. Initial expanded run found one stale voice-source oracle expecting the pre534 shell-class string (33pass/1fail/222assertions). Implementer repaired only that assertion to require runtime-state interpolation while retaining seven shared shells/no hard-coded shell; reviewer inspected and reran the complete suite green. Runtime App/CSS did not change during that test-only repair.

### Browser evidence attribution and boundary

Root personally used Selenium/Chrome CDP `Emulation.setDeviceMetricsOverride`375×812/mobile=true against isolated candidate loopback3011. Reported current output: innerWidth/clientWidth/scrollWidth375/375/375, creation card x22/width331/right353; post-repair Continue top639/bottom684 native click succeeds; Stay→Guest canonical search→live Offer→Review succeeds without submitting. Checked final Confirm is enabled, scrolls to top498/bottom566, and elementFromPoint hits the button. No final commit click occurred.

Reviewer independently opened the retained step1, ready-confirm and neon screenshots; the ready-confirm button is visibly above the fixed navigation, with readable wrapped content. This is inspection of root's artifacts, **not a claim that this reviewer independently drove the browser**. Inline browser script was not retained. Files:

- `D:/Yellow/temp/order533-create-step1-375.png` SHA256 B6BC8F47A118E60E70DFC73690A78A5A20B3AADE8ECE562CB365444A83D661A4.
- `D:/Yellow/temp/order533-create-step2-375.png` and `order533-create-step4-375.png` retained by root; not individually inspected in this final review.
- `D:/Yellow/temp/order533-create-step4-ready-375.png` SHA256 ED260C0C217A0162678728A82164790AEF872F4E86A598CF87EEADD7BA9DBBB7.

Combined with the independent real reservation create/replay proof and actual-component success/refresh checks above, this clears the bounded candidate's prior publication and mobile action-interception blockers. It is not a claim of one reviewer-driven full browser transaction through the post-submit result screen, whole-PMS readiness, or public deployment.

### Final source SHA-256

| File | SHA-256 |
| --- | --- |
| frontend/yellow/src/App.tsx | 1CBF0D82B29173D79DFDD704D14F305FD116F023C13AF872701AF57CE2E6DA98 |
| frontend/yellow/src/styles.css | FC1C78A0B4D7E319FBE208154FFB6078234C7A0FA891F292180D7A7341704D30 |
| tests/yellow-native-reservation-creation.test.ts | 8EFAC55DC07CEBCFF70E3515FB86CD8C99D6F88AE9D4FFB4EB9512D8D4F93080 |
| tests/yellow-stateful-neon-bloom.test.ts | 23494DBDBF9BBBC1DE3CDC56F68E440FEA9E0EE08C1F5271D8BE518760844C48 |
| tests/yellow-voice-routing.test.ts | 00966BCEE1EA71F48E4F5D20D0AB74082C2FD47F6384DB962EB4236F69400B49 |
