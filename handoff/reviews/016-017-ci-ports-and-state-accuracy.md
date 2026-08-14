# REVIEW 016–017 — CI port resolution and handoff-state accuracy

**Orders:** 016 (`e34fa40`), 017 (`30b9491`) · **PRs:** #16 (017 stacked on 016)
**Reviewed by:** Claude (architect role, `claude-opus-5`) · **Date:** 2026-08-15
**Verdict:** **016 APPROVED · 017 APPROVED with one evidence gap · NOT MERGED**

Both orders held scope exactly. One new finding (**F9**) is about the review process
itself, not about either order's code.

---

## Order 016 — APPROVED

**Scope held:** `.github/workflows/ci.yml` only, +62/−19.

**The negative test, reproduced by me** — this is the deliverable the order asked for,
and it is the one that matters. Project `yellow-rev2`, postgres only, no `app` service,
while `yellow-order-008-app-1` was still publishing on 3000:

```
who answers 3000: 1 container(s)
   direct curl to 3000 says: 200
   -> app service has no published application address
   NEGATIVE TEST exit code: 1  (must be non-zero)
```

Another container returned a healthy 200 on the port the old code would have probed, and
the step still failed with a message naming the service. That is F8 closed: the health
check can no longer certify an application it never started.

**Implementation choices, all correct:**

- `docker compose port app 3000` and `docker compose port postgres 5432` — asks Compose,
  matching the fix Order 014 already chose for the container name.
- Container-smoke job took the ephemeral-port route: `--publish 127.0.0.1::3000` then
  `docker port yellow-ci-health 3000/tcp`. That is option (a) from the order, correctly
  chosen for a job that uses `docker run` rather than Compose.
- Job-level `env:` for the three database URLs was moved into a resolve step writing to
  `$GITHUB_ENV`, which is exactly the constraint the order flagged — job-level `env:`
  cannot call `docker compose`.
- Empty resolution is a hard failure with the service named, in all three places. No
  fallback default, no `|| true`.

**The thing I tested rather than reasoned about.** Order 016 changed `YELLOW_DSN` from
libpq **keyword** format to a **URI**:

```diff
-  YELLOW_DSN: dbname=yellow_ci_invariant user=yellow password=yellow host=127.0.0.1 port=5442
+  export YELLOW_DSN="$INVARIANT_URL"     # postgres://yellow:yellow@host:port/db
```

That feeds a different connection-string dialect into the architect-only referee, and
D-51 records a past incident in this exact class — *"renames must cover EVERY
connection-string dialect (URL, keyword, CLI flags)"*. `psycopg2.connect()` accepts both,
but that is a reason to check, not to assume. Checked:

```
INVARIANT_URL = postgres://yellow:yellow@0.0.0.0:5477/yellow_rev2_invariant
RESULT: 11 passed, 0 failed of 11
```

The referee accepts the URI form. No change to `tests/run_invariants.py` — the
architect-only file was correctly left alone.

---

## Order 017 — APPROVED, with the PowerShell half unverified by me

**Scope held:** `state.sh`, `state.ps1`, `handoff/README.md` only, +53/−8.

**Transition reproduced by me, in bash**, including two cases the order did not ask for:

| Step | `Open work:` line |
|---|---|
| baseline | `orders=17 open (17 total) reviews=0 open (2 total) questions=0 open (4 total)` |
| add unmarked question | `questions=1 open (5 total)` + listed by filename |
| add `## RESOLVED` | `questions=0 open (5 total)` |
| change to `## RATIFIED` | `questions=0 open (5 total)` |
| **near-miss: marker inline, not line-start** | `questions=1 open (5 total)` |
| add unmerged order | `orders=18 open (18 total)` |
| add `## MERGED` | `orders=17 open (18 total)` |
| remove probes | back to baseline exactly, tree clean |

The **near-miss case is mine, not the order's** — I put the text `## RESOLVED` in the
middle of a line to check the marker is anchored rather than substring-matched. It is:
`grep -Eq '^## (RESOLVED|RATIFIED)'`. A file cannot close itself by mentioning the word.

Totals are retained alongside open counts, as D-82 required, so the archive stays visible.

### The gap: I could not run `state.ps1`

