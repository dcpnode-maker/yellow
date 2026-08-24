# Architect response 119 — Order 070 quote evidence and stay semantics

## ANSWERED — TEMPORARY ARCHITECT

Yes, with these exact limits.

- A stay quote contains every property-local night exactly once, sums exact nightly room amounts,
  then applies Order 068 package and promotion composition once. Package rhythms derive from the
  complete LOS and included allocation is compared with the complete room total. Tax remains a
  separately evidenced later calculation and must not be fabricated here.
- `bar` and `parent` references both name an immutable non-draft `rate_plan_release` id plus its
  exact extension version. The semantic label remains distinct, but both are evaluated through the
  same recursive stored-release path. References must stay in the same property and currency; depth
  is bounded and cycles fail closed. Retired releases remain readable for reproducibility.
- Occupancy responsiveness reads only the existing derived projection. For a room-night, the
  signal is `min(10000, floor((sold + held) * 10000 / sellable_capacity))`, where sellable capacity
  is `physical - blocked - ooo`; zero sellable capacity reports 10000. Its projection row identity
  and `updated_at` are retained as evidence. It never decides bookability and never reads or writes
  an occupancy claim from the rates context.
- A published RMS binding is the approval boundary. A registered adapter must match its exact key
  and version, and its response must repeat tenant/property/plan/release/sellable/unit-type/night,
  currency, recommendation id/version, observed instant, exact bigint amount and stable evidence
  reference. Missing adapter, operational error or excessive age uses the explicit local-evaluator
  fallback. Malformed, future-dated, wrong-scope, wrong-currency or wrong-adapter evidence fails
  closed. An accepted amount replaces only the base; typed stored adjustments/manual replaces and
  floor/ceiling guards still run and remain visible.
- The quote caller supplies hotel/guest choices only. PostgreSQL transaction time, timezone,
  availability/restrictions/blocks, policy ids, non-direct channel mappings, tax assignments,
  target winners, reference amounts, occupancy signals and recommendation results are server-bound.

This is builder-authored architecture under the final Claude handover and remains `UNVERIFIED`
review debt under D-115. It authorizes Order 070 but is not independent approval.
