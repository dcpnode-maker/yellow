# Question 119 — Order 070 quote evidence and stay semantics

## BLOCKED — ARCHITECT NEEDED

Order 070 is reserved as the universal quote resolver and governed RMS/API port, but the accepted
Phase-3 contracts leave four runtime choices unstated:

1. Order 067 evaluates one room-night while Order 068 applies package rhythms over the whole LOS.
   Repeating Order 068 once per night would multiply per-stay packages and fixed promotions; using
   it once without aggregating nightly prices would omit room nights.
2. A BAR/parent evaluator reference binds only `source_kind`, UUID and version. It does not yet say
   which immutable entity supplies the amount, so accepting caller reference money would contradict
   Order 069's server-computed-price boundary.
3. Occupancy-responsive rules require a runtime basis-point signal but neither the caller nor the
   rates context may become occupancy truth.
4. The reserved RMS binding defines freshness and local fallback but not the exact adapter evidence,
   tamper/failure distinction, or whether RMS can bypass stored rules/floors/ceilings.

May Order 070 define one read-only stay quote as follows: canonical nightly evaluation followed by
one stay-level composition; BAR/parent sources are exact already-published release id/version
references evaluated recursively; occupancy basis points come from the existing derived
`availability_projection` while `AvailabilityService.search` remains the bookability authority; and
an adapter-bound RMS recommendation may replace only the nightly base before the stored typed rules,
manual overrides and floor/ceiling guards, with missing/error/stale responses falling back explicitly
to the stored local evaluator while malformed or scope-mismatched responses fail closed?

No migration, table, event, state transition, occupancy claim, tax calculation, HTTP route or UI is
proposed. Policy, channel-map and tax-assignment evidence would be loaded from the active tenant
rather than accepted from the quote caller.
