# Review 439 — independent contained fiscal release acceptance

**Order:** 439, with Order438 and Question194
**Reviewer:** Codex `/root/fiscal_readiness`, independent of the implementation
**Date:** 2026-09-05
**Candidate:** `bb3b8f933ce344f9325445dac1e6fc77d646c9de`
**Tree:** `beed050d5e6cd4c1f3be1db9c905bec383d3faaf`
**Verdict:** **APPROVED for the contained operational candidate.**

This approval covers containment of the rejected legacy native-invoice capability
and the proved compatibility of the operational release. It does not approve
Order434, activate its draft functions, complete Phase7, or authorize a claim that a
cloud deployment or the founder's retained local runtime has been refreshed.
A subsequent candidate still requires its exact published head and required CI.

## Independence and exact source binding

The reviewer did not implement the migration, application changes, tests, launcher,
CI repairs or governance changes. The reviewer independently diagnosed the exposed
0074 capability and the first CI failures, inspected the repaired source, verified
the GitHub commit metadata against the local staged tree, and personally initiated
both real executable CI runs by fast-forwarding the candidate branch with
`force: false`. These were genuine GitHub Actions PostgreSQL16/Docker executions;
no local UID workaround, substituted database or builder-only result is claimed.

Candidate parents are `f8743a662cfa13cb235ace4bbed525ca2d06c3cb` and
`6a7cd8a4bc8b58ffe4a4cc94957ef7ff83558bea`. The second parent preserves the
explicit latest PR80 source cutoff, including its unreleased Order434 proof work.

## Release blocker and contained resolution

Migration0074 grants `app_role` execution of
`public.commit_india_native_fiscal_invoice(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid)`.
Review430 remains CHANGES REQUIRED because its canonical provenance authentication
was incomplete. Draft files outside the migration runner do not revoke a runnable
grant and cannot be treated as a release boundary.

Migration `0075_contain_unapproved_native_fiscal_issuance.sql` is a forward-only
revocation of that exact function from PUBLIC, `app_role` and `yellow_runtime`.
Its verified SHA-256 is
`db8b8758e65e41e232663648708616dfa7f071476eda660a7869be5cb1590dee`.
Migrations0001–0074 remain byte-identical to the audited predecessor. The normalized
schema changes only the rejected capability's execution grant; no business table,
function body or existing operational capability is replaced by this containment.

The acceptance oracle checks default-aware PUBLIC ACLs and effective app/runtime
privileges, then actually calls the function through direct `yellow_runtime` and
through its assumed `app_role`. Both fail with SQLSTATE42501 and the exact function
permission denial before the rejected body executes. It verifies fresh75,
74-to-75 upgrade, unchanged prior migration-ledger rows, unchanged core business
census, and a subsequent exact no-op. The current catalogue remains
75 migrations / 125 public tables / 115 RLS tables / 115 policies /
24 FORCE-RLS tables / 2 views.

The historical Order430 success suite requires explicit Order430 deploy/runtime
URLs and rejects any schema except the exact74 frontier. It no longer inherits
generic release database URLs. Current75 acceptance requires denial and does not
re-grant authority to manufacture historical success. The two earlier catalogue
oracles and the positive-tax global census were updated only for the current
catalogue; their financial, replay, rollback, RLS and grant assertions remain.

Order434's evidence and completion fragments remain outside the migration runner;
future runnable assembly is reserved for76/77. No native-v2 HTTP/operator/startup
composition is enabled. Existing approval callers do not opt into the draft-only
approval preparation fields. Preserving those files does not make them a released
invoice path.

## First exact-candidate run — failed and retained

