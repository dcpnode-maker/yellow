# Question 188 — Order430 complete ordinary-regime provenance

**Status:** OPEN — technical dependency and native-source cycle identified
**Order:** 430 / D1323
**Date:** 2026-09-05
**Raised by:** `/root/order430_complete_provenance` (implementation investigation)

## Finding

The complete Order413 result cannot currently be reconstructed solely from the
persisted roots admitted by Order430. Its `supplyNatureAtTimeOfSupply` contains
`supplierTimeOfSupplyEvidenceHash` and `recipientTimeOfSupplyEvidenceHash`.
Those hashes include `ordinaryRegimeEvidenceSha256`, an explicitly external input
to the approved timing composers. No migration persists that value or an
authoritative hash which commits to it.

This is a source-contract and schema finding, not an executed issuance bypass.
The investigation did not modify product code, migrations, fixtures, schema
expectations or runtime state and did not create an exploitation harness.

## Exact evidence

- `src/contexts/tax-fiscal/india-gst-registration-at-time-of-supply.ts:171`
  places `input.ordinaryRegimeEvidenceSha256` in the supplier timing preimage.
- `src/contexts/tax-fiscal/india-gst-recipient-registration-at-time-of-supply.ts:89`
  places the corresponding input in the recipient timing preimage.
- `src/contexts/tax-fiscal/india-gst-accommodation-supply-nature-at-time-of-supply.ts:298`
  validates its hash shape; lines 326–330 replay the distinct predecessor hash
  algorithms. The result retains both timing hashes.
- `src/contexts/tax-fiscal/india-irp-accommodation-source.ts` binds that Order297
  result into the complete Order413 source hash. Its persisted applicability
  comparison does not add a persisted ordinary-regime root.
- `migrations/0069_india_gst_accommodation_quoted_rate_applicability.sql` stores
  Section14, levy, reservation-lineage and attribution hashes. The Section14
  preimage at line 337 binds the dated service/payment/invoice inputs and its
  separately governed calendar, but excludes ordinary-regime/timing evidence.
- Searching every migration for `ordinaryRegime`, `ordinary_regime`,
  `time_of_supply_evidence` and `at_time_of_supply_evidence` returns no matching
  persisted authority.
- `docs/CONTRACTS.md:2262` and Order293 explicitly require affirmative externally
  governed ordinary Rule47 evidence, prohibit regime inference and admit no
  migration, table or writer. D-777 preserves the same distinction.

The existing source factory uses the same synthetic digest for several evidence
purposes. That coincidence is not a contract permitting substitution of the
service-provision, invoice-issue or supplier-status evidence hash for the missing
ordinary-regime evidence.

## Why this blocks complete D1323 closure

The financial source can be exactly reconstructed from the existing posting,
tax, valuation, applicability, room-night, component and journal-line rows. The
legal-party source and all Order426 child hashes can likewise be reconstructed
after that source has been authenticated.

However, two different externally supplied ordinary-regime digests can describe
the same persisted rows while producing different timing/source/descendant hashes.
Hashing or comparing supplied preimages cannot decide which external digest is
authoritative. Copying it into the issuing transaction would retain the same
caller-authority problem. Inferring it from another evidence column would change
the approved contract. A shadow source or TypeScript attestation is not a remedy
under the requested database trust boundary.

## Native-source cycle

Order292 is not an invoice intention or an unnumbered draft. Its outcome and
Natural-Solution Test explicitly admit an **externally evidenced, already issued,
full-coverage supplier tax invoice**. Migration0058 stores its series, serial,
issue date and evidence digest, with one such invoice per service-provision root.
Order400 requires that row and binds it into Section14/applicability. The final
tax/posting source feeds Order413, then Order426/429, before Order430 allocates a
new number and derives a fresh property-local issue date.

Consequently the present source path requires a prior supplier invoice to create
the native supplier invoice for the same full-attribution supply. The SQL does
not prove that the two invoice identities/dates represent the same document.
Recording ordinary-regime evidence alone cannot resolve this circular dependency.

