# REVIEW 001–006 — Phase 0 stack (consolidated)

**Orders:** 001, 002, 003, 004, 005, 006 · **Branches:** 8, stacked linearly (see *Evidence limits*)
**Reviewed by:** Claude (architect role) — pass 1 `claude-haiku-4-5-20251001`, pass 2 `claude-opus-5` · **Date:** 2026-08-14
**Verdict:** **CHANGES-REQUIRED** (7 defects, all Tier 1, all with executable proof)

---

## Evidence limits — read this before trusting anything below

Two passes, neither with a shell on the founder's machine.

**Pass 1** read the working tree and *executed* the code in a sandbox: a copy of
`src/`, `tests/`, `scripts/`, `package.json`, `tsconfig.json` and `bunfig.toml` was
installed with Bun 1.3.13 and probed. Every finding below has a reproducible command
and observed output. That is what makes this more than a paper read.

**Pass 2** still has no shell — the Linux workspace does not start on this device — but
read `.git/` directly with file tools, which closes the git-topology gap that pass 1
recorded as open.

### Now verified (pass 2, read from `.git/refs/` and `.git/logs/`)

**The stack is eight branches, not seven, and it is strictly linear.** Every tip below
was read from `.git/refs/heads/`; the parent chain was reconstructed from
`.git/logs/HEAD`.

| # | Branch | Tip | Corresponds to |
|---|---|---|---|
| — | `main` = `origin/main` | `b602af9` | baseline |
| 1 | `codex/windows-support` | `bbfe607` | pre-order Windows support |
| 2 | `phase-0/runtime-health-scaffold` | `433b5cb` | Order 001 |
| 3 | `phase-0/containerized-health-app` | `382fdfd` | Order 002 |
| 4 | `phase-0/baseline-ci` | `402bfc8` | Order 003 |
| 5 | `phase-0/license-policy-gate` | `5f807bf` | Order 004 |
| 6 | `phase-0/security-header-gate` | `eb00dd4` | Order 005 |
| 7 | `phase-0/dependency-audit-gate` | `ba4e173` | Order 006 |
| 8 | `phase-0/architect-gate-brief` | `cd985da` | Question 007 write-up |

- **This resolves the #1–#7 vs #1–#8 discrepancy.** There are eight branches. The two
  that are not Orders 001–006 are `codex/windows-support` (ahead of Order 001) and
  `phase-0/architect-gate-brief` (the Question 007 document). GitHub PR *numbers* are
  still unread; the mapping above is by branch, which is the durable identifier.
- **Each branch is exactly one commit ahead of the previous branch.** So each PR's diff
  *is* its single commit, and the checked-out working tree is exactly `cd985da` — the
  cumulative union of all eight. Pass 1 was therefore reading the right bytes; only the
  per-PR *attribution* was inferred.
- **All eight branches are pushed and in sync.** Every `.git/refs/remotes/origin/…` ref
  byte-matches its local counterpart. Nothing is unpushed.
- **`main` has not moved and nothing has been merged.** Local `main` == `origin/main` ==
  `b602af9`.
- **The local scaffold history was reset, and is backed up.**
  `.git/logs/refs/heads/main` records `Reset to origin/main`, discarding two local-only
  commits (`e9d7de7`, `c0aa1db`). Both are preserved on `backup/local-main`;
  `backup/runtime-health-local` (`1466f7d`) and `backup/containerized-health-local`
  (`687ccc8`) hold the pre-cherry-pick versions of Orders 001–002. Nothing was lost.
  These three `backup/*` branches are local-only and are not on origin.

### Now verified (pass 3 — Appendix A executed, then re-executed by the reviewer)

**Pass 3a:** the founder ran Appendix A by hand and pasted the output.
**Pass 3b:** a shell became available to the reviewer (Desktop Commander → WSL2) and
**every command below was re-run first-hand.** CLAUDE.md forbids approving on a pasted
result; nothing here rests on one. The two runs agree, and they are demonstrably
separate runs — throughput differed (154/s vs 165/s) and the journal UUIDs differed,
which is what distinguishes a fresh execution from a replayed transcript.

Run in WSL2 Ubuntu-24.04 against `~/projects/yellow` (Linux filesystem, per D-49) on
`cd985da` / `8d9eb91`, with Docker 29.7.2, Bun 1.3.14, Python 3.12.3, git 2.43.0.

