# Question 099 — Order 065 rate-model persistence and event boundary

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 065  
**Natural-Solution Test:** a hotel rate-model selection is configuration attached to an existing
`rate_plan`. The baseline already provides versioned `extension` rows, platform-global
`extension_type` schemas, tenant RLS, `fact_log`, and an existing `extension.activated` event for
the later publish boundary. No new primitive is required.

May Order 065:

1. register platform catalogue type `rate_model` and tenant draft type `rate_plan_model` through
   the existing launch registry rather than a migration;
2. seed the ten D-230 model families as platform-global version-1 catalogue instances;
3. add a generic transaction-local extension-version insert that derives the next version under
   an advisory transaction lock, validates before insert, records one fact, and performs no
   update/delete;
4. store only a typed, non-monetary model-selection envelope in this order—rate plan/property,
   catalogue key, catalogue version, authoring mode, and for expert composition a bounded list of
   registered component keys;
5. create no outbox event while the row remains a draft, reserving the already-catalogued
   `extension.activated` event and all approval/publish behavior for Order 069?

## Answer

Yes. This is the first fit on the entity decision ladder and avoids a parallel rate system.
The draft must be insert-only through the ordered service, tenant/property authorized, and must
not accept prices, percentages, formulas, targeting, restrictions, policy overrides, or publish
authority. Unknown catalogue keys, stale catalogue versions, recursive expert composition, and
cross-tenant/property rate plans fail before insert. Concurrency must produce a gapless unique
version sequence. A draft fact is required; an activation event is not, because no active
business behavior changes.

