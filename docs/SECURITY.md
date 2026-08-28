# SECURITY.md — threat model & controls (v1)

What we hold: guest PII, passport/ID numbers (statutory), payment TOKENS (never
PANs), owner financials, competitive rate data. What that makes us: a target.
This file is the checklist every phase builds against; Phase 0 CI enforces the
testable parts.

## 1. Authentication & sessions

- Passwords: `Bun.password` argon2id, per-user salt (built in). No password hints,
  no security questions. Reset via signed single-use token, 15-min TTL.
- Sessions: short-lived JWT (15 min) + rotating refresh token bound to device;
  refresh reuse detection revokes the family. JWT carries tenant_id + scopes;
  tenant NEVER read from request body (TC-13.3).

The current local workbench issues only the short-lived access token. Its HS256 signing
secret must be supplied by deployment or generated ephemerally by local setup; enabled
startup accepts no repository-known fallback. Secret rotation invalidates outstanding
access tokens and does not modify staff password hashes.
- MFA: TOTP for roles with financial or config scopes; enforced for owner/admin.
  SSO/SAML = enterprise trigger item (BUILD-PLAN parked).
- Kiosk: device-bound restricted token, no user session, rate-limited lookups.

## 2. Authorization

- Two layers, both mandatory: RLS in PG (tables AND views — TC-13.1/13.4) and
  scope checks in middleware before handlers. UI hides what scopes deny, but the
  API is the boundary.
- Approval_request gates: adjustments over threshold, trust-negative, seal
  override, erasure. Four-eyes by design, logged.
- api_client tokens: least-scope, per-integration, revocable, hashed at rest.

## 3. Data protection

- At rest: full-disk on OCI volumes + pgcrypto column encryption for identity
  document numbers (key in env-injected KMS file, never in repo).
- In transit: TLS everywhere (Caddy auto-cert internal, Cloudflare edge external);
  HSTS; TLS also on PG connections between nodes.
- Payment: tokens only (SAQ-A posture). PAN/CVV never in DB, logs, events, or
  error messages — a CI grep gate scans for PAN-shaped literals in fixtures/logs.
- Backups: pgBackRest to R2 with client-side encryption; restore drill monthly
  (doctrine) — an unencrypted backup is a breach in waiting.
- Logs: no PII in log lines; guest references by id. GlitchTip scrubbers on.

## 4. Application hardening

- Input: TypeBox validation at the edge (Elysia); SQL only via parameterized
  drivers; no string-built SQL (skill rule + review grep).
- Rate limiting: per-IP and per-token buckets at Caddy + app for auth, search,
  and booking-engine endpoints; Turnstile on public booking engine.
- The current loopback staff login implements the app-side portion in each process: a
  5-attempt source bucket refilling 20/minute, a 3-attempt normalized-account bucket
  refilling 8/15 minutes, 1/2/4/8/16/32/60-second failure backoff, four concurrent
  Argon2 verifications with no queue, and bounded 4,096/8,192-entry state. Only Bun TCP
  peer metadata selects the source; forwarded address headers are not trusted. This is
  not a shared multi-process or public-edge limiter.
- Headers: CSP (no inline script), frame-ancestors none (except kiosk origin),
  referrer-policy strict.
- Idempotency keys stored hashed; replay window 24 h.
- Dependency hygiene: Renovate + `bun audit` in CI; lockfile committed.

## 5. Tenant isolation failure modes (tested, not assumed)

- `yellow_runtime` is the tenant application, HTTP, worker, event and discovery
  login. It is `NOSUPERUSER`, `NOBYPASSRLS`, owns no Yellow object, and has one
  explicit membership edge: `yellow_runtime -> app_role`.
- `yellow_owner` is `NOLOGIN`, password-free, non-superuser and owns the public
  schema objects and bounded SECURITY DEFINER capabilities. `yellow_deploy` is a
  separate deployment/migration/seed/schema/referee administrator and is never
  present in an application environment. `app_role` remains an internal `NOLOGIN`
  capability role with no password or authentication path.
