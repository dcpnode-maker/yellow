# REVIEW 019–026 — Phase 1 kernel, cumulative exit gate

**Range:** Orders 019–026 · **Reviewed at:** `6bfd2c5` (`origin/phase-2/handoff-state-accuracy`)
**Reviewed by:** Claude Opus 5 (architect role, successor to Claude per D-142)
**Date:** 2026-08-22 · **Verdict:** **APPROVED**

Executed under D-84: every proof below was re-run first-hand in a reviewer worktree.
No result in this file was pasted by the builder.

## Reviewer environment

Detached worktree `~/projects/yellow-review` at exactly
`6bfd2c581377cb43ed59ab1c065375b09c7820d4`, clean. Codex's worktree at
`~/projects/yellow-phase-1` was not touched, and the live founder review stack
(`yellow-phase-1`, ports 5642/3200/6589) stayed up throughout.

## Battery

Reviewer ran `./setup.sh --db-only` on a fresh isolated db-only Compose project
(`yellow-review`, default ports 5442/6389/3000) whose `app` service was never
started, per D-160. No code, configuration, threshold or referee change:

```
RESULT: 11 passed, 0 failed of 11
```

`TC-8.2 100 concurrent invoice numbers gapless  issued=100 range=1..100`

Run twice, green both times. The project and its volume were removed after the
first run; the second was retained for the gate and removed at the end.

## Baseline integrity (re-confirmed across 019–044, not just Phase 1)

| Check | Result |
|---|---|
| `git log -- migrations/0001_init.sql` | only `bc0e492` |
| Baseline SHA-256 | `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923` — exact |
| `0001_init.sql` blob at `61b0fd3` vs `6bfd2c5` | identical (`dce210b2`) |
| `tests/run_invariants.py` blob at `61b0fd3` vs `6bfd2c5` | identical (`0d2b9d53`) — D-69 upheld |
| Range shape | `main` is ancestor of tip, 40 commits, **0 merges** |
| `DECISIONS.log` across range | **+70 / −0** lines over 27 commits — strictly append-only |

## Pre-registered proofs — reviewer-executed

| Order | Tier | Commit | Proofs | Result |
|---|---|---|---|---|
| 019 tenant context | 3 | `9baf60b` | P1–P7 | **6 pass, 0 fail**, 18 expects |
| 020 auth / JWT | 3 | `102c767` | P1–P8 + policy | **12 pass, 0 fail**, 37 expects |
| 021 fact-log envelope | 2 | `64f9cd8` | P1–P4 | **4 pass, 0 fail** |
| 022 EventBus / outbox | 2 | `d3afdf0` | P1–P6 | **7 pass, 0 fail** |
| 023 outbox relay | 3 | `795a770` | P1–P6 + D-94 prune | **6 pass, 0 fail** |
| 024 extension registry | 2 | `d390ac9` | P1–P6 | **6 pass, 0 fail** |
| 025 approval primitive | 2 | `70c3951` | P1–P5 + D-93 | **6 pass, 0 fail** |
| 026 org ltree | 2 | `d10ca75` | P1–P5 | **5 pass, 0 fail** |

**52 proofs, 0 failures.**

## What's right — specifically

**The two proofs the handover said would catch something were written honestly.**
019's P3 asserts the exact expression the order demanded —
`NULLIF(current_setting('app.tenant_id', true), '') IS NULL` — and additionally pins
`pg_backend_pid()` to the first request's backend on a `max: 1` pool, so it proves the
*same physical connection* is clean rather than merely that some connection is. A
byte-equality assertion here would have passed while leaking; this one cannot.

**023's SIGKILL is a real SIGKILL.** `tests/relay.integration.test.ts:122` calls
`process.kill(process.pid, "SIGKILL")` after 25 handled events, and
`src/kernel/relay.ts` registers **no** signal handler — grep confirms there is no
graceful-shutdown path that could soften it into the easy case. This is the order's
hardest line and it was not weakened.

**020's expiry window is the specified one, not a convenient one.** The test asserts
59s past `exp` accepted and 61s rejected; Order 020 line 33 specifies "60s clock-skew
leeway" and `token.ts:2` sets `CLOCK_SKEW_SECONDS = 60`. Spec, implementation and
assertion agree. `alg:none` and algorithm-confusion are both rejected, and a correctly
signed token carrying any extra claim is also rejected — stricter than asked.

**Scope discipline held under audit.** Three commits reach wider than their headline:
021 touches `scripts/seed.ts`, 022 touches `setup.sh`/`setup.ps1`/`state.sh`/`state.ps1`
and a migration, 024 touches `src/app.ts`, `tenant-context.ts`, `resolver.ts` and
`token.ts`. I checked each against its order's Scope block: all three are explicitly
authorized amendments (D-96 correction-only; D-94/D-97 83-table accounting; 024's
API-composition and default-token scopes). **No scope violation in the range.**

## Static assertions the tests cannot make

- All three `set_config('app.tenant_id', …)` call sites in `src/` pass the
  transaction-local flag `true` (`db.ts:40`, `outbox.ts:101`, `local-login.ts:67`).
  No session-level `SET` for tenant anywhere in `src/`. D-10 holds.
- `db.ts` exposes no raw checkout: the pool is `#pool`, and `withTenantTransaction` is
  the only path to a connection. Requirement 6 holds.
- `createApp()` defaults to `failClosedTenantResolver` and an `unavailablePool` that
  throws. The default build fails closed; the header-reading resolver exists only in
  `tests/`. No `src/` file imports from `tests/` (grep clean, 36 files scanned).
- `bun run boundaries`, `bun run typecheck`, `bun run license-check` all pass.

## Changes required

None blocking. Two observations recorded against 019 for a future slice:

1. **`src/kernel/db.ts:52-58`** — the `catch` swallows a failing `ROLLBACK` and the
   `finally` still calls `connection.release()`, returning it to the pool. The inline
   comment asserts "the broken connection is discarded by Bun" — that is an assumption
   about pool internals, and nothing executes it. P5 exercises only the path where
   `ROLLBACK` succeeds. This is F1's shape one level deeper: an unexercised failure
   path on the connection that carries tenant identity. Either prove it or destroy the
   connection explicitly instead of releasing it.
2. **`tests/tenant-context.integration.test.ts:P5`** — the order's "must show" column
   names three things: transaction rolled back, connection returned, next request sees
   no tenant. The test proves the second and third. It never writes a row before
   throwing, so *data* rollback is asserted nowhere. Add a write-then-throw and assert
   the row is absent.

Neither changes the verdict: both are strengthening, not corrections of wrong behaviour.

## Invariant check (reviewer asserts each)

- [x] tenant_id leads every new index — N/A in range; 022's two new tables are
      deploy-owned non-tenant metadata, and its test proves they are RLS-free and
      revoked from `app_role` and `PUBLIC`
- [x] money is bigint minor units — no money surface in Phase 1
- [x] no UPDATE on insert-only tables — 021 P3 proves `app_role` cannot UPDATE or
      DELETE `fact_log`; no such statement exists in `src/`
- [x] occupancy writes go through the choke point only — TC-12.4 `code=42501`
- [x] every cross-context effect emits an outbox event in the same transaction —
      022 P1: mutation and event commit together, rollback publishes neither
- [x] any new view carries `security_invoker = true` — no new views; TC-13.4 confirms
      the two baseline views still carry it
- [x] state transitions exist in STATE-MACHINES.md — updated in range (+28 lines)

## Decisions made during review

Ratification of D-95 → D-160 is recorded in
`handoff/reviews/D-095-160-ratification.md`, together with the single proposed
`DECISIONS.log` entry for this discharge.
