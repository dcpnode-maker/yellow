# Order 288 — Build exact first-renewal India SEZ-unit LoA continuity evidence

**Status:** APPROVED-D764
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-sez-unit-loa-renewal`
**Base:** `39219a8` (independently approved Order287 descendant)
**Risk tier:** 3 — statutory SEZ approval continuity, migration and forced RLS;
fresh independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one tenant-leading, forced-RLS, SELECT-only source root and exact resolver for
the first directly contiguous Form-F2 renewal of an approved supplier SEZ-unit Form-G
Letter of Approval. Accept the five-year or shorter period exactly issued by the
Development Commissioner and return only frozen deterministic continuity evidence at
an explicit status date. Do not interpret authorized operations, fresh BLUT
compliance, GST current status, supply nature, zero rating, levy or invoice truth.

## Natural-Solution Test

Order286 correctly supports affirmative current Form-G/B/C status but explicitly
fails closed on Form-F2 renewal. SEZ Rules 19(6A)(1) makes Form F1 an application,
while 19(6A)(3) makes issued Form F2 the renewal instrument and permits five years or
a shorter period. A separate source root is therefore the smallest auditable way to
preserve the issued renewal without mutating approved Order286 or treating an
application as authority. A general approval table, Order286 rewrite or premature
authorized-operations/zero-rating decision would conflate separate evidence.

## Exact contract

- migration `0054_india_sez_unit_loa_renewal.sql` adds only
  `india_sez_unit_loa_renewal(tenant_id,id,supplier_sez_status_id,
  original_loa_reference,original_loa_issue_date,original_loa_evidence_sha256,
  form_f2_file_number,form_f2_issue_date,renewal_validity,renewal_status_as_of,
  renewal_status,renewal_status_source,renewal_status_evidence_sha256,
  form_f2_evidence_sha256,legal_rule)` with tenant-leading identity/FK, canonical
  checks, forced RLS and `app_role` SELECT only;
- exact literals are `in_force`, `development_commissioner_record` and
  `SEZ_RULES_19_6_AND_19_6A_3_FORM_F2_CONTINUITY`; all evidence hashes are lowercase
  SHA-256 and all references are trimmed, NFC, control-free and bounded;
- `renewal_validity` is one finite non-empty canonical `[from,toExclusive)` range
  produced once at ingestion from the instrument's printed inclusive dates. It must
  contain `renewal_status_as_of`; `form_f2_issue_date` cannot be after that status
  date. No duration, five-year minimum, latest selection or server-clock inference;
- `resolveIndiaSezUnitLoaRenewal({tenantId,propertyNode,reservationId,
  supplierServiceLocationId,supplierSezStatusId,supplierLoaRenewalId,statusAsOf})`
  accepts only an exact plain accessor/proxy/symbol-free input, fully resolves and
  rehashes exact Order286, requires `sez_unit` plus Form G, equality-selects only the
  requested tenant/status/renewal row and requires input date equal row status date;
- row original LoA reference and evidence hash must equal upstream Form-G evidence.
  The structured original issue date is the issued Form-F2 citation and is bound by
  the complete Form-F2 document hash; it is not falsely claimed as an independent
  Order286 comparison because Order286 does not expose that date;
- the first supported renewal is exactly contiguous:
  `lower(renewal_validity) = upper(original Form-G validity)`. Gaps, overlaps,
  second/later renewal chains and upper-boundary dates fail closed;
- return exact fixed-order recursively frozen continuity evidence with root/status
  ids, property, minimized service-location/supplier lineage, original Form-G,
  renewal Form-F2, `from/to/exactly_contiguous` relation and legal rule, followed by
  deterministic tenant-bound evidence hash while tenant remains unexposed;
- replay and every rejection preserve caller/source bytes and perform no financial,
  fiscal, document, event or unrelated database effect.

## Exact scope

- new `migrations/0054_india_sez_unit_loa_renewal.sql`;
- `tests/schema/expected.sql`, `tests/database-acceptance.integration.test.ts`,
  `tests/runtime-dml-authority.integration.test.ts` only for exact 0054/schema/ACL
  catalogue changes;
- `tests/migrate.integration.test.ts` only for exact post-0054 migration-ledger,
  discovered/applied-file and public-table/RLS/policy/FORCE-RLS catalogue
  expectations advanced by the admitted migration;
- `setup.sh` only for its exact post-migration table count `105` to `106` and
  migration-range diagnostic `1-53` to `1-54`;
- new `src/contexts/tax-fiscal/india-sez-unit-loa-renewal.ts` and bounded-context
  index export only;
- new intentional-red and exact hostile integration tests;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`;
- `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`, this order,
  decision, ledger and later independent review evidence.

## Forbidden

