# RATIFICATION — D-95 through D-160

**Reviewed at:** `6bfd2c5` · **Reviewed by:** Claude Opus 5 (architect role)
**Date:** 2026-08-22 · **Scope:** 66 decisions, none previously reviewer-ratified

## Log integrity first

| Check | Result |
|---|---|
| D-95 … D-160 present | all 66, **exactly once each**, no duplicates |
| Numbered entries in file | 98 (D-63 … D-160) — consistent, no gaps |
| `DECISIONS.log` diff across `61b0fd3..6bfd2c5` | **+70 / −0** over 27 commits |

Zero lines removed across the whole range. The append-only property D-70 asserts is
not merely claimed; it holds byte-wise over 40 commits and two agents.

## Verdict

**D-95 → D-160 are RATIFIED**, with two amendments (D-89 and D-152, below) and one
ratified-by-reproduction (D-160).

The great majority are the honest record of a builder iterating against failing proofs
— D-96, D-100, D-103–D-106, D-117, D-119–D-120, D-122–D-128, D-130, D-132–D-134,
D-138–D-139, D-141, D-145–D-146, D-151. Each names a red result, the cause, and the
correction, and none resolves a red by weakening the instrument. That is the single
most reassuring property of this range, and it is why 18 unreviewed orders turned out
to carry one defect rather than many.

The self-correcting chain D-107 → D-108 → D-110 → D-111 → D-112 → D-113 deserves
specific mention: it starts by treating a PostgreSQL plan choice as an invariant, and
then explicitly corrects itself — "natural PostgreSQL cost-plan selection is not a
deterministic invariant proof" — and separates semantics from index structure. Reaching
the right conclusion by publicly overturning two of its own prior decisions is exactly
the behaviour D-72 was praised for in the previous handover.

## The load-bearing ones, checked against executed behaviour

These touch occupancy, holds, availability, rates, RLS or tenant context, so I did not
ratify them on description.

| Decision | Claim | How I checked it |
|---|---|---|
| D-98 | `FOR UPDATE SKIP LOCKED` unsafe for multi-consumer outbox; corrects D-94 | 022 P5: two named consumers each receive the complete stream |
| D-99 | advisory lock before INSERT because identity sequences allocate outside commit order | 022 P6: a later publisher cannot allocate past an earlier uncommitted event |
| D-121 | hold is `cart` only, server-computed TTL 1..900 s | 030 P1–P8, 9 pass |
| D-124/D-125 | fail-open composite-mapping edge closed in SQL, counted exactly | 030 P8 + TC-12.4 |
| D-128 | TTL authority is PostgreSQL, not the Bun host clock (host was ~12 s ahead) | 030 green on a machine whose clock I did not synchronise |
| D-129/D-130 | availability is truth, not projection; 500-space budget | 031 P6 corrupt projection cannot alter results; `max_ms=93.39` |
| D-135/D-136 | money is bigint minor units; correction by immutable successor row | 033 and 034 green; `requireAmount` rejects non-bigint |
| D-140 | physical inventory vs commercial sellability stay distinct | 040 P1–P6, OOO blocking vs OOS warning |
| D-143/D-144 | OOO/OOS on the immutable baseline, no migration; policy in `org_node.config` | 037/038 green; `migrations/0001_init.sql` untouched |
| D-149 | Order 037 P7 deadlock failure | **re-ran the failing proof**: now one winner in 74 ms |
| D-155/D-158 | loopback hardening and 16 KiB body ceiling | verified in `server.ts` and all three Compose bindings |

## Amendments

### D-160 — ratified by reproduction, not by explanation

D-160 attributes Order 044's `10/11` to the live application pool sharing PostgreSQL's
connection ceiling with TC-8.2's 100 concurrent clients, and requires an unchanged rerun
on a fresh isolated db-only project. I ran exactly that: fresh `yellow-review` project,
app service never started, no code/config/threshold/referee change.

