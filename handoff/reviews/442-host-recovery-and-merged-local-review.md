# Order442 independent recovery-backup verification

Reviewer: `/root/native_migration_assembly` (independent), 2026-09-06.

Personally verified the completed checkpoint at:

```text
D:\Yellow\recovery\20260906T010518482Z-9d962289
G:\My Drive\Yellow\20260906T010518482Z-9d962289
```

The manifest records merged main `b5ef70842b658183f7b5b4c650c8e78c7a0b513d`,
three worktrees, eight listed artifacts, and 19,808,105 bytes. Verification
results:

```text
manifest artifact hashes: 0 mismatches (stage and mounted-Drive copy)
git bundle verify: OK; complete history, 533 refs
uncommitted ZIP entries: 26 checked, 0 manifest-hash mismatches
yellow: head unchanged, status unchanged, 21 captured files
yellow-order175-folio-responsive-containment: head unchanged, status unchanged, 5 captured files
yellow-order432-rate-pricing: head unchanged, status unchanged, 0 captured files
```

The bundle was verified with native Git and the ZIP entries were decompressed
and SHA-256 checked independently against the manifest. The backup script’s
exclusions remain binding: live databases/volumes, Docker VHDs, dependencies,
toolchains, caches, and crash dumps were not backed up. The manifest correctly
states `databaseBackupIncluded=false` and `remoteUploadVerified=false`.

Google Drive for desktop was unavailable for a completed-sync confirmation
(`failed to write kernel assets path missing`). Mounted-drive readback therefore
proves copied bytes only; no cloud-sync or remote recoverability claim is made.
This checkpoint covers the worktrees exactly at capture time; later dirty or
untracked changes require a subsequent backup. No deletion, cleanup, source
mutation, or database action was performed.

## Extended native-review backup static review

Reviewer: `/root/native_migration_assembly` (independent), 2026-09-06.

The `-IncludeNativeReview` branch is correctly bounded to the receipt's exact
`yellow_order442_review` database on PostgreSQL 16.15 at `127.0.0.1:55503`.
It uses a custom-format logical `pg_dump`, verifies `pg_restore --list`, excludes
global roles and live cluster files, and adds only the protected app/seed env,
receipt, referee log, and host `.wslconfig` to a separate ZIP. The database
archive and private-config ZIP are included in the ordinary manifest artifact
hash list, and the restore text explicitly makes clear that no restore drill was
performed.

## Stage-only branch safety review

Reviewer: `/root/native_migration_assembly` (independent), 2026-09-06.

Static PowerShell parsing of the current `scripts/backup-yellow-recovery.ps1`
returned `parse_errors=0`. The `-StageOnly` branch writes only
`STAGED-ONLY.txt` under the already validated D: stage, returns before
`CreateDirectory($destination)` and before every Drive `Copy-Item`, and reports
`GoogleDriveFolder=$null`, `LocalCopyVerified=$false`, and
`RemoteUploadVerified=$false`. It therefore cannot create Drive files in that
mode. The stage ACL is explicitly protected and grants full control only to the
current Windows identity.

The optional native database path invokes `pg_dump` only against the exact
receipt-validated synthetic database, with a five-second connect timeout and
ten-second lock wait; it does not issue SQL writes or copy cluster/global-role
files. Password values are held in process environment only and are not printed;
archive listing contains object metadata, not credentials. The private ZIP paths
are fixed and reject containers/reparse points.

The exact source/target checks, GUID-stamped stage name, refs-before/after check,
and post-copy hash checks remain intact. `-StageOnly` still validates the Drive
root exists and computes its would-be destination, but performs no destination
mutation. No execution of the script was performed in this review.

Dump-inventory correction: earlier scoped inspection did not cover
`C:\Users\astha\AppData\Local\Temp\wsl-crashes`; coordinator evidence says it
still contains nine dumps totaling 8,436,600,824 bytes. I did not read dump
contents or personally inspect that path. No deletion or cleanup is claimed.

One privacy limitation remains: the stage directory receives an owner-only ACL,
but the newly created mounted-Drive destination is not assigned or checked for
an owner-only ACL. Because the private-config ZIP contains credentials and the
logical dump contains synthetic database contents, the Drive destination's
effective ACL and desktop sharing state must be independently confirmed before
relying on it; no public-link or cloud-sync claim is permitted. The script's
fixed roots and exact receipt checks otherwise prevent targeting another
database. Ignored worktree files remain explicitly inventoried rather than
silently claimed as captured.

Correction to the earlier dump inventory: the scoped check of
`D:\Yellow\wsl-crash-quarantine` did not cover the crash location under
`C:\Users\astha\AppData\Local\Temp\wsl-crashes`. Per coordinator-provided
current evidence, that location still contains nine WSL crash dumps totaling
8,436,600,824 bytes. This review did not read their memory contents or claim
personal observation of that C: path. No dump deletion or alternate cleanup was
performed.

## Order442 native merged-main preview verification

Reviewer: `/root/native_migration_assembly` (independent), 2026-09-06.

Personally inspected the already-running native process and runtime receipt at
`D:\Yellow\runtime\order442-review`. Native Bun PID 10856 is running
`src/server.ts` with the protected `app.env`; the executable is the Windows
native Bun installation. The extracted source archive hash matches the receipt:

```text
merged-main-source.zip
F923DDAD39171E449A3712725A3C43358E7916B6B80E4BA056FC4E2ED0268087
source revision b5ef70842b658183f7b5b4c650c8e78c7a0b513d
```

Read-only endpoint checks personally returned:

```text
GET http://127.0.0.1:3000/ready: 200
revision=b5ef70842b658183f7b5b4c650c8e78c7a0b513d
expectedMigrationFrontier=77
POST /api/v1/auth/local:login using protected configured values: 200
```

The configured six worker flags were present (values intentionally not
printed): hold-expiry, availability-projection, pickup-task, reservation
arrival-roll, reservation departure-roll, and business-day-roll. The retained
referee log reports `RESULT: 11 passed, 0 failed of 11`. No WSL process was
started and no crash-dump contents were read; the only dump-related directory
visible in the scoped inventory was `D:\Yellow\wsl-crash-quarantine`.

This verifies source identity, readiness, configured workers, and one local
login only. It does not establish a stability soak, cloud sync, provider
activation, production safety, or completeness of later worktree changes after
the backup instant. No process, database, credentials, or source was modified.

## StageOnly native-review checkpoint verification

Reviewer: `/root/native_migration_assembly` (independent), 2026-09-06.

Personally verified checkpoint `D:\Yellow\recovery\20260906T020603870Z-644ad0ec`,
captured at the recorded `02:06:03.870Z` instant before subsequent hosting-status
documentation changes. The manifest records main
`b5ef70842b658183f7b5b4c650c8e78c7a0b513d`, three worktrees, 11 hashed artifacts,
and native synthetic DB backup enabled. The stage contains 14 files totaling
21,630,399 bytes (the additional files are manifest/restore/staged-only notes).

```text
manifest artifact hashes: 0 mismatches
uncommitted ZIP entries: 36 checked, 0 mismatches
git bundle verify: OK (complete history; SHA-1 bundle)
stage ACL: protected=True, owner=ASTHA\astha, rules=1
pg_restore --list native-review-database.pgdump: exit 0, 1950 archive entries
```

The checkpoint is StageOnly: no Drive files were created, no restore or database
creation was attempted, and no deletion was performed. Mounted Drive/cloud sync,
restore success, and recovery of later post-capture changes remain unverified.