D1302 and Question187 clause 1 explicitly choose native origination and defer
external adoption. They do not explicitly rewrite Order292/400, permit a synthetic
external invoice, or authorize treating an already issued supplier invoice as an
unissued native candidate. Their policy requires a native source branch; the
existing Order430 requirement to consume unchanged Order429 ancestry does not
provide that branch. This is a contradiction in the technical dependency plan,
not a reason to infer new legal evidence or re-open the native-origin choice.

## Proposed dependency orders

### A. Persist the explicit ordinary Rule47 assertion

Add one new root, provisionally
`india_gst_accommodation_ordinary_regime_evidence`, through the next forward
migration. Minimum columns: tenant/id, exact property/reservation/service snapshot
and attribution identities, fixed regime/source/legal-rule literals, external
evidence SHA-256, actor, request identity/hash, server-derived evidence hash and
recorded time. Bind the underlying supply; **do not make an external invoice
snapshot a mandatory parent**. Use tenant-leading composite integrity, one
unambiguous assertion per exact service root, immutable rows, forced RLS and no
runtime DML.

One owner-mediated `record_india_gst_accommodation_ordinary_regime_evidence`
capability plus a Tax-Fiscal service accepts the explicit evidence assertion from
a verified actor with a new exact property permission, provisionally
`tax-fiscal.india-ordinary-regime:record`. It locks and revalidates the complete
service/attribution scope, owns hashes and replay, and atomically writes one fact
and one catalogued minimized event,
`india_gst.accommodation_ordinary_regime_recorded`. Missing evidence is never
backfilled, inferred from another hash or fabricated from an invoice date.

Exact replay succeeds; changed evidence for the same immutable source conflicts.
The initial order must explicitly leave replacement of an attestation to a
separately governed correction path, or define and prove an append-only
replacement path before enabling it. It cannot silently mutate evidence already
referenced by issued documents. This table is the first source of truth for a
previously unpersisted external assertion, not a copy of financial/source results.

### B. Admit the native invoice-date branch before resuming Order430

Use one server-derived native issue context in the issuing transaction, whose
property-local date is the date eventually stored in the actual immutable
document. It is distinct from the Order292 external-issued-invoice branch. Do not
insert a fake Order292 snapshot, allocate a number before the atomic issue
transaction, or store a separate placeholder invoice as authority.

Share the existing date, Section13/14 and component algorithms where their input
meaning is identical. Introduce explicit origin-specific evidence and hashes
where it differs: native source timing cannot claim an external invoice's
series/serial/evidence digest. Persist native applicability/source linkage to the
actual document, using deferred integrity if the rows are inserted before the
document in the same transaction. Preserve the external branch as historical
evidence for its separately governed adoption path.

The order must decide the precise atomic orchestration and lock order across
native date, applicability/final tax, posting, number and document. D1302 fixes
the outcome: stored component amounts must remain the approved integers. A
changed issue date that would change date-sensitive tax must reject or use the
separately authorized financial correction path; it must never silently restate
existing posting evidence. A first-invoice positive test must begin with service,
payment, valuation and explicit regime evidence and **no external invoice**.

### C. Complete D1323 against that authoritative source

Reconstruct the full canonical Order413 graph from locked persisted roots,
including the ordinary-regime-bound timing branch, complete financial predecessor
hashes, applicability/valuation identities, exact journal lines and room-night/
component arrays, every nested hash and every key set. Derive Order426's child
results and all four lineage hashes with their exact canonical serialization;
bind complete Order429 evidence and the actual native origin before allocation.
Add isolated invalid-lineage rejection regressions which keep legal content
unchanged, then rerun the complete native proof and independent Tier-3 review.

## Composition and likely file scope

