# STATE-MACHINES.md — canonical lifecycles (guards + emitted events)

Statuses live on head tables; every transition also appends `fact_log` + `outbox`.
Transition tables are exhaustive — anything not listed is rejected with `invalid_transition`.

## 1. Reservation (`reservation.status`)

| From | To | Guard | Emits |
|---|---|---|---|
| quote | reserved | availability confirmed via choke-point write of holds→segments; payment/guarantee per policy | reservation.confirmed |
| reserved | due_in | business_date == arrival date (roll job) | reservation.due_in |
| reserved/due_in | cancelled | within policy or override(approval); releases occupancy | reservation.cancelled |
| due_in | in_house | check-in: id verified per statutory need; folio window ≥1 open; unit assigned & condition ∈ {clean,inspected} or `checkin.dirty_room` permission; keys optional | reservation.checked_in |
| due_in | no_show | day-roll for the arrival date; guarantee policy drives no-show journal | reservation.no_show |
| in_house | due_out | business_date == departure date | reservation.due_out |
| in_house/due_out | checked_out | ALL folio windows settled (balance 0) or transfer-to-AR with permission; occupancy period trimmed to now | reservation.checked_out |
| cancelled/no_show | reserved | reinstate: availability re-check passes | reservation.reinstated |

Segment moves: never edit `period`/unit on a live segment for a room move — close the
segment (`departed`, trim period) and open the next `seq` (new occupancy via choke).
Extensions/shortenings on the SAME unit: release + re-record inside one transaction.

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
row at the property-local cutoff and emits `day.rolled` — it never waits for the prior
day's seal. Operations always target the current OPEN day; multiple unsealed days may
coexist (surfaced as a close-backlog alert, never an operational block).
SEAL is the asynchronous financial finalisation. Pre-seal validation checklist
(surfaced continuously as the readiness dashboard): no unresolved due_in/due_out for
the date · no open cashier_session · no unresolved discrepancies · outbox lag <
threshold · interface queues drained. A blocking discrepancy may be **carried forward**
to the open day via approval_request (emits `discrepancy.carried`) so a seal is never
hostage to absent staff. Post-seal: only adjustment/correction journals (DB-enforced).
Emits business_day.sealed.

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
any → cancelled. HK: verifying a `housekeeping` task sets `unit_condition`
dirty→clean→inspected. Emits task.status_changed (+ unit.condition_changed).

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
