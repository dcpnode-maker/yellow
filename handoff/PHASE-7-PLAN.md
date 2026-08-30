# Phase 7 — Tax engine and India IRP

**Status:** active; governed positive-tax posting and complete correction approved through Order266
**Entry point:** built-unreviewed Phase-6 composition through Order 236
**Current order:** Order287 exact India accommodation supply-nature evidence is ready under D-755

## Outcome

Phase 7 turns immutable commercial and posting inputs into deterministic integer-minor-
unit tax evidence, then builds governed fiscal-document issue and India IRP reporting
without giving a browser, provider or mutable configuration a second financial truth.

## Planned build sequence

1. pure validated jurisdiction evaluator over the adopted `tax_jurisdiction` contract;
2. effective property/date assignment and immutable jurisdiction-version resolution;
3. quote and folio tax preview using the same evaluator and attributable inputs;
4. governed tax posting lines and correction/reversal composition;
5. fiscal series, gapless document number and hash-chain issue path;
6. provider-neutral fiscal submission state machine and India IRP payload adapter;
7. deliberate operator document/IRP journey with receipts, retry and failure visibility.

Independent review is deferred under the founder's build-first direction. Tax,
financial posting, document numbering, fiscal chains and submission work may therefore
finish only as built-unreviewed until the required non-implementing executable reviews
are performed. No Phase-7 or app completion is claimed by opening this plan.

## Order 237 boundary

Order 237 is pure in-process calculation only. It validates one adopted jurisdiction
content value at the context boundary, converts configured rates to integer basis
points, evaluates signed-safe `bigint` minor-unit inputs, and returns deeply frozen
attributable tax components. It performs no database, HTTP, UI, posting, document,
submission, provider, event or migration work.

The engine supports the existing contract's percent, fixed-per-night, fixed-per-person-
night and slab-percent modes; inclusive/exclusive display, line/document rounding and
explicit acyclic compounding are deterministic. India lodging bands are selected per
room-night transaction value rather than from stay average or caller-selected rates.

This first evaluator is intentionally positive-charge only. Half-up is the inherited
technical computation convention, document rounding is one exact total per tax code
without line allocation, and `slab_percent` is whole-band over the selected component.
Credit notes, progressive slabs, person-category derivation, rate-plan inclusion
precedence, tax-line allocation and India CGST/SGST/IGST decomposition require later
policy/authority orders before any posting or fiscal-document claim.

Order237 proof is green: focused `17/17`, adjacent `24/24` plus 18 expected
database skips, standing `788/788` plus 704 environment skips, typecheck, import
boundaries, licence, audit, JavaScript and diff checks. The result preserves mixed
room-night attribution, uses exact bigint inclusive arithmetic, compounds only from
visible rounded components under line rounding, rejects document-rounding compounding
without an allocation policy, and bounds hostile arithmetic work. Independent review
remains deferred; the next build slice is effective property/date jurisdiction
resolution without quote, posting or document authority.

## Order 238 boundary

Order238 resolves one caller-supplied property/date through active-tenant PostgreSQL
`tax_assignment` truth and the established runtime-visible extension adapter. It
requires one assignment and exactly one active visible global-or-tenant jurisdiction
version, binds exact content hash evidence, and returns a deeply frozen read-only
result. It invents no global/tenant precedence or extension-effective-time policy and
adds no migration, write, event, evaluator, quote, posting, document, provider, HTTP
or UI authority.

Order238 proof is green: the real-database focused suite passes `13/13`, adjacent
extension/rate/tax proof passes `17/17` plus 12 expected database skips, and the
standing suite passes `797/797` plus 708 environment skips. Exact `[)` assignment,
tenant/property isolation, unique active visible version binding, canonical frozen
content/hash evidence and zero writes are executable. Independent review remains
deferred; quote, posting, document and fiscal authority remain absent.

## Order 239 boundary

Order239 composes the two built tax primitives only into the canonical read-only live
rate quote. Exact room-only stays with one exact jurisdiction version may produce a
frozen tax preview bound into quote/offer evidence. Package/promotion attribution,
partial/mixed jurisdiction, more than 366 nights and inclusion-mode disagreement
produce no fabricated total. Folio/posting/document/fiscal integration remains later.

Order239 proof is green: the focused contract passes `7/7` with 33 assertions, fresh
isolated PostgreSQL quote proof passes `8/8` with 49 assertions including exact
before/after zero-write truth, and the standing suite passes `808/808` plus 708
environment skips. Typecheck, 89 import boundaries, 23 dependency licences,
zero-vulnerability audit, JavaScript syntax and diff hygiene are green. The schema is
unchanged and the disposable proof database was removed. Independent review remains
deferred; folio attribution, posting, document and fiscal authority remain absent.

## Order 240 boundary

Order240 adds the pure persistence-boundary value that Order239 deliberately lacked:
one canonical JSON-safe positive `rate_quote` attribution snapshot. It binds exact
quote, nightly assignment, jurisdiction-version and evaluator evidence with fully
reconciled decimal-string money and one deterministic snapshot hash. Hostile or
non-canonical values fail closed; the result is deeply frozen and performs no write.

