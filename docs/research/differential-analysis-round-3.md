# Differential Analysis — Round 3: Resolved Technical Decisions

**Focus:** the four open problems blocking the ERD — polymorphic attribute modelling, composite-slot integrity, tenancy cost, and compliance-as-configuration.
**Method:** direct search against engineering literature and benchmarks. Narrower and deeper than Rounds 1–2.

---

## L. Typed attributes — **RESOLVED**

The hybrid recommendation is confirmed with hard numbers, and the margin is not close.

- <cite index="1-1">PostgreSQL benchmarks show JSONB running over 50,000× faster than EAV for unindexed queries, in a database three times smaller.</cite> An independent benchmark measured <cite index="4-1">JSONB with a GIN index at 0.153 ms — roughly 15,000× faster than EAV — with the JSONB model using about a third of the storage</cite>, the storage saving arising because EAV carries two integer foreign keys per value and stores everything as text.
- <cite index="1-1">The recommended pattern is typed columns for core fields plus a JSONB column for the variable remainder.</cite>
- The promotion heuristic is explicit: <cite index="1-1">if a field appears in most of your `WHERE` clauses, it should be a real column rather than buried in JSON.</cite> <cite index="3-1">Promote frequently filtered JSONB keys to typed columns once access patterns stabilise.</cite>
- **Critical index caveat:** <cite index="4-1">a GIN index on a whole JSONB column is only used by the containment operator (`@>`) — queries written with `->>` do not use it.</cite> <cite index="3-1">Match the `WHERE` expression exactly to the index definition, including explicit casts, and verify with `EXPLAIN (ANALYZE, BUFFERS)`.</cite> This is the single most common way teams get JSONB performance wrong.
- <cite index="1-1">EAV filtering is slow because values are always text — no type checking and no numeric indexing</cite>, and <cite index="2-1">every additional filter condition adds another EXISTS clause or self-join</cite>. Fatal for dimensional matching (berth LOA/beam/draft), which is inherently multi-predicate and numeric.

**Decision:** hot attributes → typed nullable columns with partial indexes per vertical profile. Cold attributes → JSONB with GIN, queried via `@>`. Validation via JSON Schema in the vertical profile, plus CHECK constraints for invariants. Promotion path from cold to hot is non-breaking.

---

## M. Composite slots and exclusion constraints — **SOLVED, but not by any published source**

The standard pattern is well established: <cite index="9-1">`EXCLUDE USING gist (room_id WITH =, tsrange(check_in, check_out) WITH &&)`</cite>, requiring <cite index="11-1">the `btree_gist` extension when combining equality columns with range columns</cite>, and <cite index="14-1">a partial constraint (`WHERE status <> 'CANCELLED'`) so cancelled rows don't block reuse</cite>.

Worth noting for concurrency: <cite index="13-1">serialisable snapshot isolation predicate-locks at coarse granularity — the entire grouping — so a genuinely non-overlapping booking can still be aborted; exclusion constraints give better concurrency</cite>. Confirms the choice on performance grounds, not just correctness.

**But no published source solves the composite case** — a bed inside a room, where selling the bed must invalidate the private-room product. Different `sellable_unit_id`s over the same physical space; the standard constraint can't see the conflict.

**Proposed solution — space-level occupancy projection:**

```sql
-- Physical occupancy, one row per (space, interval) regardless of
-- which sellable configuration caused it. Written transactionally
-- with the slot.
CREATE TABLE space_occupancy (
  tenant_id     uuid NOT NULL,
  space_id      uuid NOT NULL,
  period        tstzrange NOT NULL,
  slot_id       uuid NOT NULL,
  exclusive     boolean NOT NULL,  -- private room = true; dorm bed = false
  EXCLUDE USING gist (
    tenant_id WITH =, space_id WITH =, period WITH &&
  ) WHERE (exclusive)
);
```

The logic:
- **Exclusive configurations** (private room, whole villa, berth) write `exclusive = true`. The partial constraint blocks any other exclusive occupancy of the same space.
- **Non-exclusive configurations** (dorm beds) write `exclusive = false` and are additionally constrained by a capacity CHECK against the space's declared bed count.
- Because exclusive rows conflict with each other but non-exclusive rows don't, one declarative constraint expresses both "you can't sell this room twice" and "you can't sell the room privately while beds are sold."

This keeps enforcement **declarative and in-database** — no triggers, no application-layer race window — which is the property that makes exclusion constraints worth using in the first place. It generalises to suites-as-connecting-rooms and to any nesting depth.

**This is the highest-risk piece of the design and should be prototyped and load-tested before the ERD hardens.**

---

## N. Tenancy — **CHALLENGES a settled decision** ⚠️

Your three-tier ladder assumed schema-per-tenant as the middle tier. The evidence says that tier is a trap.

- <cite index="17-1">PostgreSQL stores schema metadata in system catalogs; thousands of schemas multiply this linearly, and catalog tables that should sit comfortably in memory grow large enough to slow query planning and connection startup. Migrations iterate sequentially or in throttled batches across thousands of schemas, making them slow and failure-prone.</cite>
- <cite index="21-1">Postgres handles a few thousand schemas comfortably; beyond that, catalog queries, autovacuum, and migration tooling slow noticeably. Above roughly 3,000–5,000 tenants, shared-schema or database-per-tenant scale better.</cite>
- Meanwhile the shared-schema cost is negligible: a benchmark at 100k rows across 1,000 tenants measured <cite index="22-1">3.2 ms without RLS, 3.6 ms with RLS, versus 4.8–12.5 ms for schema-per-tenant</cite>. Schema-per-tenant is both *slower* and more operationally expensive.

