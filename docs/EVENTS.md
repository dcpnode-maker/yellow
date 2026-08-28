# EVENTS.md — the event contract & catalogue

Events are the ONLY cross-context effect mechanism. Written to `outbox` in the same
transaction as the state change (Invariant 9); relayed by the poller (100–250 ms) to
NATS JetStream subject `pms.<tenant>.<context>.<event_type>`.

## Envelope (every event)

```json
{
  "id": "uuid", "seq": 123456,
  "tenant_id": "uuid", "property_node": "uuid|null",
  "business_date": "2026-08-13",
  "aggregate_type": "reservation", "aggregate_id": "uuid",
  "event_type": "reservation.checked_in", "event_version": 1,
  "actor_id": "uuid|null",
  "correlation_id": "uuid", "causation_id": "uuid|null",
  "occurred_at": "iso", "payload": { }
}
```

Rules: payloads are **facts, not entities** (ids + the deltas that matter, never whole
rows) · additive changes bump nothing; breaking changes bump `event_version` and old
consumers keep working on v(n-1) · consumers are idempotent on `id` · replay = re-read
outbox by `seq` (SQL) or JetStream by offset.

## Catalogue v1 (producer → notable consumers)

**inventory** · space.created · unit_type.created · sellable_unit.created {unit_type_id,space_claims[{space_id,claim_mode}]} · inventory.policy.changed {policy,previous,value} · occupancy.recorded {slot_kind,space_id,period,claim} · occupancy.released · hold.created/.consumed/.expired/.released · restriction.changed · ooo.opened/.closed
→ availability-projection rebuilder, ARI push, Valkey invalidator

**rates** · policy.created {kind} · rate_plan.created {code,currency,policy_ids} · rate_price.created {rate_plan_id,unit_type_id,stay_dates,dow_mask,currency} · rate_price.superseded {old_rate_price_id,new_rate_price_id,currency}
→ quote versioning, direct-booking cache invalidation, distribution ARI

**reservations** · reservation.confirmed {segments[{unit_type,period,rate_plan}],channel} · .modified {diff} · .cancelled {reason,penalty_journal?} · .no_show · .checked_in {segment_id,space_id,primary_folio_id,room_condition,dirty_room_override_used,dirty_room_override_reason?,statutory_adapter_key?,identity_evidence_required,identity_evidence_satisfied} · .checked_out · .reinstated · .due_in/.due_out · segment.moved {from_space,to_space} · group.status_changed {deducts_delta} · block.rooms_released
→ folio automations, HK task generation, statutory scheduler, stats, ARI, messaging

`reservation.checked_in` is the minimized evidence of the exact reservation and active
segment entering `in_house` together. It may name the room, primary folio and configured
adapter key, but never includes Party, identity-document, contact, credential or legal
field values. Override authority is recorded only as use/reason after server-derived
authorization. Consumers must not infer key issue, occupancy mutation, posting/payment,
folio settlement, statutory submission, business-day movement or checkout.

Order 212 reuses `reservation.modified` for a changed travel compare-and-set. Its
minimized diff is `{travel:{direction,before,after}}`, where each present tuple contains
only mode, carrier, service number, canonical scheduled instant and pickup-requested
intent. Create has `before:null`; exact no-op emits no fact or event. The event contains
no travel id, note, pickup-task id, Party/contact, vehicle/parking, occupancy, financial
or statutory data. Consumers must not infer pickup-task creation, transport completion,
onsite presence, room occupancy or any charge from the recorded intent.

Order 213 consumes `reservation.modified` only as a wake-up signal and re-reads the
current locked arrival row. A qualifying unlinked pickup request produces exactly one
`task.created` fact/outbox pair with aggregate type `task`. Its minimized payload is
`{taskId,kind:'guest_request',subjectType:'reservation',subjectId,department:'transport',
dueAt}`. Actor and correlation are copied from the source event and causation is the
source event id. The consumer marker, task, travel link, fact and event commit in one
transaction. No-op source truth emits nothing. Consumers must not infer assignment,
dispatch, driver/vehicle, contact, onsite arrival, completion, charge or occupancy.