- `yellow_extension_registrar` is a separate `LOGIN`, `NOINHERIT` principal with
  connection limit four, zero membership/ownership/table/sequence authority, and
  only schema `USAGE` plus execution of the fixed extension-type registration
  command. Its max-two unprepared pool is reachable only after the authenticated
  platform-scope check and is never exposed as a generic transaction handle.
- Every application transaction establishes verified tenant context before
  `SET LOCAL ROLE app_role`; commit, rollback, nested failure and pooled backend
  reuse must restore `current_user = session_user = yellow_runtime` and clear the
  tenant setting. A hostile `RESET ROLE` can therefore return only to the runtime
  principal, which has no owner/deploy, DDL, cross-tenant or role-management power.
- Deployment tooling accepts only `YELLOW_DEPLOY_DATABASE_URL`; tenant application
  paths accept `YELLOW_RUNTIME_DATABASE_URL`, while the application alone also
  receives `YELLOW_EXTENSION_REGISTRAR_DATABASE_URL`. Migrate, seed and review seed
  never receive the registrar credential. All three credentials are distinct,
  generated/injected secrets and are never logged or committed.
- RLS through views — regression TC-13.4, permanent.
- SECURITY DEFINER choke points use the exact fixed search path
  `pg_catalog, public, pg_temp`, schema-qualify every Yellow relation and helper
  call, and deny `EXECUTE` to `PUBLIC`. `app_role` may execute only the
  occupancy record/release entry points; business-day sealing, outbox pruning,
  legacy hold expiry, and day-open assertion remain owner-only. Owner-only day
  sealing is a temporary least-privilege containment boundary, not the continuous
  day-close product: a future application path must be an authorized, audited
  domain command with server-derived actor evidence before it receives narrowly
  scoped execution authority. A hostile
  `pg_temp` proof must show that temporary shadow objects are neither invoked
  nor modified. These namespace and ACL controls contain definer escalation;
  they do not replace caller tenant validation or RLS.
- Cross-tenant IDOR: API handlers must scope EVERY query by session tenant even
  though RLS backstops — belt and braces, and the tests hit both.

### Positive runtime-DML boundary (migration 0016)

The runtime role must have a positive, machine-checked mutation catalogue rather
than blanket `app_role` table grants. Migration 0016 preserves only table/column
operations exercised by current production callers; it grants no mutation on
future tables, views, global coordination tables, tenantless metadata or
immutable records by default. `document` remains runtime-immutable and
`rate_price` permits only `UPDATE (superseded_by)`. Outbox publication is
function-mediated and must not remain a direct runtime update.

Canonical demo and review seed are deploy/tool operations. The external
`yellow_deploy` caller creates and verifies global tenant/property seed rows;
`app_role` performs only the exact tenant-context visibility/idempotency probe.
Runtime coordination, occupancy, due-hold discovery, extension reads,
publication marking and pruning use their existing signature-specific functions.

Account and folio rows expose no direct runtime `UPDATE` authority. Financial
commands obtain only structural row locks through
`lock_financial_rows(tenant, account_ids, optional_folio)`: a non-mutating,
owner-mediated function callable only after the trusted runtime transaction has
entered `app_role`. It accepts one or two distinct tenant accounts, locks them in
UUID order, optionally locks a folio belonging to that set, returns no business
data, and fails without identifying a missing or foreign target.

Extension-type registration is `register_extension_type(tenant,type,schema,actor,
property,request)`, not direct runtime DML. The `yellow_owner` function verifies the
dedicated session principal and audit authority, derives the UUIDv5 subject, and
atomically writes the global type plus one insert-only tenant fact; identical replay
returns false without another fact and divergence fails. Runtime, `app_role` and
`PUBLIC` cannot execute it or directly insert the catalogue row.

Named residual capability debt remains for approval decisions, extension
publication/retirement, hold transitions, inventory-policy and projection
replacement, operational-block updates, reservation/segment/guest lifecycle,
folio numbering, journal/posting transitions beyond this structural lock, and future task/fiscal/statutory or
document mutation. Extension publication/retirement remains separate debt; the
registration exception from D-417 is closed by migration 0018.

