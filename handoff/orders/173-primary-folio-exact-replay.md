# Order 173 — Primary-folio exact replay correction

**Status:** APPROVED — integrated in independently reviewed candidate `6870692`
**Phase:** 5 · Financials
**Branch:** `phase-5/primary-folio-exact-replay`
**Base:** `db0e71d15b8961b9e0a1faf94a89481440dee364`
**Risk tier:** 3 — idempotent financial aggregate response semantics
**Owner:** Codex implementation; independent Order171 reviewer re-executes P1–P6

## Outcome

Correct the independent Order171 finding without weakening its oracle. The first
successful primary-folio creation stores one canonical JSON response. An exact
Idempotency-Key/body replay returns that exact stored body byte-equivalently; only the
existing `idempotency-replayed: true` response header indicates replay. Because the
stored creation response still has `changed:true`, its replay retains the original 201
creation status. A different key that discovers the already-existing canonical folio
returns 200 with `changed:false`. No financial effect or domain authority changes.

## Exact scope

- `src/http/operator.ts`;
- `tests/operator-primary-folio.integration.test.ts`;
- `tests/operator-founder-reservation-journey.integration.test.ts`;
- this order; additive `DECISIONS.log` and `handoff/LEDGER.md`;
- the eventual independent Order171 review evidence may be added only by the reviewer.

## Pre-registered proof

- **P0:** exact Base first create is 201 with `changed:true,replayed:false`; exact retry
  is 201 but body differs because it rewrites `replayed:true`.
- **P1:** candidate exact retry is the same status and byte-identical canonical JSON as
  first success, with `idempotency-replayed:true` only in the header.
- **P2:** a new key against the canonical existing folio is 200 with
  `changed:false,replayed:false`, and changed request under the original key remains 409.
- **P3:** twenty exact retries and twenty different-key opens produce one account,
  window, number increment, folio fact/outbox/idempotency effect and no body/status drift.
- **P4:** injected rollback/retry and all Order171 P1–P6/full/referee proofs pass
  unchanged under the independent reviewer.

## Forbidden

Domain, financial context, schema/migration, permission, route/body/response-field,
idempotency-store, status policy, UI, package, live port, merge, push or deployment
change. Do not remove `replayed` from the schema, manufacture it in the body, weaken
byte-equality, reinterpret a stored creation replay as a new-key existing lookup, or
edit protected tests.

## Definition of done

- [x] P0 reproduces the reviewer finding on exact Base.
- [x] Focused P1–P3 pass with byte-level status/body/header assertions.
- [x] Order171 immutable candidate is rebuilt and independently passes P1–P6.

## Independent approval — 2026-08-26

Exact first-create/20 same-key byte-identical header-only replays, 20 new-key existing
lookups, changed-actor 409 and one durable effect passed in the complete Order171
restart at candidate `6870692`; see
`handoff/reviews/171-reservation-folio-journey.md`.

## Builder evidence

Product commit `5f0e72ca52a13b959b1ccad7a36e03b4c52a7e03` preserves the
original canonical response body and uses only the existing replay header for transport
metadata. Exact-Base P0 failed solely on `replayed:false` versus `replayed:true`.
Candidate focused proof passed 6/6 with 117 assertions; a fresh unprepared-runtime
PostgreSQL founder journey passed 1/1 with 210 assertions, including twenty exact
retries, twenty new-key existing-folio opens, changed-actor 409 and one account/window/
number/fact/outbox creation effect. Standing tests passed 211/0 with 2,583 assertions;
typecheck, 66-file boundaries, licence, audit, schema drift and pristine referee 11/11
also passed. The inherited Windows `/proc/1/comm` readiness false negative occurred
after both isolated services were healthy, so equivalent migration/journey/schema/
referee commands were executed directly. Independent P1–P6 remains required.