- **THE BATTERY PASSED.** `./setup.sh --db-only` → **`RESULT: 11 passed, 0 failed of 11`**,
  against a freshly loaded schema (80 tables) and fixture (2 tenants, 16 spaces incl. a
  6-bed dorm). All eleven named: TC-12.1 (50-thread exclusive race → 1 winner), TC-12.2,
  TC-12.3 (40 threads / 6 beds → exactly 6), TC-12.4 (direct INSERT blocked, 42501),
  TC-12.5 (154 commits/s), TC-5.6 (unbalanced journal rejected at COMMIT), TC-7.1,
  TC-5.4 (sealed-day posting blocked), TC-8.2 (100 concurrent invoice numbers gapless,
  1..100), TC-13.1 (table RLS: A=16, B=0), TC-13.4 (view RLS). **The merge gate is
  closed on this axis.**
- **`migrations/0001_init.sql` is untouched — now actually verified, not inferred.**
  `git log --oneline -- migrations/0001_init.sql` returns exactly one commit,
  `bc0e492` ("PMS build package v1.6"), which predates the `b602af9` baseline.
  `git diff b602af9..cd985da -- migrations/` prints **nothing**.
- **All eight per-PR diffs read.** F1–F5 attribution is now confirmed against real
  diffs rather than inferred from scope lists:

  | Range | Order | Files touched | Confirms |
  |---|---|---|---|
  | `b602af9..bbfe607` | — | `START-HERE-WINDOWS.md`, `setup.ps1`, `state.ps1`, `tests/run_invariants.py` | see F6 |
  | `bbfe607..433b5cb` | 001 | `bun.lock`, `bunfig.toml`, `package.json`, `src/app.ts`, `src/server.ts`, `tests/health.test.ts`, `tsconfig.json`, order doc | **F2, F3** |
  | `433b5cb..382fdfd` | 002 | `.dockerignore`, `Dockerfile`, `docker-compose.yml`, order doc | **F4** |
  | `382fdfd..402bfc8` | 003 | `.github/workflows/ci.yml`, order doc | clean |
  | `402bfc8..5f807bf` | 004 | `scripts/license-check.ts`, `tests/license-check.test.ts`, `ci.yml`, `package.json`, `tsconfig.json`, order doc | **F5** |
  | `5f807bf..eb00dd4` | 005 | `src/app.ts`, `src/http/security-headers.ts`, `tests/security-headers.test.ts`, `tsconfig.json`, order doc | **F1** |
  | `eb00dd4..ba4e173` | 006 | `ci.yml`, order doc | clean |
  | `ba4e173..cd985da` | — | `handoff/questions/007.md` | clean |

- **Scope discipline is diff-verified, not asserted.** Every PR touches only files
  inside its order's Scope list. No PR touches `migrations/`. Pass 1 claimed this from
  the working tree; it now holds against the diffs.
- **F1–F4 confirmed in the diff text, not just the file list.** `src/app.ts` really does
  attach the header map via `.onBeforeHandle` (F1). `package.json` really does carry
  `"typecheck": "bun x tsc --noEmit"` with `@types/bun` as the only devDependency and no
  `typescript` entry (F2). `tsconfig.json` really does ship
  `include: ["src/**/*.ts", "tests/health.test.ts"]` — enumerated by name (F3). The BOM
  scan over every tracked file returns exactly one hit, `docker-compose.yml`, so F4's
  scope is one file and no wider.
- **F5 confirmed at source, not only by sandbox execution.** In
  `scripts/license-check.ts`, `parseOr` returns `false` unless *every* `OR` operand
  parses as allowed — literal AND semantics, so `MIT OR GPL-3.0` is rejected.
  `extractLicenseExpressions` accepts the `{type}` object form for entries inside the
  `licenses` array but requires a bare string for the singular `license` field, so the
  legacy `{"license":{"type":"MIT"}}` yields `[]` and is then mislabelled *missing
  licence*. `tests/license-check.test.ts:23` asserts the wrong behaviour
  (`MIT OR GPL-3.0-only` → `toBeFalse()`) and must change with the fix.
  `docs/licence-exceptions.md` does not exist, confirming F5(a).
