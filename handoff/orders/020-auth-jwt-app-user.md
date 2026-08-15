# ORDER 020 — app_user, roles, and JWT authentication

**Phase:** 1 · **Branch:** `phase-1/auth-jwt` · **Tier:** 3
**Written by:** Claude (architect) · **Date:** 2026-08-15 · **Decisions:** D-91, D-16, D-38

## Goal

Issue and verify access tokens carrying exactly the D-91 claim set, and supply the
`TenantResolver` that Order 019 left abstract.

## Scope

`src/contexts/identity/` (auth service, token signer, resolver), `src/kernel/index.ts`
(export the resolver wiring), `migrations/0002_identity.sql` (new file only),
`tests/auth.integration.test.ts`, `tests/token.test.ts`, `package.json` (scripts only).

`migrations/0001_init.sql` is immutable. `0002` is a NEW file through the runner, with
D-73's checksum discipline. Password hashing uses `Bun.password` argon2id — no dependency.

## Required behaviour

1. **First DoD item, before anything else:** probe Bun 1.3.14 WebCrypto for Ed25519
   support and record the result in the PR body. It does not change this order — HS256
   ships either way per D-91 — but it fixes the documented fallback for the eventual
   asymmetric swap. If Ed25519 is absent, record ES256 (P-256) as the fallback.
2. Tokens carry exactly D-91's claims: `iss`, `sub`, `aud`, `iat`, `nbf`, `exp`, `jti`,
   `tid`, `scp`, `cv=1`. No others. 15-minute expiry, 60s clock-skew leeway.
3. `TokenSigner` port; HS256 implementation. The verifier selects the algorithm **from
   configuration**, never from the token header, and asserts `alg` matches.
4. `TenantResolver` implementation returning `tid` from a verified token, and `null` for
   any token that fails verification for any reason.
5. Scopes are `<context>.<resource>:<action>` against the 13 contexts of D-67. Wildcards
   only at the action position.

## Pre-registered proofs

| # | Proves | Must show |
|---|---|---|
| P1 | Ed25519 capability probe | printed result, and the recorded fallback |
| P2 | Claim set is exact | issued token decodes to precisely the D-91 claims, no extras |
| P3 | **`alg:none` rejected** | a token with header `{"alg":"none"}` and no signature → rejected |
| P4 | **Algorithm confusion rejected** | a token whose header claims a different `alg` than configured → rejected even if otherwise well-formed |
| P5 | Expiry and skew | token 61s past `exp` rejected; 59s past accepted |
| P6 | Tampering | any single byte changed in payload → signature check fails |
| P7 | Resolver fails closed | malformed, unsigned, expired, and wrong-audience tokens each → `null` → 401 from Order 019's middleware |
| P8 | End-to-end tenant isolation | tenant A's token reads A's rows; tenant B's token reads zero of A's |

P3 and P4 are the two that matter. They are the classic JWT vulnerabilities and both are
invisible unless tested directly.

## Forbidden

Any claim beyond D-91's list · selecting the algorithm from the token header · storing a
password in any form other than `Bun.password` argon2id · refresh tokens, password reset,
TOTP, or session revocation (each is its own later order) · editing `0001_init.sql` or
`tests/run_invariants.py` · a JWT library dependency (D-38: we code auth ourselves).

## Deferred review protocol

Stop and write a question if the Ed25519 probe result suggests the HS256 decision should
change, or if `Bun.password` cannot meet argon2id parameters.
