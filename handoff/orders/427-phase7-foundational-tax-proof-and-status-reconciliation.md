# Order 427 — Phase 7 foundational tax proof and status reconciliation

**Status:** CHANGES REQUIRED — D1288
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** Order426 repair candidate coordination head `5db5f60`
**Risk tier:** 3 — independent proof of foundational tax authority
**Owner:** fresh independent non-implementing Tier-3 reviewer

## Outcome

Independently execute and record the current exact proofs for Orders237–239, then make
their order files truthfully state the resulting verdict. Reconcile Order413's stale
header with its already-recorded fresh independent D1230 approval. This is evidence and
governance reconciliation only; it changes no product, schema, test or runtime behavior.

## Exact scope

- `handoff/orders/237-pure-rules-driven-tax-evaluation.md`;
- `handoff/orders/238-effective-tax-jurisdiction-resolution.md`;
- `handoff/orders/239-attributable-rate-quote-tax-preview.md`;
- `handoff/orders/413-india-accommodation-statutory-envelope-eligibility.md`;
- new `handoff/reviews/427-phase7-foundational-tax-proof-and-status-reconciliation.md`;
- Phase 7 status prose in `BUILD-PLAN.md`;
- this order, `DECISIONS.log`, and `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Identify exact current product/test ancestry for Orders237–239 and prove no later
   descendant silently changed their public behavior.
2. Personally execute their focused tests, relevant integration/composition tests,
   standing/static/boundary/licence/audit/diff gates and current PostgreSQL-backed
   proof wherever Orders238/239 depend on database authority.
3. Independently make jurisdiction-content/rule selection, effective assignment,
   tenant/property/business-date binding, quote-night attribution and exact-money
   calculation gates load-bearing through controlled mutation or equivalent direct
   adversarial execution; restore every mutation byte-exact.
4. Verify India current schedule boundaries plus KSA 15% and UAE 5% exact integer
   outcomes already claimed by Phase 7, without interpreting those fixtures as
   provider certification or document authority.
5. Reconcile Order413 header only after matching its exact candidate, D1230 review and
   ledger evidence; do not rerun or expand Order413 authority under this order.
6. Record findings, commands and exact results. Any failed or unprovable claim remains
   explicitly unapproved rather than being normalized by prose.

## Forbidden

No product/test/migration/schema/table/RLS/permission/API/UI/runtime/local/Docker/WSL/
database fixture mutation; no new tax policy, recalculation rule, fiscal document,
provider/submission/certification, deploy/merge/push or Phase7/application-completion
claim. Do not review Order426 under this order.
