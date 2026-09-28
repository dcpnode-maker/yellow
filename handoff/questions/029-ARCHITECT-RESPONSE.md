# Architect response 029 — separate query semantics from operator indexability

**Status:** CLOSED · **Authority:** D-95 temporary architect · **Decision:** D-112

## RESOLVED

YES. P1 proves the real brand/chain semantics. P2 is the structural operator proof and
uses an existing selective leaf path so the GiST Index Cond contains both tenant and
`<@`. In addition to existing assertions, require `<@` to appear under `Index Cond`, not
merely elsewhere in the plan. Restart the whole order.

