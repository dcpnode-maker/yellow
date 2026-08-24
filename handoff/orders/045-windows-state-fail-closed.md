# Order 045 — Fail-closed Windows handoff-state reporting

**Phase:** 2 · Review correction
**Branch:** `phase-2/windows-state-fail-closed`
**Tier:** 2 — non-authoritative status tooling with executable Windows coverage
**Written by:** OpenAI Codex, temporary architect under D-95/D-115
**Finding:** F10 in `handoff/reviews/027-044-phase-2-cumulative.md`

## Outcome

Make `state.ps1` return failure whenever a terminating error prevents it from producing
the complete D-58 handoff report, while preserving Order 041's successful-report reset
for optional native probes such as an unavailable Docker daemon.

## Scope

- `.github/workflows/ci.yml`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/orders/045-windows-state-fail-closed.md`
- `state.ps1`

## Required behavior

1. Set a completion marker only as the final statement of the report-producing `try`.
2. On a terminating report error, restore `COMPOSE_PROJECT_NAME`, write a labelled error
   to stderr, and propagate a non-zero process result. Do not emit the normal completion
   footer after the failure.
3. Clear caller-visible native status only when the completion marker proves the whole
   report ran. Preserve a zero result and following caller statements after an otherwise
   complete report whose optional Docker probe returns non-zero.
4. Extend the existing `windows-state` CI job with a child-PowerShell proof that removes
   Git from `PATH`, observes a non-zero child result and incomplete report, restores the
   environment, and then proves a normal snapshot still completes.
5. Append Claude's D-161 review-discharge text verbatim, record this correction as
   D-162, and add traceable review/order events to the ledger. This records review; it
   does not mark any order merged or self-approved.

## Forbidden

- `state.sh`, setup, application, Compose, migration, dependency, database/referee,
  tenant, RLS, occupancy, journal, fiscal, or output-count/phase/marker-rule changes.
- `exit` inside `state.ps1`, catching and continuing after an incomplete report,
  weakening existing Windows transition assertions, or treating CI as independent
  architect review.
- Closing Question 041, marking any order merged, approval, or merge.

## Pre-registered proofs

- **P1 red:** before the fix, a child Windows PowerShell with Git absent from `PATH`
  prints the report header but no `Referee:` footer and nevertheless leaves
  `LASTEXITCODE=0`.
- **P2 green:** the identical child probe returns non-zero, includes the labelled failure,
  contains no completion footer, and restores the caller environment.
- **P3:** Order 041's failing optional-Docker probe still yields one complete parseable
  report, returns zero, and permits the next caller statement to execute.
- **P4:** normal native execution and every existing open/resolved/ratified/near-miss/
  cleanup transition remain green; the new CI proof fails against the parent commit.
- **P5:** diff scope is exactly five files; the full standing self-check and unchanged
  referee return `11 passed, 0 failed of 11`.

## Red evidence

Executed against reviewed tip `fd2b9cf` with the Windows `PATH` filtered so
`Get-Command git` returned false:

```text
GIT_PRESENT=False
YELLOW state · Compose project yellow-phase-1
The term 'git' is not recognized ...
REPORT_COMPLETE=False
LASTEXITCODE=0
```

The wrapper exited 17 only because it detected the defect.

## Standing checks

Run P2–P4 natively, then restart the repository standing self-check from the top.
Refresh Graphify, commit with `[codex]`, push, and open a draft descendant PR. Do not
approve or merge.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
