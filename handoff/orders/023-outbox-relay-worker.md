> **AMENDED by `handoff/questions/011-ARCHITECT-RESPONSE.md` (D-94) and
> `handoff/questions/018-ARCHITECT-RESPONSE.md` (D-101) — read both first.**
> **D:** dedupe lives in `consumer_processed` (authorized in `0002_kernel_consumer_cursor.sql`),
> **not** in `published_at` — that is precisely what closes P3's committed-but-unpublished
> window. Claim with `FOR UPDATE SKIP LOCKED`, which is also how P5 is satisfied. Consumer
> effect + `consumer_processed` insert + cursor update commit in **one** transaction. Add a
> prune of `consumer_processed` alongside `prune_outbox` and prove it never deletes rows
> for still-unpublished events.

# ORDER 023 — outbox relay worker, at-least-once, crash-safe

**Phase:** 1 · **Branch:** `phase-1/outbox-relay` · **Tier:** 3
**Written by:** Claude (architect) · **Date:** 2026-08-15 · **Decisions:** D-13, D-14, D-92

## Goal

A relay worker that polls the outbox at 100–250 ms, delivers at least once, marks
`published_at`, and loses nothing when killed mid-batch.

## Why Tier 3

This carries the Phase 1 DoD line *"kill relay mid-batch, restart, no event lost or
duplicated (dedupe on id)"*. Every cross-context effect in every later phase depends on
it, and the failure mode — a silently dropped event — is invisible until a folio does not
balance three phases later.

## The decision this order needs, and my answer

**Dedupe key = the outbox row's own id.** Not a content hash, not a composite. Consumers
record processed ids in their cursor context and skip repeats. At-least-once plus
idempotent consumers, never exactly-once — exactly-once across a process boundary is not
achievable and pretending otherwise pushes the failure somewhere less visible.

## Scope

`src/kernel/relay.ts`, `src/kernel/outbox.ts`, `src/kernel/index.ts`, `tests/relay.integration.test.ts`,
`docker-compose.yml` (only if the relay needs its own service — justify it in the PR).
**No migration** — `published_at` is in the baseline.

## Pre-registered proofs

| # | Proves | Must show |
|---|---|---|
| P1 | Delivery | published events reach the consumer and are marked `published_at` |
| P2 | **Kill mid-batch, restart, nothing lost** | SIGKILL the relay partway through a batch of ≥100; on restart every event is delivered. Use SIGKILL, not SIGTERM — a graceful shutdown proves the easy case |
| P3 | **Nothing duplicated after redelivery** | the same scenario, asserting each event is *processed* exactly once by the consumer despite at-least-once delivery |
| P4 | Poll interval | measured interval within 100–250 ms under idle and under load |
| P5 | Concurrent relays | two relay instances do not double-deliver — either one wins a lock or both are safe by dedupe. State which and prove it |
| P6 | Backlog drain | 10 000 pending rows drain without unbounded memory growth |

P2 and P3 are the order. P5 is the one people forget until a second node exists — and
D-14's whole trigger is a second node.

## Forbidden

Exactly-once claims · deleting outbox rows on delivery (that is `prune_outbox`'s job, and
deleting destroys the redelivery evidence P3 needs) · marking `published_at` before the
consumer confirms · unbounded in-memory batching · adding NATS or any broker dependency ·
editing `migrations/` or `tests/run_invariants.py` · merging.

## Deferred review protocol

If P2 or P3 cannot be made to pass, **stop** — do not weaken the assertion to get green.
Under D-92's hard floor a failing pre-registered proof stops the phase. That is the rule
working, not an obstacle.
