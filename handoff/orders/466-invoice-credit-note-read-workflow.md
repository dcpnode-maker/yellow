# Order466 — Read existing full credit notes from the invoice workbench

**Status:** SOURCE ACCEPTED and selectively PUBLISHED as41415cc5 under Q257,
2026-09-13. Exact CI34725373251 is green at the published head. Subsequently
verified live under Q258r2 at04:19:14UTC on3000/frontier91; not main-merged.
**Phase:**7. **Owner:** Codex coordinator. **Risk:** read-only fiscal presentation;
independent nonimplementer proof before acceptance. Continue on the existing
phase-7/operator-invoice-workflow worktree; no new checkout or staged-work reset.

## Outcome and existing authority

Expose already-built Orders446/448/452 reads to staff from their original issued
invoice. This is functional workflow completion under the founder's existing
request to expose built features, not a UI redesign. Q187/D1302 immutable full-credit
policy is unchanged; Q253 debit economics, partial credits, refunds, issuance and
provider actions remain outside scope. The initial implementation did not alter
the then-serving46004/frontier91 runtime; later delivery is separate Q258 work.

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

Q257 publication completed:41415cc5c6953f71d9b3baada6fd9c7853567128, exact
parent46004 and ten reviewed paths/blobs verified, non-force push to draftPR92.
Original working bytes back-project exactly except the admitted Q257 clarification;
outside staged entries and unrelated refs remain unchanged. Initial flag-digest
discrepancy is not explained; current independently inspected receiving flags are
fully recorded and preserved across commit. Exact CI34725373251 completed green
at the published head, not replaced with parent CI. Root independently retrieved
the run with native GitHub CLI:
`& 'C:\Program Files\GitHub CLI\gh.exe' run view 34725373251 --repo dcpnode-maker/yellow --json databaseId,headSha,status,conclusion,createdAt,updatedAt,jobs,url`.
All six jobs passed: quality103638457873, windows-state103638457947,
local-review103638457950, database103638722985, free-host-arm64103638722987,
and container-smoke103638722996. Root retrieved the exact database log with
`& 'C:\Program Files\GitHub CLI\gh.exe' run view --job 103638722985 --repo dcpnode-maker/yellow --log`; its
canonical terminal result is `RESULT: 11 passed, 0 failed of 11` at
2026-09-12T23:54:19.5097303Z (job completed2026-09-12T23:54:29Z).
This CI evidence does not change the prior local proof's explicit nine database
skips. At this historical post-reboot checkpoint (2026-09-13 05:02 local), all prior
app/PG processes and listeners on3000/3001/55503 were absent and466 was not live.

## Later verified local delivery — Q258r2

At2026-09-13T04:19:14.2088495Z, the separately admitted Q258r2 promotion
served immutable41415/frontier91 on the single127.0.0.1:3000, retaining the saved
login and existing PostgreSQL55503. Root checked the actual source/asset hashes,
native process identities, readiness, authenticated read journey and no3001
listener. Promotion receipt SHA256:
c64e87d70bd5f4bdeaed5ac57fa140dd813a8dc13905fbbe7ddfce680843ee8c.
Full failure/recovery history and boundaries are in Order460/Review460/Q258.
No provider activation, main merge or phase closure follows from this delivery.
