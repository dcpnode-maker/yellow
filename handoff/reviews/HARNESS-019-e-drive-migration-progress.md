# HARNESS-019 — storage migration progress, 2026-09-29

Scope: storage relocation and work pause, not product acceptance.
Operator: primary Codex agent. No independent acceptance claim.

## Direct observations and completed work

- All three saved build/review automations are PAUSED. No other listed Codex
  chat was active, and no child agent was running.
- Worker 1's exact Ankit notebook was stopped through normal Kaggle UI.
  Its UI reported `Session stopped` and `off (run a cell to start)`.
- Worker 2 Arabian Nights notebookce88a28cae and Worker 3 dcpnode
  notebook28fded2af7 both displayed off / Start session. No new HARNESS-018
  model microtask was submitted. Owned browser sessions were then closed.
- Archived Codex sessions: 13,744,915,027 bytes, 807 files. All source/target
  SHA-256 hashes and inventories agreed before source cleanup. Original path
  is now a junction to E:/CodexData/ArchivedSessions.
- CompSet Studio: 2,925,022,074 bytes, 17,682 files. All source/target hashes
  and inventories agreed before source cleanup. Original path is a junction
  to E:/YellowWorkspace/CompSetStudio. Git HEAD after relocation is
  82f1477b3b062fb861be43be68125f0afaeeeff4; five existing dirty paths remain.
- C: free space measured 20.81 GiB after these two verified relocations;
  E: measured 41.89 GiB free. This is not a claim that all folders moved.
- Source copies were removed only after verification; their data remains
  recoverable at the verified E: targets. No unrelated files were deleted.

## Migration proof and retained failures

Synthetic tests exercised file hashes/content, idempotent completed moves,
NTFS junction preservation, no cleanup through an external junction, and
rejection of broad unapproved roots. They passed in normal current-user
PowerShell under existing RemoteSigned policy, with no policy change.

An initial robocopy security-copy test returned an NTFS metadata permission
error and failed inventory verification; its original fixture was retained.
An initial Set-Acl container operation requested unavailable audit privileges.
The corrected implementation copies normal data/timestamps, preserves explicit
child ACLs, and secures new containers using DACL-only icacls. It does not
elevate or request audit/SACL privileges. Original real data was not removed
by either failed test.

Detailed file manifests/copy receipts are private and local under
E:/YellowMigration-20260929/receipts/. They contain no exported credentials.

## Remaining phase

A finite hidden offline migration helper was started through normal local
Windows process creation (return value 0, PID 16688). It is outside the
Codex parent process and currently reports waiting-for-app-exit. The first
attempt had a startup schema type mismatch and created no confirmed process;
using the actual UInt16 ShowWindow schema resolved that technical error.

The helper waits for Codex/T3 and processes using the affected C: stores to
exit; it does not kill them. It copies and verifies the remaining exact
HARNESS-019 mappings, then switches compatibility junctions and sets new
user TEMP/TMP, pip/uv/Hugging Face/npm cache locations on E:. It stops on
failure or if applications reopen, and expires after 12 hours of waiting.
The helper is not a recurring build automation.

Windows-managed installation/package containers, registry data, unrelated
user files and existing D: services are not manually moved. The package's
user-writable LocalCache is explicitly included. Fresh-app launch, Git
worktree checks and final free-space proof remain required after this phase.

The old batch build-0929b failures, generated-code restrictions, pending
high-risk independent reviews, full-suite failures and licensing gates remain
unchanged. Drive mounting, HARNESS-018 and the ecosystem build are paused.
# Latest correction and native status window — 2026-09-29

Founder narrowed migration to our project/source files and artifacts, excluding
Codex active profile/settings/runtimes. Exact waiting helper PID16688 was verified
against command, parent and creation time, then stopped at 10:48:12 UTC. No copy
was running. Codex home and Documents roots remained ordinary directories; archive
and CompSet verified aliases remain intact. Original broad execution modes now
fail before any writes, and the old manual launcher only explains the retirement.

The receipt now says paused-scope-revised. Project relocation is not complete or
restarted; founder can keep Codex open. Control-plane gate/register corrected.

Read-only Migration-Status.ps1 snapshot actually reported two completed relocations
(CompSet 2.72GiB and archives 12.8GiB) and two pending project/source categories,
C20.79GiB and E41.89GiB free. No fabricated progress percentage or ETA.

Graphical Windows status viewer launched independently through Win32_Process,
ReturnValue0, PID15764. Get-Process confirmed live MainWindowTitle
Yellow file migration - live status and native MainWindowHandle394954. It refreshes
every3s. No screenshot/pixel acceptance claimed. Closing this read-only viewer
does not start/stop file moves. Migration-Status.cmd reopens it; console is hidden.

One initial combined patch was rejected for duplicate operations on the receipt;
it made no changes. Corrected patch succeeded. No unrelated process was killed,
files deleted, live service restarted, worker activated or credentials exported.

## Final project-file acceptance — 30 September 2026

The founder's project-only scope is complete. Physical project storage is
`E:/YellowWorkspace`; Codex installation/profile/settings/runtimes remain on C:.
Eight usable registered checkouts, CompSet Studio, saved C project aliases and
working-file routing are verified. One pre-existing D registration remains
prunable and unrelated historical D runtimes were not removed.

Independent reviewer `/root/migration_final_review` did not implement or perform
cleanup. It personally inspected the one-shot scripts and executed native
realpath/alias checks, sealed restoration-to-cleanup-journal reconciliation,
SHA-256 verification of all 15,164 non-index recovered E files, index preservation
and `git -c core.fsmonitor=false ls-files --stage -z` with optional locks disabled,
direct worktree HEAD checks, and detailed main-checkout status. Findings: zero
non-index mismatches; 15,165 unique matching journal entries; all three retained
C roots absent; active and preserved indexes both285 entries/digest
`aee7803925eadd87accc9dd6350f9e5689cd42f470909765669838cab2d8c757`;
main HEAD `57876f9d1760bb1f06fab77dad38631ee31d5784`;595 detailed status entries
(11 tracked/584 untracked). The174-file residual/archive cleanup and surviving
121,369,534-byte archive hash were independently checked as well.

Parent post-restart executable checks: Yellow typecheck passed; import boundaries
18 files passed; harness controller8 pass/1Windows symlink skip; CompSet server
smoke3 pass; worker adapter11Node+12Python pass. Codex desktop/main executor were
not stopped during this continuation. C free measured15.84GiB and E32.26GiB;
these are observed free-space values, not an attribution of all disk changes.

A prior Move-Item traversed a nested junction. Every moved file was restored and
hash-verified before proceeding. The failure/denied native rename/history remain
intact; only a fresh after-reboot atomic native rename succeeded. The original
Git index is retained as a31,398-byte audit file on E:. All cleanup used checked
leaf removals and empty-directory removal; no recursive traversal through links.

Final credential-free receipt:
`E:/YellowWorkspace/MigrationAudit/project-files-final-verification-20260930.json`.
The current local status window refreshes every minute without model calls.
Storage-only pause is lifted; automatic worker dispatch remains false, with
prior denials and failed claims preserved. No full-harness/product/UI/Drive mount,
current Qwen readiness, paid-worker fallback, generated-code execution, source
integration, PR/merge or fresh live-app acceptance is implied by this sign-off.

