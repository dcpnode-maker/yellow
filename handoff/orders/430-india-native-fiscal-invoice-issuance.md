# Order 430 — India native fiscal invoice issuance

**Status:** ACTIVE — D1302
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-native-fiscal-invoice-issuance`
**Base:** independently approved Order429/D1300 at `25d1db3`
**Risk tier:** 3 — legal numbering, immutable document, fiscal hash chain and writes
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Activation condition

Satisfied by the founder's explicit 2026-09-04 approval recorded in Question187 and
D1302. The complete recommended fiscal origin, series, format/reset, correction,
grouping, rounding and actor policy is binding; Order430 is ACTIVE.

## Outcome after activation

Add one complete Yellow-native India ordinary registered B2B accommodation invoice
issue path. It consumes a freshly resolved exact approved Order429 blocked-readiness
source and discharges only its three recorded policy/configuration blockers through
D1302 plus one exact configured fiscal series,
derives and allocates one legal supplier-registration/FY-bound number, creates final
`DocDtls` and the complete canonical invoice content, inserts one immutable issued
document and origin binding, advances the fiscal hash chain, records one fact and one
outbox event, and commits the replay receipt atomically. IRP remains the downstream
registration authority and never originates Yellow's document number.

## Natural-Solution Test

The existing `document_series`/`document` primitives already establish transactional
counter allocation and `prev_hash`, but they do not bind a fiscal series to the exact
supplier GST registration or Indian financial year. Order410's runtime allocator is
intentionally non-fiscal and cannot be widened. Order429 proves exact live fiscal
source and pre-document evidence while returning no action until policy exists.
Therefore the natural solution is one forward-only fiscal-series expansion, one
typed insert-only origin binding and one owner-mediated atomic issue capability—not
application-side numbering, an external invoice snapshot, or a shadow document store.

## Exact schema scope

Migration `0074_india_native_fiscal_invoice_authority.sql` may:

1. extend `document_series` with nullable `supplier_registration_id uuid` and
   `financial_year_start date`, while constraints require both for fiscal India
   `invoice|credit_note|debit_note` series and preserve legacy/non-fiscal rows;
2. bind fiscal series through tenant-leading composite foreign keys to the exact
   property and active supplier GST-registration root; require 1 April FY start;
3. add a tenant-leading partial unique index for exactly one canonical series per
   tenant/property/supplier-registration/document-kind/FY after approved series
   configuration, and reject zero or multiple issue candidates;
4. add insert-only, forced-RLS
   `india_gst_native_fiscal_document_origin` binding exact document, property,
   kind, reservation, folio window, source journal, supplier/recipient registrations,
   Order413/426/429 hashes and server-derived origin key;
5. add only tenant-leading indexes, composite integrity, owner capability functions,
   exact ACL changes, permission catalogue rows and event catalogue row required by
   this order.

No applied migration, especially `0001_init.sql` or `0073`, may be edited.

## Configuration capability

`create_india_native_fiscal_series` is owner-mediated, runtime-inaccessible except
through an authenticated server command with exact
`tax-fiscal.series:configure` property grant. It validates the active tenant,
property and supplier GST registration; derives the Indian FY; accepts one approved
Rule-46-compatible prefix only before first allocation; validates `[A-Za-z0-9/-]+`,
prefix bounds and the complete generated reference's sixteen-character ceiling;
creates or exactly replays one series starting at 1; and exposes no generic series
insert/update/delete or counter authority.

Default prefixes after Question187 approval are `I/2627/`, `C/2627/`, `D/2627/`
for FY 2026–27. Order430 configures invoice capability only; credit/debit series may
be created but their issue paths remain absent until correction evidence is approved.

## Atomic issue capability

`issue_india_native_fiscal_invoice` is the only issuance writer. In one transaction
it must:

1. require exact `yellow_runtime` → `app_role`, transaction-local tenant, active
   actor and exact-property `tax-fiscal.documents:issue` grant;
2. accept only Order429 source selectors plus actor, idempotency key and request
   correlation identity—never number, series, date, hashes, money, buyer, seller,
   tax, items, payload, IRN, QR or provider values;
3. acquire Order408's exact original-journal reversal advisory-lock key first, then
   the canonical tenant/reservation/folio fiscal lock, business-day lock, series row
   and document-chain tail in a single documented order; rerun Order429 after locks;
4. require the exact current unreversed Order429 source and hashes plus its exact
   `blocked_pending_fiscal_document_origin_policy` state, false readiness, empty
   actions and three ordered blockers. D1302 statically discharges origin/format
   policy and the locked configured series discharges series binding; any different,
   stale, reversed, mixed or already-issued evidence fails closed. Order430 must not
   relabel or mutate the Order429 result or claim that Order429 itself became ready;
5. derive the property-local transaction issue date and Indian FY; require exactly
   one canonical invoice series for the exact supplier registration and FY;
6. allocate the next counter under lock, format a Rule-46-valid reference no longer
   than sixteen characters, and build exact IRP `DocDtls` with `Typ='INV'`, that
   number and `Dt` derived from the same issue date;
7. preserve exact Order426 item, party, transaction and value evidence without
   recalculation; sum only the already approved integer component amounts and invent
   no document tax residual;
8. compute SHA-256 over one canonical fixed-order document body independent of JSONB
   storage order, bind `prev_hash` to the locked series tail, and insert one status
   `issued` document plus exact typed origin binding;
9. advance `next_no` and `last_doc_hash`, insert exactly one minimized non-PII fact
   and one catalogued `document.issued` outbox event, and persist the idempotent
   response in the same transaction;
10. return only the minimized immutable receipt. Any failure rolls back counter,
    document, origin, chain tail, fact, outbox and idempotency together.

The server-derived origin key binds tenant/property/reservation/folio-window/current
Order429 readiness hash. This preserves the approved rule that each routed folio
window/legal payer is a distinct invoice boundary and prevents a second native
invoice for the same exact current fiscal source. A later corrected source has new
evidence but requires the separately governed credit/debit path rather than another
ordinary invoice.

## Public receipt

Fixed fields only: `documentId`, `documentKind='invoice'`, `seriesId`, `docNo`,
`propertyNode`, `reservationId`, `folioId`, `supplierRegistrationId`,
`recipientRegistrationId`, `financialYearStart`, `currency='INR'`,
`status='issued'`, `businessDate`, `issuedAt`, `prevHash`, `sha256`,
`sourceEvidenceHash`, `preDocumentEvidenceHash`, `readinessEvidenceHash`, and
`replayed`. Tenant identity participates in hashes but is not redundantly disclosed.
The full legal payload remains behind a separately authorized document-read path.

## Required proof

1. Genuine intentional red for migration, tables, permissions, functions, service
   and exports before implementation.
2. Fresh PostgreSQL schema/RLS/ACL/SECURITY-DEFINER containment, exact search path,
   direct DML/counter/function denial and cross-tenant/property/registration concealment.
3. Rule-46 prefix/FY/date boundaries, property timezone and 16-character maximum.
4. One hundred concurrent distinct sources produce exactly `1..100`; same-origin
   contenders create one document; no duplicates or gaps.
5. Exact replay returns the original receipt without counter movement; changed-key
   reuse conflicts; publisher/fact/idempotency/document failures leave zero artifacts.
6. Reversal-versus-issue and seal-versus-issue races have one coherent winner under
   the recorded common lock order; sealed-source evidence may be read but no sealed
   journal is changed.
7. Document content/hash/previous-hash/origin and series tail are mutation-sensitive,
   canonical and immutable; PostgreSQL JSONB key order is non-authoritative.
8. Exact one fact/outbox event, minimized payloads, complete catalogue, migration
   replay, schema drift, setup, referee 11/11, standing/static gates.
9. Fresh non-implementing Tier-3 reviewer personally executes all high-risk proof.

## Forbidden

No external invoice adoption; no IRP submission/poll/IRN/QR/signed payload/provider
credential; no B2C/export/SEZ/special/mixed supply; no credit/debit/void/correction
issue path; no mutation/deletion of issued financial/fiscal evidence; no caller-
selected series/number/date/hash/money/payload; no generic document/series authority;
no UI, seed, stable-local, Docker, deploy, merge, push or Phase7 completion authority.

## Remaining founder-owned decision

Only Question187. Technical details already fixed by approved repository truth are:
folio window/legal payer as invoice split boundary; existing component-first integer
tax evidence with no new residual; IRP `Typ='INV'`; separate exact issue/configure
permissions; and reuse of Order408's journal-reversal lock key before currentness
revalidation. The recommended policy additionally makes property-local native issue
date the legal invoice date and selects one canonical series per exact scope/FY.