This slice does not persist a quote, mutate a hold/reservation, post tax, change a
folio, compose a correction/transfer or issue a fiscal document. Those runtime steps
remain separately ordered after the immutable attribution contract exists.

Order240 proof is green: its focused contract passes `12/12` with 131 assertions;
the combined adjacent tax/quote proof passes `50/50` plus 11 expected database skips
with 260 assertions; and the standing suite passes `820/820` plus 708 environment
skips with 8,356 assertions across 1,528 tests/276 files. Typecheck, 90 import
boundaries, 23 dependency licences, zero-vulnerability audit, all four JavaScript
syntax checks and diff hygiene are green. Independent review remains deferred; no
persistence, booking acceptance, posting, document or fiscal authority is claimed.

## Order 244 boundary

Order244 is the first persistence slice. One exact parsed positive Order240 snapshot
may become an append-only `tax_attribution_snapshot` root through database-owner
authority, with same-hash convergence, tenant-scoped read, idempotent receipt and one
atomic minimized `tax.attribution_recorded` fact/outbox pair. Exact property and actor
binding provides recording context only; it is not quote, hold or booking authority.

This slice adds no reservation, segment, hold, occupancy, folio, journal, posting,
`tax_detail`, document, series or submission link or mutation. It chooses no tax
payable account or routing, negative correction allocation, India
CGST/SGST/IGST/place-of-supply meaning, document allocation or provider behavior. HTTP,
UI and local runtime promotion also remain absent. Independent Tier-3 review remains
deferred; the next production slice must authoritatively re-quote and bind persisted
evidence before posting or document work can consume it.

Order244 proof is now green after the inherited prerequisite repair: focused real
PostgreSQL persistence passes `6/6` with 49 assertions, standing proof passes
`822/822` plus 717 expected database skips, acceptance passes `8/8`, and the fresh
94-table/84-policy referee passes `11/11`. The append-only attribution root remains
unlinked to holds, reservations, postings, documents and fiscal submission.

## Order 245 prerequisite repair

Order245 changes no Phase-7 product meaning. Forward migration0039 adds explicit
`pg_temp`-last resolution only to the exact inherited seven-argument parking occupancy
recorder and two-argument release wrapper. Bodies, signatures, owners, ACLs and all
parking/occupancy behavior remain unchanged. The exact schema stays at 94 tables and
84 RLS policies; migration proof passes `36/36` with 160 assertions, acceptance
passes `8/8` with 18 assertions and the referee passes `11/11`. This closes the
Order244 executable gate without claiming independent approval or Phase completion.

## Order 248 built boundary

Order248 is the first authoritative booking-edge use of the persisted attribution
root. One internal command takes the same advisory lock as release publication,
normalizes and freshly resolves the complete quote input, and refuses any result that
is not exact-property, exact-sellable, live-bookable, quoted and fully tax-calculated.
Only that result may produce the canonical Order240 snapshot, existing cart hold,
Order244 record and one new append-only binding in the same tenant transaction.

The binding and minimized `tax.attribution_bound` fact/outbox evidence survive later
hold expiry or release as audit history. They do not consume the hold, accept a
reservation, guarantee price, mutate a folio/journal/posting/tax detail, issue a
document or authorize fiscal submission. HTTP, UI and local runtime promotion remain
separate work. Independent Tier-3 product review remains deferred under the founder's
build-first direction.

Order248 is built-unreviewed under D-646. Fresh PostgreSQL proof reaches migration40,
95 tables and 85 policies; focused P0-P6 is 8/8, the native referee is 11/11, and the
824-test standing suite is green. This records executable booking-edge evidence only;
posting, fiscal documents/IRP and Phase7 completion remain pending.

Order249 is built-unreviewed under D-648 as the status-only boundary through built Order248/current Order249. It may
change only authenticated founder snapshot values and their exact proof; review91,
unfinished phase states and pending posting/fiscal/review truth remain unchanged.

## Order 251 boundary

Order251 derives only a pure canonical positive posting plan from exact Order240
evidence: guest debit, room-revenue credit and ordered tax-code credits must sum to
zero under D-323. Document rounding and India aggregate GST remain explicit unresolved
policy blockers. No account route, financial mutation, document or fiscal authority is
admitted.

Order251 is built-unreviewed under D-652 with focused8/8, adjacent31/31, standing
832/832 and fresh referee11/11 green. It adds no database, account route or write
authority; independent Tier-3 product review remains deferred.
# Latest approved build slice

Order252/D-656 adds the independently approved immutable, same-transaction lineage from an Order248
quoted-tax hold binding to the exact reservation and first segment created when that
hold is consumed. It deliberately stops before folio selection, tax routing, posting,
document allocation and India place-of-supply policy.

Order253/D-657 refreshes only the authenticated founder-visible build snapshot through
that approved lineage. It does not change Phase7 product behavior or local runtime.

