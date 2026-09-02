# STATE-MACHINES.md — canonical lifecycles (guards + emitted events)

Statuses live on head tables; every transition also appends `fact_log` + `outbox`.
Transition tables are exhaustive — anything not listed is rejected with `invalid_transition`.

## 1. Reservation (`reservation.status`)

| From | To | Guard | Emits |
|---|---|---|---|
| quote | reserved | availability confirmed via choke-point write of holds→segments; payment/guarantee per policy | reservation.confirmed |
| reserved | due_in | bounded roll: the transaction-stable PostgreSQL calendar date in the stored property timezone equals the latest current `booked` segment's local arrival date; that segment remains `booked` | reservation.due_in |
| reserved/due_in | cancelled | within policy or override(approval); releases occupancy | reservation.cancelled |
| due_in | in_house | exactly one current booked segment is assigned to exactly one active physical room; primary folio window 1 and guest account are open; `unit_condition` is clean/inspected, or dirty/pickup has same-property `stay-operations.checkin:dirty-room-override` plus reason; when property config selects an effective active tenant statutory adapter declaring identity evidence, every reservation Party has a recorded identity document | reservation.checked_in |
| due_in | no_show | day-roll for the arrival date; guarantee policy drives no-show journal | reservation.no_show |
| in_house | due_out | bounded roll: the transaction-stable PostgreSQL calendar date in the stored property timezone equals the latest current `in_house` segment's local departure date; that segment remains `in_house` | reservation.due_out |
| in_house/due_out | checked_out | ALL folio windows settled (balance 0) or transfer-to-AR with permission; occupancy period trimmed to now | reservation.checked_out |
| cancelled/no_show | reserved | reinstate: availability re-check passes | reservation.reinstated |

Segment moves: never edit `period`/unit on a live segment for a room move — close the
segment (`departed`, trim period) and open the next `seq` (new occupancy via choke).
Extensions/shortenings on the SAME unit: release + re-record inside one transaction.

Order 232 makes only the `reserved -> due_in` row executable through a bounded server
worker. It locks and revalidates the coherent parent/latest-segment shape, changes only
the parent status, and commits one `reservation.due_in` fact, outbox row and durable
idempotency result atomically. Exact reruns and contenders converge to one effect;
future, past, foreign, incoherent and non-reserved truth are no-ops, while evidence
failure rolls the whole attempt back. The date is
`(transaction_timestamp() AT TIME ZONE property.timezone)::date`, not an open
`business_day`, caller/browser date or process clock. There is no catch-up, repair,
no-show, check-in, due-out or operator command in this transition.

Order 233 makes only the `in_house -> due_out` row executable through the mirrored
bounded worker. It locks and revalidates the coherent parent/latest-segment shape,
changes only the parent, and commits one `reservation.due_out` fact, outbox row and
durable idempotency result atomically. The latest segment and its occupancy remain
unchanged `in_house`; checkout stays a separate explicit command. The same
transaction-stable property-local calendar date owns admission and evidence, with no
`business_day`, caller clock, catch-up, financial or room-state inference.

Order 200 makes the `due_in -> in_house` row executable through a server-owned
readiness snapshot and an actor-bound idempotent command. The reservation and exact
active segment change together; fact and outbox share that transaction. Readiness is
re-read under lock at commit, so browser booleans and stale previews have no authority.
The transition does not alter occupancy, folio/account state, money, keys, business
day or statutory-submission state. Check-out and every other Phase-6 transition remain
outside this active slice.

Order 231's due-in room assignment is not a reservation or segment status transition.
It admits only one `due_in` reservation whose one latest `booked` segment has null
assignment and zero segment occupancy. One deliberate command revalidates a
server-admitted same-type physical-room candidate, records occupancy through the
existing choke point and changes only that segment's `sellable_unit_id` from null to
the selected value in the same transaction as existing minimized evidence. Existing
assignments cannot use this path; room moves still close/trim and append a segment.
Assignment preserves `due_in`/`booked`, does not infer room condition or readiness and
never invokes the separate `due_in -> in_house` check-in command.

## 2. Folio (`folio.status`) — open → settled → closed

| From | To | Exact guard/effect |
|---|---|---|
| open | settled | property-owned guest account is open; canonical locked `folio_balance` is exactly 0; one guarded PostgreSQL transition plus `folio.settled` fact/outbox evidence |
| settled | closed | the same account/property relationship remains canonical and open; locked balance is still exactly 0; one guarded transition plus `folio.closed` fact/outbox evidence |

Every folio window transitions independently. There is no reopen, force or non-zero
path. Settlement/closure creates no balancing journal and changes no journal or posting
line. It does not close the account or reservation and does not imply payment/provider
settlement, checkout, invoice/document issue, fiscalization, tax or business-day close.
Later corrections post through a separately governed open window; immutable history is
never edited.

