# Order 408 — Governed India final component-tax journal reversal

**Status:** APPROVED — CLOSED D1215
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order407 coordination head `907ef6d`
**Risk tier:** 3 — immutable financial reversal, statutory lineage, tenant/RLS and post-seal authority
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Append one exact full sign-negating contra journal for an approved Order407 India
final component-tax journal. Every original journal, line, tax root, component, route
and binding remains immutable. This is financial/statutory correction evidence only,
not a credit note, tax recalculation, replacement tax or IRP submission.

## Fixed command and semantics

`IndiaFinalComponentTaxCorrectionService.reverse(tx,input)` accepts only tenant,
property, original Order407 journal id, bounded non-empty reason, idempotency key and
authenticated audit envelope. The server derives the exact Order407 binding, current
tax root and complete original line set. It locks and rechecks all authority, then
appends one current-day `adjustment` journal preserving each line's account, folio,
transaction code, description, quantity, currency and tax-detail lineage while
negating every amount exactly and preserving sequence.

Migration0072 adds one insert-only tenant-leading forced-RLS binding from original
Order407 journal/tax root to its sole contra journal. A narrow fixed-search-path
owner header capability creates only the server-derived adjustment header because
`app_role` remains correctly denied direct journal INSERT. A second fixed-search-path
owner capability validates the complete already-inserted contra set, inserts the
root line and appends the binding.
`journal.posted` and
`india_gst.accommodation_final_component_tax_journal_reversed` fact/outbox evidence
and the idempotency receipt commit atomically.

Only an active exact-property actor holding the approved financial-correction
capability may reverse an open-day journal. If the original business day is sealed,
the actor must also hold the existing post-seal correction authority. The contra
always posts on the current open property-local business date; it never reopens or
writes into a sealed day.

One original journal has at most one full reversal. Same-key replay is byte-identical;
changed reuse conflicts; different-key and simultaneous requests converge through
the database binding. Foreign, partial, already-reversed, non-Order407, unbalanced or
stale lineage fails before writes. No caller amount/account/folio/date/tax/component/
route/line payload is accepted.

## Exact scope

- `migrations/0072_governed_india_final_component_tax_correction.sql` (new);
- `src/contexts/financials/india-final-component-tax-corrections.ts` (new) and
  `src/contexts/financials/index.ts`;
- `tests/india-final-component-tax-correction.intentional-red.test.ts` and
  `tests/india-final-component-tax-correction.integration.test.ts` (new);
- mechanical migration72/schema/catalogue/runtime-DML/acceptance/setup oracle
  updates in `tests/schema/expected.sql`, `setup.sh`,
  `tests/setup-current-catalogue-oracle.test.ts`,
  `tests/database-acceptance.integration.test.ts`, `tests/migrate.integration.test.ts`,
  `tests/app-role-nonlogin.integration.test.ts`,
  `tests/runtime-database-authority.integration.test.ts`,
  `tests/financial-postings.integration.test.ts`,
  `tests/positive-tax-correction.integration.test.ts` and directly affected
  SECURITY-DEFINER/runtime-DML fixtures only;
- `docs/CONTRACTS.md`, `docs/EVENTS.md`, `docs/DOMAIN-MODEL-V1.md`, `BUILD-PLAN.md`,
  this order, its review, `DECISIONS.log` and `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before editing.

## Required proof

Intentional red; exact full sign-negation for IGST, CGST+SGST and CGST+UTGST,
zero-rounded components, multi-night residual and signed-int64-safe values; root-only
tax detail and complete reversal lineage; open-day and authorized post-seal paths;
unauthorized actor/capability/property denial; replay/reuse/convergence/contention;
day/account/binding/tax/original-line drift before and after locks; injected rollback;
one-reversal uniqueness; two-tenant RLS; direct INSERT/UPDATE/DELETE and definer-path
containment; complete per-rejection source/route/account/financial/fiscal/fact/outbox/
idempotency census; Orders266/367/406/407 preserved; fresh migration/schema/catalogue/
seed/referee11/11/standing/static gates and fresh independent Tier-3 execution.

## Forbidden

No partial or replacement correction, recomputation, rerouting, edit/delete, refund,
payment, settlement, transfer, credit note, invoice/document/series/number, IRP/
provider/submission, API/UI/seed/local promotion/deploy/merge/push or Phase/application
completion authority.

## Builder evidence — D1212

Candidate implementation is complete in the exact scope. An isolated native
PostgreSQL 16.15 cluster provided the Docker-independent proof path: migrations
1–72 applied; catalogue is 72 migrations, 124 public tables, 114 RLS tables,
114 policies, 23 forced-RLS tables and 2 views; the normalized schema snapshot was
regenerated from that database. The permanent Order408 intentional-red plus live
suite passes 10/10 (106 expectations), including exact full contra entries,
IGST/CGST+SGST/CGST+UTGST, zero/multi-night/int64 boundaries, current-day/post-seal
authority, tenant/actor/replay/rollback census and advisory-lock convergence.
Typecheck, diff check, schema normalization/catalogue oracles and standing tests
pass (1328 passed, 1036 database-gated skips, 0 failed; 19,652 expectations).

The native cluster does not claim Docker-specific acceptance: its Ubuntu version
banner and empty `shared_preload_libraries` differ from the pinned Docker image,
its local proof authentication was trust-scoped, and the feature database contained
Order407 fixtures rather than only the canonical demo tenant. Those environment
assertions are excluded from builder evidence and remain mandatory for the fresh
reviewer's pinned disposable environment. Stable/default databases, local port3000
and retained `.yellow` were untouched. Fresh non-implementing Tier-3 execution is
mandatory before approval.

## Fresh independent review — D1213

Fresh Tier-3 execution on the exact standalone PostgreSQL 16.15 toolchain proves
database acceptance 23/0 and Order408 10/0, but the raw normalized schema comparison
fails because `tests/schema/expected.sql` hard-codes Ubuntu package suffixes in its
two informational dump-header lines. The schema body is otherwise byte-equivalent.
Correct only those two snapshot header lines from an exact accepted dump, then use a
different fresh reviewer for the complete proof. No production change is requested.

## Different fresh independent rereview — D1215

Order409's two-header repair and the complete Order408 candidate are independently
approved at `bec262e`. A different fresh Tier-3 reviewer personally executed the
complete proof on a new SCRAM-authenticated official upstream PostgreSQL 16.15
server with `pg_stat_statements` preloaded. Migrations 1–72, the exact
72/124/114/114/23/2 catalogue, canonical-only seed acceptance 23/0, raw normalized
schema byte equality, Order408 10/0 (106), referee 11/11 and compatible-frontier
Orders266 8/0, 367 18/0, 406 11/0 and 407 18/0 all pass. Standing 1328/0 plus 1036
expected skips and every static/security gate pass. D1213 is discharged. Stable,
default, local port3000 and `.yellow` were untouched; no document, IRP, API/UI/local,
deployment, merge, Phase or application-completion authority is granted.