Order254/D-661 independently approves the forward-only migration-lineage reconciliation prerequisite for
promoting that snapshot: historical0041 bytes become exact to the applied ledger and
the final compatibility correction moves to migration0042.

## Order 256 boundary

Order256 adds the exact read/lock/recheck bridge from approved quoted-tax reservation
lineage and canonical stored snapshot to the reservation's open primary window and
coherent open guest account. It uses the existing bounded owner-mediated financial
lock, revalidates after lock acquisition and returns deeply frozen internal evidence.
It creates no folio or financial/fiscal artifact and selects no transaction code or
configured revenue/tax account. Independent Tier-3 review under D-666 reproduced the
focused, acceptance, referee and static gates with no product finding. The next product
dependency is configured semantic tax routing before any positive posting writer.

Order257/D-668 refreshes only authenticated recorded founder truth to
date2026-08-29/latest256/current257/review91/active7 and the compact Orders237–256
milestone. Exact sole-local promotion remains a separate reversible order.

## Order 259 boundary

Order259 adds a read-only tenant/RLS-scoped semantic route root and composes approved
Order256 eligibility with the pure Order251 plan. An exact stored jurisdiction
identity may resolve only explicitly configured room-revenue and canonical nonzero-tax
transaction-code credit routes backed by coherent open exact-property/currency
accounts. Policy-blocked plans perform no route lookup; names, role hints, generic tax
codes and code coincidence never become fallback authority.

The slice writes no journal, posting, tax detail, evidence, document or fiscal state
and invents no guest-debit code, effective-date policy, India decomposition or
document allocation. Fresh PostgreSQL16.15 proof reaches migration43/97 tables/87
policies; focused9/9, acceptance11/11, migration38/38, schema drift4/4, referee11/11,
standing837/837 plus755 environment skips and all static gates are green. Independent
Tier-3 review under D-673 personally reproduced the focused, adjacent, database,
schema, referee and static proof with no finding. The next product boundary is a
governed non-India, line-rounded positive posting writer; India/document allocation
and taxed correction semantics remain explicit later policy work.

Order260/D-674 is the status-only bridge from approved Order259 to a future guarded
sole-local promotion. It records latest259/current260/review91/active7 and the compact
Orders237–259 milestone without changing product, database, runtime, review coverage
or phase state.

Order260 is built-unreviewed under D-675 with focused5/5 plus two expected database
skips, standing837/837 plus755 environment skips and all static gates green. Exact
sole-local schema/app promotion remains a separate reversible order.

## Order 270 built boundary

Order270 restores repository migration0044 byte-for-byte to its exact retained
applied identity and moves only the later two posting-ordinal joins into forward-only
migration0046. Fresh1–46 reaches46 migrations/98 tables/88 policies with strict schema
and referee11/11; the migration runner proves historical1–44 binary ledger bytes,
including applied timestamps, survive45/46 and the next run is a no-op. An isolated
restore of the retained Order267 archive also preserves every historical ledger byte
and every product-table row count while reaching46/98/88. Standing848/0 and all static
gates are green. A fresh non-implementing Tier-3 reviewer reproduced the complete
proof and approved exact commit6547862 at D705. Stable3000 was untouched; a separately
ordered guarded local promotion is next.

## Order 272 boundary

Order272/D-711 independently approves the exact configured India GST supplier-registration evidence
that the existing India posting blocker lacks. One tenant/property root binds scheme
`in-gstin` and INR supplier identity to the already-frozen jurisdiction extension
id/owner/key/version/content hash. A read-only resolver reuses positive-tax eligibility
and returns canonical GSTIN/state/legal-name/address/locality/pincode plus a stable
evidence hash, or fails closed without writes. It does not decide place of supply,
CGST/SGST/IGST decomposition, document allocation or IRP payloads; those remain later
separately governed slices. Fresh PostgreSQL proof is47 migrations/99 tables/89
policies/referee11/11 under fresh Tier-3 execution.

## Order 273 boundary

Order273/D-713 is a built-unreviewed recorded-status-only bridge through independently approved Order272.
It may advance exact authenticated snapshot truth to latest272/current273 and the
compact Orders237–272 milestone while preserving review91, the phase vector, every
unfinished India/document/IRP dependency and the aggregate built-unverified state.
Product, database, runtime and sole-local promotion are outside this order.

## Order 274 local boundary

Order274/D-716 independently approves migration47 and exact Order273 status on the retained sole
local after a restricted backup and recoverable app capture. Final truth is47/99/89,
two unchanged hotels and exact272/273/review91/active7 on healthy loopback3000.
Fresh non-operating Tier-3 verification reproduced the complete read-only proof with
no finding.

## Order 275 boundary