### Governed housekeeping transition containment (migration 0026)

Runtime has no direct `INSERT`, `UPDATE` or `DELETE` authority over `task` or
`unit_condition`. Migration 0026 adds one fixed-search-path owner-mediated capability
for the three Order-201 adjacent transitions only. It verifies the dedicated runtime
session/app role, exact tenant context, active actor and property, eligible
housekeeping/space task, active same-property space, authoritative condition and all
expected stale guards while holding the affected rows. `PUBLIC` and direct login
execution remain denied.

HTTP authority is separately least-scoped: `housekeeping.tasks:read` reads the board,
`housekeeping.tasks:work` starts/completes, and the distinct
`housekeeping.tasks:inspect` permission verifies. Tenant/property/actor/target state
are server-derived; foreign ids are concealed and browser-supplied authority is
ignored. The capability cannot create, assign, cancel or reopen tasks and cannot
write sheets, occupancy, reservations, financials, days or statutory records.

### Governed housekeeping sheet-generation containment (migration 0027)

Runtime has no direct `INSERT`, `UPDATE` or `DELETE` authority over `task_sheet` or
`task`. Migration 0027 provides one fixed-search-path owner-mediated generation
capability. It validates the dedicated runtime/app-role context, transaction-local
tenant, active actor/property, one active same-tenant staff attendant, exact
property-local date, effective tenant-over-global vertical profile, current in-house
segment and sanctioned same-space occupancy while holding the deterministic decision
keys. `PUBLIC`, direct login and raw runtime DML remain denied.

HTTP authority is least-scoped separately: `housekeeping.sheets:read` permits preview
and current-sheet reads; `housekeeping.sheets:generate` permits the deliberate write.
Tenant, property, actor, room set, cadence, occupancy, task state and task identity are
server-derived. Weekly/custom/missing/mixed/ambiguous cadence, foreign or inactive
staff and hostile property/actor ids create no sheet, task, fact, outbox or
idempotency artifact. The capability cannot mutate task lifecycle, room condition,
reservation, segment, occupancy, financial, business-day, key or statutory truth.

### Departure-readiness read containment

The Order-203 query is reachable only after the HTTP adapter proves
`stay-operations.checkout:read` and the exact property grant. The domain service then
validates exact lowercase UUID input and rebinds tenant/property/reservation inside a
transaction-local RLS context. Its single PostgreSQL statement joins only the
authorized reservation to operational segment, room, sanctioned segment occupancy and
reservation folio evidence; foreign or mismatched targets return the same concealed
not-found outcome.

The deeply frozen response excludes Party, contact, identity-document, reservation
note and payment-instrument data. It returns only operational identifiers, room code,
period boundaries, folio presentation labels/status/currency and canonical decimal
balance. The query has no mutation capability and creates no fact, outbox or
idempotency evidence. A ready snapshot is not a checkout authorization and cannot
release occupancy, settle/close a folio, close an account or transition reservation or
segment state.

### Governed checkout command containment

The write route is separately protected by `stay-operations.checkout:commit` and the
exact property grant. Its accepted HTTP body is empty; the adapter constructs the
actor-bound `reservation.checked_out` envelope and the domain independently validates
tenant, property, actor, reservation and idempotency identity. Foreign property,
tenant, actor or target authority is concealed and creates no durable artifact.

The command obtains deterministic reservation/segment locks, then locks the one
canonical guest account and every reservation folio only through the existing
owner-mediated financial-row capability. It revalidates the fixed readiness blockers
under those locks. Occupancy is released only through
`ReservationOccupancyService.releaseForSegment`; raw runtime status and occupancy DML
remain denied. Guarded non-lengthening state updates, release, idempotency, fact and
outbox evidence share one rollback boundary, including publication failure and
concurrent settlement or segment-change arbitration.

Facts and events contain minimized operational ids, states, periods, release count and
folio status/balance evidence only. They exclude names, contacts, identity documents,
notes and payment instruments. Checkout has no authority over account/folio state,
ledger, payment, business day, room condition, housekeeping, keys, documents,
statutory or fiscal truth.

