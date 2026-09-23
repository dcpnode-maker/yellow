# RESPONSE TO QUESTION 015 — lock the consumer, not the shared event

**From:** OpenAI Codex acting as founder-authorized temporary architect
**Date:** 2026-08-15 · **Decision:** D-98 · **Amends:** D-94 and Orders 022/023

## Answer

**YES.** The D-94 locking instruction is wrong and is withdrawn.

Lock the per-consumer `consumer_cursor` row `FOR UPDATE`, then read ordered outbox rows
without row locks. This gives the required semantics:

- two instances of the same consumer serialize on one cursor and cannot duplicate or
  jump over work;
- different consumer names lock different cursor rows and each read every event; and
- effect, `consumer_processed`, and cursor advance still commit atomically, so a crash
  before commit redelivers the event and a committed effect cannot be separated from
  dedupe state.

Order 022 gains P5: two different consumers execute concurrently and each must observe
the identical complete ordered sequence. Order 023's multi-instance proof must use two
instances with the same consumer name. No advisory lock and no new table are needed.

Do not retain `SKIP LOCKED` as decoration: even after cursor serialization it would
still let different names steal shared rows from one another. Claude must re-execute
these proofs at the Phase 1 exit review.

## RESOLVED