Order275 projects only approved Order272 supplier-registration evidence into exact
notified IRP1.1 `SellerDtls`
(`Gstin`,`LglNm`,`TrdNm?`,`Addr1`,`Loc`,`Pin`,`Stcd`). Exact GSTIN, length,
current-state and six-digit nonzero PIN validation; null-only trade-name omission;
fixed-order JSON/SHA-256; separately retained registration/evidence lineage; source
immutability and recursive freeze all fail closed without trimming, truncation,
splitting, coercion or synthesis. It creates no document, database, provider,
submission, API, HTTP or UI authority and decides no buyer, place of supply, supply
type, tax decomposition, item or value. Fresh independent Tier-3 execution approves
the exact immutable candidate under D-719 with no finding; no Phase7 completion is
claimed.

## Order 276 boundary

Order276 adds one typed tenant/RLS Party GST-registration root and an exact read-only
registration-id resolver. The Natural-Solution Test rejects mutable Party profile,
address and role truth as statutory evidence while preserving Party as the sole person/
organisation primitive. The result is registered-recipient candidate evidence only;
invoice-window buyer designation, `BuyerDtls`, place of supply, supply type, India tax
decomposition, documents and submission remain separate future authority. Fresh
PostgreSQL proof is green at exact48 migrations/100 tables/90 policies with
standalone referee11/11. Independent Tier-3 review found no product defect but the
canonical setup gate remains red on its stale 99-table/migrations1–47 oracle. A
separate bounded correction and fresh complete execution are mandatory.
Independent execution at D-725 subsequently approves the corrected exact descendant
with no remaining finding.

## Order 277 boundary

Order277 changes only `setup.sh`'s exact public-table oracle and adjacent message from
99 after migrations1–47 to committed truth100 after migrations1–48. Setup sequencing,
migrations, schema, tests, referee, product, runtime and local stay byte-unchanged.
Fresh isolated canonical setup exits0 at48 migrations/100 tables/referee11/11 and all
standing/static gates are green. Fresh independent Tier-3 execution at D-725 approves
the repair and corrected Order276 descendant with no remaining finding.

## Order 278 boundary

Order278 projects only the exact approved Order276 registered-recipient evidence
into fixed-order notified `BuyerDtls` identity/address fields with isolated Party/
registration/evidence lineage, deterministic JSON/hash and recursive freeze. The
officially separate `Pos` attribute, legal folio-window buyer designation, supply type,
tax decomposition, documents and submission remain later authority. Intentional red0/1
preceded focused/adjacent22/0+10
database-only skips and standing879/0+798 database-only skips; all static gates are
green. Fresh independent Tier-3 execution approves exact commit e31b71e under D-728
with no finding.

## Order 279 boundary

Order279 may only read one exact tenant/property folio-account-reservation anchor,
compose the explicitly selected approved Order276 registration and approved Order278
BuyerDtls bytes, and return deterministic frozen candidate-association evidence.
Account Party, reservation primary/booker Party, guest role, window name and folio
number cannot substitute for explicit selection. Status and currency are evidence only.
No persistence, legal designation, `Pos`, supply type, tax, document, submission, API,
UI or local authority is admitted. Intentional red0/1, corrected fresh-PostgreSQL
focused/adjacent33/0, exact48/100/90/referee11/11, standing884/0+805 skips and all
static gates are green. Fresh independent Tier-3 execution approves exact commit
6ae170f under D-731 with no finding.

## Order 280 boundary

Order280 may add only one tenant-leading/RLS/SELECT-only property fiscal-location root
with canonical IN state/address/locality/PIN evidence and one exact deterministic
read-only resolver. Supplier/recipient registrations, org-node config/name/path,
spaces, profiles, unit types and tax codes cannot substitute. The result is future
place-of-supply evidence only: no `Pos`, supply type, service classification,
decomposition, reservation/folio association, document, submission, API, UI or local
authority. Fresh PostgreSQL/referee and independent Tier-3 execution are mandatory.
Intentional red0/1 preceded focused12/0, database acceptance14/0, runtime-DML5/0,
migration39/0, exact49/101/91/referee11/11 and standing889/0+815 environment skips;
all static gates are green and the sole stable local remains unchanged. Fresh
independent Tier-3 execution reproduced the complete proof under D-734 with no finding.

## Order 281 boundary

Order281 may add only one tenant-leading/RLS/SELECT-only accommodation-classification
assignment with exact frozen-jurisdiction lineage and one deterministic read-only
resolver. The allowed launch evidence is `SAC` plus service flag `Y` and exactly
`996311`, `996312`, `996313`, `996321`, `996322`, `996329`. `room_revenue`,
`GST_ROOM`, USALI, transaction codes, semantic routes, rate plans, profiles, spaces,
unit types and org display truth cannot infer classification. The result is a future
IRP item prerequisite only: no `ItemList`, `Pos`, `SupTyp`, tax/decomposition,
seller/buyer/folio composition, document, submission, API, UI, writer or local
authority. Fresh PostgreSQL/referee proof and independent Tier-3 execution are
mandatory under D-735.
Intentional red0/1 preceded focused12/0, adjacent28/0, acceptance15/0,
runtime-DML5/0, migration39/0, exact50/102/92/schema/referee11/11 and standing894/0
plus 825 database-only skips. All static gates are green and the stable local remains
unchanged. Fresh non-implementing Tier-3 execution independently reproduced the full
proof under D-737 with no finding. This approval grants no later item, tax, document,
submission, local-promotion, Phase-7-complete or application-complete authority.

