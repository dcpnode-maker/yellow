# Order465 — Preserve invoice printing for retryable fiscal receipts

**Status:** source implemented and independently accepted, 2026-09-13; Q254 admits
selective publication to existing draftPR92. Local promotion remains separate.
**Owner:** Codex coordinator. **Phase:** 7. **Risk:** read-only fiscal presentation;
independent nonimplementer execution required before acceptance.

## Outcome and existing authority

Continue the verified restart checkpoint without restarting or mutating the single
local app. Order440/Q212 added validated `retryBinding` to an error/retry receipt.
The existing invoice workbench passes that receipt directly to the print formatter,
whose exact older key set appears to reject it. Reproduce the disagreement through
the real receipt validator and print export before fixing it. An already issued
invoice must remain printable with an honest pending-registration label; this must
not register it, grant retry authority, invent a QR or alter its economic content.

This is functional compatibility, not permission to resume the paused UI redesign,
change layouts/styles or introduce another fiscal policy. Q187/D1302 continues to
govern issued documents; debit-note economic-source policy remains unresolved.

## Exact scope and ownership

- Builder: `src/http/operator/invoice-print.js` (receipt validation only).
- Builder: `tests/operator-invoice-print.test.ts` (permanent regression tests).
- Coordinator: this order; `handoff/reviews/465-invoice-print-retry-receipt-compatibility.md`;
  `docs/CONTRACTS.md`; `docs/PROJECT-STATUS.md`; `handoff/LEDGER.md`; `DECISIONS.log`.
- Coordinator: `handoff/questions/253-native-debit-note-economic-source-policy.md`
  (record the separate unresolved financial-policy decision, no implementation).
- Coordinator: `handoff/questions/254-order465-selective-source-publication.md`
  admits the exact ten-path source publication, accepted460/Q252 audit intake and
  native Git safeguards. Its compact ignored publication receipts are also admitted.

No other path is admitted. In particular no SQL, migration, business data, provider,
permission, dependency, financial command, browser retry behavior, UI layout/theme,
runtime artifact, retained process, cluster, credential or listener change. Source
publication is limited to Q254. Preserve paused445 and every unrelated working/index change. Use the existing
worktree/branch, no new checkout. Any needed scope expansion must be recorded first.

## Required behavior

1. Accept the already supported optional exact two-field `retryBinding` only on
   `kind=pending`, `status=error`, `disposition=retry`; match the existing receipt
   validator's UUID and integer version 1..2147483647 constraints.
2. Keep old receipts without the optional binding compatible. Reject malformed,
   extra-field, accessor, foreign-state or out-of-range bindings without invoking
   getters. Do not broadly ignore unknown receipt fields.
3. A valid binding affects no printable amount, document identity, registration
   label, QR, styling or markup. It must not leak the provider extension ID/version
   into the print artifact, and must not enable an action or perform any I/O.
4. Preserve existing immutable-document, receipt identity, accepted signed QR,
   escaping, exact-money and print-layout guards unchanged.

## Executable evidence

First preserve a red regression: the actual shared server receipt validator accepts
the same linked retry receipt that the formatter rejects. After the narrow repair,
the same formatter result must equal its older binding-free result. Exercise exact
boundaries and hostile binding shapes, adjacent receipt/retry tests and all existing
print tests. Run typecheck, import boundaries and diff hygiene. An independent
nonimplementer inspects the change and personally reruns the relevant proof. No
database/referee rerun is warranted by a pure browser receipt-validation repair;
unchanged current91 source/CI evidence is not claimed as successor publication.

Only source acceptance may be reported here. The verified local44ef5e08/current91
remains unchanged until a separately scoped and verified source promotion.

## Completion

Builder `/root/q251_artifact` reproduced the real validator/formatter disagreement:
print tests10 pass/1 fail/318 assertions before the fix, then12/0/337. Root did not
implement the repair and personally inspected both file deltas and executed print
plus shared-receipt proof30/0/528, adjacent signed-pair and HTTP receipt proof23 pass/
3 explicit database skips/0 fail/316 assertions, typecheck and198 import boundaries.
The three skipped database cases are not executed proof. Full standing/new-source CI,
publication and local promotion are not claimed. See the independent review record.
