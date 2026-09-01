# Order 316 — Management-demo navigation fine-tune

**Status:** BUILT-PENDING-FRESH-TIER2-REVIEW-D875
**Phase:** 7 — founder-visible presentation of already-built Phase 4–6 journeys
**Branch:** `phase-7/management-demo-navigation-finetune`
**Base:** `721cbbc` (independently approved Order315 governance head)
**Risk tier:** 2 — shared client navigation/focus behavior; fresh independent browser review mandatory

## Outcome

Make the strongest already-built connected journey immediately legible for management:
the authenticated root lands on Today, Today presents a compact truthful index of
existing Reservations, Financials and Stay-operations workspaces, and selecting a
secondary workspace in Simple mode never leaves the fixed catalogue overlay obscuring
the destination.

## Exact scope

- `src/http/operator/index.html`:
  - make Today the initial active/visible root view;
  - add one compact management-journey index inside Today that names only existing
    human workspaces and their eligibility cues;
  - expose navigation controls only to existing Today, Reservations, Folios, Cashiers,
    Housekeeping, Vehicles and Operations views.
- `src/http/operator/operator.js`:
  - make Today the no-deep-link root fallback while preserving every explicit route;
  - route journey-index controls through the existing current-property history/view
    path without new requests or mutations;
  - after successful secondary-workspace selection/restoration in Simple mode,
    collapse the fixed overlay and focus the destination heading; preserve
    Advanced/Expert direct controls, active state and history guards.
- `src/http/operator/operator.css`: compact responsive journey-index presentation only.
- bounded intentional-red and regression tests, `docs/UI-SPEC.md`, this order and
  append-only governance evidence.

## Truthful journey catalogue

- **Reservations:** search/create, reservation board and eligible reservation detail;
- **Financials:** open Folios by reference or from an eligible reservation, and
  current Cashier workbench;
- **Stay operations:** Today due-in/due-out/in-house preparation, Housekeeping tasks
  and conditions, eligible Vehicle detail/parking, and room Operations.

The catalogue must not advertise tape chart, waitlist action, generic token-payment
workspace, day-close, statutory/fiscal issue, mobile/offline/photo discrepancy,
queue/messaging, kiosk, reports, owner portal, groups, OTA/channel or any other
unbuilt/deferred surface.

## Forbidden

No API/domain/service/database/schema/migration/seed/credential/permission/status/
review/phase/business authority; no hard-coded property, reservation, folio, task or
vehicle identifier; no automatic command or data request; no second/public local;
no Order311+ statutory implementation, merge, push, deploy or application-complete
claim.

## Required proof

1. Intentional red precedes production.
2. Root shell and protected one-click login land on Today for both properties.
3. Every explicit existing deep link remains exact and Back/Forward restores it.
4. Every catalogue control targets only an existing top-level route and advertises
   only a matching existing control/tested journey.
5. All seven Simple secondary destinations close the overlay, maintain active
   `aria-current`, update history once and focus the destination heading; direct
   deep links are unobscured.
6. Advanced/Expert controls remain direct; preview/disclosure ARIA, Escape/focus,
   dirty guards and six appearance/responsive/accessibility contracts remain intact.
7. Static/focused/standing gates pass, followed by fresh non-implementing browser
   review. Local promotion, if desired, is a separate Tier3 order.

## Definition of done

- [x] Today is the truthful root/default view.
- [x] Compact journey index links only already-built workspaces.
- [x] Simple secondary navigation never obscures its destination.
- [x] Focused, standing and static proof pass.
- [ ] Fresh independent Tier2 browser review approves.
