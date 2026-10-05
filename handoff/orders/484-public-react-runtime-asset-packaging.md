# Order 484 — Public React runtime asset packaging

## Objective

Repair the local public-review container so the server-selected Yellow Next
surface has its compiled static bundle at runtime.

## Scope

- `Dockerfile`
- focused tests under `tests/` validating the container packaging contract

## Required behaviour

- The runtime image must include `public/yellow-next` at the exact path resolved
  by `src/app.ts`.
- Keep the pinned Bun image and locked production dependency install unchanged.
- Do not embed environment files, secrets, database volumes, runtime-private
  files, guest data or credentials in the image.
- Verify a rebuilt `yellow-public-demo` app container is healthy and that its
  local Today route returns the Yellow Next HTML instead of 503.

## Exclusions

- No schema, migration, database/seed, tenancy, API contract, authentication,
  operational command, provider, tunnel configuration or data-import change.
