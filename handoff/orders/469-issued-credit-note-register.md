# Order469 — Cashier issued-credit-note register

Status: source independently accepted, 2026-09-13. Phase7.
Authority: founder's build-first continuation; accepted Order450 read-only list,
Order466 original-linked discovery and Order468 immutable preview/print.
Q253 debit economic-source policy remains open and outside this order.

## Outcome and exact scope

Add a deliberate Credit notes view within the existing issued-invoice workbench.
Use the already published GET /api/v1/properties/:property/credit-notes.
Staff can search an exact credit number and business-date range, page results,
and select Review original invoice to navigate using the existing navigate callback
with originalDocumentId. Existing466/468 discovery/preview/print remains the only
full-document route. No direct print from a nine-field list summary.

Initial source builder /root/order467_status owns only until its frozen14f7c7b6
checkpoint; continuation ownership now transfers to /root/q258_runtime_cutover
for the same two files after root's remaining executable findings:
- src/http/operator/invoices.js
- new tests/operator-credit-note-register.test.ts

Independent browser-proof builder /root/q258_source_adapter owns only:
- new tests/operator-credit-note-register.browser.test.ts

Root owns this order, handoff/reviews/469-issued-credit-note-register.md,
docs/CONTRACTS.md, docs/PROJECT-STATUS.md, DECISIONS.log, handoff/LEDGER.md,
and metadata-only ignored .yellow/evidence/order469.
Existing invoice/466/468/backend450 tests may run unchanged.
No other file edit; ask a scoped question before expanding.

Do not add a new page route/module/asset map: those root assets overlap paused445.
A contained workbench subview keeps the existing grouped Finance navigation and
uses existing classes and controller lifecycle without modifying paused work.
Do not refactor unrelated invoice/provider/issuance behavior or redesign themes.
No API, SQL, schema, authority, dependency, WSL/Docker/state-script, new checkout,
runtime, Git mutation/publication or cleanup. Root separately controls release.

## Read contract and bounded UX

Show a keyboard-accessible Credit notes button and return-to-Invoices action;
no credit request on initial invoice mount. Keep original invoice default unchanged.
Use separate exact document-number input (1–16 ASCII letters/digits/slash/hyphen);
do not apply invoice buyer/GSTIN fuzzy search semantics to credits.
Dates use existing property-timezone defaults: today minus30 through tomorrow,
canonical inclusive/exclusive interval1–366days. Explicitly label issuedBefore
as exclusive. This is a31-calendar-day default, not a claimed30-day interval.

GET required issuedFrom/issuedBefore; optional docNo and exact opaque after,
limit25. Never add tenant/actor/filter aliases, body, mutation or provider request.
Snapshot the submitted date/docNo filters before awaiting. Draft edits invalidate
pending responses and pagination; a fresh search starts over without an old cursor.
Bound retained items (reuse existing bound if suitable), one page request at a
time, no polling, no total-count query and no per-row full-document fetch.

Validate exact {items,nextCursor}; each of at most25 summaries has exactly
documentId, originalDocumentId, docNo, originalDocNo, businessDate, propertyNode,
currency, totalMinor, sha256. Enforce canonical backend UUIDs, different original
and credit IDs, exact property, number grammar, in-range canonical date,
INR, positive int64 minor-unit decimal string and lowercase64-hex hash.
Reject unexpected fields/accessors/hostile shapes, duplicate or out-of-order
same-page IDs/date positions. Treat nonnull cursor as opaque <=1024 base64url,
never decode/create authority or reuse another filter's cursor. Reject repeated
pagination cursor/nonadvancing next page; bound memory and requests.
Show exact bigint money, credit/original numbers and date; no guessed buyer,
reason, registration/refund/payment state or total matching count.
Render all values through textContent/known-safe DOM, no source HTML/storage.

Empty200,403permission,400invalid filter/cursor,404/unavailable,503/offline and
malformed payload must remain distinct honest states. No failed/denied request
may silently appear as empty or keep actionable stale rows. Retain no private
record in local/session storage or URLs. Existing request owner supplies identity.

Same controller suspend/dispose/property recreation/route change/issue view,
mode switch and filter change must abort and generation-invalidate register work.
Late responses cannot render or navigate. Returning/show(originalDocumentId)
closes credit view and keeps existing original/invoice print behavior unchanged.
A register row only navigates originalDocumentId after active/current checks;
it never fetches credit document/delivery or prints automatically.
Respect desktop and390px mobile without a new CSS skin or overlap.

## Executable acceptance

Capture genuine missing-export/control RED before implementation.
Export an inert strict list parser/query snapshot helper only if needed for
actual-production pure proof, not duplicate test-only implementation.
Builder tests cover all shapes/identity/date/amount/order/query boundaries.
Separate real Chromium synthetic proof covers deliberate GET, exact filters,
paging/reset, fresh requests, hostile text, empty/denied/offline/malformed,
mode/property/suspend/dispose/draft-edit stale containment, original navigation,
mobile and no automatic full-document/delivery/print calls.
Root does not implement production and personally inspects and executes relevant
proof plus unchanged invoice/466/468 tests, strict types,198 boundaries/diff.
Unchanged450 backend tests may be run with explicit real-DB skips labelled.
No new DB or real hotel fixture is necessary for this browser-only consumer.
Source acceptance, publication, exact-head CI and current local delivery remain
separate; no Phase7 completion or provider/client-data availability claim.

## Accepted source checkpoint

Nonimplementing root personally inspected finalc62442ef source and both test files,
then executed33pass/0fail611assertions across seven files, including actual desktop
and390px register/old-invoice/466/468 proof. Strict types,198boundaries, scoped diff
and before/after hashes pass. Separate browser owner executed final1/0(54) twice.
Review469 retains initial broken source, incomplete repairs and genuine final
keyboard/detached-submit REDs. No broken checkpoint was published or served.
Q262 admits current snapshot and exact15-path release after source/status proof;
publication/exact-head CI/local delivery remain pending. Local41415 unchanged.
