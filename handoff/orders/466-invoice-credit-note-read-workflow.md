# Order466 — Read existing full credit notes from the invoice workbench

**Status:** SOURCE ACCEPTED after independent root proof, 2026-09-13.
Not yet published or live; successor publication/promotion are separately scoped.
**Phase:**7. **Owner:** Codex coordinator. **Risk:** read-only fiscal presentation;
independent nonimplementer proof before acceptance. Continue on the existing
phase-7/operator-invoice-workflow worktree; no new checkout or staged-work reset.

## Outcome and existing authority

Expose already-built Orders446/448/452 reads to staff from their original issued
invoice. This is functional workflow completion under the founder's existing
request to expose built features, not a UI redesign. Q187/D1302 immutable full-credit
policy is unchanged; Q253 debit economics, partial credits, refunds, issuance and
provider actions remain outside scope. Source46004/frontier91 stays live throughout.

The displayed invoice can lazily reveal its at-most-one existing full credit using
GET /api/v1/properties/:property/invoices/:original/credit-notes, then GET
/api/v1/properties/:property/credit-notes/:credit/delivery. Display the immutable
receipt identity, original reference, date, exact credited total and reason, with
audit metadata and honest read-only registration state. Do not fetch complete fiscal
content or add another list/API when this bounded receipt view suffices.

## Exact scope and ownership

- Builder: src/http/operator/invoices.js only; reuse existing workbench DOM classes,
  requests, generation/AbortController guards and shared fiscal receipt validation.
- Q256 facade builder: src/http/operator/invoice-print.js, only one inert exported
  fiscalDeliveryRegistrationStatus(identity,deliveryValue) returning frozen
  {code,label}/null through unchanged private validators/status functions.
- Builder: tests/operator-invoice-credit-note.test.ts, pure hostile receipt and
  delivery boundary tests using actual production exports, not copied validators.
- Q256 facade builder: tests/operator-invoice-credit-note-parity.test.ts, broader
  actual backend discovery-versus-browser receipt parity and shared-facade cases.
- Separate browser-proof worker: tests/operator-invoice-credit-note.browser.test.ts.
  Reuse existing owned-process/browser-test primitives; no new testing dependency.
- Coordinator: this order, handoff/reviews/466-invoice-credit-note-read-workflow.md,
  handoff/questions/256-credit-delivery-browser-validator-reuse.md,
  docs/CONTRACTS.md, docs/PROJECT-STATUS.md, handoff/LEDGER.md, DECISIONS.log,
  metadata-only source proof notes under .yellow/evidence/order466/.
- Existing tests/operator-invoices.browser.test.ts and
  tests/operator-invoices.integration.test.ts may be executed unchanged, not edited.

No CSS, app.ts/router, changes to existing shared financial validators, SQL/migration, role/grant, financial
command, numbering, provider, print renderer, seed/data or dependency change.
Paused445 and all unrelated working/index content must be preserved. Needed extra
paths require a recorded scope question before editing. No publication, retained app
restart/promotion, current credentials or production/private database action here.

## Required behavior

1. Add an accessible progressive disclosure labelled Existing credit note with a
   View credit note button inside existing invoice detail. No extra API request
   before deliberate disclosure; no new page/theme/global navigation.
2. Validate exact durable receipt shape from the existing server contract. Bind it
   to current property, original document ID/number/hash, reservation and folio,
   recipient and supported currency; validate finite dates/timestamps, UUIDs/hashes,
   positive signed-int64 minor total and bounded text without invoking accessors.
   Preserve Unicode reason as text, never HTML. Do not recompute tax or mutate content.
3. Only request delivery after valid original-linked receipt. Validate exact delivery
   union and matching credit document ID through Q256's new inert facade over the
   already-served print module's unchanged structural validator. This revalidates
   server-authorized metadata, not browser signatures; only its code/label is shown.
   Never interpret requested/pending/ambiguous/legacy or sandbox as production registered.
   Do not reveal signed payloads, secrets, provider configuration or retry controls.
4. On discovery404 say No credit note available to view, not a universal assertion
   that a concealed document does not exist. Denied403, unavailable503/network,
   malformed data and loading have distinct honest local status. Delivery denial or
   failure keeps the independently valid immutable credit summary while clearly
   saying registration is unavailable. No financial or provider action is enabled.
5. Avoid duplicate concurrent requests; disable/re-enable the read button correctly.
   Stale, aborted, hidden, disposed, navigated or property-changed responses cannot
   render or initiate follow-up requests. Current invoice search/detail/issue/print,
   focus and screen-reader behavior stay intact. No PII in URL/history/storage/logs.
6. This view performs only the two named GET routes. No credit issuance, provider
   selection/retry/submit, receipt polling, full credit print or generic editor.

## Executable proof and action boundary

Preserve an intentional missing-behavior RED before production implementation.
Pure proof covers genuine backend-compatible receipt, all identity/shape/type/date/
money boundaries, hostile accessors and exact delivery states. Real Chromium
synthetic-source browser proof covers lazy success, inaccessible/empty/denied/error,
no duplicate reads, hostile text escaping, stale navigation/property disposal and
delivery failure without erasing document data. Assert zero mutations and no other
credit/provider route. Existing invoice browser/HTTP/print tests must remain green.
Use bounded port0 loopback synthetic harnesses and owned disposable profiles only,
without credentials or the retained app/database; cleanup exact owned temp paths.
Typecheck/import boundaries and scoped diff hygiene must pass.

Root implements neither production nor its tests and personally reviews/executes the
relevant proof. No new real-DB proof is invented for unchanged API/storage behavior;
existing independently executed backend evidence remains predecessor proof. New
source publication, exact-head CI and live promotion are separate scoped work.

## Completion checkpoint

All five source/test files are frozen at the hashes in Review466. Nonimplementing
root personally executed the combined ten-file proof:79pass/9explicit DB skips/
0fail,1394 assertions, including actual Chromium; strict types,198 boundaries and
scoped diff hygiene pass. Existing print source back-projects byte-for-byte after
removing only the new inert facade. Detailed failures, limits and commands:
handoff/reviews/466-invoice-credit-note-read-workflow.md.
No database, provider or local runtime action occurred in the implementation.

## Separately admitted source-publication continuation — Q257

Root admits handoff/questions/257-order466-selective-source-publication.md and its
exact ten-path native Git successor procedure. This is a documented scope extension
before publication, not a silent widening of the implementation. Existing mixed
governance/index/paused445 bytes are preserved; independent product hashes remain
frozen. Source publication, exact-head CI, main merge and any later local promotion
remain separate states. Q257 admits the first two only, never own merge/runtime.
