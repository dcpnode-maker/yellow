# QUESTION 016 — identity seq allocation can commit out of order

**Status:** RESOLVED
**Phase:** 1 · **Order:** 022 · **Branch:** `phase-1/eventbus-outbox-consumer`
**Raised by:** Codex (builder) · **Date:** 2026-08-15
**Invariant:** 9 — durable ordered delivery without gaps

## Conflict

`outbox.seq` is `GENERATED ALWAYS AS IDENTITY`. PostgreSQL sequence allocation is not
transactional. Publisher A can allocate seq 1 and remain open; publisher B can allocate
seq 2 and commit. A consumer then sees seq 2, advances its durable cursor to 2, and can
never select seq 1 when A later commits.

Sorting committed rows by seq does not solve a row that was invisible when the cursor
advanced. `consumer_processed` also cannot recover it because selection excludes
`seq <= last_seq`.

## Decision requested

May `publish()` acquire one fixed transaction advisory lock immediately before its
outbox INSERT? The lock is held to caller commit/rollback, making seq allocation follow
commit order without a schema change. Add a proof that publisher B cannot complete its
INSERT while publisher A holds the earlier uncommitted event.

## RESOLVED

Answered **YES** by `handoff/questions/016-ARCHITECT-RESPONSE.md` under D-95.
