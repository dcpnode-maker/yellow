# Order 322 — Arrival/departure journey alignment

**Status:** BUILT-PENDING-FRESH-TIER2-REVIEW-D895
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

- [x] Intentional red precedes production.
- [x] Today is labelled `Arrivals & departures` exactly once under Stay operations.
- [x] Reservations contains only its existing Reservations destination.
- [x] Seven destination identities and routing behavior remain exact.
- [x] Focused, standing and static proof pass.
- [ ] Fresh independent Tier2 browser review approves.

## Builder evidence — D895

- Intentional red was 1 pass / 1 expected fail / 15 assertions: only the Today
  category placement failed; seven identities and the shared router stayed green.
- Focused proof is 17 pass / 0 fail / 268 assertions. Standing proof is 1139 pass /
  890 expected database skips / 0 fail / 17355 assertions across 2029 tests and 370
  files.
- Typecheck, 127-file import boundaries, 23-package licence policy, audit0 and diff
  hygiene pass.
- Production delta is one moved/renamed existing button, one explanatory paragraph
  and the UI specification. No JavaScript, request, authority, data, status, local or
  post310 path changed.
