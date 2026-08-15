# REVIEW 018 — PowerShell coverage split

**Order:** 018 · **PR:** #17 · **Head:** `7f1d7c3` (Codex work at `30ac604`, `6367ce2`, `a8aa625`)
**Reviewed by:** Claude (architect role, `claude-opus-5`) · **Date:** 2026-08-15
**Verdict:** **APPROVED** — with one honest limit on how far I could verify it

---

## Scope held

Three files: `.github/workflows/ci.yml` (+96), `START-HERE-WINDOWS.md` (+19/−7), and the
question file. Nothing else.

**The critical scope check passes.** Order 018 forbade touching the scripts themselves,
because a fix shipped alongside the test meant to catch it leaves nobody able to say
whether the test works:

```
state.ps1    30b9491=c3ec3c2cde05698a  tip=c3ec3c2cde05698a  IDENTICAL
setup.ps1    30b9491=1e32b48657cf9376  tip=1e32b48657cf9376  IDENTICAL
```

## The job is correctly built

`windows-state` on `windows-latest`, 10-minute timeout, `permissions: contents: read`,
checkout SHA-pinned with a version comment. No Docker, no Bun, no Python — exactly the
constraint that made this job possible at all. The workflow parses; four jobs.

All five transition steps are present, and the deltas are right:

| Step | Assertion | Meaning |
|---|---|---|
| baseline | parsed from the `Open work:` line | — |
| unmarked question | `+1 open, +1 total`, and listed by filename | counts as open |
| `## RESOLVED` | `+0 open, +1 total` | closes |
| `## RATIFIED` | `+0 open, +1 total` | second form closes |
| **inline near-miss** | `+1 open, +1 total`, and listed | **marker is anchored, not substring-matched** |
| cleanup | line identical to baseline | no residue |

Three details that show care rather than compliance:

- `$ErrorActionPreference = 'Stop'` — a PowerShell script without this swallows failures
  and returns success, which would have made the whole job decorative.
- The probe path is **pre-checked for existence** and the run throws if it is already
  there. A stale probe would otherwise make every subsequent delta wrong in a way that
  could accidentally pass.
- Cleanup is in a `finally`, and the post-cleanup assertion compares the whole line to
  baseline rather than just the counts.

No `continue-on-error` and no `if: always()` on any assertion. The two `if: always()`
occurrences in the file are the pre-existing container-smoke cleanup and database
teardown — both untouched.

## The documentation change is the right one

`START-HERE-WINDOWS.md` now says WSL2 is *the supported path*, that `setup.ps1` is
best-effort and unverified, **why** (Windows runners cannot run the Linux containers its
database proof needs, and a green job that skipped that proof would mislead more than no
job), and that `state.ps1` specifically *is* covered by `windows-state`. That last
sentence matters — a reader can now tell which half is checked, which is the whole point
of D-86.

## The limit: I could not execute the red proof, and that is structural

Order 018's deliverable was the **failing** run — push with the anchored match weakened
to a substring, show the job go red, restore it. Codex did this the right way: the
weakening was applied to the CI checkout at runtime, not committed, which is why
`state.ps1` is still byte-identical. Cited evidence is GitHub Actions run
`31849373292`, job `windows-state`, exiting 1 at `inline-marker near-miss`.

**I cannot re-run that.** It executes on a GitHub Windows runner. This machine has no
`git` on Windows — the very fact that produced F9 — so I cannot reproduce the job
locally, and I cannot re-execute someone else's Actions run.

So my verification of Order 018 is:

- **Executed:** scope and byte-identity checks, workflow parse, job structure, absence of
  escape hatches, all five assertion deltas read from the committed YAML.
- **Not executed:** the red proof. A CI run record is better evidence than a builder
  paste — it is produced by infrastructure neither of us controls — but under D-84 it is
  not reviewer-executed, and I will not call it that.

**This is a gap I created.** D-86 ordered coverage on a surface the reviewer structurally
cannot re-run, which means every future change to `windows-state` inherits the same
limit. I would rather name that now than discover it later as a surprise. It does not
block approval: the job's logic is fully readable, its assertions are correct, and the
consequence of it being subtly wrong is a Windows convenience script drifting — not a
tenant leak or a double-booking. But if `windows-state` ever guards something that
matters, the tier is wrong and it needs a different mechanism.

Recorded as **D-89**.

## Verdict

**APPROVED.** Order 018 delivered what it was asked for, held a scope that was easy to
violate and specifically tempting, and used the one technique that satisfies both "prove
it fails" and "do not touch the script".

Phase 0 is complete. Every DoD line in `BUILD-PLAN.md` Phase 0 now has an executable
proof behind it, and the last unexercised surface in the repository is documented as
unexercised rather than claimed as covered.

## Not defects — recorded so they are not re-litigated

- The probe file is written into tracked `handoff/questions/` rather than a temp dir. It
  is removed in `finally` and never committed; writing it in place is what makes the test
  exercise the real code path rather than a synthetic directory.
- `windows-state` runs on every push alongside three Ubuntu jobs, adding Windows-runner
  minutes. Worth it for the only PowerShell coverage that exists; revisit if CI cost
  becomes a real constraint.