- **`./state.sh` runs clean.** Branch `phase-0/architect-gate-brief`, head `8d9eb91`,
  working tree clean, `yellow-postgres` and `yellow-valkey` both up, `yellow_test`
  reports 80 tables, DECISIONS.log at 64 entries. Ground truth, not assumed.
- **Working tree clean**, `main` at `b602af9` tracking `origin/main`, all eight branches
  fetched and in sync.

- **`tests/run_invariants.py` was modified in `b602af9..bbfe607`** (1 insertion, 1
  deletion) — diff read; it removes a privilege elevation from TC-12.3's setup. Not a
  path fix. Now recorded as **F6**.

### Nothing remains unverified

Every row pass 1 and pass 2 left open has been closed by execution. This review is now
evidence-based end to end.

**Consequence:** the battery no longer blocks. **F1–F7 still do** — a green battery
proves the database invariants hold; it says nothing about a 404 without security
headers, an unpinned compiler, a test whose precondition can fail silently, or a
decision log that was never in the repository. Verdict stands at CHANGES-REQUIRED, now
seven findings.

---

## Per-order verdict

| Order | Subject | Verdict | Blocking findings |
|---|---|---|---|
| 001 | Runtime health scaffold | CHANGES-REQUIRED | F2, F3 |
| 002 | Containerized health app | CHANGES-REQUIRED | F4 |
| 003 | Baseline CI | APPROVED (as scoped) | — |
| 004 | License policy gate | CHANGES-REQUIRED | F5 |
| 005 | Security header / CSP gate | CHANGES-REQUIRED | **F1** |
| 006 | Dependency audit gate | APPROVED (as scoped) | — |
| — | `codex/windows-support` (no order) | CHANGES-REQUIRED | **F6** |
| — | repository-wide (predates all branches) | CHANGES-REQUIRED | **F7** |

---

## What's right — name it, because this is the house style working

1. **Orders are genuinely well-scoped.** Every one has a Scope list, a Forbidden list,
   a numbered DoD, and a "Deferred review protocol". Order 001's Forbidden list
   (`Starting a server as a side effect of importing src/app.ts`) is exactly the kind
   of specific prohibition that prevents a whole class of test flake. This is better
   order-writing than most human teams produce.
2. **The scope discipline held.** Six stacked orders, and the working tree contains
   no file outside the union of the six Scope lists. Nothing widened silently.
3. **`src/app.ts` exports without listening; `src/server.ts` is the only `listen`.**
   That split is why `tests/health.test.ts` can call `app.handle()` in-process with no
   socket, no port collision, no teardown flake. Correct, and correctly tested.
4. **CI actions are SHA-pinned with version comments, permissions are `contents: read`,
   concurrency cancels in-flight runs, jobs have finite timeouts.** This is a
   supply-chain posture most teams reach after an incident, not before.
5. **The container smoke test asserts the exact body**, not just HTTP 200 — so a
   handler that returns `{"status":"OK"}` or adds a timestamp fails CI. That matches
   Order 001's contract instead of loosely gesturing at it.
6. **`isPackageRootManifestPath` is correct on the cases that matter.** Verified by
   execution: scoped packages, nested `node_modules`, and non-root manifests
   (`node_modules/@sinclair/typebox/compiler/package.json`) are all classified right.
   Nested-`node_modules` handling is the part people usually get wrong.
7. **The license checker parses SPDX properly** — a real recursive-descent parser with
   parenthesis support, not a regex. `(MIT OR ISC) AND BSD-3-Clause` evaluates
   correctly. Verified by execution.
8. **The health endpoint has no dependency coupling.** Compose declares no
   `depends_on` for `app`. Liveness stays liveness. Resisting the urge to make
   `/health` check Postgres is a real architectural decision and it was made correctly.
9. **Question 007 is an excellent artifact.** The evidence table honestly marks five
   Phase-0 DoD lines as *Missing* rather than claiming completion, and it stopped at
   the Tier-3 boundary instead of implementing through it. That is precisely what
   AGENTS.md demands and it is the single strongest signal in this stack.

---

## Changes required

### F1 — Security headers are absent on every unmatched route (Order 005) · **most serious**

**File:** `src/app.ts:6` — `.onBeforeHandle(...)`

`onBeforeHandle` runs only after a route has matched. Any request that matches no
route returns Elysia's NOT_FOUND **without a single security header** — no CSP, no
`X-Frame-Options: DENY`, no `nosniff`, no referrer policy.

