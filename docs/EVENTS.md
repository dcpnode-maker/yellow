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

**inventory** · space.created · unit_type.created · sellable_unit.created {unit_type_id,space_claims[{space_id,claim_mode}]} · occupancy.recorded {slot_kind,space_id,period,claim} · occupancy.released · hold.created/.consumed/.expired/.released · restriction.changed · ooo.opened/.closed
→ availability-projection rebuilder, ARI push, Valkey invalidator

**reservations** · reservation.confirmed {segments[{unit_type,period,rate_plan}],channel} · .modified {diff} · .cancelled {reason,penalty_journal?} · .no_show · .checked_in {segment,space} · .checked_out · .reinstated · .due_in/.due_out · segment.moved {from_space,to_space} · group.status_changed {deducts_delta} · block.rooms_released
→ folio automations, HK task generation, statutory scheduler, stats, ARI, messaging

**financials** · journal.posted {kind,lines:[{account,folio?,tx_code,amount_minor}]} · folio.opened/.settled/.closed · payment.authorized/.captured/.refunded/.failed · credit.limit_breached · cashier.closed {over_short} · business_day.opened/.sealed · deposit.requested/.matured
→ documents, AR, trust splits (Automation), dashboards, GL export

**housekeeping/stay** · unit.condition_changed · task.created/.status_changed · discrepancy.reported/.resolved · queue.entered/.cleared · message.received/.sent

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
