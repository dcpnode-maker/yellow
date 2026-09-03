# Order 389 — Operator audited business-day seal

**Status:** BUILT-PENDING-FRESH-TIER3-REVIEW-D1156
**Phase:** 5 — Financials operator delivery
**Risk tier:** 3 — irreversible financial business-day latch

Wire the already approved `BusinessDaySealService.seal(tx,input)` into the independently
approved close workbench after its real permission prerequisite closes. The route is
`POST /api/v1/properties/:property/business-days/:businessDate/seal`, exact empty body,
no query, visible-ASCII header-only idempotency, exact
`financials.business-days:seal` edge scope and property grant, with tenant/actor/audit
envelope derived server-side. The existing service then independently rechecks the
internal `business_day.seal` database permission.

The UI exposes one deliberate irreversible confirmation only after authoritative
workbench readiness; it never supplies readiness, force, reopen, carry, batch or
auto-seal instructions. Ambiguous retry preserves its key; every result refreshes
authoritative workbench truth. Middleware-owned `context.tx` is passed directly to the
service; migration0064 and the readiness predicate remain immutable. Exact replay,
conflict/concealment, concurrency, rollback, stale readiness, sealed-day and complete
operator accessibility/responsive proof require fresh independent Tier3 approval.
Status reconciliation and stable-local promotion remain separate guarded orders.

“Exact empty body” means zero request bytes and an undefined parsed body. `{}`, any
other JSON value, form data and all client-supplied authority/readiness fields are
rejected. The response exposes only the bounded seal receipt, correlation identity
and replay truth admitted by the existing service contract.

## Exact file scope (D1153)

- `src/http/operator.ts`
- `src/app.ts`
- `src/server.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.js`
- `src/http/operator/operator.css`
- `docs/CONTRACTS.md`
- `docs/UI-SPEC.md`
- `tests/operator-business-day-seal.intentional-red.test.ts`
- `tests/operator-business-day-seal.test.ts`
- `tests/operator-business-day-seal.integration.test.ts`
- `tests/operator-business-day-seal-browser.integration.test.ts`
- `tests/operator-business-day-close-workbench.integration.test.ts`
- `tests/operator-business-day-close-workbench-behavior.integration.test.ts`
- `tests/operator-reservation-travel.integration.test.ts`
- this order, its review record, `DECISIONS.log` and `handoff/LEDGER.md`

The existing `src/contexts/financials/business-day-seal.ts`, its index export,
migration0064 and the readiness/workbench implementations are immutable for this
order. Any required path outside this list stops for a recorded scope amendment.

The existing Order384 operator workbench integration test enters scope only to replace
its pre-seal blanket prohibition with the exact governed POST boundary while retaining
all read-only workbench and stale-safe assertions (D1154).

The Order394 extracted-loader harness enters scope only to supply the new seal DOM
dependencies while preserving and rerunning every stale-discovery assertion. The
Order212 server-composition assertion enters scope only to append the new final seal
dependency after the unchanged reservation-travel dependency sequence (D1155).
