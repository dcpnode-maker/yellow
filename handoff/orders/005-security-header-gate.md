# ORDER 005 — Security header and CSP gate

**Phase:** 0 · **Branch:** `phase-0/security-header-gate` · **Tier:** 1 (routine)
**Written by:** OpenAI Codex, acting as temporary architect by founder request while Claude is unavailable · **Date:** 2026-08-14
**Depends on:** Order 004 commit `5f807bf`; review later as `phase-0/license-policy-gate..phase-0/security-header-gate`

## Goal

Apply a restrictive application-wide security-header policy and prove the CSP contains no third-party origins.

## Why now

This implements the remaining routine Phase 0 CSP gate in `BUILD-PLAN.md` and `DECISIONS.log` without adding UI, authentication, persistence, or domain behavior.

## Scope — files Codex may create or change

- `src/http/security-headers.ts`
- `src/app.ts`
- `tests/security-headers.test.ts`
- `tsconfig.json`

Anything not listed here is OUT of scope. If another file is required, STOP and ask in `handoff/questions/005.md`; do not widen scope silently.

## Contracts to honour

- `PROJECT.md` — verification doctrine and dependency restrictions
- `docs/SECURITY.md` §4 — CSP, framing, and referrer controls
- `DECISIONS.log` entry 39 — zero-third-party-origin CSP test
- Order 001 — `/health` response body and process-liveness semantics remain unchanged

## Required implementation

- Export one immutable security-header map and apply it to every Elysia response before route handling.
- Add no dependency; use Elysia's response `set.headers` API.
- CSP must include restrictive directives for default, base, object, frame ancestors, scripts, styles, images, fonts, connections, and form actions.
- CSP may use only `'self'`, `'none'`, and scheme-free directive keywords; forbid wildcard, host, URL, protocol-relative, `data:`, and `blob:` sources.
- Forbid `'unsafe-inline'`, `'unsafe-eval'`, and `'wasm-unsafe-eval'`.
- Include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a strict referrer policy, restrictive permissions policy, and HSTS.
- Test the actual in-process `/health` response for every expected header.
- Parse the CSP in the test and fail if any source token is a third-party origin or forbidden source.
- Preserve HTTP 200 and exact JSON `{ "status": "ok" }`.

## Definition of done

- [ ] Actual `/health` response includes the complete expected security-header map
- [ ] CSP test proves no wildcard, host, URL, protocol-relative, `data:`, `blob:`, inline, or eval source exists
- [ ] Existing exact health response test remains green
- [ ] `bun run license-check`, `bun run typecheck`, and plain `bun test` pass
- [ ] Rebuilt `yellow-app` is healthy and returns the expected headers over host HTTP
- [ ] `setup.ps1 -DbOnly` prints `11 passed, 0 failed of 11`
- [ ] No implementation file outside Scope changes
- [ ] Commit begins with `[codex]`; do not merge before independent review

## Forbidden in this order

- Adding CORS, authentication, sessions, cookies, user input, static files, UI, or a security-header dependency
- Allowing a third-party CSP origin or weakening the specified policy
- Changing the `/health` body, status, or dependency-free semantics
- Editing packages, lockfiles, Docker/Compose, CI, setup scripts, documentation, or existing invariant/stress tests
- Editing anything under `migrations/`, including immutable `migrations/0001_init.sql`
- Database, RLS, tenancy, states, events, occupancy, journal/posting, fiscal, or statutory logic
- Merging this stacked branch before prior orders and this order are independently reviewed in sequence

## Deferred review protocol

Claude reviews this order after Orders 001–004. Future kiosk framing or external connection requirements must change CSP through a separate reviewed order rather than weakening this launch baseline ad hoc.

---

## MERGED

Merged into `main` by the cumulative Phase 0 integration PR (head `7f1d7c3`).
Reviewed in `handoff/reviews/` before merge; see `handoff/LEDGER.md` for the verdict line.
