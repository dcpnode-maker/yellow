# ORDER 018 — cover `state.ps1` in CI, stop claiming parity for `setup.ps1`

**Phase:** 0 · **Branch:** `phase-0/powershell-coverage-split`
**Written by:** Claude (architect role, `claude-opus-5`)
**Date:** 2026-08-15 · **Tier:** 2
**Source:** finding F9 in `handoff/reviews/016-017-ci-ports-and-state-accuracy.md` · **Decision:** D-86

## Goal

Give `state.ps1` real executable coverage, and stop the documentation promising a
guarantee for `setup.ps1` that nothing checks.

## Why now

No PowerShell in this repository is executed by anything. All three CI jobs are
`ubuntu-24.04`, and the founder's Windows host has no `git` on PATH, so `state.ps1`
cannot run natively there either. Meanwhile `START-HERE-WINDOWS.md` offers the native
path and D-49 says both paths stay behaviourally equal. That is a promise with nothing
behind it, and this project has now shipped two defects (F1, F8) of exactly the shape
"correct-looking code that nothing exercised".

The two scripts are **not** equally fixable, which is the whole point of this order:
`state.ps1` needs only git and the filesystem; `setup.ps1` needs Docker running Linux
containers, which `windows-latest` runners do not provide.

## Scope — files Codex may change

- `.github/workflows/ci.yml`
- `START-HERE-WINDOWS.md`
- `handoff/README.md` (only if the marker convention needs a Windows note)

Nothing else. Do not touch `state.ps1` or `setup.ps1` themselves — this order adds
coverage and corrects documentation; it does not change behaviour. If the new job reveals
a genuine bug in `state.ps1`, **stop and write `handoff/questions/018.md`**. Fixing it in
passing would mean the fix ships in the same commit as the test that was supposed to
catch it, and nobody could tell whether the test works.

## Required change — part A, cover `state.ps1`

1. Add one job, `windows-state`, `runs-on: windows-latest`, `timeout-minutes: 10`,
   `permissions: contents: read`, actions SHA-pinned with version comments like every
   existing job.
2. No Docker, no Bun, no Python. Checkout and PowerShell only. `git` is preinstalled on
   `windows-latest`.
3. The job asserts the D-82 transition, which is the same proof Order 017 delivered in
   bash — run `state.ps1` and check the `Open work:` line at each step:
   - baseline: parse the current open/total counts
   - create an unmarked file in `handoff/questions/` → questions open count rises by one,
     and the file is listed under `Open questions:`
   - append a line `## RESOLVED` → open count returns to baseline
   - replace it with `## RATIFIED` → still closed
   - put the text `## RESOLVED` **inside** a line rather than at line start → counted
     open again. This near-miss is required: it is what proves the marker is anchored
     rather than substring-matched
   - delete the probe → counts return to baseline exactly
4. The job fails on any mismatch, with a message naming which step diverged.
5. Do not add a Windows job for `setup.ps1`, `bun test`, or the referee.

## Required change — part B, stop claiming parity for `setup.ps1`

In `START-HERE-WINDOWS.md`, replace the current native-Windows offer with wording that
says plainly:

- WSL2 is the **supported** path and the only one CI exercises.
- `setup.ps1` is **best effort and unverified**: it cannot be covered by CI because
  Docker with Linux containers is unavailable on Windows runners, and a green Windows job
  that skipped the database would be worse than none.
- `state.ps1` **is** covered, by the `windows-state` job — say so, so the reader knows
  which half is checked.
- If `setup.ps1` fails, the answer is WSL2, not a support ticket.

Do not delete `setup.ps1`. It is useful and occasionally correct; it just may not be
advertised as equal.

## Definition of done

- [ ] `windows-state` job exists, is SHA-pinned, and is green on this PR
- [ ] **The near-miss step is present and the job fails without it.** Prove it: push once
      with the anchored check deliberately weakened to a substring match, show the job
      going red, then restore it. Paste both runs. A job that only ever passes has not
      been shown to test anything
- [ ] `START-HERE-WINDOWS.md` no longer claims parity for `setup.ps1` and does name
      `state.ps1` as covered
- [ ] `state.ps1` and `setup.ps1` are byte-identical to their state at `30b9491`
- [ ] Existing three jobs unchanged; `./setup.sh --db-only` still `11 passed, 0 failed`
- [ ] No file outside Scope

## Forbidden in this order

- Editing `state.ps1` or `setup.ps1` — coverage and docs only
- A Windows job that runs Docker, Bun, Python, or the referee
- `continue-on-error`, `if: always()` on the assertion step, or any construct that lets
  the new job pass without asserting
- Touching `migrations/`, `tests/run_invariants.py`, or the three existing jobs
- Merging or self-approving

## Open questions already answered

> **Q:** Why not cover `setup.ps1` too, since it is the more important script?
> **A:** Because it cannot be covered honestly on a Windows runner, and a job that
> appears to cover it would be a worse lie than the current silence. Importance does not
> create testability. (D-86)

> **Q:** If `state.ps1` turns out to be broken, may I fix it here?
> **A:** No. Write `handoff/questions/018.md` and stop. A fix shipped alongside the test
> meant to catch it leaves nobody able to say whether the test works. (Scope, above)

## Review requirement

Tier 2: architect approval plus a test that would fail if the property broke. The
deliberately-weakened run in the DoD is that test, and it is the deliverable — not the
green one.

---

## MERGED

Merged into `main` by the cumulative Phase 0 integration PR (head `7f1d7c3`).
Reviewed in `handoff/reviews/` before merge; see `handoff/LEDGER.md` for the verdict line.
