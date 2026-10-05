# ORDER 007 — Phase 0 stack corrections

**Phase:** 0 · **Branch:** `phase-0/stack-corrections` · **Tier:** 1 (routine)
**Written by:** Claude, architect role · **Date:** 2026-08-14
**Depends on:** Orders 001–006 · **Answers:** `handoff/reviews/001-006-phase-0-stack.md` F1–F5

## Goal

Close the five defects found in review of Orders 001–006, each with a regression test
that fails before the fix.

## Why now

F1 is a security-relevant gap in the Phase 0 CSP/header gate. F2 and F3 mean the
`strict` typecheck the whole build plan rests on is neither reproducible nor applied
to test files. All five are Tier 1 — they touch no migration, no tenancy, no RLS, no
domain code — so they can be fixed **now**, while the Tier 3 items in Question 007
wait for the second-vendor review that `handoff/ROSTER.md` requires. Doing this first
means the Tier 3 orders land on a foundation whose typecheck actually runs.

This order does not advance a new BUILD-PLAN DoD line. It repairs the ones Orders
001–006 claimed.

## Scope — files Codex may create or change

- `src/app.ts`
- `src/http/security-headers.ts`
- `tests/security-headers.test.ts`
- `scripts/license-check.ts`
- `tests/license-check.test.ts`
- `package.json`
- `bun.lock`
- `tsconfig.json`
- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `docs/DEPENDENCIES.md` — **the "Enforcement" bullet list only**

Anything not listed here is OUT of scope. If the work seems to require another file,
STOP and write `handoff/questions/008.md` — do not widen scope silently.

## Contracts to honour