**Executable proof** (sandbox, Bun 1.3.13, `app.handle()` in-process):

```
GET /health (matched)        status=200  missingSecurityHeaders=0
GET /nope (404 unmatched)    status=404  missingSecurityHeaders=6
   -> content-security-policy, permissions-policy, referrer-policy,
      strict-transport-security, x-content-type-options, x-frame-options
POST /health (405→404)       status=404  missingSecurityHeaders=6
GET /boom (handler throws)   status=500  missingSecurityHeaders=0
```

Note the asymmetry: the 500 path *is* covered (the hook ran before the handler threw
and `set.headers` survived), which is exactly why this was invisible — the obvious
error case looks fine. Only the *unmatched* path leaks.

**Why it matters, concretely.** Error and 404 pages are the classic clickjacking and
reflected-content surface, and they are the pages an attacker can reach without
authentication. `X-Frame-Options: DENY` missing on 404 means a 404 can be framed.
`nosniff` missing means a 404 body that echoes any part of the path can be sniffed
into an active content type. Order 005 states the goal as *"apply it to every Elysia
response"*; the implementation applies it to every *handled* response. The test only
ever exercised `/health`, so the test agreed with the bug.

**What to do instead.** Apply the header map on the response edge rather than the
request edge — `onAfterHandle` **plus** `onError`, or a single `mapResponse` hook —
so it cannot be bypassed by a request that never reaches a handler. Then extend
`tests/security-headers.test.ts` to assert the full header map on:
(a) a matched 200, (b) an unmatched path → 404, (c) a wrong-method request,
(d) a route that throws → 500. The 404 assertion is the regression guard; without it
this reappears the first time someone refactors the hook.

**This is the finding that justifies the review.** It is a security-relevant gap in a
security order, it was invisible to the order's own DoD, and it fell to execution
rather than reading — the same pattern PROJECT.md records for the view-RLS leak.

---

### F2 — The TypeScript compiler is unpinned, unlocked, unlicensed and unaudited (Order 001)

**File:** `package.json:11` — `"typecheck": "bun x tsc --noEmit"`, with no `typescript`
entry in `devDependencies`.

**Executable proof:**

```
$ ls node_modules/typescript
ls: cannot access 'node_modules/typescript': No such file or directory
$ bun scripts/license-check.ts
Dependency license policy passed for 21 installed package(s).
$ bun x tsc --noEmit        # succeeds — TypeScript fetched from the network at run time
```

Three doctrine violations in one line:

1. **Reproducibility.** CI runs `bun install --frozen-lockfile` and then immediately
   downloads an unpinned compiler outside that lockfile. A TypeScript minor release
   can turn CI red — or, worse, green — on a PR that changed nothing. The frozen
   install is doing no work for the tool that actually enforces `strict`.
2. **License gate bypass.** `license-check` scans `node_modules`. TypeScript is
   resolved into Bun's global `bun x` cache, so it is **never scanned**. The gate
   Order 004 built reports 21 packages and is blind to the compiler. (TypeScript is
   Apache-2.0, so the *outcome* is fine — the *gate* is not.)
3. **Audit gate bypass.** `bun audit` reads the lockfile. TypeScript is not in it, so
   Order 006's blocking audit step never sees it.

**What to do instead.** Add `typescript` as a pinned `devDependency`, regenerate
`bun.lock`, change the script to `tsc --noEmit`. Then confirm `bun run license-check`
reports a **higher** package count and still passes — that number rising is the proof
the gate now covers the compiler.

---

### F3 — New test files silently escape `tsc` (Orders 001, 004, 005)

**File:** `tsconfig.json:14–19` — `include` enumerates the three test files by name.

**Executable proof.** Added `tests/new-thing.test.ts` containing
`const bad: number = "definitely not a number";`

```
$ bun x tsc --noEmit
exit=0                       # <-- a blatant type error, not reported
$ bun test
20 pass, 0 fail
```

`bun test` transpiles without typechecking, so a test file outside `include` is
**never typechecked by anything**. Every future test is unchecked-by-default, and the
failure is silent — no warning, no missing-file error. This is a slow leak: it costs
nothing today and costs a Phase-5 ledger test that typechecks in nobody's editor.

The list also has to be hand-edited by every future order that adds a test, which
means every future order carries an avoidable chance of forgetting.

