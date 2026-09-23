# Order 610 — reservation cancel, reinstate and no-show surface

## Objective

Expose the existing canonical cancel, reinstate and no-show reservation transitions
through one truthful React/Overwatch action surface with legal-state visibility,
reason capture, separate confirmation, stable retry and authoritative refresh.

## Source authority

Continue only from the independently accepted Order609 candidate at
`D:\Yellow\temp\order609-four-day-sprint-source`.

## Scope

- existing reservation detail/action React files and typed API client;
- existing Overwatch platform operation files required for exact parity;
- focused transition, mounted HTTP and browser tests;
- generated frontend assets, this order and its review.

Freeze the exact file list before editing. No backend command or state-machine edit
is authorized.

## Required behavior

1. Allowed actions come from authoritative state/route evidence, never a client-only
   state table.
2. Each proposal names guest, confirmation, current state, requested state, reason,
   consequences and any blocker. Missing reason or ambiguity asks a question.
3. A separate finite yes confirms one proposal. Drift invalidates consent and
   requires a new proposal.
4. Idempotent retry/unknown-result recovery cannot duplicate a transition.
5. Success requires a matching refreshed reservation/fact view. Hostile or malformed
   receipts fail closed.
6. Manual and Overwatch paths share the same operation lock and command boundary.
7. Illegal transitions, already-complete states and unsupported actions are explicit,
   disabled and non-mutating.

## Forbidden

No migration/schema/seed/permission/new transition/domain command, occupancy repair,
financial/fiscal/payment action, direct SQL, dependency, public operational action,
optimistic success, automatic confirmation, merge or push.

## Acceptance

- focused tests cover every exposed legal/illegal state, reason, replay, concurrency,
  drift, malformed receipt and manual/voice overlap;
- strict TypeScript, boundaries and build pass;
- guarded 240/375/1440 browser proof performs no mutation before confirmation;
- independent non-implementer personally executes the state-transition proof.

