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
- Headers: CSP (no inline script), frame-ancestors none (except kiosk origin),
  referrer-policy strict.
- Idempotency keys stored hashed; replay window 24 h.
- Dependency hygiene: Renovate + `bun audit` in CI; lockfile committed.

## 5. Tenant isolation failure modes (tested, not assumed)

- RLS through views — regression TC-13.4, permanent.
- SECURITY DEFINER functions: every one takes explicit p_tenant and filters on
  it; new definer functions require review against this list.
- Cross-tenant IDOR: API handlers must scope EVERY query by session tenant even
  though RLS backstops — belt and braces, and the tests hit both.

## 6. Statutory & privacy

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
