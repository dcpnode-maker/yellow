# QUESTION 015 — SKIP LOCKED on shared outbox rows loses events across consumers

**Status:** RESOLVED
**Phase:** 1 · **Orders:** 022/023 · **Branch:** `phase-1/eventbus-outbox-consumer`
**Raised by:** Codex (builder) · **Date:** 2026-08-15
**Invariant:** 9 — every relevant state change must reach every registered consumer

## Conflict

D-94 requires each named consumer to keep its own cursor and processed set, but also
requires `SELECT ... FROM outbox ... FOR UPDATE SKIP LOCKED`. PostgreSQL row locks are
on the shared outbox row, not namespaced by consumer.

If `projection-rebuilder` locks seq 1 while `notifier` selects concurrently, notifier
skips seq 1. If it processes seq 2 and advances its own cursor to 2, seq 1 is now behind
that cursor forever. `consumer_processed` cannot repair an event the consumer never saw.

The same-consumer multi-instance race needs serialization, but the lock must be on that
consumer's cursor row, whose primary key is already the consumer name. Different named
consumers must be allowed to read the same outbox rows concurrently.

## Decision requested

Withdraw D-94's outbox-row `FOR UPDATE SKIP LOCKED` requirement. Require instead:

1. insert the cursor row if absent;
2. lock exactly that consumer's cursor row `FOR UPDATE`;
3. read `outbox WHERE seq > last_seq ORDER BY seq LIMIT n` without row locks;
4. execute effect + processed insert + cursor advance in that transaction; and
5. prove two different named consumers running concurrently each receive the full same
   ordered set, while two instances of one name produce no duplicate effect.

## RESOLVED

Answered **YES** by `handoff/questions/015-ARCHITECT-RESPONSE.md` under D-95.