**financials** · journal.posted {kind,lines:[{account,folio?,tx_code,amount_minor}],payment_id?,operation_id?} · folio.opened {folio_id,account_id,reservation_id,window_no,folio_no,name?} · folio.settled/.closed {folio_id,account_id,reservation_id,window_no,previous_status,status} · payment.authorized/.incrementally_authorized/.captured/.refunded/.voided/.failed/.indeterminate/.reconciled {operation_id,payment_id,phase,outcome,amount_minor,currency,journal_id?} · credit.limit_breached · cashier.opened/.counted/.closed {session_id,drawer_id,count_id?,over_short_minor?} · business_day.opened/.sealed · deposit.requested {hosted_request_id,operation_id,folio_id,amount_minor,currency,expires_at,generation} · deposit.applied {application_id,hosted_request_id,operation_id,folio_id,amount_minor,journal_id} · deposit.matured
→ documents, AR, trust splits (Automation), dashboards, GL export

`folio.settled` and `folio.closed` describe only a monotonic, exact-zero folio-window
state transition. Their producer writes one fact and one outbox row in the same tenant
transaction as the bounded PostgreSQL transition and durable idempotent response. They
contain identifiers and state only: no contact, instrument/token, payment, journal,
invoice/fiscal or client-supplied balance data. Consumers must not infer checkout,
account closure, payment-provider settlement, document issue or business-day close.

`cashier.opened`, `cashier.counted` and `cashier.closed` describe attributable cash
custody only. The producer writes the fact and outbox row with the governed session
transition. Events contain session/drawer/count identifiers and terminal over/short
only where applicable; they contain no denomination, account, payment, instrument,
journal or caller-supplied total. Consumers must not infer cash posting, discrepancy
write-off, provider settlement or business-day seal.

`receivable.transferred` describes one immutable guest-debt transfer. Its minimized
payload contains only guest folio/account, receivable account/party, exact amount,
currency, journal and approval identifier where consumed. The producer writes the
fact and outbox row in the same transaction as the balanced journal. Consumers must
not infer an AR invoice, allocation, aging state, external accounting export, checkout,
document issue, fiscalization or folio settlement from this event.

**housekeeping/stay** · unit.condition_changed · task.created/.status_changed · discrepancy.reported/.resolved · queue.entered/.cleared · message.received/.sent

Order 201 produces `task.status_changed` for each governed adjacent housekeeping
transition. Its minimized payload identifies the task, space, previous/current task
status and action. Complete and verify additionally produce
`unit.condition_changed`, containing the space and previous/current condition; start
does not emit a condition event because it does not change condition. The matching
fact(s), outbox row(s), task status, completion time and condition actor/time commit in
one transaction. These events contain no assignee/guest PII and do not imply task
creation, sheets/cadence, occupancy, reservation, financial or statutory effects.

Order 227 also produces `unit.condition_changed` when an authorized actor deliberately
records the first condition for an active exact-property room. The minimized payload
contains the space, `previous_condition: null`, the explicitly selected `clean`,
`dirty` or `pickup` condition, and the server-recorded update instant. `inspected`
remains available only through the governed verification transition. The inserted
condition, matching fact and outbox row commit in one transaction and imply no task,
reservation, check-in, occupancy, OOO/OOS, financial, day or statutory effect.

Order 202 produces one `task.created` fact/outbox pair for every task created by one
governed task-sheet generation transaction. Its minimized payload identifies the
task, sheet, physical space, property-local sheet date and resolved cadence; it does
not carry guest or attendant PII. The `task_sheet`, all assigned tasks and every
matching fact/outbox row commit together. Replay or concurrency does not publish a
second event for the same deterministic sheet/space task. Consumers must not infer a
task transition, condition change, reservation/occupancy mutation, credit allocation,
financial effect, business-day action or statutory submission from `task.created`.

**profiles** · party.created/.merged {into} · party.anonymised · consent.changed

**distribution** · inbound.received {channel,external_id} · inbound.processed {reservation_id}/.failed · ari.push_requested {channel,unit_types,date_range} · map.changed

**tax/fiscal/statutory** · document.issued {kind,doc_no,hash} · document.cleared/.rejected {authority_ref} · statutory.due {adapter,due_at} · statutory.submitted/.accepted/.failed · erasure.completed

**kernel** · extension.activated {type,key,version} · automation.fired {automation_id,action,result} · approval.requested/.decided

## Consumer registry (who must exist by launch)

projection-rebuilder (availability, stats_daily, folio_balance cache) · valkey-invalidator ·
automation-engine (matches trigger_event, evaluates condition AST, executes action) ·
ari-pusher (per channel, batched 5–30 s adaptive) · statutory-scheduler · document-issuer ·
notifier (email/WA templates) · fiscal-submitter. Each stores its own cursor; all are
disposable and rebuild from outbox (Doctrine 1).
