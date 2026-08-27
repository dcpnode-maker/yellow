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
