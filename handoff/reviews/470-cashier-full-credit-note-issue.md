# Order470 — Cashier full-credit issuance proof

Status: product source accepted by nonimplementing root, 13 September 2026.
Routine snapshot/type alignment and selective publication remain pending. Not live.

Production author: /root/q258_runtime_cutover (Terra).
Initial Chromium proof author: /root/q258_source_adapter (Terra).
Final Chromium proof author: /root; no production implementation by root.
Nonimplementing source reviewer and executable-proof owner: /root.

The order exposes the already accepted Order446 full-credit command. It does not
change economic policy, journals, numbering, tenant authority, schemas, providers,
or the stable local. The original invoice remains immutable; no refund is implied.

## Retained initial evidence

The browser author captured a real missing-control RED against the accepted
Order469 invoices.js SHA-256
`c62442ef063092240d2073a9d9cd17f6e363bfb9f2c0a778a0399f27fa9e7904`:
0 passed, 1 failed, 2 assertions. No deliberate issuance control existed.

The builder supplied initial implementation SHA-256
`43205009706a561c893e4e2cbdef356d6ca18b48b9ec4f7f6df61d00cd0bddc7`.
Its reported tests are builder evidence, not substituted for root execution.
The first expanded browser attempt failed before obtaining a POST record; its
fixture/control flow is being investigated, not labelled a product pass.

## Initial root inspection — changes requested

Root inspected the complete production diff and the new pure test. The extracted
reason validator retains the existing server's exact Unicode scalar/control rules.
The command uses only the immutable reason and a generated request key, while the
server still chooses monetary, series, date and permission authority. Submitted
intents are retained in bounded controller memory and are not persisted in storage.

Root identified three control-lifecycle concerns for executable reproduction:

- The initial current-view predicate checked the surrounding surface but not the
  submit element's connected/contained/hidden/disabled state. A detached retained
  control must not be able to issue a financial command.
- A successful intent and hidden submit handler require explicit terminal guards;
  success must not enable an accidental replay event.
- Reopening the confirmation during an in-flight request can detach the first
  surface and leave the replacement retry control disabled after completion.

The builder repaired these inspection findings before the expanded browser proof
finished. They are not recorded as pre-repair executable REDs. Root has not modified
production or counted unexecuted cases as proof.

## Intermediate root execution — not final acceptance

Root inspected the repair at invoices.js SHA-256
`539b3b02857922767b8481b8cdcf156855756c9254d97c215fa34bd731a0a9e5`.
Connected/contained/current controls and terminal-success checks now guard sending.
The in-flight branch offers no second request control. Further actual browser
coverage is still required, including reopening and late-response behavior.

Root personally executed the following four existing/new pure test files:

    bun test tests/operator-full-credit-note-issue.test.ts tests/operator-credit-note-register.test.ts tests/operator-credit-note-print.test.ts tests/operator-credit-note-print-workflow.test.ts

Result: 21 passed, 0 failed, 173 assertions, 120 ms. Source SHA-256 above was
unchanged before and after. An initial command also named a nonexistent
operator-fiscal-credit-note-http.test.ts; Bun ignored it, and it supplied no proof.
Root located and executed the actual signed-session composition files separately:

    bun test tests/operator-fiscal-credit-note.integration.test.ts tests/operator-fiscal-credit-note-list.integration.test.ts tests/operator-invoice-credit-note.test.ts tests/operator-invoice-credit-note-parity.test.ts

Result: 27 passed, 6 explicit real-database-gated skips, 0 failed, 457 assertions,
2.27 seconds. Middleware authentication, exact reason/input, same-key 200/201 body,
concealed errors and original-linked discovery compose correctly in these tests.
The skipped PostgreSQL cases are not executed database proof. The published
Order469 CI34741807806 separately includes the existing Order446 database gate;
it is still running and does not accept this uncommitted Order470 source.

## Final independent product proof

Root took ownership of the incomplete browser test, preserving the actual initial
missing-button RED and the distinction between inspected and executed findings.
The fixture problem was counting the existing invoice-search POST as financial
issuance. Root's first rewritten harness also exposed this mistake (0/1,1 assertion,
headers of the search request were null). The corrected financial counter matches
only POST /invoices/:original/credit-notes. It does not remove any product assertion
or alter production; invoice search remains exercised as an existing read journey.

The final test uses one isolated, owned Chromium/CDP process with actual1280px and
390px device metrics, existing production CSS, bounded commands and contained
profile cleanup. Both complete workflows pass. No user browser or real hotel data
is involved. Root authored this executable proof but did not implement product.

Root personally ran:

    bun test tests/operator-full-credit-note-issue.test.ts tests/operator-full-credit-note-issue.browser.test.ts tests/operator-credit-note-register.test.ts tests/operator-credit-note-register.browser.test.ts tests/operator-credit-note-print.test.ts tests/operator-credit-note-print-workflow.test.ts tests/operator-credit-note-print.browser.test.ts tests/operator-fiscal-credit-note.integration.test.ts tests/operator-fiscal-credit-note-list.integration.test.ts tests/operator-invoice-credit-note.test.ts tests/operator-invoice-credit-note-parity.test.ts tests/operator-invoice-credit-note.browser.test.ts tests/operator-invoice-print.test.ts

Result: **64 passed, 6 explicit real-database skips, 0 failed, 1211 assertions**,
13 files,11.96seconds. The standalone new browser run passed1/0(114),2.24seconds.
Exact before/after SHA-256 values matched:

- invoices.js: `539b3b02857922767b8481b8cdcf156855756c9254d97c215fa34bd731a0a9e5`
- new pure test: `3bd8317296067aeae50e305d7f326656e6ff199ea6f9c733dc36ed4122c80f88`
- final browser test: `01cbff2f622a86aee5f0182f6b81258599b925d495888a876fabfa08a41eaf8e`

The proof covers explicit confirmation/cancel, stored original number/date/total,
exact reason and command path/body/key, no invented replay header, immutable retry
through original navigation and attempted reason alteration, unknown then400/403/
404/409 followed by same-key replay, invalid reason/original/extra-field receipts,
explicit discovery of a different reason without resolving the intent,500-scalar
boundaries, hostile text, accessible labels/focus, no mobile overflow, individually
hidden/detached submit, suspend/dispose/original changes, duplicate and terminal
clicks, safe in-flight reopening, and no late cross-property paint or follow-up.
No provider/refund/automatic print, storage or secret-bearing URL was introduced.

Root's strict typecheck passed before the concurrent Q263 tests-first metadata
edit. The combined run then reported only expected470-vs-current469 inferred-union
errors in those four status tests;198 import boundaries pass. Q263 must align the
snapshot and rerun strict types before publication. This is not recorded as a full
green typecheck yet. Real database skips are not executed PostgreSQL proof.

Source is independently accepted for Q263 metadata alignment. Fresh published-head
CI and a separately admitted runtime cutover are later gates. The sole local remains
source41415/frontier91; Order470 is not live and Phase7 is not declared complete.

Q263 alignment is now verified. Root corrected the candidate metadata's mistyped
469 commit and stale founder label; personally8pass/2DBskips/0fail248 plus1/0(70),
strict types and198boundaries pass. Source/pure/browser hashes above remain frozen.
The earlier expected typecheck errors are closed by truthful source alignment,
not casts or removed tests. Metadata is coauthored, not a new independent review.
Published parent6d4 CI34741807806 all six jobs pass; root personally retrieved the
canonical11/0 from database103682893824. Future470CI and delivery remain separate.
