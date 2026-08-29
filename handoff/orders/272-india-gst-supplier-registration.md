# Order 272 — Resolve exact India GST supplier-registration evidence

**Status:** APPROVED-D711
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-supplier-registration`
**Base:** `3c9fb7c` (independently approved Order271 descendant)
**Risk tier:** 3 — new tenant/RLS statutory identity evidence
**Owner:** Codex implementation; independent non-implementing executable review mandatory

## Outcome

Add one SELECT-only configured property fiscal-registration root and one deterministic
resolver for scheme `in-gstin`. The resolver reuses approved positive-tax eligibility,
requires the frozen country/currency/jurisdiction identity to be exact `IN`/`INR`, and
returns only canonical supplier GSTIN, state, legal/trade name, address, locality,
pincode, registration identity and evidence hash. Missing, duplicate, malformed,
stale or mismatched evidence fails closed with zero writes.

This is the smallest safe prerequisite for later India CGST/SGST/IGST decomposition
and IRP seller payload. It does not decide either.

## Exact scope

- `migrations/0047_property_fiscal_registration.sql`
- `src/contexts/tax-fiscal/india-gst-supplier-registration.ts`
- `src/contexts/tax-fiscal/index.ts`
- `tests/india-gst-supplier-registration.intentional-red.test.ts`
- `tests/india-gst-supplier-registration.integration.test.ts`
- `tests/database-acceptance.integration.test.ts`
- `tests/migrate.integration.test.ts`
- `tests/runtime-dml-authority.integration.test.ts`
- `tests/schema/expected.sql`
- `setup.sh` only if exact catalogue assertions require `47/99/89`
- `docs/CONTRACTS.md`
- `docs/DOMAIN-MODEL-V1.md`
- `docs/SECURITY.md`
- `handoff/PHASE-7-PLAN.md`
- `BUILD-PLAN.md`
- `handoff/ROADMAP.md`
- this order, decision, ledger and independent review evidence

## Required invariants

- Tenant-leading key/index and tenant-isolated RLS; the property is a tenant-owned
  `org_node.kind='property'`.
- Exact scheme `in-gstin`, currency `INR`, property and frozen jurisdiction extension
  id/nullable-owner/key/version/content-hash binding; no latest/effective-date lookup.
- Canonical 15-character GSTIN structure and checksum; GSTIN prefix equals canonical
  two-digit state code.
- Nonblank bounded legal name, address line and locality plus exact six-digit pincode;
  bounded trade name may be absent.
- One exact mapping is structurally unique. No fallback to `org_node.config`, display
  names, party/guest records, jurisdiction display content or code coincidence.
- `app_role` receives SELECT only; runtime INSERT/UPDATE/DELETE and all cross-tenant
  visibility remain denied.
- Resolver uses the already-frozen eligibility/snapshot jurisdiction identity, never
  current mutable configuration or server clock, and returns deeply frozen stable
  canonical evidence with deterministic SHA-256.
- Missing/conflicting/invalid evidence fails closed. Financial, document, outbox,
  submission and idempotency counts remain unchanged.

## Proof matrix

1. Intentional red proves the module/migration capability is absent before build.
2. Exact happy path and byte-identical replay resolve one frozen India/INR identity.
3. Wrong tenant/property/country/currency/id/owner/key/version/hash never falls back.
4. GSTIN/checksum/state/pincode/name/address/locality defects fail closed.
5. Unique/tenant/RLS/ACL proof hides cross-tenant rows and denies runtime writes.
6. Zero-write proof covers journals, postings, fiscal documents, outbox,
   submissions and idempotency.
7. Forward/replay/no-op migration, database acceptance, runtime-DML containment and
   strict schema prove exact `47 migrations / 99 tables / 89 policies`.
8. Existing evaluator, attribution, plan, routing, posting and correction suites stay
   green; full standing/static gates and `./setup.sh --db-only` referee11/11 pass.
9. A fresh agent that implemented none of this personally executes the Tier-3 proof.

## Parallel lanes

- Lane A: migration, constraints, RLS/grants, catalogue/acceptance/schema proof.
- Lane B: resolver, GSTIN validation/checksum, evidence hashing and focused tests.
- Lane C: integration/security/zero-write fixtures plus contract/domain/security docs.
- Lane D: fresh independent review only after the candidate commit is frozen.

Lanes A–C may run concurrently against this exact contract. Database migration proof
runs serially in one isolated project; Lane D contributes no implementation.

## Forbidden

No buyer GST profile, SEZ inference, final place-of-supply decision, CGST/SGST/IGST
decomposition, document-rounding allocation, posting/correction/credit note, fiscal
document/number/hash chain, IRP payload/provider call, HTTP/UI, seed, credential,
runtime/local promotion, project-status, historical migration, merge, public deploy,
Phase7 or application-complete claim.

## Definition of done

- [x] Exact schema/ACL/RLS and resolver behavior are built.
- [x] Focused, adjacent, migration/schema/referee, standing and static proof is green.
- [x] Fresh independent Tier-3 executable review is recorded.
