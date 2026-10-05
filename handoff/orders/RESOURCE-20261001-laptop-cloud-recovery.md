# RESOURCE-20261001 — Laptop source and cloud hosting recovery

Author: Codex primary architect/laptop controller. Founder explicitly directs laptop as main source and controller, cloud as deployed runtime, the same app available from laptop, and no loss of code or business data if cloud disappears.

## Scope

- This order; docs/design/LAPTOP-CLOUD-HOSTING-20261001.md; handoff/receipts/RESOURCE-20261001-laptop-cloud-recovery.md; current section of docs/PROJECT-STATUS.md.
- New scripts/snapshot-laptop-source-recovery.py, implementing a narrowly scoped source-only recovery checkpoint for the authoritative receiving checkout E:/YellowWorkspace/Worktrees/git-live-order611-source-v2.
- Named immutable checkpoints and a disposable source-restore drill under E:/YellowWorkspace/Data/Recovery/RESOURCE-20261001/. No deletion, no replacement of existing directories, no alteration to original Git index/worktrees or product files.
- Published cloud PR98 ref may be fetched into the existing local Git repository. Capture the exact fetched ref and local HEAD; do not merge, switch, reset or publish the dirty receiving checkout.
- Exact admitted published checkpoints for this drill: a00ca3f941d601df6a436db53612d58b2f4f4729 at refs/remotes/origin/phase-7/release-local-gates-20261001 and f610a9264840cbbf8d4ea05b29852889e0115e6f at refs/yellow/recovery/cloud-release-20261001-f610a926. Include and verify both in the bounded bundle alongside local HEAD; no unrelated all-ref archive. The newer published cloud source was fetched without changing the receiving checkout.
- Preserve tracked working bytes, nonignored untracked source, binary working patch and status/identity manifest. Exclude runtime secrets, credentials, database files/dumps, caches, toolchains and dependencies. Inventory excluded categories and explicitly distinguish source recovery from configuration and business-data recovery.
- A source bundle and working-source archive must be independently hash-verified and restored into a new isolated directory before claiming source recovery. Refuse path escape, reparse/symlink inputs, overwrite, unexpected roots and changed input/status during capture. Use restrictive Windows checkpoint ACLs.

## Hosting contract

Cloud worker verifies its own managed environment, public endpoint, lifetime, persistent storage and recovery support. Cloud runs a reviewed release; laptop source/controller is authoritative, with release inputs retained locally and in GitHub. The same deployed HTTPS URL is used from all client devices. A laptop fallback starts only by deliberate source/config/data recovery; do not enable competing production writers.

Business data remains one authoritative PostgreSQL dataset. Do not copy a running data directory, reset/reseed/migrate live data, invent backup cadence/RPO/RTO, or claim lossless failover. A consistent logical backup, roles/configuration/assets coverage, checksums and independently executed restore drill are separate required evidence. No database access or mutation is admitted by this source-only order.

Current Cloudflare phone coordinator is separate from app routing. Do not disclose credentials in messages, silently broaden OAuth permissions, use an unverified app hostname or describe an ephemeral sandbox/tunnel as permanent hosting.

## Proof

Root reviews implementation and personally executes source capture, bundle/archive verification and isolated restoration. Record exact source/ref identities, archive digest, captured/excluded scope and original index/status preservation. No whole-product, live-hosting or data-recovery completion claim follows from a successful source checkpoint.
