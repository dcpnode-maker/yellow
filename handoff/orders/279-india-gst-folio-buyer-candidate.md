# Order 279 — Resolve exact India GST folio-window buyer candidate association

**Status:** APPROVED-D731
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-folio-buyer-candidate`
**Base:** `8e001e9` (independently approved Order278 descendant)
**Risk tier:** 3 — tenant-scoped statutory candidate association; independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one read-only tenant-transaction service that equality-binds an explicitly
selected folio window and explicitly selected Order276 recipient registration into a
deterministic candidate association. It composes the independently approved Order276
registration evidence and Order278 `BuyerDtls` candidate without persisting or
authorizing a legal invoice buyer.

## Natural-Solution Test

The folio window is the presentation/invoice split boundary, while sibling Business,
Personal, Corrections or custom windows may share one account. Therefore account Party,
reservation primary/booker Party, window name and Party role cannot identify the legal
buyer. A new table would prematurely invent designation authoring, lifecycle,
supersession and approval policy. The smallest safe prerequisite is one exact read-only
association over caller-selected folio, Party and registration identities.

## Exact contract

- input is the exact plain accessor-free five-key object `{tenantId,propertyNode,
  folioId,recipientPartyId,registrationId}` with canonical UUIDs and no surplus truth;
- one tenant-scoped query returns exactly one folio/account/reservation anchor and
  equality-binds tenant, property, folio id, account id and reservation id;
- account property equals the explicit property; account and reservation currencies
  agree; folio window/status, account role/status and reservation status are canonical
  stored evidence only and do not authorize issue, settlement or designation;
- no relation to account Party, reservation primary/booker Party, guest role, window
  name or folio number is inferred or required;
- the service resolves the exact explicit Order276 registration and builds exact
  approved Order278 BuyerDtls bytes, then returns a recursively frozen candidate with
  fixed-order folio/account/reservation/window/status/currency/property lineage,
  Party/registration/evidence lineage, exact buyer payload bytes/hash and a
  deterministic SHA-256 `associationHash` over the complete fixed-order evidence;
- identical reads are byte-identical and source tables remain byte/count unchanged;
  missing, duplicate, foreign, malformed or incoherent truth fails closed.

## Exact scope

- new `src/contexts/tax-fiscal/india-gst-folio-buyer-candidate.ts`;
- `src/contexts/tax-fiscal/index.ts` export only;
- new `tests/india-gst-folio-buyer-candidate.intentional-red.test.ts`;
- new `tests/india-gst-folio-buyer-candidate.integration.test.ts`;
- adjacent Order188/276/278 and migration/schema/referee/runtime-DML proof;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`;
- `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`;
- this order, decision, ledger and later independent review evidence.

## Forbidden

No persisted or legal buyer designation; no automatic Party/account/reservation/window
inference; no create/update/delete, lock, event, outbox or idempotency write; no `Pos`,
`SupTyp`, B2C/`URP`, export, SEZ, deemed-export, CGST/SGST/IGST, item/value/tax policy;
no posting/correction, document allocation/issue/number/hash chain, submission,
provider/API/HTTP/UI; no schema/migration/seed/credential/local/status/dependency/merge/
public deploy, Phase7 or application-complete claim.

## Pre-registered proof

1. Intentional red proves the exact new module/export is absent.
2. Exact happy candidate, fixed field order, two sibling windows, deterministic bytes/
   hash, deep freeze and replay are proven from fresh PostgreSQL truth.
3. Cross-tenant/property/folio/account/reservation/Party/registration, absent/duplicate,
   hostile stored shape and every malformed/surplus/accessor/symbol/proxy input fail
   closed without mutation.
4. Explicit selection never substitutes account Party, reservation primary/booker
   Party, guest role, window name or folio number; statuses/currency remain evidence,
   not legal eligibility.
5. Before/after row-count and byte oracles prove zero writes across folio, account,
   reservation, Party registration, facts/outbox, documents, journals, postings and
   submissions; static effect scan proves read-only authority.
6. Focused, adjacent, schema/migration/referee/runtime-DML, standing/static gates and a
   fresh non-implementing Tier-3 reviewer personally execute the complete proof.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact read-only candidate association and hostile PostgreSQL proof are green.
- [x] Standing/static gates are green and no authority expands.
- [x] Fresh independent Tier-3 approval is recorded.