| Boundary | Required treatment |
| --- | --- |
| Orders293/294/295/296 | Preserve ordinary-only/date/hash semantics. Add exact persisted assertion resolution for authoritative use; separate native issue context from external Order292 evidence. The supplier and recipient timing hash algorithms remain distinct. |
| Order297 | Preserve complete predecessor replay and both timing hashes. A native predecessor variant needs its own explicit contract; do not relabel an external envelope. |
| Order298 | No change: this is historical tax-rate content, not an ordinary-regime or invoice-origin selector. Order308 component-family semantics likewise remain unchanged unless the new source envelope requires an adapter. |
| Order400 and final-tax/posting consumers | Keep existing external lineage immutable. Add a governed native branch tied to the eventual document and revalidate date-sensitive applicability. Existing snapshot selectors must not stand in for an unissued native invoice. |
| Order413 | Resolve the persisted regime assertion and the exact source-origin branch; fully authenticate ancestry before producing its canonical source. |
| Orders426/429 | Preserve pure composition and blocked-readiness semantics; consume an explicitly approved native source variant rather than fabricated external evidence. |
| Order430 | Atomic native date/number/document source; complete database graph/child-hash authentication, allocation and replay proof. |

Likely files for A: a new migration after0074; a new
`src/contexts/tax-fiscal/india-gst-accommodation-ordinary-regime-evidence.ts`;
`src/contexts/tax-fiscal/index.ts`; new focused/database/intentional-red tests;
`tests/schema/expected.sql`; migration, acceptance, runtime-DML and definer
catalogue tests; `setup.sh`; event/contract/domain/security documentation and
bounded order/decision/ledger/review records. Update only actual schema-frontier
oracles after discovering them; do not blanket-rewrite historical counts.

Likely files for B/C include the named timing/source modules above;
`india-gst-accommodation-quoted-rate-applicability.ts` and its recorder;
final-valuation/final-component-tax recorder and journal-posting modules;
`src/contexts/financials/india-final-component-tax-fiscal-source.ts`;
the native invoice service and a forward corrective capability migration;
native/source/applicability/timing tests and persisted source fixtures. These are
outside Order430's present exact scope and require explicit order admission.
Use new migrations rather than changing approved0058/0069/0070/0071 history.

## Negative cases and proof gates

- No persisted ordinary assertion, wrong actor/property/tenant, mismatched
  service/attribution, altered assertion/hash, duplicate or changed replay,
  direct DML, and source replacement after native issue all fail closed.
- A native first invoice has no Order292 parent; external-issued evidence cannot
  be relabelled native. Native date is property-local and identical across timing,
  applicability and final `DocDtls`; midnight/FY/cutover and late/timely boundaries
  are exercised with deterministic fixtures.
- Each independent source/child lineage field, nested hash, array item, and extra
  or missing key is tested without changing legal content. Invalid inputs cause
  unchanged counter/tail and zero document/origin/fact/outbox/idempotency artifacts.
- Fresh isolated PG16 applies the full new migration frontier; prove role/ACL/RLS,
  immutable source and origin, exact schema and migration replay, all existing
  100-way/replay/same-origin/failure-atomicity/hash-chain and Order408/seal races,
  definer containment, separate referee11/11, standing tests and static gates.
- A different non-implementing Tier-3 agent must personally inspect and execute
  the proof. Neither a new persisted root alone nor partial source reconstruction
  closes D1323.

## Founder policy assessment

No new founder legal/business choice is identified for the ordinary-regime root:
D-777/Order293 already fix the affirmative ordinary-only contract and exclusions.
D1302 already fixes native origin, legal date, grouping, numbering and correction
policy. Recording authenticated evidence, introducing an origin-aware temporal
branch and proving the transaction are technical implementation decisions which
Codex can admit through bounded orders under its standing authority.

Actual hotel evidence must still be supplied by an authorized actor; the program
cannot invent it. A request to support a new legal regime, reinterpret an existing
external invoice as a native one, or restate issued evidence would be new business
policy. None of those changes is required or proposed here.

## Investigation validation

On the unchanged product candidate, `bun test
tests/india-native-fiscal-invoice.test.ts
tests/india-irp-accommodation-validation-compatibility-pre-document-evidence-assembly.test.ts`
passed **39 tests, 0 failures, 113 assertions**. These are baseline checks only,
not a repaired database proof or approval. No isolated PostgreSQL cluster was
started because the complete repair is blocked by this missing dependency.
