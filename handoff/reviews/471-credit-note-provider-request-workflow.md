# Order471 — credit-note provider request, source/journey acceptance

13 September2026. Current published parent feff6dc86982a5386968674b6c7077721a701785
does not include this work. Sole local remains separately released41415/frontier91.
No migration, financial record, provider request, app restart or Git mutation was
performed by this review. Phase7 is incomplete.

## Ownership and scope

Original builder: /root/q258_runtime_cutover. Narrow production repair:
/root/q258_source_adapter. Independent browser author/reviewer:
/root/astra_ultra_handoff. Root did not implement production; it inspected the full
diff, personally reproduced the RED and personally executed the repaired journey.

Accepted SHA256:

| File | SHA256 |
| --- | --- |
| src/http/operator/invoices.js | 28736990cc9dc3d76313511e0f63c26e002c62f960d314d8b06934d8dd599b4b |
| tests/operator-credit-note-provider-request.test.ts | 751b66c7651290d24a2d70eec19131d245e3f410900c8b193d68dab79c3184fa |
| tests/operator-credit-note-provider-request.browser.test.ts | ab47b11f5dd4e0da9fb1269822a9aa860602d03600e0a67611e8877d025ef163 |

## Genuine failures and repairs

The initial missing-control RED is preserved in Order471. Expanded frozen browser
AB47 on original productionEEFC4548 produces0pass/1fail/12 aggregate assertions:
both1280/390 execute26 scenarios/128 behavioral checks,13 failures per viewport.
Accepted responses were rendered while marked in-flight; same-view retry reused
disabled choice controls; replacement disclosures remained stale after settlement.

The repair settles accepted requests before delivery rendering, binds settlement
to the latest still-current disclosure, and renders an explicit retry button using
the retained immutable credit/provider/body/key. Accepted requests cannot resend.
No financial/domain API, provider, permission or business policy was introduced.
Unknown/denied/malformed responses do not license a new request identity.

## Personally executed proof

Root command, native Bun1.3.14:

```text
bun test tests/operator-credit-note-provider-request.test.ts tests/operator-credit-note-provider-request.browser.test.ts tests/operator-invoice-credit-note.browser.test.ts tests/operator-credit-note-print.browser.test.ts
```

Result6pass/1fail/105 in14.13s. The new frozen471 real Chromium journey passes at
both1280px and390px:26 scenarios/130 checks each/0 failures. Four focused pure tests
and existing466 browser pass. Existing468 times out at its unchanged5second Bun
default while root and independent reviewer were running browser suites in parallel.
Concurrency is a confound, not proven causation; that failure is retained.

Root then runs the exact unchanged failed test with the browser lane exclusive:

```text
bun test tests/operator-credit-note-print.browser.test.ts
```

Result1pass/0fail/28 in2.74s. No timeout, assertion or fixture change.

Independent Astra reports its personally executed12-file aggregate38pass/0fail/598
in34.57s, including471,468,469,470,466 and existing invoice/provider/retry journeys.
Exact command (same native executable/workdir as root):

```text
bun test tests/operator-credit-note-provider-request.browser.test.ts tests/operator-credit-note-provider-request.test.ts tests/operator-full-credit-note-issue.test.ts tests/operator-full-credit-note-issue.browser.test.ts tests/operator-credit-note-register.test.ts tests/operator-credit-note-register.browser.test.ts tests/operator-credit-note-print.test.ts tests/operator-credit-note-print-workflow.test.ts tests/operator-credit-note-print.browser.test.ts tests/operator-invoice-credit-note.test.ts tests/operator-invoice-credit-note.browser.test.ts tests/operator-invoices.browser.test.ts
bun run typecheck
bun run boundaries
```

Its frozen471 journey passes26 scenarios/130 checks at each width. Full typecheck
and202 import boundaries pass. All three accepted hashes are independently verified.

The journey exercises actual production browser assets through a synthetic HTTP
seam: native keyboard choice/confirmation/submit; exact credit request body/key;
success versus signed sandbox delivery status; network403/404/409/422 and invalid
receipt uncertainty; deliberate same-key retry; in-flight replacement; hidden,
disabled, detached, replaced and terminal controls; stale navigation, suspension,
disposal and prior-property responses. No invoice receipt route substitutes for
credit delivery; no private values enter URLs/storage and no automatic POST occurs.

## Acceptance boundary

Accepted for scoped source/journey integration. This is not an actual fiscal
provider round-trip, live database execution, whole-release CI/referee result,
runtime delivery or Phase7 completion. Publish and deploy only through Order460's
separate coherent release, preserving paused445 and the current market candidate.
Serial browser execution avoids duplicated host pressure; other disjoint work
continues concurrently. No additional founder action is needed for this UI change.
