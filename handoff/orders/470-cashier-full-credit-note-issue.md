# Order470 — Deliberate cashier full-credit issuance

Status: product source independently accepted,2026-09-13. Phase7.
Root personally executed64pass/6explicitDBskips/0fail1211assertions across13files,
including actual desktop/390px Chromium; final hashes and retained failures are in
Review470. Q263 routine snapshot/type alignment, publication/CI and local delivery
remain separate. No Phase7/provider/whole-app completion is implied.
Receiving source6d4f8ea9; exactCI34741807806 is running. Sole local41415/frontier91
is separate. This order adds functional use of accepted446, not a visual redesign.
Authority: founder build continuation; Q187/D1302 full-credit rules; existing446
independently executed financial/numbering/RLS/API proof. Q253 debit policy unchanged.

## Exact scope and ownership

Source builder /root/q258_runtime_cutover owns only:
- src/http/operator/invoices.js
- tests/operator-full-credit-note-issue.test.ts (new production-helper/unit proof)

Initial separate browser-proof author /root/q258_source_adapter owned only:
- tests/operator-full-credit-note-issue.browser.test.ts (new actual synthetic proof)

Root takes ownership of that test on13September after its initial fixture failures
and incomplete mobile/lifecycle coverage; the previous author is interrupted and
has stopped editing. Root remains independent of production implementation. The
new bounded test may use a single owned Chromium/CDP process for both desktop and
true390px contexts, without changing any existing test timeout or accepted proof.

Root nonimplementing reviewer owns:
- this order and handoff/reviews/470-cashier-full-credit-note-issue.md
- docs/CONTRACTS.md; docs/PROJECT-STATUS.md; DECISIONS.log; handoff/LEDGER.md
- ignored metadata/evidence under .yellow/evidence/order470

No other source, CSS/assets/route, API/commands/schema/migration/provider/readiness/
series authority, dependency, runtime/database/WSL/Docker/state-script/cleanup/Git
mutation. Exact release/status scope will be admitted separately after proof.
Preserve paused445 and accepted466/468/469 work. No live financial command tests.

## Existing command and immutable business meaning

In an existing issued invoice's detail add a deliberate Issue full credit note
control. It opens a labelled confirmation flow; opening or confirming a checkbox
alone never POSTs. Display the immutable original number/date/total using already
validated original data, no tax recomputation. Explain: full credit only, original
unchanged, not cash refund/payment, not provider registration. Do not claim user
eligibility until the server accepts; current/property/post-seal authority stays
server-owned. Require a reason and explicit affirmative confirmation plus final
Issue full credit note button. Cancel before submission is harmless.

POST /api/v1/properties/:property/invoices/:originalDocument/credit-notes
has no query, exactJSON {reason}, Content-Type application/json and Idempotency-Key.
No tenant/actor/amount/series/date/number/supplier/tax/folio/hash/provider in input.
Reason matches server exactly: well-formedUTF16,1–500 Unicode scalars, nonblank,
no ASCII control U+0000–001F or DEL; preserve exact typed bytes, no trim/normalize.
Do not reject valid C1 or supplementary scalar text solely as a UI convention.

Generate one secure random key8–200 visibleASCII only when a confirmed valid
intent is submitted. Store an immutable snapshot of original identity, exact
reason/key and intent state in bounded controller memory; reuse established
ownership patterns without modifying unrelated provider/issue behavior.
Disable concurrent actions and never auto-submit/retry/poll.

After ANY sent request, do not silently unlock changed reason or generate another
key for that original. A network/503/aborted/invalid-success outcome is unknown:
keep exact reason/key, explain uncertainty and offer deliberate Retry same credit
request or existing-credit discovery. Later400/403/404/409 does not prove an earlier
unknown attempt had no effect. Never clear the old identity just to start over.
Backend one-full-credit-per-original and durable same-key replay remain authoritative.
Cancel/navigation may close the view but is not financial rollback. Within the
same controller, returning to an original retains the unresolved intent/key.
Dispose clears private memory; subsequent sessions use existing-credit discovery
and server idempotency/original uniqueness, not fabricated local persistence.

201issue and200replay return the same raw immutable receipt; request helper may
return only parsed body, so do not invent replay/header knowledge. Validate using
existing creditNoteDisclosureEnvelope against exact original AND submitted reason
before presenting success. Malformed/mismatched response stays outcome unknown.
On valid receipt, show credit number and existing disclosure/preview/print pathway.
No automatic provider request, direct print, refund or other financial action.

Use honest generic status matrix:
400invalid request/reason;403permission;404original unavailable/concealed;
409financial/current/already-credited conflict;503/transport unavailable/unknown.
Never treat404asproof no credit exists or409aspermission to switchkey. Existing
credit discovery is explicit and read-only. Any successful discovery must bind
the original and must not claim it resolved a different submitted reason.

## Lifecycle, privacy and executable proof

Current detail/scope/generation/active/connected guards must prevent retained,
hidden/detached/disposed controls and stale confirmation from sending. Recheck
after asynchronous boundaries before rendering/navigating/follow-up. Switching
original/property/mode, suspend/dispose or source reload cannot issue against the
new subject using the old intent. Unknown request identity survives ordinary
navigation while its view does not. No contacts/reason/receipt/key in URLs,
local/session storage or logs. Reason/output only safe DOM text. Accessible labels,
keyboard operation and existing responsive classes at desktop/390px; no theme work.

Capture genuine missing-control/helper RED first. Source tests exercise actual
production reason/snapshot/receipt validation, exact input/output and reuse rules.
Separate real Chromium proof covers noPOST before explicit valid confirmation,
byte-exact POST and reason, successful issue/replay without header assumptions,
network/503/invalid receipt uncertainty, same-key retry/draft lock through
navigation, denial/conflict/no duplicate intent, current-control lifecycle,
property changes and no provider/refund/printing. Include Unicode/control/500bound,
hostile output and true390px functional layout. No false mocks of production DOM.

Root personally reviews final product and executes relevant proof plus unchanged
446 signed-session HTTP composition and466/468/469 invoice regressions. Label
existing realDB-gated skips; do not count them as newly executed DB proof.
Strict types198boundaries/diff and fresh exact-head CI remain required. Independent
source/browser acceptance is not provider acceptance, Phase7 or app completion.
