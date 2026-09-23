# Order 429 — India IRP fiscal-action readiness

**Status:** INDEPENDENTLY APPROVED AND CLOSED — D1300
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order428 coordination head `e3c4ebd`
**Risk tier:** 3 — statutory/fiscal readiness composition
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add one migration-free, read-only Tax-Fiscal boundary that reruns independently
approved Order413 from live tenant-scoped PostgreSQL, composes independently approved
Order426 from that exact current source, and returns a deterministic fail-closed
fiscal-action readiness snapshot. It makes the unresolved document-origin, legal-
number format and series binding explicit without selecting or simulating any of them.

## Natural-Solution Test

Order413 already resolves the exact current unreversed posted fiscal source and its
complete statutory ancestry. Order426 already assembles the exact validation-
compatible pre-document evidence while proving that `DocDtls` is absent and the
result is not submission-ready. The missing capability is only one truthful runtime
boundary that binds both approved results and exposes the remaining blockers. It
requires no table, migration, writer, event, idempotency record, document or provider.

## Exact contract

`IndiaIrpAccommodationFiscalActionReadinessService.resolve(tx, input)` accepts only
the exact frozen `IndiaIrpAccommodationSourceInput` already governed by Order413.
It invokes `IndiaIrpAccommodationSourceService.resolve(tx, input)` with the same
transaction, constructs the exact Order414/426 input solely as `{tenantId, source}`
from that resolved result, and invokes
`composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly`.

The fixed public result key order is `state`, `submissionReady`, `permittedActions`,
`blockers`, `preDocumentEvidence`, `sourceEvidenceHash`, `preDocumentEvidenceHash`,
`evidenceHash`.

- `state` is exactly `blocked_pending_fiscal_document_origin_policy`;
- `submissionReady` is exactly `false`;
- `permittedActions` is the exact empty tuple `[]`;
- `blockers` is exactly, in order,
  `FISCAL_DOCUMENT_ORIGIN_UNSELECTED`,
  `LEGAL_DOCUMENT_NUMBER_FORMAT_UNCONFIGURED`, and
  `DOCUMENT_SERIES_UNBOUND`;
- `preDocumentEvidence` is the exact recursively frozen Order426 result;
- `sourceEvidenceHash` equals the exact Order413 result hash;
- `preDocumentEvidenceHash` equals the exact Order426 result hash;
- `evidenceHash` is deterministic SHA-256 over the exact tenant-bound fixed-order
  body, while tenant identity is not returned.

The service must map Order413 absence/RLS concealment and conflict errors without
weakening their semantics, independently revalidate the returned Order413 and
Order426 hashes/lineage/state, leave input unchanged, and recursively freeze all
returned objects and arrays.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-accommodation-fiscal-action-readiness.ts`;
- `src/contexts/tax-fiscal/index.ts` public export;
- new exact intentional-red, hostile pure and real-PostgreSQL integration tests;
- existing Order413/426 tests only if an executable fixture compatibility correction
  is proved necessary; otherwise preserve them byte-exact;
- `src/contexts/financials/india-final-component-tax-fiscal-source.ts` and its exact
  focused tests only for D1297's proved canonical JSONB key-order compatibility
  repair; no query, validation, authority, field or semantic change;
- `docs/CONTRACTS.md`, `docs/SECURITY.md`, Phase 7 `BUILD-PLAN.md`, this order/review,
  `DECISIONS.log` and `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Genuine intentional red proves the exact module/export absent.
2. Fresh PostgreSQL runs the real Order413 service for 5/12/18-percent and every
   approved component family, then composes exact Order426 evidence.
3. Current/reversal/successor, tenant/property/reservation/folio/journal/buyer,
   predecessor hash, item ordering/count, component-family and INR/B2B truth are
   independently load-bearing; foreign, stale, reversed or mixed truth fails closed.
4. Exact state, blocker order/count/text, empty actions and false readiness are
   mutation-sensitive. `DocDtls` and any full invoice number remain absent.
5. Replay is byte-equivalent, input stays unchanged, output is deeply frozen and
   tenant identity is concealed outside the evidence-hash preimage.
6. Database census proves no document/series/fact/outbox/idempotency row changes;
   schema/catalogue/referee11/11, Orders413–426, standing and static gates pass.
7. A fresh non-implementing Tier-3 reviewer personally executes the complete proof.

## Forbidden

No native-versus-external document-origin choice; no legal number format or reset
policy; no `DocDtls` or full invoice number; no series selection/lock/advance; no
document create/import/issue/status/hash-chain; no migration/schema/table/RLS/
permission/write/entity/event/fact/outbox/idempotency; no provider/submission/IRN/QR;
no API/UI/seed/runtime/local/Docker/deploy/merge/push, Phase7 or application-
completion authority.

## D1297 executable scope amendment

The first configured live Order413→426→429 run exposed a real predecessor
compatibility defect. PostgreSQL `jsonb` returns the already-validated canonical tax
detail in database key order, and Order412 freezes that raw object into its public
result. Order414 correctly requires canonical fixed key order and therefore rejects
the live result even though the pure fixture uses the intended order. The smallest
repair is to rebuild only that already exhaustively validated tax-detail object and
its nested records in the existing canonical contract order before Order412 freezes
and hashes its result. The amendment admits only the exact Financials source file and
focused proof for that normalization. It must preserve every value, validation,
query, result field, error, authority and database census; a fresh Tier-3 reviewer
must execute the live proof.

## D1300 independent Tier-3 disposition

Fresh non-implementing Tier-3 review approves and closes Order429 at candidate
`a91400b`. A separate native PostgreSQL 16.15 cluster applied all 73 migrations;
runtime SCRAM identity was non-superuser/non-bypass with transaction-local tenant
context. The real Order413→426→429 bridge passed 7/0 with 292 assertions and the
D1297 live source proof passed 6/0 with 204 assertions. A native normalized schema
dump matched the 891,689-byte repository snapshot exactly, and a separately reset,
migrated and fixture-loaded database passed the unchanged referee 11/11 with 124
public tables. Blocker-order and raw-JSONB reviewer mutations each made their named
proof red; both sources restored byte-exact. Focused 34/0 plus 19 expected database
skips, standing 1,462/0 plus 1,059 expected environment skips, typecheck,
160-file boundaries, 23-package licence policy, zero-vulnerability audit and diff
hygiene pass. The server stopped, port 55495 closed and the exact 168,999,966-byte
review directory was removed. No document/series/provider/API/UI/local/Phase
authority is added; see `handoff/reviews/429-india-irp-fiscal-action-readiness.md`.
