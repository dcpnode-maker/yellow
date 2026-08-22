# Order 065 — Versioned rate-model catalogue and draft selection

**Phase:** 3 · Universal rate plans  
**Branch:** `phase-3/versioned-rate-model-catalogue`  
**Tier:** 3 — versioned tenant configuration that later quote and publish paths will trust  
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221/D-234

## Outcome

Give every hotel one registered catalogue of pricing-model families and an immutable, tenant-safe
way to select or reselect a model for an existing rate plan. Guided, expert and future AI authoring
must write the same canonical draft-selection envelope. This order creates no price, target,
restriction, quote, approval, publication or UI behavior.

## Natural-Solution Test

The model choice is versioned configuration attached to the existing `rate_plan`, so it belongs in
the baseline `extension` primitive. `extension_type` provides the schemas, platform-global
`rate_model` instances provide the catalogue, tenant `rate_plan_model` instances provide immutable
versions, and `fact_log` records each draft. `rate_plan` remains identity/policy composition;
insert-only `rate_price` remains authoritative money. No table, migration or second pricing truth
is authorized.

## Scope

- `src/kernel/extension.ts`
- `src/kernel/index.ts`
- `src/contexts/rates/models.ts`
- `src/contexts/rates/index.ts`
- `scripts/seed.ts`
- `docs/EXTENSIONS.md`
- `tests/rate-models.integration.test.ts`
- `tests/seed.integration.test.ts` only if an exact inherited assertion requires an explicit update
- `handoff/orders/065-versioned-rate-model-catalogue.md`
- `handoff/questions/099-order-065-rate-model-persistence.md`
- `handoff/questions/099-ARCHITECT-RESPONSE.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- further numbered D-92 question/response files only if a hard-floor condition occurs

## Required implementation

1. Define one immutable catalogue with these exact stable keys:
   `simple-fixed`, `calendar`, `bar-ladder`, `derived`, `room-matrix`, `occupancy-los`,
   `contract-negotiated`, `package`, `rms-api-managed`, `expert-composition`.
   Each entry has version `1`, a human label/description, and an exact non-empty set of registered
   capability identifiers. Unknown keys and versions are never inferred.
2. Add launch extension types `rate_model` and `rate_plan_model`, and seed the ten catalogue entries
   as deterministic platform-global active version-1 instances. The seed remains exact-idempotent:
   exact rerun is a no-op and any divergent schema/content/version/status hard-fails atomically.
3. Add a generic `ExtensionRegistry.createVersion()` transaction method. It validates type/key and
   content before writing, serializes the exact tenant/type/key with a transaction advisory lock,
   derives `max(version)+1` inside the tenant transaction, inserts one row, records one fact, and
   never updates or deletes an earlier version. Callers cannot choose the version number.
4. Add `RateModelService` with create/list operations over tenant `rate_plan_model` versions. The
   server derives key `rate-plan:<rate_plan_id>`. Creation proves the rate plan is active, belongs
   to the exact active tenant/property, and the catalogue key/version is registered.
5. The v1 draft content is exact and non-monetary: `property_node`, `rate_plan_id`, `model_key`,
   `model_version`, `authoring_mode` (`guided | expert | ai`), and `component_model_keys`.
   Non-expert models require an empty component list. Expert composition requires 1–8 unique,
   sorted, registered non-expert components and cannot contain itself. The same logical input in
   any authoring mode normalizes to the same selection fields except the attributable authoring
   mode.
6. Every created row has status `draft` and one `fact_log` row whose fact type is
   `rate_plan_model.drafted`, subject is the extension row, and payload identifies rate plan,
   model key/version, authoring mode and resulting extension version without prices or secrets.
   Emit no outbox event: no active pricing behavior changes in this order.
7. Listing is deterministic by version and fails closed for malformed, foreign-tenant,
   foreign-property, missing or inactive plans. Return immutable typed values, not raw extension
   content. Catalogue reads come from the immutable code/seed contract; no deploy-role request
   path is added.

## Forbidden

- Any file under `migrations/`, especially `migrations/0001_init.sql`
- `tests/run_invariants.py`, schema snapshots, table counts, RLS, tenant middleware, occupancy,
  restriction evaluation, journal, fiscal or statutory behavior
- A new table, column, index, event, state transition, permission, HTTP route, workbench UI,
  dependency, worker, cache, adapter or arbitrary formula engine
- Prices, monetary amounts, percentages, dates, DOW, occupancy/LOS bands, targeting, policies,
  packages, distribution conditions, RMS payloads, quote evaluation, conflict precedence,
  approval, activation, retirement, publish or undo behavior
- Client-selected extension keys/versions/status, direct generic JSON editing, or mutation of an
  earlier draft row
- Treating a draft as active or independently reviewed; approval or merge by Codex

## Pre-registered proof

- **P0 (red first):** focused tests fail before production edits because the model catalogue,
  `RateModelService` and generic version insertion do not exist. Preserve exact red output.
- **P1:** the production seed registers exactly both new types and ten deterministic global
  catalogue instances; exact rerun changes zero rows/facts and a one-field divergence rolls the
  whole seed back.
- **P2:** every catalogue key/version/capability set is exact, stable and matches seeded content;
  unknown key/version and malformed catalogue content fail closed.
- **P3:** guided, expert and AI authoring create the same typed envelope shape; non-expert
  components are rejected, expert components normalize uniquely, and recursive/unknown/empty/
  over-eight compositions persist nothing.
- **P4:** each draft validates exact tenant/property/active-plan ownership, inserts the next
  server-derived version plus one exact fact, lists deterministically, and leaves every prior
  version byte-equivalent.
- **P5:** twenty concurrent creates on one plan yield versions `1..20` exactly, with twenty rows
  and twenty facts, no gaps/duplicates; publisher/event counts remain unchanged.
- **P6:** tenant B and another property cannot read or target tenant A's plan or draft versions;
  malformed UUIDs/keys/modes and caller-supplied extra content fail before persistence.
- **P7:** frozen install, typecheck, boundaries, all default tests, licence, audit, schema drift,
  protected hashes and fresh app-never-started referee remain green.

## Standing and handoff

Run P0 on a fresh migrations-plus-fixture database before production edits. Implement only after
the red proof is preserved. Recreate for P1–P6 and restart the whole focused file after every
correction. Then run the complete standing gate and fresh isolated `./setup.sh --db-only` with the
app never created. Rebuild the persistent localhost only if runtime source changes require it;
this order adds no UI. Refresh Graphify structurally for code, append one UNVERIFIED Gate-3 row,
commit `[codex]`, push and open a draft stacked PR against Order 064. Do not approve or merge.