Codex's report says the transition was *"reproduced identically in Bash and PowerShell."*
I verified bash by execution. **I could not verify PowerShell**, and rather than accept
the claim I am recording precisely why:

- Running it over the WSL UNC path exits 0 but prints only the header — the `git` calls
  inside its `try` block fail on a UNC working directory and the `catch` swallows them.
- Running it against a native Windows checkout is not possible on this machine:
  `Get-Command git` finds nothing and `C:\Program Files\Git\cmd\git.exe` does not exist.
  Git is installed only inside WSL.

So Order 017's PowerShell half is approved **on code inspection**, not on execution. The
inspection is favourable — the logic mirrors the bash version, uses
`Select-String -Pattern '^## RESOLVED','^## RATIFIED' -Quiet`, and prints the same
wording. But inspection is what PROJECT.md says is not verification, and I would rather
say so than let a parity claim pass silently.

**Question for Codex, not an accusation:** where did the PowerShell run happen? If it was
on this machine it could not have run natively either, and I would want to see the actual
transcript. If it was elsewhere, say where, so the evidence has a provenance.

Tier 1 permits approval on one architect's judgement plus a green battery, so this does
not block. It is recorded because an unverifiable claim that goes unremarked becomes a
verified one by attrition.

---

## F9 — the PowerShell path cannot be verified by anyone, by anything · **new**

This is bigger than Order 017 and it is why the gap above is worth a finding rather than
a footnote.

`setup.ps1` and `state.ps1` are a **supported** path — `START-HERE-WINDOWS.md` line 20
tells a native-Windows founder to use them, and D-49 keeps both paths behaviourally
equal. But:

- **CI never runs them.** All three jobs are `runs-on: ubuntu-24.04`. There is no Windows
  runner, so no PowerShell code in this repository is executed by CI, ever.
- **The founder's machine cannot run them.** Windows has no `git` on PATH; everything
  lives in WSL. `state.ps1` shells out to `git` on its first real line.

So the PowerShell half of this project is currently: shipped, documented as supported,
and **exercised by nothing**. Every future change to it is approved on reading alone.
That is the same shape as F1 (a header hook nobody probed on 404) and F8 (a health check
nobody probed with the app absent) — code that is correct-looking and unexercised, which
in this project's short history has been wrong twice out of two.

**This needs a founder decision, not an order yet.** Three honest options:

1. **Add a `windows-latest` CI job** that runs `state.ps1` and `setup.ps1 --db-only`.
   Real coverage; costs CI minutes and a Docker-on-Windows-runner setup that may be
   fiddly.
2. **Install git on Windows** so the path is at least testable on demand, and require a
   pasted native run for any PowerShell change. Cheap; relies on discipline.
3. **Downgrade the PowerShell path in the docs** to "best effort, unverified — use WSL2",
   and stop claiming parity. Honest, free, and consistent with D-49 already calling WSL2
   the recommended path.

I lean to **3 now and 1 later** — if nobody runs it, the parity claim in D-49 is doing
harm by implying a guarantee that nothing checks. But this is a product-support decision
about who you expect to onboard, so it is yours.

Recorded as **D-85**.

## Not defects — recorded so they are not re-litigated

- `docker compose port` returns the **bind** address (`0.0.0.0:5477`), which Order 016
  then uses as a **connect** address. This works on Linux and CI is `ubuntu-24.04`, so it
  is correct in every environment this project actually uses. Noted only because
  connecting to `0.0.0.0` is not universally well-defined.
- The `Prove deployment migration and seed` step now exports variables inside `run:`
  without `set -euo pipefail`. GitHub's default shell is `bash -e`, so a failure still
  fails the step; `-u` would have caught an unset URL slightly earlier. Not worth a
  change.
- `orders=17 open (17 total)` is correct — no order carries `## MERGED` yet. But nothing
  enforces adding the marker when a PR merges, so the count will drift the other way once
  PR #15 lands. Whoever merges must mark Orders 001–015 `## MERGED` in the same commit.

## Merge status

**Neither order is merged and I have merged nothing.** PR #16 is stacked on the Order 016
branch; PR #15 remains the cumulative Phase 0 integration. Codex must not approve or
merge any of them.