**Revised recommendation:** two tiers, not three. **Shared schema + RLS** for everyone, **dedicated database** for tenants with a regulatory or contractual isolation requirement. Drop schema-per-tenant entirely — it buys weaker isolation than a dedicated DB at worse performance and much worse migration ergonomics.

Two operational requirements that come with this:
- <cite index="17-1">RLS is a defence-in-depth backstop, not the primary control — you still need verified tenant identity at the API boundary, context propagation through background jobs, and strict namespacing for caches and object storage.</cite>
- <cite index="17-1">Under PgBouncer transaction pooling, never use session variables or `SET SESSION`; use `set_config('app.current_tenant_id', ..., true)` so the setting is transaction-scoped and cannot leak across pooled connections.</cite> This is a silent cross-tenant data-leak vector and must be in the coding standards from day one.
- Every composite index needs `tenant_id` leading, or the planner degrades.

---

## O. Compliance — **BUY, DON'T BUILD** ⚠️ *biggest cost finding in three rounds*

The research strongly indicates that building the fiscal-document engine yourself contradicts your lowest-maintenance-cost principle.

- <cite index="29-1">Format is only the surface. Beneath it sit different transport methods, authentication schemes, validation rules, and — the part that quietly consumes engineering time — different ways of reporting failure. A rejection from Poland's KSeF looks nothing like one from Italy's SdI, which looks nothing like a Peppol message-level response. Build for one country and you have built for exactly one country.</cite> That's from a provider describing building adapters for 31 countries, including <cite index="29-1">tracking timeline changes that regulators publish on what can feel like a monthly basis.</cite>
- The regulatory load is accelerating: <cite index="30-1">more mandates take effect in 2026 than any prior year, with requirements landing every quarter across Europe, the Middle East and Asia-Pacific simultaneously — Belgium mandatory 1 Jan 2026, Poland's KSeF for the largest taxpayers 1 Feb 2026, ZATCA Wave 24 by 30 June 2026, France's national mandate 1 Sept 2026.</cite>
- <cite index="30-1">Because each jurisdiction makes its own choices, compliance is country-specific — a system built for Italy's clearance platform will not satisfy India's reporting portal or Belgium's Peppol network without adaptation.</cite>
- Consensus recommendation: <cite index="28-1">country-by-country point integration is a losing strategy; choose a platform that handles multiple formats, transports, and tax authorities behind one API.</cite>

**Revised architecture:**
- **Build:** the tax *calculation* engine (value-banded, per-night/person/room, capped nights, category-banded, compounding, exemptions). This is genuinely yours, it's coupled to your rate model, and the rules change slowly.
- **Buy:** fiscal *document* issuance and clearance. Integrate a provider (Storecove, Taxually, DDD Invoices, Fonoa, or similar) behind your own `FiscalDocumentProvider` interface. Per-country adapters become their problem and their maintenance burden.
- **Adopt:** <cite index="28-1">UBL 2.1 plus Factur-X/ZUGFeRD covers most European requirements, with PINT emerging as the international Peppol profile.</cite> Emit standards-compliant documents and let the provider route them.
- Keep the interface clean so you can bring specific jurisdictions in-house later if volume justifies it.

**Note on the five models:** every mandate globally resolves to one of roughly five patterns — clearance, real-time reporting, centralised exchange, Peppol/post-audit, and the newer decentralised CTC five-corner model (<cite index="27-1">the basis for planned introduction in France and the UAE</cite>). Your provider interface needs to express all five, not just clearance.

Statutory *guest registration* is different — no provider aggregates it, so those adapters stay in-house. Confirms the 13th bounded context.

---

## P. Revised decisions summary

| Decision | Status | Change |
|---|---|---|
| Hybrid typed columns + JSONB | **Resolved** | Confirmed, 50,000× margin over EAV. Use `@>` not `->>`. |
| Composite slot integrity | **Solved** | Space-occupancy projection with partial exclusion constraint. Prototype before ERD. |
| Three-tier tenancy | **Changed** ⚠️ | Drop schema-per-tenant. Two tiers: shared+RLS, dedicated DB. |
| Build fiscal engine | **Changed** ⚠️ | Buy document issuance, build tax calculation. |
| Exclusion constraints for availability | Confirmed | Also better concurrency than serialisable isolation. |
| Statutory registration as own context | Confirmed | No provider aggregates this; adapters stay in-house. |

---

## Q. Still open

Not closed by this round, and each needs its own investigation:

1. **Offline-first conflict resolution** — interacts directly with the exclusion-constraint model. Offline bookings cannot be guaranteed non-overlapping until sync. Needs a hold-protocol design spike.
2. **Managed vs self-hosted Postgres cost modelling** — real numbers at your expected load.
3. **Primitive-set decomposition** — the minimal set of primitives that competitor features decompose into. This is the core of the configurable-kernel thesis and deserves dedicated work.
4. **Matching-engine solver选择** — OR-Tools vs Timefold, both Apache 2.0, only needed for fragmentation minimisation.

---

## R. Next

The two changed decisions (N, O) both *reduce* scope and cost, which is a good outcome. Neither blocks the ERD.

The one thing that does block it is **M** — prototype the space-occupancy projection under concurrent load and confirm the partial exclusion constraint behaves as designed. That's a half-day of work and it de-risks the most novel part of the entire system.
