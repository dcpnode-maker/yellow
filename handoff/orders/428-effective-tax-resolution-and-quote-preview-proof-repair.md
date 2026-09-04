# Order 428 — Effective tax resolution and quote-preview proof repair

**Status:** PRODUCT-PROOF-APPROVED; CLOSURE-WITHHELD-PENDING-SAFE-CLEANUP — D1292
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order426 coordination head `e2b4ac7`
**Risk tier:** 3 — tenant/date-bound tax authority proof
**Owner:** Codex implementation; different fresh independent non-implementing Tier-3 reviewer

## Outcome

Repair the four false-green permanent proofs identified by Order427/D1288 for
Orders238–239 without weakening or changing their approved-intent product contracts.
Execute their PostgreSQL cases against one disposable isolated test database with
known credentials, then remove it. Truthfully close each order only after a different
fresh Tier-3 reviewer personally reproduces the proof.

## Exact scope

- `tests/tax-jurisdiction-resolution.integration.test.ts`;
- `tests/tax-jurisdiction-effective-period.test.ts`;
- `tests/rate-quote-tax-preview.integration.test.ts`;
- `src/contexts/tax-fiscal/resolution.ts` only if a newly isolated valid test exposes
  a real product defect;
- `src/contexts/rates/quote.ts` only if a newly isolated valid test exposes a real
  product defect;
- `handoff/orders/238-effective-tax-jurisdiction-resolution.md`;
- `handoff/orders/239-attributable-rate-quote-tax-preview.md`;
- new `handoff/reviews/428-effective-tax-resolution-and-quote-preview-proof-repair.md`;
- Phase 7 status prose in `BUILD-PLAN.md`, this order, `DECISIONS.log`, and
  `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Add a positive exact 366-night Order239 case and make changing production maximum
   from `>366` to `>=366` turn that named case red.
2. Add separate property mismatch and business-date mismatch result-scope cases; each
   must remain a valid result shape through every earlier check and turn red only when
   its corresponding production scope guard is removed.
3. Add a package-evidence-null case whose other package amounts/counts are coherent;
   removing only the `packageEvidence !== null` production guard must turn it red.
4. Add an Order238 effective-assignment containment case that keeps PostgreSQL query
   selection coherent but returns a row whose stored bounds exclude the requested
   business date; removing only the result-normalization containment guard must turn
   the named case red.
5. Every mutation oracle requires the exact domain class and guard-specific message;
   unrelated errors cannot count as rejection. Restore every source byte-exact.
6. Run all current Order238/239 PostgreSQL cases against one disposable isolated
   PostgreSQL instance/database with transaction-local tenant context and non-bypass
   runtime role; prove cross-tenant/property/date hostility and remove all temporary
   resources afterward. This is a test database, never a second Yellow app/local.
7. Run focused/composition/standing/type/boundary/licence/audit/diff and unchanged
   schema/referee gates required by the touched authority. A different fresh Tier-3
   reviewer personally repeats the load-bearing proof before approval.

## Forbidden

No new tax rule, threshold, rounding, currency, assignment precedence or package
semantics; no migration/schema/table/RLS/permission/event/fact/outbox/product API/UI;
no persistent database, Docker stack, second local app, seed/demo data, provider,
document/submission/certification, deploy/merge/push or Phase7/application-completion
claim. Never reuse invalid local credentials as proof and never alter the stable local.

## Build evidence — D1291

- No isolated case exposed a product defect; `src/contexts/tax-fiscal/resolution.ts`
  and `src/contexts/rates/quote.ts` are byte-exact to the admitted candidate.
- The restored focused proof is `27 pass, 6 expected database skips, 0 fail` with
  141 expectations. The exact 366-night, property-scope, business-date-scope,
  package-evidence and assignment-containment production-only mutations each made its
  own named probe red, then each source file was restored byte-exact.
- One disposable native PostgreSQL 17.2 cluster on port 55491 applied all 73
  migrations. With a SCRAM-authenticated `yellow_runtime` role confirmed
  `NOSUPERUSER NOBYPASSRLS` and transaction-local tenant context, all six formerly
  skipped Order238 database cases passed (`15 pass, 0 fail`, 80 expectations).
- The test fixture conditionally registers the prerequisite `tax_jurisdiction`
  extension type only if absent in the isolated database and removes only that created
  row. The cluster, port, data directory and generated credentials were removed.
  Docker, WSL, a second Yellow app, stable local, migrations and `.yellow` were not
  touched.
- Standing proof is `1,458 pass, 1,054 expected environment skips, 0 fail` with
  20,651 expectations across 2,512 tests/462 files.
- Fresh non-implementing Tier-3 review remains mandatory. This builder evidence is not
  a review or approval.

## Independent review — D1292

Fresh non-implementing Tier-3 reviewer `/root/order428_tier3` reproduced all five
exact mutation-red proofs, authenticated SCRAM `yellow_runtime` as
`NOSUPERUSER NOBYPASSRLS`, ran every Order238 PostgreSQL case **15/0** (81 assertions),
the unchanged referee **11/11**, exact schema comparison, standing **1,458/0** plus
1,054 expected environment skips, and all static/scope gates. Product proof is
approved with no finding. Closure alone remains withheld because tool policy blocked
safe same-shell removal of the stopped 78,769,906-byte disposable directory at
`E:\yellow\temp\order428-tier3-review`; port 55493 is closed. The coordinator must
remove that exact directory safely and record completion before closing Orders238,
239 and 428.
