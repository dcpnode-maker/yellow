# Order 322 — Arrival/departure journey alignment

**Status:** READY-D894
**Phase:** 7 — founder-visible presentation of already-built stay journeys
**Branch:** `phase-7/arrival-departure-journey-alignment`
**Base:** `ae97d37` (independently approved Order321 governance/local head)
**Risk tier:** 2 — presentation/navigation placement; fresh independent browser review required

## Outcome

Make the existing Today operational journey understandable to management users by
placing its existing control under **Stay operations** and naming it **Arrivals &
departures**. Preserve the same Today route, router, seven destinations and every
already-built governed action.

## Exact scope

- move the existing `data-journey-view="today"` control from Reservations to Stay
  operations and relabel it `Arrivals & departures`;
- fine-tune the Stay operations description to name arrivals, departures and in-house
  work;
- update exact presentation tests and `docs/UI-SPEC.md`;
- preserve all seven destination identities exactly once, route/history/focus/dirty
  behavior, permissions, data truth, appearances and responsive behavior.

## Forbidden

No new control, route, handler, request, API, domain/service/database/schema/migration,
seed/data, credential/permission/status/review/phase/business authority, hard-coded
entity, second/public local, post310 statutory work, merge, push or deployment. This
order does not refresh the sole local; that requires a separate guarded order.

## Definition of done

- [ ] Intentional red precedes production.
- [ ] Today is labelled `Arrivals & departures` exactly once under Stay operations.
- [ ] Reservations contains only its existing Reservations destination.
- [ ] Seven destination identities and routing behavior remain exact.
- [ ] Focused, standing and static proof pass.
- [ ] Fresh independent Tier2 browser review approves.