[Run33985891320](https://github.com/dcpnode-maker/yellow/actions/runs/33985891320)
tested `f8743a662cfa13cb235ace4bbed525ca2d06c3cb` and failed. The reviewer
personally initiated it and independently read its job states and logs.

- Quality, Windows state and container smoke passed.
- Local-review passed the protected11/11 referee but failed with
  `Canonical launch seed is absent; run bun run db:seed first`. The launcher had
  invoked the review seed before the canonical seed.
- Database passed39 migration cases,10 seed cases and all5 new containment/readiness
  cases. Its combined compatibility run then had82 passes and2 failures, with1,733
  assertions. Order367 and Order400 both failed SQLSTATE23505 at
  `extension_type(type=tax_jurisdiction)`: canonical seed already owned their
  deliberately fresh fixture key. Later database acceptance, referee and API gates
  were not reached. Earlier server connection-pressure messages predated this
  compatibility step and are not its failure diagnosis.

The repair rebuilds the seed tools image, executes canonical seed, then review seed.
Compatibility now uses a separate Bun process and database per file. The two
fixture-owning Order367/400 suites receive unseeded migrated75 clones; the other
eight receive separate canonical-seeded clones. No fixture deletion, conflict-ignore
repair, skipped case or weakened financial assertion was used to obtain success.

## Personally initiated successful executable proof

[Run33986577250](https://github.com/dcpnode-maker/yellow/actions/runs/33986577250)
was triggered by the reviewer's branch fast-forward to the exact candidate above.
The reviewer independently retrieved and examined all five completed job logs.

| Job | Evidence |
|---|---|
| [quality](https://github.com/dcpnode-maker/yellow/actions/runs/33986577250/job/101361130239) | Passed dependency/license/audit/type checks;1,569 test passes,1,174 explicit environment/database skips,0 failures,21,628 assertions across484 files. Skips are not database proof. |
| [windows-state](https://github.com/dcpnode-maker/yellow/actions/runs/33986577250/job/101361130083) | Native PowerShell state transitions passed on the exact candidate. |
| [container-smoke](https://github.com/dcpnode-maker/yellow/actions/runs/33986577250/job/101361346524) | Pinned runtime image built; exact HTTP200 health body passed. |
| [local-review](https://github.com/dcpnode-maker/yellow/actions/runs/33986577250/job/101361130414) | Actual supported launcher passed the protected11/11 referee, canonical seed, review seed, exact runtime readiness and checked real login, then stopped while preserving its PostgreSQL volume. |
| [database](https://github.com/dcpnode-maker/yellow/actions/runs/33986577250/job/101361346512) | All required real database, migration, seed, containment, compatibility, schema, referee and authenticated runtime gates passed. Details below. |

The database log contains actual Phase3 execution of23/23 suites with isolated
databases. The migration suite passed39/39 cases with182 assertions; seed passed
10/10 with63 assertions. Fresh/upgrade containment and runtime identity passed5/5
with29 assertions. Readiness accepted a direct runtime login and rejected both a
deployment login and a deployment session after `SET LOCAL ROLE yellow_runtime`.

The ten isolated compatibility invocations recorded:

| Scope | Passed | Assertions |
|---|---:|---:|
| Phase5 financial journey | 6 | 58 |
| Financial folio transfers | 8 | 47 |
| Positive-tax correction | 8 | 68 |
| India final component-tax correction | 7 | 92 |
| Business-day seal | 8 | 69 |
| Stay check-in | 8 | 41 |
| Stay checkout | 6 | 68 |
| SECURITY DEFINER containment | 3 | 210 |
| Quoted-rate applicability recording | 18 | 1,030 |
| Final component-tax recording | 17 | 701 |
| Total executed across isolated invocations | 89 | 2,384 |

All ten invocations had zero failures and no reported skips. Per-file execution can
repeat imported contract tests; these totals are executions, not a claim of89
distinct test definitions. The formerly failing Order400 atomic runtime/replay/
rollback case passed, as did Order367 atomic recording/replay/correction.

Fresh deployment acceptance then passed23/23 cases with65 assertions. The exact
normalized schema matched `tests/schema/expected.sql`. A separately migrated,
canonically seeded invariant database passed `11 passed, 0 failed of 11`.
The final real application step passed exact health, build-bound readiness, local
login, authenticated tenant database status and the minimum runtime-session check
for the app and workers. Its shell gates were inspected, and the completed job
passed them without bypass.

The separate local launcher returned runtime target `yellow_runtime_database`,
revision `bb3b8f933ce344f9325445dac1e6fc77d646c9de` and migration frontier75.
Its ready message occurs only after HTTP200 login and validated bearer-token shape.
This proves reproducibility on a clean runner; it does not mean that the temporary
CI URL is reachable from the founder's device.

## Independent governance and preservation checks

The reviewer separately inspected the governance/status changes that it did not
implement. `PROJECT.md` retains the Ten Invariants, module boundaries, protected
referee and required independent high-risk proof. Codex-only coordination and
internal model assignments do not grant self-review, direct-main push, or deployment
authority. The canonical status separates source, review, integration, local runtime
and cloud events and retains18 phases and the dependency-gated11→13→17 priority.

At the candidate snapshot, the reviewer independently checked all51 exact-main
ancestry assertions in `CONSOLIDATION-MANIFEST.json`; all passed. PR70's substantive
parent is also an exact main ancestor, while its unique tip is a status-only file.
The archived source heads remain reachable on their retained refs. PR78/79 are exact
ancestors of the audited release lineage. A live API read confirmed exactly PRs75,
76,78,79,80 remained open and PR80 had reached the preserved6a7cd8a4 cutoff.

The final manifest must record the new consolidation PR, exact source cutoff and
actual closure states without relabeling archived unique work as merged. This
receipt does not pre-approve later lifecycle wording or claim those closures already
happened. Final status/review-only changes require diff inspection and exact-head CI
before independent merge.