**Pass 3 corroboration — this is not hypothetical, it has already happened three
times.** The diffs show `tsconfig.json` edited in three separate PRs purely to extend
the `include` list: `bbfe607..433b5cb` (Order 001, created it), `402bfc8..5f807bf`
(Order 004, +1/−1 for `tests/license-check.test.ts`), and `5f807bf..eb00dd4`
(Order 005, +8/−1 for `tests/security-headers.test.ts`). Three orders, three manual
edits, three chances to forget. F3 is not a slow leak — it is an active tax already
being paid every order.

**What to do instead.** `include: ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"]`
with `exclude: ["tests/occupancy-stress.test.ts"]`, mirroring `bunfig.toml`'s single
documented exclusion so the two files state the same exception in the same terms. Add
a comment in both pointing at the Phase-2 activation order that must delete both.

---

### F4 — `docker-compose.yml` carries a UTF-8 BOM (Order 002)

**Executable proof:**

```
$ od -c docker-compose.yml | head -1
0000000 357 273 277   #       L   o   c   a   l       d   e   v   e   l
```

`357 273 277` is `EF BB BF` — a UTF-8 BOM, the signature of a Windows PowerShell
`Set-Content` / `Out-File` write. No other tracked file in the tree has one, and no
file has CRLF endings.

Compose itself tolerates it, so this is not breaking anything today. It is being
raised because of what it predicts. `.gitattributes` opens with a comment explaining
that Windows editors write CRLF and *"bash fails with `bad interpreter: /bin/bash^M`.
This is not optional on a mixed team."* — the file already anticipates exactly this
class of corruption and normalizes line endings, but `text=auto eol=lf` **does not
strip BOMs**. The same authoring habit applied to a `.sh`, `.sql`, or `.py` file will
hard-fail: a BOM before `#!/usr/bin/env bash` makes the shebang unparseable, and a BOM
before a `psql` script breaks the first statement. `state.sh`, `setup.sh`, and
`tests/run_invariants.py` are all in that blast radius, and `migrations/0001_init.sql`
is immutable — a BOM introduced there could not be fixed in place.

**What to do instead.** Rewrite `docker-compose.yml` without the BOM, and add a CI
step that fails when any tracked text file begins with `EF BB BF`. The guard is the
deliverable; the one-file fix is incidental.

---

### F5 — The license gate contradicts `docs/DEPENDENCIES.md` and is over-strict on `OR` (Order 004)

Three separate problems in the same component.

**(a) The documented exception path does not exist.** `docs/DEPENDENCIES.md`
("Enforcement") specifies the gate fails *"unless listed in `docs/licence-exceptions.md`
with a reason."* No such file exists, and Order 004 explicitly forbade creating one.
Doc and implementation disagree. **Resolved by decision, not by code** — see D-64
below: the exception file is removed from doctrine. A builder must never be able to
unblock itself by writing a file; an exception now requires an architect decision.
Fix `docs/DEPENDENCIES.md` to say so.

**(b) `OR` is evaluated as `AND`.** Executable proof:

```
"MIT OR GPL-3.0"                 -> false     # wrong: MIT is choosable
"MIT AND ISC"                    -> true      # correct
"(MIT OR ISC) AND BSD-3-Clause"  -> true      # correct
```

Under SPDX, `MIT OR GPL-3.0` means the licensee **chooses**; such a package is usable
under MIT and satisfies DEPENDENCIES.md test #1 ("permissive licence for anything we
embed"). Rejecting it is a false positive that will, on the day it fires, create
pressure to add a blanket exception — the exact bypass (a) closes. Fix it now while
the tree is 21 packages and the change is cheap. `tests/license-check.test.ts:23`
asserts the wrong behaviour and must be updated with the fix.

**(c) The legacy `license: {type: "..."}` object form reads as "missing license".**
Executable proof:

```
{"license":{"type":"MIT","url":"http://x"}}  ->  []   # then reported: "missing license"
```

npm's pre-2015 object form is still present in the long tail of transitive
dependencies. The failure is closed (safe) but *mislabeled* — CI would say
`missing license` for a package that plainly declares MIT, sending whoever debugs it
down the wrong path. Accept `{type}` for the singular `license` field, exactly as the
code already does for entries inside the `licenses` array.

