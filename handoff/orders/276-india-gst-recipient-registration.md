# Order 276 — Resolve exact India GST registered-recipient candidate evidence

**Status:** BUILT-PENDING-REVIEW-D721
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-recipient-registration`
**Base:** `3114d24` (independently approved Order275 descendant)
**Risk tier:** 3 — new tenant/RLS statutory identity root; independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Add one typed, tenant-isolated, SELECT-only Party GST-registration root and one
read-only resolver for an exact caller-selected registration UUID. The result is
canonical registered-recipient candidate evidence only. It is not legal invoice-buyer,
folio-window, place-of-supply, tax-decomposition or IRP `BuyerDtls` authority.

## Natural-Solution Test

`party.attrs`, `party.display_name`, `party.legal_name`, contact/address rows and Party
roles are mutable CRM/profile truth and cannot become exact statutory registration
evidence or an indexed registration selection boundary. An extension is configuration,
not Party-owned legal identity. No existing typed primitive records an exact GSTIN,
state, legal identity and address against one active Party under tenant RLS. Therefore
one new typed registration table is the first safe fit; Party remains the sole person/
organisation primitive and no second person-like entity is created.

## Exact contract

- new `party_fiscal_registration` begins with `tenant_id`, has composite tenant/id
  primary identity, a composite tenant/Party foreign key, tenant-leading indexes,
  RLS and exact `app_role` SELECT-only authority;
- one exact row binds `id`, `party_id`, scheme `in-gstin`, checksum-valid 15-character
  GSTIN, matching current GST state/UT code, legal name <=100, nullable trade name
  <=100, address line1 <=100, locality <=50 and an exact six-digit nonzero PIN;
- `IndiaGstRecipientRegistrationService.discover/resolve(tx, input)` accepts only an
  exact plain input `{tenantId,recipientPartyId,registrationId}` and selects that exact
  active Party plus registration tuple under the transaction-local tenant context;
- missing, foreign, inactive/merged/anonymised, malformed or mismatched evidence fails
  closed without heuristic fallback or writes;
- result exposes only registrationId, partyId, scheme, GSTIN/state/legal/trade/address/
  locality/PIN and deterministic evidenceHash as recursively frozen canonical truth;
- no mutable Party profile, role, address, account, reservation or folio field is read
  as fallback and replay is byte-identical.

## Exact scope

- new `migrations/0048_party_fiscal_registration.sql`;
- new `src/contexts/tax-fiscal/india-gst-recipient-registration.ts`;
- `src/contexts/tax-fiscal/index.ts` export only;
- new `tests/india-gst-recipient-registration.intentional-red.test.ts`;
- new `tests/india-gst-recipient-registration.integration.test.ts`;
- affected migration, database acceptance, runtime-DML and schema-oracle tests;
- `tests/schema/expected.sql`;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`, `BUILD-PLAN.md`,
  `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`;
- this order, decision, ledger and later independent review evidence.

## Forbidden

No `BuyerDtls`, invoice-window/legal-buyer designation, reservation-primary/account-
Party inference, B2C `URP`, export, SEZ, deemed export, `Pos`, `SupTyp`, CGST/SGST/
IGST decomposition, item/value/tax/document/number/hash-chain/issue/submission/provider/
API/HTTP/UI, seed, credential, local/status, dependency, merge/public deploy, Phase7
or application-complete claim.

## Pre-registered proof

1. Intentional red proves migration/module/export/schema are absent before implementation.
2. Fresh PostgreSQL proves 48 migrations/100 tables/90 policies, exact composite FK,
   tenant-leading indexes, RLS and SELECT-only app authority; referee remains 11/11.
3. Exact happy/null-trade/replay/deep-freeze/hash proof and every GSTIN/state/PIN/text
   boundary are executable.
4. Exact registration/Party/tenant selection, inactive/merged/anonymised and hostile
   cases fail closed; CRM profile/address/role values can never substitute.
5. App-role DML is denied and byte-level financial/document/fiscal/submission effects
   remain unchanged; standing/static gates pass.
6. Fresh non-implementing Tier-3 reviewer personally executes the complete proof.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact schema/resolver and hostile proof are green.
- [x] Fresh schema/referee/standing/static gates are green.
- [ ] Fresh independent Tier-3 approval is recorded.
