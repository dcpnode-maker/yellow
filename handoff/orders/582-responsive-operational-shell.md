# Order 582 — Responsive operational shell and fast workspace foundation

## Objective

Create the shared Yellow interaction system that lets the approved operational
workbenches coexist without turning the application into a dense monolith: a fast
segmented ribbon, concise primary views, contextual Options drawers, restrained
neon status treatment and a responsive operations hub that is safe to reuse in the
existing Android web shell.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `frontend/yellow/src/ui/SegmentedRibbon.tsx`
- `frontend/yellow/src/ui/OptionsDrawer.tsx`
- `frontend/yellow/src/ui/StatusBadge.tsx`
- `frontend/yellow/src/workspaces/OperationalHub.tsx`
- `frontend/yellow/src/workspaces/operational-data.ts`
- `tests/yellow-responsive-operational-shell.test.ts`
- `tests/yellow-workspace-performance.test.ts`
- `handoff/orders/582-responsive-operational-shell.md`
- `handoff/reviews/582-responsive-operational-shell.md`
- `handoff/LEDGER.md`

## Required behaviour

1. Add an `Operations` workspace through the existing governed property navigation.
   Load its implementation as a separate production chunk and preload it only on
   explicit hover, focus or navigation intent.
2. Provide an accessible segmented ribbon with a moving selected pill, keyboard
   navigation, 44px touch targets and horizontal containment on narrow screens.
3. The first operational hub covers the approved daily views—rooms, arrivals,
   departures and service—with concise cards backed only by existing authoritative
   reads. Missing or unavailable data is labelled honestly and never fabricated.
4. Secondary commands live in a contextual Options drawer. The main surface keeps
   the current decision, blockers and primary action visible without exposing an
   undifferentiated wall of actions.
5. Add a common status badge language: verified/ready may use the approved compact
   neon-green seal; warning, urgent and neutral states use flat icon-and-text badges.
   No LED dots, bulbs or decorative glow fields are introduced.
6. Preserve the accepted reservation, advance-deposit, billing, cashier, property
   setup, voice and navigation behaviour. The assistant remains silent unless the
   operator explicitly opens or addresses it.
7. Keep initial-load cost bounded: do not add a dependency; avoid duplicate reads;
   cache operational reads with React Query; keep the new workspace outside the
   initial application chunk; and avoid layout work for off-screen sections.
8. At 375px the ribbon, cards, drawer and mobile navigation remain usable without
   document-level horizontal overflow. Desktop keeps the existing information density.
9. Add a zero-extra-request Sources view: observed channel/source codes from the
   already-loaded arrival/departure reads are labelled live; Overture and certification-
   gated/private-spec OTA connectors stay visible but disabled with explicit dependency
   copy until their contracts are accepted.

## Exclusions

- No schema, migration, endpoint, service, journal, payment, posting, settlement,
  occupancy or reservation-state change.
- No simulated command success, automatic operational mutation, public deployment,
  native Android business logic or copied third-party PMS interface.
- Detailed finance, channel, revenue, group, audit and property-configuration
  workbenches remain follow-on orders mounted into this shell.

## Verification

- Component and source-contract tests for ribbon semantics, drawer behaviour,
  lazy chunking, honest data states and preserved navigation.
- Strict frontend TypeScript and production build, including proof that the
  operational hub is emitted as a separate chunk.
- Browser proof at desktop and 375px with no document overflow; compare against the
  founder-approved Yellow visual boards and record a five-point fidelity ledger.
- Regression tests for reservation finance entry and accepted advance deposits.
