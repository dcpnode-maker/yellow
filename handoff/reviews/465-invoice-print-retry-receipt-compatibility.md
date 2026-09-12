# Order465 — Independent source and executable review

**Verdict:** APPROVED, source-only. **Date:** 2026-09-13.
**Implementer:** `/root/q251_artifact`. **Nonimplementing reviewer:** `/root`.

## Reproduction and finding

The builder's initial permanent regression passed the real shared server validator,
then failed because the print formatter returned `invalid_delivery` for the same
retryable receipt:10 pass/1 fail/318 assertions. This is a current Q212 integration
gap, not a fabricated document or a rejected economic source.

Root independently traced `invoices.js`'s `freshPrintArtifact`: the freshly fetched
delivery is passed unchanged to the formatter. Root inspected the complete two-file
diff. The repair accepts only the exact optional two-field retry binding in the
existing error/retry state, with canonical UUID and int32-positive version bounds.
Unknown keys and wrong-state bindings still fail. Accessors are rejected without
being invoked. No financial, provider, identity, QR, markup or stylesheet code changes.

## Personally executed by root

Working directory is the existing `yellow-order175-folio-responsive-containment`.
Native Bun executable: `C:\Users\astha\.bun\bin\bun.exe`.

```text
bun test tests/operator-invoice-print.test.ts tests/fiscal-submission-receipt.test.ts
30 passed, 0 failed, 528 assertions

bun test tests/india-irp-signed-receipt-binding.test.ts tests/operator-fiscal-submission-receipt.integration.test.ts
23 passed, 3 explicit database-gated skips, 0 failed, 316 assertions

bun run typecheck
exit 0

bun scripts/check-import-boundaries.ts
198 TypeScript files; exit 0

git diff --check -- src/http/operator/invoice-print.js tests/operator-invoice-print.test.ts
exit 0
```

The regression composes the actual shared validator, verifies versions1 and2147483647,
and proves the complete print artifact equals its binding-free predecessor. Invalid
version/type/UUID/extra-field/prototype/state/accessor cases reject. Receipt and signed
QR regression coverage remains green. HTTP tests here use the existing injected
reader; the three real-database cases are explicitly skipped, not claimed as executed.

## Frozen reviewed identities

- `src/http/operator/invoice-print.js`,33,288 bytes:
  `0e5da1cd04e7f6c06fe21bfbcd60427ae06febf0e7d5bb26ed4814108d67bc51`
- `tests/operator-invoice-print.test.ts`,19,938 bytes:
  `2c740d77928158984cf63d9fc7f887b4976d0be0214381612b0a8b367f9d527d`

Two product/test paths changed,+87/-2 lines; no migration, DB, runtime, dependency,
authentication, provider, theme/layout or paused445 changes. Current91 schema/referee
and44ef CI are unchanged baseline evidence, not a successor release claim. No fresh
database or broad runtime harness was needed for this read-only parser repair.

Publication, new-head CI and local promotion are separate. Phase7 still requires
the Q253 debit-note economic-source decision/implementation and authentic provider
acceptance. This review does not mark those or the whole application complete.