## 3. Business day — open → **sealed** via `seal_business_day()`.
The function is currently deployment-owner-only as a temporary least-privilege
containment boundary. No application day-close command exists yet. Future application
execution requires an authorized, audited domain command with server-derived actor
evidence; owner execution is not the completed continuous day-close product.
**Roll ≠ seal.** The day ROLLS automatically: a scheduler opens the next business_day
row at the property-local cutoff and emits `business_day.opened` — it never waits for the prior
day's seal. Operations always target the current OPEN day; multiple unsealed days may
coexist (surfaced as a close-backlog alert, never an operational block).
SEAL is the asynchronous financial finalisation. Pre-seal validation checklist
(surfaced continuously as the readiness dashboard): no unresolved due_in/due_out for
the date · no open cashier_session · no unresolved discrepancies · outbox lag <
threshold · interface queues drained. A blocking discrepancy may be **carried forward**
to the open day via approval_request (emits `discrepancy.carried`) so a seal is never
hostage to absent staff. Post-seal: only adjustment/correction journals (DB-enforced).
Emits business_day.sealed.

Order 349 makes the pre-seal checklist executable as a read-only snapshot only. It
binds an exact open backlog day and reports typed operational blockers, strict
sub-five-minute exact-target outbox lag, and unknown/fail-closed interface work where
the present schema cannot safely attribute an exact business date. It performs no
transition and cannot be reused as seal authorization; carry and seal remain separate
commands that must revalidate current PostgreSQL truth.

### 3a. Cashier session — open → closed

Opening binds one property drawer, one custodian and the current property-local open
business day to an immutable denomination count. One open session per drawer and one
per tenant user are hard constraints. An open session may append immutable blind
recounts; no count or line may be edited or removed.

Close selects one submitted count and derives `over_short = counted - expected` in
PostgreSQL. Zero closes directly. Non-zero close requires a reason and an approved
different-user, one-use request bound to the exact server totals. Supervisor close of
an abandoned session additionally requires a distinct closer, a fresh closer-owned
count and a reason. Closed is terminal: no reopen, mutation or silent balancing entry.
Emits `cashier.opened`, `cashier.counted` and `cashier.closed`.

### 3b. Direct-billing receivable transfer — preview → approved where required → posted

Preview is read-only and derives the exact current positive guest-folio balance,
receivable exposure, credit limit and projected exposure. Within-limit preview may
post directly. Over-limit preview requires a pending request, then a different-user
approval; rejection is terminal under the existing approval state machine.

Posting re-locks and revalidates every bound value, consumes at most one approval and
creates one balanced immutable transfer journal. The command has no mutable transfer
head or reopen transition: replay returns the original effect and changed/stale input
conflicts. The guest folio becomes zero but remains open until the separate settlement
state machine runs. Emits `receivable.transferred`.

## 4. Task — open → assigned → in_progress → done → verified (HK inspection) ;
any → cancelled.

Order 201 executes only the existing adjacent housekeeping subset: start is
`assigned -> in_progress` and preserves authoritative room condition; complete is
`in_progress -> done`, requires dirty/pickup and atomically changes it to clean;
verify is `done -> verified`, requires clean and atomically changes it to inspected.
Each action binds expected task status, room condition and condition `updated_at`.
Open/assignment, cancellation, reopen and non-housekeeping task transitions remain
non-executable in this slice. Emits `task.status_changed` and, only where the room
condition changes, `unit.condition_changed`.

Order 227 admits one absence-only initialization before this condition-transition
machine has a current row. An active exact-property room with no `unit_condition` may
be initialized deliberately to `clean`, `dirty` or `pickup`; `inspected` is forbidden
because it remains evidence of the `done -> verified` transition. Parent-room locking
serializes contenders and an existing condition is a stale conflict, never an update
or upsert. This initialization creates no task state and emits only
`unit.condition_changed` with `previous_condition: null`.

Order 213 may create one `open` `guest_request` task as a create-only effect of
current arrival pickup intent. It does not execute an `open -> assigned` or any other
task transition. The task stays governed by this canonical machine; assignment,
cancellation and transport-specific completion remain later commands.

Order 228 executes only the arrival-pickup subset for the exact currently linked
canonical Order213 task: assign is `open -> assigned` and requires one active
same-tenant staff Party; start is `assigned -> in_progress`; complete is
`in_progress -> done` and records the server completion instant. Every action binds
expected status and nullable assignee evidence. Reassignment, cancel, reopen, verify,
non-adjacent and non-pickup task transitions remain non-executable. Each changed
transition emits `task.status_changed` and changes no travel, reservation, occupancy,
vehicle, parking, room-condition, financial, day or statutory state.

Order 229 is a create-only entry into the existing machine at `assigned`. For one
coherent dirty/pickup due-in room and one selected active same-tenant staff Party, it
may insert exactly one `housekeeping`/`space` task already assigned to that Party. If
one assigned or in-progress exact-room housekeeping task exists, the command returns
it without a transition or event. Multiple actionable tasks fail closed; open, done,
verified, cancelled and unrelated tasks are neither adopted nor mutated. Later
`assigned -> in_progress -> done -> verified` work remains owned by Order 201. Creation
emits `task.created` only and changes no room condition, reservation, check-in,
occupancy, financial, day or statutory state.

