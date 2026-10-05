# Order 501 — Governed operator action catalogue discovery

## Objective

Inventory existing canonical Yellow operator APIs and domain commands into a typed
action catalogue design for Overwatch and manual PMS workbenches. The catalogue is
the prerequisite for an assistant that renders live work in place rather than
returning navigation links.

## Scope

- `src/app.ts`, `src/http/`, `src/contexts/`, existing contracts/state machines/tests
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md` and a discovery report under
  `handoff/reviews/`

## Required behaviour

1. For each existing operator action, record capability name, route, authoritative
   preflight/read source, required fields, permission/confirmation/idempotency,
   state effects/facts/outbox, result refresh and known UI exposure.
2. Map it to the relevant founder journey and identify whether it can be made an
   Overwatch embedded action without a new domain contract.
3. Explicitly separate non-mutating reads, currently safe reusable commands,
   high-risk financial/occupancy commands requiring independent review, and missing
   domain capabilities (allowance, partial item splits, communications/F&B etc.).
4. Propose small, non-overlapping subsequent implementation orders. Do not falsely
   call deep links action execution.

## Exclusions

- No application/database/runtime/deployment/provider/credential changes; no test
  fixture writes, raw DML or public user action.
