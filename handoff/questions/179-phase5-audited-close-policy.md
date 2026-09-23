# Question 179 — Phase-5 audited-close blocking and carry policy

**Status:** RESOLVED-D990
**Raised by:** Codex Phase-5 exact gap audit after approved Order347/D989
**Date:** 2026-09-02

## Why founder product intent is required

The repository fixes automatic roll, asynchronous seal, carry-by-approval and the
canonical `business_day.opened` / `business_day.sealed` event names. It does not fix
three product-policy inputs needed before an executable readiness/carry/seal command
can be honest:

1. `docs/STATE-MACHINES.md` requires outbox lag below a threshold but defines neither
   the metric nor the threshold;
2. it requires interface queues drained but does not identify the blocking consumers,
   statuses or property/date attribution; and
3. it permits discrepancy carry by approval but does not define the exact binding,
   expiry/freshness, one-use consumption or old/new discrepancy effect.

Existing mockup values are illustrative, not authority. Generic approval state and
existing outbox/channel/fiscal/statutory tables cannot silently choose business policy.

## Recommended founder decision

Approve this complete default, or replace any numbered clause:

1. **Lag:** readiness uses the oldest unpublished property-attributable outbox event;
   ready when its age is below five minutes. No unpublished event means zero lag.
2. **Interfaces:** only persisted, exact-property/exact-business-date financial,
   fiscal, statutory and channel-delivery work blocks close. A queue without safe
   property/date attribution is surfaced as unknown and fails closed; payload JSON is
   never parsed to invent attribution.
3. **Carry authorization:** an exact request binds tenant, property, discrepancy,
   source business date, already-open target date, reason and request hash. It expires
   after 30 minutes, requires a different authorized approver, is consumed once and
   becomes invalid if the discrepancy or target day changes or target day seals.
4. **Carry effect:** consumption resolves the old discrepancy with immutable
   `carried_forward` evidence and creates one relationally linked unresolved
   discrepancy for the current open day; one fact and canonical
   `discrepancy.carried` outbox event are atomic. It does not seal either day.

## Consequence

After resolution, implementation remains four independently reviewable closures:

1. PostgreSQL-authoritative read-only readiness snapshot;
2. governed discrepancy-carry transition;
3. audited actor-bound seal command; and
4. fresh Phase-5 exit gate.

Until then, no agent may infer exact-zero lag, choose arbitrary queue consumers, treat
generic approval expiry as a TTL, or implement carry/seal under owner authority.

## Resolution

On 2026-09-02 the founder explicitly replied **“approve both recommended policies”**.
Clauses 1–4 above are binding product policy under D990. Implementation may proceed
only through the four bounded closures listed above and their independent reviews.
