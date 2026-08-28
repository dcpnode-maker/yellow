# Order 216 — Vehicle-register exact detail

**Status:** BUILT-UNREVIEWED-D576 — implementation and builder proof green; independent execution deferred
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/vehicle-register-detail`
**Base:** `f1ae7dd` (built-unreviewed Order215)
**Risk tier:** 3 — tenant/property-sensitive association read and hostile-association containment
**Owner:** Codex implementation; independent executable review remains deferred by founder build-first direction

## Outcome

An operator can open one exact vehicle record from the existing Vehicle Register and
return to the same bounded register result. The detail remains a read-only view of
recorded truth and does not infer onsite, parking, occupancy or access state.

## Fixed contract

- Exact endpoint: `GET /api/v1/properties/:property/vehicles/:vehicle`. It accepts no
  query and requires existing `stay-operations.vehicles:read` plus the exact
  server-derived property grant.
- `VehicleRegisterService.get` accepts only lowercase tenant, property and vehicle
  UUIDs. One tenant transaction proves the exact property vehicle and re-proves any
  linked reservation as same-tenant/exact-property and any linked Party as
  same-tenant. Missing, foreign or wrong-property identity is concealed as 404; a
  hostile stored association fails the entire read as 409 without disclosing the
  foreign identifier.
- Output is exactly the already-approved Order205 row: `vehicleId`, literal
  `registration`, nullable `make`, `model`, `colour`, `driverName`, `reservationId`,
  `partyId`, `enteredAt` and `exitedAt`. Notes, parking/space, inferred onsite state,
  contact, guest name, occupancy, task and access/security truth remain absent. The
  result is deeply frozen, no-store and mutation-free.
- Canonical human route is `/p/{property}/vehicles/{vehicle}`. Each register result
  exposes one semantic **Open vehicle** action. Direct link, refresh, Back, Forward
  and Escape work; close restores the exact search/cursor URL and focus when that
  source remains connected. Property/vehicle/request-generation guards make stale
  paint inert.
- The detail contains no edit, entry/exit, parking, assignment, occupancy, reservation
  or Party action and no polling. Apple iOS, Android, Windows 95/98, glassmorphism,
  neomorphism and ERP receive dedicated accessible presentation; status meaning is
  not conveyed by colour, and 375px/200% zoom, forced colours and reduced motion stay
  contained.

## Exact scope

- this order and committed intentional-red test;
- `src/contexts/stay-operations/vehicles.ts` and its existing index export only if needed;
- focused adapter/route wiring in `src/http/operator.ts` and `src/app.ts`;
- vehicle route/detail integration in `src/http/operator/operator.js` and focused
  styles in `src/http/operator/operator.css`; `index.html` only if executable
  preflight proves a static shell is required;
- focused service, HTTP, route/history/focus, theme/accessibility and Order205
  regression tests;
- Order216 sections in `docs/CONTRACTS.md`, `docs/SECURITY.md`, `docs/UI-SPEC.md`,
  `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`;
- `DECISIONS.log`, `handoff/LEDGER.md`, and a question only for a real scope correction.

No migration/schema/seed, new scope/event/table/status/dependency, vehicle mutation,
parking/space/occupancy command, reservation/Party mutation, generic task API,
polling, second local, promotion, merge, push or deployment is admitted.

## Required work

1. Commit intentional red before implementation.
2. Add exact tenant/property/vehicle read containment and reuse the canonical Order205 row mapper.
3. Add exact HTTP authority, validation, concealment, no-store and bounded errors.
4. Add stale-safe nested register detail with direct-link/history/Escape/focus restoration.
5. Add dedicated six-appearance, small-viewport, zoom, forced-colour and reduced-motion presentation.
6. Run focused real-database, HTTP/UI, standing and fresh referee proof.

## Pre-registered proof

- **P0 red:** exact service, endpoint and nested human route are absent.
- **P1 read truth:** exact vehicle returns only the approved row keys, preserves
  literal text/microseconds, is deeply frozen and repeated reads are byte-equivalent/no-write.
- **P2 containment:** malformed/query/scope/grant and foreign/wrong-property/missing
  identity fail 400/403/404; hostile reservation or Party association fails 409 with
  no partial disclosure.
- **P3 transport:** adapter is no-store, query-empty and property-bound with only
  declared validation/not-found/conflict outcomes.
- **P4 human route:** list action, direct link, refresh, Back/Forward/Escape/focus and
  every stale identity boundary are exact; search/cursor return intent survives.
- **P5 UX:** six appearances, 375px/200% zoom, visible focus, forced colours and
  reduced motion are explicit; no inferred status or write affordance exists.
- **P6 standing:** focused, type, boundary, licence, audit, JavaScript, diff, schema,
  full suite and fresh referee remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Service and endpoint return only the exact existing vehicle-register row truth.
- [x] Human detail route is stale-safe, accessible and read-only across six appearances.
- [x] Focused, standing and referee gates are green.
- [x] Result is recorded built-unreviewed; independent Tier-3 execution remains pending.