### Vehicle-register read containment

The Order-205 read route requires the exact `stay-operations.vehicles:read` scope and
exact property grant before composition. The service independently validates the
server-derived tenant/property identity and executes under transaction-local RLS.
Linked reservation visibility is re-proven against both tenant and exact property;
linked Party visibility is re-proven against tenant. A missing proof fails the entire
read with one bounded association error and never returns the hostile identifier.

The minimized response excludes vehicle notes and `parking_space`, as well as Party
names, contacts, identity records and reservation content. Entry/exit timestamps are
returned only as recorded and convey no inferred onsite, access or security verdict.
Literal plate lookup and canonical keyset pagination do not expand authority. This
read has no write capability and cannot call occupancy, parking, vehicle lifecycle,
task, fact, outbox or idempotency paths.

### Vehicle-register exact-detail containment

Order 216 reuses `stay-operations.vehicles:read` and the exact server-derived property
grant for one no-query vehicle UUID route. The service independently validates the
server tenant, property and vehicle identities inside transaction-local RLS, then
re-proves a linked reservation against the same tenant and exact property and a
linked Party against the same tenant. Missing, foreign and wrong-property identities
are concealed as not found. A hostile stored association fails the entire read as a
bounded conflict without returning the foreign identifier or partial vehicle data.

The no-store response is re-minimized to the already approved vehicle-register row:
literal registration, nullable make/model/colour/driver, optional reservation/Party
identifiers and literal entry/exit timestamps. It excludes notes, parking or space
truth, names or contacts, occupancy, tasks, access decisions and inferred onsite
state. The route has no mutation, polling or generic vehicle authority.

### Arrival-travel board containment

Order 206 reuses the existing reservation-board route, exact property grant and
`reservations.lifecycle:read` scope; it creates no travel-specific authority. The
domain query remains inside transaction-local tenant RLS, selects only
`travel_detail.direction='arrival'`, and re-proves an optional pickup-task reference
against both the active tenant and exact property. A missing, cross-tenant or
cross-property association fails the entire read with a bounded conflict and does not
return the hostile identifier.

The deeply frozen nested projection contains only validated literal mode, nullable
carrier/service/schedule, pickup-requested and association-presence values. It excludes
travel/task ids, notes, task state/assignment/payload, departure travel, Party/contact
data and inferred pickup outcome. Its joins do not change the existing created-at/id
keyset order, filters, cursor bytes or limit, and the read has no mutation, fact,
outbox, idempotency, occupancy, queue or task capability.

### Departure-travel board containment

Order 207 reuses that same reservation-board route, exact property grant and
`reservations.lifecycle:read` scope; it creates no departure- or travel-specific
authority. The domain query remains inside transaction-local tenant RLS and selects
only the row whose tenant, reservation association and
`travel_detail.direction='departure'` match the already-authorized board row.

The deeply frozen nested projection contains only validated literal mode and nullable
carrier, service number and scheduled instant. It excludes pickup/drop-off meaning,
pickup flags, travel/task ids, notes, task state/assignment/payload, Party/contact,
vehicle/parking and inferred transport outcome. Arrival stays a separate projection.
Neither join changes the existing created-at/id keyset order, filters, cursor bytes or
limit; repeated reads are mutation-free and have no fact, outbox, idempotency,
occupancy, task, queue or travel-write capability.

### Governed reservation-travel capture

Order 212 adds one fixed-search-path `SECURITY DEFINER` capability for the exact
arrival/departure resource command. It admits only a `yellow_runtime` session that has
assumed `app_role`, executes as `yellow_owner`, and matches the transaction-local
tenant context. The capability independently re-proves the active actor, exact property,
exact reservation and a modifiable reservation state while locking reservation and
travel truth. Direct app-role and runtime `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE`
authority on `travel_detail` remains denied.

