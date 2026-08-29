# Order 266 — Governed positive-tax journal correction

**Status:** PAUSED-D692 — sole-local runtime reconciliation required
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/governed-positive-tax-correction`
**Base:** `252254b` (independently approved Order265 sole-local credential remediation)
**Risk tier:** 3 — immutable financial reversal, tax lineage and post-seal authority
**Owner:** Codex implementation; independent non-implementing execution mandatory

## Authority and outcome

The founder requires immutable corrective positive/negative entries, never deletion
or editing, and requires authorized-user-only corrections after business-day seal.
Order262 supplies the independently approved governed line-rounded non-India
positive-tax journal. This order adds one exact full reversal of that journal by a
new balanced contra journal while preserving every original posting, attribution,
route and binding byte-for-byte.

## Exact scope

- `migrations/0045_governed_positive_tax_correction.sql`;
- `src/contexts/financials/positive-tax-corrections.ts` and the financials public
  index only;
- `tests/positive-tax-correction.intentional-red.test.ts`,
  `tests/positive-tax-correction.integration.test.ts` and directly affected
  migration/acceptance/runtime-DML/SECURITY-DEFINER/schema fixtures only;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/EVENTS.md`, BUILD-PLAN,
  ROADMAP, this order, decisions, ledger and independent review evidence.

## Required behavior

1. `PositiveTaxCorrectionService.reverse` accepts only exact tenant, original
   positive-tax journal id, bounded visible reason, server-derived post-seal
   authority, idempotency key and canonical `journal.posted` audit envelope. No
   money, tax, folio, account, route, date or posting-line input is accepted.
2. PostgreSQL proves the target is one exact Order262 journal with its canonical
   positive-tax binding, attribution, reservation/segment/primary-folio lineage,
   configured frozen route evidence and complete balanced posting set. India or
   negative-tax paths remain rejected.
3. Lock globally sorted involved accounts/folio, the original journal identity and
   exact relevant financial business dates; re-read all eligibility after locks.
   Twenty contenders converge to one reversal under existing
   `journal_one_reversal`; replay returns the same result and changed reuse fails.
4. Create one current property-local `adjustment` journal with
   `reverses=original.id`; copy every original line in sequence with exact sign-
   negated amount, original account/folio/tx-code/description/quantity/currency and
   no re-routing. Original journal, lines, attribution, binding and tax components
   remain immutable.
5. The reversal root alone receives canonical tax-detail v2 reversal evidence that
   references the original positive-tax journal/binding and declares
   `effect=full_reversal`; non-root copied lines retain their exact original tax
   detail only where the approved contract requires it. The complete reversal must
   sum to zero and exactly nullify every original account effect.
6. Before seal, `financials.adjustments:write` is sufficient. If either the original
   business day or current posting day is sealed, exact property-scoped
   `financials.adjustments:post-seal` is additionally required. Body/header claims
   cannot manufacture authority; denial is zero-mutation.
7. Journal, posting lines, reversal-root binding, fact, `journal.posted` outbox and
   `tax.attribution_reversed` outbox commit atomically. Publication failure and every
   policy/shape/race failure roll back without artifact.
8. Raw app/runtime DML remains denied; owner-mediated fixed-search-path functions
   expose only the bounded header/root operations needed by this service. Existing
   table count and RLS-policy count remain 98 and 88.

## Forbidden

No UPDATE/DELETE of financial or tax history; no partial reversal, replacement
charge, refund/payment/settlement, folio transfer, document/IRP, India/negative-tax,
current route recomputation, client-derived money/tax/date/authority, new table,
seed/local-runtime mutation, second local, merge, public deployment, Phase7 or
application-complete claim.

## Required proof

- intentional red precedes implementation;
- exact line-for-line sign-negation, zero sum, root lineage and immutable original;
- open-day operator success, sealed-day operator/forged-authority denial and exact
  authorized approver success;
- replay, changed key, 20-way contention, publication rollback, account/folio/route/
  day/binding races and hostile cross-tenant/property/actor/input coverage;
- raw DML/ACL/RLS/SECURITY-DEFINER denial, migration replay/checksum, exact schema,
  database acceptance, correction/statement regressions and full standing gates;
- `./setup.sh --db-only` reports `11 passed, 0 failed` before review;
- an independent non-implementing Tier-3 reviewer personally executes the relevant
  proofs and records approval or findings.

## Definition of done

- [ ] Migration and service implement the exact immutable full reversal.
- [ ] Focused, adjacent, standing, schema and referee proofs are green.
- [ ] Independent Tier-3 review records approval or findings.
- [ ] A later separately governed status/local-promotion order may expose approved
  work on the sole local; this order does not mutate it.

## Runtime-scope incident — D692

During the migration lane, an attempted disposable database setup incorrectly used
the stable Compose project with alternate host-port variables. Compose recreated the
sole-local PostgreSQL and Valkey containers and PostgreSQL was subsequently restarted;
the app container was not recreated. The retained PostgreSQL volume remained mounted,
but a seeded scratch database `yellow_order266_migration` was added to that cluster.
Migration0045 did not apply to `yellow_dev` because its runner stopped at the existing
migration44 checksum identity guard.

The coordinator immediately stopped all worker runtime activity and quarantined every
promotion claim. Read-only verification proves the unchanged app is healthy on sole
loopback3000, `yellow_dev` remains exact migration44/98 tables/88 policies/two
properties, and its canonical all-table row-count digest remains byte-exact
`739b6a2d929a2278064e35935351f32fcc9290c16da2db9b5072e9640ed28763`.
The prior PostgreSQL/Valkey container identities are nevertheless lost, cache identity
changed, and the scratch database remains. A separate governed reconciliation order
must back up and prove product truth, remove only the disclosed scratch database,
accept the replacement container identities, and obtain independent non-operating
verification before Order266 database execution resumes.
