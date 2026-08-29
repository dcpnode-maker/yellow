# Order 285 — Build exact India GST recipient SEZ-status evidence

**Status:** READY-D749
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-recipient-sez-status`
**Base:** `ab32439` (independently approved Order284 descendant)
**Risk tier:** 3 — new tenant/RLS statutory registration/SEZ evidence root; independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Add one typed SELECT-only registration-specific recipient status root and exact
read-only resolver for affirmative official evidence that the exact current Order276
GST registration is either a regular non-SEZ registration, an SEZ unit or an SEZ
developer. Absence or unsupported/stale evidence remains unresolved and never means
non-SEZ. This result is a later IGST section7(5)(b)/8(2) prerequisite only; it does
not decide supply nature, authorized operations, zero rating, levy or IRP fields.

## Natural-Solution Test

Official GST registration distinguishes SEZ unit/developer registrations from
non-SEZ registrations, while SEZ approval role/validity comes from its own official
LOA evidence. Party role/profile/address, BuyerDtls, account/reservation association,
GSTIN prefix, property co-location, `SupTyp` and missing data cannot own this truth.
Changing approved Order276 columns/hash would invalidate downstream approved lineage.
One narrow registration-FK/hash-bound status root is therefore the smallest natural
solution. Supplier-side status binds different Order272/284 roots and remains a
separate later order; authorized-operations endorsement remains separate again.

## Exact contract

- migration0052 creates `india_gst_recipient_sez_status` with tenant-leading id,
  exact recipient registration id/evidence hash and evidence-as-of date;
- GST registration evidence is fixed active and sourced from `gst_common_portal`;
  taxpayer type is exactly `regular`, `sez_unit` or `sez_developer` with its own
  lowercase SHA-256 evidence hash;
- `regular` requires every SEZ-approval field null and maps only to
  `affirmatively_non_sez_regular`; `sez_unit` requires in-force Form G evidence;
  `sez_developer` requires in-force Form B or C evidence; positive approval reference,
  finite canonical `[)` validity and lowercase SHA-256 are all mandatory, and
  `status_as_of` must fall inside validity;
- same-tenant composite FK targets `party_fiscal_registration`; one status is unique
  for tenant/registration/evidence-hash/as-of date, RLS is enabled and forced, and
  `app_role` has SELECT only with no product writer;
- `IndiaGstRecipientSezStatusService.resolve(tx,{tenantId,recipientPartyId,
  recipientRegistrationId,recipientSezStatusId})` accepts only the exact plain
  accessor/proxy/symbol-free four-UUID input, resolves exact current Order276 evidence,
  independently rehashes it and equality-selects the requested status row;
- return recursively frozen fixed-order `{recipientSezStatusId,recipient,
  statusAsOf,gstRegistration,sezStatus,approval,legalRule,evidenceHash}` with exact
  approval validity `{fromInclusive,toExclusive}` when present; final SHA-256 hashes
  fixed-order `{tenantId,...complete body except evidenceHash}` while tenant remains
  unexposed;
- no server-clock/latest-row/effective-date inference: `statusAsOf` is evidence time,
  not a claim that the snapshot controls a future supply date; replay and rejection
  are byte/count unchanged.

## Exact scope

- new `migrations/0052_india_gst_recipient_sez_status.sql`;
- new `src/contexts/tax-fiscal/india-gst-recipient-sez-status.ts`;
- `src/contexts/tax-fiscal/index.ts` export only;
- new intentional-red and PostgreSQL integration tests;
- exact migration, acceptance, runtime-DML, schema and `setup.sh` catalogue updates to
  52 migrations / 104 public tables / 94 RLS-enabled tenant tables / 94 policies /
  4 FORCE-RLS tables;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`;
- `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`;
- this order, decision, ledger and later independent review evidence.

## Forbidden

No inference from GSTIN/state/address/name containing SEZ, property co-location,
Party kind/role/attrs/status, account/reservation/folio Party/window/name/number,
BuyerDtls, `Pos`, Order283 relationship, extension/config/tax code/SAC or absence.
No supplier-side SEZ status, authorized-operations or specified-officer endorsement,
zero-rating/refund/payment-mode/`SEZWP`/`SEZWOP`, intra/inter-State result, levy/rate/
amount, `SupTyp`, `IgstOnIntra`, reverse charge, item, posting/correction, document,
submission/API/HTTP/UI/network. No writer, fact/event/lock, seed, credential, local/
status/promotion, dependency, merge/public deploy, Phase-7 or application completion.

## Pre-registered proof

1. Intentional red proves migration, table, resolver and export are absent.
2. Fresh PostgreSQL proves exact52/104/94/94/4, composite FK/unique/conditional
   CHECKs, forced RLS, SELECT-only ACL, normalized schema and referee11/11.
3. Exact unit/Form G, developer/Form B, co-developer/Form C and affirmative regular
   paths prove fixed bytes/hash/freeze/replay.
4. Missing/partial/mismatched approval tuple, regular-with-approval, malformed/empty/
   noncanonical validity, boundary/as-of, reference/hash/status/source/rule defects
   fail at PostgreSQL and resolver boundaries.
5. Missing, stale, unsupported, suspended/cancelled, expired/future, cross-tenant/
   Party/registration/status and hostile input/stored truth fail closed; absence never
   yields non-SEZ.
6. Party/profile/address/roles, account/reservation/folio labels, GSTIN prefix/address,
   buyer payload, `Pos`, same/different relationship, config/SAC/tax-code mutations
   never select or alter explicit evidence.
7. `app_role` DML is denied and cross-tenant reads are empty.
8. Before/after byte/count oracles cover this root, Orders276/279/282/283/284,
   facts/outbox/idempotency, journals/postings/tax details/documents/submissions.
9. Static scans prove absence of authorized-operations, zero-rating, supply-nature,
   levy, item/document/network and writer authority.
10. Focused, adjacent roots, acceptance, runtime-DML, migration, schema/setup/referee,
    standing/static and a fresh non-implementing Tier-3 reviewer personally execute
    the complete proof.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Exact schema/resolver and hostile PostgreSQL proof are green.
- [ ] Standing/static gates are green and no authority expands.
- [ ] Fresh independent Tier-3 approval is recorded.
