# ORDER 567 — Commercial attribution schema-free prototype

**Phase:** 0 · **Branch:** `phase-0/founder-context-demo-readiness` · **Written by:** OpenAI Codex · **Date:** 2026-09-21

## Goal
Prove the accepted Order 564 commercial attribution model on an isolated fresh PostgreSQL 16 database with fictional fixtures and exact conservation, tenancy, unsupported-scope and performance evidence before any production schema or KPI implementation.

## Why now
The founder requires hotel performance to drill from hotel and chain portfolios into MSG, MS, channel/source, company and product while recomputing room nights, revenue, occupancy, ADR and RevPAR correctly. Order 564 accepted the architecture only and made this executable prototype the next mandatory gate.

## Scope — files Codex may create or change
- `handoff/orders/567-commercial-attribution-schema-free-prototype.md`
- `prototypes/commercial-attribution/README.md`
- `prototypes/commercial-attribution/schema.sql`
- `prototypes/commercial-attribution/fixture.sql`
- `prototypes/commercial-attribution/report.sql`
- `prototypes/commercial-attribution/expected.json`
- `prototypes/commercial-attribution/performance-evidence.md`
- `tests/commercial-attribution-prototype.integration.test.ts`
- `handoff/reviews/567-commercial-attribution-schema-free-prototype.md`
- `handoff/LEDGER.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`

Anything not listed here is OUT of scope. If the work seems to require a file outside it, stop and write a question; do not widen scope silently.

## Contracts to honour
- `PROJECT.md` invariants 3, 5, 6, 7, 9 and 10.
- `migrations/0001_init.sql` organization, inventory, reservations, financials and reporting grains; the baseline remains immutable.
- `handoff/orders/564-commercial-attribution-and-rollup-model.md`.
- `handoff/drafts/564-commercial-attribution-and-rollup-model.md`, especially the corrected three-grain model and section 7 proof matrix.
- `handoff/reviews/564-commercial-attribution-and-rollup-model.md` retained gates.
- `.agents/skills/yellow-compliance-rules/SKILL.md`.
- `.agents/skills/yellow-entity-patterns/SKILL.md`.
- `.agents/skills/yellow-postgres-patterns/SKILL.md`.

## Required implementation
1. Create only isolated prototype relations outside `public`; do not add a migration or modify the application database.
2. Keep inventory-date, one conserved hotel-night per reservation/business-date, weighted allocation legs, and every signed eligible revenue-account line as separate grains.
3. Keep MSG→MS hierarchy separate from channel/source, company/booker, product/class and organization dimensions; prove one reservation can be sliced across these axes without duplicating the hotel-night or capacity denominator.
4. Represent unknown or ambiguous mappings explicitly as stable `UNMAPPED` leaves. Never infer a company from a guest, GST field or mutable relationship.
5. Preserve exact signed minor-unit arithmetic as PostgreSQL `numeric`; group revenue by currency and return unavailable for cross-currency totals.
6. Recompute ratios from summed numerators and denominators. Never average ADR, occupancy or RevPAR child ratios.
7. Fail closed or return an explicit null reason for demand-level occupancy/RevPAR, missing inventory history, zero denominators and overlapping physical counting bases.
8. Exercise fictional two-tenant and same-tenant two-property fixtures including sharers, same-day move legs, class/type allocation, OTA/direct/company/group business, taxonomy version boundary, cancellation/no-show/early departure, taxed charge, reversal, correction, house/unallocated revenue, overlap sets, huge exact sums and all-Unmapped.
9. Prove app-role RLS with transaction-local tenant context, no cross-tenant reads, no DML from report queries and unchanged canonical public-table fingerprints.
10. Capture reproducible `EXPLAIN (ANALYZE, BUFFERS)` and latency evidence at hotel, organization, MSG, MS, channel/source, company, room class and room type scopes, including representative 100-room and 1,000-room/two-year fixture shapes. Targets are p95 <300 ms aggregate and <150 ms first leaf page; results are evidence, not promises.

## Definition of done
- [ ] Canonical migrations apply to a fresh isolated PostgreSQL 16 database.
- [ ] Prototype SQL, deterministic fictional fixtures and independent expected manifest are retained.
- [ ] Exact tests cover conserved grains, hierarchy/intersection rollups, ratio recomputation, currency isolation, ambiguity/unmapped behavior and unsupported scopes.
- [ ] Cross-tenant hostility and same-tenant property-scope tests run as `app_role` with transaction-local `app.tenant_id`.
- [ ] Report queries produce no DML and public-table fingerprints remain unchanged.
- [ ] Representative performance evidence includes settings, row counts, parameters, warm/cold samples, p50/p95/p99 and query plans.
- [ ] `./setup.sh --db-only` or the Windows-equivalent referee proves `11 passed, 0 failed of 11`.
- [ ] Strict TypeScript and relevant Bun tests pass.
- [ ] An independent non-implementing agent personally runs the database proof and records its findings in Review 567.
- [ ] No file outside Scope changes.

## Forbidden in this order
- Editing `migrations/0001_init.sql` or adding a migration.
- Changing runtime application source, public API, live/public database, deployment, public UI or production KPIs.
- Reclassifying any existing public data.
- UPDATE/DELETE on insert-only tables or any occupancy write outside the sanctioned functions.
- Treating `stats_daily` or `OperatingPerformanceService` as audited commercial attribution authority.
- Summing capacity through demand/channel/company leaves, averaging ratios, mixing currencies, guessing company mappings or fabricating unavailable history.
- Treating alternate-set membership as authorization.

## Open questions already answered
> Q: Is MSG→MS→source→company one parent-child hierarchy?
> A: No. MSG→MS is the demand taxonomy; source/channel and company/booker are independent intersections so one business fact can be analysed across each without false lineage.

> Q: Can the prototype create production tables?
> A: No. Order 564 authorizes only a fictional isolated schema-free prototype. Any typed persistence requires a later independently reviewed migration order.

> Q: How are hotel-chain rollups represented?
> A: The canonical organization path handles chain/brand/region/property. Versioned alternate sets may overlap, so union filters deduplicate properties and independently overlapping rows are explicitly non-additive.
