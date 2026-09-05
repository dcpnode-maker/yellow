# Start here — Yellow on Windows

Use the existing checkout and installed dependencies. Do not copy the project into
WSL, unzip another package or initialize another repository merely to resume.
Read [the common guide](START-HERE.md), [PROJECT](PROJECT.md),
[PROJECT-STATUS](docs/PROJECT-STATUS.md) and [USAGE](USAGE.md)
for current branch, scope and proof requirements.

For a fresh clone, run `bun install --frozen-lockfile` from the repository root.
The tracked `package.json` and `bun.lock` already define Yellow; `bun init` is a
project-scaffolding command and is not part of setup.

## Current workstation boundary

**2026-09-05:** native Windows Git/Bun/source checks remain the safe orientation path
while the recorded WSL Bun crash-dump recurrence is unresolved. This documentation
does not claim the user's WSL incident is fixed. `state.ps1` has Windows CI coverage;
`setup.ps1 -DbOnly` now checks the migration-77 / 127-public-table catalogue. A native
run, the Linux local-review launcher and CI are separate environments. Skipped or
failed setup is not green database proof.

The 127 count includes the migration runner's `schema_migration` ledger: 126
application tables across migrations1–77 plus that ledger. Reviewed main `443e3826`
contains PR83's independently approved native source, with all five CI jobs green
at exact source `92346674`. Earlier main `5879e2b7` had 75 migrations / 125 tables.
See [SCHEMA-GUIDE](docs/SCHEMA-GUIDE.md). No Windows runtime refresh is implied
by a Git merge or CI result.

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

The native session inventory reads the same canonical current task as Unix:

```powershell
& .\state.ps1
```

If execution policy prevents it, inspect the script and follow the machine's approved
policy; do not weaken system-wide policy. Legacy unclosed markers remain visible only
as a historical-record count; they do not replace the current task in PROJECT-STATUS.

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

`setup.ps1 -DbOnly`, the checked Unix database gate and GitHub database workflow are
separate verification environments. Setup migrates development data and recreates a
disposable test database; it is not read-only. Do not repurpose a live hotel database.

The single full local-review workflow is `./scripts/local-review.sh`, accepting one
of `start`, `status` or `stop`, at `http://127.0.0.1:3000`, as specified in [RELEASE](docs/RELEASE.md) and
[LOCAL-REVIEW](docs/LOCAL-REVIEW.md). It requires the supported Bash/Docker environment
and refuses a dirty checkout. On the affected Windows machine, do not assume that
script is safe inside WSL until the crash recurrence is diagnosed. When it is run in
an approved environment, verify `/ready` reports the selected 40-character Git SHA,
target `yellow_runtime_database` and migration frontier 77. Passwords and local prefill
remain in protected ignored storage, never Git.

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
not a Phase-0 kickoff prompt. Codex owns and coordinates development, using bounded
internal models by risk, cost and capability. Preserve independent high-risk proof
and normal GitHub integration.
