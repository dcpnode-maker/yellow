# space_occupancy Concurrency Prototype — Results

**Run:** 13 Aug 2026 · PostgreSQL 16.14 · btree_gist · 50-thread races · real network round-trips (localhost)

```
================================================================
T1 exclusive race (50 clients, 1 room):  wins=1 rejects=49  761ms   PASS
T2 composite race (private vs beds):     private=1 beds=0            PASS  (never both)
T3 capacity race (40 clients, 6 beds):   wins=6 rejects=34  648ms   PASS
T4 choke point (direct INSERT as app):           denied (42501)            PASS
T5 throughput:                           500 bookings / 0.35s = 1,409 commits/sec
================================================================
VERDICT: ALL PASS — the composite-slot constraint holds under concurrency.
```

## Finding P1 — the prototype caught a design gap (and this is why it existed)

The Round-3 published design used a **partial** exclusion constraint (`WHERE (exclusive)`).
Under concurrent load, test T2 proved it incomplete: it blocks exclusive-vs-exclusive
conflicts but **silently permits a private-room sale to coexist with bed sales on the
same space** — the exact composite case the model exists to protect. First run: 1 private
win AND 6 bed wins on the same dates. A double-sell.

**Fix (now the canonical design, encoded in SCHEMA.sql): the claim range.**
Every occupancy row carries `claim int4range`. Exclusive rows claim `[0, ∞)`;
each bed claims `[position, position+1)`. One constraint then covers all three
conflict classes declaratively:

```sql
EXCLUDE USING gist (tenant_id WITH =, space_id WITH =, period WITH &&, claim WITH &&)
```

| Conflict class | Claims | Outcome |
|---|---|---|
| private vs private | [0,∞) && [0,∞) | blocked |
| private vs bed | [0,∞) && [k,k+1) | **blocked — the T2 gap, closed** |
| bed vs bed, same position | [k,k+1) && [k,k+1) | blocked |
| bed vs bed, different positions | disjoint | allowed |

Capacity became declarative too: only positions `0..capacity-1` are assignable, so the
constraint itself caps a 6-bed dorm at 6 — the advisory lock in `record_occupancy()` is
now a performance aid (avoids retry storms), **not** a correctness dependency.

## What the numbers mean

- **T1/T3:** 50 clients racing one room → exactly 1 winner; 40 racing 6 beds → exactly 6. The database arbitrates; application code cannot get this wrong.
- **T4:** the app role's direct INSERT dies with `42501` — the single-choke-point rule is enforced by grants, not discipline.
- **T5: ~1,000 booking commits/sec through the choke point** on an unremarkable container — three orders of magnitude above a 500-property tenant's peak (~1–5 bookings/sec). Latency headroom is not a concern.

**Verdict: the composite-slot mechanism is proven under concurrency. The ERD in SCHEMA.sql uses the claim-range design.**
