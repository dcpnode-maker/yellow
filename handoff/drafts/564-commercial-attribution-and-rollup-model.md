# Order 564 — commercial attribution and roll-up architecture

Status: proposed for independent architecture review; no migration or data mutation
is authorized by this record.

## 1. Natural-Solution Test

Yellow already has most leaf facts and several usable dimensions:

| Need | Existing authority | Decision |
|---|---|---|
| Chain, brand and operating geography | `org_node.path` (`ltree`), kinds `group`, `brand`, `region`, `property`, `outlet` | Keep one canonical operating-containment path. Use successive `region` nodes for continent/country/state/city where needed; do not change the enum merely to rename geography levels. |
| Property | reservation/property, account/property, journal/property, unit type/property | Reuse exact property UUID. |
| Market, source and origin codes | reservation `market_code`, `source_code`, `origin_code`, `channel_code`; rate-plan defaults | Treat existing codes as captured leaf values, then validate/crosswalk them through a versioned taxonomy. |
| Booker/company | reservation `booker_party`, `reservation_group.account_party`, Party roles and `party_relationship` | Reuse canonical Party identity and existing `employee_of`, `subsidiary_of` and `books_for` evidence, but never guess a unique historical company when several relationships exist. Parent company, legal/GST profile and individual booker stay distinct. |
| Room product | D-240/D-262 rate-target class snapshot and `unit_type` | Preserve the existing class-above-type model: a version-local commercial class contains one or more unit types. Bed configuration is an independent governed attribute, not a forced hierarchy parent. |
| Physical room | `sellable_unit` ↔ `sellable_unit_space` ↔ `space` | Reuse the assigned sellable/physical room while respecting the existing many-to-many, mutually exclusive composite-space model. It is not an additive single-parent tree. Never infer occupied inventory outside PostgreSQL occupancy truth. |
| Room nights | reservation segments, lifecycle/occupancy evidence and property-local stay dates | Hotel-night grain is one row per reservation/date. Segment legs allocate that one night using an explicit policy or weights that sum exactly to1; same-day moves never create two hotel nights. Product allocation without a unique supported policy remains Unmapped. Never count cancelled unoccupied nights or headcount as room nights. |
| Revenue | immutable journals/posting lines, folio→reservation, transaction-code USALI line | Financial ledger remains authoritative. Revenue is mapped by posting business date, currency and exact reservation/folio association. |
| Existing daily cache | `stats_daily` | Keep as a bounded projection for its current dimensions. It is not a new source of truth and cannot represent company/MSG or arbitrary hierarchy versions today. |
| Configurable hierarchy | `extension_type`/`extension` | First implementation candidate: a schema-validated, effective-dated commercial-taxonomy extension. Benchmark before adding a hot typed relation. |

Natural result: no migration is justified yet. One canonical operating hierarchy fits
`org_node`; alternate analytical taxonomies and crosswalks fit versioned extension
configuration. A typed relational projection is admitted only if the query benchmark
or integrity proof shows JSON validation/indexing cannot meet correctness or latency.

## 2. The three independent dimensions

Do not force every business attribute into one misleading parent chain. A reservation
maps once into each applicable dimension, and the report engine intersects them.

### Organisation dimension

Canonical path:

`group/chain → brand/sub-brand → region/continent → region/country → region/state → region/city → property`

Not every tenant needs every level. A single hotel may have only `group → property`.
Alternate views such as “all Grand Hyatt regardless of geography” or “all APAC
properties regardless of brand” are versioned analytical sets/crosswalks because one
property cannot have two parents in one `ltree` containment path.

### Demand dimension

Canonical taxonomy:

`MSG → MS`

Examples are client configuration, not enums:

- Corporate → negotiated corporate, retail corporate, crew, government;
- OTA → retail OTA, package OTA, member/mobile OTA;
- Website → brand web, booking engine, call centre/direct digital;
- Travel Trade → travel agent, wholesaler, DMC;
- Groups/MICE → corporate group, social, defence, incentive, engagement, birthday.

Source/channel and company are related analytical dimensions, not compulsory children
of every MS:

- distribution: source group → source → channel/property channel account;
- account: ultimate company group → company/legal/GST Party → booker/profile;
- an MS node declares allowed/applicable source and Party mappings where needed.

This avoids false structures such as making Booking.com a child of a specific company,
while still allowing intersections such as `Corporate / Negotiated × Tata Group ×
website`.

### Product dimension

Commercial drill path:

`property → version-local room class snapshot → unit_type (room product/type)`

Physical assignment is a separate, non-additive relationship:

`unit_type → sellable_unit ↔ one-or-more physical spaces`