## Order 282 boundary

Order282 may compose only exact approved seller registration, explicit folio/buyer
association, physical-property fiscal location and accommodation classification into a
read-only lodging place-of-supply candidate. IGST Act section12(3)(b) makes the
immovable property's state the only admitted `pos`; supplier/recipient/guest/account/
org/profile/config state cannot substitute. Exact tenant, property, reservation,
folio, INR, frozen jurisdiction, Party/registration and classification lineage must
agree and the result is fixed-order, deeply frozen and tenant-hashed. No schema,
writer, intra/inter-state conclusion, decomposition, `SupTyp`, `ItemList`, item value,
document, submission, API, UI or local authority is admitted. Exact composition,
canonical referee and fresh non-implementing Tier-3 execution are mandatory under
D-738.
Intentional red0/1 preceded focused12/0, adjacent roots42/0 plus eligibility6/0,
acceptance15/0, runtime-DML5/0, migration39/0, exact50/102/92/schema/referee11/11 and
standing905/0 plus828 database-only skips. All static gates are green and the stable
local is unchanged. Fresh non-implementing Tier-3 execution at D-740 independently
reproduced the full proof with no finding and approved exact candidate `4047684`.
This approval grants no intra/inter-state, decomposition, `SupTyp`, item, document,
submission, local-promotion, Phase-7-complete or application-complete authority.

## Order 283 boundary

Order283 may purely compare only approved Order272 property-bound supplier-registration
`stateCode` with approved Order282 property-derived `pos`, after independently
revalidating the complete frozen shapes and tenant-bound hashes. It returns exact
`same_state_or_union_territory` or `different_state_or_union_territory` evidence,
fixed-order JSON and tenant-bound SHA-256 with no SQL, lock or write. This comparison
is not legal supply nature: IGST sections7(5)(b)/8(2) and CBIC Circular48/22/2018 make
SEZ accommodation inter-State even when ordinary codes match, and current evidence
does not model that exception. Recipient state is irrelevant. No intra/inter-state,
SEZ, `SupTyp`, `IgstOnIntra`, levy component/rate/amount, rounding, item, document,
submission, API, UI or local authority is admitted. D-741 requires intentional red,
exhaustive36×36 hostile proof, unchanged schema/referee and fresh Tier-3 execution.
The implementation is built under D-742: intentional red0/1 preceded focused12/0
(4,187 expectations), four approved-root suites50/0, Order28212/0, SellerDtls9/0,
eligibility7/0, acceptance15/0, runtime-DML5/0, migration39/0, exact50 migrations/
102 tables/92 RLS-enabled tenant tables/92 policies/2 FORCE-RLS tables/schema/
referee11/11 and standing916/0 plus831 database-only skips. Type/106-boundary/
23-licence/audit0/diff are green; disposable proof is absent and the sole local is
healthy and unchanged. Fresh non-implementing Tier-3 review remains mandatory.
Fresh Tier-3 execution at exact `1cea37f` found no product/legal/containment defect but
returned CHANGES REQUIRED under D-743 because current records call all 92
RLS-enabled tables FORCE-RLS. The corrected descendant must record exact 92
RLS-enabled tables, 92 policies and 2 FORCE-RLS tables before fresh review.
That exact mutable wording is corrected under D-744 without changing product, test,
schema or runtime bytes. The corrected descendant is built-pending-review and fresh
independent approval remains mandatory.
Fresh non-implementing Tier-3 review approves exact corrected candidate `2b4d2d8`
with no finding under D-745. Reviewer-personal official-law, ancestry, byte-identity,
exact50/102/92/92/2 catalogue, schema/referee11/11, focused/adjacent/database/
standing/static/scope and stable-runtime proof are green; disposable proof is absent.
The approval remains bounded to exact registered-state/property-Pos relationship
evidence and grants no supplier-location, intra/inter-State, SEZ, levy, item,
document, submission, local, merge, deploy, Phase-7 or application completion.

## Order 284 boundary

Order284 adds one explicit tenant/RLS/SELECT-only IGST section2(15)(a) assignment
bound to the exact current Order272 registration id and evidence hash, plus an exact
read-only resolver for principal/additional registered-place evidence. All returned
state/address bytes come only from revalidated Order272; the assignment supplies
only explicit supply-from/place-kind/legal-basis truth. It must fail closed for stale
or absent evidence and must not infer from GSTIN, physical property, org/config or
Order283 equality. Section2(15)(b–d), SEZ, supply nature, levy, `SupTyp`, item,
document, API/UI/local authority remain forbidden. D-746 requires intentional red,
exact51/103/93/93/3 PostgreSQL/schema/referee, hostile zero-write proof and fresh
non-implementing Tier-3 execution.
The candidate is built under D-747: intentional red0/1 preceded focused18/0(238),
migration39/0(187), acceptance16/0, runtime-DML5/0, exact51/103/93/93/3 normalized
schema/referee11/11 and standing927/0 plus841 skips. Type/107-boundary/23-licence/
audit0/diff are green; disposable proof is absent and the sole stable local remains
exact, healthy and unchanged. Fresh non-implementing Tier-3 review is mandatory.

