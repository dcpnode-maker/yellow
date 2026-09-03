# Order 389 — Operator audited business-day seal

**Status:** DRAFT-WAITING-ORDERS384-AND-388-D1118
**Phase:** 5 — Financials operator delivery
**Risk tier:** 3 — irreversible financial business-day latch

Wire the already approved `BusinessDaySealService.seal(tx,input)` into the independently
approved close workbench after its real permission prerequisite closes. The route is
`POST /api/v1/properties/:property/business-days/:businessDate/seal`, exact empty body,
no query, visible-ASCII header-only idempotency, exact `business_day.seal` scope and
property grant, with tenant/actor/audit envelope derived server-side.

The UI exposes one deliberate irreversible confirmation only after authoritative
workbench readiness; it never supplies readiness, force, reopen, carry, batch or
auto-seal instructions. Ambiguous retry preserves its key; every result refreshes
authoritative workbench truth. Middleware-owned `context.tx` is passed directly to the
service; migration0064 and the readiness predicate remain immutable. Exact replay,
conflict/concealment, concurrency, rollback, stale readiness, sealed-day and complete
operator accessibility/responsive proof require fresh independent Tier3 approval.
Status reconciliation and stable-local promotion remain separate guarded orders.

