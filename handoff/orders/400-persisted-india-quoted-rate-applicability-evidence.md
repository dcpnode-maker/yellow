# Order 400 — Persisted India quoted-rate applicability evidence

**Status:** APPROVED-CLOSED-D1188
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-quoted-rate-applicability-evidence`
**Base:** exact current Order367 implementation working state on `d77c81d`; approved product base remains `6bba460`
**Risk tier:** 3 — statutory rate/component ancestry and tenant authority
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Persist the complete approved Order341 quoted-rate-applicability result as typed
immutable authority so final-tax persistence can verify exact Section14,
rate-version, component-family, reservation-lineage and governed external calendar
ancestry rather than trusting an opaque caller hash.

## Schema and authority

Forward migration0069 adds exactly three tenant-leading insert-only forced-RLS
tables: a root for scope, selected version/family, typed predecessor identities and
hashes; a dense quoted room-night/slab table; and an ordered typed component-rate
table. Calendar-governed cases retain bounded non-money authority id, source digest
and dense classified dates as validated evidence. Quoted money and rates remain
typed columns, never JSONB authority. Exact catalogue becomes `69/119/109/109/18/2`.

One fixed-search-path owner capability is the sole writer. The application reruns
Order341 in the caller transaction; the capability rechecks active tenant,
property-scoped fiscal actor with `tax-fiscal.india-valuation:finalize`, exact
reservation/folio/attribution lineage and every persisted predecessor selector. It
validates bounded external calendar evidence without inventing weekdays or holidays,
derives selected extension/slabs/component split and byte-matches complete Order341
evidence. Downstream final-tax totals are forbidden. Same-key replay is write-free;
divergence/races conflict; root, children, minimized fact/outbox and service-owned
idempotency commit atomically.

## Exact implementation scope

- `migrations/0069_india_gst_accommodation_quoted_rate_applicability.sql`;
- one new recorder under `src/contexts/tax-fiscal/` and its `index.ts` exports;
- focused intentional-red/integration tests named for persisted quoted applicability;
- the current catalogue oracle/schema files enumerated by Order367;
- bounded `docs/CONTRACTS.md`, `docs/EVENTS.md`;
- Orders400/367, their reviews, `handoff/LEDGER.md`, `DECISIONS.log`.

No approved pure Orders341/340/337/310/309 source may change. Any other path requires
a recorded amendment before edit.

## Required proof

Intentional red; all three component families and six Section14 cases including
calendar evidence; 366/367 bounds; thresholds/rates/ordering; stale, foreign, forged,
gap, duplicate, race, replay and rollback hostility; zero-write census; RLS/ACL/raw
DML/`pg_temp`; exact catalogue/migration/acceptance/runtime/seed/static/schema/
referee11/11; and fresh independent Tier-3 execution.

## Forbidden

No final component-tax persistence, routing, posting, journal, document, IRP,
submission, API/UI/local, deploy, merge, push or Phase/application completion claim.