Examples such as Standard/Deluxe/Premium/Executive/Suite and King/Twin/Queen/Single
remain property configuration. Bed configuration may classify a unit or type, but it
does not replace the existing pricing class authority. Composite suites, constituent
rooms and beds cannot be summed together unless the query selects one proven common
inventory-counting basis; unsupported mixed scopes return `not_applicable`.

## 3. Cardinality and effective dating

1. A taxonomy version is immutable after activation. Reuse authoritative
   `extension.id`, `version`, effective/status fields and fact evidence rather than
   duplicating a second temporal spine inside JSON. Corrections use a governed
   successor command with expected-version/CAS, idempotency, activation lock and
   same-transaction fact/outbox evidence. Backdated overlap is rejected.
2. Within one version, every non-root taxonomy node has exactly one parent. A parent
   has zero to many children. Cycles, duplicate sibling codes and cross-tenant IDs are
   rejected.
3. A reservation has at most one canonical leaf in each dimension for a given stay
   date/version: one MSG/MS path, one source/channel path, one account path, one room
   product/class path, and one property path. Missing attribution remains `Unmapped`;
   it is never guessed.
4. Many reservations may map to one MS, source, company or product leaf. One ultimate
   company may own many legal/GST Party profiles; each legal profile has at most one
   ultimate-company parent per version. Individual booker, legal company and ultimate
   parent retain separate identifiers. Channel account is explicit and is never
   inferred from `channel_code` alone.
5. One Party may act in several roles, but the booking relationship is explicit:
   primary guest is not automatically the company; `booker_party` or a governed
   reservation-company association supplies the account dimension.
6. `as_booked` means a pinned attribution fact captured with the reservation decision:
   exact leaf IDs, taxonomy/relationship/class snapshot IDs, source values, actor and
   knowledge time. It is not reconstructed from mutable current reservation columns.
   A governed override supersedes the attribution fact and records reason/actor/time;
   reports with a knowledge-time cutoff select the latest non-superseded fact known at
   that cutoff without rewriting ledger rows.
7. Three modes are distinct: `as_booked(knowledge_cutoff)`, optional
   `effective_on_business_date` remapping, and `restated(selected_version)`. A report
   never mixes them. A stay crossing a version boundary changes only in the explicit
   effective-date mode; pinned as-booked remains pinned. Changed org paths,
   relationships and product membership remain Unmapped unless the selected mode has
   exact historical evidence.
8. Chain/company alternate sets may be many-to-many within and across versions, but a
   single membership is unique by `(version, set, member)`. Union filters use a
   semi-join and deduplicate property IDs. Overlapping set rows are labelled
   non-additive and cannot be summed to a grand total unless the requested set is a
   validated partition. Taxonomy membership never grants property authorization.

## 4. Map/reduce and KPI rules

Never place capacity on a demand or posting leaf. Build and conserve three independent
grains before combining compatible aggregates:

1. **Inventory-date grain** — one row per tenant/property/business-date/common
   inventory counting basis, containing configured capacity and explicit OOO/OOS or
   other governed denominator exclusions. Remaining availability is not capacity.
   Composite suites/rooms/beds are resolved to one proven mutually exclusive basis;
   otherwise the requested combined KPI is rejected.
2. **Stay-night grain** — one hotel-night row per
   tenant/property/reservation/business-date/common inventory basis after a real
   eligibility predicate. Segment/product allocation legs are separate conserved
   children whose weights sum exactly to1, or remain Unmapped when no approved policy
   can allocate them. Planned sold nights and actual occupied nights are separate
   measures. Same-day room moves conserve one hotel night; cancellation after partial
   occupancy, early departure and no-show preserve already evidenced history rather
   than relying on current status alone.
3. **Revenue-line grain** — one row per eligible revenue-account posting line and
   currency, with sign normalized to positive revenue. Guest debit lines are never
   added to their balancing revenue credits. Original/reversal/correction lines remain
   signed and net economically; `quantity` is descriptive and is never multiplied.

Revenue association follows proven lineage only. For the normal two-line charge, the
folio-bearing guest debit proves the journal/folio/reservation association and the
matching eligible revenue credit contributes once. Tax lines remain separate from
revenue. Multi-folio, house/outlet/event or nullable-folio revenue without a unique
association is `unallocated_non_stay_revenue`; it is never dropped or copied across
segments. Posting dates outside a stay, room moves and retrospective corrections use
an approved pinned allocation or remain Unmapped. Historical classification is pinned
with the posting/attribution evidence rather than read from a mutable current tx-code
label. Posted revenue and quoted/OTB revenue are separate measures.

Reduce each grain to its unique grouping key first, then join aggregates. Additive
room nights and signed minor-unit revenue use `SUM`; derived metrics are recomputed:

- ADR = eligible posted room revenue / eligible sold room nights;
- occupancy = actual occupied room nights / available room-night capacity;
- RevPAR = eligible posted room revenue / available room-night capacity;
- zero or missing denominator = null with a reason code, never UI-invented zero;
- no arithmetic combines currencies; every revenue aggregate key includes currency.

Metric eligibility matrix:

| Requested scope | Room nights / revenue / ADR | Occupancy / RevPAR |
|---|---|---|
| property/date on one common inventory basis | supported | supported when capacity history and policy are complete |
| disjoint authorised property/brand/region partition | supported, grouped by currency | supported only after separately aggregated property/date numerators and denominators |
| MSG/MS/source/channel/company | supported as contribution and ADR | not applicable; property capacity is not copied into demand leaves |
| room class/type | supported when the class snapshot/type allocation is exact | supported only for a proven mutually exclusive capacity basis |
| overlapping analytical sets or mixed suite/room/bed bases | labelled non-additive | rejected/not applicable |

Revenue is not duplicated for sharers, segment legs, company relationships or group
members. Parent totals must conserve against disjoint children; overlapping sets never
pretend to be additive.

## 5. Proposed configuration contract

Register `hospitality-commercial-taxonomy` as a schema-validated extension. The
extension row owns identity/version/effective/status; payload does not duplicate those
authorities:

```text
nodes[]: id, dimension, kind, code, label, parent_id?, sort_order, active
code_bindings[]: property_id, field(channel|market|source|origin), captured_code, node_id, channel_account_id?
party_bindings[]: party_id, company_node_id, relationship(legal_profile|ultimate_parent|booker), evidence_id
product_bindings[]: class_snapshot_id, unit_type_id, bed_attribute?, analytical_node_id
property_sets[]: set_id, kind(brand|region|city|state|country|continent), members[]
```

Code binding is unique per `(tenant, property, dimension, captured_code, extension
version)` and conflicting duplicates fail closed. Activation validates referential
closure, unique parents, no cycles, tenant/property ownership, non-overlapping
effective periods and code uniqueness under an activation lock. Owner commands require
expected version and idempotency and write the attribution/configuration fact and
outbox evidence in the same transaction. The existing generic ExtensionService does
not yet supply this workflow; until a reviewed owner command exists, activation and
override remain named unmet preconditions. Client examples never become SQL enums.

## 6. API and drill-down contract

Read endpoint candidate owned by the reporting context:

`GET /api/v1/commercial/performance`

Required session and permission boundary:

- tenant comes only from the verified session and is set transaction-locally;
- `commercial.performance.read` authorizes aggregate reads for an explicitly
  intersected set of property IDs; partially authorized org subtrees return a visible
  `partial_scope` marker and only authorized properties, or fail closed when the
  caller requests an indivisible total;
- `commercial.performance.drill` is checked again for every drill request; company
  and booker drill never returns contact, KYC or unrelated guest identity.

Required inputs:

- property or authorised organisation subtree;
- half-open `[from_business_date, to_business_date)` interpreted separately in each
  property's timezone;
- group-by list chosen from `property, brand, region, msg, ms, source, channel,
  company, unit_type, room_class, business_date`;
- zero or more multi-select filters for the same dimensions;
- attribution mode `as_booked` plus knowledge cutoff,
  `effective_on_business_date`, or `restated` plus one explicit taxonomy version;
- cursor/limit for leaf tables; aggregate cards return bounded result sets.

Filters are OR within one dimension and AND across dimensions. Response includes exact
decimal-string sums/numerators/denominators, ratio scale/rounding, null reason codes,
currency, every taxonomy version represented, evidence/projection cutoff, unmapped
counts, requested/authorized scope and totals independent of page size. A multi-version
as-booked report never returns one misleading scalar version.

Every aggregate row returns an opaque signed filter token; no UI reconstructs SQL.
Token payload is bound to tenant, authorized property set, taxonomy hash/version set,
mode, date range, currency, filters, stable keyset ordering and knowledge/projection
cutoff. Grants and token signature/scope are revalidated on drill; tampering or changed
grants fail closed. Cursor limits, maximum range and group cardinality are server
bounded. One snapshot/cutoff keeps cards, totals and drill leaves consistent across
concurrent changes. Minor-unit sums remain exact decimal/numeric strings and never
cross JS `Number`; overflow policy is tested explicitly.

UI interaction follows the supplied screenshots as a behavioural reference:

- compact horizontally scrollable segmented pills, active item shown by text/check
  and shape as well as colour;
