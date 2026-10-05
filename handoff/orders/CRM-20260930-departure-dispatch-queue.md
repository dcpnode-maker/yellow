# CRM-20260930 — Departure dispatch queue prioritizes unfinished work

Phase: 7 source lifecycle. Branch: `phase-7/crm-departure-dispatch-queue-20260930`.
Basis: `e06e400a57485cc10a8a35c21dcb1e01b5a667d1`.
Owner: cloud Yellow coordinator. Date: 2026-09-30.
Status: authorized; baseline reproduction, implementation and proof pending.

## Goal and founder authority

The founder corrected the primary priority to CRM operational task distribution:
assignment and follow-through, rather than marketing CRM. Preserve the already
reviewed CRS artifact separately. This finite slice improves the existing departure
guest-request dispatch queue, using the existing `task` primitive and governed
commands. It does not invent a general task lifecycle, department policy or SLA.

The committed property queue selects all confirmed requests by due time/ID and
then limits to100. One hundred older completed tasks can hide a new open task
from dispatch. Prioritize unfinished tasks in property mode while retaining
completed outcomes in spare slots. Reservation history and command receipts must
keep their existing order and behavior. Source inspection establishes this seam;
the same real-database backlog test must fail before the change and pass afterward.

The dirty laptop checkout has not been transferred. Exact current domain-file
hash/change status and queue/test excerpts have been requested here. Build a
separate patch against the pinned basis; do not claim laptop integration or overwrite
its source. Reconciliation proceeds on its own branch with CRM first.

## Exact scope

- `src/contexts/stay-operations/departure-service-coordination.ts`: only the
  property-mode ordering inside `#requests`, preserving every existing WHERE,
  authority, action, command, receipt, result and limit.
- NEW `tests/crm-20260930-departure-dispatch-queue.integration.test.ts`: bounded
  real-PostgreSQL backlog, history, canonical state/receipt, signed-route and
  authorization/no-write proof. Required mode cannot skip missing authority.
- `docs/CONTRACTS.md`: append one precise ordering clarification.
- This order and NEW `handoff/reviews/CRM-20260930-departure-dispatch-queue.md`.
- Append-only scoped `DECISIONS.log` and `handoff/LEDGER.md` proof/priority records.

No other source, test, dependency, schema, index, route, frontend or status file
change is admitted. No mutation or lifecycle definition is introduced. Do not edit
applied migrations. General task/shift/SLA target semantics remain separate work.

## Implementation contract

Read PROJECT first, then AGENTS/current status and state.sh, workflow, roster,
CODEX/TOOLING and relevant task/departure decisions. Preserve current module
boundaries, least-privilege runtime, transaction-local tenant context and RLS.

Property-mode `reservationId===null` sorts task statuses
`open|assigned|in_progress` before other confirmed task statuses, then preserves
`due_at,id` within each group. Non-null reservation mode retains exact `due_at,id`
chronology because every row receives the same ordering rank. Keep LIMIT100.
Completed tasks remain in the property response when space permits; they remain
available in reservation history and completion/replay receipts. Pending and
withdrawn proposal semantics remain unchanged. Do not infer new acknowledgement,
assignment, verification, cancellation, ownership or automatic escalation policy.

## Proof and acceptance

- The unchanged baseline must reproduce100 older done tasks hiding a later open
  request. The candidate returns at most100 rows with the open request first.
  Assigned and in-progress tasks remain prioritized; due/ID ties are deterministic.
- A small property queue still returns completed outcomes; reservation-scoped
  mixed-status history preserves chronology. Checked-out reservation tasks that
  remain unfinished retain existing visibility.
- Use the existing canonical propose/confirm/assign/start/complete commands for
  the tested lifecycle and prove completion receipt and exact idempotent replay.
  No new product command or task store may be introduced for fixtures.
- Real disposable PostgreSQL18 proof must connect as `yellow_runtime`, use
  `app_role` only transaction-locally and bind deployment/runtime to the same
  guarded database. Mounted route uses actual signed tokens. Foreign tenant,
  property, missing scope and current grant/actor revocation remain rejected.
- Fingerprint relevant task/request/fact/outbox/idempotency/occupancy/condition/
  financial content and public sequences around reads, showing no read mutation.
  Fixture writes belong to the disposable test and existing governed commands.