The deprecated `licenses` **array** must also become `OR` semantics (npm's historic
meaning is dual-licensing), consistent with (b).

**Cross-cutting requirement for (b) and (c).** When an `OR` is satisfied by a subset,
the checker must **print which operand it accepted**, so the effective license is
visible in the CI log and reviewable later. A gate that says "passed" without saying
under which license has not actually recorded the decision.

---

### F6 — the invariant battery was silently weakened (branch `codex/windows-support`)

**Raised and confirmed by pass 3**, from the diff `b602af9..bbfe607`:

```
 START-HERE-WINDOWS.md   |  8 +++++---
 setup.ps1               | 57 +++++++++++++++++++++++++
 state.ps1               | 32 ++++++++++++++++++++++++++
 tests/run_invariants.py |  2 +-
```

Three of those four files are new Windows support and are unobjectionable. The fourth
is not: `tests/run_invariants.py` is **the invariant battery itself** — the artifact
whose output is the merge gate for every phase of this project. A builder changed it,
on a branch with no order, no Scope list, and no DoD.

**The change, read in full:**

```diff
 # R3 / TC-12.3 — capacity race: clear dorm, 40 threads for 6 beds
-c, cur = conn(); cur.execute("SET ROLE postgres")
+c, cur = conn()
 cur.execute("DELETE FROM space_occupancy WHERE space_id=%s", (DORM,)); c.commit(); c.close()
```

**It is not a path fix.** It removes a privilege elevation from the setup step of
TC-12.3 — the capacity-race test. `SET ROLE postgres` has nothing to do with Windows,
which is the stated and only purpose of the commit that carries it.

**What it stands on now.** `conn()` connects as user `yellow` (`run_invariants.py:13`)
and elevates only when asked — `conn(role_app=True)` does `SET ROLE app_role`
(lines 29–34). TC-12.4, the choke-point test, uses `app_role` (line 79); this DELETE
does not. So the dorm-clearing DELETE now runs as plain `yellow`.

**The current outcome is fine, and that is the problem.** The battery passes, and
TC-12.3 reports `claims=6` — exactly six of forty threads winning six beds, which is
only possible if the dorm really was empty. So the DELETE did work: `yellow` is
evidently the schema owner and therefore bypasses RLS (inferred, not read from the
migration). The test is green today.

**The failure mode it acquired is silent.** RLS *filters*; it does not raise. The moment
anyone adds `FORCE ROW LEVEL SECURITY` to `space_occupancy` — precisely the hardening
this project's invariant list implies it will do — the DELETE stops erroring and starts
deleting **zero rows**. TC-12.3 then races forty threads against a dorm that still holds
prior occupancy, and fails for a reason that looks nothing like its cause. Under
`SET ROLE postgres` the precondition was guaranteed; now it is merely probable, and it
degrades quietly.

**How this most likely happened** (inference): `SET ROLE postgres` threw on the
founder's Docker setup — the role doesn't exist there, or `yellow` isn't a member — and
the battery crashed. That is a real bug and it needed fixing. It was fixed by *weakening
the test's guarantee* rather than by *making the environment supply it*, and because the
result was green, nothing surfaced.

**What to do instead.** Do not restore `SET ROLE postgres` — it is what broke portably.
Assert the postcondition, so the precondition can never fail silently:

```python
c, cur = conn()
cur.execute("DELETE FROM space_occupancy WHERE space_id=%s", (DORM,)); c.commit()
cur.execute("SELECT count(*) FROM space_occupancy WHERE space_id=%s", (DORM,))
n = cur.fetchone()[0]; c.close()
assert n == 0, f"TC-12.3 precondition failed: dorm still holds {n} rows"
```

Loud on the day it matters, portable on every other day.

**And the governance rule this exposes.** The battery is the one artifact in the repo
that must not be quietly editable by the agent whose work it grades. `migrations/` is
already protected in doctrine; `tests/run_invariants.py` is not, and the only reason
nobody noticed is that this particular change happened to stay green. Add it:
**`tests/run_invariants.py` is architect-only, same tier as `migrations/`.** Any change
to it requires an order, and the order must state what the change does to each affected
TC's guarantees.

---

### F7 — `DECISIONS.log` was never tracked by git (repository-wide) · **most serious after F1**

**Found in pass 3b**, while trying to commit an appended decision:

