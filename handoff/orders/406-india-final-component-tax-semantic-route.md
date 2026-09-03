# Order 406 — India final component-tax semantic-route resolver

**Status:** CHANGES-REQUIRED-D1198
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order367/405 coordination head `c9521d0`
**Risk tier:** 3 — statutory money evidence, tenant-scoped financial routing
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Resolve the current persisted India accommodation final component-tax evidence to
the already-configured semantic revenue and component-tax routes. The resolver is
read-only: it returns frozen, server-derived routing evidence that a later governed
posting order can consume without trusting caller amounts, hashes, tax identities,
transaction codes or accounts.

## Authority and dependencies

- Orders367/405 are independently approved and closed by D1194.
- Reuse Order259's configured `tax_semantic_route`, `tx_code_route`, `tx_code` and
  `account` authority; never infer a route from a name, code prefix, USALI number or
  default.
- Resolve exactly one current Order367 tax head and recheck its linked final
  valuation head in the same tenant transaction.
- Aggregate the persisted child component minor-unit amounts; do not recalculate or
  re-round tax.
- Map only the frozen statutory identities `igst`, `cgst`, `sgst`, `utgst` to their
  explicit configured semantic route identities. Zero components remain lineage but
  do not require a configured payable route.

## Exact scope

- `src/contexts/tax-fiscal/india-gst-accommodation-final-component-tax-semantic-route.ts` (new)
- `src/contexts/tax-fiscal/index.ts`
- `tests/india-gst-accommodation-final-component-tax-semantic-route.intentional-red.test.ts` (new)
- `tests/india-gst-accommodation-final-component-tax-semantic-route.integration.test.ts` (new)
- `docs/CONTRACTS.md`
- `BUILD-PLAN.md`
- this order, its review, `handoff/LEDGER.md` and `DECISIONS.log`

Any additional product, schema, migration, permission, event, API, UI or runtime file
requires a recorded scope amendment before editing.

## Required behavior

The tenant-scoped transaction accepts only exact identity selectors, derives all
money and statutory lineage from current persisted evidence, validates exact
property/currency/jurisdiction extension identity/version/content hash, and resolves
room revenue plus every non-zero statutory component to an open exact-property INR
account through the correct configured transaction-code group. It returns recursively
frozen evidence with complete tax, valuation, applicability, component, route,
transaction-code and account lineage. Missing, duplicate, stale, superseded,
foreign, malformed or incoherent evidence fails closed.

## Required proof

Intentional red; IGST, CGST+SGST and CGST+UTGST families; 5/12/18-percent and
multi-night aggregation; half-up residual, zero-rounded components and bigint
boundaries; missing/duplicate/wrong group/account role/currency/property/extension
owner/key/version/hash/closed-account routes; stale/superseded/fork/foreign/ambiguous
roots and children; tenant isolation; recursive freeze and replay equality; complete
zero-write census across financial, fiscal, fact, outbox and idempotency state;
adjacent Order259 and Order367 proofs; standing/type/boundary/licence/audit/diff
gates; fresh independent Tier-3 execution.

## Forbidden

No migration, table, ACL, permission, fact/outbox/idempotency, journal, posting,
tax-detail, correction/reversal, document, invoice number, provider/IRP submission,
HTTP/UI/local, merge, deployment or Phase/application completion authority.
