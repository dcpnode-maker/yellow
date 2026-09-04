# Order 238 — Effective tax-jurisdiction resolution

**Status:** REPAIRED-AWAITING-DIFFERENT-FRESH-TIER3 — D1291
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/effective-tax-jurisdiction-resolution`
**Base:** `e764ed2` (built-unreviewed Order237)
**Risk tier:** 2 — read-only tax authority and version binding
**Owner:** Codex implementation; fresh independent Tier-3 review `/root/order427_tax_review`

## Outcome

One internal read-only service resolves the exact current tenant/property/business-date
`tax_assignment` to one exact active visible `tax_jurisdiction` extension version and
returns deeply frozen, content-hashed evidence for the pure Order237 evaluator.

## Fixed policy

- The caller supplies only an exact property UUID and already-derived property-local
  `YYYY-MM-DD` business date. PostgreSQL transaction-local tenant truth is authoritative;
  tenant id, jurisdiction key, extension id/version/content and precedence are never
  caller selected.
- The service first proves the property exists once in the active tenant, then reads
  exact tenant/property assignments whose PostgreSQL `daterange` contains the date.
  Zero assignments returns explicit `unassigned`; more than one fails closed.
- `[)` range semantics are preserved exactly. Lower bounds are inclusive, upper bounds
  exclusive; bounded and unbounded assignments are supported without process-clock or
  timezone inference.
- The assigned key is resolved only through the established yellow-runtime-only
  `ExtensionRegistry.listVisible(database-derived tenant)` adapter. Exactly one visible
  `type='tax_jurisdiction'`, matching key, `status='active'` version is required. Zero or
  multiple active visible versions fail closed. No tenant-over-global preference is
  invented.
- The current runtime adapter does not expose `extension.effective`; this order does not
  bypass it or silently add effective-time semantics. Effective extension publication
  needs a later explicit contract/capability if required.
- Resolved evidence binds exact extension id, owner tenant, key, version, recursively
  canonical copied/frozen content, SHA-256 content hash and deterministic assignment/
  extension evidence references. It is calculation input only, never posting or fiscal
  authority.
- The resolver writes nothing and emits no fact/event. Concurrent configuration change
  can only yield one complete before/after read result or fail closed; a returned exact
  version/hash remains reproducible evidence.

## Internal API

```ts
new TaxJurisdictionResolutionService(registry).resolve(tx, {
  propertyNode,
  businessDate,
})
```

The result is either frozen `{ state:'unassigned', tenantId, propertyNode,
businessDate }` or frozen `{ state:'resolved', tenantId, propertyNode, businessDate,
assignment:{ jurisdictionKey,effectiveFrom,effectiveTo,evidenceRef },
jurisdiction:{ extensionId,ownerTenantId,key,version,content,contentHash,evidenceRef } }`.

## Exact scope

- this order, `handoff/PHASE-7-PLAN.md`, Phase-7 entries in `BUILD-PLAN.md`,
  `DECISIONS.log` and `handoff/LEDGER.md`;
- new `src/contexts/tax-fiscal/resolution.ts` and the existing tax-fiscal `index.ts`;
- focused intentional-red and resolver tests under `tests/`;
- narrow resolver clarifications in `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`,
  `docs/SECURITY.md` and `docs/EXTENSIONS.md` only.

## Forbidden

- migration/schema/RLS/role/grant/function/index/table changes or raw extension reads;
- assignment/extension lifecycle writes, facts, outbox events or cache/projection truth;
- evaluator changes, tax calculation, multi-night composition or currency conversion;
- quote, rate-plan, reservation, folio, charge, posting, journal, correction, allocation,
  document, number, hash chain, provider, IRP, fiscal submission, HTTP or UI integration;
- tenant-over-global precedence, extension-effective-time policy,
  `rate_plan.tax_inclusive` precedence, negative correction or India invoice
  decomposition;
- local promotion, independent approval, merge, push, deploy, Phase-7 or app-complete
  claim.

## Pre-registered proof

- **P0 red:** service/export do not exist on Base.
- **P1 range:** lower included, upper excluded, bounded/unbounded and adjacent assignments
  resolve exactly; overlap fails closed.
- **P2 tenant/property:** active-tenant property is required; missing, foreign and
  malformed targets reveal no assignment or extension truth.
- **P3 version:** exact global or tenant active version resolves; draft/retired/
  wrong-type/wrong-key are ignored; missing or multiple active visible versions fail.
- **P4 evidence:** exact id/version/key/content hash and assignment bounds are stable;
  the complete recursively copied result is deeply frozen and input objects are not
  mutated or retained by reference.
- **P5 containment:** the established runtime visible-extension adapter remains the only
  global-plus-tenant read; PUBLIC/app-role denial and current database authority remain
  unchanged.
- **P6 hostile:** invalid UUID/date/impossible calendar date and hostile stored/result
  shapes fail before a partial result.
- **P7 read-only:** before/after truth proves zero writes to assignment, extension,
  fact/outbox, journal/posting, document/series/hash, fiscal submission or provider
  state.
- **P8 standing:** focused and adjacent extension/rate/tax tests plus full suite,
  typecheck, boundaries, licence, audit, JavaScript and diff checks remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact property/date assignment and unique active version resolve fail closed.
- [x] Canonical content hash, deep freeze, isolation and zero-write evidence execute.
- [x] Focused, adjacent and standing totals are transcribed.

Order428/D1291 repairs the containment proof without a product-source change. A
query-selected fixture row whose stored bounds exclude the requested date now reaches
only the normalization containment guard and requires its exact `Error` message;
removing that guard makes the named proof red. One disposable native PostgreSQL 17.2
cluster applied all 73 migrations and ran all six formerly skipped Order238 cases
(`15 pass, 0 fail`) under SCRAM-authenticated `yellow_runtime` (`NOSUPERUSER`,
`NOBYPASSRLS`) with transaction-local tenant context. The test fixture registered a
missing `tax_jurisdiction` type only when it created it and removed it afterward. The
cluster, port, data and credentials were removed. A different fresh Tier-3 reviewer
must personally repeat the load-bearing proof before approval.

## Built evidence

- The preregistered resolver red failed `0/2` before production existed. The completed
  focused suite passes `13/13` with 61 assertions, including four real PostgreSQL
  assignment/range/isolation/authority/zero-write proofs against the single existing
  PostgreSQL 16.15 local stack.
- Adjacent extension/rate-quote/tax proof passes `17/17` with 12 expected database
  skips and 50 assertions.
- The standing repository suite passes `797/797` with 708 environment skips, 8,188
  assertions and 1,505 tests across 272 files.
- Typecheck, 89-file import boundaries, 23-package licence policy, dependency audit
  (zero vulnerabilities), four-file JavaScript syntax and diff checks are green.
- No schema, migration, role, grant or function changed. Independent tax-authority
  approval remains deferred; no quote, posting, document, fiscal-finality, local
  promotion, merge, push, deployment, Phase-7 or app-complete claim is made.