Create requires expected absence; replacement requires exact normalized tuple evidence.
The capability refuses stale evidence, all-empty desired truth, departure pickup intent,
wrong property/tenant/state and a changed row already linked to pickup work. An existing
task reference must resolve in the same tenant and exact property even for an exact
no-op. The command cannot accept or return notes or task ids, cannot mutate tasks, and
cannot touch Party/contact, vehicle/parking, occupancy, financial or statutory truth.
Only a changed tuple is coupled to one actor-bound fact and one same-transaction outbox
event; idempotency, fact and event publication roll back with the travel write.

### Governed arrival pickup-task automation

Order 213 adds one fixed-search-path owner capability for the specialized durable
consumer. Only a `yellow_runtime` session that assumed `app_role` under the exact
transaction-local tenant may execute it. The capability independently locks and
re-proves active actor, exact property, exact `reserved|due_in` reservation and its
current arrival row. It creates only the canonical minimized transport guest-request
task and links only that newly created same-tenant, same-property task. Raw runtime
and app-role `task` and `travel_detail` write authority remains denied.

The consumer never trusts source payload identity or eligibility. Its marker, task,
link, fact and outbox event share one transaction, so crashes and concurrent drainers
cannot duplicate work. Foreign tenant/property/association, false pickup, missing
schedule, terminal state and an existing link are no-op or fail closed. No capability
exists here to mutate task lifecycle, assignee, priority, travel, Party/contact,
vehicle/parking, occupancy, finance or statutory truth.

### Reservation-scoped pickup-task detail containment

Order 215 adds one read-only route behind the existing
`reservations.lifecycle:read` scope and exact property grant. The adapter rejects any
query authority and validates all three path identities before a tenant transaction.
The domain read independently re-proves the exact reservation, its current arrival
link and the complete canonical transport-task shape. Foreign, stale, wrong-property
or unlinked task identity is concealed as not found; a hostile currently linked row
fails closed as conflict without disclosing partial task data.

The response is re-minimized to reservation/task identity, confirmation number,
canonical status and task timing only. It excludes payload, Party/contact/assignee,
notes, driver, vehicle, dispatch, property/tenant identity and internal transport
details. Every result is no-store. No generic task scope, cross-kind lookup, polling
or task lifecycle command is introduced.

### Room-condition board containment

Order 208 adds one read-only route behind the existing
`housekeeping.tasks:read` scope and exact property grant. The HTTP adapter accepts
only one optional literal condition, one canonical opaque cursor and a bounded limit;
duplicate, malformed and extra query authority is rejected. Missing grants and
foreign properties are concealed before the service read. Every response, including
failure, is `Cache-Control: no-store`.

The domain read independently rebinds the server-derived tenant and exact property
under transaction-local RLS and selects only active physical rooms with canonical
condition truth. The adapter re-minimizes the response to room id, code, floor,
condition and update instant. It cannot disclose updater identity, task/assignee,
occupancy, reservation/guest, OOO/OOS, readiness, source/reason or inferred status.
The Order-208 read itself has no condition-write authority, task transition,
condition, space, occupancy, reservation, fact, outbox or idempotency capability.

### Governed initial room-condition containment (migration 0030)

Migration 0030 adds one fixed-search-path owner-mediated, insert-only capability for
an absent `unit_condition`. It admits only the dedicated runtime/app-role context,
transaction-local tenant, active actor, exact property and one active same-property
space. The parent space is locked before absence is proved, so concurrent first
writes converge to one insert while every existing condition fails as a stale
conflict. Only `clean`, `dirty` and `pickup` are accepted; `inspected` remains reserved
for governed verification. `PUBLIC`, direct-login execution and raw runtime
`INSERT`, `UPDATE`, `DELETE` and `TRUNCATE` remain denied.

The separate exact-property `housekeeping.conditions:initialize` permission grants
only this bounded first write. Tenant, property, actor, updater, timestamp and prior
absence are server-owned. Actor-bound idempotency, the condition insert, one minimized
`unit.condition_changed` fact and one matching outbox event commit in the same
transaction. The capability cannot read or mutate tasks, reservations, check-in,
occupancy, OOO/OOS, financials, business days, documents or statutory state.

### Housekeeping-task exact-detail containment