```
PASS  TC-8.2  100 concurrent invoice numbers gapless  issued=100 range=1..100
RESULT: 11 passed, 0 failed of 11
```

The isolated project and its volume were removed afterwards; the live `yellow-phase-1`
stack stayed up and healthy throughout. D-160's diagnosis is correct, its refusal to
raise PostgreSQL limits or weaken the exact 100-number assertion was right, and
recording an environmental red rather than rerunning quietly was right.

### D-152 — AMENDED (over-applied; produces F10)

D-152's principle is correct: an optional native probe such as `docker info` against an
absent daemon must not leak its status to the caller. Its implementation in `state.ps1`
applies the reset unconditionally after a `try`/`finally` that has **no `catch`**, so a
terminating error that destroys the entire report also exits 0. Reproduced by execution;
see F10 in `handoff/reviews/027-044-phase-2-cumulative.md`.

**Amendment:** the exit-status reset must be conditional on the report having completed,
not on the script having reached its end.

### D-89 — AMENDED (narrower than inherited)

D-89 was carried forward as "the Windows surface cannot be reviewer-executed on any
machine this project owns". Half of that is confirmed: `git.exe` is genuinely absent
from the Windows PATH here, so `state.sh`'s `git.exe`/`wslpath` fallback is unreachable
dead code that has never executed, and the GitHub `windows-state` runner job remains
non-reproducible locally. But `state.ps1` **is** locally executable via
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File`, and running it is what found
F10 — a defect that had survived because the surface was assumed unreviewable.

**Amendment:** D-89's limit applies to the CI `windows-state` job, not to `state.ps1`,
which is reviewer-executable and must be executed at future gates.

## Proposed DECISIONS.log entry

Not appended by me. `DECISIONS.log` carries `merge=union` under D-70 precisely so two
agents can append safely, but the previous architect's precedent at §8 of the handover
was to hand the text over rather than write into a tree the founder had not yet
integrated. I am keeping that precedent. Append verbatim:

```
2026-08-22 · D-161 · Review debt from D-142 is discharged. Orders 019-044 (26 orders) and decisions D-95 through D-160 (66 entries) were reviewed at 6bfd2c5 by Claude Opus 5 in the architect role, executing every pre-registered proof first-hand under D-84 in a detached reviewer worktree, with Codex's worktree and the live founder review stack untouched. VERIFIED: 133 pre-registered proofs across 22 Tier-2 and Tier-3 orders, 0 failures; full suite 194/194 across 31 files; typecheck, import boundaries, license policy and schema-drift all green; referee 11 passed, 0 failed of 11 twice on a fresh isolated db-only Compose project whose app was never started, ratifying D-160 by reproduction; migrations/0001_init.sql touched only by bc0e492 with SHA-256 fe2a9fc9...b30923 unchanged; tests/run_invariants.py byte-identical at 61b0fd3 and 6bfd2c5, so D-69 held across all 40 commits; range strictly linear with zero merges; DECISIONS.log +70/-0 lines over 27 commits, confirming D-70 append-only byte-wise; every commit inside its order's Scope including the three amended-scope commits under D-96, D-94/D-97 and Order 024. FOUND: F10, state.ps1 wraps its report in try/finally with no catch and then sets $global:LASTEXITCODE = 0 unconditionally, so a terminating error such as a missing git aborts the whole report and still exits 0 on the D-58 ground-truth surface; reproduced by execution on Windows PowerShell. D-152 is amended - the exit reset must be conditional on report completion, not on reaching the end of the script. D-89 is amended and narrowed to the CI windows-state job, because state.ps1 is locally executable via powershell.exe -ExecutionPolicy Bypass -File and executing it is what found F10. Rejected: approving the range without executing the Windows surface on the inherited assumption that it was unreviewable; rejected: recording the reviewer's own database-acceptance misconfiguration as a build defect when the test passes 4/4 against its intended fresh-deployment database; rejected: merging any of this to main, and rejected: appending this entry into a tree the founder has not integrated.
```
