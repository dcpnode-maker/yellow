# Order 665 - Conversational operations and low-cost voice feasibility

Date: 2026-09-23
Phase: 0 cumulative review; research and source assessment
Status: COMPLETE - research only; live-app request continues separately in Order 666
Owner: Codex
Branch: existing `phase-0/founder-context-demo-readiness`

## Goal

Assess the founder's connected room-assignment, guest-history, early/late stay,
voice-command and guest-ordering flows, preserving existing Yellow and latest UI
direction while identifying reusable source and realistic cost/latency boundaries.

## Scope

- `handoff/orders/665-conversational-operations-feasibility.md`
- `docs/CONVERSATIONAL-OPERATIONS.md`

## Method

- Read relevant current Overwatch, operator, fixture and prior UI/voice orders.
- Research official on-device speech runtimes, browser support and Gemini Live
  as a quality reference. No cloud inference, credentials or model downloads.
- A bounded assistant may inspect source read-only and return exact anchors.
- Separate implementation evidence, proposal and unmeasured performance.
- Preserve PROJECT.md and latest founder decision: improve existing Yellow;
  no new Yellow version, replacement repo or new hosting stack.

## Acceptance

- [x] Mr. Adoor context-to-room-offer-to-check-in flow specified.
- [x] Shared manual/text/voice command boundary and microphone behaviour specified.
- [x] Early check-in/late checkout and POS/modifier/billing dependencies mapped.
- [x] Low-cost voice candidates, licensing/browser limits and benchmark needs stated.
- [x] Current source readiness distinguished from intended complete user flow.

Documentation-only: no application/database/infra changes or application tests.
