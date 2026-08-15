> **AMENDED by `handoff/questions/011-ARCHITECT-RESPONSE.md` (D-94) and
> `handoff/questions/019-ARCHITECT-RESPONSE.md` (D-102), and
> `handoff/questions/020-ARCHITECT-RESPONSE.md` (D-103) — read all three first.**
> **E:** `extension_type` stays platform-global. **P3 proves isolation for `extension`
> instances only**, including that both tenants can read `tenant_id IS NULL` instances.
> New **P6:** registering a type requires platform authority. The column is `json_schema`;
> `docs/EXTENSIONS.md` has been corrected.
> **H:** Scope gains the **HTTP route file** and **`scripts/seed.ts`**. The launch registry
> ships in the production `db:seed` path, with D-74 idempotency — exact rerun is a no-op,
> divergent content hard-fails.

# ORDER 024 — extension_type and extension CRUD with JSON-Schema validation

**Phase:** 1 · **Branch:** `phase-1/extension-registry` · **Tier:** 2
**Written by:** Claude (architect) · **Date:** 2026-08-15 · **Decisions:** D-17, D-92

## Goal

Register an `extension_type` at runtime through the API and store an instance validated
against its JSON Schema.

## Scope

`src/contexts/identity/` or a new `src/kernel/extension.ts` — decide and justify in the
PR body; `src/kernel/index.ts`; `tests/extension.integration.test.ts`; seed the
EXTENSIONS.md schemas and launch instances as fixture data, not as a migration.
API composition scope: `src/app.ts`, `src/http/extensions.ts`,
`src/kernel/tenant-context.ts`, and `src/contexts/identity/resolver.ts`.
Default-token correction scope: `src/contexts/identity/token.ts` and `tests/token.test.ts`.
`extension_type` and `extension` are baseline tables — **no migration**.

## Required behaviour

1. Registering a type stores its JSON Schema; storing an instance validates against it
   and rejects on failure with the validating path in the error.
2. Validation happens **before** the write, in the same transaction.
3. JSONB hot-column hybrid per D-17: attributes in JSONB, GIN only for `@>` queries.
   Do not add real columns in this order — that is a per-attribute decision later.
4. All writes carry the Order 021 audit envelope.

## Pre-registered proofs

| # | Proves | Must show |
|---|---|---|
| P1 | Runtime registration | a type registered via API accepts a valid instance — the Phase 1 DoD line |
| P2 | Invalid instance rejected | schema violation → rejected, error names the failing path, zero rows written |
| P3 | Tenant isolation | tenant A cannot read or write B's types or instances |
| P4 | Audited | every write produces a `fact_log` row via Order 021's helper |
| P5 | Schema change safety | an existing instance that no longer validates against an updated type is detected, not silently accepted |

P5 is the one that decides whether this is a registry or a junk drawer.

## Forbidden

Adding real columns for extension attributes in this order · a JSON-Schema library that
fails the DEPENDENCIES.md test — check licence, governance and standard-protocol before
adding anything, and if in doubt stop and ask · validation after the write · bypassing the
audit envelope · editing `migrations/` or `tests/run_invariants.py` · merging.
