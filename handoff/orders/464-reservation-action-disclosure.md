# Order464 — truthful reservation action disclosure

Status: BUILT, unpublished source, 2026-09-09. Owner: Codex. Phase4 receiving UX defect.

## Outcome and authority

D1422 and docs/design/BUILT-CAPABILITY-MANIFEST.md record status-only controls
shown to readers even though existing write commands correctly reject them.
Use existing lifecycle-write scope and same-property grants to disclose only
available modify/cancel/reinstate actions. This is a read-model/UI correction,
not a new permission, command, transition, table or policy.

## Exact scope and ownership

- Worker: src/http/operator.ts, reservationDetail method only. Derive one shared
  canWriteLifecycleHere predicate from existing scope and property grants; combine
  it with each unchanged status predicate. Preserve alert service availability,
  folio flags, response shape and all command-side authorization rechecks.
- Worker: src/http/operator/operator.js, exact visible label change from
  Edit details to Edit operational details only. No layout or other behavior.
- Tests: tests/operator-reservation-lifecycle.integration.test.ts,
  tests/operator-reservation-read-surface.integration.test.ts,
  tests/operator-founder-reservation-journey.integration.test.ts,
  tests/operator-reservation-action-disclosure.test.ts (new focused suite),
  tests/operator-assets-security.test.ts (only exact label expectation if needed).
- Root documentation: this order, its handoff/reviews/464-reservation-action-disclosure.md,
  docs/CONTRACTS.md (existing action semantics only),
  docs/design/BUILT-CAPABILITY-MANIFEST.md (only this recorded gap),
  docs/PROJECT-STATUS.md, DECISIONS.log and handoff/LEDGER.md.

Preserve paused445 edits and every existing461–463 change. Any other source path
requires a recorded question and explicit technical admission before editing.
No database, runtime, fixture, source publication or dependency actions.

## Proof

Exercise the actual reservationDetail adapter for read-only, same-property writer,
other-property writer and absent write scope. Existing read authorization and
not-found concealment remain. Test all status combinations for the three flags,
unchanged alert/folio flags, no write/transition calls during detail read, and
unchanged direct command denial. Client retains existing server-flag gating.
Root personally runs focused tests, adjacent regression checks, typecheck and
import boundaries and inspects the exact diff before claiming this slice built.
This does not close waitlist offers, Phase4, the application or its live release.

## Executed result

Worker implementation is accepted after root personally inspected the method,
label and focused tests. Root ran the six source/adjacent suites:34 pass,
6 existing DB-gated skips,0 fail,351 assertions; typecheck and198 import boundaries
passed. The four new adapter tests run without DB skips, covering all nine statuses,
reader, wrong-property writer, read concealment, unchanged direct-command denial
and alert service availability. Skipped historical live suites are not claimed
as newly executed DB proof. No migration, write command or tenant authority changed.
