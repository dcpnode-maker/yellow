# PHASE 1 PLAN — Kernel (tenancy, extension registry, outbox, fact_log)

**Originally written by:** Claude (historical architect role) · **Date:** 2026-08-15

**Operational owner:** OpenAI Codex · **Status:** planned, not issued

This is the order *sequence*, not the orders. Orders are issued one at a time, each after
the previous one is reviewed — that is the loop, and batching it would forfeit the thing
that caught F1, F6 and F8. This file exists so the builder can see the shape of the phase
and the founder can see the runway.

## Hard prerequisite

**Phase 0 must be merged to `main` first.** Orders 008–015 are reviewed and green but
unmerged pending a second Tier-3 reviewer, and Orders 016–017 are pending. Nothing in
Phase 1 starts before `main` contains the runner, the seed, the CI, and the referee.

## What "no app yet" means, precisely

Phase 0 built the *loop* — the thing that proves work is correct. There is a health
endpoint and 80 tables of schema, and deliberately nothing else. Phase 1 is where the
first real behaviour lands: a request can carry a tenant, a mutation can be recorded, an
event can be published. It is the first phase whose output a person could interact with.

## Order sequence

| # | Order | Tier | Depends on | Why this position |
|---|---|---|---|---|
| 019 | Transaction-local tenant context middleware | **3** | Phase 0 merged | Every later order writes through it. If it is wrong, every RLS guarantee in the schema is decorative. Goes first as a solo Tier-3 gate with an explicit founder decision and executable proof. |
| 020 | `app_user` / role / JWT auth with tenant + scopes | **3** | 019 | `Bun.password` argon2id (D-16). Establishes who the tenant context comes *from*. |
| 021 | `fact_log` write helper + audit envelope on every mutation | 2 | 019 | Insert-only invariant. Must exist before anything mutates, or the first mutations are unaudited and get retrofitted. |
| 022 | `EventBus` interface + in-process outbox consumer (cursor rows) | 2 | 021 | D-14 defers NATS; the interface is what makes that a config change later. |
| 023 | Outbox relay worker, at-least-once, crash/restart dedupe | **3** | 022 | Carries the phase's hardest DoD line: kill mid-batch, restart, nothing lost or duplicated. |
| 024 | `extension_type` + `extension` CRUD with JSON-Schema validation | 2 | 019, 020 | Runtime registration is a DoD line; needs auth and audit already in place. |
| 025 | `approval_request` primitive | 2 | 021 | Referenced by D-06 (day-close discrepancies) and trust accounting. Small, but it unblocks Phase 5. |
| 026 | Org `ltree` queries — property under brand under chain | 2 | 019 | Third DoD line. Independent of the outbox chain, so it can run in parallel with 021–022 if you want two tracks. |

## Decisions needed before specific orders

These are architect decisions I have deliberately **not** made blind. Each is due before
its order is written, not now.

- **Before 021/022 — `pg_cron` for pure-SQL jobs.** BUILD-PLAN raises it for
  `expire_holds` and `prune_outbox` so their timing cannot die with an app worker. It is
  a real dependency addition and needs the DEPENDENCIES.md test applied (permissive
  licence, governance, standard protocol). Not decided.
- **Before 019 — JWT claim shape and scope vocabulary.** Once tokens are issued, changing
  the claim set is a migration of every live session. Worth an explicit decision.
- **Before 022 — dedupe key and the definition of "delivered".** The DoD says no event
  lost *or duplicated*; at-least-once plus dedupe-on-id is the stated approach, and the
  exact idempotency key belongs in DECISIONS.log before code exists.

## Standing constraints for the whole phase

- `migrations/0001_init.sql` stays immutable. New schema goes in `0002_*.sql` and up,
  through the runner, with the checksum discipline D-73 established.
- `tests/run_invariants.py` is architect-only (D-69). Phase 1 adds tests *alongside* it.
- The referee must stay `11 passed, 0 failed of 11` at every order boundary — from Phase 2
  it becomes a hard gate, but there is no reason to let it go red before then.
- Every order carries a Forbidden section and a deferred-review protocol. An order without
  one is written badly (CLAUDE.md).