- An independent non-implementer personally inspects and executes the relevant
  authorization/state proof. Run existing departure contract/HTTP/state tests,
  typecheck, boundaries and a COMPLETE basis-to-working diff whitespace check.
- Unmodified `./setup.sh --db-only` must pass11/11 before any reviewable PR.
  Known e06 license and legacy-offer fixture failures remain open; do not weaken
  them or claim all-green release acceptance. No own merge or deployment.

More than100 unfinished requests remains the existing queue budget. This slice
does not establish a complete CRM, staff inbox, shift plan or SLA engine.

Primary commands:

```sh
bun test tests/departure-service-contract.test.ts tests/departure-service-http.test.ts tests/operator-departure-service.test.ts
YELLOW_REQUIRE_CRM_DISPATCH_QUEUE=1 bun test tests/crm-20260930-departure-dispatch-queue.integration.test.ts
bun run typecheck
bun run boundaries
git diff --check e06e400a57485cc10a8a35c21dcb1e01b5a667d1
./setup.sh --db-only
```

No real guest/payment/provider data, credentials/settings transfer, spending,
tunnel, CompSet work, history rewrite, bulk laptop commit, self-merge or deployment.

## Accepted source checkpoint — 2026-09-30

The bounded source correction is implemented. An independent non-implementer
personally ran the exact frozen test sequentially against pristine committed e06
and this candidate: baseline0/1 with14 assertions, candidate1/0 with33 assertions.
The baseline failure is the active-first assertion after100 completed requests;
it is the required reproduction, not a passing release test. The temporary
baseline test was removed and the baseline tracked tree remains unchanged.

Independent required authority controls (missing runtime, owner as runtime and
mismatched target) each exited1 before fixtures with generic errors. Positive
proof used actual signed HTTP, restricted `yellow_runtime` with transaction-local
`app_role`, canonical lifecycle commands, full public-table content fingerprints
and actual public-sequence `last_value,is_called`. It proves real foreign
property/tenant denial, not successful second-tenant queue or pool switching.

Existing departure real-PostgreSQL tests12/0/127 assertions and focused
HTTP/contract tests10/0/40 pass. Independent typecheck and import boundaries pass
(205 TypeScript files). Unmodified canonical `./setup.sh --db-only` completed
11/11 on owned isolated Compose project `yellow-crm-dispatch-referee`; the actual
100-migration schema is unchanged. Complete staged basis diff is checked before
the scoped local commit, including new order/test/review records.

Frozen product SHA-256:
`50446498f208fda3d773b45f4221b2c0c140967a5a2cfaca8411789b1d2cfbb4`.
Frozen test SHA-256:
`f837adc52ae63afbdffb7341c48d3fabd0d271ac758d7e05bd279a2f819a7ee5`.

The independent review records narrow source acceptance. Inherited license
(`tslib`0BSD policy) and legacy-offer regression gates remain red; no PR, push,
merge, deployment, laptop integration or whole-CRM completion is claimed.
Laptop current-source hash/queue excerpts and immutable serving revision/readiness
evidence remain requested. Hotel/STR/Both and low-price single-unit full-core
onboarding/operator delegation remain separate proposed design work.

## STR workflow research handoff — scope remains bounded

The laptop supplied official STR cohort evidence while this slice was reviewed.
Hospitable's teammate portal task acceptance and separate owner access are useful
requirements for later operational distribution:
https://help.hospitable.com/en/articles/4602845-understanding-user-types-in-hospitable-secondary-users-teammates-owners
OwnerRez's distinct property-scoped staff/owner/cleaner access is a relevant
authority precedent:
https://www.ownerrez.com/support/articles/team-access-overview

These requirements do not invent an acknowledgement transition, portal, access
grant or second task store in this order. The existing confirmed departure task
queue is the proved foundation here; later turnover, inspection, maintenance,
teammate acceptance and owner/operator delegation slices must first inspect their
current canonical commands, valid transitions and laptop-only modules. Each later
slice needs exact property/staff permission and independent executable acceptance
and revocation proof. Shared reservations, occupancy, facts and finance remain
authoritative for both Hotel and STR; OTA listing mappings must not duplicate a
physical unit or its occupancy. Portfolio calendars, guest messages, fees/LOS/gaps,
owner contracts/statements/payout controls and the trust-versus-operating distinction
are tracked in the separate Hotel/STR design, not claimed shipped by this queue fix.
