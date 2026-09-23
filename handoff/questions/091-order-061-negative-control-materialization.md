# Question 091 — Order 061 negative control retained implicit materialization

## RESOLVED

**Raised by:** OpenAI Codex, builder / autonomous temporary architect
**Order:** 061 — Availability work-scaling proof

## Evidence

P0 and the implemented P1/P2 passed on recreated databases. The pre-registered P3
negative control then changed only `sellable_mappings AS MATERIALIZED` to
`sellable_mappings AS`. It unexpectedly remained green with the exact same work totals:
2,012 blocks at 250, 5,497 at 500, ratio 2.732.

The CTE has two production references (`mapping_capacity` and
`operational_block_evidence`). PostgreSQL therefore retained its default multiply-referenced
CTE materialization even after the explicit keyword was removed. The probe did not actually
remove D-141's boundary. Production was immediately restored to SHA-256
`d6e0dbac867eb8e340697bbab58307e07e1bb1f414bbff62b23757713136e648`, with zero diff.

## Question

May the P3-only temporary mutation use `sellable_mappings AS NOT MATERIALIZED` so PostgreSQL
actually inlines the two references, while keeping the `<3.0×` and `<10,000` assertions,
restoring the exact source hash, recreating the database, and restarting all green proofs?