- `PROJECT.md` — verification doctrine; "Confidence is not verification"
- `docs/SECURITY.md` §4 — CSP, framing, referrer controls
- `docs/DEPENDENCIES.md` — permissive-licence test, `bun audit`, committed lockfile
- `DECISIONS.log` D-64, D-65 (this order's binding decisions)
- Orders 001–006 — every contract they fixed stays fixed: `/health` returns exactly
  `{"status":"ok"}`, no new dependency beyond the one named below, CI stays
  SHA-pinned and `contents: read`

## Required implementation

**1 — Security headers on every response (F1).**
Move header application from `onBeforeHandle` to the response edge so it cannot be
bypassed by a request that matches no route. Use `onAfterHandle` **plus** `onError`,
or a single `mapResponse` hook — Codex chooses, and states which in the PR body with
one sentence on why.
`SECURITY_HEADERS` keeps its current contents; only the application point changes.

**2 — Pin the TypeScript compiler (F2).**
Add `typescript` as an exact-pinned `devDependency`. Change `typecheck` to
`tsc --noEmit`. Regenerate `bun.lock` with a real install — do not hand-edit it.

**3 — Typecheck every test (F3).**
`tsconfig.json` `include` becomes `["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"]`
with `exclude: ["tests/occupancy-stress.test.ts"]`. Add a comment in **both**
`tsconfig.json` and `bunfig.toml` naming the Phase-2 activation order that must delete
both exclusions together.

**4 — Strip the BOM and guard against the next one (F4).**
Rewrite `docker-compose.yml` with no UTF-8 BOM (`EF BB BF`), content otherwise
byte-identical. Add a CI step in the `quality` job that fails if **any** tracked text
file starts with a BOM. The guard is the point; the one-file fix is incidental.
Implement the guard with Bun or POSIX shell — no new dependency.

**5 — Correct the licence gate (F5).**
- `OR` passes when **at least one** operand subtree is fully allowed. `AND` still
  requires all. Parenthesised nesting keeps working (D-65).
- The deprecated `licenses` **array** is `OR` semantics — at least one allowed.
- Accept the legacy singular object form `"license": {"type": "MIT"}`, matching what
  the code already does for entries inside the `licenses` array.
- Unchanged and still fail-closed: `WITH`, `LicenseRef-*`, `+` suffixes, unknown
  identifiers, absent declarations, malformed expressions.
- When an `OR` is satisfied by a subset, **print the accepted operand** on success, so
  the effective licence is visible in the CI log.
- Update `tests/license-check.test.ts:23`, which currently asserts the old behaviour.
- In `docs/DEPENDENCIES.md`, replace *"unless listed in `docs/licence-exceptions.md`
  with a reason"* with: an exception requires an architect decision recorded in
  `DECISIONS.log` and an approved order. Change **only** that bullet list (D-64).

## Definition of done

- [ ] A test asserts the complete header map on **all four**: matched 200, unmatched
      path → 404, wrong method, handler throws → 500 — and the 404 case is
      demonstrated to fail against the pre-fix `onBeforeHandle` implementation
- [ ] `node_modules/typescript` exists after `bun install --frozen-lockfile`, and
      `bun run license-check` reports a **higher** package count than 21 and passes
- [ ] `bun x tsc` no longer appears in any script
- [ ] A deliberate type error in a **new** file under `tests/` fails `bun run typecheck`
      (demonstrate in the PR body, then delete the probe file)
- [ ] `od -c docker-compose.yml | head -1` shows no `357 273 277`
- [ ] The BOM guard fails when a BOM is deliberately introduced, and passes on the
      clean tree (demonstrate both in the PR body)
- [ ] `MIT OR GPL-3.0` passes and prints the accepted operand; `MIT AND GPL-3.0` fails;
      `(MIT OR ISC) AND BSD-3-Clause` still passes; `"license": {"type": "MIT"}` is
      accepted; every previously-rejected form is still rejected
- [ ] `bun install --frozen-lockfile`, `bun run license-check`, `bun audit`,
      `bun run typecheck`, `bun test` all green
- [ ] `docker compose config --quiet` succeeds; rebuilt `yellow-app` reaches `healthy`
      and still returns exactly `{"status":"ok"}`
- [ ] `./setup.sh --db-only` (or `setup.ps1 -DbOnly`) prints `11 passed, 0 failed of 11`
- [ ] No file outside Scope changes
- [ ] PR body references Order 007, quotes the four header-test results, and pastes the
      battery output
- [ ] Commit prefixed `[codex]`. **Do not merge.** Not your own approval.

## Forbidden in this order

- Editing anything under `migrations/` — `0001_init.sql` is immutable
- Any database, SQL, seed, tenancy, `set_config`, RLS, auth, or authorization work
- Creating `src/contexts/`, a migration runner, a seed, or a CI database job — those
  are Orders 008–010 and are **Tier 3, still awaiting second-vendor review**
- Creating `docs/licence-exceptions.md`, or approving any licence exception
- Weakening the CSP, adding a third-party origin, or adding `'unsafe-inline'`,
  `'unsafe-eval'`, or `'wasm-unsafe-eval'`
- Changing the `/health` status, body, or dependency-free semantics
- Adding any dependency other than `typescript` as a pinned devDependency
- Weakening any CI step, action pin, or workflow permission
- Editing `docs/DEPENDENCIES.md` outside the "Enforcement" bullet list
- Rewriting `handoff/reviews/001-006-phase-0-stack.md` or existing `DECISIONS.log` lines
- Merging any PR, including this one

## Open questions the architect has already answered

> Q: Should `SECURITY_HEADERS` change content?
> A: No. Only the application point moves. Content changes go through their own order.

> Q: `onAfterHandle` + `onError`, or `mapResponse`?
> A: Codex's call — both satisfy the DoD. State which and why in one sentence. This is
> exactly the kind of decision `docs/WORKFLOW.md` leaves to the builder.

> Q: If `bun audit` flags an advisory in `typescript` after pinning?
> A: STOP. Write `handoff/questions/008.md`. Do not suppress, do not unpin. (D-66)

> Q: Should the BOM guard also check line endings?
> A: No. `.gitattributes` already normalizes those. One guard, one job.

> Q: `MIT OR GPL-3.0` — really allow it?
> A: Yes. SPDX `OR` means the licensee chooses; we choose MIT, which satisfies
> DEPENDENCIES.md test #1. Printing the accepted operand is what makes the choice
> auditable rather than implicit. (D-65)

---

## MERGED

Merged into `main` by the cumulative Phase 0 integration PR (head `7f1d7c3`).
Reviewed in `handoff/reviews/` before merge; see `handoff/LEDGER.md` for the verdict line.
