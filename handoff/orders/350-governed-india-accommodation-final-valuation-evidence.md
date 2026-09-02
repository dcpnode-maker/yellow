# Order 350 — Governed India accommodation final-valuation evidence

**Status:** APPROVED-D1012
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/governed-india-accommodation-final-valuation-evidence`
**Base:** `3638c96` (D991 founder-ratified final-valuation policy; approved Order341 ancestry)
**Risk tier:** 3 — statutory taxable-value evidence, immutable financial lineage and tenant-scoped writes
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Record one append-only, tenant-hidden final-valuation bundle for one exact India
accommodation reservation and folio window. The governed command locks the reservation,
folio, account, legal buyer and complete current posting-root set; freshly replays the
approved Order341 quoted rate-applicability partition in the same tenant transaction;
and derives every money value from immutable PostgreSQL posting truth.

For the ordinary CGST Act section 15 path, the bundle preserves explicit governed
evidence that the price is actually paid or payable, the parties are not related or
distinct, money is the sole consideration, every section 15(2) addition and every
package/promotion/discount/fee is enumerated, and each section 15(3) discount is
eligible. It allocates every admitted signed source amount across the exact ordered
room nights with one deterministic integer algorithm and persists the resulting
positive per-room-night transaction values.

Related/distinct-person, non-money, pure-agent, special-supply, tax-inclusive,
Rules 27–35 or otherwise indeterminable evidence produces only an immutable
`manual_valuation_required` bundle. It does not produce a taxable value and cannot
authorize tax calculation, posting, document issue or fiscal submission. A later
specialist workflow may supersede that evidence; it may never edit it.

## Founder policy and statutory authority

D991 makes all six clauses of resolved Question180 binding: governed fiscal-issue
finalization, explicit persisted legal buyer, explicit ordinary-path evidence,
deterministic allocation, fail-closed special cases and append-only superseding
corrections.

The official current India Code copy of the *Central Goods and Services Tax Act,
2017* is the legal source for this boundary:

- section 15(1) admits transaction value only where supplier and recipient are not
  related and price is the sole consideration;
- section 15(2) adds the enumerated taxes/duties, supplier liabilities paid by the
  recipient, incidental expenses, interest/late fee/penalty and price-linked
  subsidies; and
- section 15(3) excludes only discounts satisfying its stated invoice/agreement and,
  for after-supply discounts, attributable-recipient-input-tax-credit conditions.

Official source: <https://www.indiacode.nic.in/indiacode/bitstream/123456789/15689/1/A2017-12.pdf>.
The official consolidated CGST Rules define the special valuation paths, including
Rules 27–35, Rule 33 pure-agent expenditure and Rule 35 tax-inclusive value:
<https://cbic-gst.gov.in/pdf/01012020-CGST-Rules-2017-Part-A-Rules.pdf>.

This order implements evidence ownership and ordinary-path value composition only.
It does not decide a special valuation, calculate GST, round tax, issue an invoice or
submit to IRP.

## Natural-Solution Test and exact schema shape

Existing primitives remain authoritative:

- `reservation`, `folio`, `account`, `party` and `party_role` own the exact commercial
  scope and legal-buyer candidates;
- `journal` and `posting_line` remain the sole money ledger;
- Order244/252 and approved Order341 remain the quote/reservation/rate-applicability
  lineage; and
- `approval_request`, `fact_log`, `outbox` and `api_idempotency` remain the approval,
  audit, event and replay primitives.

Neither `fact_log` nor untyped JSON can safely enforce a unique current valuation,
typed minor-unit reconciliation, one successor per predecessor, legal-buyer approval
use, per-source/per-night allocation or tenant-safe foreign-key lineage. Four small
insert-only tables are therefore the minimum normalized evidence bundle; they do not
duplicate balances or create a second ledger:

1. `india_gst_accommodation_final_valuation` — one immutable bundle root with exact
   tenant/property/reservation/folio/window/account/buyer/Order341 identities,
   `ordinary_final` or `manual_valuation_required` disposition, source-set and final
   evidence hashes, generation, nullable one-use approval, nullable predecessor and
   manual-reason set. It stores INR and typed totals only for `ordinary_final`.
2. `india_gst_accommodation_valuation_source` — one immutable current-folio source
   snapshot per canonical posting root, with the database-derived signed current
   amount, exact current fragment-set hash, transaction code, journal lineage,
   statutory classification and classification/eligibility evidence hashes.
3. `india_gst_accommodation_valuation_room_night` — one immutable row per exact
   Order341 ordinal/business date, preserving its quoted weight and, only for
   `ordinary_final`, the composed positive transaction value in INR.
4. `india_gst_accommodation_valuation_allocation` — one immutable typed signed
   minor-unit allocation from one valuation source to one room-night ordinal.

Every table starts with `tenant_id`, every primary/unique/foreign key and index is
tenant-leading, every table has RLS enabled and forced with the canonical
transaction-local tenant predicate, and every table is owner-owned. `app_role` gets
SELECT only; `PUBLIC`, `app_role` and `yellow_runtime` receive no direct
INSERT/UPDATE/DELETE/TRUNCATE. No table has a mutable status or `superseded_by`
column. Current truth is the unique head with no later row referencing it.

The root has unique `(tenant_id, request_id)`,
`(tenant_id, reservation_id, folio_id, generation)`, unique nullable
`(tenant_id, supersedes_valuation_id)` and unique nullable
`(tenant_id, approval_request_id)`. Generation zero has no predecessor; every later
generation names exactly the prior current root and increments by one. These
constraints plus the locked scope prohibit initial duplicates, correction forks and
approval reuse without updating history.

All hashes are lowercase SHA-256 over a versioned canonical fixed-order body that
includes tenant identity. Hashes are integrity evidence, never a substitute for
foreign keys and fresh row replay. Monetary columns are `bigint` plus `char(3)` INR;
JSONB never carries authoritative money.

## Exact governed command

`IndiaGstAccommodationFinalValuationService.finalize(tx, input)` is an internal
tax-fiscal context command. Its input is an exact, deeply frozen,
accessor/proxy/symbol-free graph containing only:

- tenant, property, reservation and exact folio id;
- complete approved Order341 input and result;
- legal-buyer party id;
- a bounded ordered set of canonical posting-root ids with exact statutory source
  classification and independently identified evidence reference/hash, but no amount;
- the complete ordinary/special valuation evidence references and hashes;
- nullable expected-current valuation id/hash and nullable exact legal-buyer approval;
- idempotency key and a server-created audit envelope.

The request accepts no amount, currency, business date, room-night value, allocation,
tax rate, tax amount, total, folio balance, buyer details, clock, current/latest flag,
document identity or caller-authored evidence hash result.

Inside one transaction-local tenant transaction the service:

1. freshly reruns Order341 and byte-matches the complete supplied frozen result;
2. obtains a transaction advisory lock keyed by tenant/reservation/folio, then locks
   the exact reservation, folio and folio account in deterministic order;
3. requires the folio to belong to that reservation and property, uses its stored
   `window_no` without assuming window one, requires an open INR account/folio, and
   records that exact window as the fiscal-issue scope;
4. locks the active designated Party and validates one eligible `guest` or `company`
   role; it derives the exact relationship candidate set from persisted reservation
   primary/booker, folio-account party and group-account party identities;
5. accepts a designated buyer inside that set without override; otherwise it locks
   one approved `india_gst_legal_buyer_override` request whose exact subject and
   canonical payload bind tenant/property/reservation/folio/window, designated buyer,
   relationship-set hash, requester, valuation request hash and Order341 evidence
   hash, requires a different active deciding user, and consumes it exactly once via
   the root's unique approval foreign key;
6. derives the complete current folio-visible consideration set from `journal` and
   `posting_line`, following canonical transfer-root lineage and excluding fully
   reversed roots. It locks every canonical root and every currently visible fragment
   in global UUID order. Payment, deposit, settlement, tax and transfer-only ledger
   effects are not consideration sources; unclassified, ambiguously classified,
   partially transferred, divergent-currency, future/uncommitted, duplicate or
   concurrently changed roots fail closed;
7. requires the requested posting-root ids to equal that complete source set. It
   derives each signed amount from the locked current fragments, never from the
   request, USALI text, description, quantity, folio balance or `tax_detail`;
8. validates and persists one exact source classification:
   `room_consideration`, `package_consideration`, `promotion_discount`,
   `fee_consideration`, `section15_2_addition` or `section15_3_discount`.
   Positive consideration/addition kinds require positive roots; discount kinds
   require negative roots. Corrections inherit the original root classification and
   cannot be reclassified. `section15_2_addition` additionally names exactly one
   statutory addition kind; each discount names its persisted section15(3)
   eligibility conclusion and evidence. A supplied label without the locked posting
   root and governed evidence is not authority;
9. independently reparses the persisted Order244 snapshot behind Order341, requires
   exact Order252 reservation/folio lineage, and adopts only its unique ordered
   positive INR room-night amounts as allocation weights. It never uses stay average,
   posting business date or a caller-provided service date as a room-night mapping;
10. records `manual_valuation_required` with a canonical non-empty reason set and no
    taxable totals/allocations whenever evidence says related/distinct person,
    non-money consideration, pure agent, special supply, tax-inclusive price,
    Rules27–35, omitted/unsupported addition or discount, non-positive room-night
    result or otherwise indeterminable value. Missing ordinary evidence is never
    interpreted as false and cannot yield `ordinary_final`;
11. otherwise requires exact persisted conclusions `unrelated_not_distinct`,
    `money_only`, `actually_paid_or_payable_from_locked_postings`,
    `all_section15_2_additions_enumerated`,
    `all_packages_promotions_discounts_fees_enumerated` and complete discount
    eligibility; allocates and inserts the ordinary bundle; and
12. records one minimized fact and one
    `india_gst.accommodation_final_valuation_recorded` outbox event in the same
    transaction. A successor fact names the prior valuation fact through
    `fact_log.supersedes`; the event identifies only root ids, disposition,
    reservation/folio/window, buyer, generation and evidence hashes.

The insert path is one owner-mediated, fixed-search-path `SECURITY DEFINER`
capability executable only by `app_role`. It independently binds the requested tenant
to transaction-local `app.tenant_id`, validates the active actor and all exact locked
database roots, computes/reconciles allocations, and inserts the four-table bundle.
`PUBLIC` and `yellow_runtime` cannot execute it; `app_role` retains no direct bundle
DML. The function executes inside the same service transaction so any later
fact/outbox or deferred-constraint failure rolls back the entire bundle.

`PostgresIdempotency` operation
`tax-fiscal.india-accommodation-final-valuation.finalize` binds the canonical request.
Exact replay returns the prior root; same-key divergent content conflicts. Database
request uniqueness and scope locks remain the concurrency arbiter even when callers
use different idempotency keys.

## Deterministic allocation and reconciliation

For every source independently, let `A` be the absolute database-derived source
amount and each positive Order341 quoted room-night weight be `w[i]`, with
`W = sum(w[i])`.

1. Compute `floor(A * w[i] / W)` using arbitrary-precision integer arithmetic.
2. Rank residual fractions by descending remainder `A * w[i] mod W`, then by exact
   ascending Order341 ordinal as the only tie-break.
3. Assign one minor unit to the first `A - sum(floor)` ordinals in that rank.
4. Restore the source sign to every allocation.

There is no floating-point, decimal/numeric rounding, random order, database physical
order or clock input. Each source allocation sums exactly to its signed current amount;
each room-night transaction value is the exact sum of its allocations; room-night
values sum to the root transaction value; source and root sums remain within signed
int64 bounds; and every ordinary room-night result must be positive. The implementation
must use one shared pure allocator for production and proof. A special case never
silently clamps, averages or creates a zero/negative ordinary value.

## Append-only corrections

An initial finalization requires no current head. A correction supplies and
byte-matches the exact current id and evidence hash; the command locks that head,
requires it still to be current, snapshots current posting and buyer truth again,
then inserts generation `n+1` naming generation `n`. Only one successor can exist.

No prior root, source, room-night, allocation, fact, posting, journal, approval or
document is updated or deleted. A successor may move from `manual_valuation_required`
to a later governed result or replace an ordinary result after posting truth changes.
Its canonical outbox evidence is what later separately governed posting and fiscal-
document correction workflows must consume. This order itself creates no journal,
credit note or document.

## Migration and exact catalogue allocation

At exact base `3638c96`, the frontier is migration0061 and Order349 is explicitly
migration-free. Order350 therefore reserves
`0062_india_gst_accommodation_final_valuation.sql`. Activation must still re-read the
exact frontier before intentional red; any unexpected 0062 collision requires a
contract amendment rather than renaming an applied file or guessing. Expected fresh
catalogue truth is:

- 62 migrations;
- 115 public base tables (`111 + 4`);
- 105 tenant-RLS tables/policies (`101 + 4`);
- 14 FORCE-RLS tables (`10 + 4`); and
- 2 security-invoker views unchanged.

The migration adds only the four evidence tables, their tenant-leading constraints
and indexes, and the one bounded owner-mediated recording capability. It adds no
mutable status table, balance, view, trigger that mutates history, direct application
DML, tax calculator, document function or runtime capability.

## Exact scope

- this order, bounded Phase-7 plan/roadmap/decision/ledger/review evidence;
- `migrations/0062_india_gst_accommodation_final_valuation.sql`;
- one tax-fiscal final-valuation service and exact context export;
- one shared pure deterministic signed largest-remainder allocator;
- focused intentional-red, pure allocation, fresh-PostgreSQL, hostile, concurrency,
  rollback, idempotency and mutation-sensitive proof;
- directly affected migration/schema/database-acceptance/runtime-authority/
  runtime-DML/SECURITY-DEFINER/table-count tests and `tests/schema/expected.sql`;
- exact contract/domain/event/state/security/QA documentation for this bounded
  valuation evidence;
- fresh non-implementing Tier-3 executable review evidence.

`migrations/0001_init.sql` remains immutable. Any apparently required file or product
surface outside the activated exact scope requires a pre-commit contract amendment or
separate question; scope must never widen silently.

## Hostile executable proof

### P0 — intentional red and exact ancestry

Before production, prove the service/export, allocator, migration, four tables,
capability and event are absent. Bind exact base `3638c96`, D991 and approved
Order341/D965 ancestry. Preserve the red output before implementation.

### P1 — monetary truth and complete folio scope

On fresh PostgreSQL, finalize one multi-night reservation with multiple room,
package, promotion, fee, each section15(2) addition type and both eligible section15(3)
discount evidence shapes. Prove all amounts come from locked posting fragments and
the complete current folio window, not request values, displayed balance, quantity,
description, USALI label, `tax_detail`, posting business date or another window.

Missing, extra, duplicate, fully reversed, partially transferred, foreign-folio,
foreign-reservation, foreign-property, foreign-currency, tax/payment/deposit/
settlement, divergent correction or concurrently changed roots fail atomically.
Changing a posting amount is impossible; changing the selected fragment/root set or
classification after validation is detected under the lock.

### P2 — section 15 ordinary and manual partitions

Only complete `unrelated_not_distinct`, `money_only`, actual-payable locked-posting,
enumeration-completeness and discount-eligibility evidence produces
`ordinary_final`. Remove or corrupt every evidence field/hash independently and prove
fail-closed behavior.

Exercise related, distinct, non-money, pure-agent, special-supply, tax-inclusive,
Rules27–35, omitted addition, ineligible/indeterminate discount and unclassifiable
posting cases. Each yields only the exact immutable `manual_valuation_required`
reason set with no taxable totals or allocations and no downstream authority. No
negative assertion is inferred from missing data.

### P3 — exact deterministic allocation

Prove equal and unequal weights, one-night and 366-night stays, positive and negative
sources, zero remainder, maximal remainder, equal-remainder ordinal tie, one-minor-unit
source, int64 boundaries and unsafe total rejection. Independently recompute every
source, room-night and root sum. Reverse input/root/database row order and obtain
byte-identical output/hash. Mutate floor, remainder sort, tie-break, sign restoration,
weight, ordinal or reconciliation guard and require a permanent proof failure.

### P4 — tenant and lineage hostility

Two-tenant proof attacks every root and child table, direct reads/writes, same UUIDs,
mixed tenant/property/reservation/folio/account/party/group/Order341/posting/
approval/fact identities, public-hash-only substitution and stale predecessor graphs.
Cross-tenant reads return zero; all cross-tenant or mixed-lineage writes fail. Outputs
and events never expose tenant id, buyer tax identity/contact data, descriptions or
raw evidence content.

### P5 — legal buyer and approval binding

Prove active exact primary, booker, folio-account and group-account candidate paths;
inactive/merged/anonymised, missing-role, foreign and ambiguous parties fail. An
outside candidate requires an exact approved override. Pending/rejected/expired,
self-decided, wrong kind/subject/scope/buyer/candidate-set/request/Order341 hash,
foreign/stale and reused approvals fail. Two contenders for one approval yield one
winner. Exact replay does not consume it twice.

### P6 — append-only correction and concurrency

Twenty same-scope contenders with equal and divergent idempotency keys converge to one
generation-zero root and one fact/outbox effect. Stale expected-current id/hash,
parallel successors and correction forks fail. Sequential corrections form one exact
generation/predecessor/fact chain. Manual-to-specialist and ordinary-to-corrected
successors preserve all old bytes. Direct UPDATE/DELETE/TRUNCATE on every bundle table
is denied, including to the owner-mediated application role.

### P7 — atomicity, replay and rollback

Inject failures before/after each root, source, room-night and allocation insert, at
fact creation, event publication and deferred commit. Every failure leaves no partial
bundle/fact/outbox/approval-use artifact; an exact retry succeeds once. Same-key same-
content replays byte-exactly; same-key divergence conflicts. Root evidence-hash
collision with divergent bytes fails.

### P8 — least authority and fresh schema

Fresh migration proof binds the activation-time exact counts, all tenant-leading
constraints/indexes, forced RLS and unchanged two security-invoker views. Prove the
recording function is owner-owned, fixed-search-path and hostile-`pg_temp` resistant;
only `app_role` may execute it; `PUBLIC`/`yellow_runtime` cannot; application/runtime
roles have no direct bundle DML or unrelated table authority. The function returns
only bounded identifier/disposition/hash evidence.

### P9 — preservation and independent review

Run focused Order341 and adjacent India lineage, financial correction/transfer,
approval/idempotency/fact/outbox, migration/schema/database-acceptance/runtime-DML/
SECURITY-DEFINER gates, typecheck, boundaries, licences, audit, full standing suite
and fresh `./setup.sh --db-only` referee `11/11`. A fresh independent
non-implementing Tier-3 reviewer personally executes monetary, tenant, lineage,
buyer/approval, allocation, concurrency, supersession and rollback proof against the
exact candidate and records commands/results before approval.

## Forbidden boundary

- GST rate selection beyond replaying approved Order341, taxable-rate application,
  tax-component amount, rounding, residual allocation, tax/grand total or payable
  calculation;
- journal/posting creation or correction, account routing, business-day seal,
  settlement, payment, refund, trust or receivable behavior;
- document series/number/hash chain, invoice/credit note, `ItemList`, IRP payload,
  submission/provider/network/sandbox state or QR/signature;
- specialist Rules27–35 valuation, pure-agent valuation, related-party open-market
  value, non-money valuation, tax-inclusive extraction or caller-selected fallback;
- inference from folio balance, quote total, stay average, `price_override`, USALI,
  descriptions, quantities, untyped JSON or caller amounts;
- buyer GST/address projection, B2B/B2C/SEZ determination, invoice field composition,
  recipient portal lookup or legal-identity mutation;
- HTTP/API/operator/UI, new permission, local promotion/data mutation, Docker,
  `.yellow`, port3000/stable Order335, merge, push, deploy or Phase/application-
  complete claim.

## Definition of done

- [ ] Activation revalidates migration allocation and exact scope.
- [ ] Intentional red precedes all production implementation.
- [ ] Ordinary and manual partitions are fully persisted, immutable and fail closed.
- [ ] Every amount derives from complete locked current posting truth and reconciles
      through the one deterministic per-room-night allocator.
- [ ] Legal buyer, conflicting-buyer approval and correction chains are exact,
      one-use/concurrency-safe and tenant-contained.
- [ ] Fact/outbox/idempotency effects are atomic and rollback/replay proof is green.
- [ ] Exact fresh schema, standing/static and referee gates pass without weakening.
- [ ] Fresh independent non-implementing Tier-3 executable approval is recorded.

Creation of this order grants no implementation or downstream authority until it is
activated against the exact frontier. Completion grants only governed final-valuation
evidence. Tax money, posting, documents and IRP remain separate bounded orders.
