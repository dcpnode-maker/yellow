# Order 430 — India native fiscal invoice issuance

**Status:** REPAIRED — AWAITING DIFFERENT FRESH TIER-3 — D1321
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

## Repaired builder evidence — D1314

The D1306 findings are repaired at the candidate commit recorded in the ledger. A
fresh PostgreSQL 16.15 database applied all 74 migrations and proved 13/13 native
issuance cases with 568 assertions, including 100 distinct governed sources under one
tenant/property/series, unique contiguous numbers 1–100, counter 101, exact document,
origin, fact, event and completed-idempotency inventories, and a recomputed complete
hash chain. Order408 and audited-seal compatibility passed 15/15 with 161 assertions;
deterministic reversal-first, issue-first, seal-first and issue-first-then-seal paths
all preserve exact atomic outcomes. Unit/static gates passed 12/12 (75 assertions),
SECURITY DEFINER containment 3/3 (210 assertions), schema snapshot byte identity,
typecheck, boundaries, licences and diff checks. This is builder evidence only; a
different fresh Tier-3 reviewer must personally re-execute the proof before approval.

## Trust-boundary repair evidence — D1321

The D1316 legal-party/evidence-forgery finding is repaired in the database trust
boundary. The owner capability now authenticates the exact UTF-8 Order413, Order426
and Order429 preimages and hashes, proves their nested lineage, reconstructs exact
seller, buyer, transaction, room-night item and value sections from current persisted
roots, and requires complete equality before any fiscal lock or number allocation.
The permanent governed `yellow_runtime` to `app_role` hostility case supplies a
self-consistent rehashed forged seller and descendant evidence chain; it is rejected
with the counter unchanged and zero document, origin, fact, outbox or idempotency
artifacts.

A fresh PostgreSQL 17.2 database applied all 74 migrations and passed Order430/413
14/14 (570 assertions), including the 100-source contiguous 1–100/hash-chain proof;
Order408 plus audited seal 18/18 (167); SECURITY DEFINER 3/3 (210); focused static
28/28 (202); exact schema snapshot; and a separately reset referee 11/11. Typecheck,
161 boundaries, 23 licences, audit and diff checks pass. The full standing run is
1,473 pass and 1,068 environment skips with one unrelated Order195 Windows Chromium
`DevToolsActivePort` EBUSY failure tracked by active Order432. This remains builder
evidence: a different fresh non-implementing Tier-3 must personally reproduce the
high-risk proof before Order430 can close.

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

The TypeScript Order430 service is the only public issuance writer. It reruns and
validates Order429, then invokes one internal owner-mediated PostgreSQL capability
`commit_india_native_fiscal_invoice`. The capability may accept only the service's
exact frozen Order429 hashes, canonical pre-document JSON and server-derived typed
identities because PostgreSQL cannot invoke the approved TypeScript composers; it
must independently revalidate the actor, current unreversed persisted source,
journal/tax/folio/buyer/supplier identities, INR totals, same-origin absence and
series scope before trusting that internal evidence. It—not TypeScript—derives the
clock, property-local date/FY, number, `DocDtls`, stored-content canonical hash and
chain tail. In one transaction the combined service/capability must:

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
