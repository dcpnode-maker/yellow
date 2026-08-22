# Question 088 — Projection status needs the established JSON boundary adapter

**Status:** CLOSED — temporary architect response recorded
**Order:** 060
**Evidence:** the first implemented `bun run typecheck` stopped because
`AvailabilityProjectionStatus` has no arbitrary index signature and therefore is not
assignable to the kernel's recursive `JsonValue`, despite containing only string, number and
null values. The same operator module already uses `jsonValue(...)` to cross this exact
boundary for typed domain results.

May the idempotent rebuild callback pass its typed status through the existing
`jsonValue(...)` adapter, with no response-shape, projection, idempotency or assertion change,
then restart typecheck and the complete focused proof from the top?
