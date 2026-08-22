# Order 066 — Versioned rate applicability and commercial targeting resolver

**Phase:** 3 · Universal rate plans
**Branch:** `phase-3/rate-targeting-resolver`
**Tier:** 3 — deterministic tenant targeting that later price resolution and publish will trust
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221/D-240

## Outcome

Give each hotel an immutable typed target draft for an existing active rate plan and a deterministic
resolver for the founder's “Who gets it” and physical applicability choices. A hotel may target a
whole property, a hotel-defined class, a unit type or one exact sellable configuration, then narrow
that scope by company, market group, market, source, channel, segment, agent or campaign. Broad
inclusions and explicit exclusions form inheritance and exceptions. This order creates no price,
date rule, quote, approval, publication, distribution write or UI behavior.

## Natural-Solution Test

Applicability is versioned configuration attached to `rate_plan`, not a new authoritative table.
Use one new `rate_plan_target` extension type and tenant draft versions created through Order 065's
transaction-locked `ExtensionRegistry.createVersion()`. Real company/agent/source targets reference
tenant `party` + `party_role`; unit types and sellables reference inventory truth. A rate class is a
named immutable snapshot of one or more property-owned unit-type ids inside the draft, giving hotels
custom classes without inventing a class table. Hotel-defined commercial codes are strict canonical
strings because no baseline master tables exist for them. The resolver is pure over normalized
rules after transaction-scoped reference validation. No migration, new event or second rate truth is
authorized.

## Scope