## Order 293 boundary

Order293/D-777 is ready as a pure composer over approved Order290 service-provision
and Order292 invoice-issue evidence plus affirmative governed ordinary-Rule47
evidence. It returns only timely/late evidence using the fixed inclusive 30-calendar-
day boundary; every exception regime fails closed. No migration, writer, regime
inference, invoice validity/issuance, section13 result, tax/document/API/UI/local
authority. Hostile pure proof and fresh Tier3 review remain mandatory. D-778 builder
proof is intentional red0/1(1) before implementation, focused including intentional
11/0(124), adjacent40/0+3 skips(834), unchanged setup58/110/100/100/referee11/11,
standing1009/0+871 skips(15573;1880 tests/330 files), type/boundaries116,
licences23, audit0 and diff clean; no migration/schema change. Disposable setup
resources were removed and stable local remains stopped by founder authorization.
Independent review of candidate `95e43a5` under D-779 is CHANGES REQUIRED for Date.UTC
low-year/overflow arithmetic and incomplete Order290/292 invoice identity/evidence
rehash binding. D-780 records refreshed REPAIRED-PENDING-REREVIEW proof: focused
including intentional15/0(146), adjacent44/0+3 skips(856), unchanged setup
58/110/100/100/referee11/11, standing1013/0+871 skips(15595;1884 tests/330
files), typecheck/boundaries116/licences23/audit0/diff green. Repair uses explicit
proleptic-Gregorian no-Date arithmetic with low-year/leap/century/month/year
regressions and overflow fail-closed, plus complete invoice series/serial and
invoice/service evidence hash binding in result/hash. No migration/schema change;
fresh Tier3 re-review remains pending and no approval is claimed.

## Order 289 boundary

Order289 adds one exact tenant-leading forced-RLS SELECT-only source root for active
GST Portal registration status/taxpayer type of the exact Order272 supplier
registration reached through complete Order284 lineage at one explicit evidence
date. That date grants no statutory time-of-supply applicability. Historical Form-G/
Form-F2 approval remains separate; no live lookup, latest/clock inference, effective
renewed status, supply-nature V2, zero rating, levy, document/API/UI/local authority
is admitted. D-765 requires intentional red, exact55/107/97/97/7 schema/setup/
referee, hostile zero-write proof and fresh Tier-3.
The D-766 candidate is built: intentional red `0/1` preceded focused `10/0` (`225`),
acceptance `20/0` (`58`), runtime-DML `5/0` (`114`), migration `39/0` (`187`), exact
`55/107/97/97/7` normalized schema/setup/referee `11/11`, standing `976/0` plus
`865` skips and all static gates. The stable port-3000 local is unchanged. Fresh
non-implementing Tier-3 review remains mandatory.
Fresh non-implementing Tier-3 review approves exact candidate `35ad434` with no
finding under D-767. Reviewer-personal official-law, focused/database/migration/
schema/referee, adjacent/standing/static and stable-local preservation proof are
green. Approval remains bounded to exact-date affirmative supplier GST registration
status/type evidence.

## Order 290 boundary

Order290 adds one exact tenant-leading forced-RLS SELECT-only service-provision-date
source root bound to complete approved Order252 reservation lineage and canonical
Order240 `rate_quote` room/room-revenue attribution. The date is separately governed
external evidence and only a later CGST section13 input. D-768 explicitly forbids
deriving it from Order287 supply date, quote room-night business dates, reservation
period, check-in/occupancy/checkout, journal/posting dates or clocks and admits no
invoice/payment/time-of-supply result, Order289 composition, tax/document/API/UI/local
authority. Intentional red, exact56/108/98/98/8 schema/setup/referee and hostile
non-substitution/zero-write proof are green under D-769. Fresh Tier3 approves exact
candidate `4476cc5` with no finding under D-770.

## Order 291 boundary

Order291 is approved under D-773 as one exact tenant-leading forced-RLS SELECT-only full-attribution
payment-receipt source root bound to complete approved Order290→252→240 service,
reservation and canonical room-revenue attribution truth. It preserves the supplier-
books entry date, supplier-bank credit date and their statutory earlier date only.
D-771 forbids substitution from existing payment/operation/provider-receipt/journal/
document/folio/reservation/operational timestamps or clocks, admits no partial/cash/
refund allocation and grants no invoice/timeliness/time-of-supply, tax, document,
API/UI/local authority. Exact `57/109/99/99/9` schema/setup/referee, hostile
non-substitution/zero-write proof and fresh Tier3 are green. Fresh non-implementing
Tier-3 review approves exact candidate `10e9adf` with no finding under D-773.
Reviewer-personal official-law, database, seeded resolver, schema/setup/referee,
standing/static and stable-runtime proof are green; approval remains limited to
full-attribution payment-receipt evidence and grants no downstream authority.

