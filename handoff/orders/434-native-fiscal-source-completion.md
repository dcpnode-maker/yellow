# Order 434 — Complete the first native fiscal invoice source

**Status:** ACTIVE — implementation in progress; no completion or review approval — D1330
**Phase:** 7 · YF-008, YF-009, YF-023
**Implementation base:** `591ace8` (includes the complete Order432 current-catalogue repair)

**Date:** 2026-09-05

**Risk:** Tier3 — fiscal chains, new persisted evidence, migrations, accounting, numbering and RLS

**Authority read:** `PROJECT.md`, D-777, D1302–D1304, D1316, D1321, D1323, Question188; repository HEAD `5695e61`, latest decision D1327

**Draft owner:** Codex `/root/order430_complete_provenance`

**Independent reviewer:** a different non-implementing Tier3 agent, assigned after implementation

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
-0025's `create_receivable_transfer` currently takes a joined
  `FOR UPDATE OF folio, guest, target, party` without the sorted financial prefix.
  Its service performs no earlier row-lock call. This is distinct from0020's
  folio-root transfer, and must not be described as already account-first.

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
| `lock_financial_rows(uuid,uuid[],uuid)` /0017 |1–2 sorted accounts, then selected folio | Keep unchanged; reuse for the receivable lock prefix only. |
| `lock_positive_tax_posting_rows(uuid,uuid[],uuid)` /0044 |2–66 sorted guest/revenue/tax-payable accounts, then primary window1 | Keep unchanged; native gets its own private derived-set helper. |
| `create_charge_correction_header` /0019 | Generic service takes account/folio, root188, original-journal0, then day locks before this header | A journal BEFORE INSERT guard inspects `NEW.reverses` and rejects reversal of any issued consumed journal. |
| `create_positive_tax_correction_header` and `record_positive_tax_correction_root` /0045 | Service takes account/folio then266; SQL root writer inserts the tax-bearing guest line | Same journal guard plus posting-line guard; do not change existing positive-tax shape/authority. |
| `create_india_final_component_tax_correction_header` and `record_india_final_component_tax_journal_reversal` /0072 | Service408 key, then days; binding has a second, differently named408 key | Same journal/posting guards; preserve and extend0074's binding-level issued-source rejection. |
| `create_folio_transfer` /0020 | Guest account; sorted source/destination folios; sorted root188 keys; current day | Posting-line BEFORE INSERT guard rejects an issued consumed transfer root or a new consideration fragment into an issued folio. |
| `create_receivable_transfer(uuid,uuid,uuid,uuid,uuid,uuid,text)` /0025 | Existing joined folio/guest/target/party lock, then approval and day | Forward CREATE OR REPLACE adds a sorted two-account→folio prefix before the joined lock; preserve exact authority, money, approval, signature and grants. Direct-bill settlement itself remains permitted. |
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

The0025 lock-only replacement discovers its existing guest and selected company
account after current tenant/actor/property input checks, calls unchanged
`lock_financial_rows` for those two sorted IDs and the selected folio, then runs
its existing joined query/approval/day logic and exact reread. The company
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
   guards, event linkage, deferrable completion checks, the0025 lock-only forward
   replacement, and the least-privilege new native issue capability. Keep old issued rows readable as immutable
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

### Existing product paths: native union/composition only

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
  direct-bill transfer versus issue after the0025 lock-prefix replacement.
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
correction/transfer guard attachments, the0025 lock-order compatibility repair
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