```
$ git add DECISIONS.log
The following paths are ignored by one of your .gitignore files:
DECISIONS.log
$ git ls-files DECISIONS.log          # (no output — not tracked)
$ git check-ignore -v DECISIONS.log
.gitignore:5:*.log      DECISIONS.log
```

The `*.log` glob on line 5 of `.gitignore` — intended for log output — silently
swallowed the project's canonical decision record. It has **never been under version
control, on any branch, since the repository was created.** 69 entries, including every
D-63…D-68 decision this review depends on.

**The contradiction that proves it was accidental.** `.gitattributes:13` reads
`DECISIONS.log merge=union` — a merge strategy configured for a file git was not
tracking. D-55 explains why that line exists: *"so parallel appends don't conflict."*
Two agents were given a concurrency strategy for a file neither could commit.

**What was actually broken.**

1. **It existed only in whichever working tree last wrote it.** It survived this session
   by luck — it was hand-copied from the Windows tree into `~/projects/yellow`. Earlier
   in this same session the reviewer recommended abandoning the Windows folder. Had that
   happened before the copy, entries would simply have been gone, with no diff, no
   history, and nothing to restore from.
2. **The two-agent handoff model did not work for its most important file.** D-53
   declares DECISIONS.log *"explicitly SHARED between both agents — check it before
   deciding, not after."* `handoff/README.md` promises *"these files ARE the shared
   memory, and they're versioned with the code."* Codex, cloning the repo, would have
   received orders, reviews, questions and the ledger — and no decisions at all.
3. **`./state.sh` reported unreproducible ground truth.** It prints "full history:
   DECISIONS.log (64 entries)" read from the working tree. No fresh clone could produce
   that number, and `state.sh` is the script every session is told to trust first.

**Why this is more than hygiene.** Every other protection in this project assumes the
decision record is durable and shared: the Tier-3 cross-vendor rule, "check it before
deciding, not after", the union-merge strategy, the escalation rule that says a cheap
session must record an invariant decision before switching back. All of them route
through a file that lived on one laptop.

**Fixed in this commit** — `!DECISIONS.log` negation added to `.gitignore` with a comment
explaining why, and the file committed. Recorded as **D-70**.

**Worth a follow-up check by whoever picks this up:** confirm nothing else meant to be
durable is caught by a broad glob. `*.log` was the one that bit; `dist/` and `coverage/`
are correct, but the class of error — an intent expressed in `.gitattributes` that
`.gitignore` quietly overrides — is worth one deliberate pass.

---

## Not defects — recorded so they are not re-litigated

- **`bun audit` can turn a previously-green tree red** when an upstream advisory
  lands, with no change on our side. That is intended and stays blocking (D-66).
- **`.dockerignore` excludes `migrations/`.** Correct today. Order 008 must decide
  whether the migration runner ships in the app image or as a separate job, and change
  it deliberately if so.
- **CSP forbids `'wasm-unsafe-eval'`.** Correct as a launch baseline. ALTCHA at
  Phase 10 uses Argon2id in WASM and will need a scoped, reviewed relaxation — through
  an order, per Order 005's own deferred-review note, never ad hoc.
- **`SECURITY.md §4` allows `frame-ancestors` to permit a kiosk origin.** Current
  `DENY`/`'none'` is right until the kiosk surface exists (Phase 10).
- **`ALLOWED_LICENSES` is an exported mutable `Set`.** No current caller mutates it.
  `readonly`/frozen would be tidier; not worth an order on its own — fold it in if
  `scripts/license-check.ts` is open for F5 anyway.

---

## Invariant check (reviewer asserts each)

Phase 0 touches no domain code, so most rows are vacuous — recorded in full anyway,
because a checklist that gets skipped when it is easy gets skipped when it is hard.

- [x] tenant_id leads every new index — **N/A**, no index created
- [x] money is bigint minor units — **N/A**, no money type exists yet
- [x] no UPDATE on insert-only tables — **N/A**, no SQL in this stack
- [x] occupancy writes go through the choke point only — **N/A**, no occupancy code
- [x] every cross-context effect emits an outbox event — **N/A**, no contexts exist yet
- [x] any new view carries `security_invoker = true` — **N/A**, no view created
- [x] state transitions exist in STATE-MACHINES.md — **N/A**, no transitions
- [x] `migrations/0001_init.sql` byte-for-byte untouched — **VERIFIED.**
      `git log --oneline -- migrations/0001_init.sql` → one commit, `bc0e492`, predating
      the `b602af9` baseline. `git diff b602af9..cd985da -- migrations/` → empty.
