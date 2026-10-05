# Order 116 — JWT signing-secret fail-closed startup

**Phase:** 5 security correction  
**Branch:** `phase-5/jwt-secret-hardening`  
**Base:** `89cd0322d9e278da3ad1e15afce365e069e5e29b`  
**Risk tier:** 3 — authentication signing authority and deployment configuration  
**Owner:** Codex implementation; independent non-implementing reviewer required  
**Cyber finding:** `auth.repository-known-jwt-signing-key` / `occ_f1bd4c1fcb48b0ae894a4f29`  
**Status:** APPROVED at exact implementation SHA `f15e142803fe9bf6859176e7e4334419a8202bd6`; integration pending

## Outcome

No enabled Yellow operator runtime accepts a repository-known JWT signing key. Ordinary
local setup remains one-command and zero-cost by generating a fresh process-local secret
with the operating system CSPRNG; exposed/direct deployments must supply their own secret.

## Natural-Solution Test

JWT claims, HS256 pinning and key-length checks are already correct. The defect is the
accepted Compose fallback, not the token format. Remove that fallback, reject the exact
legacy sentinel at the signer boundary, and generate ephemeral local setup input outside
the image. Key files, a secret manager dependency, asymmetric JWTs or session redesign
would enlarge the problem without improving this same-process local boundary.

## Scope

- `docker-compose.yml`, `.env.example`, `.gitignore` only to track that safe example
- `src/contexts/identity/token.ts`
- `setup.sh`, `setup.ps1`
- `tests/token.test.ts`, `tests/jwt-runtime-secret-security.test.ts`
- `docs/LOCAL-REVIEW.md`, `docs/SECURITY.md`, `docs/research/CAPABILITY-MATRIX.md`
- `src/project-status.ts`, `tests/founder-status.integration.test.ts` only after green
- this order, `handoff/LEDGER.md`, `DECISIONS.log`, `handoff/questions/`, and the
  independent review record

## Required work

1. Replace Compose's accepted repository-known `YELLOW_TOKEN_SECRET` fallback with an
   empty default. With the workbench disabled, health-only startup remains valid. With
   `YELLOW_OPERATOR_WORKBENCH=1`, the existing runtime required-value boundary must fail
   before listening when no secret is supplied.
2. Reject the exact legacy fallback and documented placeholder at `Hs256TokenSigner`
   construction even when they meet the 32-byte floor. Preserve D-91's HS256 algorithm,
   claims, TTL and verification rules; do not invent entropy scoring.
3. When ordinary `setup.sh`/`setup.ps1` will start the app and the caller supplied no
   secret, generate 48 random bytes using Bun WebCrypto or the platform CSPRNG, encode
   them without printing the value, and export only for that setup process/Compose
   invocation. Never generate inside the image or product runtime.
4. `--db-only` neither needs nor creates a token secret. Direct Compose/local-review
   instructions explicitly generate or supply a fresh secret before enabling the
   workbench. `.env.example` uses the actual variable name and contains no accepted key.
5. Preserve loopback binding, explicit workbench enablement, memory-only browser tokens,
   local password behavior and all current token/auth tests. Secret rotation invalidates
   old access tokens by design and never changes a staff password.
6. Reproduce the finding's forgeability against the exact parent using the legacy key,
   then prove the hardened runtime rejects the same configuration and a fresh generated
   key supports login/issue/verify. Do not expose the generated secret in output.

## Forbidden

- Committing/generated secret material, printing a secret, writing `.env`, accepting a
  repository example/sentinel, or silently generating a production/runtime key
- JWT claim/algorithm/TTL changes, refresh/session/MFA work, password changes, database
  migrations, RLS/permissions, login throttling or other Cyber findings
- New dependencies, external/paid secret services, public binding changes, self-review
  or self-merge

## Pre-registered proof

### P0 — exact parent red

An always-on source/runtime proof requires Compose to contain no accepted nonempty
fallback, the actual env example key to be blank, setup generation to be CSPRNG-backed
and non-logging, and `Hs256TokenSigner` to reject the exact legacy value. It fails on the
parent before production/configuration changes. Separately issue and verify one token
with the parent legacy key to preserve the real exploit prerequisite.

### P1 — signer and source boundary

The legacy fallback, documented placeholder, empty and short keys reject; two fresh
48-byte generated keys are distinct and support normal issue/verify. Compose has an
empty default only and no accepted repository-known signing material.

### P2 — startup and local workflow

Workbench enabled + absent/legacy secret exits before listening. Workbench disabled +
absent secret retains health-only startup. Both setup scripts generate only for non-DB
setup, do not print/persist it, and start a healthy local app. An explicitly supplied
fresh key is preserved rather than replaced.

### P3 — authentication regression

Existing token/auth/operator-login proofs retain exact claims, fixed algorithm, uniform
credential failures, 15-minute issuance and live database-backed login with a fresh key.

### P4 — standing and independent review

Typecheck, boundaries, complete default tests, licences, audit, exact schema, protected
hashes and pristine 85-table referee pass. A non-implementing Tier-3 reviewer personally
reproduces P0 on the parent and executes P1–P3 on the exact implementation SHA.

## Definition of done

- [x] Order exists before code and P0 red is committed first.
- [x] No enabled runtime accepts repository-known signing material.
- [x] Local setup remains zero-cost, fresh-secret and non-persistent.
- [x] Passwords and JWT contract remain unchanged.
- [x] Standing/referee gates and independent review approve the exact implementation SHA.
- [x] Finding closure is exclusive; the other fourteen open Cyber findings remain open.