- hierarchy breadcrumb and one-level child pills rather than exposing the whole tree;
- “All” is an explicit aggregate, not a fake node;
- 44px touch targets, keyboard buttons with `aria-pressed`, reduced-motion support;
- desktop shows grouped table plus drill drawer; mobile shows metric cards, pills and
  a virtualised leaf table with the same filters;
- semantic yellow/white/grey/black shell; green/red may supplement positive/negative
  variance but never replace labels/arrows.

## 7. Query plan and correctness proof

First executable prototype must use PostgreSQL only:

1. Build separate inventory-date, stay-night and signed revenue-line CTEs and assert
   their unique keys and conservation before composition. `reservation_segment` has
   no superseded flag: the prototype must define eligibility from actual segment
   sequence/status/period plus recorded lifecycle/occupancy evidence. Same-date move
   legs conserve one hotel night.
2. Resolve the exact pinned/effective/restated taxonomy, Party relationship and
   class-snapshot evidence for the selected mode; ambiguous company or product
   association remains Unmapped.
3. Select every eligible signed revenue-account posting line once, then normalize
   revenue contribution as `-signed_amount_minor`: an ordinary revenue credit becomes
   positive revenue and a reversal debit becomes negative revenue. Resolve only proven
   journal→folio/account→reservation lineage. Preserve taxes, corrections and
   unallocated non-stay revenue as explicit classes.
4. Build capacity from an independently proven inventory-date authority and stated
   OOO/OOS/house-use policy. Never use remaining availability or repeat capacity on
   demand leaves. Missing capacity history makes occupancy/RevPAR unavailable.
5. Apply tenant context transaction-locally and intersect authorized property IDs
   before every aggregation; taxonomy/set membership never expands access.
6. Aggregate each grain first, join only compatible totals, then compute ratios with
   `NULLIF` denominators and explicit not-applicable/missing-policy reasons.

Correctness fixtures must cover hotel, brand, region, MSG, MS, source, channel,
ultimate-company/legal-company, room type and room class, including:

- one reservation with multiple sharers (no duplicated nights/revenue);
- same-day and overnight room moves across two products without a duplicate hotel night;
- 100-room property with two demand leaves proving capacity remains 100, not 200;
- suite versus constituent-room/bed overlap and unsupported mixed-basis rejection;
- multi-day stay across month and taxonomy-version boundaries;
- group booking and company booker;
- OTA booking without company;
- direct website booking;
- cancelled/no-show and early departure;
- exact two-line room charge, taxed multi-line charge, full reversal, later-date
  correction/allowance and multi-folio/house/outlet revenue;
- missing mapping shown as Unmapped;
- two tenants and foreign Party/unit/property hostility;
- two currencies with no implicit summation;
- numerator/denominator recomputation proving average-of-averages is rejected;
- company ambiguity, version boundary, knowledge cutoff, backdated correction, org
  reparenting and overlapping-set union/dedup/non-additive labels;
- very large bigint/numeric sums and all-Unmapped results.

Before persistence or migration, retain a reproducible schema-free prototype on fresh
isolated PostgreSQL16 with canonical migrations, fictional fixtures, query source and
an independent expected-results manifest. It must include two tenants and two same-
tenant properties, app-role/RLS and tampered-token hostility, all-table no-DML
fingerprints, cycle/duplicate-parent/cross-tenant/duplicate-code/overlap/CAS/replay and
writer-race tests for any proposed activation authority. Unimplemented authority stays
an unmet precondition rather than simulated acceptance.

Performance proof uses representative 100-room and 1,000-room properties, at least
two years of daily leaves, skewed mappings, concurrent filter/drill requests and
retained `EXPLAIN (ANALYZE, BUFFERS)`. Record hardware, PostgreSQL settings, row counts,
parameters, warm/cold runs, sample count, p50/p95/p99, buffers/spills and planner
estimates for hotel/brand/region/MSG/MS/source/company/type/class scopes and late
keyset pages. Initial targets are aggregate p95 under300ms and first virtualised leaf
page under150ms on the supported laptop; they are gates, not claims. Avoid per-row JSON
expansion and N+1 lookup. If the extension crosswalk misses correctness, race safety or
latency, stop and return with exact Natural-Solution evidence for a separately reviewed
forward typed projection/migration/ACL/RLS/rebuild plan. DuckDB may analyze exported
facts but is never transaction authority or a way to hide a PostgreSQL miss.

## 8. Open decisions requiring founder input later

- Whether hotel companies prefer “as booked” historical reporting as the default or
  restatement under the latest approved taxonomy.
- Exact brand/geography set names for each chain.
- Treatment of complimentary/house-use rooms in occupied and ADR denominators.
- Which posting classes count as room revenue for each jurisdiction/accounting policy.

These choices do not block the schema-free query prototype, but no production metric
may silently invent them.
