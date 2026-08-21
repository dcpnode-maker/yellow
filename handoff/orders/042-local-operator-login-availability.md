# Order 042 — Local authenticated operator login and availability workbench

**Phase:** 2 · Minimal experience 1/4
**Branch:** `phase-2/operator-login-availability`
**Tier:** 3 — authentication, authorization, tenant-scoped HTTP, and operator UI
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Give the founder a real localhost browser surface that authenticates a staff user and
searches the same PostgreSQL-truth availability used by application code, including
restriction and OOO/OOS explanations.

## Scope

- `DECISIONS.log`
- `handoff/orders/042-local-operator-login-availability.md`
- `docker-compose.yml`
- `src/app.ts`
- `src/server.ts`
- `src/contexts/identity/index.ts`
- `src/contexts/identity/local-login.ts`
- `src/http/operator.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `tests/operator-workbench.integration.test.ts`

## Required behavior

1. Add a local-login service that accepts a bounded exact tenant slug, normalized email,
   and password; resolves the active tenant as `app_role`, establishes transaction-local
   tenant context, loads one active user plus deduplicated valid permission scopes, and
   verifies only Argon2id through the existing password primitive. Unknown tenant/user,
   wrong password, inactive user, and legacy hash all return the same result after a
   dummy Argon2 verification path. No request supplies a tenant UUID, actor id, or scope.
2. `POST /api/v1/auth/local:login` returns one existing 15-minute JWT only for a valid
   login. It has a bounded JSON body, generic 401 failure, `Cache-Control: no-store`, and
   is present only when the operator module is explicitly configured.
3. `POST /api/v1/properties/:property/availability:search` runs through the existing
   bearer resolver and transaction-local tenant middleware. Require actor id and
   `inventory.availability:read`, then prove a current `user_role` grant whose org scope
   is the exact property or an ancestor. The body accepts only bounded ISO instants,
   optional party size/rate-plan/channel dimensions, and calls `AvailabilityService`.
   A protected `GET /api/v1/me/properties` lists only property descendants of the
   current user's org grants so the browser never needs a hard-coded property UUID.
4. Return physical count, bookability, restrictions, and operational-block evidence
   without reshaping away reasons. Every JSON response carries a correlation id; stable
   generic 400/401/403 error bodies expose no database or credential detail.
5. Serve a no-build, same-origin workbench at `/` and `/p/:property/availability` with
   external CSS/JS only. It provides tenant/email/password login, an explicit UTC-instant
   availability form, visible loading/error/empty states, keyboard-submit behavior,
   responsive accessible option cards, and blocker/warning explanations. It must not
   claim rate/quote data that does not exist.
6. Keep the access token in JavaScript memory only: no local/session storage, URL,
   cookie, DOM attribute, or log. Reload intentionally requires login until refresh,
   revocation, MFA, and recovery receive later orders.
7. Runtime composition enables the workbench only with
   `YELLOW_OPERATOR_WORKBENCH=1`, `DATABASE_URL`, and a >=32-byte
   `YELLOW_TOKEN_SECRET`; missing required configuration fails startup. With the flag
   absent, the existing health-only app remains exact and database-free.
8. Local Compose binds the app to `127.0.0.1` by default and provides only explicitly
   labelled development database/JWT defaults. Direct workbench startup also defaults
   to loopback and fails closed on a non-loopback `HOST`, while Compose explicitly opts
   the container into its internal interface behind the host loopback mapping;
   the runtime enforces a 16 KiB request-body ceiling. It does not expose the service
   publicly or seed/change credentials.
9. Keep interaction and presentation separate. The preview exposes Apple-calm and
   Pixel-expressive skins through semantic CSS tokens and an accessible in-memory
   selector; both skins retain identical content, routes, actions, focus treatment,
   protected status colors, and responsive behavior. No preference or token persists.

## Forbidden

- Any user/role/permission bootstrap or credential mutation; refresh tokens, cookies,
  password change/recovery, MFA, SSO, public deployment, third-party assets, inline
  script/style, analytics, or token persistence.
- Any inventory, hold, restriction, OOO/OOS, policy, rate, quote, projection, cache,
  migration, RLS, occupancy function, journal/fiscal, referee, or dependency change.
- Direct table mutation from HTTP/UI, caller-supplied tenant/actor/scopes, generic SQL
  explorer, hard-coded authentication success, self-approval, or merge.

## Pre-registered proofs

- **P1:** valid Argon2 staff login returns a verifiable exact-claim JWT whose subject,
  tenant, and scopes come only from database rows; the endpoint is `no-store`.
- **P2:** unknown tenant/user, wrong password, inactive user, invalid/legacy auth, body
  bounds, and duplicate/case variants return the same generic status/body and no token.
- **P3:** missing/malformed/expired bearer is 401; authenticated missing scope is 403;
  scope without an exact/ancestor property grant is 403; no availability query runs.
- **P4:** an exact and an ancestor grant each appear in the protected property list and
  authorize the real availability service; foreign tenant/property remains invisible
  and response evidence is exact.
- **P5:** database failure during login/search is a controlled generic error; rejected
  and throwing requests release a reusable connection with tenant context cleared;
  transaction setup/commit failures cannot leak internal errors through the framework.
- **P6:** static HTML/CSS/JS are same-origin with correct content types and security
  headers; source contains no inline executable/style content, third-party URL, token
  persistence API, or fabricated sample result; runtime source proves loopback-by-default
  workbench binding and the explicit 16 KiB request-body ceiling.
- **P7:** disabled runtime preserves exact `/health`, leaves protected/operator routes
  absent, and acquires no database connection.
- **P8:** typecheck, boundaries, full tests, existing auth/tenant/availability proofs,
  container smoke, schema drift, and canonical 11/11 remain green.
- **P9:** both named skins are selectable from the same HTML/JS and differ only through
  CSS custom properties/selectors; neither introduces storage, external assets, hidden
  safety states, duplicate routes, or duplicate business logic.

## Standing checks

Run the Order 042 HTTP/database/browser-source proof plus the named existing proofs;
typecheck, boundaries, full tests, licence/audit, schema drift, and
`./setup.sh --db-only`. Build and start the local Compose app against a prepared local
test identity, verify login and availability through HTTP, refresh Graphify, commit,
push, and open a draft descendant PR. Do not expose publicly, approve, or merge.