## 5. Block (`reservation_group`, kind=block) — statuses come from `block_status_def`
(tenant config); the ONLY semantic the engine reads is `deducts`. Transitions between
statuses re-sync `availability_projection` deltas. Cutoff & wash run as Automations
(action `wash_release`) emitting block.rooms_released. Pickup = reservation created
with `group_id` (consumes allotment before house inventory when `deducts`).

## 6. Hold — active → consumed (segment created; occupancy transfers slot_ref) |
expired (sweep) | released. Offline lease pool: client keeps N active `offline_lease`
holds while online; offline walk-ins may consume ONLY those (v2 §5.1).

## 7. Payment — auth → incremental_auth* → one capture | void ; capture → refund*.
Every command appends a prepared attempt and a provider result. Failed attempts do not
advance state; an indeterminate result blocks every later phase except reconciliation.
Auth, increment and void never create journals. The single successful capture may be
partial, terminates unused authority, cannot exceed the locked positive folio balance,
and posts guest `-amount` / governed clearing `+amount`. Each partial refund is bounded
by the captured remainder, posts the exact opposite signs, and links to the capture
payment and journal without using correction-only `journal.reverses`. Void is terminal.

### 7a. Hosted deposit request and application

`ready → capture_pending → captured | failed`; `ready | capture_pending → expired`,
and regeneration changes the prior active generation to `revoked`. A browser return
never transitions the request: only the signed provider receipt reconciled through the
payment state machine can establish captured/failed truth. Late approved truth may
replace an informational timeout because provider reconciliation remains authoritative.

Application is not a hosted-request state transition. Each application appends one
immutable record and balanced journal while `sum(applications) ≤ captured amount` and
the locked folio balance remains positive. Concurrent losers conflict; no application
is allowed for ready, pending, failed, expired, revoked or foreign capture state.

## 8. Document (fiscal) — draft → issued (number+hash assigned, series advanced,
prev_hash chained) → cleared|rejected (fiscal_submission) ; issued→void only where
jurisdiction permits, else credit-note document. Emits document.issued / .cleared.

## 9. Approval (`approval_request.status`) — added by D-93 (Question 011)

```
pending ──approve──▶ approved   (terminal)
pending ──reject───▶ rejected   (terminal)
pending ──expire───▶ expired    (terminal)
```

Exhaustive. All three terminal states are final: no reopen, no transition out of a
terminal state, no `pending → pending`. Reversing a decision creates a **new**
`approval_request` against the same `(subject_type, subject_id)`.

`expire` is **system-driven** and carries no `decided_by`; `approve` and `reject` require
one, and `requested_by <> decided_by` is enforced at the primitive — a requester may never
approve their own request.

**Storage:** mutable head row + append-only `fact_log` history. `approval_request` is
deliberately absent from the baseline's R4 insert-only list, and D-05's insert-only rule
scopes to financials, rates, occupancy and config — not to this table.

**Concurrency:** the decision is a guarded update,
`UPDATE approval_request SET status=$2, decided_by=$3, decided_at=now() WHERE id=$1 AND status='pending'`.
Two simultaneous decisions cannot both win; a zero-row update is a conflict and is
reported as one, never retried into success.

Emits `approval.requested` on creation and `approval.decided` on any terminal transition,
through the `EventBus` port, in the same transaction as the state change.

## 10. Discrepancy — unresolved creation only (Order 235)

Order 235 adds no discrepancy transition. It may create one unresolved row for one
exact active physical room only when an explicit observation differs from coherent
server-derived current stay/occupancy truth. Its immutable classification at creation
is `sleep`, `skip` or `person`, encoded by canonical reported/system tokens.

Matching truth is a no-op. While an unresolved row exists, exact evidence is replayed
and different evidence conflicts; neither path changes the row. Resolution,
carry-forward, queue linkage, message/alert creation, update and deletion remain
outside this slice. Therefore no `unresolved -> resolved` transition is executable by
Order 235 even though the baseline retains `resolved_at` and `resolution` for a later
governed workflow.

## 11. Vehicle parking — unassigned to assigned only (Order 236)

```
unassigned --assign one admitted parking space--> assigned
assigned --canonical segment checkout/release--> unassigned
```

Order 236 exposes only that create transition for one onsite reservation-linked
vehicle with one coherent current in-house segment. PostgreSQL creates the exclusive
parking occupancy claim before atomically binding `vehicle.parking_space`. Exact
same-target replay returns the existing assignment; another target or incoherent
truth conflicts without a state change. The second transition is not a parking
command: existing segment checkout validates and releases the claim and clears its
pointer atomically. Replacement, manual release, reassignment,
entry/exit, staff/visitor parking and history are outside this state machine.
