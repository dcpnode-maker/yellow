# Question216 — Deterministic operator invoice replay calendar

Accepted technical repair, 2026-09-07; parent Order440, following the actual
pre-registered CI failure. Root implements; a different agent personally executes
the relevant database proof. This is not a business-policy or fiscal-source change.

## Observed failure

PR92 at 4c46bee35759b26a5a767695e7356841c3d68370, CI34121615979
database job101741338180, failed at12:40:04.528Z on2026-09-07:
tests/india-native-fiscal-operator.integration.test.ts:118 expected the replay
date to differ from the shifted date, but both were2026-09-07. Pago Pago and
UTC share a calendar date during part of each day. The same source passed
earlier in the day. Both the test and its helper were unchanged by Q212.
An independent read-only conversion reproduced the failed instant and positive
control; 780 of1440 minute samples shared the UTC/Pago Pago calendar.

## Exact repair scope

- tests/fixtures/order440-operator-invoices.ts: explicit shared test-zone constants.
- tests/india-native-fiscal-operator.integration.test.ts: use those constants;
  preserve the v2 distinct-date assertion and add it to the v3 replay.
- tests/operator-invoice-clock.test.ts: deterministic failing-instant, positive
  control and all-day/date-boundary regressions on the actual constants.
- This question; handoff/orders/440-fiscal-submission-lifecycle.md;
  handoff/reviews/440-fiscal-provider-and-receipts.md; docs/PROJECT-STATUS.md;
  DECISIONS.log; handoff/LEDGER.md.
- .yellow/evidence/order440-q216/: bounded local proof output, excluded from Git.

Replay returns to Pacific/Kiritimati,25hours ahead of Pacific/Pago_Pago, so
distinct property dates do not depend on the CI hour. No production clock mocking,
new SQL capability, migrations, runner/CI change, skipped assertion, weakened
referee, live hotel record change or new dependencies are admitted.

## Pre-registered proof

1. Extract the existing UTC replay choice into the shared test constant and run
   the new regression red at the actual CI instant. Retain an earlier-hour control.
2. Change only the replay test zone; prove all minute samples across ordinary,
   leap-day and year-boundary UTC dates. Both integration replay paths must use
   this constant and assert the calendar actually changed before replay.
3. An independent reviewer personally runs the complete Q208 real PostgreSQL
   integration suite on a separately admitted suitable synthetic target, with
   required-database flag and separate deployment/runtime credentials. Target
   preflight must preserve the unassigned-permission oracle. Native target
   authority is recorded before mutation; no global-role/template/live writes.
4. Typecheck, focused adjacent proof, exact diff/source checks and complete CI on
   the published source remain required. Unreached Q212 CI acceptance gates stay
   open until actually executed. No merge, runtime promotion or phase closure.

## Independent native execution admission

Read-only reviewer preflight verifies existing
yellow_order440_q212_fresh_20260907 on127.0.0.1:55503 has canonical86 ledger,
unchanged migration86 SHA40c55de6a34fb0f0ba354e5e37d210500038018fa649cf9437e29813fa0b915e,
yellow_deploy ownership, exact seven Q208 capabilities, zero documents:read
assignments and zero other sessions. Two prior synthetic tenants/documents/
submissions are retained. Runtime is non-superuser without BYPASSRLS.

Admit only new synthetic Q208 fixtures from the complete unweakened integration
suite on this existing target, using deployment/runtime URLs in memory and the
required-database flag. Before/after: compare all pre-existing target row values,
ledger, schema/ACL; outside database metadata, global roles/memberships, prior
Q212 target fingerprints and pristine77 template fingerprints. Capture the exact
proof source hashes. Preserve prior tenants and their identity rows, do not remove
their grants to force the initial oracle, do not reset/drop/clone a database or
grant global authority. Unexpected prerequisite mismatch stops this execution.
This is retained86 compatibility proof, not CI's distinct fresh85 gate.

Root red execution with the original UTC replay constant:1pass/4fail,
3970 assertions,285ms; the actual failed instant reproduces2026-09-07 equality
while the earlier-hour control passes. The inequality assertions are preserved.

## Execution receipt and publication boundary

Root repaired temporal proof:5pass/0fail,8644 assertions; adjacent operator and
workflow checks together36pass/0fail,9034 assertions. Typecheck and185-file import
boundary check pass. Independent nonimplementer q212_independent_proof personally
executes the temporal proof5/0(8644) and complete actual PostgreSQL Q208 suite:
10pass/0fail,81 assertions,22.22seconds. Required-database flag is1 and actual
yellow_runtime is separate from deployment authority. Both v2/v3 shifted-date
replay cases and the unchanged initial zero-assignment oracle pass.

All332 pre-existing rows across128 public tables, prior tenant fingerprints,
binary ledger, full owner/ACL schema, four other Q212 targets, pristine77
template, database metadata and global roles/memberships/settings remain exact.
Postmaster15956 remains; no other target sessions. New synthetic fixtures remain
on this target:14 tenants,8 documents,2 submissions and12 read assignments.
Do not rerun the initial-unassigned suite there or erase grants to force green.
The first read-only snapshot attempt had an ambiguous record alias; it performed
no integration/database mutation and was repaired before preflight/execution.

Frozen personally tested SHA256:

- helper: AB3644E7C9A49800AF726B0C703B86866DA04F80BC5C963EF02EBF74BE8E20BB
- integration: D8EA20ACB2AC6DD6D08E991C1B6D0A4BA88F8EB512573714685C548EB67DB370
- temporal test: 42496AC51CE51BD60603E72C445355C5EDDB4E634D4D23D2AA864DE9F86C4A0B

Draft publication includes only these three tests/fixtures and this question.
All unrelated staged source/visual work remains untouched. Complete exact-source
CI (including fresh85, fresh86, populated85-to86, readiness and referee) remains
required before integration. This receipt does not promote the serving85 app.
