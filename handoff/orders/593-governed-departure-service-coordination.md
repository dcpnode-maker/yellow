# Order 593 — governed departure service coordination

## Objective

Turn the guided checkout's truthful “not recorded” service gaps into a real,
confirmation-gated hotel workflow. A colleague may request luggage pickup, a minibar
check, or a room inspection for one active departure; route or escalate that work to
configured hotel duty roles; and follow it through a durable staff queue from open to
completion. The UI must preserve the approved checkout ribbon and depth cards and
must never convert an AI suggestion, task creation, or task completion into a charge,
liability decision, room-condition change, or invented physical observation.

## Source authority and coordination

- Begin from the exact current public serving source at
  `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.
- Implement in one isolated candidate at
  `D:\Yellow\temp\order593-departure-coordination-source`.
- Backend, fixture and frontend agents may work in parallel only in the disjoint
  paths assigned below. The primary Codex agent integrates and owns the contract.
- This is high-risk work: it adds tables, permissions and state transitions. A
  non-implementing reviewer must personally execute the PostgreSQL proof and public
  candidate proof before any deployment.

## Product contract

### Admitted services and meaning

- `luggage_pickup`: immediate, +10, +15, +30, +45 minutes, or a confirmed custom
  property-local instant.
- `minibar_check`: a request for a human to inspect and report.
- `room_inspection`: a request for a human to inspect damage or missing items and
  report.
- A completed check means only that an assigned colleague recorded one bounded
  outcome: `clear`, `finding_reported`, or `unable_to_complete`.
- A finding never posts a charge, changes a folio, accepts guest liability, changes
  housekeeping condition, alters occupancy, or resolves an incident.

### Proposal and confirmation

- Choosing a service, time, role, or assignee creates no operational work.
- The server persists an exact, expiring proposal. A separate explicit confirmation
  binds the proposal version and expected reservation/segment/room/departure
  evidence, then creates exactly one canonical `guest_request` task atomically.
- The same proposal cannot create duplicate work after idempotency retention expires.
- Only `in_house` or `due_out` reservations with one coherent current occupied room
  may receive a new proposal. Confirmed work remains visible and may finish after
  checkout; checked-out stays cannot create new requests.
- Requests do not block checkout in this order. Checkout, settlement and every
  service request retain separate confirmations and idempotency keys.
- Immediate is server transaction time. A scheduled request must be in the future
  and no later than six hours after the recorded departure instant. The API returns
  both canonical UTC and property-local display evidence.
- One non-withdrawn request per service and departure episode is canonical. Pending
  proposals may be withdrawn. Confirmed requests are not silently cancelled,
  replaced, reopened, or retargeted.

### Work and escalation

- Reuse canonical `task` lifecycle: `open → assigned → in_progress → done`.
- Assignment revalidates one active `party_role='staff'` Party. State changes are
  adjacent, compare-and-swap, actor-bound and idempotent.
- Minibar and room-inspection completion require one bounded outcome. Luggage
  completion records delivery only; it records no physical-room conclusion.
- Escalation is a second explicit proposal and confirmation linked to the parent
  request. It targets one active property-scoped configured role and creates a
  separate role-queue task without changing the parent task's state.
- The admitted synthetic duty roles are exactly: `Front Desk Cashier`,
  `Housekeeping Desk`, `Housekeeping Team Lead`, `Assistant Manager`, and
  `Duty Manager`. These are RBAC/routing roles, not claims about a real employee.
- No cash drawer or cashier session is required to request or coordinate departure
  services. Existing financial authority is unchanged.

## Backend scope

- `migrations/0099_governed_departure_service_coordination.sql` (new)
- `src/contexts/stay-operations/departure-service-coordination.ts` (new)
- `src/contexts/stay-operations/index.ts`
- `src/http/operator.ts`
- `src/app.ts`
- `docs/CONTRACTS.md`
- `docs/STATE-MACHINES.md`
- `docs/EVENTS.md` only if clarification is needed; reuse existing `task.created`
  and `task.status_changed`, do not invent equivalent events.
- Focused unit, HTTP, integration, concurrency, idempotency, DML-authority and
  tenancy tests whose filenames contain `departure-service`.

## Fixture and role scope

- `scripts/seed-review.ts`
- Focused seed tests whose filenames contain `departure-role` or
  `departure-service-fixture`.
- `tests/review-seed.integration.test.ts` only for the exact requester and approver
  token-scope oracles affected by adding the six governed departure permissions.
- Seed the five exact synthetic roles, least-privilege permission grants, active
  synthetic app users, property-scoped `user_role` grants, and active staff Parties
  required to demonstrate assignment. Fixtures must be deterministic, idempotent,
  collision-failing and visibly labelled synthetic/local-review.
- Do not relabel the existing review operator, financial approver, or Avery
  Housekeeping. Do not claim an app-user-to-Party identity relation that the schema
  does not contain.

## Catalogue and release-readiness scope

Migration 0099 adds one forced-RLS table and becomes the source migration frontier.
Update only the mechanical current-catalogue assertions required to make the exact
candidate truthful and bootable; do not rewrite historical per-migration assertions.

- `src/kernel/build-info.ts`
- `setup.sh`
- `setup.ps1`
- `.github/workflows/release.yml`
- `scripts/local-review.sh`
- `tests/build-readiness.test.ts`
- `tests/release-workflow.test.ts`
- `tests/free-host-arm64.test.ts`
- `tests/setup-current-catalogue-oracle.test.ts`
- `tests/schema/expected.sql`
- Existing integration tests that assert the final complete catalogue's exact
  migration/table/RLS/policy/forced-RLS totals. Scope is limited to those numeric
  current-frontier assertions; assertions for an earlier migration's isolated shape
  remain unchanged.

## Frontend scope

- `frontend/yellow/src/yellow-api.tsx`
- `frontend/yellow/src/workspaces/ReservationWorkspace.tsx`
- `frontend/yellow/src/workspaces/OperationalHub.tsx` only for the role-visible
  departure queue entry and detail surface.
- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/voice.ts`
- `frontend/yellow/src/styles.css`
- Focused frontend/source/browser tests whose filenames contain
  `departure-coordination` or extend `yellow-guided-checkout.test.ts` and
  `yellow-voice-routing.test.ts`.