## Order 292 boundary

Order292/D-774 is ready after approved Order291: an exact tenant-leading forced-RLS
SELECT-only full-attribution invoice-issue-date evidence root bound to complete
Order290→252→240 truth. It preserves only external invoice series/serial and issue
date for later Rule47 and section13 composition. No invoice writer, rendering,
validity/numbering/timeliness decision, IRP, document, API/UI/local or application-
complete authority is admitted; exact `58/110/100/100/10` setup/referee and fresh
Tier3 review remain mandatory. D-775 records builder proof: intentional red0/1(1),
focused7/0(78), acceptance23/0(65), runtime-DML5/0(117), migration39/0(187),
exact58/110/100/100/10 schema/setup/referee11/11, standing998/0 plus871 skips
(15449;1869 tests/328 files), type/115-boundary/23-licence/diff green, schema SHA
`227cba82339bc69d9c9263b854ea7954dc82a0dc16e19ca852304dc0d2eab19d`. Independent
review approves exact candidate `cc7d44b` with no product finding under D-776. Approval
remains limited to invoice identity/issue-date evidence; the reviewer-recorded duplicate
three-line BUILD-PLAN paragraph was removed as nonblocking documentation cleanup.

## Order 286 boundary

Order286 adds one explicit tenant/RLS/SELECT-only supplier status root bound to the
exact current Order272 registration/hash reached through approved Order284 service-
location evidence. It admits only affirmative active regular, SEZ-unit/Form-G or
SEZ-developer/Form-B-or-C evidence at an explicit as-of date; absence remains
unresolved. Form-F2 renewal evidence, bilateral supply nature, authorized operations/
zero rating, levy, `SupTyp`, item, document, API/UI/local authority remain separate.
D-752 requires intentional red, exact53/105/95/95/5 PostgreSQL/schema/referee,
hostile zero-write proof and fresh Tier-3.
The D-753 candidate is built: intentional red0/1 preceded focused16/0(317), migration
39/0(187), acceptance18/0(52), runtime-DML5/0(112), exact53/105/95/95/5 normalized
schema, canonical setup/referee11/11 and standing945/0 plus861 skips. Type/109-
boundary/23-licence/audit0/diff are green; disposable proof is absent and the sole
stable local remains exact, healthy and unchanged. Fresh non-implementing Tier-3
review is mandatory.
Fresh non-implementing Tier-3 review approves exact candidate `03d68cc` with no
finding under D-754. Reviewer-personal official-law/Form-F2 boundary, exact
53/105/95/95/5, schema/setup/referee11/11, focused/database/standing/static and
stable-runtime proof are green; disposable proof is absent. Approval grants only
affirmative supplier registration/SEZ-status evidence and no downstream authority.

## Order 287 boundary

Order287 is one pure composer over complete approved Orders283–286. Both affirmative
SEZ-status dates must equal one explicit property-local supply date. Any unit/
developer on either side invokes the section7(5)(b) inter-State override; only
regular/regular reaches ordinary section7(3)/8(2) same/different-state comparison.
It returns deterministic frozen supply-nature evidence only. Schema/write, Form-F2,
authorized operations/zero rating, levy/decomposition, `SupTyp`, item, document,
API/UI/local authority remain separate. D-755 requires intentional red, exhaustive
18-way hostile proof, unchanged exact53/105/95/95/5 schema/referee and fresh Tier-3.
The D-757 candidate is built: intentional red0/1 preceded focused12/0(398), exhaustive
18-way statutory precedence, hostile lineage/date/shape/hash and zero-effect proof;
standing957/0 plus861 skips(14,668 assertions;1,818 tests/318 files), type/110-
boundary/23-licence/audit0/diff are green. Approved-base exact53/105/95/95/5
schema/referee remains unchanged because no schema/runtime/dependency artifact
changed. Fresh non-implementing Tier-3 review is mandatory.
Fresh non-implementing Tier-3 review approves exact candidate `4f25f8e` with no
finding under D-758. Reviewer-personal official-law, exhaustive18-way, adjacent,
standing/static, approved-base schema/referee and stable-local proof are green.
Approval grants only the pure supply-nature evidence and no downstream authority.

## Order 288 boundary

