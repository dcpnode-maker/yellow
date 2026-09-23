# GATE 3 REVIEW CONTRACT — standing authorization for Codex

**Written by:** Claude Opus 5 (architect role, independent reviewer) · **Date:** 2026-08-22
**Applies from:** Order 045 onward · **Supersedes:** the per-order blocking review request

## 1. The point of this file

You have been writing one review request per order and marking it `OPEN — independent
architect review required`. `state.sh` then counts each one as open work. Four of them had
accumulated. That is a queue that looks like a blocker and is not one.

**You are not waiting on me. You have never been waiting on me.** D-115 already says
independent review is deferred, never fabricated. This file makes that operational so the
ground-truth script stops implying otherwise.

Founder direction, 2026-08-22: Claude reviews **the application** at a later gate. Until
then Codex proceeds continuously. Claude assists only when Codex is genuinely stuck.

## 2. What you do instead of a blocking review request

Append one row to `handoff/GATE-3-MANIFEST.md` (create it on first use) per completed
order:

```
| Order | Tier | Impl commit | Proof result | Protected hashes | Notes |
```

Then keep going. Do not open a question, do not set a status of `OPEN`, do not wait.

A question file is for something **only an architect decision can resolve**. A completed
order with green proofs is not that; it is review debt, and review debt is recorded, not
awaited. You already know this distinction — D-88 draws exactly the same line between a
precondition you heal and an assertion you stop for.

## 3. The only things that still stop you

Unchanged from ROADMAP.md and D-92. Write `handoff/questions/NNN.md` and wait **only**
for these:

- any edit to an existing file under `migrations/` (adding a new numbered file is not an edit)
- any edit to `tests/run_invariants.py`
- the referee dropping below `11 passed, 0 failed of 11`
- any pre-registered proof that fails and cannot be fixed without weakening an assertion
- any Forbidden-list item, any invariant question, any new dependency
- anything touching money, occupancy, RLS, tenant context, or the audit/outbox envelope
  that is not already explicit in an order and DECISIONS.log

Everything else is recoverable at a gate. Stopping early has never been penalised here and
still is not. Continuing past a floor item is still the only unrecoverable mistake.

## 4. If you are genuinely stuck

Write `handoff/questions/NNN.md` with `## BLOCKED — ARCHITECT NEEDED` as the first line
after the title. That marker is how I find real blockers without reading the whole queue.
Use it sparingly and it will get a fast, specific answer.

## 5. What I will execute at Gate 3 — build to this

Nothing here is new work. It is what I did at Gate 1 and Gate 2, so you can predict it.

1. **Baseline first.** `git log -- migrations/0001_init.sql` shows only `bc0e492`;
   SHA-256 still `fe2a9fc9…b30923`; `tests/run_invariants.py` blob identical to `61b0fd3`.
   Keep quoting both hashes in the manifest — yours matched mine exactly at `6bfd2c5`,
   and that is why your reporting is currently trustworthy.
2. **Referee, isolated.** `./setup.sh --db-only` on a fresh throwaway Compose project with
   the app never started, per D-160/D-191. Requires `11 passed, 0 failed of 11`.
3. **Every Tier-3 pre-registered proof, re-executed by me.** Builder-pasted output is not
   proof under D-84. This is the non-waivable half.
4. **Assertion fidelity, not just green.** I read the test against the order's "must show"
   column before I trust the pass. At Gate 1 this is why 019's P3 counted: it asserts the
   exact `NULLIF(...) IS NULL` expression and pins `pg_backend_pid()`. A green test that
   asserts the wrong thing is F6.
5. **Scope.** Each commit's changed files against its order's Scope block, including
   amended scopes. Gate 1 and Gate 2 had zero violations; keep that record.
6. **The Windows surface.** `state.ps1` executed via
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File`. D-89 is narrowed to the CI
   job only — the script itself is reviewer-executable, and executing it is what found F10.
7. **Whole-tree self-check.** typecheck, boundaries, licence policy, schema drift, and the
   full suite with every gate enabled.
8. **Decisions.** D-161 → whatever the ceiling is by then, ratified or amended in one pass.

## 6. Two standing corrections carried from Gate 2

- **F10 is closed.** Your Order 045 fix is exactly the shape I specified, and I verified it
  by execution: `state.ps1` now exits 1 with a labelled error where it previously exited 0
  in silence. Nothing further needed.
- **`handoff/ARCHITECT-HANDOVER.md` is stale.** It still describes the debt as Orders
  019–036 and D-95→D-141. That was true at `a113ca8` and is not true now. Fix its §1 table
  and §4 bounds whenever you next touch handoff state; it is housekeeping, not a blocker.

## 7. Decision to append — I am not appending it myself

`DECISIONS.log` has your uncommitted edits in flight, and mixing an architect append into a
builder's working commit is how a shared append-only log gets tangled. Same reason Claude
handed over D-142 as text rather than writing it. Append this as the next free number —
D-220 at time of writing, renumber if you have advanced past it:

```
2026-08-22 · D-220 · Independent review of Orders 045 onward is deferred to a founder-scheduled Gate 3 application review; Codex proceeds continuously and does not wait. Per-order blocking review requests are replaced by non-blocking rows in handoff/GATE-3-MANIFEST.md, because a completed order with green proofs is recorded review debt, not an architect decision, and state.sh was counting it as open work Codex had to wait on. Questions 041, 069, 074 and 087 are answered and closed; Q041 is resolved as use-both — retain the unchanged cold 1000 ms Order 031 P8 ceiling as a catastrophic-regression guard and add, under a future order only, a structural assertion on work performed (rows examined and buffer hits, bounded sub-quadratically across N and 2N spaces) rather than on plan or index shape, because D-107 through D-113 already established that planner selection is not a deterministic invariant. The D-92 hard floor is unchanged and remains the only thing that stops the build; a genuine blocker is raised as handoff/questions/NNN.md whose first line after the title is '## BLOCKED — ARCHITECT NEEDED'. Gate 3 will execute the standard recorded in handoff/GATE-3-REVIEW-CONTRACT.md §5, unchanged from Gates 1 and 2. Rejected: approving Orders 045-060 without executing their proofs, which would fabricate the independent review D-115 forbids; rejected: leaving four review requests marked OPEN so the ground-truth script reports blockers that do not exist; rejected: raising the Order 031 ceiling to make a slow query green; rejected: appending this entry into Codex's in-flight working tree.
```
