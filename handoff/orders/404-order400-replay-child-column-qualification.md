# Order 404 — Order400 replay child-column qualification

**Status:** ACTIVE-D1186
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-quoted-rate-applicability-evidence`
**Base:** exact Order403/402 red working state after `94691e3`
**Risk tier:** 3 — statutory idempotent replay
**Owner:** Codex implementation; fresh non-implementing Tier-3 reviewer

## Outcome

Repair only the D1185 PostgreSQL name collision. Every replay child-census subquery
inside migration0069 must qualify its table column `applicability_id` so it cannot
collide with the function's `RETURNS TABLE` output parameter. Divergent replay must
reach the existing governed SQLSTATE23505 outcome; exact replay stays write-free.

## Exact implementation scope

- `migrations/0069_india_gst_accommodation_quoted_rate_applicability.sql`: qualify
  only the affected replay child-table aliases/columns;
- the already admitted Order402 integration test for the permanent D1185 replay red;
- migration checksum/schema oracle updates already admitted by Order403 after SQL is
  final; this order/review, Orders400–403 status, `DECISIONS.log`, `handoff/LEDGER.md`.

## Required proof

D1185 42702 red becomes exact23505; exact replay, changed-actor divergence and
concurrent same-key arbitration are mutation-sensitive and write-censused; all
Order402/403 hostility and complete PG16.15 gates pass; fresh Tier-3 approval.

## Forbidden

No capability signature, authority, schema object/table count, behavior widening,
API/UI/local/deploy/merge/push or Order367 resumption before approval.