Order288 adds one exact tenant-leading forced-RLS SELECT-only source root for the
first directly contiguous Form-G-to-issued-Form-F2 SEZ-unit LoA renewal. It accepts
the official five-year or shorter period exactly as issued, resolves only one
explicit id/date through complete approved Order286 lineage, and returns frozen
continuity evidence. Form-F1, second/later renewal chains, AO/specified-officer/BLUT,
GST-current-status substitution, zero rating, levy, document/API/UI/local authority
remain separate. D-759 requires intentional red, exact54/106/96/96/6 schema/referee,
hostile zero-write proof and fresh Tier-3.
The D-763 candidate is built: intentional red0/1 preceded isolated focused10/0(227),
migration39/0, acceptance19/0, runtime-DML5/0, exact54/106/96/96/6 schema/setup/
referee11/11 and standing967/0 plus863 skips. Type/111-boundary/23-licence/audit0/
diff are green; disposable proof is removed and sole stable local unchanged. Fresh
non-implementing Tier-3 review is mandatory.
Fresh non-implementing Tier-3 review approves exact candidate `d65c236` with no
finding under D-764. Reviewer-personal official-law, database/schema/setup/referee,
adjacent/standing/static and stable-preservation proof are green. Approval remains
bounded to first directly contiguous Form-F2 continuity.
Fresh non-implementing Tier-3 review approves exact candidate `9c222c4` with no
finding under D-748. Reviewer-personal official-law, no-inference, exact
51/103/93/93/3, schema/setup/referee11/11, focused/database/standing/static and
stable-runtime proof are green; disposable proof is absent. Approval remains bounded
to section2(15)(a) evidence and grants no downstream authority.

## Order 285 boundary

Order285 adds one explicit tenant/RLS/SELECT-only status root bound to exact current
Order276 recipient registration/hash. It admits only affirmative official active
regular, SEZ-unit/Form-G or SEZ-developer/Form-B-or-C evidence at an explicit as-of
date; absence, stale or unsupported truth remains unresolved. Supplier-side SEZ,
authorized operations/zero rating, supply nature, levy, `SupTyp`, item, document,
API/UI/local authority remain separate. D-749 requires intentional red, exact
52/104/94/94/4 PostgreSQL/schema/referee, hostile zero-write proof and fresh Tier-3.
The D-750 candidate is built: intentional red0/1 preceded focused16/0(301), migration
39/0(182), acceptance17/0(49), runtime-DML5/0(111), exact52/104/94/94/4 normalized
schema/referee11/11 and standing936/0 plus851 skips. Type/108-boundary/23-licence/
audit0/diff are green; disposable proof is absent and the sole stable local remains
exact, healthy and unchanged. Fresh non-implementing Tier-3 review is mandatory.
# Order294 slice

Compose approved Order290 service-provision, Order291 payment-receipt and Order292
invoice-issue evidence through Order293 timeliness into ordinary section 13(2)(a)/(b)
time-of-supply evidence. No tax, document, posting, submission, or write authority.

## Order295 registration-at-time-of-supply evidence

Consume the approved Order289 active supplier registration snapshot and the
complete approved Order294 ordinary accommodation chain in one equality-bound
SELECT. Accept only exact status/time date equality and affirmative active status;
require supplied Order289 and Order294 evidence hashes to equal complete recomputed
predecessor envelopes;
no effective interval, rate, levy, tax, document, posting, IRP or API authority is
produced. Hostile, duplicate, stale, malformed and cross-lineage evidence must
fail closed and the result must be recursively frozen and tenant-hidden.

## Order 296 boundary

Order296 is the recipient-side exact-date companion to Order295. It composes complete
approved Order285 recipient registration/status and Order294 time-of-supply evidence
in one migration-free SELECT, requires exact status/date and complete-hash equality,
and returns only frozen tenant/GSTIN/address-hidden affirmative evidence. Buyer/B2B,
place-of-supply, supply-nature, `SupTyp`, `Pos`, `IgstOnIntra`, rate, levy, tax,
document, IRP, API/UI/local and phase-complete authority remain separate. D-798
requires intentional red, hostile/live PG16.15 zero-write proof, setup/referee and a
fresh Tier-3 review.

## Order 297 boundary

Order297 is the pure composition boundary that binds complete approved Order287
supply-nature evidence to Order295 supplier-active-at-time and Order296
recipient-active-at-time evidence. Every predecessor envelope and tenant hash is
recomputed; all transaction, registration, service-location, lineage and exact-date
identities must agree. The frozen, tenant-hidden result grants no new buyer, place of
supply, levy, rate, tax, document, IRP, database, API/UI or local authority. D-801
requires intentional red, exhaustive hostile zero-effect proof, unchanged setup and
referee gates, and fresh independent Tier-3 review.

## Order 298 boundary

Order298 corrects only the explicit 2026 ordinary India accommodation rate content:
12% through INR7,500 value of supply per unit/day and 18% above, replacing the
D-791-quarantined launch nil/5/18 fixture. Existing extension effective periods,
assignment resolution and the typed evaluator remain unchanged; there is no
migration, section14, SEZ zero-rating, decomposition, document/IRP/API/UI/local
authority. D-810 requires exact boundaries and fresh Tier3 statutory review.

## Order 299 boundary

Order299 exposes only the exact lower/upper instant bounds of one already-selected
tenant-visible extension id through a narrow yellow-runtime-only projection and binds
them into immutable tax-jurisdiction evidence. It does not interpret a property date
as an instant or determine extension applicability, and adds no rate calculation,
section14, decomposition, posting, document, IRP, API/UI or local authority. D-817
requires role/tenant/temp-shadow hostile proof, fresh setup/referee and fresh Tier3.
