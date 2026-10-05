# Order 485 — Public session credential binding

## Objective

Restore the environment-gated, server-side automatic session for the isolated
synthetic public-review runtime when the shell's configured local-review
credential is not the password used to seed the review operator.

## Scope

- `D:\Yellow\runtime\yellow-public-demo.compose.yml` runtime environment binding
- focused public-session proof and independent review record

## Required behaviour

- Bind the process-only local-review password to the existing review-seed
  password through Compose interpolation; do not duplicate or print either
  secret.
- The browser must continue to receive only a signed access token, never the
  credential itself.
- Prove the automatic-session endpoint succeeds locally and through the public
  route, then verify protected property data can be read with its issued token.
- Have an independent reviewer inspect the configuration delta and personally
  run the endpoint proof.

## Exclusions

- No user/password database mutation; no real data; no new account; no RLS,
  tenancy, token-signing, API or browser credential exposure change; no
  migration, seed, provider or tunnel configuration change.
