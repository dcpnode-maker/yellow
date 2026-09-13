# Order465 — Independent source and executable review

**Verdict:** APPROVED, source-only. **Date:** 2026-09-13.
**Implementer:** `/root/q251_artifact`. **Nonimplementing reviewer:** `/root`.

Later delivery: Q255's46004 runtime checkpoint below was superseded after reboot
by verified Q258r2 source41415/frontier91 on3000 at2026-09-13T04:19:14UTC.
This is separate runtime evidence, not an expansion of this source verdict.

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

## Exact published-head CI acceptance — 13 September

Root separately read CI34721116555 for the published head
`46004d6f9b61a02f14259fd3f911e85a72ae0c60`. All six jobs succeeded:
quality103627030888, windows-state103627030934, local-review103627030971,
free-host-arm64103627372846, database103627372848, container-smoke103627372871.
Database completed2026-09-12T22:16:44Z. Root personally retrieved that job's
canonical referee log: `RESULT: 11 passed, 0 failed of 11`. This is independent
inspection of exact-head CI evidence, not a claim root ran CI on the laptop.
Migration, native fiscal compatibility, fixture/deployment and runtime checks
also passed. PR92's current section and local status now record this result.

The six-job CI receipt is
`.yellow/evidence/order465/current-runtime-46004-ci-acceptance-20260913.json`,
SHA256`71e7217edd8ca66af636abbc5e53e1a7025378130d3471de8956bee8e6475470`.
It is only a prerequisite for a separately admitted Q255 action. The serving
app remains44ef/frontier91; no helper execution, main merge, provider activation,
debit policy decision or phase closure is inferred.

## Subsequent actual local promotion — Q255

The earlier source-only and44ef runtime statements above are historical.
Root's separately admitted Q255 promotion completed successfully, receipt023e0f4e:
published46004/frontier91 is now live on3000. Root independently fetched the
33288-byte print asset and verified SHA2560e5da1cd equals the reviewed committed
blob. Saved-login authentication and invoice browsing/issued-readiness pass;
genuine fiscal eligibility remains blocked, providers off. Review460 and
.yellow/evidence/order465/q255-promotion-proof-20260913.json record exact tests,
native process starts, preserved database and consumed admissions. No main merge,
provider activation or whole-phase completion is claimed.