Order 217 adds one read-only exact-task route behind the existing
`housekeeping.tasks:read` scope and exact property grant. The adapter rejects every
query parameter and validates both path identities before the service read. Missing
scope is forbidden, while an ungranted property and concealed task identity share the
same not-found boundary.

The domain read independently re-proves an eligible housekeeping task, its active
physical room and canonical room-condition truth under tenant-local RLS. Ambiguous or
hostile stored shape fails closed as conflict without returning partial detail. The
adapter explicitly re-minimizes the result to the Order 217 task fields, excludes
assignee identity, payload, notes, guest, reservation, occupancy and financial data,
and makes every response no-store. The human route serves the existing operator shell;
it adds no transition, assignment, mutation, polling or generic task authority. The
Order 201 board and lifecycle actions remain unchanged.

### Governed arrival pickup-task dispatch containment (migration 0031)

Migration0031 adds one fixed-search-path owner-mediated capability callable only by
the dedicated `yellow_runtime` session after it assumes `app_role` with an exact
transaction-local tenant. The capability locks and re-proves active actor, exact
property/reservation/arrival link, complete canonical Order213 task shape and current
expected status/assignee evidence. Assign also re-proves an active same-tenant Party
with an exact `staff` role. `PUBLIC`, direct-login execution and raw runtime task DML
remain denied.

Assignment and work use separate exact-property scopes. Both the HTTP adapter and
domain capability bind the task to the reservation-scoped arrival link; knowing a
task UUID cannot create generic task authority. Actor-bound idempotency, task update,
one minimized fact and one matching outbox event commit atomically. Foreign, stale,
hostile and non-adjacent requests write nothing, and no contact, note, payload,
driver, vehicle, parking, occupancy, financial, business-day or statutory data is
accepted or returned.

## 6. Statutory & privacy

### Token-only payment containment

Runtime may select and insert only the enumerated columns on payment operations,
attempts and provider receipts; update/delete/truncate remain denied. Every new table,
key, index, RLS policy and reference is tenant-leading. The only provider credential is
an opaque active instrument token delivered directly to the provider port in memory.
PAN, CVV, raw callbacks and secrets are forbidden from source, schema, seeds, logs,
facts, outbox and reconciliation storage. Operation and financial-row locks serialize
money decisions; receipts and effects commit atomically.

Hosted deposit links add a bearer surface without adding payment credentials. The
256-bit raw bearer is shown once, is sent only in the guest URL, and is never persisted,
logged, emitted, cached, stored by browser APIs or forwarded to the provider origin.
Provider handoff and callback use non-secret correlation plus bounded, expiring HMAC
signatures; callback verification covers exact raw bytes and path before parsing.
Guest/provider pages are same-product but separate origins with no-store/no-referrer,
strict CSP, no cookies and no third-party assets. Operator creation, status and
application retain separate scopes and exact property grants.

- Identity data retention per country config; scheduled anonymisation after the
  legal window. Erasure = anonymise party, preserve financial rows (GDPR
  Art. 17(3)(b)) — TC-8.5.
- Statutory submissions logged with receipts; transport per adapter (SFTP host
  keys pinned, REST over TLS).

## 7. Ops & incident basics

- Secrets: .env files never committed; per-environment; rotated on offboarding
  (it's two founders — still write it down).
- Access: SSH via Cloudflare Tunnel + key auth only; no password SSH; no shared
  accounts.
- Incident: severity ladder + a one-page playbook (isolate → snapshot → rotate →
  notify affected tenants per contract/law). Draft the tenant-notification
  template BEFORE you need it.
- Audit trail: every mutation carries actor + correlation id (kernel envelope);
  fact_log + insert-only financials make tampering evident.

## 8. What we deliberately do NOT do (yet)

- No SOC 2 audit pre-revenue (controls above are SOC-2-shaped so the audit is a
  documentation exercise later — enterprise trigger).
- No WAF beyond Cloudflare free rules; revisit at first attack pattern.
- No field-level encryption beyond identity docs; revisit with first Gulf
  enterprise contract.
