# Order 041 — PowerShell state optional-probe exit isolation

**Phase:** cross-phase control correction
**Branch:** `phase-2/operational-block-availability`
**Tier:** 2 — non-authoritative status tooling
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Make a successful `state.ps1` report return success even when its optional Docker
availability probe reports that no daemon is running.

## Scope

- `DECISIONS.log`
- `handoff/orders/041-powershell-state-exit-isolation.md`
- `handoff/questions/047-windows-state-docker-exit-leak.md`
- `handoff/questions/047-ARCHITECT-RESPONSE.md`
- `state.ps1`

## Required behavior

1. Preserve every line, count, marker rule, environment restoration, and optional
   service/database probe in `state.ps1`.
2. After a normally completed report, explicitly clear only the caller-visible native
   command exit status inherited from optional probes.
3. Do not use `exit`; repeated invocation in the same PowerShell process must continue.
4. Do not catch or mask a terminating PowerShell error from the script itself.

## Forbidden

- `state.sh`, workflow, setup, application, migration, test/referee, RLS, occupancy,
  tenant, journal/fiscal, dependency, or output-format changes.
- Weakening or editing the Windows transition assertions.
- Self-approval or merge.

## Pre-registered proofs

- **P1 red:** before the edit, a caller-scoped `docker` function whose `info` command
  invokes a native exit 1 leaves an otherwise complete `state.ps1` at exit 1.
- **P2 green:** after the edit, the same probe produces one parseable `Open work:` line,
  reports all services down, returns exit 0, and a following PowerShell statement runs.
- **P3:** normal native execution still returns exit 0 and preserves the exact report.
- **P4:** PR #22's unchanged `windows-state` job passes all open/resolved/ratified/
  near-miss/cleanup transitions; every other CI job and canonical 11/11 remain green.

## Standing checks

Run P2/P3 natively, typecheck, boundaries, full tests, and `./setup.sh --db-only`.
Push the correction to the existing draft PR and wait for all CI jobs. Do not merge.
