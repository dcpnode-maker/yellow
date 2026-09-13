# Order471 — Credit-note provider registration request workflow

Status: FROZEN UNCOMMITTED, 13 September 2026, under Order472 founder priority.
Phase7; receiving head63338ed3. Resume after bounded discovery integration.
Builder checkpoint sourceSHA256:
EEFC4548F9EDE2EEE20AEF0BC7C3BD8331547C210A6849CB1E67DD956487BCBF;
focused testSHA256:
882800A3A01E7BD8D4242C601291F210872573399CC497B9E8EA1B6AF02E8845.
Builder reports22/0(173) pure plus4/0(244) existing browser regressions and types.
Root's initial missing-control RED is retained; expanded new browser proof is
incomplete. Not independently accepted, published or live. Preserve all files.
The following scope and implementation requirements remain for resumption.
Founder requests continued build and exposure of built functionality. Existing
Orders447/452 already own fiscal submission and authorized credit delivery. This
order adds their deliberate cashier UI, not a new provider, financial policy or API.
Exact633 CI34743363237 failed quality and Windows startup proof; diagnosis runs in
parallel. Local3000 remains41415/frontier91; no delivery or phase completion claim.

## Exact scope and ownership

Production builder /root/q258_runtime_cutover owns only:
- src/http/operator/invoices.js
- tests/operator-credit-note-provider-request.test.ts (new focused source proof)

Root owns executable independent browser proof and governance:
- tests/operator-credit-note-provider-request.browser.test.ts (new)
- this order; handoff/reviews/471-credit-note-provider-request-workflow.md
- docs/CONTRACTS.md; docs/PROJECT-STATUS.md; DECISIONS.log; handoff/LEDGER.md
- .yellow/evidence/order471/ (ignored bounded evidence)

Root does not implement production. No parallel production writer. Existing470
and earlier suites/thresholds remain unchanged. No other code/CSS/routes/schema,
new dependencies, DB/runtime/provider action, WSL/Docker, state scripts, cleanup,
staging/commit/push/merge authorized here. Preserve paused445 and all outside work.
Any needed extra path requires written scope expansion before editing.

## Complete user journey

After deliberately viewing a validated existing credit receipt and its authorized
delivery, offer Register credit note with provider only when exact delivery is
not_requested. Pending/accepted/rejected/legacy/ambiguous/unavailable are not a
fresh request capability. Do not infer provider registration from accounting issue.

Deliberate intent loads GET /api/v1/properties/:property/fiscal-provider-options.
Reuse providerOptionsEnvelope; no provider selected automatically. Require one
actual offered provider, show its label/key/environment, affirmative environment
confirmation, and final Request credit-note registration button. Opening, selecting
or checking alone cannot POST. No provider list in URLs/storage/logs.

POST /api/v1/properties/:property/fiscal-submissions with exactly
{documentId: creditNote.documentId, providerExtensionId} and secure visibleASCII
Idempotency-Key8–200. Use existing provider wire/API authority, not invoice id,
original hash, amount, reason, actor, tenant or user-supplied provider version.
Keep the actual offered provider identity/version for validating response binding.

Retain one immutable credit/original/property/hash/provider/key intent per credit
in bounded controller memory (maximum300), no eviction of unresolved requests.
After any sent request, preserve its key and provider across unknown/denied/malformed
outcomes and ordinary navigation. No automatic retry or provider change; deliberate
Retry same credit-note registration uses exact original body/key. A later403/404/
409/422 cannot prove an earlier uncertain send was harmless. Do not allow terminal
success controls to send again. Clear private memory on disposal only; never claim
persistence across reload. Server remains authoritative for duplicate/conflict rules.

Validate fiscalSubmissionEnvelope against credit document and selected provider.
Valid acceptance means request accepted only, not provider registered/IRN issued.
Then explicitly read GET /api/v1/properties/:property/credit-notes/:creditId/delivery
and validate deliveryEnvelope + fiscalDeliveryRegistrationStatus against credit
id/property/sha256. Never refresh a credit using /invoices/:id/receipt. A failed or
denied read remains honestly unavailable even after accepted request; request and
read permissions are distinct. Do not offer a new request because receipt is absent.
No automatic polling, outbound provider activation, refund, print or financial issue.

## Lifecycle and verification

Require current controller/detail/original/property/generation and connected,
contained, enabled, nonhidden actual intent/select/confirmation/submit controls.
Recheck before effects and after async boundaries. Hidden ancestors, detached or
replaced controls, terminal scripted clicks, repeat clicks, disclosure reload,
in-flight reopening, navigation, suspend/dispose and late prior-property responses
cannot submit or update another subject. Retained uncertainty is not discarded by
view replacement. Reopening while inflight must not strand a new actionable view.
Bound retained maps and requests; safe DOM text, labels, keyboard and true390px.

Record genuine missing-control RED. Focused tests exercise actual production pure
helpers if factored, not source substrings as sole behavioral proof. Root personally
executes real Chromium desktop/390px with production assets and synthetic request
seam: exact body/key/route and credit identity, explicit choices/confirmation,
success versus real registration, mismatched provider/document receipts, denials,
unknown/retry across navigation, detached/hidden controls and all async lifecycle
cases above. Verify no invoice receipt route for credit and no provider/refund/print.
Existing446/447/452 signed API tests remain unchanged; any environment skips are
explicit, not executed DB proof. Run470/469/468/invoice provider regressions,
typecheck/boundaries/diff; current source CI and separate immutable runtime delivery
remain required. No authentic external acceptance or Phase7 completion follows.