- [x] `./setup.sh --db-only` → **`11 passed, 0 failed of 11`** — **RUN AND GREEN**, on
      `cd985da` in WSL2 Ubuntu-24.04, Docker 29.7.2. Full output in *Evidence limits*.

---

## Governance finding — Orders 001–006 were self-authored

Every one of these six orders carries *"Written by: OpenAI Codex, acting as temporary
architect by founder request while Claude is unavailable."* The builder wrote its own
orders and then implemented them.

`docs/WORKFLOW.md` splits ORDER and BUILD between agents specifically because *"the
split exists because ambiguity is where money is worth spending"* — a self-authored
order cannot catch the author's own blind spot. F1 and F2 are that blind spot made
concrete: an order that says *"apply it to every Elysia response"* and a DoD that only
tests `/health`, written by the same agent, produce a gap nobody was positioned to see.

This is **not** misconduct. The founder authorized it, Codex labeled it honestly in
every file, it stopped dead at the Tier-3 line, and it wrote Question 007 rather than
implementing through it. That is a builder behaving well under an unusual constraint,
and the labeling is what made this finding possible at all.

**Ratified retroactively** (D-63), with the standing rule restated: from Order 007
onward, orders come from an architect-role agent. If no architect is available, the
builder writes `handoff/questions/NNN.md` and **waits** — it does not promote itself.

---

## Decisions made during review

Appended to `DECISIONS.log` as entries D-63 through D-68. Each carries its rejected
alternative, per the file's format.

---

## Appendix A — shell-holder runbook

For the founder, not for Codex. No agent in this project currently has a shell on the
machine, so these are the rows only a human can close. Run from the repo root. Paste the
output back and it gets folded into *Evidence limits* above.

`state.sh` and `setup.sh` are bash — use Git Bash or WSL, not PowerShell. (`state.ps1`
is the PowerShell equivalent for step 1 only.)

### Step 1 — ground truth

```bash
git status --short --branch
git log --oneline --decorate -20
git remote -v
./state.sh
```

Expect: clean tree, `HEAD` on `phase-0/architect-gate-brief` at `cd985da`, origin
`https://github.com/dcpnode-maker/yellow.git`. Anything else contradicts pass 2 and the
topology table above is wrong.

### Step 2 — per-PR diffs, in dependency order

Each branch is one commit, so each range below *is* one PR's complete diff.

```bash
git fetch origin
for r in b602af9..bbfe607 bbfe607..433b5cb 433b5cb..382fdfd 382fdfd..402bfc8 \
         402bfc8..5f807bf 5f807bf..eb00dd4 eb00dd4..ba4e173 ba4e173..cd985da; do
  echo "=== $r ==="
  git diff --stat "$r"
done
```

Then the full text of the two that carry findings F1 and F2/F3:

```bash
git diff bbfe607..433b5cb          # Order 001 — F2, F3
git diff 5f807bf..eb00dd4          # Order 005 — F1
```

### Step 3 — migrations immutability

```bash
git log --oneline --decorate -- migrations/0001_init.sql
git diff b602af9..cd985da -- migrations/
```

Expect: exactly one commit (the baseline import), and the second command printing
**nothing**. Any output from the second command is a Tier-1 stop — `migrations/` is
immutable per PROJECT.md.

### Step 4 — the invariant battery (the merge gate)

```bash
git checkout phase-0/architect-gate-brief
./setup.sh --db-only
```

Expect `11 passed, 0 failed of 11`. This tip is the cumulative stack, so a pass here
covers all eight branches *as a unit*. Before merging branches individually, re-run on
each one — a green tip does not prove a green intermediate commit.

If Docker is not running, start Docker Desktop first. If it still fails, say so and
leave the box unticked; do not report a result you did not see.

### Step 5 — optional, reproduces F4's guard

```bash
git ls-files -z | xargs -0 -I{} sh -c \
  'head -c3 "{}" | od -An -tx1 | grep -q "ef bb bf" && echo "BOM: {}"'
```

Expect exactly one hit: `docker-compose.yml`. More than one widens F4's scope.
