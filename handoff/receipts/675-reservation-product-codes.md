# Order675 — Stored reservation product codes

Delivered 24 September 2026 to the existing single review app. This is a bounded ecosystem increment, not whole-ecosystem completion.

## Implementation
- Backend selected-segment same-property joins now return unitTypeCode/ratePlanCode alongside names in the existing board query; HTTP serializer explicitly includes both. No extra query, schema, booking mutation or guessed fallback.
- Rate code is a default movement-table column. Room type code is selectable under Columns. Both support table search, header filters and multi-level sorting; labels remain distinct. Applies to shared Arrivals, Departures, In-house and reservation-board adapters.
- Preserved failed-reference behavior: missing/foreign product references reject the board read instead of leaking codes or silently presenting substitutes.
- Admission Q675-http-code-projection covers exactly two HTTP serializer fields; Q675-regression-proof-scope covers superseded pre-674 source-marker tests. No silent scope growth.

## Verification
Root final regression: 47 passed, 0 failed, 492 assertions across order674-shell/table-query/search-context/movement, order675-movement-codes/http-codes, yellow-today-workspace, yellow-reservation-board-pages/attribute-performance. Exact-ID, stable ordering and 500ms budget retained for 10,000 synthetic rows; case wall time35.92ms on this run, not an end-to-end latency SLA.

Strict root/frontend typecheck passes. Boundaries206 pass. Vite501 modules pass; index-C8pRB8Xl.js and unchanged index-DVgoUJTo.css. Scoped whitespace checks pass.

Independent non-implementer /root/order675_independent_review (GPT-6 Sol) personally provisioned a fresh temporary PG18 container, distinct roles, verified empty unique DB, applied100 migrations and ran the board database/tenant suite: 10/0/121, zero skips. It did not modify the public or existing development databases. Temporary proof container removed. Reviewer also personally ran focused UI tests/types/boundaries and the two actual HTTP serializer/authorization tests. The later combined HTTP rerun skipped DB after container cleanup; that skip is not substituted for the earlier executable proof. Review: D:/Yellow/git-live-order611-source-v2/handoff/reviews/675-independent-review.md.

Discovery/backend implementation was delegated to GPT-6 Sol /root/reservation_product_discovery; root implemented/integrated UI and HTTP. No claim of local-model execution, free quota, active-model switching or zero Codex consumption.

## Single-app release and rollback
Verified serving board.ts equals source HEAD before675. Verified serving operator.ts equals pre675 source (391657 normalized characters); removing exactly the two new serializer lines from candidate reproduces the serving file. This matters because the source tree has unrelated prior edits.

Candidate derives from deployed674 image and copies only built frontend assets, board.ts, operator.ts. No whole dirty backend rebuild. Prior image retained: yellow-public-demo-app:before-order675, sha256:1fd42b27a901615d45fc06cf3698f959a305ddf96125073119d109167e87aa19.

New image: yellow-public-demo-app:order675-codes / latest, sha256:b45084b99ed32becfa033005cceda721a42f9f885faa62fdd93a147f01cda589. Existing Compose project replaced only app with --no-deps --no-build. PostgreSQL/Valkey/tunnel were not restarted. Health200; container healthy. Public HTML200 has current JS bundle.

URL: https://lying-jones-terminal-church.trycloudflare.com/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today?lane=due_in

Rollback uses the retained before-order675 image as latest and the same existing Compose app-only command. No database rollback is needed: no migration/data write occurred. No git commit, push or PR was made from the unrelated dirty integration tree. Fresh full repository/referee acceptance is not claimed.

## Browser proof and fidelity
Existing in-app browser, actual public review app:
- API200: due_in11, due_out11, in_house3, first all-state page100; stored room codes L1BR/L2BR and rate code BAR observed directly in network response, without outputting tokens/guest payloads.
- Desktop Rate code shows BAR, distinct from Best Available Rate; optional Room type code shows L1BR/L2BR.
- Header exact filter NO-SUCH-RATE gives0/11, clearing restores11. L2BR search gives6/11. Room-code descending sort becomes priority3. Reset works.
- Mobile375×812: L1BR search gives5/11, new rate-code column remains accessible by horizontal table scroll, filter menu opens and Escape dismisses. In-house3/3 withBAR then Arrivals11/11. No relevant console warnings/errors. Viewport override reset.
- Outer containment: desktop client/scroll width1657/1657 at1672viewport; mobile360/360 at375viewport. Scrolling is inside the table. Table top327.7px at desktop matches prior accepted implementation.
- Viewed approved concept and current saved desktop/mobile renders in the same review pass. Landmarks preserved: yellow identity/neutral shell; Operate/Business/System sidebar; gray capsule with white active pill; compact shared toolbar; dense horizontally scrolling data table. Actual property/product names and code values replace illustrative data. Existing54px row height and real counts remain; no claim of pixel-exact concept or full mobile editing acceptance.

Screenshots: C:/Users/astha/AppData/Local/Temp/yellow-order675-desktop.png and yellow-order675-mobile.png. Temporary deployment Dockerfile removed after verification. One live application remains.

## Next dependency work — no founder input needed to start
1. Preserve requested room type (Deluxe/etc) versus room class (King/Twin/etc) as independently configurable relationships; audit current taxonomy restrictions and expose authorized mapping evidence without confusing current assignment with booked product.
2. Persist/retrieve booked meal/package lineage from immutable accepted quote/release evidence, not today's rate configuration; classify historical missing evidence explicitly. Requires its own scoped order and independently executed write-path proof.
3. Finish the guest/staff vertical journey through arrival readiness, editable sharers/profile, folio split/routing/payment/checkout and linked tasks using existing commands; do not mark done merely because a screen exists.
4. Continue distribution/direct booking, website/POS, market/RMS and portfolio work through the existing roadmap. External credentials/provider approvals or genuine legal/business choices are escalated only when reached.

Existing material is preserved; no fresh Yellow version, language rewrite, paid provider call or new infrastructure service was introduced. The tunnel remains temporary, not a permanent domain.
