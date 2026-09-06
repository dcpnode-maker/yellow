# Order442 — Host recovery backup and merged-main local review

**Status:** ACTIVE. **Date:** 2026-09-06. **Owner:** Codex coordinator.

## Founder request

Remove WSL crash dumps, audit unnecessary disk use, preserve one complete Yellow
recovery folder through Google Drive for desktop, resolve repeated dump growth,
and show the application from the latest merged main after space is available.

## Boundaries and observed evidence

- Nine `wsl-crash-...-_usr_local_bin_bun-11.dmp` files occupy8,436,600,824 bytes.
  Names identify Linux Bun and signal11, not the originating Bun stack or proof
  that production is unaffected. The attempted approved deletion was blocked by
  tool policy; no deletion is claimed and no alternate deletion bypass is allowed.
- Windows-native Bun1.3.14 and PostgreSQL16.15 already execute Yellow proofs.
  Avoid invoking Linux Bun/WSL for this recovery operation. A diagnostic retention
  limit contains disk growth but does not repair an unidentified runtime defect.
- Google Drive for desktop is mounted at `G:\My Drive`. This is a streaming mount;
  a local readback/hash does not independently prove completed remote upload.
- Three registered worktrees exist. Canonical `yellow` has uncommitted/untracked
  work, so GitHub alone is not a complete backup. Do not delete, reset or relocate
  any working tree before portable recovery and independent preservation proof.
- The native proof cluster on127.0.0.1:55503 is live. Compose's down status does not
  authorize deleting it or any other PostgreSQL directory.

## Exact admitted scope

```text
handoff/orders/442-host-recovery-and-merged-local-review.md
handoff/reviews/442-host-recovery-and-merged-local-review.md
handoff/questions/200-host-recovery-runtime-admission.md
scripts/backup-yellow-recovery.ps1
docs/RECOVERY.md
docs/PROJECT-STATUS.md
DECISIONS.log
handoff/LEDGER.md
C:\Users\astha\.wslconfig (new per-user WSL dump-retention limit only)
D:\Yellow\recovery (new staged portable backups and manifests only)
G:\My Drive\Yellow (new desktop-synced recovery folder only)
```

Read-only inventories may inspect the founder-scoped C/D/E Yellow directories,
registered worktrees, exact dump folder, local desktop Drive status, installed
toolchains, process/port metadata and relevant crash logs. Do not read dump-memory
contents, expose credentials, alter Drive's internal databases or change sharing.

Backup must include a verified Git bundle of all refs, the latest merged-main source
archive, exact dirty/untracked work from every registered worktree, necessary private
local configuration and a restore manifest. Exclude regenerable node_modules/caches,
live PostgreSQL files and Docker VHDs. Record exclusions, do not claim they were saved.
Database preservation needs separately verified consistent logical backups, not a
copy of active database files. Never put private configuration in Git or a public link.

No destructive cleanup beyond the explicit dump request, system-file editing,
partition operations, Docker/WSL shutdown or broad process killing is admitted.
The user's dump request does not authorize deleting diagnostic files through an
alternate mechanism after the tool-policy rejection.

Local deployment needs a scoped Question200 identifying exact source/main SHA,
runtime directory, database, privileges, startup/stop commands and verification
before creating it. Do not label current unmerged fiscal work as merged main.
One loopback application at3000, prefilled synthetic review sign-in, no real hotel
data and no provider activation. Preserve existing native proof databases.

## Acceptance

[Question202](../questions/202-free-host-arm64-proof.md) admits a bounded native
ARM64 CI compatibility proof for the founder's free-host request. It reuses the
existing launcher/migrations/referee/login on a standard free public-repository
runner. No laptop Docker, paid resource, image publication or cloud deployment.

Q202's bounded native compatibility proof is complete atd88ae59 in ARM job
101425264551/CI34010394787: both image identities, actual migration/referee11/11,
readiness78, synthetic sign-in and cleanup pass. Independent fiscal_integration_map
personally dispatched and inspected the execution; root separately read its log.
This does not close the broader recovery, offsite verification or deployment order.

Record actual deleted/reclaimed bytes (if any), retained dependencies, complete
bundle verification and artifact hashes, explicit remote-sync confirmation status,
recoverability limitations, source-exact local readiness/login and a browser image.
Any dump cap is containment pending diagnosis and observation, not permanent repair.
Independent preservation review precedes any worktree retirement. Phase7/provider
completion and production stability are not implied by a local demonstration.