- `src/contexts/rates/targeting.ts`
- `src/contexts/rates/index.ts`
- `scripts/seed.ts`
- `docs/EXTENSIONS.md`
- `tests/rate-targeting.integration.test.ts`
- `tests/extension.integration.test.ts` only for the exact launch type/instance totals and wording
- `src/project-status.ts` only for the exact completed-order and Gate-3 debt counters
- `tests/founder-status.integration.test.ts` only for the exact current-order assertion
- `handoff/orders/066-rate-targeting-resolver.md`
- `handoff/questions/105-order-066-targeting-persistence-and-precedence.md`
- `handoff/questions/105-ARCHITECT-RESPONSE.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- further numbered D-92 question/response files only if a hard-floor condition occurs

## Required implementation

1. Add launch extension type `rate_plan_target`. Its exact content is
   `property_node`, `rate_plan_id`, `authoring_mode` (`guided | expert | ai`) and `rules`.
   Creation derives extension key `rate-plan:<rate_plan_id>`, status `draft` and the next version;
   callers choose none of those fields. Normalize the same logical rules byte-equivalently in every
   authoring mode except the attributable `authoring_mode` value.
2. Each draft contains 1–200 uniquely keyed rules sorted by stable lowercase `key`. A rule has
   exact `effect` (`include | exclude`), integer `priority` 0–1000, one exact physical target and one
   exact commercial target object. Unknown fields, ambiguous empty strings and unsafe counts fail.
3. Physical targets are a strict union:
   - `property` — no additional field;
   - `class` — canonical hotel code plus 1–100 unique sorted property-owned unit-type ids;
   - `unit_type` — one exact property-owned unit-type id;
   - `sellable` — one exact active sellable id whose unit type belongs to the property.
   A class is a membership snapshot in this draft, not a new mutable inventory authority.
4. Commercial target fields are optional and conjunctive:
   `company_party_id`, `market_group_code`, `market_code`, `source_party_id`, `source_code`,
   `channel_code`, `segment_code`, `agent_party_id`, `campaign_code`. Company, agent and source ids
   must be active tenant parties with those exact roles. Hotel-defined codes use exact bounded
   canonical syntax; they are not silently created as global channel or CRM records.
5. Add `RateTargetService` create/list/resolve operations. Create and list prove exact active
   tenant/property/rate-plan ownership, validate every referenced inventory/party row, store only
   canonical typed content, return frozen typed values and never expose raw extension JSON.
6. Resolution derives an exact property/unit-type/sellable context under the same tenant
   transaction and validates any supplied party roles/codes. A rule matches only when its physical
   membership and every constrained commercial dimension match. Missing context never activates a
   constrained rule.
7. Resolver precedence is exact and independent of array/row/object order:
   `sellable > unit_type > class > property`; within one physical rank, more constrained commercial
   dimensions win; within equal rank/count, one uniquely highest explicit priority wins. If two or
   more matching rules share the top rank/count/priority, return a conflict with sorted rule keys —
   never choose by key. Otherwise return `included`, `excluded` or `not_applicable`, with the winning
   rule and deterministic matched-rule evidence.
8. Every created version records one `rate_plan_target.drafted` fact on the extension row with exact
   property, plan, authoring mode, rule count and resulting extension version. Emit no outbox event:
   a draft changes no active sellability, price or distribution behavior.

## Forbidden

- Any file under `migrations/`, especially `migrations/0001_init.sql`
- `tests/run_invariants.py`, schema snapshots, table counts, RLS, tenant middleware, occupancy,
  restriction evaluation, journal, fiscal, tax or statutory behavior
- A new table, column, index, event, state transition, permission, HTTP route, UI, dependency,
  worker, cache, adapter, master-data subsystem or arbitrary formula engine
- Prices, currency amounts, percentages, stay dates, DOW, occupancy/LOS/booking-window conditions,
  guest mix, promotions, packages, meal/refund/cancellation policies, CTA/CTD, distribution writes,
  quote calculation, approval, activation, publication or undo
- Treating hotel-defined codes as globally registered records; client-selected extension
  key/version/status; mutation of an earlier draft; direct generic JSON editing
- Choosing a winner by insertion order, database order, JSON key order or lexicographic rule key
- Treating a draft as active or independently reviewed; approval or merge by Codex

## Pre-registered proof

- **P0 (red first):** focused tests fail before production edits because the targeting extension,
  service and resolver exports do not exist. Preserve exact red output.
- **P1:** production seed registers exactly the new type, leaving instance totals unchanged; exact
  replay changes zero rows/facts and one-field schema divergence rolls the seed transaction back.
- **P2:** guided/expert/AI inputs normalize to one exact rule shape; every union/cardinality/key/code,
  duplicate, extra-field and recursive ambiguity boundary rejects without persistence.
- **P3:** property, class memberships, unit type, sellable and company/agent/source roles validate
  exact active tenant ownership; foreign/missing/inactive references persist nothing.
- **P4:** versions and exact facts are gapless, deterministic and immutable; twenty concurrent drafts
  yield `1..20`, twenty facts and zero events while every prior row remains byte-equivalent.
- **P5:** every physical rank permutation is order-independent; all 512 commercial-dimension subsets
  obey documented constrained-count precedence; unique priority resolves a tie; equal top tuples
  return sorted conflicts; missing contexts and no match return `not_applicable`.
- **P6:** tenant B and another property cannot list, resolve or target tenant A drafts; caller/context
  UUIDs, roles, physical relationships and codes fail closed without leaking target existence.
- **P7:** inherited extension/status proofs, frozen install, typecheck, boundaries, all default tests,
  licence, audit, schema drift, protected hashes and fresh app-never-started referee remain green.

## Standing and handoff

Run P0 on a fresh migrations-only database before production edits. Implement only after the red
proof is preserved. Recreate for P1–P6 and restart the complete focused file after every correction.
Then run the entire standing gate and a fresh isolated `./setup.sh --db-only` with the app never
created. This order has no runtime route, so do not reseed or rebuild the founder's persistent stack.
Refresh Graphify structurally for code, append one UNVERIFIED Gate-3 row, advance only the exact
founder-status counters, commit `[codex]`, push and open a draft stacked PR against Order 065. Do not
approve or merge.
