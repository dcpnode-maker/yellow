# Order 299 — Tax extension effective-period evidence

**Status:** READY — implementation and fresh Tier-3 review required
**Phase:** 7 — Tax and India IRP
**Branch:** `phase-7/tax-extension-effective-period-evidence`
**Base:** `465d791` (independently approved Order 298)
**Risk tier:** 3 — migration, privileged projection and tenant scoping

## Outcome

Expose the exact PostgreSQL `extension.effective` lower and upper bounds for one
already-selected visible extension, then bind those bounds into Order 238's immutable
tax-jurisdiction resolution evidence. This closes the documented temporal-evidence gap
without choosing a clock, interpreting a property date as an instant, or calculating tax.

## Fixed contract

- the caller still supplies only the exact property id and already-derived property-local
  business date accepted by Order 238;
- Order 238 first selects the unique active visible tax-jurisdiction extension through
  the existing registry; only its database-derived tenant and exact selected extension id
  may be used to request the effective-period projection;
- a new narrow `yellow_owner`-owned, `yellow_runtime`-only PostgreSQL function returns
  exactly one visible extension's `lower(effective)` and `upper(effective)` as canonical
  UTC instant strings or null unbounded ends; tenant-owned and platform-global visibility
  match the existing adapter exactly;
- null/malformed tenant or extension ids, invisible/foreign ids, missing rows, duplicates,
  malformed bounds and changed identity fail closed; PUBLIC and `app_role` cannot execute;
- the resolver returns the exact bounds in the deeply frozen jurisdiction evidence and
  binds them into its deterministic evidence reference;
- this order records effective-period evidence only. It does not decide whether a
  property-local date is contained by a `tstzrange` and does not infer midnight/timezone.

## Scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, bounded Phase-7 plan/roadmap entries;
- one forward migration after `0058` adding only the narrow effective-period projection,
  exact owner/grants/revocations/postconditions;
- `src/kernel/extension.ts` and its existing public export surface;
- `src/contexts/tax-fiscal/resolution.ts` and existing tax-fiscal export surface;
- focused intentional-red, real PostgreSQL authority/tenant/range and resolver evidence tests;
- generated schema expectation and bounded contract/security/extension/domain documentation.

## Forbidden boundary

No edit to `migrations/0001_init.sql`; no table/column/index/RLS policy, raw table grant,
generic SQL capability, configuration write, event, cache or clock/latest selection; no
date-to-instant/property-timezone inference, rate selection/evaluation, section 14,
multi-night composition, SEZ zero-rating, CGST/SGST/UTGST/IGST decomposition, `SupTyp`,
`IgstOnIntra`, quote/reservation/folio/posting/correction/document/IRP/API/UI/local
promotion, merge/deploy or Phase/application-complete claim.

## Pre-registered proof

- **P0 red:** permanent test fails because selected jurisdiction evidence lacks exact
  extension effective bounds and the runtime capability does not exist.
- **P1 range:** bounded, lower-unbounded and upper-unbounded `tstzrange` bounds are
  returned byte-exactly without date/time interpretation.
- **P2 authority:** owner is `yellow_owner`; only `yellow_runtime` executes; PUBLIC and
  `app_role` receive denial; search path and fully qualified relations resist temp shadowing.
- **P3 tenancy:** tenant-owned and platform-global selected rows resolve for the active
  tenant; foreign tenant rows are invisible and disclose no row truth.
- **P4 identity/failure:** exact selected id resolves once; missing, malformed, null or
  changed identity fails closed with no partial evidence.
- **P5 evidence:** resolver output is deeply frozen and its evidence reference changes
  when either exact bound changes while id/version/content remain fixed.
- **P6 preservation:** standing/static/schema/setup/referee remain green with the new
  migration count and unchanged table count.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Exact effective-period projection and immutable resolver evidence are green.
- [ ] Fresh setup, schema, standing/static and referee gates are green.
- [ ] Fresh non-implementing Tier-3 reviewer personally executes hostile proof and approves.

