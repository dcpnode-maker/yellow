# Order 391 — fresh independent Tier-3 review

**Verdict:** WITHHELD-D1127
**Activation:** `b3cf2c6`
**Candidate:** `6dbdc5a`
**Reviewer:** `/root/order391_fresh_tier3`, fresh non-implementing Tier 3

The candidate cannot be approved because its every-carried-event fail-closed promise
is still false when the event's aggregate discrepancy row is absent.
`workbench_reported_lineage` begins at `discrepancy` and only then counts matching
outbox evidence. Consequently a selected-day `discrepancy.carried` outbox event with
no corresponding discrepancy row never reaches `workbench_candidate_evidence` and
cannot be marked unsafe.

I independently reproduced this on a fresh official Windows PostgreSQL 16.15 cluster
with SCRAM credentials and `pg_stat_statements` preloaded after applying migrations
1–66. The fixture contained two open days and one selected-day
`discrepancy.carried` event for the exact tenant/property but deliberately omitted
both the aggregate discrepancy and carry link. The exact candidate service resolved
successfully instead of rejecting with
`BusinessDayCloseWorkbenchUnavailableError`. This is an orphan carried-evidence
fail-open and directly contradicts Order391's requirement that every selected-day or
relevant current-target carried event bind exactly one fully coherent safe link.

Before that hostile reproduction, reviewer-personal execution passed the combined
readiness/workbench/operator PostgreSQL matrix 22/0 (220 assertions), including the
D1121 and D1124 permanent regressions, all 48 prior carry mutations, coherent
source/target exclusions, ordinary candidate retention, one-statement/snapshot,
366/367 and 500/501 bounds, and zero-write checks. Focused static/unit execution
passed 16/0 (120 assertions), TypeScript, 141 import boundaries, license23 and diff
hygiene. A deliberate removal of current-target carried-event classification made
the permanent D1124 regression red 0/1 and exact restoration returned it green 1/0.
Those greens cannot support approval after the mandatory missing-aggregate red.

Required repair: inventory selected-day and relevant current-target carried outbox
events independently of the discrepancy table, require each event aggregate to bind
exactly one existing discrepancy and exactly one fully coherent safe target carry
link, and add a permanent missing-aggregate regression. A different fresh Tier-3
reviewer must rerun the full Order391 matrix. No product, permanent test, schema,
API/UI, stable local, `.yellow`, deploy, merge or push surface was changed.
