# Order 537 — showcase rate approver grant and release recovery

## Objective

Correct the two missing property-scoped grants for the existing distinct local
rate approver, then resume the exact retained Order536 Locanda workflow and
complete London without duplicating immutable drafts or approvals.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tools/reconcile-public-showcase-rate-approver.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tools/provision-public-showcase-rate-releases.ts`
- focused source tests for the grant and recovery contracts
- exact yellow-demo tenant, existing active `approver@yellow.local`, existing
  `Local Post-Seal Financial Approver` role, and the exact Locanda/London
  showcase property nodes
- `handoff/reviews/537-showcase-rate-approver-grant-and-release-recovery.md`

## Required behaviour

1. The grant reconciliation uses only the loopback deployment connection,
   transaction-local tenant context and one advisory transaction lock.
2. It verifies the exact tenant/user/role/property identities, active user,
   property scenario marker, existing role permissions and zero pre-existing
   approver grants for both target properties before its first execution.
3. It adds only two `user_role` rows binding the existing approver role to the
   exact Locanda and London property nodes. It creates no user, role, permission
   or broader ancestor grant. Exact replay is a no-op; partial or divergent
   topology fails closed.
4. The release helper must authenticate and prove the approver can read the
   rate builder and approval inbox for both properties before any new requester
   mutation.
5. Recovery accepts only the exact retained Locanda state from the reviewed
   failed Order536 attempt: one canonical model/target/release draft, one pending
   approval for that release, no active release, and the original deterministic
   draft/request idempotency evidence. It must not create another Locanda draft
   or request.
6. London must still have zero history before its normal Order536 workflow.
7. The distinct approver decides and publishes the retained Locanda request,
   then London follows the exact fresh four-eyes path. Exact successful request
   replay and postflight evidence remain mandatory.

## Exclusions

- No new identity, role, permission, migration, schema, ancestor grant, public
  login change, provider/OTA call, reservation write, financial write, frontend
  deploy or public app cutover.
- No deletion or mutation of the retained Locanda draft or pending approval.
- No self-approval or weakening of property scope/four-eyes checks.

## Risk and review

This changes tenant-scoped authorization and resumes a sellability transition.
A non-implementing reviewer must inspect and personally execute both stages,
prove the exact two-row grant delta, prove replay/no-op behaviour, then execute
and verify the recovered API state machine. The implementer may not execute the
grant or release recovery.

