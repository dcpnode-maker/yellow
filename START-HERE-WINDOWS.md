# Start here — Yellow on Windows

> **Development documentation snapshot — 2026-09-05.** Source:
> [`61dbeea`](https://github.com/dcpnode-maker/yellow/commit/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e).
> This updates the original project documentation on main; main's executable code
> is still an older integrated baseline. Implemented contracts, setup behavior and
> proof described below refer to that development revision, not a claim that main
> or the local app already runs them. Planned capabilities remain planned.


Use the existing checkout and installed dependencies. Do not copy the project into
WSL, unzip another package or initialize another repository merely to resume.
Read [the common guide](START-HERE.md), [PROJECT](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/PROJECT.md) and [USAGE](USAGE.md)
for current branch, scope and proof requirements.

## Current workstation boundary

**2026-09-05:** native Windows Git/Bun/source checks are being used while WSL Bun
crash-dump recurrence is unresolved. The original WSL-only onboarding is not today's
resumption procedure. This does not claim native full setup is CI-equivalent:
`state.ps1` has Windows CI coverage, while `setup.ps1` still contains a stale
89-table expectation and has not been validated against the current 74-migration /
125-table development frontier. Skipped or failed setup is not green database proof.

## Read-only orientation in PowerShell

Open PowerShell in the existing repository:

```powershell
git status --short --branch
git log -1 --oneline
git remote -v
Get-Command git, bun, python -ErrorAction SilentlyContinue
Get-PSDrive -Name C,D,E -ErrorAction SilentlyContinue | Select-Object Name, Free
```

If Git is not on PATH, use the existing `git.exe` location reported by the environment.
A missing PATH entry does not require another installation. Do not print credentials
or protected `.yellow` contents in diagnostics.

The native session inventory is:

```powershell
& .\state.ps1
```

If execution policy prevents it, inspect the script and follow the machine's approved
policy; do not weaken system-wide policy. The historical-open-order parser can
overstate counts or infer a phase from old orders. Reconcile with latest decisions,
the actual current order and [roadmap](handoff/ROADMAP.md).

## Native source checks

Where pinned dependencies already exist:

```powershell
bun run typecheck
bun run boundaries
bun run license-check
git diff --check
```

These are not database proof. Choose the order's tests and record missing-environment
skips. A qualified non-implementer must personally execute high-risk proof in a
recorded environment; a pasted implementer result is not independent verification.

## Database and local review

Yellow targets PostgreSQL 16. A controlled native toolchain may support a scoped
proof, but cluster ownership, roles, paths, ports and teardown must be established
first. Do not repurpose a running PostgreSQL process or live hotel database simply
because it is available.

The checked Unix `setup.sh` and GitHub database workflow remain separate verification
environments. Setup migrates development data and recreates a disposable test database;
it is not read-only. Avoid the affected WSL path until diagnosed. Do not start Docker
or another cluster for documentation-only work.

For an authorized refresh, identify the one retained Compose project and protected
runtime configuration. The desired founder endpoint is `http://127.0.0.1:3000`;
verify the serving commit and real login before calling it current. Read
[LOCAL-REVIEW](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/docs/LOCAL-REVIEW.md) for mechanisms, but its historical alternate-port
and seed examples are not the current runtime receipt. Passwords/local prefill stay
in protected development storage, never Git.

## Disk and synchronization safety

- Keep one repository lineage; preserve dirty branches/worktrees until changes are
  safely integrated or archived with verified recovery.
- Do not sync live `.git`/worktree metadata, `node_modules`, Docker disks, model
  stores or temporary PostgreSQL clusters as source backups. Use approved sync
  controls and stable committed checkpoints.
- Resolve exact cleanup targets; distinguish physical allocation from logical sizes
  or hard-linked files. Never erase broad drives, profiles or unknown personal folders
  under the label “build cache.”
- Use native PowerShell for file operations end-to-end; do not pass enumerated paths
  to another shell for deletion.

## What to build next

There are **18 phases (0–17)** and **13 bounded contexts**. Start with
[FEATURE-REGISTER](docs/FEATURE-REGISTER.md), the current phase and scoped order,
not a Phase-0 kickoff prompt. Codex coordinates bounded parallel implementation with
model choice by risk, cost and capability. Preserve independent high-risk proof and
normal GitHub integration.