## UI acceptance

1. Preserve the existing five checkout ribbon tabs and exactly two aria-hidden,
   pointer-inert depth cards. Put coordination cards inside the Room and Services
   panels; do not add another top-level rail.
2. Unknown minibar, damage and missing-item evidence remains explicitly “Not
   recorded.” It never appears as clear, complete, none, or no damage.
3. Services shows exactly Immediate, 10, 15, 30, 45 and Custom timing choices.
   Selection alone performs no write. Custom validates and displays the canonical
   property-local instant before confirmation.
4. Each service and escalation has its own proposal, confirmation, progress,
   idempotency key and verified receipt. “Yes” may confirm only one unambiguous,
   current pending proposal.
5. The queue exposes role target, due time, assignee, status and bounded outcome,
   with only server-admitted next actions. It remains usable at 240, 375 and 1440px.
6. All status colours use the existing restrained Yellow palette and contrast-safe
   neon accents; no bulb illustration, exaggerated bloom or inaccessible colour-only
   meaning.
7. Existing completed-checkout retrieval remains read-only. It may display retained
   service history but exposes no new request control.
8. Typed or voice departure commands create text/proposals only. They do not mutate
   until a distinct confirmation and do not claim physical facts.

## Data and authority requirements

- Add a typed `departure_service_request` proposal/intent table with tenant-leading
  indexes, forced RLS, tenant-bound parent relationships, durable business
  uniqueness, bounded service/outcome fields, proposal expiry/version, confirmed
  actor/time, canonical task linkage, role target and parent escalation linkage.
- Do not grant generic `task` DML. Use narrow owner-mediated capabilities with the
  same runtime/session/tenant/actor/parent-lock discipline as migrations 0029/0031.
- Every material change writes minimized `fact_log` and existing task outbox events
  in the same transaction. No guest contact data, identity material, free-text
  allegation, photo, value, payment data or full reservation JSON enters task
  payload, facts, outbox or idempotency responses.
- JSONB lookup uses `@>` against GIN or typed columns. No `->>` predicate.
- Add exact permissions for read, propose, confirm, dispatch, work and escalate;
  do not widen checkout, housekeeping, arrival-pickup or finance permissions.
- Foreign tenant/property/reservation/segment/room/task/role identifiers fail closed
  without existence disclosure.

## Required proof

1. Twenty concurrent confirmations converge to one request/task/fact/event, including
   mixed idempotency keys; changed actor/property/proposal/version/schedule conflicts.
2. Replay after idempotency expiry cannot duplicate canonical work.
3. Concurrent assign/start/complete admits one adjacent transition; stale losers
   write no evidence.
4. Confirmation racing checkout, departure amendment, room move, withdrawal or
   expiry fails safely and leaves no partial state.
5. Role or assignee deactivation and grant removal are revalidated at the command.
6. Wrong session/role capability calls and raw DML are denied.
7. Publication failure rolls proposal/task/result/fact/idempotency state back; exact
   retry succeeds.
8. Bounded outcomes have no housekeeping, occupancy or financial side effects.
9. Deterministic fixture reruns are byte-stable and collisions fail loudly.
10. Unit/HTTP/integration suites, strict TypeScript, Vite build, licence policy,
    import-boundary CLI and fresh `setup.ps1 -DbOnly` all pass.
11. Browser proof at 240/375/1440 covers proposal-only no-write behavior,
    confirmation, queue progression, retained history, unknown evidence, keyboard
    access and viewport containment.
12. Independent reviewer records commands, results and frozen hashes in
    `handoff/reviews/593-governed-departure-service-coordination.md`.

## Exclusions

- No automatic minibar/damage posting, guest-liability decision, inventory
  deduction, photo/evidence upload, maintenance/lost-property case, SMS/email/WhatsApp
  delivery, auto-dispatch timer, reminder worker, cash-drawer requirement, payment,
  settlement, checkout-state or room-condition mutation.
- No generic workflow engine, new microservice, Kafka, external vendor, paid service,
  scraping, provider credential, Android implementation, public deployment, merge,
  push or whole-PMS completion claim.
- No edit to `migrations/0001_init.sql`.