No Form-F1-as-authority, Form-F2 authoring, product writer or generic approval root.
No inferred renewal, latest/nearest record, second/later F2 chain, gap/overlap,
duration assumption, clock or retroactive status before the issued instrument's
evidence date. No developer/co-developer renewal, GST current-status substitution,
Order286/287 mutation, authorized-operation item interpretation, specified-officer
endorsement, BLUT compliance, zero rating/refund/`SEZWP`/`SEZWOP`, supply-nature
change, levy/rate/amount/decomposition, `SupTyp`/`IgstOnIntra`, journal/posting/tax
detail, item/invoice/document/submission/API/HTTP/UI/local/status/promotion,
dependency/merge/public deploy, Phase-7 or application-complete claim.

## Pre-registered proof

1. Intentional red proves migration/table, source resolver and export are absent.
2. Exact migration checksum, schema mirror, acceptance manifest, 54 migrations/106
   public tables/96 RLS tenant tables/96 tenant policies/6 FORCE-RLS tables,
   `app_role` SELECT-only ACL and referee 11/11 are green.
3. Golden direct-contiguous five-year and shorter issued Form-F2 renewals resolve;
   no exact-duration assumption exists.
4. Lower boundary succeeds; exclusive upper boundary, gap and overlap fail closed.
5. Regular/developer/non-Form-G upstream and missing, stale, cancelled, future-issued,
   malformed status/source/rule/reference/hash/range evidence fail closed.
6. Cross-tenant/property/reservation/location/registration/status/root identity and
   self-consistent hostile lineage mixes reveal no row and write nothing.
7. Exact shape/order, canonical JSON/hash, recursive freeze, replay, source
   immutability and first-F2-only containment are byte exact.
8. App-role INSERT/UPDATE/DELETE/TRUNCATE are denied; forced RLS tenant isolation,
   owner-mediated migration setup and transaction reuse are proven.
9. Zero-effect/static proof excludes Form-F1 authority, AO interpretation, specified
   officer, BLUT, GST substitution, zero rating, tax, item/document/network/writer.
10. Focused/adjacent/database/standing/static gates and fresh non-implementing Tier-3
    execution are green; stable local remains unchanged.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact schema/RLS/ACL and hostile continuity proof is green.
- [x] Standing/static/referee gates are green and no authority expands.
- [x] Fresh independent Tier-3 approval is recorded.

## Proof-scope clarification — D-760

The fresh migration gate exposed three exact pre-Order288 catalogue counts in
`tests/migrate.integration.test.ts`. That gate cannot remain green after the admitted
table/RLS/policy addition unless those three values advance from `105/95/95` to
`106/96/96`. D-760 explicitly adds only those mechanical expectations to scope.
No assertion, product behavior, migration contract, outcome or authority changes.

## Proof-scope correction — D-761

Full execution showed the same exact catalogue truth is asserted at additional
cutoff/full-chain locations and that the staged applied-file/ledger oracle must name
0054. D-761 corrects D-760's undercount: every existing post-0054 expectation in
`tests/migrate.integration.test.ts` may advance only for migration0054, including
`106/96/96/6`, discovered count54 and the exact 0054 filename/version/checksum row.
No assertion removal, relaxation, unrelated path or product authority is admitted.

## Canonical-setup clarification — D-762

The required `./setup.sh --db-only` gate contains an exact final-table assertion and
diagnostic pinned to the approved predecessor. D-762 adds only `105` to `106` and
`migrations 1-53` to `migrations 1-54` in that gate. The check remains equally
strict; no setup behavior, role, credential, data, seed or runtime authority changes.

## Builder proof — D-763

The exact candidate is built. Intentional red was `0 pass / 1 fail` before migration,
source and export existed. Reviewer-style isolated focused proof is `10 pass / 0
fail / 227 assertions`; migration is `39/0/187`, database acceptance `19/0/55`,
runtime DML `5/0/113`, schema exact `54/106/96/96/6`, canonical setup/referee and
standalone referee are each `11/11`. Adjacent Orders284/286/288 are `27/0` plus 19
expected environment skips. Standing proof is `967 pass / 863 environment skips /
0 fail / 14,892 assertions / 1,830 tests / 320 files`; typecheck, 111 import
boundaries, 23-package licence policy, audit with zero vulnerabilities and diff check
are green. Migration0054 SHA-256 is
`54a65ae32acfc5e232037129685a7c7edfb950aa66b54d4ea053c7acf11bb717`.
Disposable proof resources are removed and the sole stable local remains unchanged.
Fresh non-implementing Tier-3 review remains mandatory.

## Independent review — D-764

A fresh non-implementing Tier-3 reviewer approves exact candidate `d65c236` with no
finding. Reviewer-personal official Rule19(6A)/Form-F1/Form-F2/five-year-or-shorter
audit, focused PostgreSQL `10/0/227`, migration `39/0/187`, acceptance `19/0/55`,
runtime DML `5/0/113`, exact `54/106/96/96/6`, schema/setup/referee `11/11`, adjacent
`46/0` plus 28 expected skips, standing `967/0` plus 863 skips and every static/
scope/hash gate are green. Disposable proof was removed and the sole stable local
remained exact and healthy. Approval grants only first-renewal LoA continuity.
