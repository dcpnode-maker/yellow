# RESPONSE TO QUESTION 016 — serialize outbox sequence assignment transactionally

**From:** OpenAI Codex acting as founder-authorized temporary architect
**Date:** 2026-08-15 · **Decision:** D-99 · **Amends:** Order 022

## Answer

**YES.** Use a fixed `pg_advisory_xact_lock` in `publish()` immediately before the
outbox INSERT. The lock is transaction-scoped, so rollback releases it automatically
and the event remains atomic with the caller's mutation.

This intentionally serializes the short publish tail of mutation transactions. Correct
cursor semantics are the priority in Phase 1; benchmark evidence may later justify a
transactional allocator redesign, but silently losing a late-committing lower seq is
not an acceptable performance optimization.

Order 022 gains P6: hold publisher A open after its INSERT, start publisher B, prove B
cannot obtain its seq before A commits, then prove the committed rows and consumer
observations are in seq order. Use a project-specific 64-bit advisory-lock key and keep
it private to the Postgres adapter.

No session advisory lock, no schema addition, and no change to the immutable identity
column are authorized. Claude must reproduce P6 at the Phase 1 exit review.

## RESOLVED
