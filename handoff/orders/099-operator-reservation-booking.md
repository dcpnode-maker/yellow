# Order 099 — Operator reservation booking workbench

**Phase:** 4  
**Branch:** `phase-4/operator-reservation-booking`  
**Base:** `41f72b3`  
**Risk tier:** 3 — reservation creation and occupancy arbitration  
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Make the approved search-to-book path staff-usable in the existing Reservations
workbench. An authorized operator searches complete server offers, selects one visible
bookable option, supplies an existing primary Party identity and exact party shape, then
either places a ten-minute cart hold before held commit or commits directly. Both paths
invoke the existing authenticated hold and reservation commit HTTP commands; the browser
never owns availability, pricing, occupancy or reservation identity.

## Natural-Solution Test

Orders 055, 082 and 084 already provide strict property-scoped hold, commit and complete
offer-search HTTP. The natural solution is one accessible browser adapter over those exact
routes with no new server mutation, permission, schema, state or event. Offer evidence is
read-only and explicitly not a promise; hold is temporary; commit remains the only atomic
reservation promise and re-arbitrates PostgreSQL occupancy.

## Scope

- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `tests/operator-reservation-booking.integration.test.ts`
- `tests/operator-assets-security.test.ts`
- `src/project-status.ts` and `tests/founder-status.integration.test.ts` only after green
- this order, `handoff/PHASE-4-PLAN.md`, `DECISIONS.log`, `handoff/LEDGER.md`,
  `handoff/questions/`, and the independent review record

## Required work

1. Add a booking panel under Reservations with canonical stay date/time, adults, bounded
   child ages, existing primary Party UUID and channel code inputs. Use explicitly labelled
   UTC inputs to avoid ambiguous local wall times and submit the canonical nested
   availability body already accepted by Order 084.
2. Render every returned option/issue deterministically with safe text. Only server
   `bookable=true` options may be selected. Show exact server total/currency and policy/
   availability evidence as read-only guidance, together with `promise=false` and
   `commit_arbitration_required=true`; do not calculate money or sellability in-browser.
3. A selected offer may place a ten-minute cart hold through the existing property hold
   route using the exact offer sellable/stay. Keep the returned hold only in live memory,
   show its server expiry and identity, and never imply it is a reservation.
4. Direct commit sends the selected offer sellable/stay, rate plan, Party/party shape and
   channel to `POST /api/v1/reservations:commit`. Held commit sends the current returned
   hold id plus the same rate/party values. Both use durable retry keys, render canonical
   confirmation/status only from the server response and clear stale selection/hold after
   success or property/search changes.
5. Use existing `inventory.availability:read`, `inventory.holds:write` and
   `reservations.booking:write` authority unchanged. Missing scopes/property grants and all
   strict shape/idempotency/occupancy conflicts remain generic server failures; the browser
   does not infer or combine authority.
6. Use visible labels/fieldsets, 44px targets, keyboard-native option controls, live status,
   deterministic focus on search results/confirmation, responsive layout, reduced motion,
   safe text APIs and no token, Party, offer, hold or reservation persistence.
7. State honestly that Party creation/profile merge, payment/deposit, tax finalization,
   folio/journal/fiscal work and public guest booking remain later bounded workflows.

## Forbidden

- Any server/context/adapter mutation, migration, schema/RLS/grant/permission change,
  new state/event, seed change or dependency
- Editing `migrations/0001_init.sql`, another migration, `tests/run_invariants.py`, package
  or lock files, Compose/CI, Party, payment, financial, tax, journal, folio or fiscal code
- Browser availability/price/policy/occupancy calculation, stored/signed option tokens,
  client reservation/confirmation ids, caller tenant/actor/currency or bypassing the hold/
  commit endpoints
- Treating an offer as promised inventory, a hold as a reservation, or successful payment/
  deposit/tax/document work as implied by confirmation
- Persisting token, Party, offer, hold or reservation data; `innerHTML`; external assets;
  inaccessible cards, icon-only actions or hover-only disclosure
- Any file outside Scope, self-review, self-merge or claiming Phase 4/app completion

## Pre-registered proof

### P0 — intentional red

Commit this order, then commit a focused asset/journey canary for the planned booking panel,
canonical offer search, hold/direct commit and honest result states before production edits.
It fails only because the panel is absent.

### P1 — complete offer search

Canonical browser input reaches the existing server offer composer. Server options/issues,
exact bigint money serialization and evidence render safely; blocked/unpriced/conflicted
options cannot be selected and browser edits cannot create bookability.

### P2 — hold then commit

The selected option places one real ten-minute hold and held commit atomically transfers its
occupancy to one reservation/segment. Exact replay returns the same confirmation; changed
key reuse, expired/released/foreign hold and injected publication failure leave no partial
reservation.

### P3 — direct commit and race

Direct selected-option commit creates one reservation through Order 082. Two operators
racing for the last exclusive room produce one confirmation and one generic conflict;
positional retry stays bounded and losers have no reservation/fact/outbox/idempotency
artifacts.

### P4 — authority and UX

Authentication, availability/hold/booking scopes, property grants, Party/rate/sellable/
period/body/key shapes and foreign references fail closed before mutation. Static/runtime
canaries prove safe hostile text, server-only bookability/confirmation, no price math or
persistence, explicit promise/hold/payment boundaries, 44px responsive controls, focus and
live status.

### P5 — standing and independent gate

Typecheck, boundaries, standing, schema, deployment, protected hashes and a fresh
app-never-started referee pass. A non-implementing reviewer personally executes P1–P4 on
fresh PostgreSQL and approves.

## Definition of done

- [x] Order exists before production code.
- [x] Intentional P0 red is committed before implementation.
- [x] Canonical offer search renders only server truth.
- [x] Hold and direct commit converge on approved HTTP commands.
- [x] Occupancy race/replay/rollback proofs pass.
- [x] Workbench is accessible, responsive and authority-free.
- [x] Standing/schema/deployment/referee gates pass.
- [ ] Independent reviewer approves executed proof.
- [x] Scope is exact; user-owned untracked material remains untouched.

## Builder evidence

Focused booking/assets passed 14/14 with 156 assertions; canonical offer search passed
6/6 with 76; authoritative reservation commit passed 5/5 with 61; and the inherited
hold suite's six live HTTP/occupancy/replay/rollback cases passed. Its old P7 exact-role
assertion rejects the six later independently approved Orders 096–098 reservation scopes;
Question 135 records that out-of-scope proof discrepancy without changing it here.

Typecheck, all 59 import boundaries and standing 131/0 with 1,659 assertions passed.
Fresh review seed passed 11/11 with 39 assertions, deployment acceptance passed 4/4
with 10, normalized schema matched, protected hashes remained exact, and the final
84-table app-never-started referee passed 11/11. This is builder evidence, not
independent approval.
