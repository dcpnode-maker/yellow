# Yellow recovery and runtime reliability

This is an operational recovery record, not a production certification. Current
source/release truth remains [PROJECT-STATUS.md](PROJECT-STATUS.md).

## Current local preview

Order442 runs exact merged main `b5ef70842b658183f7b5b4c650c8e78c7a0b513d` at
<http://127.0.0.1:3000/> using native Windows Bun1.3.14 and PostgreSQL16.15.
The synthetic sign-in fields are prefilled. Never expose this convenience outside
loopback or use it for a real hotel account. Six implemented workers are configured;
configuration is not evidence of every workflow completing.

The app source is an immutable archive at `D:\Yellow\runtime\main-b5ef708`, not a
second Git repository. Its `node_modules` junction points to the retained Order175
worktree. Do not remove that worktree while this preview depends on it. The exact
source/archive hash, PID and start time are recorded outside Git in
`D:\Yellow\runtime\order442-review\receipt.json`. Current runtime/source details
must be checked against that receipt and `/ready`, not inferred from a branch name.
Private `app.env` and `seed.env` have owner-only ACLs; never print or commit them.

The retained native cluster is
`D:\Yellow\temp\order434-production-cluster-20260906`, on127.0.0.1:55503.
`yellow_order442_review` contains newly generated synthetic review data.
`yellow_order442_invariants` is a separate disposable referee database. Canonical
migration checksums through77, the77/127 catalogue, referee11/11 and real local
login were verified. No retained hotel data, provider or unmerged fiscal draft
was activated. Compose may report `down` because this preview does not use Docker.

`scripts/start-merged-native-review.ps1` is first provisioning only: it refuses
existing runtime directories/databases/port3000. Do not rerun it as a restart
command, recreate the databases, or rotate credentials to get back into the app.

### Verified reboot resumption — 2026-09-06

`scripts/resume-merged-native-review.ps1` resumes only the retained mainb5ef708
preview after its existing PostgreSQL55503 is available. It validates the complete
archive/extracted source, dependency junction and lockfiles, protected environment,
actual process identity and read-only77 migration ledger. It never provisions,
migrates, seeds, rotates passwords or replaces a listener. It uses the Order443
bounded supervisor:5MiB per file, three files per stream, no automatic restart.

Root, not the helper's implementer, personally ran7 tests/0 failures and the actual
helper. Successful app5716/supervisor16176 started2026-09-06T06:56:53.5264898Z;
PostgreSQL15956 remained unchanged. Exact readiness77, no-store prefill and genuine
authentication passed again through independent HTTP calls. A second invocation
refused the occupied port and left app5716 running. The protected receipt is
`D:\Yellow\runtime\order442-review\resume-receipt-20260906T065651860Z.json`;
initial receipt.json is preserved, not overwritten.

Actual execution first exposed fixed-width PostgreSQL `ready   ` padding, then
PowerShell's automatic JSON timestamp conversion. The latter failed the supervisor
check and exposed incomplete owned-child cleanup. Root verified and stopped only
that attempt's orphan app13072; the builder repaired timestamp normalization and
early parent/executable/command/start-time child binding. Executable regressions
preserve refusals for wrong/stale identities. These are recovery-helper defects,
not evidence that the unrelated Bun crash is repaired. No new screenshot, stability
soak, cloud deployment or later unmerged fiscal activation is claimed.

## What the crashes establish — and what they do not

Nine Linux Bun signal11 dump filenames occupied **8,436,600,824 bytes** under
`C:\Users\astha\AppData\Local\Temp\wsl-crashes` on2026-09-06. That identifies the
faulting executable path `/usr/local/bin/bun` and signal, not an originating
stack, exact runtime defect or proof that application code is uninvolved.
Dump-memory contents were not inspected. D1374 separately records native Windows
Bun readiness-lifecycle crashes; they must not be conflated with Linux dumps.

