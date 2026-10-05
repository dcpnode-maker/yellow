# HARNESS-019 — Pause work and migrate C: development storage to E:

Status: complete for the founder-revised project-file scope, independently verified
30 September 2026. Local governed build work may continue on E:. Worker/model
activation remains HARNESS-018's separate prerequisite gate, not this acceptance.

Final receipt: `E:/YellowWorkspace/MigrationAudit/project-files-final-verification-20260930.json`.
Review: `handoff/reviews/HARNESS-019-e-drive-migration-progress.md` (final section).

## Project-only continuation approved 2026-09-29

Founder closed UI windows and requested continuation. T3 Electron is no longer
observed, but Codex background processes remain. Revised source mappings:
C:/Users/astha/Documents/Codex -> E:/YellowWorkspace/Documents/Codex, and
C:/Users/astha/.codex/worktrees -> E:/YellowWorkspace/CodexWorktrees.
Only code checkouts are moved from .codex, not its profile root. Existing CompSet
and archive aliases remain unchanged. Codex databases, sessions, profiles, settings,
runtimes, installed binaries and browser profiles are excluded.

Use pinned, already exercised inventory/link/hash utilities without executing the
retired broad plan. Self-test the project-only runner first. Hashes and unchanged
source inventory precede switching. Retain original .migrating-20260929 copies
pending separate cleanup review; no material source deletion. Sharing violations
or source mutations stop the switch. No broad kill or private database edit.

## Latest founder correction — overrides the original scope below

2026-09-29: move only project/source files and build artifacts, not Codex itself.
Keep Codex active profile, settings, runtimes and browser/application profiles C:.
The original waiting helper was identity-checked and stopped; no copy was running.
Original script execution modes and manual launcher retired. Completed archive and
CompSet moves remain intact; no undo requested. Revised project move not started.
Scope includes a read-only native Windows status viewer under the migration root
and snapshot tests. The broad original mappings below are historical only.

## Founder authority

2026-09-29: pause all work, move Yellow, CompSet Studio and Codex files from
C: to E:, and update the setup to leave Windows adequate free space. This
supersedes continuation of HARNESS-018 until storage migration is verified.

## Scope

- This order and a matching scoped receipt in handoff/reviews/.
- Local, private migration scripts, receipts and manifests under
  E:/YellowMigration-20260929/; no external uploads.
- C:/Users/astha/Documents/Codex to E:/YellowWorkspace/Documents/Codex.
- C:/Users/astha/CompSetStudio to E:/YellowWorkspace/CompSetStudio.
- C:/Users/astha/.codex to E:/CodexData/.codex; .agents to E:/CodexData/.agents.
- Exact Codex runtime/profile/cache folders under AppData/Roaming/Codex,
  AppData/Local/Codex and AppData/Local/OpenAI/Codex to corresponding paths
  under E:/CodexData/AppData/. Keep installed Windows packages separate.
- Exact related Goose and BrowserAct profiles, and .config/codex-voice-notify,
  to corresponding E:/CodexData/ paths if present and quiescent.
- C:/Users/astha/.cache/codex-runtimes to E:/CodexData/.cache/codex-runtimes.
- Codex's user-writable package LocalCache only:
  C:/Users/astha/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache
  to E:/CodexData/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache.
  The Windows-managed package root, Settings and SystemAppData are not moved.
- C:/Users/astha/AppData/Local/OpenAI/extension to the corresponding
  E:/CodexData/AppData/Local/OpenAI/extension directory.
- Path-preserving NTFS junctions at the original approved folder locations;
  task-specific build/model caches and temporary files on E:.
- Existing build automations and owned worker sessions: pause/stop normally.

## Safety and acceptance

1. Inventory real paths, reparse points, sizes, free space and process owners.
   Do not follow external links into unrelated storage.
2. Do not move the Windows profile root, Program Files, Windows-managed Appx
   installation/package root, global AppData or database volumes.
3. No worker/model restart, paid fallback, generated-code execution, own PR
   merge, broad process kill, credential disclosure or unrelated cleanup.
4. Copy to new, explicit targets; preserve nested link targets and restricted
   access. Verify file contents with hashes before replacing original paths.
5. Live profiles/SQLite stores require app exit and a final verified copy.
   Do not claim migration complete while their writers are active.
6. Keep old path aliases so worktree registrations, thread checkouts and
   existing launchers continue to resolve without editing private databases.
7. Remove only verified old source copies inside these exact targets; never
   recursively delete through a reparse point. Preserve rollback receipts.
8. Prove original aliases resolve to E:, Git HEAD/dirty state is preserved,
   and report actual reclaimed C: space and remaining limitations.

The earlier failed worker batch, outstanding test failures and prior execution
denials remain recorded. Storage migration is not ecosystem/build acceptance.
