# Question 118 — Order 069 immutable RMS binding schema reservation

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 069

Order 070 preflight found that `extension_type` registration accepts only an exactly replayed schema.
If Order 069 deploys `rate_plan_release` without a location for its already-planned RMS/API provider
binding, Order 070 cannot add that binding later without making existing seeded databases reject the
divergent schema. May Order 069 reserve one required nullable strict `rms_binding` field now, always
`null` for Order 069-created local releases, with the future exact shape limited to adapter key,
adapter version, maximum recommendation age and explicit local-evaluator outage fallback?

## Answer

Yes. This is a forward-compatibility correction to the new, not-yet-integrated extension type, not
RMS implementation permission. Register `rms_binding` as required and nullable. Its object form has
only `adapter_key`, positive `adapter_version`, positive bounded `maximum_age_seconds`, and
`outage_fallback: "local_evaluator"`. Order 069 creation rejects/does not accept the object form and
persists `null`; undo/list/hash round-trip it exactly. Order 070 alone may authorize a non-null
binding after its adapter/evidence proofs. Restart focused, standing, fresh referee and remote CI.

