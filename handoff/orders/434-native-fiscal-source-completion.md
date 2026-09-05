# Order 434 — Complete the first native fiscal invoice source

**Status:** ACTIVE — implementation in progress; no completion or review approval — D1330
**Phase:** 7 · YF-008, YF-009, YF-023
**Implementation base:** `591ace8` (includes the complete Order432 current-catalogue repair)

**Latest implementation work:** [Corrected/transferred source issuance and the combined maximum](#correctedtransferred-source-issuance-and-the-combined-maximum).
The actual runtime command now commits an ordinary, rounded-zero-tax or genuine
rate-change invoice from real charge, intake and valuation sources, without
reposting revenue. Source locks, preparation authentication, accounting and final
document/receipt commit execute together. A non-implementer personally passed
eleven runtime cases, including current permission checks, partial-COMMIT rollback,
100 identical-key requests, two-key arbitration, replay after ephemeral
receipt/event removal, genuine payment/folio/day closure, and 100 distinct sources
sharing a gapless invoice series. This is bounded proof, not
complete Order434 acceptance. Remaining acceptance and migration integration are
listed below. The retained local app is unchanged.

**Date:** 2026-09-05

**Risk:** Tier3 — fiscal chains, new persisted evidence, migrations, accounting, numbering and RLS

**Authority read:** `PROJECT.md`, D-777, D1302–D1304, D1316, D1321, D1323, Question188; repository HEAD `5695e61`, latest decision D1327

**Draft owner:** Codex `/root/order430_complete_provenance`

**Independent reviewer:** a different non-implementing Tier3 agent, assigned after implementation

**Current private integration contracts — D1361:** issuer authority locks stabilize
the complete qualifying grant graph in deterministic table/key order; the private
persisted-tax projection checker compares both parents and all four child sets
against fresh canonical sources. The two-UUID preparation authenticator must
reconstruct actual current-transaction roots, request, series and D1360 source
basis; it is not a durable completed-receipt replay reader. These remain inside
the already scoped preparation draft and admitted tests, with no runtime grant.

For the native write branch, after all source/day/series locks, acquire D99 and
publish the accounting-request event before inserting timing/applicability/tax.
The timing row's event identity is non-null; its generated event UUID can be
allocated before publication, but the event sequence is allocated under D99.
D1360 excludes the sequence and payload hash, so this has no circular preimage.
The financial handler and final document/receipt still share that transaction.
This clarifies the earlier logical list of effects; it does not allow partial
commit, additional public capability or a source-authentication placeholder.

**Bounded technical checks:** completed against existing outbox, correction,
transfer and catalogue sources on2026-09-05; decisions below are an implementation
plan, not executed database/concurrency proof. D-94/D-98/D-99 govern event delivery.

## One outcome, not three separately completed envelopes

From real, already recorded accommodation consideration, explicit service and
payment evidence, a governed ordinary-Rule47 assertion and a genuine final
valuation, an authorized actor can issue the **first Yellow-native invoice with
no external invoice anywhere in its ancestry**. The actual property-local issue
date, date-dependent tax evidence, any incremental tax accounting, canonical
source graph, legal number, immutable document/origin, audit facts, outbox and
completed idempotency receipt commit in one PostgreSQL transaction.

All of Question188 A+B+C are acceptance conditions of this order. Recording the
missing assertion alone, replacing one selector alone, accepting a synthetic
external invoice, or successfully issuing from owner-inserted derived fixtures
does not deliver the outcome. Revenue must not be posted a second time.

The deliverable is the governed domain/database command and its executable
proof, not an operator screen, HTTP endpoint, external invoice adoption, IRP
registration, provider integration, migration of the retained local application,
or Phase7 completion. Order433 design and Order432 CI work remain separate.

## What is known, and what has not been reproduced

This draft follows source/contract inspection, not an executed reproduction of a
vulnerability or a new PostgreSQL failure. No product code, applied migration,
fixture, schema snapshot or runtime was changed to investigate these findings.
The earlier unchanged focused unit run was 39 passed / 0 failed / 113 assertions;
it is not proof of this repair. Historical Order430 and reviewer results remain
historical and do not approve this order.

1. **Missing persisted ordinary-regime root.** Order293 and the Rule47 contract
   require an affirmative external `ordinary_rule47_30_day` assertion, source
   `governed_rule47_ordinary_regime_record`, legal basis
   `CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT`. Supplier Order295 and
   recipient Order296 hashes include `ordinaryRegimeEvidenceSha256`; Order297
   replays both and Order413 retains the result. Migrations through0074 do not
   persist that assertion or a canonical root committing to it. The Section14,
   levy, lineage and attribution hashes in0069 are not substitutes. Relevant
   sources: `docs/CONTRACTS.md` Rule47 contract, supplier timing line171,
   recipient timing line89, and Question188's exact evidence inventory.
2. **External-invoice prerequisite.** Order292/0058 means an already issued,
   full-attribution supplier tax invoice with series, serial and issue date;
   it is not an intention to invoice. Order400 requires it before final tax,
   accounting and Order413→426→429→430. Requiring that existing invoice to issue
   the native invoice is the wrong source branch. D1302 changes the required
   outcome; it does not authorize pretending an external invoice is native.
3. **Current-date gap.** Order340 admits six arrangements spanning a rate
   change; its selector rejects an all-before or all-after arrangement. In0069
   the Section14 case/date/hash are mandatory. The current native source
   factory inserts a cross-cutover case label beside equal/current dates
   instead of exercising that writer. A normal same-version date path is
   necessary, as well as the existing genuine-rate-change branch.
4. **Duplicate consideration risk.** The final-valuation writer in0062 consumes
   complete live revenue/adjustment posting roots and current folio fragments.
   The existing Order407 journal independently posts guest grand total,
   consideration revenue and component tax. Combining both unchanged posts
   consideration again. Native fixtures currently insert derived valuation,
   applicability and tax rows; they do not demonstrate the real charge-to-
   valuation-to-invoice accounting outcome.
5. **Incomplete canonical binding.** D1323 identifies missing persisted
   comparison for complete Order413 timing/financial ancestry and three of the
   four Order426 lineage hashes. Agreement among caller-provided digest bytes
   is not authentication of the database-root graph.

## Fixed policy; no invented founder decision

D1302 remains exact: native origin; one canonical series per tenant, property,
supplier GST registration, document kind and Indian financial year; approved
I/C/D defaults and April1 property-local reset; no number reuse; separately
numbered credit/debit corrections; separate folio-window/legal-payer invoices;
component-first integer totals; server-owned actor, date, number and hash.
D1303 preserves Order429's false readiness, no actions and exact three blockers;
only D1302 policy and a locked configured series discharge them at native issue.

D-777 remains **ordinary only, affirmatively asserted**. This order cannot infer
ordinary treatment from registration, service type, silence, another digest or
the absence of an exception. No continuous-supply, reverse-charge, financial-
sector or other exceptional timing policy is added. Existing corrected rate
history and component contracts remain authoritative; no old nil-rate example
or superseded rate content is restored.

No missing founder legal/business choice was identified for this outcome. The
gaps are technical persistence, source selection and atomic composition under
existing policy. New exceptional regimes, retrospective treatment, external
adoption, or an issued-document correction mechanism would require their own
authority. This draft neither authorizes irreversible external actions nor asks
the founder to decide database implementation details.

## Lowest-change source design

### 1. Persist original evidence once, with explicit actors

Add exactly one new independent evidence root:
`india_gst_accommodation_ordinary_regime_evidence`.

- Store tenant/id, property, reservation, exact service snapshot, attribution and
  reservation lineage, fixed regime/source/legal literals, external SHA256,
  authenticated recording actor, request identity/hash, server evidence hash and
  recorded time. Use tenant-leading composite integrity and indexes. A service
  root has one unambiguous immutable assertion; do not silently replace it.
- The recorder requires the existing property-scoped
  `tax-fiscal.india-valuation:finalize` permission. This is evidence supporting
  final valuation, not a new general permission or an automatic issuer power.
  Validate the active actor/property grant at the write and at replay. The
  native issue actor also needs the existing issue permission and the finalizing
  permission for the new date-dependent completion. Configuration permission
  alone and issue permission alone cannot manufacture ordinary evidence.
- Add bounded governed recorders for the **existing**0056 service and0057
  payment snapshot tables. Reuse their exact external source/legal contracts;
  no duplicate service/payment table. Capture supplied service completion and
  books/bank payment dates/digests explicitly. Do not infer bank evidence,
  initiate a payment, change money, or manufacture an invoice.
- Derive scope, amount/full-attribution identity, IDs, canonical hashes and
  facts/outbox in owner-mediated SQL. New tables are append-only, forced-RLS,
  app-role SELECT-only; no runtime direct DML. Ordinary input validation and
  independent tenant/actor/property authorization apply to every recorder.

The following new event names are vacant in `docs/EVENTS.md`, product source and
migrations through0074 and are selected for event version1:
`india_gst.accommodation_service_provision_recorded`,
`india_gst.accommodation_payment_receipt_recorded` and
`india_gst.accommodation_ordinary_regime_recorded`. These are TaxFiscal-owned
evidence events, not payment events. The same absence check also confirms the
two selected native accounting events named below; do not rename existing events.

### 2. Reuse final valuation; remove its native invoice dependency

Extend the existing final-valuation aggregate and its four tables with a strict
origin/basis discriminator, rather than create a second valuation ledger.

- Preserve existing external/quoted applicability rows, preimages, hashes and
  command behavior byte-for-byte. Their Order341 hash continues to mean exactly
  what it meant; do not repurpose that field for another digest.
- A `native_consideration` basis binds service, attribution, lineage, the complete
  current consideration-root/fragment set, Section15 source classifications,
  distinct Section15 ordinary attestation and any required approval, room-night
  identities and allocation weights from the canonical quote. It has an
  explicitly named basis hash and no external invoice or provisional tax-date
  result. Reuse the existing bigint/largest-remainder allocation rules.
- A native finalization command records genuine valuation from those roots
  before issuance. Commit source intake and valuation in their own governed
  transactions before entering the dedicated native issue transaction. This
  prevents an earlier outbox publication from being held while issue acquires
  new financial locks. Reuse recorded approval
  actors; a later authorized issuer may consume an authenticated valuation
  recorded by another authorized actor. Do not rewrite the original actor or
  relax existing legacy actor-equality contracts accidentally.
- Native issuance admits complete, current, tax-exclusive consideration. Manual
  unresolved treatment, unsupported tax-inclusive inputs, missing source
  classification, existing tax-payable/tax-detail companions, ambiguous partial
  roots, or changed allocation/source sets fail closed. Existing externally
  finalized/posted tax cannot be relabelled native because amounts match.

### 3. One dependent native timing projection, not a prior invoice

Add `india_gst_native_invoice_timing` as a **dependent issuance projection**,
not an externally asserted document and not a separately committable draft.
This is the second and final new table proposed by this order.

It binds a database-generated prospective document UUID, tenant/property/
reservation/folio, service/payment/ordinary-regime/valuation IDs, the transaction
timestamp, property-local legal date, issuing transaction identity, actor and
request identity, and a server-derived timing hash. A deferred, initially
deferred tenant/document foreign key and deferred consistency constraint require
the exact document/origin and typed native sources by COMMIT. A prepared timing
row without completed issuance cannot commit. Validate the current transaction
at every prepare/complete capability boundary; caller GUCs are not authority.

The source preimage contains no legal number or document content hash. Generate
the document identity before source composition, allocate the legal number only
after all source/authentication checks, and derive every date-dependent result
from that one transaction's actual property-local date. No public date, clock,
document UUID, number or arbitrary timing-row override is admitted.

### 4. Native/external selectors and rate timing are explicit unions

| Contract | Existing external branch | New native branch |
| --- | --- | --- |
| Invoice timing source | Order292/0058 issued external snapshot | Current-transaction dependent native timing projection |
| Valuation basis | Existing quoted applicability preimage | Persisted native consideration basis |
| Ordinary regime | Preserve existing pure external contract | Required exact persisted ordinary-regime FK/digest |
| Date/rate selection | Preserve approved external path | Ordinary same-version or genuine Section14 change |
| Final accounting | Existing full-gross Order407 binding | Existing consideration plus native component-tax delta |
| Fiscal graph | Existing approved source version | Explicit native source version, never relabelled external |

Extend the existing applicability table with exact mutually exclusive invoice
selectors and the native valuation/ordinary-root links. Nullability is allowed
only through discriminator-aware CHECK/FK constraints; do not weaken the old
branch. Give native timing and rate-selection evidence their own named hashes.

The native date/rate selector has two exhaustive admitted alternatives:

- `ordinary_section13_single_version`: all relevant complete property-local
  service, invoice, books, bank and receipt date envelopes lie in the same
  approved historical rate member. Use the existing ordinary Rule47/Section13
  semantics and Order306 whole-day historical resolution. No invented Section14
  case, rate-change date, sentinel hash or latest-rate shortcut.
- Genuine rate change: reuse Order338/339's complete governed calendar and
  Order340's six admitted cases with the existing rate-version pair/history.
  Preserve unadmitted equality/cutover, mixed-period and insufficient-calendar
  failures. Do not stretch a six-case result to represent a no-change case.

Compose Orders295/296/297 using an origin-aware invoice timing adapter. Preserve
the supplier's and recipient's **different** canonical hashing algorithms and
full Order297 replay, rather than normalizing both to a convenient new hash.
Order298's effective-rate purpose composes through its approved303/305 corrected
history and306 resolver, then the existing308/310/337 family/identity/numeric
contracts. Order400/367 persistence consumes these native typed results. The
existing external selectors and results remain available for their original
read-only/source use; external adoption is still not a native issue path.

### 5. Complete accounting without posting consideration twice

Extend the existing final-component-tax journal binding with an explicit native
accounting variant. Preserve Order407's legacy full-gross operation unchanged.

The native variant references the genuine valuation and complete existing
consideration journals/fragments and records only the final component-tax delta.
For each positive component, post the configured tax code's balanced guest debit
and component-payable credit in canonical order. Reuse semantic routing and
integer amounts; no new revenue line, revenue reversal, aggregate tax code guess,
new residual, or replacement of existing posting lines is permitted.

For a final all-zero tax result, persist the binding with no journal. Permit a
null tax-journal reference **only for the native zero-tax variant**; do not
insert an empty/zero-line journal or invent a journal ID. The native financial
source binds both the consideration journal set and the optional tax journal.
The document origin references that accounting binding and complete source
identity; preserve old non-null journal requirements for legacy rows.

Required money proof, in every component family: consideration revenue is
unchanged by native issue; guest-balance increase equals final incremental tax;
component payables increase by exactly their components; every new journal is
balanced; invoice total equals consideration plus the approved integer component
sum. Payment full-attribution/coverage must agree with the resulting tax/grand
total contract; a changed amount cannot be silently rewritten to fit the invoice.

Use an owner-mediated native accounting capability with SQL-derived money and
routes. Emit `india_gst.native_accommodation_accounting_bound` for both zero and
nonzero variants, and the existing `journal.posted` event only when a journal is
actually posted. Do not change generic payments, settlement, trust or revenue
posting behavior.

### 6. Selected event-first, same-transaction wiring

`PROJECT.md` outranks the proposed architecture document: cross-context effects
must go through outbox events. The command cannot directly invoke a foreign
context's repository, and an asynchronously later accounting write cannot satisfy
atomic issuance.

The existing `PostgresEventBus.consumeBatch`/`consumeUnpublishedBatch` in
`src/kernel/outbox.ts` reserve their own connection, BEGIN, obtain a consumer
cursor, mark IDs, invoke handlers and COMMIT. They cannot participate in the
uncommitted issuing Tx. `runtime_consumer_mark(text,uuid)` in0015 is granted to
yellow_runtime, not app_role;0002's consumer tables describe delivery progress,
not a fiscal authorization root. Do not change these APIs, roles, cursors or
grants to implement native issue.

Use the single `src/commands/issue-india-native-fiscal-invoice.ts` composition
root. It imports only TaxFiscal/Financials index exports and kernel ports,
constructs the Financials-owned `IndiaNativeFiscalAccountingEventHandler`,
injects that narrow handler into `IndiaNativeFiscalInvoiceIssuanceService`, and
opens a **dedicated** `Database.withTenantTransaction` for the issue operation.
The service remains the sole public domain issue writer; its internal Tx method
does not open another connection. No caller composes prior publishing writes in
this Tx. Include `src/commands` in the existing boundary checker and its tests.

The exact ordered interaction is:

1. TaxFiscal's new `prepare_india_native_fiscal_invoice_v2` authenticates the
   request, obtains all ordered locks described below, records dependent timing
   and canonical applicability/tax, then writes the TaxFiscal-owned version1
   `india_gst.native_accommodation_accounting_requested` outbox event. Its typed
   aggregate is the native timing projection. Its identity-only payload binds
   preparation/document, tax, applicability, valuation, reservation and folio
   IDs and the canonical native source-basis hash; no caller money or legal body.
   The projection retains the exact event seq/UUID and canonical payload hash.
2. The service invokes the injected Financials handler with only tenant ID and
   the persisted event UUID in **the same Tx**. The handler calls the narrow
   `consume_india_native_fiscal_accounting_event` owner capability. It resolves
   exactly one tenant/event row (outbox UUID alone is not a unique catalogue key),
   verifies its seq, type/version, aggregate, actor/property/date/request and
   exact payload against the typed preparation/tax roots, and requires the
   preparation's current transaction identity. Event existence or payload alone
   never authorizes accounting.
3. That capability derives all money/routes and inserts the native accounting
   binding and optional tax journal/lines, then emits the Financials-owned
   version1 `india_gst.native_accommodation_accounting_bound`. `journal.posted`
   is emitted only for a real journal. Set causation to the request event UUID.
   Its SQL helpers are private; the event-consuming capability may be granted
   only to governed app_role, with no arbitrary journal/date/account/money input.
4. TaxFiscal rereads the Financials-owned source through its index query port,
   composes413→426→429, and calls `commit_india_native_fiscal_invoice_v2`.
   PostgreSQL authenticates the complete graph and only then allocates/commits
   the document, origin, chain and completed actor-bound issue receipt.

Durable effect idempotency lives in the existing accounting binding: add native-
only preparation ID, request-event seq/UUID and canonical event-payload hash,
unique by `(tenant_id, native_timing_id)` and `(tenant_id, request_event_seq)`.
Both a same-Tx repeat and an already completed delivery must match the exact
immutable binding and return it without writing. An unbound preparation from a
different transaction fails closed. A new asynchronous worker/consumer is not
needed; if this handler is later dispatched by a relay, the committed binding
already makes the delivery a no-op. Do not use `consumer_processed` as financial
authority or weaken its access to add a marker here.

Do not create a permanent FK from a fiscal row to prunable `outbox`: retain typed
event identity/hash and validate the event during prepare/consume/final commit.
After pruning, exact public replay is authenticated by the permanent timing,
accounting binding and origin/receipt, not by inventing another event. Existing
outbox pruning/delivery contracts and kernel implementation remain unchanged.

Every new owner SQL publisher takes the existing D-99 transaction advisory
`OUTBOX_PUBLISH_LOCK = 6441674055002974568` immediately before its first outbox
INSERT, after **all** pre-existing financial, source, day and series locks. Later
publishes reuse that lock. No handler may acquire another pre-existing account,
folio, day, source-scope or series lock after publication; only already-locked
rows and rows born in this Tx may be written. Final validation precedes number
allocation, but does not postpone the series **lock** until after publication.
This keeps the global publish lock at the short commit tail and avoids an
outbox-lock→financial/series-lock inversion. No new event bus or queue is added.

### 7. Authenticate the entire canonical graph in PostgreSQL

The issuing boundary resolves typed IDs to locked persisted rows and reconstructs
the canonical source/predecessor graph itself. TypeScript may compose the same
graph for explainable validation, but is never its authentication authority.

- Bind exact native valuation/applicability/tax IDs, generations, predecessor
  hashes and persisted hash columns, classifications/approvals, service/payment/
  ordinary evidence, actual timing and rate selection, routes, all consideration
  and tax journal lines, complete room-night/component sets and nested hashes.
- Rebuild complete Order413 `supplyNatureAtTimeOfSupply` and financial source,
  including `predecessorHashes`, `journalLines`, `roomNights`, nested
  `evidenceHash`, `applicabilityId`, `valuationId` and exact key sets. Preserve
  canonical key/array ordering and UTF-8 preimages, independent of JSONB output
  key order. Compare stored authoritative columns as well as hashes.
- Rebuild all four Order426 lineage hashes: `sourceEvidenceHash`,
  `preDocumentEvidenceAssemblyHash`,
  `serviceQuantityUqcCompatibilityEvidenceHash` and
  `itemCandidatesEvidenceHash`. Authenticate the424 party/transaction/item/value
  children and425 item/source correspondences, not only the outer digests.
- Reuse the strict Order414 validator/native union and existing419/420/422/423/
  424/425/426 composers. Avoid copying the entire descendant chain into parallel
  TypeScript modules. Extend narrowly where the source discriminator requires it.
- Rerun exact Order429, preserving its frozen false/no-action/three-blocker result.
  A changed source, state, action, blocker or canonical hash rejects before any
  number is allocated. No opaque stored JSON becomes a shadow source of truth.

The new issue request selects the exact property/reservation/folio, native
valuation, service, payment, ordinary assertion, supplier service-location/
registration-status/SEZ-status, recipient registration/SEZ-status and
classification roots, with an explicitly governed calendar only when required.
Tenant, actor and request envelope remain authenticated inputs. Derive recipient
party from valuation, supplier registration from location and rate history from
the approved registry. Accept no external-invoice selector, supplied legal body,
number, date, tax amount, source/readiness hash or readiness boolean as authority.

Keep request hashing actor-bound and independent of the derived clock so a later-
day exact replay returns the original immutable receipt after current permission
validation. A changed request with the same key conflicts. A second distinct
request cannot create another ordinary invoice for the same consumed folio
window/source boundary, even with a different payer selector.

## Lock order and immutable correction boundary

Source inspection shows the following existing orderings. They are constraints
on this implementation, not invitations to rewrite unrelated financial writers.

- Valuation0062 and applicability0069/final-tax0070 take the tenant/reservation/
  folio scope advisory key (seed0) before their folio/source locks.
- Generic posting/correction locks account IDs in sorted order before the folio.
  Generic corrections then take root188 and original-journal0 keys; positive tax
  corrections take journal266; Order408 takes its journal408 key.
- Transfer0020 takes guest account, sorted source/destination folios, then sorted
  root188 keys before recomputing allocation/correction closure.
- Additional-window creation takes reservation-family188 before financial rows.
  Native issue does not open a window and must not acquire that family key late.
- Existing0074 takes the408 service key before native430 scope/request keys. The new path
  creates its tax journal within the transaction; it must first coordinate all
  pre-existing consideration accounts/roots, not blindly copy that ordering.
- Business-day sealing takes its day row FOR UPDATE and reads readiness without
  financial row locks. Financial commands take the day lock after financial rows.
-0025's `create_receivable_transfer` already calls `lock_financial_rows` for the
  discovered guest and receivable accounts before its joined
  `FOR UPDATE OF folio, guest, target, party`. D1350 corrects the original draft's
  contrary assumption after inspecting the applied file, lines133–156. Preserve
  this account-first implementation and prove its native-issue compatibility.

Implement and document one order for all new native entry points:

1. Tenant/reservation/selected-folio scope0; native applicability400 and final-
   tax367 bookkeeping locks in a fixed order where required.
2. Discover and lock the **complete** consideration-journal account set, guest
   account and configured component payable accounts, sorted by UUID; then the
   selected folio. Derive this set in SQL, not from an untrusted account list.
   Existing positive-tax helper's primary-window and2–66-account restrictions
   are not silently relaxed for the rest of the application; a bounded native
   helper must support the native bound and additional folios defined below.
3. Sorted source root188 keys, then original-journal0, positive266, Order408
   service and Order408 SQL-binding keys, each group sorted by journal UUID in
   that fixed group order; native430 scope and
   actor-bound request keys. Acquire no new lower-order financial lock later.
4. Required immutable source and fiscal/configuration row locks, including the
   current valuation head. Reread the complete source/account/fragment set and
   fail on drift instead of incrementally acquiring an out-of-order account.
5. Property-local business-day lock and checks. Lock the configured series
   row/tail last among pre-existing resource locks, without advancing its number.
6. D-99 outbox publication lock, dependent timing/source/applicability/tax writes
   and request event, same-Tx Financials handler, final complete canonical reread,
   then gapless number allocation, document/origin/hash chain, final facts/events
   and completed idempotency. Keep every lock to commit.

Do not lock every sibling folio: legacy valuation can hold its own folio before
account SHARE locks, so broad sibling acquisition can introduce a cycle. A
transfer needing the selected folio is serialized by its shared guest account
and folio locks. Avoid new financial acquisitions after a business-day lock.

Forward database guards must protect every consumed consideration root/fragment,
not only the optional tax-overlay journal. If a valid ordinary correction,
transfer or new consideration wins first, native issue rereads and rejects stale
valuation/source with no invoice artifacts. If issue wins first, ordinary
monetary correction/transfer/supersession of those consumed roots is rejected;
the immutable original invoice and accounting remain. Native zero tax has the
same protection through its binding. Preserve ordinary corrections/transfers
for unissued sources, and settlement/payment/closing behavior. Do not unlock an
issued source, reopen a sealed day, mutate old postings, or implement ungoverned
credit/debit behavior here.

### Exact existing choke points and forward guard attachments

| Existing function/entry point | Existing coordination | Selected forward protection |
| --- | --- | --- |
| `lock_financial_rows(uuid,uuid[],uuid)` /0017 |1–2 sorted accounts, then selected folio | Keep unchanged;0025 already uses this receivable lock prefix. |
| `lock_positive_tax_posting_rows(uuid,uuid[],uuid)` /0044 |2–66 sorted guest/revenue/tax-payable accounts, then primary window1 | Keep unchanged; native gets its own private derived-set helper. |
| `create_charge_correction_header` /0019 | Generic service takes account/folio, root188, original-journal0, then day locks before this header | A journal BEFORE INSERT guard inspects `NEW.reverses` and rejects reversal of any issued consumed journal. |
| `create_positive_tax_correction_header` and `record_positive_tax_correction_root` /0045 | Service takes account/folio then266; SQL root writer inserts the tax-bearing guest line | Same journal guard plus posting-line guard; do not change existing positive-tax shape/authority. |
| `create_india_final_component_tax_correction_header` and `record_india_final_component_tax_journal_reversal` /0072 | Service408 key, then days; binding has a second, differently named408 key | Same journal/posting guards; preserve and extend0074's binding-level issued-source rejection. |
| `create_folio_transfer` /0020 | Guest account; sorted source/destination folios; sorted root188 keys; current day | Posting-line BEFORE INSERT guard rejects an issued consumed transfer root or a new consideration fragment into an issued folio. |
| `create_receivable_transfer(uuid,uuid,uuid,uuid,uuid,uuid,text)` /0025 | Existing sorted guest/receivable accounts→folio prefix, then joined folio/guest/target/party lock, approval and day | Preserve existing implementation, signature, authority, money and grants. No redundant forward replacement. Prove compatibility with native issuance; direct-bill settlement remains permitted. |
| `record_india_gst_accommodation_final_valuation` /0062 | Scope0→reservation SHARE→folio UPDATE→account SHARE; current head UPDATE; source fragments SHARE | Native writer uses the new ordered financial prefix. Parent/child INSERT guards reject new generations or appended evidence under an issued origin. Legacy writer's source behavior remains unchanged. |
| `record_india_gst_accommodation_quoted_rate_applicability` /0069 and `record_india_gst_accommodation_final_component_tax` /0070 | Scope0 then400/367; typed source/head locks | Discriminator-aware source/supersession INSERT guards use scope0 and reject post-issue ancestry changes; no global runtime DML grant. |
| `record_india_final_component_tax_journal_binding` /0071 |407 tax-root binding key | Existing full-gross path unchanged. Native handler uses the same key family for its newly created tax ID before publication, and the strict native variant. |
| `seal_business_day_audited` /0064 | Day FOR UPDATE→read-only complete readiness | Keep unchanged; issue acquires its day SHARE lock after financial/source locks, before series/publication. |

Exact advisory text keys, with tenant/root IDs rendered canonically:

```text
seed 0:   tenant || reservation || folio
seed 400: 'india-quoted-applicability:' || tenant || ':' || reservation || ':' || folio
seed 367: 'india-final-component-tax:' || tenant || ':' || reservation || ':' || folio
seed 188: tenant || ':folio-transfer-root:' || rootId
seed 0:   tenant || ':' || originalJournalId
seed 266: tenant || ':positive-tax-correction:' || originalJournalId
seed 408: tenant || ':india-final-component-tax-correction:' || originalJournalId
seed 408: 'india-final-component-tax-journal-reversal:' || tenant || ':' || originalJournalId
seed 407: 'india-final-component-tax-journal-binding:' || tenant || ':' || taxId
seed 430: 'india-native-fiscal-invoice:' || tenant || ':' || reservation || ':' || folio
seed 430: 'india-native-fiscal-idempotency:' || tenant || ':' || keyHash
```

Retain0074's native430 scope/request key text exactly; a new document-scoped key
must not substitute for the financial keys above. The407 key is for a tax UUID
allocated by this Tx; take it before the first publication, not from a late
handler call. Do not acquire reservation-family188 in native issue.

The new journal guard attaches to `public.journal BEFORE INSERT` when
`NEW.reverses IS NOT NULL`. Resolve original consumed roots/binding through the
tenant-leading origin→accounting binding→valuation_source path, including the
native tax journal. Serialize on the resolved guest account before checking
issuance; normal services already hold it. A reversal header that wins first is
itself a reversal in the native source's complete reread, even before a later
binding call; issue cannot race past it. The binding-level guard remains a
no-new-lock recheck, avoiding a late408→guest-account inversion.

The posting-line guard attaches to `public.posting_line BEFORE INSERT`. It
protects both appended lines of an already consumed journal and
`coalesce(NEW.folio_transfer_root_line_id, NEW.id)` ancestry, plus new
revenue/adjustment consideration into an issued folio. Resolve/lock only its
own guest-account coordination root; do not introduce a late revenue/account
set or sibling-folio lock in a trigger. Existing transfer/charge services already
hold that account. A genuine settlement/payment/direct-bill line is not a
consideration mutation and stays allowed; no all-postings-to-issued-folio ban.

Typed fiscal guards attach BEFORE INSERT to these exact existing tables:

```text
public.india_gst_accommodation_final_valuation
public.india_gst_accommodation_valuation_source
public.india_gst_accommodation_valuation_room_night
public.india_gst_accommodation_valuation_allocation
public.india_gst_accommodation_quoted_rate_applicability
public.india_gst_accommodation_final_component_tax
public.india_gst_accommodation_final_component_tax_room_night
public.india_gst_accommodation_final_component_tax_component
```

Derive each child's parent scope and
use the same scope0 before checking an issued origin; do not acquire new financial
rows in those guards. Existing native/external immutable UPDATE/DELETE denial
remains. This protects append-only child sets as well as successor heads, rather
than checking only `supersedes_*`.0074's existing
`india_native_fiscal_source_reversal_guard` on the India reversal-binding table
is retained and generalized through a forward function replacement, not removed.

The existing0025 implementation discovers its guest and selected company
account after current tenant/actor/property input checks, calls unchanged
`lock_financial_rows` for those two sorted IDs and the selected folio, then runs
its joined query/approval/day logic and exact reread. No replacement is needed
for this already-present prefix (D1350). The company
account is not part of a native consideration account set; sorted acquisition
plus the shared guest/folio serializes both operations without banning normal
receivable transfer. Test this concrete compatibility, not just folio-root
transfer. No original migration bytes or Financials service behavior are edited.

### Exact native account/source bound

The500 source maximum is currently enforced in the TypeScript final-valuation
normalizer, **not** by0062's SQL array check;366 room nights is enforced there.
The new native SQL boundary must enforce1–500 unique roots and1–366 dense nights
itself. It must not treat a TypeScript limit as database authority.

For this native branch, admit the existing governed two-line, tax-exclusive
consideration charge/correction journal shapes, with one guest-side root on the
selected folio's account and one revenue counterpart, no tax detail/payable
companions, exact balance/currency and complete fragment closure. Source
classification/negative adjustment eligibility still follows the existing
Section15 contract. Two-line transfer fragments use that same guest account;
they do not introduce another revenue account. An unsupported journal shape
fails native source eligibility explicitly; never truncate its lines or counts.

Thus the maximum distinct account set is **503**: at most500 revenue accounts,
one shared guest account and at most two admitted component-payable accounts.
All-zero tax remains valid; its set still includes the existing consideration
accounts. The private `lock_india_native_fiscal_source_rows` derives that exact
set from typed persisted roots/routes, validates the two-line premise and bounds,
locks all accounts once in UUID order and then only the selected folio. It
accepts no caller account array. Full historical fragment/journal evidence is
read without truncation; the503 bound is not a cap on the number of fragments.
After locks, reread membership and canonical source hashes and reject drift.

These guard/limit choices are source-inspected technical decisions. Their normal
concurrent winner schedules and access behavior remain mandatory future proof;
no deadlock, race or bypass has been reproduced during drafting.

## Forward migration and deployment sequence

Applied migrations0001–0074 are immutable, including the rejected0074 boundary.
Do not repair this order by changing their bytes or regenerating their hashes.

The native metadata inventory confirms0075 and0076 are vacant;0074 is the current
last migration. Reserve these exact next filenames when root admits the order:

1. `migrations/0075_india_native_fiscal_source_evidence.sql`: expand ordinary
   evidence and dependent timing, discriminated existing valuation/applicability/
   tax/accounting/origin constraints, indexes/RLS/immutable guards; install safe
   source recorders and private typed helpers. Revoke the old native issue
   capability's execute grant so a partially applied expansion cannot continue
   issuing through0074. No new issue grant until the whole path exists.
2. `migrations/0076_india_native_fiscal_source_completion.sql`: canonical SQL
   reconstruction, native prepare/accounting/final completion, correction/source
   guards, event linkage, deferrable completion checks and the least-privilege
   new native issue capability. Preserve0025's existing lock prefix. Keep old issued rows readable as immutable
   history; do not backfill invented ordinary evidence or adopt them into the
   authenticated new source branch. Old signature is revoked or fails closed.

The native flow may use internal prepare/complete calls in one Tx, but preparation
cannot commit independently. All helpers use fixed search paths, qualified
objects, exact actor/tenant checks and yellow_owner ownership; no PUBLIC execute,
runtime direct DML, arbitrary role assumption or caller-controlled security GUC.
Test both fresh installation and upgrade from the unchanged74-migration baseline,
including intermediate75 fail-closed behavior. Expected base-table count is127
if these exactly two new tables are confirmed; derive all other catalogue counts
from the resulting canonical schema, not this prediction.

## Exact proposed implementation scope

Root admits the following complete implementation inventory under D1330. Each
worker receives an exclusive bounded subset; no independent lane may silently
expand it. An implementer must stop for an explicit order amendment if another
path is needed. Intermediate parts remain incomplete until the full outcome passes.

### New product paths

```text
migrations/0075_india_native_fiscal_source_evidence.sql
migrations/0076_india_native_fiscal_source_completion.sql
src/contexts/tax-fiscal/india-gst-accommodation-ordinary-regime-evidence.ts
src/contexts/tax-fiscal/india-gst-accommodation-source-intake.ts
src/contexts/tax-fiscal/india-gst-accommodation-invoice-source.ts
src/contexts/tax-fiscal/india-native-fiscal-source.ts
src/contexts/financials/india-native-fiscal-accounting.ts
src/commands/issue-india-native-fiscal-invoice.ts
```

The coordinator is the selected dedicated-Tx composition root, not a new generic
command framework. No new table beyond the two named above is admitted without a
scope amendment. Kernel event/consumer source is a read-only reuse target.

Question192 explicitly adds the preparation integration and invoice-issuance
test paths below for D1359/D1360. Separate workers own named functions in the
shared preparation fragment: day/series and source writers insert before the
existing quoted-tax composer; root appends source-basis/authentication helpers.
Each uses targeted patches, never edits another worker's function body and
never rewrites the whole file.

Question192 additionally admits `0076-native-completion.sql` in the same draft
directory, and `tests/india-native-fiscal-source-locks.integration.test.ts` plus
`tests/india-native-fiscal-completion.integration.test.ts`. These separate the
remaining source-lock and final-commit workers from root-owned outer preparation
without changing the single outcome, schema, authority or acceptance boundary.
The completion fragment remains outside the migration runner; source publication
does not enable runtime issuance. Each worker patches only its assigned functions
and tests. All high-risk independent executable proof remains mandatory.

Question192's integrated-candidate proof may temporarily enable only the four
intended runtime entry points in the existing synthetic database after all real
functions compile, execute the actual command, then revoke those grants even on
failure. No test wrapper, derived-source substitution, disabled constraint or
retained-local/production promotion is allowed. This resolves the difference
between private draft storage and testing the real governed application path.

D1346 / Question190 also admits two exclusive, non-runnable0076 implementation
fragments: `handoff/drafts/order434/0076-native-preparation.sql` and
`handoff/drafts/order434/0076-native-accounting.sql`. The D1350 checkpoint explicitly
assigns preparation to `/root/native_source_sql` and accounting/guards to root;
this supersedes the earlier lane allocation, not the admitted implementation scope.
They preserve work while the single complete0076 migration is unfinished; they
do not enter the production runner or establish separate completion boundaries.

D1352 / Question191 additionally admits
`handoff/drafts/order434/0076-native-statutory.sql` for a separate exclusive
statutory-source reconstruction worker. Preparation retains actual-date/rate
work; this third fragment reconstructs existing supplier/recipient/property and
classification roots and their 295/296/297 composition. No new table, event,
grant, policy or production migration is added. Root owns integration and the
complete outcome; fragments remain non-runnable WIP, not separate deliverables.

### Existing product paths: native union/composition only

Question193/D1366 additionally admits `src/kernel/approval.ts` and
`tests/approval-request-options.test.ts` solely for optional internal approval
identity and explicit expiry on the existing request primitive. Preserve its
legacy path, responses, decisions and audit behavior; no inferred lifetime,
permission or HTTP field. The existing native source integration suite must
prove actual request → different-user decision → native valuation, with all
existing complete-payload and current-authority consumption checks unchanged.
Executed42501 under0016 additionally admits D1367's private owner-mediated
`create_approval_request_with_options` in the completion fragment. Only its exact
signature may receive a temporary synthetic test grant, with unconditional
revocation. Preserve all existing direct-DML column grants and the legacy path.

```text
src/contexts/tax-fiscal/index.ts
src/contexts/tax-fiscal/india-gst-accommodation-service-provision-date.ts
src/contexts/tax-fiscal/india-gst-accommodation-payment-receipt-date.ts
src/contexts/tax-fiscal/india-gst-accommodation-invoice-timeliness.ts
src/contexts/tax-fiscal/india-gst-accommodation-time-of-supply.ts
src/contexts/tax-fiscal/india-gst-section14-rate-selection.ts
src/contexts/tax-fiscal/india-gst-registration-at-time-of-supply.ts
src/contexts/tax-fiscal/india-gst-recipient-registration-at-time-of-supply.ts
src/contexts/tax-fiscal/india-gst-accommodation-supply-nature-at-time-of-supply.ts
src/contexts/tax-fiscal/india-gst-accommodation-quoted-rate-applicability.ts
src/contexts/tax-fiscal/india-gst-accommodation-quoted-rate-applicability-recorder.ts
src/contexts/tax-fiscal/india-gst-accommodation-final-valuation.ts
src/contexts/tax-fiscal/india-gst-accommodation-final-component-tax.ts
src/contexts/tax-fiscal/india-gst-accommodation-final-component-tax-recorder.ts
src/contexts/tax-fiscal/india-gst-accommodation-final-component-tax-semantic-route.ts
src/contexts/tax-fiscal/india-irp-accommodation-source.ts
src/contexts/tax-fiscal/india-irp-accommodation-numeric-item-source.ts
src/contexts/tax-fiscal/india-irp-accommodation-fiscal-action-readiness.ts
src/contexts/tax-fiscal/india-native-fiscal-invoice.ts
src/contexts/financials/index.ts
src/contexts/financials/india-final-component-tax-fiscal-source.ts
scripts/check-import-boundaries.ts
```

The original external invoice resolver, Section14 six-case selector, historical
rate registry/resolver and419/420/422/423/424/425/426 composers are read-only reuse
targets initially. If an exact type/validator change proves necessary in one,
name it and amend this scope before editing; do not duplicate those composers.
Generic posting, correction, transfer, payment and seal services are read-only
proof targets; attach authoritative guards in the new migrations.

### New permanent proof paths

```text
tests/india-native-fiscal-source-completion.test.ts
tests/india-native-fiscal-source-completion.integration.test.ts
tests/india-native-fiscal-preparation.integration.test.ts
tests/india-native-fiscal-source-locks.integration.test.ts
tests/india-native-fiscal-completion.integration.test.ts
tests/india-native-fiscal-invoice-issuance.test.ts
tests/india-gst-accommodation-ordinary-regime-evidence.integration.test.ts
tests/india-gst-accommodation-source-intake.test.ts
tests/india-native-fiscal-accounting.integration.test.ts
tests/fixtures/india-native-fiscal-source-completion-fixture.ts
```

### Existing proof/catalogue paths: preserve substantive assertions

```text
tests/fixtures/india-native-fiscal-persisted-source-factory.ts
tests/india-native-fiscal-invoice.test.ts
tests/india-native-fiscal-invoice-database.integration.test.ts
tests/india-native-fiscal-invoice-database.intentional-red.test.ts
tests/india-gst-accommodation-final-valuation.test.ts
tests/india-gst-accommodation-final-valuation-migration.integration.test.ts
tests/india-gst-accommodation-quoted-rate-applicability.test.ts
tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts
tests/india-gst-accommodation-final-component-tax-recording.integration.test.ts
tests/india-final-component-tax-fiscal-source.integration.test.ts
tests/india-irp-accommodation-source.integration.test.ts
tests/india-irp-accommodation-numeric-item-source.test.ts
tests/india-irp-accommodation-fiscal-action-readiness.test.ts
tests/india-irp-accommodation-validation-compatibility-pre-document-evidence-assembly.test.ts
tests/india-final-component-tax-correction.integration.test.ts
tests/financial-corrections.integration.test.ts
tests/positive-tax-correction.integration.test.ts
tests/financial-folio-transfers.integration.test.ts
tests/financial-receivable-transfers.integration.test.ts
tests/business-day-seal.integration.test.ts
tests/business-day-seal-authority.integration.test.ts
tests/import-boundaries.test.ts
tests/schema/expected.sql
tests/setup-current-catalogue-oracle.test.ts
tests/database-acceptance.integration.test.ts
tests/migrate.integration.test.ts
tests/app-role-nonlogin.integration.test.ts
tests/runtime-database-authority.integration.test.ts
tests/runtime-dml-authority.integration.test.ts
tests/security-definer-containment.integration.test.ts
tests/financial-postings.integration.test.ts
tests/positive-tax-posting.integration.test.ts
setup.sh
```

Order432's complete catalogue repair is committed at implementation base591ace8.
Root owns all later catalogue updates; serialize them after exact schema derivation.
Preserve its portable runner repairs and every grant/session/RLS
assertion. No broad unrelated test rewrite or lowered expected result is allowed.

Question189/D1343 admits the quoted-applicability unit test solely to replace its
obsolete whole-module `document` substring ban with explicit no-write/no-allocation
checks and external-result identity assertions. The new native branch must carry
a prospective document identity; all substantive legacy assertions remain intact.

### Future documentation/status paths, only at the appropriate evidence stage

```text
docs/CONTRACTS.md
docs/EVENTS.md
docs/DOMAIN-MODEL-V1.md
docs/SECURITY.md
BUILD-PLAN.md
handoff/PHASE-7-PLAN.md
handoff/ROADMAP.md
handoff/orders/430-india-native-fiscal-invoice-issuance.md
handoff/orders/434-native-fiscal-source-completion.md
handoff/questions/188-order430-ordinary-regime-provenance.md
handoff/reviews/434-native-fiscal-source-completion.md
handoff/LEDGER.md
DECISIONS.log
```

Do not edit PROJECT, old reviews/decisions, applied migrations, Order432/433,
`.yellow`, local runtime/configuration, operator UI/API, provider/IRP code, seeds,
dependency manifests or lockfiles. Only root coordinates commits and publication;
workers may not commit, push, download or provision without an explicit bounded
assignment. Do not push over an active CI run. Native Windows tools only while
WSL Bun crash dumps are recurring; do not start the retained local app or database.

## Acceptance phases — all must complete for the single outcome

**D1369 performance repair:** the first combined500-source/366-night native
valuation exceeded the300-second test limit at COMMIT. The existing0076 completion
fragment may forward-replace `assert_native_valuation_conservation` with a complete
set-based equivalent before new application valuations run. Keep installed0075,
the trigger's deferred timing/authority, all source/night/actor checks, signed
largest-remainder arithmetic and sparse-zero representation unchanged. This is
not permission to reduce limits, disable constraints, seed derived rows or count
a timeout as success. Any corresponding preparation scan optimization stays in
its existing admitted fragment. Record the failed run and execute the same maximum
case and regressions after repair; full independent acceptance remains outstanding.

**D1370 serialization repair:** the existing completion composer may collect each
exact insertion-ordered ordinary/compatibility item as text and assemble each JSON
array once after its unchanged1..366 count guard. The former loop reserialized all
preceding items on every iteration. No new helper, signature, cache or grant is
introduced; object/key/item order, scalar lexical forms, hashes and every full
source/authenticity recheck must remain identical. Stage timing in the maximum test
is diagnostic only; its300-second limit and substantive assertions remain unchanged.

### Phase A: persisted original facts and native valuation

Exercise service/payment/ordinary recording with real governed actor permissions,
tenant-leading integrity, exact replay and immutable source hashes. Finalize a
native valuation from actual Financials charge roots through its real writer;
prove complete source closure, allocations and approvals. No external invoice
row may be created. Replaying old external source contracts remains unchanged.

### Phase B: actual-date native source and exact provenance

In a live PostgreSQL transaction, prepare the dependent native timing projection
from the database clock, derive and persist native applicability/final tax, and
build the full native413→426→429 graph from locked roots. The mandatory everyday
positive is a normal current all-after-cutover/single-version case, not only a
contrived historical Section14 case. SQL and TypeScript canonical preimages
agree exactly; no supplied graph is an authority. Aborting or attempting to
commit preparation alone leaves no dependent native artifacts.

### Phase C: atomic accounting plus the first native document

The same transaction writes only incremental component-tax accounting and issues
the immutable document with actual date, configured FY series, number and chain.
Prove no duplicate revenue by exact before/after account totals and journal-line
sets, including zero tax and additional folio windows. Complete the typed origin,
event/fact linkage and idempotent receipt. A correct external source cannot enter
this native branch by changing a discriminator.

### Phase D: permanent authorized behavior and access regression

New tests are ordinary authorized positive behavior, invalid-input rejection and
access-control regression only. Do not build or execute an exploit/bypass harness,
coherent-forgery generator, vulnerability reproduction or autonomous attack flow.
Keep existing substantive protections and proofs; do not replace them with
generic-error acceptance or narrow canonical provenance to make a test pass.

Required coverage:

- Real source setup uses ordinary financial posting, governed service/payment/
  ordinary recorders and genuine native valuation. Base hotel/configuration/
  registration/attribution test roots may be seeded through their existing
  governed fixture facilities; derived applicability/tax/bindings/document rows
  may not be owner-inserted as a substitute for the production path.
- Existing approved5/12/18 histories, all component families, multiple nights,
  deterministic allocation, positive components rounding to zero, completely
  zero tax, bigint bounds, timely/late30-calendar-day boundaries, ordinary same-
  version dates, admitted genuine change cases and complete calendars. Use pure
  date/history fixtures for deterministic FY/cutover boundaries; no public test
  clock or legal-date override is introduced.
- Exact valid source identity and canonical key sets; missing/extra fields,
  incompatible ordinary input, mismatched genuine selectors, stale valuations,
  wrong source generations, omitted child correspondence and unsupported source
  kinds reject. Validate complete nested hashes from recorded canonical facts,
  not just the final legal body. These are defensive input/contract tests, not
  attempts to bypass the issue capability.
- Two-tenant isolation; wrong actor/property, expired or missing grant, issue-only
  versus finalizing permission, SELECT-only runtime tables, no PUBLIC/unauthorized
  function use, immutable rows, source changes and invalid prepared completion.
  Authenticated execution uses governed `yellow_runtime`→`app_role`, transaction-
  local tenant context and real RLS, never a deployment-role substitute.
- 100 concurrent exact requests produce one immutable receipt;100 genuine distinct
  sources on one series produce contiguous1..100, counter101, exact document/
  origin/fact/event/completed-key counts and recomputable genesis-to-tail chain.
  Different keys against one consumed window produce only one invoice.
- Rollback and any rejected issue leave the series counter unchanged and zero
  new document/origin/native-timing/native-applicability/native-tax/accounting/
  journal/fact/outbox/idempotency artifacts. Pre-existing intake/valuation rows
  remain exactly at baseline. Capture counts by tenant and request, not global
  totals polluted by unrelated fixture setup.
- Normal correction-first/issue-first, transfer-first/issue-first and seal-first/
  issue-first schedules are coordinated deterministically using real commands.
  Old valid unissued corrections/transfers still work; issued source protection
  and immutable accounting hold for both zero and nonzero tax. No deadlocks,
  hidden retries changing the result, number gaps or source-set drift.
- Prove same-Tx event request→Financials effect→document ordering, exact inline
  handler replay, already completed delivery after original-event pruning, and
  zero-artifact rollback. No consumer cursor/processed-marker grant changes or
  second connection may appear. Observe publication waiting behind already-held
  financial/day/series resources without an inverted wait, and cover ordinary
  direct-bill transfer versus issue using0025's existing sorted lock prefix.
- Exercise the native SQL500-root/366-night/503-account boundaries using ordinary
  source construction and invalid-size rejection. Prove a complete500-root case
  is not silently limited by the legacy66-account helper; reject unsupported
  journal shapes without dropping lines, and retain every transfer fragment.

### Phase E: fresh database, upgrade and independent proof

Only after admission and a fresh disk-space check, use a fresh isolated
PostgreSQL16.15 cluster outside the repository and retained local footprint.
Available toolchain: `E:\yellow\toolchains\postgresql-16.15\pgsql\bin`.
Do not provision, start databases or download tools while this order is a draft.

The future proof must apply all76 admitted migrations, compare unchanged1–74
checksums, run the74→75→76 upgrade/partial-deployment cases and capture exact
schema/catalogue results. Use explicit deploy/runtime URLs and a mandatory
`YELLOW_REQUIRE_ORDER434_DATABASE=1` guard in the new suite; missing configuration
must not turn required acceptance into a green skip. Keep the existing430/408/
definer mandatory database checks active. Do not record credentials in artifacts.

Run all new native/source/accounting tests, existing native100-way/replay/rollback/
immutability/RLS/chain proofs, Order408, generic/positive corrections, transfers,
audited seal, external timing/source regressions, SECURITY DEFINER containment,
runtime authority, migration acceptance and exact normalized schema. The referee
must personally report **11 passed, 0 failed** from a separately clean fixture
state; a contaminated referee run is not equivalent proof.

Standing self-check: state, frozen dependency verification, typecheck, import
boundaries, complete tests with explicit expected skips separated from required
database suites, licence check, audit, schema check, referee and diff check. Do
not change dependency versions to make this order pass. Record exact commands,
revision, migration hashes, PG version, role/session settings and results.

A different non-implementing Tier3 reviewer must inspect the complete diff and
personally execute the relevant fresh proof. Implementer output is not review
evidence. Findings reopen repair and require another fresh non-implementer when
the reviewed candidate changes. Do not mark Order430/434 approved, close
Question188, claim the first usable native invoice, or advance Phase7 before all
acceptance conditions and independent review are actually satisfied.

## Admission result and remaining executable work

The bounded source checks resolve the three drafting questions: the event-first
same-Tx handler/coordinator and durable binding dedupe are selected; exact
correction/transfer guard attachments, unchanged0025 lock-order compatibility
and the503-account bound are specified;0075/0076 and all five new event names
are vacant. The native zero-tax variant retains typed timing/accounting binding
identity while its optional tax-journal reference is null; legacy origin/journal
constraints stay exact. No unresolved founder legal/business policy or additional
technical design question was identified in this bounded pass.

Root admits this complete order under D1330 and reserves0075/0076 exclusively.
Event contracts are written before cross-context effects. Implementation must encode
these contracts, prove SQL canonical
serialization and every future acceptance case, and pass different-agent Tier3.
Those are unexecuted implementation/proof obligations, not facts already verified
by this draft. Any concrete contradiction found while implementing requires an
explicit amendment; no missing file, source shape, guard, event or exceptional
regime may be added silently. Do not deliver another miniature envelope while
leaving the first native invoice impossible.

## Explicit shared timing-core implementation amendment — 2026-09-05

The existing Section14 service rereads an external invoice and cannot derive native
timing as-is. Admit the exact existing `india-gst-section14-rate-selection.ts`
path above for an origin-independent evidence calculation core, reused by both
the existing external service and the new native adapter. The already scoped
`india-gst-accommodation-time-of-supply.ts` may expose its exact ordinary date
calculation for reuse. Preserve external root agreement, result shapes, canonical
preimages and hashes byte-for-byte; do not accept a prebuilt Section14 result as
native authority or duplicate the six-case classifier. Pure calculation exports
do not authenticate persisted evidence; SQL reconstruction remains mandatory.
No other previously read-only source is admitted by this amendment.

Governed intake SQL signatures use server-derived actor-bound request hashes,
not a caller hash argument. Their final argument is a bounded idempotency key;
every call (including replay) validates current actor/property authority before
returning a permanent root. Reuse0056/0057 with nullable legacy-compatible recording
metadata and exact discriminator constraints; no third evidence table. Original
request/recording actor and server evidence hashes are immutable. These details
implement the already-admitted source-recording/replay requirements, not a new
legal regime or a product-completion claim.

## Explicit work-in-progress publication amendment — 2026-09-05

The founder requires implemented work to be visible on GitHub, while incomplete
schema changes must not become automatically runnable migrations. Admit exactly
`handoff/drafts/order434/0075_india_native_fiscal_source_evidence.sql` as the
temporary, non-runnable location of the reserved0075 draft. Move the current draft
there without duplicating its bytes. This is source preservation, not an extra
migration, a deployment, or acceptance of0075. Its opening warning still applies
to publication into the runnable migration sequence. The migration runner must
continue discovering only the unchanged0001–0074 until the complete0075/0076
candidate and catalogue changes are ready. No new automatic draft runner is added.

The new TypeScript contracts, shared timing calculations and focused tests may be
published as an explicitly incomplete development checkpoint. Do not expose the
new source services through the public context index, add an operator/API action,
claim first-native-invoice success or reuse this checkpoint as independent review.
The exact new integration suite remains mandatory when explicitly requested; its
absence of database configuration must be recorded separately from a pass.

### Executed source-intake checkpoint (not Order434 completion)

Root applied the original0001–0074 plus the draft0075 only to a disposable native
PostgreSQL16.15 database, outside the retained local app. An initial setup attempt
correctly stopped at0018 because the disposable registrar role was absent; after
provisioning that existing constrained role, migration application completed.
The fixture census was75 migration records and126 public tables. Draft SQL SHA256:
`4f856fcc2b6afc7368f4ab9ce4187e8220f1e6b08bd0b05001421878d36db367`.
No retained database or hotel data was used or changed.

The first real database run found that Bun's `errno` was not mapped to the intended
typed domain error. Both source services now normalize `errno`, then `sqlState`,
then `code`; realistic Bun42501 and23505 unit regressions preserve exact errors.
Root personally reran these eight suites with the required real-database flag:

```text
bun test tests/india-gst-accommodation-ordinary-regime-evidence.integration.test.ts
  tests/india-native-fiscal-source-completion.test.ts
  tests/india-gst-accommodation-source-intake.test.ts
  tests/india-gst-accommodation-time-of-supply.test.ts
  tests/india-gst-section14-rate-selection.test.ts
  tests/india-gst-accommodation-historical-resolution.test.ts
  tests/india-gst-accommodation-quoted-rate-applicability.test.ts
  tests/india-gst-accommodation-final-component-tax.test.ts
```

Result: **54 passed,0 failed,1173 assertions**, including4 real PostgreSQL cases.
These prove source recording, exact replay/current authorization, tenant separation,
unchanged financial artifact counts, native timing selection and external regressions.
They do not prove genuine native valuation, dependent transaction timing persistence,
incremental accounting, complete canonical issuance, the final schema, concurrency,
or the required fresh non-implementing review. Those remain active Order434 work.

The subsequent defensive error-handling refinement rethrows null/undefined and
non-SQL errors unchanged, with exact-identity regressions; source-intake unit proof
is10 passed,0 failed,76 assertions. Typecheck, import boundaries(164 files),
dependency licences(23 packages) and diff checks pass. The earlier54-case database
receipt is tied to the preceding candidate and is not represented as a rerun of
this final guard-only refinement.

Root's final standing `bun test` at this checkpoint passed1490 tests with1074
explicit environment-dependent skips,0 failures and20895 assertions across472
files. The four new database cases are among those skips in the standing run;
their separately configured earlier PostgreSQL proof is recorded above. No skipped
database case is counted as a passing database proof. The final executable migration
directory contains74 files and is byte-identical to published `cb4d5d9`.

Root stopped the sole disposable cluster and verified port55502 was closed. The
verified76,372,039-byte test directory at
`D:\Yellow\temp\order434-source-intake-20260905` remains stopped because the tool's
execution policy rejected its exact-target cleanup command. No alternative deletion
method was attempted. No retained hotel database was touched; this small leftover
does not block implementation or require founder action now.

## Native valuation implementation contract — 2026-09-05

The native writer uses the existing four valuation tables with
`basis_kind = native_consideration`; external rows default to
`external_quoted_applicability`. The external writer and its hashes remain
unchanged. Native rows have no Order341 digest. They bind the service/lineage,
named consideration and approval-basis hashes, actor-bound request/key hashes,
and the original approval decider/time/expiry/evidence where an override is used.
Native-only source/night counts and the actual recording transaction identity
support same-transaction child creation and one deferred aggregate-conservation
check. They are integrity metadata, not a second valuation or money ledger.

`record_india_gst_native_accommodation_valuation` has exactly25 parameters:
six scope IDs (tenant/property/reservation/folio/buyer/service), request/actor/key,
expected-current ID/hash and approval ID, seven ordinary Section15 strings, and
six parallel source arrays (root ID/kind/addition/discount/source/reference).
SQL derives money, complete source membership, quote weights, signed integer
allocations, IDs and hashes. The return is valuation ID, generation, disposition,
transaction value, evidence hash, native consideration-basis hash and `created`.
The TypeScript `finalizeNative` calls this capability on every attempt, including
replay; it does not use the legacy idempotency shortcut. Arrays are explicit
escaped PostgreSQL literals bound as parameters, preserving punctuation in
references; they are not interpolated SQL.

The native request hash excludes the audit request UUID and idempotency key,
includes actor/scope/current-head/approval plus exact Section15 data, and sorts
complete source tuples by root UUID. The native approval payload is exactly
property/reservation/folio/window/buyer, relationship-set and request hashes,
`basisKind`, service snapshot ID and `nativeApprovalBasisHash`. The latter binds
the service evidence and lineage snapshot as well as the actor-bound request.
The approved0062 different-active-user, decision-time and expiry rules are
retained; no new approval permission or tax/legal policy is invented.

Unlike the legacy source selection, the native branch retains both original and
contra roots of ordinary charge corrections. The original and negative entry
must net together; dropping only the original would misstate consideration.
Each root's complete transfer history and every pair in a multi-root transfer
journal are checked without truncation. Charge/correction journals retain the
exact two-line balanced guest/revenue shape. The valuation-only account bound is
501 (500 revenue plus one guest); the issuing command later adds at most two
component payable accounts for the documented503 bound.

The writer refuses a transaction that already holds the global publication lock
before acquiring financial resources. Source recording, valuation and final
issuance remain separate dedicated transactions as specified above. Existing
external commands and the retained local runtime are not changed by this rule.

The first fresh migration application found that new FK validation against
FORCE-RLS evidence tables cannot run under `yellow_owner` without a tenant.
The repair follows0018's checked direct-deployment-role DDL pattern for only the
existing-table ALTER/FK block, then restores `yellow_owner` before capabilities.
It validates every tenant normally; it does not select a dummy tenant, disable
RLS/FORCE, leave a constraint unvalidated or change the production runner.

The parallel Order295/296/297 native composition lane uses their three
already-scoped product files, the already-scoped
`india-gst-accommodation-invoice-source.ts`, and
`tests/india-native-fiscal-source-completion.test.ts`. The shared source module
owns exact/frozen native-result and timing validation; supplier and recipient
translate its errors instead of duplicating canonical serialization. Their
distinct hash preimages remain unchanged. The reduced rate result omits rate
pair/history roots, so checking its shape and outer hash cannot authenticate
those inner roots: complete SQL reconstruction remains mandatory. No public
index or operator action is admitted by this clarification.

## Native valuation and composition checkpoint — D1342

Root executed the final candidate on the single isolated PostgreSQL16.15
cluster, database `yellow_order434_valuation`, after the unchanged74 migrations
and draft0075 SHA256
`81f163ca7c8129499587febe72cee6d013c88990d323a0ce1e92f53a5d9dfdd3`.
The draft remains outside the production migration runner.

With `YELLOW_REQUIRE_ORDER434_DATABASE=1` and the explicit isolated deploy/runtime
URLs, this command passed15 tests,0 failures,86 assertions:

```text
bun test tests/india-native-fiscal-source-completion.integration.test.ts tests/india-gst-accommodation-ordinary-regime-evidence.integration.test.ts
```

The additional real workflow opens two more folio windows using `FolioService`,
posts4000 and6000 minor units using `ChargeService`, and moves both whole groups
twice using `FolioTransferService`. The two balanced four-line transfer journals,
all eight immutable transfer fragments, zero balances on the first two windows
and10000 on the final window are retained. Native valuation consumes both roots
and their complete history; it adds no money or document. Exact valuation and
historical transfer replay remain stable. The earlier correction, rollback,
16-way replay, successor,366-night and500-root/501-account cases were rerun in
the same15-case receipt. This proves valuation of routed consideration, not an
issued split invoice or the missing native accounting composition.

A second worker's bounded read-only check found raw-null error translation and
a downstream signed-int64 validation mismatch in the pure native composers.
The implementation worker corrected both using ordinary malformed-input tests.
The reduced result is never represented as authenticated database evidence.
This checkpoint check is not the final non-implementing Tier3 acceptance.

Root's final `bun test` passed1497 tests,0 failures,20970 assertions across473
files;1087 environment-dependent cases were explicitly skipped. The15 database
cases above are separately executed proof, not inferred from that standing run.
Typecheck, import boundaries(164 files), licence policy(23 packages), `bun audit`
(no known vulnerabilities reported), and `git diff --check` passed. The native
database suite also failed as required when its mandatory flag was enabled
without database URLs. Runnable migrations0001–0074 remain byte-identical to
published6dfbf45. Current-candidate schema/referee and complete76-migration
acceptance remain future work; the previous published checkpoint's11/11 CI
receipt does not certify this unfinished draft.

Root stopped the isolated cluster and verified port55502 closed. The retained
test directory `D:\Yellow\temp\order434-source-intake-20260905` is103,468,921 bytes.
No alternate cleanup was attempted after the earlier policy-blocked deletion;
no retained hotel database, local app, public action or dependency changed.

Still required: positive legal-buyer override proof; the dependent timing table;
native ordinary/genuine-change applicability and tax branches; incremental
component-only accounting and zero-tax binding; full database-root canonical
issuance; all final races/referee/schema gates and fresh independent Tier3
acceptance. Order434 and Phase7 remain active. Publishing this checkpoint is
source preservation, not deployment, main integration or phase completion.

## Dependent timing and native tax composition checkpoint — D1345

The draft now contains the second new table, `india_gst_native_invoice_timing`,
and explicit native/external variants in the existing applicability, tax,
accounting-binding and document-origin records. Typed tenant-leading links bind
the valuation, source snapshots, actor, property-local transaction date,
prospective document and eventual accounting artifacts. The document,
applicability, tax and binding back-links are initially deferred. Native
artifacts are immutable and transaction-bound. A zero-tax binding requires no
journal; positive incremental tax requires one. This is structural persistence,
not a completed canonical issuance capability or a new public write grant.

`resolveNative` rederives the complete native source and component identity,
reads the real service/payment date projections on the same transaction, and
authenticates persisted timing and recording roots. Ordinary results have no
fabricated Section14 case/side/hash; genuine changes retain the existing
six-case selection. `calculateNative` binds the current native valuation and
its exact ordered nights, then shares the unchanged component-first integer
rounding calculation with the external branch. It checks exact payment
coverage and returns evidence only; it does not post money or issue a document.

The implementation exposed a real distinction hidden by the first unit mocks:
service/payment SQL recording hashes are not their canonical date-projection
hashes. Native predecessor names now distinguish `serviceProvisionRecording`,
`paymentReceiptRecording`, `ordinaryRegimeRecording`,
`serviceProvisionProjection` and `paymentReceiptProjection`. Database joins
retain the recording roots; fresh date-service reads authenticate projections.
A real-PostgreSQL regression confirms these distinct hashes using source
recording capabilities, with no invented hash fixtures.

The buyer-override regression now covers exact active different-decider approval
consumption and atomic rejection of expired, pending or inactive-decider
evidence. It retains the original approval row and hashes. Approval
prerequisites are owner-seeded like the existing0062 fixture: the generic kernel
approval request API cannot yet supply the required `valid_until`. Thus this
proves consumption/revalidation, not an end-to-end approval-creation screen.
Kernel API work is outside this order's admitted write scope.

The timezone regression proves the same request creates under an
Asia/Calcutta caller and replays under UTC with identical evidence, while the
caller timezone is restored. The existing writers already pinned UTC/ISO;
an initial ambient-hash comparison was not a writer defect. Separately, fresh
draft application rejected the new trigger-definition `SET app.tenant_id`
clauses with42501. Their repair uses the existing0074 row-bound runtime context
pattern with explicit restoration on success/error, without granting parameter
authority or weakening RLS.

Root personally executed the following against draft SHA256
`d550b41cd405aea2da2b84e75fd3632ae2a6aca3b24b5cd12697394405d29869`:

- Actual migration runner: unchanged0001–0074 plus draft0075,75 ledger rows and
  127 tables. Both new tables are `yellow_owner`-owned and ENABLE/FORCE RLS;
  all15 timing FKs are validated. The three new trigger helpers have fixed
  search paths and UTC/ISO settings, with no app/runtime execute grant.
- Source/native-valuation PostgreSQL suites:18 passed,0 failed,121 assertions,
  including approval, timezone and real hash-layer regressions alongside
  correction, multi-window transfer, replay, rollback and bound coverage.
- Six selected legacy persistence/role checks passed across isolated databases,
  including quoted-bundle recording/replay/rollback and final-tax
  recording/replay/correction. An initial combined run collided on the legacy
  suites' shared fixed tenant ID; using a separate fresh proof database fixed
  test isolation without changing product code or historical-frontier oracles.
- Native/quoted/final-tax unit suites:23 passed,0 failed,733 assertions. Native
  applicability/tax cases still use controlled transaction mocks: no full
  PostgreSQL native-issuance proof is claimed.
- Final standing suite:1503 passed,1090 explicitly environment-skipped,0 failed,
  21025 assertions across473 files. Typecheck, boundaries164, licence policy23,
  dependency audit and diff checks passed. All74 runnable migrations remain
  byte-identical to5fbd936; the draft is still outside the production runner.

The single isolated PostgreSQL cluster was stopped and port55502 verified
closed. Its retained test directory is188,775,001 bytes; no cleanup workaround,
new Docker instance, local app change or retained hotel-data mutation occurred.

Still required: complete server-root canonical preparation, same-transaction
event-driven incremental accounting and zero-tax binding, final issuance and
immutable consumed-source guards, then all76-migration/schema/concurrency/
referee proofs and a fresh non-implementing Tier3 acceptance. D1344's green
published5fbd936 CI certifies that checkpoint only. Publication of this next
scoped checkpoint is not main integration, local promotion or phase completion.

## Accounting and private preparation checkpoint — D1348

The Financials-owned `IndiaNativeFiscalAccountingEventHandler` now accepts only
the tenant ID and persisted request-event UUID on the caller's existing Tx. It
validates the exact twelve-column SQL result, nullable zero-tax journal and
replay disposition. It opens no connection, accepts no money/account/date/hash
inputs and uses no consumer cursor. It is not yet exported through a public
composition root.

The two Question190 draft fragments now contain the shared integer rounding
helper, complete no-lock consideration reread, component route discovery,
persisted component checking, event/binding/journal verification and the native
event-consuming operation. The preparation fragment derives room-night tax
from the current recorded valuation and exact admitted registry members, with
the existing component-first integer arithmetic and canonical TypeScript key
order. Its financial lock prefix discovers the complete source/payable account
set and takes the required account/folio/root/advisory locks before publication.
It does not silently include the later fiscal/configuration/day/series locks.

These are still private implementation pieces. Rate member and component-family
arguments to the private preview are not fiscal policy authority: the eventual
SQL preparation must derive them from the full native date/registration/source
graph. The event consumer requires the real, still-unimplemented
`assert_india_native_preparation_authenticity(uuid,uuid)`; no acceptance stub was
introduced. Its EXECUTE grant is withheld from app_role, yellow_runtime and
PUBLIC until the complete76-migration candidate is ready. Positive native
journal posting, completed native replay and invoice issuance have therefore
not been executable-proven by this checkpoint.

Root applied all ten new functions atomically only to the existing synthetic
75-migration proof database. The ledger remained75; this is not a run of the
reserved76 migration. The first live preview test exposed a real preimage bug:
the snapshot already embeds `snapshotHash`, and its recorder hashes the object
with that field excluded. The preview now does the same, with a fixture-backed
regression. Root then personally executed:

- Financials handler/private-preview suite:11 passed,0 failed,91 assertions.
  Live cases use ChargeService and `finalizeNative`, not owner-inserted derived
  timing/tax/valuation rows. They cover both admitted rate versions and all
  three component families, exact ordered room JSON, component sums, zero
  rounding, a final-value slab crossing and366 nights. Read-only calls leave
  financial/document/valuation/audit/event counts unchanged. Metadata confirms
  the draft consumer is withheld and the preview owner-only.
- Native source/valuation suite:15 passed,0 failed,100 assertions, including the
  new private-prefix proof. A genuine one-minor valuation returns its exact
  persisted account/root/journal/hash closure and zero-tax null routes without
  D99 publication or data writes. A subsequent real charge makes both closure
  and prefix reject the stale valuation atomically.
- Standing suite snapshot:1509 passed,1097 explicit environment skips,0 failed,
  21070 assertions across474 files. The newly added prefix case was then covered
  by the full15-case PostgreSQL rerun above. Final typecheck, boundaries165,
  licence policy23, dependency audit and diff checks passed.

All74 runnable migrations and draft75 remain unchanged. Accounting fragment
SHA256 is `c579263a2446ca84b6b13a3c6f72a6040bc9a6444e36288fa5f064fd339ef44c`;
preparation fragment is
`d175bf8188d07e84f2c474b248afd60f6c0ed4381a908c737e519b1e13aae5c7`.
The same isolated PostgreSQL cluster was stopped and port55502 verified closed;
its retained directory is181,075,772 bytes. No Docker, local-app, real-hotel-data
or dependency change occurred.

Still required: full canonical native source preparation/authentication,
Financials native read-source/413–414–426–429 composition, final commit,
consumed-source correction guards, and complete76-schema/concurrency/referee
plus fresh independent Tier3 proof. Order434/Phase7 remain active. Publication
preserves work on the development branch; it is not main/local promotion.

## Native command wire contract — D1352

The existing `.issue` path is preserved. The new `.issueNative` accepts the exact
15 UUID identities in this order: tenant, property, actor, reservation, folio,
valuation, service-provision snapshot, payment-receipt snapshot, ordinary-regime
evidence, supplier service location, supplier registration status, supplier SEZ
status, recipient registration, recipient SEZ status and classification. The
remaining input is the governed calendar or null, idempotency key and existing
actor/tenant/property/request/`document.issued` audit envelope. It accepts no
invoice/document selector, date, clock, money, prepared body or evidence digest.

`prepare_india_native_fiscal_invoice_v2` receives exactly22 positional arguments:
the15 UUIDs above; calendar authority text, source SHA256 text, through date,
date array and state array; key text; request UUID. Empty arrays with null
calendar metadata represent absence. Bind arrays as escaped PostgreSQL array
text parameters, not interpolated JavaScript arrays. Its five returned columns
are `native_timing_id`, `request_event_id`, `posting_binding_id`,
`prepared_source_json` and `completed_receipt`.

- Fresh preparation returns three UUIDs, exact insertion-order source JSON and
  a null completed receipt. The JSON has exactly the canonical
  `Omit<IndiaNativeFiscalSourceInput, "financialSource">` keys, in this order:
  tenantId, legalBuyerPartyId, sellerRegistration, recipientRegistration,
  placeOfSupply, classification, supplyNatureAtTimeOfSupplyInput and
  supplyNatureAtTimeOfSupplyResult. These are reconstructed database evidence,
  not caller-provided fiscal authority.
- Completed replay returns the same three permanent identities, null source
  JSON and the existing exact20-column commit receipt with `created=false`.
  Preparation must authenticate current actor authority and the unchanged
  semantic request before returning it. The service does not call accounting,
  source resolution or commit again on completed replay.

Fresh preparation is followed, on the identical Tx, by the injected Financials
handler with `{tenantId,eventId}`, then the Financials public `resolveNative`
query with the exact property/reservation/folio/binding. Bind handler and reader
identities, compose native413 and real426/429, and retain the exact false
readiness, empty actions and three approved blockers before committing.

`commit_india_native_fiscal_invoice_v2` receives exactly7 arguments: tenant UUID,
property UUID, actor UUID, native timing UUID, key text, full canonical
413/426/429 evidence payload JSONB and request UUID. It returns the existing
20-column receipt. SQL must authenticate/reconstruct the complete graph before
number allocation. The service checks the receipt's prospective document ID,
parties, scope, issue date and all three composed hashes against preparation.

The dedicated command constructs the Financials-owned handler through public
indices and opens one `Database.withTenantTransaction`; no additional connection,
consumer cursor, public HTTP route or background worker is introduced. Focused
test doubles can prove orchestration but cannot prove PostgreSQL issuance. Do
not add placeholder prepare/commit/authenticator SQL merely to make them pass.

## Native command, actual-clock timing and distinct statutory roots — D1353

Implemented additions to D1350; this is not complete native issuance:

- `IssueIndiaNativeFiscalInvoiceCommand` opens one tenant transaction and wires
  the Financials-owned handler through public context indices. Fresh issue uses
  the exact D1352 prepare → handler → financial source → 413/426/429 → commit
  sequence. Completed replay skips new accounting. The prepared prospective
  document identity is checked against the final receipt. PostgreSQL array
  parameters use escaped bound array text; Bun's JavaScript-array interpolation
  is not used for the governed calendar.
- The private `read_india_native_invoice_timing_source` reconstructs genuine
  intake and approved whole-property-day rate history using the actual issuing
  transaction timestamp, xid and property timezone. Same-version dates use the
  ordinary branch. Genuine rate changes use the existing six-case calculation
  and governed calendar, including the strict four-working-day receipt boundary.
  It returns both typed JSON and the original insertion-order input/result JSON
  strings needed by existing TypeScript hash replay. It does not write timing,
  acquire issue locks, authorize the actor or issue a document.
- `india-native-invoice-timing-projection-v1` hashes sorted canonical tenant,
  selected timing/document/property/reservation/source identities, original
  recording roots and actual transaction context. Its hash is distinct from the
  complete derived timing hash. The Section14 issue-date predecessor uses the
  projection hash; native rate-source timing lineage uses the full timing hash.
  Actor, valuation and request authentication still belong to full preparation.
- Native297 previously compared Order287's supplier SEZ-status identity (286)
  with the independent GST registration-status identity (289). The fixture also
  conflated them. Native input now requires the complete separate 286 result,
  validates its original preimage and dated GST/SEZ/approval semantics, and binds
  it to Order287. The 289 result remains independently bound through native295.
  Native297 inserts `supplierSezStatusId` and `supplierSezStatusEvidenceHash`
  immediately after `supplierRegistrationStatusEvidenceHash` in its output/hash
  body. Native numeric composition accepts that exact shape. Legacy/external
  input, output and preimages are unchanged.

Root personally inspected these diffs and executed:

| Proof | Result | Limit |
|---|---|---|
| Native accounting/private timing database suite | 20 passed, 0 failed, 329 assertions | Real intake, actual-clock ordinary/historical timing, calendar boundaries, SQL↔TypeScript original-preimage parity and existing financial preview; not issued-invoice proof. |
| Existing source/valuation database suite | Passed, exit 0 | Real corrections, transfers, replay, bounds and installed guards remain compatible after additive historical fixture options. |
| Native/legacy composition, command and boundary suites | 63 passed, 0 failed, 558 assertions across 5 files | Fresh orchestration uses controlled Tx responses and real composers; it is not PostgreSQL prepare/commit proof. |

The standing-check worker personally ran the frozen TypeScript
tree: 1,523 passed, 1,108 explicit environment/database skips, 0 failed, 21,174
assertions across 2,631 tests/474 files in 86.91 seconds. Typecheck, 167-file import
boundaries, 23-package licence check, dependency audit and diff checks passed.
An earlier full run had one Windows Chrome `DevToolsActivePort` EBUSY; its focused
rerun passed, and the final whole-suite rerun above did not reproduce it. Skipped
database tests are not counted as executed acceptance.

Preparation fragment SHA256:
`2235750150f16d50ed17fe865b7ad7a51f1ac068d5255d6dd435e9fed61d3167`.
The 74 runnable migrations, draft75 and private accounting fragment are unchanged.
The one existing synthetic PG16.15 cluster (port55502, 75 migration records,
127 tables) remains in use for the next bounded statutory lane; no second cluster,
Docker instance, retained local app, real hotel data or dependency was created.

The D1352 statutory lane is still under implementation, not part of the proven
timing leaf. Its selected private STABLE/no-lock contract takes 11 UUID selectors
(tenant, property, reservation, folio, valuation, supplier service location,
supplier registration status, supplier SEZ status, recipient registration,
recipient SEZ status, classification) and two internal text transports: the
reconstructed native invoice source and five-field family jurisdiction
`{extensionId,ownerTenantId,key,version:string,contentHash}`. The jurisdiction
must be rechecked against service-day history, not the selected Section14 side.
Those texts are internal reconstruction inputs, never new command/request
authority. The leaf returns D1352's exact prepared-source JSON; final preparation
and authentication must derive its inputs from real roots on the same Tx.

Still required: complete statutory-source reconstruction, preparation and graph
authentication, actual native accounting/commit and durable replay, complete
76-migration schema/referee/issuance/concurrency/compatibility proof, followed by
fresh independent Tier3 acceptance. D1351 verifies only published0fad631 CI; it
does not certify this later checkpoint. No main merge, local refresh, Order434
completion or Phase7 completion is claimed.

## Private statutory and quoted-tax reconstruction — D1357

Implemented after D1353, within the same incomplete Order434 outcome:

- The private statutory root graph reconstructs genuine seller, buyer,
  registration, location, classification and dated GST/SEZ evidence. It returns
  the unchanged eight-key prepared-source text plus the separate service-day
  supply-nature graph and its two status identities. Exact insertion-sensitive
  SQL/TypeScript parity includes native295/296/297. UTF16 length, Unicode trim,
  NFC and GSTIN checksum validation retain the existing contracts.
- The private quoted-tax leaf reproduces service-day family/levy preimages and
  ordinary or genuine-change quote/final-tax evidence from actual persisted
  consideration, valuation and timing roots. The existing shared preview owns
  integer/component rounding. No DML, locks, grants or public endpoint were added.
- A genuine-change fixture initially supplied registration evidence at the
  payment date. The real timing reader exposed the error. The corrected fixture
  creates a genuine registration-status row at native statutory timing date
  2025-09-20, while the Section14 rate selection remains 2025-09-25. Both positive
  graphs retain CGST/SGST. This is an existing-contract distinction, not a new
  tax policy or permission to re-date evidence.

Executed proof on the existing isolated PG16.15 database:

| Executor and proof | Result | Limit |
|---|---|---|
| Non-implementer `/root/native_timing_selector`: full source/statutory suite |19 passed,0 failed,177 assertions | Private root reconstruction and existing valuation behavior; not complete issuance. |
| Root, independent of quoted-tax implementation: full accounting/private-composition suite |23 passed,0 failed,362 assertions,9.13 seconds | Pure family/levy byte parity and ordinary/genuine quote/tax preimages; persisted-timing TS service acceptance remains unexecuted. |
| Non-implementing standing worker: whole no-DB suite |1523 passed,1114 explicit environment skips,0 failed,21174 assertions;2637 tests/474 files | Skips are not database acceptance. Typecheck,167 boundaries,23-package licence check,audit and diff checks also passed. |

The complete composer has positive CGST/SGST cases; IGST and CGST/UTGST are
covered by the shared numeric preview, not yet full composer acceptance. The
service-day/TOS SEZ distinction is independently proven by the statutory leaf.
No fabricated issued timing, disabled completion constraints or stub source
authenticator were used. The final schema/referee remains a future76-migration
proof; this isolated database still had75 migration records and127 public tables.

Exact SHA256 values:

- Preparation: `ac1bf551205f9167724e52c42981013272f7c3cb642ce45a0e4e68999fbb294d`.
- Statutory: `d8858481113cca64d1731ccf4ad9e371d55f0c8c2cb1a9a7b2be1374186fb16c`.
- Unchanged draft75: `d550b41cd405aea2da2b84e75fd3632ae2a6aca3b24b5cd12697394405d29869`.
- Unchanged accounting fragment: `e6c30d972c12c4dd2999c2d5f269f0ac07944ea8e8431831244919654c7ef754`.

All74 runnable migrations remain unchanged. Root stopped the one owned synthetic
PostgreSQL cluster and verified port55502 closed after all database workers
released it. No retained app, hotel data, Docker runtime or local port3000 was
changed. Development publication preserves this work; it is not a main merge,
completed native invoice, final Tier3 acceptance or Phase7 completion.

Next required integration is full preparation locking and reconstruction,
an explicitly defined acyclic native-source-basis preimage and real shared
authenticator, followed by same-transaction event/accounting, final commit,
durable authorized replay and complete issuance/schema/concurrency proof.

### Dual-date statutory source closure — D1355

The service-provision date and actual time of supply can differ. Keep the
explicit command-selected supplier286/recipient285/registration289 records at
TOS for native295/296/297 and the existing applicability status columns. The
service-day levy graph needs its own actual supplier286/recipient285 records:
resolve by tenant, authenticated registration ID/evidence hash and exact service
date using the existing0052/0053 uniqueness constraints. Missing or ambiguous
evidence fails; never copy a TOS record and replace its date. No second service-
date289 registration-status record is required by that existing graph.

The internal statutory root reader shares seller, buyer, classification and
place reconstruction, returning four columns: prepared_source_json,
service_supply_nature_json, service_supplier_sez_status_id and
service_recipient_sez_status_id. The existing13-argument prepared-source helper
projects only its unchanged eight-key text. Service-day Order287 feeds the
separate family/levy/applicability ancestry, while413 keeps its TOS family result;
their family names must still agree. These are separate dated evidence graphs,
not a reason to fabricate status dates or widen the public input.

Preparation must lock both status pairs during its deterministic pre-outbox
configuration/source phase, then rerun both graphs. These status tables are
app-read-only and uniquely constrained, not trigger-immutable. Full source-basis
and final commit authentication must bind/rederive the service-day graph as well
as the TOS graph. This selected implementation is not yet complete issuance proof.

### Private quoted-applicability and final-tax reconstruction — D1356

Within this order's existing preparation draft, add only the private
`compose_india_native_quoted_tax_source(uuid,uuid,uuid,uuid,uuid,text,text,text)`
leaf. Its UUIDs identify tenant, property, reservation, folio and valuation.
The three texts preserve the exact internally reconstructed invoice-source
input, invoice-source result and service-day supply-nature serialization. They
are not a public source of fiscal authority. The full preparation boundary must
authenticate and lock their original persisted sources before using the leaf.

Reconstruct actual valuation, attribution and reservation lineage. Preserve the
distinct service-day family/levy graph and selected time-of-supply rate graph,
all recording/projection/timing hash domains, and existing integer rounding.
Return exactly these six keys: `componentFamilyCanonicalJson`,
`levyInputBundleCanonicalJson`, `levyComponentIdentityCanonicalJson`,
`quotedApplicabilityCanonicalJson`, `finalTaxCanonicalJson`, and `taxPreview`.
No DML, lock, grant, public command change or runnable migration is admitted.

Use genuine SQL source roots and executable pure-calculation/preimage parity.
Do not fabricate an issued timing row, disable deferred completion constraints,
or install a stub authenticator to make the existing persisted-source TypeScript
calculators run. Full preparation, source-basis authentication, same-transaction
accounting, commit/replay and complete issuance proof are still required.

## Authenticated financial source and native composition checkpoint — D1350

Implemented, but not yet the complete invoice command:

- Private SQL reconstructs genuine service/payment recording and date-projection
  preimages, ordinary-regime evidence, reservation attribution and final-valuation
  basis/allocations. Approval is authenticated at its original consumption time,
  `valuation.recorded_at`; this does not authorize an expired approval for a new
  valuation. Current issue/finalize authority belongs to the current issuing actor.
  Request identity retains the existing explicit governed calendar authority,
  source hash, through-date and dense date/state vectors; no calendar-ID table is invented.
- Financials `resolveNative` reads a typed component-tax delta, preserves the
  existing consideration and nullable zero-tax journal, and binds the valuation's
  actual buyer. The private `read_india_native_accounting_source_closure(uuid,uuid)`
  authenticates the accounting binding against complete actual financial history;
  TypeScript independently matches its accounts, roots and source rows. A stored
  fragment hash alone is no longer treated as proof of current complete membership.
  This bridge is private: app_role/runtime/PUBLIC EXECUTE remains revoked.
- Native413/414 composition reuses the existing statutory/numeric cores and
  native297 calculation. Native429 retains the exact false/no-actions/three-blocker
  contract. Its new adapter is pure composition over supplied, checked results,
  not a substitute for future same-Tx SQL root preparation. Pure module exports
  do not expose a server route, command or callable database issuance capability.
- The persisted timing hash and derived complete time-of-supply hash are different
  domains. Financials binds to `nativeTiming.predecessorHashes.nativeTiming`;
  native297 replay binds to `nativeTiming.evidenceHash`. Tests deliberately make
  those hashes different. Financial business date must equal the native issue date,
  and the legal buyer must equal the buyer recorded in the valuation.
- Private consumed-source guards cover journal reversals, posting additions,
  all eight admitted valuation/applicability/tax parent-child tables and the
  retained0074 reversal-binding trigger. Predicates use permanent native origin
  and complete valuation/transfer ancestry, including zero-tax bindings. Ordinary
  payments and direct-bill settlement are not blanket-banned. Actual issued-source
  winner schedules and races still require the complete prepare/commit path.

Root personally ran the exact updated suites on native Windows/Bun/PG16.15:

| Proof | Result | Boundary |
|---|---|---|
| Accounting/private reconstruction suite |15 passed,0 failed,135 assertions | Includes actual charge/correction→valuation reads, source preimage parity, timezone invariance,366 nights and installed private-wrapper metadata; no live native issuance claim. |
| Native source/valuation suite |16 passed,0 failed,124 assertions | Includes actual corrections, two multi-root reroutes,16-way replay,500 roots/501 accounts and consumed-guard installation; not an issued-source race proof. |
| Five-file native/legacy composition suite |39 passed,15 explicit DB skips,0 failed,406 assertions | Pure and controlled-Tx composition; skipped legacy live cases are not counted as executed. |

The integration worker personally ran the whole standing suite with DB variables
cleared:1518 passed,1103 explicit environment skips,0 failed,21134 assertions across
474 files. Typecheck,166 import boundaries,23-package licence check, dependency
audit and diff checks passed. Bounded non-implementing guard/wrapper observations
are recorded in [the review notes](../reviews/434-native-fiscal-source-completion.md);
they explicitly do not approve Order434 or replace fresh final Tier3 acceptance.

Both private fragments parsed/applied atomically only in the existing synthetic
75-migration/127-table database. All74 runnable migrations and draft75 are unchanged.
Accounting SHA256:
`e6c30d972c12c4dd2999c2d5f269f0ac07944ea8e8431831244919654c7ef754`;
preparation:
`09815b8c03ad93c8aa9a33964e393e0c5021a8b085870288453d2d4d1992133b`.
The single isolated cluster is stopped, port55502 is closed and its retained
directory is189,966,603 bytes. No retained local app, Docker, real hotel data,
dependency or applied migration changed. C/D/E free space was1.39/25.88/7.83GiB;
no cleanup or new dependency download was attempted in this checkpoint.

Remaining: complete canonical statutory preparation/authentication, actual native
accounting and durable replay, same-Tx command/final commit, full76-migration
schema/referee and real issuance/concurrency/compatibility proofs, then fresh
non-implementing Tier3 acceptance. D1349 certifies only the preceding1499faa
published CI. This checkpoint is implementation progress, not Order434/Phase7
completion, main integration or a refreshed local app.

## Preparation locks and persisted tax projection — D1362

Implemented in the existing private drafts, without runtime grants or promotion:

- Dual-date statutory source locks: deterministic SHARE groups, both real dated
  status pairs, drift rejection and actual row-lock contention/release proof.
- Issuer-authority and day/series/tail lock helpers: existing strict runtime
  authority, property-local clock/FY, deterministic source locking and no number
  allocation. Installed metadata and static contracts pass; their live positive
  flow must be exercised through the genuine outer preparation, not a test grant.
- D1360 source basis: exact acyclic 20-key context, eight-key series identity and
  complete source artifacts, independently verified canonical preimage/SHA256.
- Native timing/applicability/tax writer plus typed parent and exact four-child-set
  projection checker. Both ordinary and genuine rate-change cases use original
  source records, compare complete rows, and deliberately roll back before the
  unchanged deferred whole-issuance constraints. This proves the write set, not
  an issued invoice or event/accounting commit.
- Current-transaction authenticator: actual authority, timing, intake, valuation,
  dual-date statutory source, semantic request and configured series are reread;
  the complete basis and typed persisted projections are compared. This is draft
  implementation with independent source inspection and private-metadata proof;
  a successful governed runtime invocation is not yet claimed.

Root personally applied the final preparation fragment atomically and ran the
four focused files with both explicit require-database flags and the existing
loopback deploy/runtime URLs: **68 passed, 0 failed, 793 assertions**, 40.85s.
Non-implementer `/root/native_source_sql` personally ran the then-current basis
and accounting/projection suites: **36 passed, 0 failed, 449 assertions**, 6.43s.
The final root run adds two authenticator contract/metadata checks and includes
the statutory/source and authority/day-series static suites. Results and exact
limits are recorded in the review notes; none is final Tier3 acceptance.

Final preparation SHA256:
`8007fbd4b18e53001d0a4904640745d9303aa9bb71ac4b88d651397348f46511`.
Statutory SHA256:
`367f83ffe459af5d5099186aa67b0ee207f6614b9e879d8a376046b9ffbddf79`.
All 74 runnable migrations, draft0075 and the accounting fragment are unchanged.
The existing synthetic database remained 75 migration records / 127 public tables;
root observed zero other sessions, stopped it and verified port55502 closed.
No local app, real hotel data, Docker, dependency or new worktree was changed.

Next: finish the remaining valuation/buyer/approval/intake/extension lock graph
and outer prepare; prove the real authenticator under existing runtime authority;
wire same-transaction event/accounting, final number/document/receipt commit and
authorized permanent replay. Then complete all76-migration schema/referee and
issuance/compatibility/concurrency proof plus independent Tier3 acceptance.
The 18-phase scope and 11→13→17 priority remain unchanged.

Final standing regression: **1,535 passed, 1,130 explicit environment skips,
0 failed,21,296 assertions**,2,665 tests/476 files,88.01s. Typecheck,167-file import
boundaries,23-package licence policy,audit and diff checks passed. The first full
run hit one Windows Chromium `DevToolsActivePort` EBUSY (1,534 passes); root's
unchanged complete rerun above passed. The failure remains disclosed, not counted
as an initial green result. No browser test or assertion was weakened.

## Genuine native invoice execution — D1363

Root completed the outer22-argument preparation and remaining source/configuration
lock graph; the completion worker implemented canonical413/426/429 reconstruction,
final document/number/accounting-origin/receipt commit and permanent receipt read.
All are non-runnable0076 fragments under this order; the actual runtime command
uses the four intended candidate entry points only during the explicitly admitted
isolated proof window, with unconditional grant revocation afterward.

Executed behavior, using real ChargeService, governed source intake and valuation:

- A10000-minor charge produces one10500 invoice, with original revenue-10000
  unchanged and only500 incremental tax. Exact retries do not write again.
- A genuine one-minor booked quote/payment/charge rounds its two approved tax
  components to zero. Issuance succeeds with a null incremental tax journal and
  no extra financial lines; replay remains identical.
- A genuine2025-09-22 rate change preserves native/statutory TOS2025-09-20 and
  selected-rate TOS2025-09-25 as different facts, selecting successor version2.
- Removing either current issue or valuation permission denies both new issue
  and completed replay, leaving fiscal/audit/number state unchanged.
- Real preparation returns, but a partial COMMIT fails on the deferred
  `india_native_timing_document_fk` with23503. Every attempted write rolls back,
  and the same key can subsequently issue invoice1 successfully.
-100 application requests with one identical key, through a bounded six-connection
  runtime pool, produce one fresh receipt and99 identical replays. Two different
  keys competing for the same folio produce one invoice and one23505 conflict,
  without an extra number or duplicate effects. This is not the separate
 100-distinct-sources/one-series acceptance case.

Independent `/root/native_runtime_review` personally executed **8 passed,0 failed,
157 assertions,28 filtered,17.12s** across the three dynamic suites. Its preceding
7-pass/1-failure run found the rollback test expected custom55000 before the earlier
deferred FK23503; the corrected test requires the exact FK name, successful
preparation return, complete rollback census and successful same-key recovery.
No production guard or constraint was weakened. Earlier independent
`/root/native_source_sql` also executed the ordinary issue/replay path (1/0,7).

Actual execution exposed and repaired a branch-B canonical source serialization
defect: JSONB reordered `candidateDates` while Order297 replays its original
insertion order. Ordered JSON now preserves service-date then payment-date;
semantic dates and sorted-hash domains are unchanged. Aggregate numeric formatting
and millisecond receipt serialization were also corrected during genuine runtime
integration; stored document timestamps and hash preimages are not rewritten.

Still required: permanent replay after closed-day/folio changes;
the full tax-family/source-bound matrix;100 distinct sources sharing one series;
deterministic correction/transfer/seal winner schedules; generic approval creation;
complete0076 migration assembly, fresh/upgrade schema/referee and legacy integration;
and full independent Tier3 acceptance. These remain this order's requirements.
No order/phase completion, main merge, local refresh, IRP or provider activation.

Final publication evidence — D1364: the same non-implementer personally reran
all nine dynamic cases, **9 passed,0 failed,164 assertions,28 filtered,18.71s**.
The added retention proof removes exactly the synthetic invoice's two issuance
outbox events and one completed API receipt, after validating their permanent
identities and absence of consumer dependencies. A new-request-UUID replay reads
the permanent invoice and creates no cache, event, fact, posting, document or
number effects. This does not implement or approve a production retention worker.

Final general regression: **1,551 passed,1,148 explicit database/environment skips,
0 failed,21,510 assertions**,2,699 tests/478 files,77.80s. Typecheck,167-file
boundaries,23-package licence policy,audit and diff checks pass. The skipped
database paths are not counted as proof. All four temporary privileges were
independently verified revoked using default-aware ACL inspection; zero other
database sessions remained. The single existing isolated75-record/127-table
test database is retained for further acceptance, separate from the local app.

## Closed-state replay and distinct-source series — D1365

The actual payment authorization/capture path posts one balanced payment journal;
the real settlement and closure services then close the folio, and the audited
business-day service seals its day. Persisted closed status and non-null day seal
are checked directly. A new-request-UUID invoice replay returns the original
receipt, document and complete permanent source hashes without any further
posting, fact, event, receipt, document or number effect. Payment evidence alone
was correctly insufficient to settle the folio; no flag or ledger shortcut was used.

A bounded reusable fixture now creates100 distinct guests, reservations, folios,
governed source triples and actual charge-to-valuation records under one original
tenant/property/actor/supplier/series. Its scope is current ordinary source data;
it does not pretend to support historical calendars or multi-route cohorts.
Base configuration and booking prerequisites alone are seeded. No derived timing,
tax, accounting binding or document is owner-inserted. Existing fixture defaults
and the74 runnable migrations remain unchanged.

Root scheduled100 different application requests together through the existing
six-connection runtime pool:100 fresh receipts, invoice numbers1..100, counter101,
exact origin/timing/tax/accounting/fact/event/completed-key deltas and recomputed
genesis-to-tail document hashes. All100 new-request replays were effect-free.
Root's result was1 passed,0 failed,723 assertions,139.54s including fixture creation,
issuance, chain checks and replay; this is not a request-latency benchmark. The
first setup attempt failed on a nonexistent extension `content_hash` column,
before cohort issuance. The fixture now uses the already authenticated canonical
jurisdiction identity/hash; no schema change or protection was used to hide it.

Independent non-implementer `/root/native_closed_review` inspected the final diff
and personally executed the frozen three-file dynamic pattern: **11 passed,
0 failed,28 filtered,897 assertions**,157.86s. The distinct-source case took136.27s.
Separately, the private source-lock metadata check passed1/0,3 assertions. Its
PUBLIC check uses default-aware ACL expansion, not a fictitious PUBLIC role.
All reviewed file hashes were stable. All four temporary Question192 capabilities
were revoked in finally; PUBLIC/app_role/yellow_runtime EXECUTE remained false,
and zero other database sessions remained. Exact commands/hashes and earlier
bounded run limitations are appended to the review record, not overwritten.

General regression: **1,551 passed,1,150 explicit environment/database skips,
0 failed,21,510 assertions**,2,701 tests/478 files,72.96s. Skips are not proof.
Typecheck,167-file import boundaries,23-package licence check,audit and diff checks
pass. Draft75 retains SHA256
`d550b41cd405aea2da2b84e75fd3632ae2a6aca3b24b5cd12697394405d29869`;
all four0076 SQL fragments remain unchanged and outside the runner.

Still required: the full tax-family/source-bound matrix, deterministic correction/
transfer/seal winner schedules and authority races, generic approval creation,
complete0076 assembly, fresh/upgrade schema/referee and legacy integration, and
complete independent Tier3 acceptance. No Order434/Phase7 completion, main merge,
retained-local promotion, IRP/provider activation or new phase is claimed.
## Component families, committed winners and actual approval creation — D1368

This checkpoint adds working behavior and bounded proof without closing the order.

- Original supplier/property statutory locations drive real two-night CGST/SGST,
  CGST/UTGST and IGST invoices. Tests reconcile every night/component, unchanged
  consideration revenue, incremental guest/payable tax, balanced journal, document
  totals, sequence advancement and effect-free replay.
- Positive-tax and rounded-zero cases exercise sequential committed winners:
  issue then ordinary correction denied; issue then folio transfer denied; sealed
  day then issue denied without fiscal artifacts; issue then audited seal succeeds
  and permanent replay remains unchanged. These are explicitly not simultaneous
  races and do not replace the still-required correction/transfer-first successes.
- Question193's actual kernel request now accepts an internal preallocated identity
  and explicit expiry, uses a private pending-only owner operation, then preserves
  existing fact/outbox publication and different-user decisions. Original0016
  direct-INSERT columns remain exactly the same six. No expiry policy or duration
  is inferred. The native consumer still recomputes the complete approval basis.
  The positive integration creates and decides the approval as runtime, not owner
  INSERT, before real native valuation and replay. Historical expired fixture
  approvals remain only for labelled deterministic consumption regressions.

The first actual extended request exposed Date22007, fixed by canonical ISO text,
then42501, traced to the exact existing column grants. D1367 supplies the narrower
owner operation; it does not widen direct DML. Root also corrected a test oracle
to include recordFact's existing request_id, keeping exact payload equality.
Overlong winner fixture labels failed before product execution and were shortened;
the original32-character bound and substantive assertions were preserved.

Executed proof on the same isolated PostgreSQL16.15 source cluster:

- Independent completion variants:6 passed/0 failed,41 assertions (13.73s).
- Independent committed-winner cases:4 passed/0 failed,52 assertions (13.15s).
- Independent approval units:7 passed/0 failed,17 assertions.
- Independent approval/consumer integration:3 passed/0 failed,45 assertions (1.99s).
- Root complete native source integration:22 passed/0 failed,263 assertions (19.02s).
- Root full environment-cleared suite:1558 passed,1157 explicit environment/database
  skips,0 failed,21527 assertions across479 files (73.15s). Skips are not DB proof.
- Typecheck,167 import boundaries,23 dependency licences,audit and diff checks pass.

The reviewer pinned matching before/after hashes; exact evidence is in review434.
Approval helper plus the four invoice entry points were finally revoked and audited
with default-aware PUBLIC/app_role/yellow_runtime checks. No tables or applied
migrations changed. The updated completion fragment SHA256 is
71009cac3cd57aa35ee49ef8a82907d4d61fe4cebd1168d660caa5b8e8e4c34e.
Runnable migrations remain0001–0074; draft0075 is unchanged. The isolated database
has75 migration records/127 public tables with draft completion functions installed
for controlled proof; this is not a complete76-migration deployment.

Still required: remaining rate/history and complete-issuance source/night/account
bounds, additional folio issuance, correction/transfer-first success, simultaneous
winner and authority schedules, full76 assembly/fresh/upgrade/schema/referee and
fresh complete Tier3 acceptance. This checkpoint does not add an approval UI/API,
IRP submission, local promotion, main integration or Phase7/order completion.

## Corrected/transferred source issuance and the combined maximum

The same genuine charge/intake/valuation fixture now supports correction-first
and transfer-first issuance. The correction case records a stay charge, an erroneous
one-minor charge and its actual reversal, then consumes all three canonical roots.
The transfer case opens an additional folio through the existing service and moves
the real charge through the governed transfer path. Both positive and rounded-zero
tax cases verify the exact resulting invoice window, financial source identities,
unchanged consideration revenue, incremental tax and effect-free permanent replay.

A second real runtime connection now races a correction against an invoice held
after its writes but before COMMIT. The test observes the exact PostgreSQL blocker/
waiter pair and unchanged externally visible baseline, releases the invoice, then
requires correction denial with no effects. This proves only that concurrent
issue-first schedule, not inverse, transfer, seal or authority races.

The dedicated maximum fixture creates 500 real charge journals against distinct
revenue accounts, 366 room nights and 183,000 signed allocations. It verifies the
exact canonical-source and semantic-payable-route union (one guest,500 revenue,
two payable accounts), then issues and permanently replays the real invoice.
The union assertion is identity evidence, not observation of503 individual locks.
The financial result is consideration3660000,tax183000,total3843000 minor INR,
with exactly one incremental balanced four-line tax journal and no extra revenue.

D1369 repair history is retained: the first maximum run exceeded300 seconds at
valuation COMMIT; replacing repeated conservation scans exposed a second300-second
timeout in preparation. Each harness had terminated before its exact orphaned
backend was identified and cancelled; no database restart was used. The preparation
set comparison then exposed42702 from a PL/pgSQL record/SQL-alias name collision,
fixed by naming the SQL source alias allocation_source. The unchanged300-second
test subsequently passed:1 passed/0 failed,8 assertions,272.89 seconds. That time
includes genuine fixture construction and is not a low-latency benchmark.

The later full-suite maximum execution retained that deadline and every assertion.
One run first failed42703 after issuance because the strengthened identity query
referenced a nonexistent timing column. After it was corrected to the actual final-
tax selected-extension identity, the next run timed out at300002.72ms with16 passes,
one failure and162 assertions. D1370 replaced quadratic per-item serialization with
linear serialization; it did not weaken source validation, the deadline or any test
oracle. Root's optimized maximum-only proof then passed1/0 with8 assertions in
283.61 seconds.

Both forward functions preserve signed-largest-remainder arithmetic, complete
source/night/actor conservation and sparse-zero behavior. Preparation additionally
retains currency/basis validation and all existing lineage, permission, account,
route and source rechecks. Existing0075 and its DEFERRABLE INITIALLY DEFERRED trigger
remain unchanged; there is no new runtime capability or runnable migration.

Independent regression on the same isolated database passed22 source cases/263
assertions and5 concurrent/committed-winner cases/74 assertions. Final independent
completion passed18/0 with169 assertions in296.83 seconds. The maximum case took
276788.87ms: fixture setup40045ms, prefix assertions498ms, issuance233912ms,
exact account/totals query55ms, replay2214ms and final census9ms. It proved all500
canonical roots, all366 nights,183,000 allocations, tax183000, grand total3843000,
balanced tax accounting, exact document/origin/binding/series effects and effect-free
replay. Its exact503-ID union comprises one guest,500 distinct revenue and two
selected semantic payable accounts; it is readable source/route identity evidence,
not an assertion that503 individual account locks were observed. The earlier
correction/transfer checkpoint passed15 completion cases/145 assertions before the
maximum fixture and forward optimizations were added.

The current complete environment-cleared regression passed1560 tests,1161 explicit
environment/database skips,0 failures and21543 assertions across2721 tests/479 files
in79.90 seconds. Skips are not database proof. The immediately prior checkpoint was
1559/0 with21536 assertions in76.13 seconds; it is retained only as history.
Typecheck,167 import boundaries,23-package licence policy,audit and diff checks
also pass. All74 runnable migrations,expected schema and dependency files remain
unchanged.

Every one of the five temporary proof capabilities was finally revoked. Default-aware
ACL inspection showed PUBLIC,app_role and yellow_runtime EXECUTE false for all five,
and zero other database sessions remained. Draft fragments are still not runnable
migrations: there is no local/main promotion, migration integration or phase/order
completion in this checkpoint.

Order434 remains active. Remaining work includes further rate/history and invalid-
bound cases, inverse and other simultaneous winner/authority schedules, full0076
assembly with fresh/upgrade/schema/referee/legacy proof, and complete Tier3 acceptance.
No local refresh, main merge, IRP/provider activation or phase completion is claimed.


## Order438/439 integration boundary — 2026-09-05

The founder now authorizes consolidating verified operational flows into main.
Order439 assigns runnable0075 to containment of rejected0074 native issue authority.
Order434's existing draft0075/0076 filenames are retained historical development
identifiers; future assembled evidence/completion migrations are reserved as0076/0077.
No draft is copied to the runner, and no temporary proof grant is production authority.
This operational consolidation does not close Order434 or Phase7 or activate native
issuance; remaining acceptance continues from D1371 and later preserved checkpoints.
