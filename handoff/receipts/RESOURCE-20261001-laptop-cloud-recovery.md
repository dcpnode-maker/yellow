# RESOURCE-20261001 — Verified laptop source recovery and Cloudflare handoff

Root personally executed capture, verification, isolated restoration and a second current-source verification after restoration. Implementation and read-only review used separate agents. No checkout integration or production database mutation was performed.

Latest reviewed-source checkpoint: source-20261001T111103367644Z-0539999111 under the
same fixed recovery root,3005 files/46,069,296 bytes. Root actual current-source
verification, standalone restore-hk-20261001T111103Z-0539999111 and post-restore
original source/index/refs verification all passed. Manifest SHA
fec147b7ef0a1813541b85aaa39f99ca96607e056c8b63382c3a5e100c94b757. All seven final
housekeeping source hashes match both original and restored files. The fixture has
its own .git and no object alternates. Root also verified/fetched the separately
retained9ff cloud complete-history bundle into only this restore fixture and confirmed
HEAD+a00+f610+9ff commit objects. Root-source-hk-restore-proof.json under the task
recovery artifact has SHA56b3699ac80f2e1dc6b8ed923fa37e9f250da7bce7be5363a5c84be76b743597.
The checkpoint predates this receipt/status addition; later evidence is not asserted
contained in its immutable source archive. The newer cloud9ff27ad8 has all six CI
checks successful; the failedf610 comparison below is retained historical evidence.
Safe source integration, app public route and durable business-data recovery remain
unproved. No working-tree merge/index change or business database copy occurred.

## Verified source recovery

- Authoritative receiving source: E:/YellowWorkspace/Worktrees/git-live-order611-source-v2, HEAD e06e400a57485cc10a8a35c21dcb1e01b5a667d1.
- Published source pins retained locally and in the recovery bundle: a00ca3f941d601df6a436db53612d58b2f4f4729 and f610a9264840cbbf8d4ea05b29852889e0115e6f. The newer pin was fetched into refs/yellow/recovery/cloud-release-20261001-f610a926 without checkout, merge, reset or index changes.
- Checkpoint: E:/YellowWorkspace/Data/Recovery/RESOURCE-20261001/source-20261001T072604800015Z-e15ca56f78.
- Manifest SHA256: 74e88f29480c5fb10272617746fed7c28bb8780d13e26e3126dfbbe87dbb5dc8.
- Source: 2,965 files / 45,779,008 bytes. All nine recorded artifacts and every captured source hash passed.
- Working archive: 17,075,451 bytes, SHA256 304bda1eec1d271bb319169a681ab7e315970b298dd21c5dbb141f8973be15a2.
- Git bundle: 12,441,749 bytes, SHA256 21f07b71133a5e62ca07455ab196323d3d5bc15574fa45bc9003fd6e55106903.
- Isolated restoration: E:/YellowWorkspace/Data/Recovery/RESOURCE-20261001/restore-20261001-proof-v2. Actual restore exited0, verified source bytes/hashes, restored HEAD and exact staged/unstaged/full working patches.
- Root separately confirmed the restored checkout has its own .git directory, no object alternates, and all three exact required commit objects. The original receiving HEAD, refs, status bytes and index hash still matched the capture after restoration.
- Original index SHA256: fa354ea19d5659740c4189232b42e91ed830b98425501a5cfab2d12dca3a7d86; original NUL status SHA256: 213c9c9fdd19669382140eb6a56bd02abf7164c33ca92025610d0166813b3f97.
- Root proof: E:/YellowWorkspace/Data/BuildArtifacts/yellow-laptop-20261001-recovery-v1/root-source-restore-proof.json, SHA256 83ab487f1416d50766f36452e89533017336946d0524490ac8768010a723e7df.
- Reviewed helper SHA256: 9cadf20e4c9b171b31f7fd7cd5991b18092e4382d58d5b79d007f3e5d23208bc.

This checkpoint captures source at its recorded instant, including the actual phone-build receipt. This subsequent recovery receipt and status update are newer evidence, not asserted contained in that immutable archive.

## Retained failures

The initial installed-Git diff call rejected pathspec-from-file; the implementation was corrected to bounded literal pathspec batches. An early checkpoint stopped before copying source because Windows PowerShell5.1 could not load the ACL cmdlet module; restrictive ACL readback now uses the direct .NET API and fails on errors. Failed directories remain retained.

The first restore matched archived file hashes but failed textual patch equality because the source Git repository printed eight-character object abbreviations while the new clone printed seven. The same captured patches matched byte-for-byte with explicit abbreviation8, establishing the cause. The reviewed helper now uses explicit --full-index for capture and restore, pins that format in the manifest and refuses old-format restores. Root then made the fresh checkpoint above and proved an actual isolated restoration; no normalization hides differences. The earlier checkpoint and failed restore were not deleted or replaced.

## Actual Cloudflare handoff and release state

Root verified Wrangler identity and sent the existing cloud chat (01a0f33b-8f4c-73f0-b8b9-d07e866e2052, Clarify sandbox environment) the authorized Cloudflare information:

- Account ID: 1676cc6f7dc7847cfd92a6a07aa70dcd, account dcpnode@gmail.com.
- Workers subdomain: yellow-dcpnode-1676cc6f.workers.dev.
- Existing phone coordinator: https://yellow-phone-coordinator.yellow-dcpnode-1676cc6f.workers.dev.
- Verified deployment/configuration location, current OAuth scope limits and the fact that the encrypted Windows OAuth file is not a portable cloud credential. No credential was sent.

This is the phone coordinator. No separate permanent Yellow app hostname, tunnel ID/ingress/Access configuration or secure cloud connector binding has been verified. The proposed yellow-live hostname is not presented as deployed.

Root read f610 CI run36827406928: quality, windows-state, local-review, container-smoke and free-host-arm64 succeed; database fails at schema export comparison, expected PostgreSQL16.15 dump header versus actual18.6. The exact failed log is retained locally and was sent to the cloud worker, which owns a bounded reviewed repair. This supersedes the earlier in-progress read; no release promotion follows from the five successful checks.

## Scope of recovery

This proves source recovery only. Runtime credentials, environment/configuration, databases/dumps, dependencies/caches and generated outputs are excluded. Business-data backup/restore, durable cloud hosting, permanent public routing and deliberate fenced application failover still need separate proof. No production dataset was copied, reset, reseeded or given a second writer. Laptop remains source/controller; cloud owns release/hosting; phone provides bounded Android validation. CompSet Studio remains separate research.
