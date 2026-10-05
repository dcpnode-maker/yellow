# Order 480 — Current workspace release reconciliation

## Objective

Reconcile the current Yellow runtime workspace with a single reproducible,
reviewable release candidate so the passwordless colleague-review surface can be
started without bypassing its archive, dependency, environment or tenant guards.

## Scope

- Read-only inventory of `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`
  against its candidate archive and source-artifact receipt.
- A new isolated candidate preparation directory and manifest tooling only after
  exact source ownership, dependency-junction, build, and public-surface tests
  are captured.
- Release reconciliation documentation and focused release proof.

## Constraints

- Preserve the existing divergent workspace and all prior candidate archives;
  never overwrite it, delete its generated files, or weaken the supervisor's
  archive-identity check.
- Preserve passwordless review entry as currently configured. Do not create user
  credentials, change authentication policy, add access-token logging, or expose
  production guest data.
- No public tunnel, port 3000 launch, database migration, seed/reseed, payment,
  provider activation, OTA operation, or source-tree replacement in this order.
- Candidate preparation must use the existing dependency version and must not
  contain `app.env`, Gemini keys, credential material, private receipts, or PII.

## Required proof

- Exact source inventory distinguishes archived, added, removed and modified
  files using correctly closed streams and SHA-256.
- Typecheck, focused public-surface/mobile/voice tests and production frontend
  builds pass from the candidate source.
- An independent non-implementing reviewer verifies the candidate manifest,
  excluded sensitive paths, archive/source equality and release proof before any
  separate promotion order can start it.
