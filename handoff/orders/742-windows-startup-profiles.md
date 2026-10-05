# Order742 — reversible Windows sign-in profiles (source preparation)

Founder wants Normal Windows / Yellow Optimized, low RAM, free workers only.

## Current delivery gate (supersedes mutating requirements below)
Root rejected both initial and revised mutation code. Founder timing choice remains
pending and observed optional candidates already disabled. Deliver ONLY Audit,
Plan and preview chooser now. Remove all actual registry/filesystem/process mutation
implementation; Install/Uninstall/Choose operational flags must explicitly refuse
as not ready. Preview UI returns selection only, no launch/marker. Keep historical
full-profile requirements below for successor design, not activated functionality.
Unique test temp directories only; no USERPROFILE writes or live registry writes.
Root will independently execute read-only/mocked tests. No use-ready installation
claims, no instructions inviting execution of an unsafe draft.

Codex coordinates; Antigravity Gemini implements. No GPT implementation worker.
Read PROJECT.md, AGENTS.md, this order, docs/YELLOW-STARTUP.md, and existing
scripts/start-yellow-existing.ps1. state.ps1 owned-native cleanup probe currently
fails; state.sh invokes brokenWSL: do not retry/fix. Source checkout is
D:/Yellow/git-live-order611-source-v2, hundreds of unrelated dirty files preserved.

Builder scope ONLY:
- scripts/yellow-startup-profile.ps1
- tests/order742-windows-startup-profiles.test.ts
- docs/YELLOW-WINDOWS-PROFILES.md
- handoff/receipts/742-windows-startup-profiles.md
Root additionally owns questions/742.md, this order, docs/PROJECT-STATUS.md,
handoff/LEDGER.md, handoff/reviews/742-windows-startup-profiles.md and adding exact
instruction/output file permissions to E:/YellowAI/Antigravity/config/settings.json
under existing740backup/strict-mode rules. No actual startup registration, registry
write, process termination, elevated commands, or live mutations in this turn.

Deliver a small readable native PowerShell7 script (not a daemon) with:
1. Default Audit mode: local read-only bounded freeRAM/topprocess/startup NAME
   report, never command lines, registry command values, environment or secrets.
2. Plan mode: exact optional current-user HKCU Run items only, known optional names
   Claude, utweb, Adobe Acrobat Synchronizer, MicrosoftEdgeAutoLaunch_* and
   GoogleChromeAutoLaunch_*. Not Docker, GoogleDrive, Ollama, audio, security,
   coreWindows/OEM services, unknown entries, HKLM, tasks, Startup folders or UWP.
   Explain all other startup mechanisms remain untouched. No claim of OS-only boot.
3. Explicit -Install -StartupNames EXACT names (wildcards refused): user-level
   management of ONLY selected allowlisted existing enabled HKCU Run entries.
   Confirmation before changes. Private per-user JSON manifest stores originals
   locally, command values never printed; create backup first, fail closed if state
   exists/corrupt/drift, idempotency, no overwrite of unrelated files. Install own
   uniquely named HKCU Run chooser value only after backup and validation; removing
   selected original Run entries defers them to chooser. Handle partial failure
   with safe rollback/recovery. Do not change StartupApproved disabled values or
   inadvertently enable previously disabled startup entries; reject ambiguous state.
4. -Choose: clear interactive Normal / Yellow Optimized sign-in chooser. Normal
   launches only previously managed startup commands once; Yellow skips them.
   Neither stops already-running processes. Normal on dialog cancel. No hidden
   infinite waits, no full-memory cleaner, no automatic live app/model/download.
   Start saved commands without Invoke-Expression/eval or shell composition. If
   safely parsing a Run command is unsupported, reject it at Install, not later.
   No duplicate instances: per-session single invocation protection. Startup launch
   failure actionable and redacted. A WinForms chooser or simple visible console
   chooser is acceptable; clearly say sign-in, not BCD boot menu.
5. -Uninstall: explicit confirm, preflight original-slot collisions and own chooser
   identity, restore exact original entries, remove ONLY own chooser/manifest after
   successful restoration, no overwrite of externally changed state. Recovery
   preserve originals if any operation fails. No recursive deletion.
6. -WhatIf for mutating entrypoints, injectable seams/mock tests so testing NEVER
   touches real registry/startup/processes. Dot-sourcing exposes functions without
   executing audit/choose. PowerShell parser check and executable mocked tests.
   Use Bun test to spawn pwsh like697; test rejects wildcard/protected/disabled
   entries, safe quoting, collision/drift, rollback, defaults, normal/optimized
   plans, duplicate launch protection and uninstall. Keep scope minimal.

If a requirement cannot be safely implemented, record exact remaining limitations,
do not weaken it or claim ready. No execution of install/uninstall/choose against
the laptop. Tool shell may be denied: write source/tests through allowed filetools
then report unexecuted tests honestly. Root independent verification follows.

Docs: measured RAM is transient; sumWorkingSet doublecounts sharedpages. Existing
start-yellow-existing.ps1 remains separate explicit live-on-demand helper. Security,
drivers, pagefile, updates, coreWindows and Yellow data remain intact. Startup tasks
and app self-restoration can still launch other apps. Real preboot menu needs a
separate approved design; never use Safe Mode for ordinary development. Benchmarked
savings require comparable restarts, not promises. No dependency install needed.
