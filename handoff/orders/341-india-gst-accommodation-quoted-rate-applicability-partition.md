# Order 341 — India GST accommodation quoted rate-applicability partition

**Status:** REVIEW-WITHHELD-PROOF-SENSITIVITY-D963
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-accommodation-quoted-rate-applicability-partition`
**Base:** `a31d3cd` (approved Order340 governance head)
**Risk tier:** 3 — statutory rate applicability; fresh independent executable review mandatory

## Outcome

Compose the approved Order340 CGST Act section14 selected rate-version identity with
the approved Order337 numeric component-decomposition rule and the persisted positive
Order240/Order252 room-revenue lineage. Return one immutable, tenant-hidden,
per-attributed-room-night **quoted rate-applicability partition**.

This is the first non-duplicative consumer of both Order340 and Order337. It selects
the applicable `GST_ROOM` slab and its ordered component rates for every pre-existing
positive room-night quoted amount. It does not determine a final taxable value, issue
or calculate a tax invoice, or calculate tax money.

## Authority and boundary

- CGST Act section14 determines the selected predecessor or successor rate version
  when a rate changes; Order340 is the sole authority consumed for that conclusion.
- CBIC's current GST services-rate table applies the accommodation threshold to the
  value of supply of **a unit of accommodation per day or equivalent**, not an
  aggregate stay average. This order therefore evaluates each already-recorded,
  ordered room-night component independently and never selects a band from the stay
  total or average.
- The Order240 snapshot is positive `rate_quote` attribution evidence. Its amounts
  are deliberately named `quotedAmountMinor` in this order: they are not asserted to
  be the CGST Act section15 final transaction value or an issued-document taxable
  value. A later separately governed final-value bridge remains required.
- This order neither decides whether a multi-night stay is one or multiple statutory
  supplies nor replaces Order290's externally governed service-provision evidence.
  It partitions only the immutable room-night components that already exist in the
  admitted snapshot.

## Exact contract

- Expose one transaction-read-only resolver through the tax-fiscal boundary. It
  accepts only an exact plain, deeply frozen, accessor/proxy/symbol-free input
  containing the complete Order340 input/result graph, the complete Order310
  component-identity input/result graph, and the exact persisted Order252 reservation-lineage and
  Order244 attribution-record identifiers. Supplied tenant identity is equality-bound,
  while runtime tenant authority comes only from transaction-local context.
- In the same tenant transaction, re-read the persisted Order244 record and rederive
  its canonical Order240 snapshot/hash and Order252 first-segment reservation lineage;
  caller snapshot content, money, tenant, version or component values are never
  authority.
- Re-run Order340 and require byte-exact equality with its supplied, recursively
  frozen result. Re-run Order310 through its complete approved ancestry and require
  byte-exact equality with its supplied result. Order310 supplies only the exact
  component family, ordered component identities and shared rate-version-pair
  ancestry; its historical supply-date-selected member is not Section14 authority.
- Equality-bind tenant, property, reservation, folio, attribution/snapshot identity,
  full quoted amount, currency, jurisdiction identity, component family and all
  required predecessor identities. The exact Order304 pair inside Order310 ancestry
  must byte-match the pair replayed by Order340. Select only the pair member named by
  Order340's `selectedVersionSide`, then equality-bind its id, version, status,
  content hash, effective bounds, GST_ROOM slabs and official-source identity to the
  Order340 result. A matching public hash alone is not provenance.
- Reuse one shared pure numeric scheduler extracted from Order337 without changing
  Order337's public input/output bytes: IGST preserves each selected aggregate slab
  as its sole component; CGST+SGST and CGST+UTGST divide every selected aggregate
  basis-point rate into exact ordered equal halves. Odd/non-integral, unequal,
  reordered or duplicated component schedules fail closed. No second numeric policy
  may be implemented in this composer.
- Reparse the exact positive Order240 snapshot and use only its existing ordered
  `room_revenue` room-night components. Their canonical amount total must reconcile
  exactly to the persisted full attribution; each component must be a positive INR
  minor-unit amount with one unique ordinal and business-date assignment.
- For each component independently, select exactly one `GST_ROOM` slab from the
  selected pair member using the shared Order337 scheduler. Preserve its exact
  lower/upper bound, ITC condition, aggregate basis points and the ordered numeric
  component rates `[igst]`, `[cgst,sgst]`, or `[cgst,utgst]`. Missing, overlapping,
  gapped, duplicate, non-positive, non-INR or non-matching components fail closed.
- Return only a fixed-order, recursively frozen, tenant-hidden partition: selected
  Order340 case/time-of-supply/version identity; snapshot and reservation lineage;
  ordered component ordinal/business-date/`quotedAmountMinor`; selected slab evidence;
  ordered levy identities/rates; complete predecessor hashes; and a deterministic
  tenant-bound final hash. It returns no tax-component amount, tax total, grand total,
  rounding result, payable amount or document field.

## Scope

- this order, bounded Phase-7 plan/roadmap/decision/ledger/review evidence;
- one transaction-read-only tax-fiscal resolver and exact context exports;
- a bounded extraction of Order337's existing pure equal-split scheduler, preserving
  Order337's approved public contract and byte output;
- focused intentional-red, transaction-read, hostile and mutation-sensitive proof;
- bounded contract/domain/security/QA documentation needed to state this exact
  quoted-applicability boundary;
- fresh non-implementing Tier-3 executable review evidence.

## Forbidden boundary

No migration, schema, table, RLS, grant, seed, writer, persistence change, event,
outbox, network, clock, latest/nearest selection, API, UI or local operation.

No recharacterisation or allocation of a stay, service or accommodation unit; no
new room-night, package, promotion, discount, fee, cancellation, refund, transfer,
adjustment or correction semantics. No use of a stay total, average, current rate,
room-night business date, historical resolver or caller rate to override Order340's
selected version.

No final taxable-value conclusion under CGST Act section15; no tax amount, component
amount, tax total, rounding, residual/document allocation, payable calculation,
journal, posting, account routing, correction, fiscal document, document series/hash
chain, `ItemList`, IRP payload/submission, provider, merge, deploy, Phase or
application-complete claim.

## Pre-registered proof

- **P0 intentional red:** the resolver/export and quoted partition are absent before
  production.
- **P1 per-room-night applicability:** exact predecessor 12%/18% and successor 5%/18%
  schedules select their proper lower/upper slab for each individual positive quoted
  room-night value at and around INR 7,500. A mixed-value stay proves no stay-total or
  stay-average selection is used.
- **P2 selected-version precedence:** the Order340-selected predecessor/successor
  version, including both directions of its section14 earlier-of cases, is the only
  rate-version authority. A room-night business date on the opposite side of the
  2025-09-22 cutover cannot override it.
- **P2a opposite-side correctness:** Section14 case 1 selects successor 5% even when
  the historical supply-date member is predecessor 12%; case 5 selects predecessor
  12% even when the historical member is successor 5%. Restoring direct version
  equality must fail this proof.
- **P2b shared numeric rule:** all four coincident-side cases byte-match Order337's
  schedule; both 18% upper bands and all three component families retain exact
  identity/order. Unequal 599+601 and 899+901 half-split mutants fail.
- **P3 component integrity:** IGST remains one aggregate component; CGST+SGST and
  CGST+UTGST retain exact ordered equal halves. Historical 12%/18% and successor
  5%/18% values, slab bounds and ITC semantics are exact.
- **P4 complete lineage:** independent fully rehashed mutations of Order340 selected
  side/case/version/source, Order304 pair member schedule/content/source, Order310
  component family/identity/pair ancestry,
  Order252 reservation lineage, Order244 record, Order240 snapshot hash, property,
  folio, currency or full quoted amount fail closed.
- **P5 hostile partition:** reordered, duplicated, missing, non-positive, non-INR,
  unsafe-magnitude, non-canonical, unreconciled or cross-tenant room-night components;
  thawed/proxy/accessor/symbol/sparse/surplus graphs; missing/gapped/overlapping slabs;
  and public-hash-only provenance all fail atomically.
- **P6 containment:** output is frozen, tenant-hidden and has no final-taxable-value,
  tax-amount, rounding, posting, document, `ItemList`, IRP, write or runtime/local
  authority. Transaction/read proofs show exact zero mutation of persisted roots.
- **P7 preservation:** focused/adjacent/standing/static gates and the repository
  referee remain green; a fresh non-implementing Tier-3 reviewer personally executes
  the relevant hostile mutations and proof.

## Definition of done

- [ ] Intentional red precedes production.
- [ ] Exact per-room-night selected-slab, version-precedence and hostile proof is
  green.
- [ ] Transaction-read-only, standing/static and referee preservation gates are green.
- [ ] Fresh non-implementing Tier-3 reviewer personally executes the required proof
  and approves.

This order is not approved by its creation. Downstream final taxable-value, tax-amount,
rounding/allocation, India posting, fiscal document, IRP `ItemList` and IRP submission
authority each remain separate governed work.

## Fresh independent Tier-3 review — D963

Exact candidate `9731aa8` is coherent and all clean gates pass, but approval is
withheld on permanent-proof sensitivity. Reviewer-owned mutants show the Order341
proof does not yet independently kill post-scheduler unequal `599+601`/`899+901`
component copies, upper-band identity corruption, caller-selected side, omitted
key/source/status, lineage id, full amount/INR/exact transaction, tenant final-hash,
Section14 predecessor-hash or recursive-freeze guards. No separate product/statutory
finding was made. Bounded permanent-test repair and a different fresh Tier-3 rereview
are mandatory.
