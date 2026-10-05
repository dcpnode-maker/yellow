# Order468 — Preview and print existing immutable full credit notes

Status: source independently accepted, 2026-09-13; Q261 publication preparing.
Phase7, functional build continuation.
Owner: Codex root. This is a new successor to466, whose summary-only scope remains
historical. No Phase11 implementation is admitted: its prerequisite gates remain.

## Outcome and authority

Complete the founder's built-feature staff journey using the already authorized
GET /api/v1/properties/:property/credit-notes/:credit/document and /delivery.
Orders449/452 already authenticate immutable issued content, tenant/property/actor,
original reference and delivery. Q187's full-credit policy remains unchanged.
Add deliberate Preview credit note / Print credit note after466 discovery.
No new economic decision, issuance, money sign conversion or provider action.

## Exact scope and ownership

- Renderer builder q258_runtime_cutover: src/http/operator/invoice-print.js and
  new tests/operator-credit-note-print.test.ts.
- Workbench builder order467_status: src/http/operator/invoices.js and
  new tests/operator-credit-note-print-workflow.test.ts.
- Separate browser-proof worker q258_source_adapter:
  new tests/operator-credit-note-print.browser.test.ts only.
- Root: this order, handoff/reviews/468-credit-note-preview-and-print.md,
  docs/CONTRACTS.md, docs/PROJECT-STATUS.md, DECISIONS.log, handoff/LEDGER.md,
  metadata-only ignored .yellow/evidence/order468.
- Existing invoice/466 tests and backend credit-read tests may run unchanged.

No other source, asset, API/router, CSS/theme, SQL/schema/permissions, dependencies,
runtime, data or Git index/ref changes. Preserve paused445 and unrelated work.
No local DB, WSL/Docker/state scripts, new checkout, provider, purchase or main merge.
Publication and runtime promotion need separate exact-source scoped continuations.

## Contract

Export buildCreditNotePrintArtifact(documentValue, deliveryValue, originalDocumentValue)
from the existing inert print module, returning its established frozen ok/error
artifact union. Preserve buildInvoicePrintArtifact's exact accepted shapes and
output. Reuse private item/decimal/totals/escaping/delivery/QR/print-style machinery;
do not make credit documents masquerade as invoices or relax INV validation.

Require the exact three-key india_native_credit_note_v1 envelope, full valid
immutable receipt, strict nine-key CRN source (including RefDtls and YellowCredit),
canonical dates/timestamps/UUIDs/hashes, bounded source bytes/items and intact
int64 item/tax/total equality. Bind receipt to the independently valid original
invoice's identity/property/reservation/folio/recipient and original number/hash.
Bind every YellowCredit lineage field/reason and preceding invoice number/date.
Bind receipt totalMinor to the source's exact stored decimal total. Do not infer
refund/payment, reverse printed signs, calculate new economics or trust a model.
Server owns cryptographic source/signature authentication; client validates exact
structure and cross-identity and must not claim independent authentication.

Render Credit note, CRN number/date, original invoice number/date, immutable reason,
seller/buyer, original persisted line/tax totals and credit total (INR), source
identity and honest registration status. Reuse unmodified accepted QR rules;
never invent IRN, label sandbox as production or show provider secrets.
Escape all display text. No exported/imported module performs I/O on import.

Workbench refreshes the credit document on every deliberate preview/print, checks
against current discovered credit and original identity, then refreshes delivery.
No complete document is fetched on initial discovery. Reuse existing request,
iframe and preview helpers with document-appropriate accessible labels/mobile
copy. Preserve invoice behavior. Disable concurrent actions; stale/aborted/hidden/
disposed/property-switched/navigation responses cannot render, fetch follow-ups
or open a print dialog, including after the asynchronous iframe frame boundary.
Denied/malformed/unavailable data blocks printing with a clear local status,
not a fabricated unregistered document. Summary can remain after print failure.
Only the two existing credit GETs are added on deliberate actions; zero mutations,
provider actions, stored PII, secrets, URL data or background polling.

## Executable acceptance

Capture a genuine missing-export/control RED before implementation. Pure proof
uses actual backend-compatible fixtures and actual production exports; hostile
shape/accessors/Unicode/date/int64/reference/total/delivery/QR cases fail closed.
Separate real Chromium proof uses synthetic responses and existing owned-browser
harness only: lazy preview, repeated fresh fetch, print intent, stale lifecycle,
permission/failure states, hostile text, GET-only/no mutations, invoice regression.
Keep prior466/browser/invoice/print tests green. Root does not implement production;
personally inspect both diffs and execute all relevant proof, strict TypeScript,
import boundaries and scoped diff checks. DB-gated skips are labelled, not approval.
Backend endpoints/storage are unchanged, so do not manufacture a new DB obligation
or use private hotel data for this browser-only change. No phase-complete claim.

## Product source acceptance

Nonimplementing root personally inspected the final product/test changes and ran
the broad12-file110pass/3explicitDBskips/0fail10259 proof and final5-file28pass/
0fail508, including real Chromium desktop/mobile and controlled functional print
scheduling. Root/browser findings and earlier failures are preserved in Review468.
No amount/original/provider/DB/runtime change. Q261 separately admits coherent
current-status reconciliation and exact20-path publication. The five status paths
are now aligned and root verified8pass/2DBskips/0fail234 plus focused1/0(64),
strict types and198 boundaries. Exact selective publication/CI/delivery remain
separate; no completed-phase or current-live468 claim.
