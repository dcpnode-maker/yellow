# Order712 independent review — code/proof accepted

Reviewer: Codex independent agent `/root/review709`; not an implementer of the alert client, component, or parent wiring.

Scope inspected: Order712 brief, `docs/CONTRACTS.md` reservation-alert section, decisions D1460/D1461/D1466, the existing Order463 HTTP/service contracts, `reservation-alerts-client.ts`, `ReservationAlerts.tsx`, its CSS, and the new parent wiring. Order712 adds no backend/schema changes. The previously accepted Order463 isolated PostgreSQL proof is historical evidence, **not** a new database proof performed here. No live alert mutation or fixture suite was run.

Initial read found exact authorized routes and body shapes, server `actions.canManageAlerts` gating, idempotent frozen attempts, 200/complete receipt validation, exact reservation/alert readback, pre/post-token stale-context guards, definite initial refusal versus sticky uncertain retry, and a parent shell recovery exemption. Parent alert lock joins the reservation busy aggregate without disabling its own reconciliation, while it blocks room move/departure/arrival/guest and other sibling commands. A refetch error with retained reservation data leaves the locked alert component mounted.

Personally executed preliminary safe proof:

`bun test tests/order712-reservation-alerts.test.tsx tests/order712-alerts-integration.test.ts tests/operator-reservation-alerts.integration.test.ts tests/operator-reservation-alerts-ui.test.ts tests/reservation-alerts.test.ts` — **30 pass, 0 fail, 162 expect() calls**. The Order463 suites in this command are mock HTTP, pure domain, and old operator UI tests; `tests/reservation-alerts.integration.test.ts` is a fixed-target seeded PostgreSQL suite and was deliberately **not run** against serving data.

Findings sent to the builder before final acceptance:

1. Client text validation initially omitted C1 controls U+0080–U+009F while the backend rejects them. The source now includes that range and tests U+0085 in code and note.
2. Native VoiceInput/Textarea `maxLength` counts UTF-16 units but the contract allows 64/1000 Unicode code points. The initial 64/1000 attributes prematurely limited astral text.
3. New React component mutation/review assertions were initially source-string checks, while Order463 UI behavior tests exercise the old operator UI. A production-used immutable normalized review snapshot and synchronous single-attempt admission guard needed behavior tests.

The builder resolved all three. Client normalization now rejects C1 controls and tests U+0085. Widgets use UTF-16 caps 128/2000 while the final validator enforces 64/1000 code points; exactly 64/1000 astral points pass and +1 fails. Review captures a frozen normalized body, preview and POST use that body, and Edit/Cancel clear it. A minimal `admitReservationAlertCommand` helper is used by the component to set `inFlight.current` synchronously before the first await; its single-admission behavior is tested. The component also retains a lock and frozen attempt if session callback identity changes during an outstanding request. The receipt/readback, sticky uncertainty, definite initial refusals, server permission gate, no-op/replay, and stale-context tests remain green. Source/SSR checks supplement—not replace—the behavior tests.

Final personally executed proof, with adjacent Order709/711 regressions:

- `bun test tests/order712-reservation-alerts.test.tsx tests/order712-alerts-integration.test.ts tests/operator-reservation-alerts.integration.test.ts tests/operator-reservation-alerts-ui.test.ts tests/reservation-alerts.test.ts tests/order711-reservation-room-move.test.tsx tests/order711-room-move-integration.test.ts tests/order709-reservation-integration.test.ts` — **46 pass, 0 fail, 283 expect() calls** across 8 files.
- `bun run typecheck` — root and frontend TypeScript checks passed.
- `bun run boundaries` — passed, 208 TypeScript files scanned.

**Independent code/proof verdict: accepted for build and bounded browser verification.** This does not claim a live annotation, a new PostgreSQL proof, actual mobile review/edit/Cancel, or the combined 711/712 release cutover. Those browser/release checks remain with root; any actual annotation must use an explicitly synthetic QA booking, never real guest data.
