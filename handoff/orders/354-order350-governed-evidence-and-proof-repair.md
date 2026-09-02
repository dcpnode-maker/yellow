# Order 354 — Order350 governed evidence and proof repair

**Status:** BUILT-PENDING-DIFFERENT-FRESH-TIER3-REVIEW-D1006
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/order350-governed-evidence-proof-repair`
**Base:** exact withheld candidate `6e82a7c` / implementation `6b61e72`
**Risk tier:** 3 — statutory valuation evidence and immutable financial lineage
**Owner:** Codex repair implementation; different fresh non-implementing Tier-3 rereviewer

## Outcome

Close every D999 finding without widening Order350 into tax money, posting, documents
or IRP. The repaired service and still-unapplied migration0062 must derive and persist
governed legal/statutory conclusions rather than accepting caller labels or hashes,
and permanent proof must exercise every high-risk boundary.

## Required repairs

### D1001 authority-source clarification

D991's “explicit persisted evidence” is a governed authorized attestation boundary;
it does not require a pre-existing external legal-classification table. Within the
same four Order350 tables (so catalogue counts remain `62/115/105/14/2`), migration0062
may add typed columns and CHECK constraints for the exact attestation vocabulary,
attesting actor, evidence source/reference and recorded instant. The internal service
accepts only explicit typed attestations from an active actor holding a dedicated
property-scoped `tax-fiscal.india-valuation:finalize` permission, locks all known
party relationships and posting roots, rejects contradictions, and persists the
normalized evidence. This is neither arbitrary caller truth nor inference from
USALI/descriptions/JSON. Unknown/incomplete evidence yields
`manual_valuation_required`.

For each posting root, the authorized attestation must name one exhaustive typed
classification and, where applicable, one Section15(2) addition subtype or one
Section15(3) discount eligibility conclusion with bounded evidence source/reference.
Completeness is proven against the independently derived locked root set; callers
cannot omit roots or provide hashes. The capability derives canonical hashes from
these typed persisted values. Known `party_relationship` facts may disprove an
unrelated/not-distinct attestation; absence alone never proves it—the authorized
explicit attestation is retained as evidence.

1. Replace arbitrary manual-reason vocabulary with the exhaustive canonical set:
   related person, distinct person, non-money consideration, pure-agent, special
   supply/Rules27–35, tax-inclusive, omitted Section15(2) addition, ineligible or
   indeterminable Section15(3) discount, incomplete source classification and other
   genuinely indeterminable governed evidence. Ordinary and manual inputs are
   mutually exclusive; request hashes bind only their exact admitted partition.
2. Replace five shape-only ordinary hashes with typed persisted conclusions for
   unrelated/not-distinct, sole-money, complete Section15(2) additions and complete
   eligible Section15(3) discounts. Re-derive their canonical evidence hashes inside
   the transaction and fail closed on omission, surplus or contradiction.
3. Source kinds and eligibility must derive from typed governed evidence bound to
   each locked posting root. Never infer from description, USALI or untyped JSON and
   never trust a caller label/hash. Incomplete package, promotion, fee, addition or
   discount classification produces `manual_valuation_required`.
4. Legal-buyer candidates include the exact current payer, reservation company and
   group-account party where present. Any designated buyer outside the complete
   current candidate set requires a different-user, unexpired, one-use approval whose
   canonical payload binds the complete relationship-set hash and request evidence;
   changed candidates invalidate it.
5. Corrections lock the unique head, preserve each existing posting root's governed
   classification/eligibility identity, admit only changed current fragments or
   newly governed roots, and prevent forks, approval reuse and reclassification.
6. Independently reparse and validate the exact Order244 attribution snapshot and
   persisted reservation/folio lineage used by the supplied, freshly replayed
   Order341 evidence. Public hashes alone are never authority.
7. Current posting-root derivation must prove the complete committed folio set,
   canonical transfer roots/fragments, no ambiguity, no partially transferred or
   future/uncommitted source, and exact INR/account/journal status semantics.
8. Add complete service and fresh-PostgreSQL hostile proof: tenant/property/actor,
   source/classification/hash/amount/currency/frozen shape; every manual partition;
   buyer approval expiry/reuse/race/change; correction chain/fork/race; exact replay,
   divergent idempotency, injected rollback after every effect, fact/outbox atomicity,
   allocator/reconciliation mutations and direct-DML denial.

## Exact scope

- Order350 service, allocator only where mutation sensitivity requires, context export;
- still-unapproved `migrations/0062_india_gst_accommodation_final_valuation.sql`;
- `scripts/seed-review.ts` and exact review-login scope expectations only for the one
  dedicated finalize permission;
- Order350 focused unit/integration/intentional-red tests and directly affected exact
  migration/schema/authority/catalogue/checksum oracles;
- exact Order350 contract/domain/event/state/security/plan wording only if repaired
  shapes require synchronization;
- this order, review evidence, `DECISIONS.log`, `handoff/LEDGER.md`.

Any other file requires a recorded pre-commit scope amendment. Migration0001,
`.yellow`, stable local and port3000 are forbidden.

## Gates

Reproduce D999's under-proof against the parent. Run focused service/allocator and
fresh PostgreSQL proofs; exact `62/115/105/14/2`; migration, database acceptance,
runtime authority/DML, SECURITY DEFINER and schema snapshot gates; relevant financial,
attribution and Order341 suites; full standing/static/audit and fresh referee 11/11.
A different fresh Tier-3 reviewer must personally execute hostile, race, rollback and
mutation proofs before approval.

## Forbidden

- Tax component amount, rounding, journal/posting, document, ItemList, IRP/provider,
  API/UI/local/deployment authority;
- caller-selected classification, legal conclusion, current-source set, approval
  relationship set, amount, currency, hash, predecessor or correction semantics;
- editing immutable evidence, weakening RLS/ACL/catalogue or deleting assertions;
- self-review or Phase/application-complete claim.

## Definition of done

- [ ] All eight D999 repair groups are executable and mutation-sensitive.
- [ ] Exact schema, authority, standing/static and referee gates are green.
- [ ] Different fresh non-implementing Tier-3 approval is recorded.