The approved dump deletion was rejected by tool policy. No file was removed by
the agent and no alternate deletion method was used. A subsequent inventory still
contained the same nine files. Other Yellow directories, models, toolchains,
Docker disks and worktrees were retained; backups do not authorize their deletion.

The new per-user `.wslconfig` sets `maxCrashDumpCount=1`. This is a **count limit,
not a byte limit or a crash fix**. It applies on the next WSL VM start; no WSL
restart or effective-runtime enforcement was claimed. One dump may still be
large. See Microsoft's [WSL configuration documentation](https://learn.microsoft.com/en-us/windows/wsl/wsl-config#wslconfig).

## Diagnostic containment (Order443)

The native preview originally redirected stdout/stderr into uncapped files.
Repeated worker errors could grow those files continuously. This is an identified
operational defect, not an acceptable enterprise behavior. Order443 supplies a
bounded native supervisor and executable synthetic proofs (21 worker-executed
assertions). It has **not been activated**: the founder deferred further work on
the old local preview. Its configured stdout/stderr budget is three5MiB files
per stream,30MiB total, with no automatic restart. Root integration and an
activation receipt remain pending. Do not infer activation from a script existing.

Compose now declares `restart: "no"`, the `local` logging driver with `10m`/three
files per container, and core soft/hard0 for all seven services, including tools.
Images, database volumes, service ports, healthchecks and environment are unchanged.
The [Docker local driver](https://docs.docker.com/engine/logging/drivers/local/)
defines rotation and file count; this is a configured log budget, not a quota on
database storage or the entire host. Actual Docker enforcement is unverified on
this machine because the daemon/tooling was not started. Existing containers do
not acquire these settings merely because the source file changed.

Zero automatic restart is deliberate local crash-loop containment, not high
availability. Production needs a separately tested bounded restart/backoff and
alert/escalation policy. A host crash collector can require its own limits even
when a process core limit exists. Do not edit global Windows crash policy,
disable all diagnostics, or claim the WSL count setting controls native WER.

Before an enterprise reliability claim, personally demonstrate:

- a reproducible diagnosis and runtime fix/validated replacement for the crash;
- bounded logs and host diagnostics by bytes, retention and independent disk budget;
- measured sustained operation, crash recovery, failure injection and disk-pressure behavior;
- database/WAL capacity alerts, backup/PITR policy and an actual restore drill;
- bounded process restarts and worker error backoff without duplicate hotel actions;
- appropriate on-prem/cloud service supervision and operator alerts.

These are unfinished reliability gates. Green CI, startup, successful login or a
Windows-native workaround does not discharge them. No production host is serving
Yellow at this checkpoint, and production safety is not established.

## One Google Drive recovery parent, not a live working directory

The recovery parent is `G:\My Drive\Yellow`, copied through **Google Drive for
desktop**. Staging is under `D:\Yellow\recovery`. Each uniquely named checkpoint
is immutable: a failed/new checkpoint does not overwrite a previous one.

Run the PowerShell7 script `scripts/backup-yellow-recovery.ps1` from the active
project; use `-IncludeNativeReview` to also capture the exact new synthetic review
database and protected native runtime configuration. It produces:

- a native Git bundle of all refs and an exact merged-main source ZIP;
- each of the three registered worktrees' HEAD, status, binary working patch and
  untracked/modified source ZIP, including four explicitly named private configs;
- per-file/artifact hashes, excluded/ignored-path inventory and restore instructions;
- optionally, a consistent PG16.15 custom logical dump of only
  `yellow_order442_review`, its archive listing and private runtime configuration.

The source bundle preserves branches/history without syncing live Git internals.
The active tree and its uncommitted work are not the same as merged main; restore
one deliberate branch/worktree state at a time. Do not blindly overlay all ZIPs.
Live PG data files, Docker VHDs, caches, installed tools, model weights and
node_modules are excluded. Pin/reinstall dependencies during recovery. No other
database or global role catalogue is included in the optional synthetic dump.

First checkpoint `20260906T010518482Z-9d962289` contains533 Git refs and26 captured
working-file entries,19,808,105 bytes total. A non-implementing reviewer verified
the bundle and every artifact/entry hash. That checkpoint **predates the local
preview** and has no database backup. Later checkpoints must be interpreted using
their own manifest and independent proof; a PG archive listing is not a restore
drill.

This folder contains private configuration: keep it private, restrict restored
files, and never commit it or create a public share. Mounted-Drive hash readback
proves the copied bytes locally, **not completed cloud upload**. Native desktop
and browser automation failed initialization with a missing kernel-assets path,
so remote synchronization and a new visual screenshot remain unverified. Codex
queued the local browser URL; that is not a successful visual inspection.

Before relying on offsite recovery, confirm the desktop app has finished syncing
and perform an independent remote retrieval/restore test. No original worktree,
model, Docker disk or database may be retired on the basis of an unconfirmed
mounted-drive copy. Do not put the active runtime, database, `.git`, dependencies
or Docker disk on the streaming drive.

## 2026-09-06 continuation: free hosting and fresh recovery checkpoint

The founder requested free hosting and an up-to-date recovery copy without
unnecessary C: growth. `-StageOnly -IncludeNativeReview` completed at
`D:\Yellow\recovery\20260906T020603870Z-644ad0ec`:14files,21,630,399bytes,
three worktrees, all Git refs, exact merged-mainb5ef708, captured working source,
protected native configuration and the synthetic review database logical dump.
Independent Review442 personally verified the bundle, all11manifest artifact
hashes and36uncommitted ZIP entries (zero mismatches), the protected owner-only
ACL, and the1,950-entry PG archive listing. No restore drill is implied.
This is a point-in-time checkpoint,
not a copy of documentation written after capture.

This new checkpoint is **D:-only**. No new Drive upload was performed. Connector
search found the older `Yellow Laptop Full Drive Backup 2026-08-26` folder but
not the desktop mount's `Yellow` parent/checkpoint. The mount and connector may
represent different accounts or incomplete sync; neither cause is proven.
Remote identity/privacy and upload must be confirmed before copying additional
private configuration there. The earlier19.8MB desktop copy remains unchanged.

The independent read-only host recheck found the same nine dumps/8,436,600,824
bytes, newest write2026-09-05T23:36:48.2878360Z. No dump was created or written
after the native preview started2026-09-06T01:17:32Z. Free space was C:1.60GiB,
D:24.75GiB,E:7.83GiB. No WSL VM/host process was observed. This supports avoiding
the observed WSL path for current work, not a repaired runtime or applied cap.
No deletion was retried after the tool-policy rejection.

### Recommended zero-cost staging target (not deployed)

One OCI Always Free `VM.Standard.A1.Flex` VM is the preferred **development/demo**
target for the current persistent Bun/Elysia, PostgreSQL16 and worker architecture.
Current official limits are2OCPUs/12GiB equivalent (1,500OCPU-hours and9,000GB-hours
monthly), plus200GB combined boot/block storage in the home region—not the old
4OCPU/24GB Free Tier claim. See [OCI resource limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

Use one Linux ARM64 VM, a TLS entrypoint, private PostgreSQL, and the existing
worker model. No database-engine rewrite, managed Oracle database, Kubernetes or
per-department microservices are needed. Current published release images remain
**amd64-only**. Native ARM64 image/launcher compatibility is now proved below;
reviewed ARM64 publication and actual deployment proofs are still required.
No capacity benchmark or sustained reliability result is claimed.
Keep loopback review credential prefill OFF outside the laptop; use separate
staging credentials and synthetic data only. A Linux VM removes the Windows/WSL
layer but does not itself fix the unidentified Bun crash.

Always Free capacity can be unavailable and idle VMs can be reclaimed. There is
no Free Tier SLA/support. Most signups need a card and may place a temporary
verification hold. Stay on the Free Tier account and create only Always Free
resources; no paid upgrade/trial-only resources or spending is authorized by a
request to host for free. See [OCI FAQ](https://www.oracle.com/cloud/free/faq/).
This single-host plan is not an enterprise availability promise or approval to
serve real hotel/financial data. Oracle account sign-in/verification remains a
founder action before any deployment.

Render's sleeping web service/ephemeral filesystem and expiring free PostgreSQL
are a poor fit for this whole persistent stack; serverless and free managed DB
components do not by themselves host Yellow's full worker/runtime architecture.
See [Render Free limitations](https://render.com/docs/free). Google Drive remains
offsite file recovery, not the application/database host. GitHub stores reviewed
source; credentials and database archives stay private and outside Git.

### Native ARM64 compatibility preparation — Question202

The new `free-host-arm64` CI job runs on standard `ubuntu-24.04-arm`, asserts
actual aarch64/Linux ARM64 execution, builds both existing digest-pinned image
targets, checks their architecture and exact source labels, and reuses the
supported launcher for fresh migration, referee11/11, readiness and synthetic
sign-in. It stops its isolated preview on every outcome. The existing five CI
jobs and amd64-only publication policy remain unchanged.

Yellow is a public repository; [GitHub's standard hosted runners are free for
public repositories](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
No large/self-hosted paid runner, emulator, cloud credentials, package publishing,
laptop Docker/WSL or C: runtime installation is introduced. Red0/2 preceded
implementation; new/release/catalogue tests8/8(94), YAML parsing and typecheck
pass. A non-implementer reproduced those results and requested explicit SHA/pin
regressions. After adding them, the combined status/release/readiness/containment
proof passes17/17(185), with types and YAML parsing green. The initial requirement
for actual ARM64 execution is discharged by the repaired job recorded below.
This check does not provision OCI, resolve account/capacity access, prove a long
soak, repair Bun's Windows crash or approve live hotel data on free staging.

The first hosted ARM64 job101423353740 atc1dfaacc3922f922c97166cd5d7356c02ea5346b
failed during frozen Python verification, before image/database startup. The
requirements permitted only psycopg2-binary2.9.12's CPython3.12 Intel wheel hash;
pip correctly rejected the ARM64 wheel. Q202's explicit same-version admission
adds only the [publisher's CPython3.12 manylinux ARM64 hash](https://pypi.org/pypi/psycopg2-binary/2.9.12/json)
`40e7b28b63aaf737cb3a1edc3a9bbc9a9f4ad3dcb7152e8c1130e4050eddcb7d`, independently
matching the actual failed download. The original Intel hash, version pin,
`--require-hashes` and binary-only policy are unchanged. Permanent red2/1 becomes
green8/8(93) across host/release tests, independently rerun. No local dependency
installation, source build or hash bypass. The original run subsequently completed:
all five existing jobs passed, with only ARM64's wheel check failing.

Repaired[CI34010394787](https://github.com/dcpnode-maker/yellow/actions/runs/34010394787)
at exactd88ae59ade95b342121e0a3644f5102adcf9726c has a successful native ARM64
job101425264551. Non-implementer fiscal_integration_map personally dispatched,
observed and inspected it; root independently retrieved the completed job log.
It ran on ubuntu24.04arm image20260831.111.1 with read-only repository authority,
Bun Linux ARM64 1.3.14 and hash-verified CPython3.12 ARM64 psycopg2-binary2.9.12.
Both runtime/database-tools image architecture and exact revision assertions passed;
the supported launcher passed referee11/11, readiness at frontier78 and synthetic
sign-in. Its app/PostgreSQL/Valkey containers and isolated network were stopped and
removed. The separate long database job subsequently passed, completing all six
jobs successfully; root also retrieved its canonical referee11/11 result.
No image was published, OCI resource created or paid service activated. This is a
bounded native compatibility receipt, not deployment, load testing or a crash fix.
