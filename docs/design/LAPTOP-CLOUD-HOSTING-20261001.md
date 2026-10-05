# Laptop source, cloud runtime and recovery — 1 October 2026

The founder directs the laptop to remain Yellow's authoritative source and main controller. Cloud runs the deployed release so a laptop restart need not interrupt that runtime. Laptop, phone and tablet use the same deployed HTTPS application and the same authoritative business dataset. Cloud is not the only home of code or data.

## Current verified state

- Receiving checkout: E:/YellowWorkspace/Worktrees/git-live-order611-source-v2, branch codex/live-order611-source-v2, HEAD e06e400a57485cc10a8a35c21dcb1e01b5a667d1, with existing tracked and untracked work preserved.
- Published cloud release successor: PR98, phase-7/release-local-gates-20261001. Its exact a00ca3f941d601df6a436db53612d58b2f4f4729 history has been fetched into the laptop's common Git repository. This does not merge the two working sources.
- Cloud a00 release checks: quality, windows-state, local-review, container-smoke and free-host-arm64 pass. Database check fails at Order453's expected frontier99 versus isolated target100; cloud owns repair. No live promotion is established.
- Laptop has a compiled static preview at http://127.0.0.1:5174/yellow-next/. This is not verified production API/data hosting.
- The paired OnePlus10R actually completed Android/arm64 Node24.18.0 source-bound table-query validation with four parallel workers. It is an independent bounded validation worker, not a second production database.
- Managed cloud runtime's lifetime, durable business-data storage, public app endpoint and recovery remain unverified. A permanent app tunnel is not established by the coordinator endpoint below.

## Cloudflare handoff

Wrangler4.145.0 whoami succeeded on the laptop on 1 October:
account dcpnode@gmail.com, ID 1676cc6f7dc7847cfd92a6a07aa70dcd.

The existing deployed phone coordinator is:
https://yellow-phone-coordinator.yellow-dcpnode-1676cc6f.workers.dev

Its account Workers subdomain is yellow-dcpnode-1676cc6f.workers.dev; configuration is E:/YellowWorkspace/PhoneWorker/cloud/wrangler.jsonc. It owns phone dispatch and its Durable Object. App routing must have a separate worker/hostname. yellow-live and https://yellow-live.yellow-dcpnode-1676cc6f.workers.dev are only proposed names, not deployed endpoints.

No custom domain, named app tunnel ID/config or running laptop cloudflared process was found in the inspected state. Current laptop OAuth grants user/account read, Workers/script write and offline access; connectivity administration, Pages/D1/KV/routes permissions are absent. Do not infer permissions from the founder's general authorization. OAuth is encrypted under Windows Credential Manager and is not a portable Linux credential. Laptop performs operations supported by its actual grant; do not post credentials to a chat or copy its encrypted credential file into cloud as authentication.

## Release and recovery contract

1. Laptop receives every reviewed cloud commit and any remaining source changes before cloud is treated as disposable. GitHub is an additional source copy; uncommitted source needs an explicit captured byte manifest.
2. Releases identify exact commit, working-input hashes where applicable, dependency lockfiles, compiled artifact digest, migration frontier and runtime configuration recipe. Receiving and release branches are reconciled through independent review, without overwriting the dirty receiving checkout.
3. A local source checkpoint preserves Git history plus current working source and deletions, excludes credentials/runtime databases/caches, and is verified by an isolated source restore. Source recovery does not prove database recovery.
4. One PostgreSQL dataset remains authoritative. A cloud host must provide persistent storage outside its disposable workspace, or an independently hosted durable database. Do not create two active writers by periodically copying databases.
5. Business-data recovery requires a consistent logical backup with roles/extensions/configuration/assets coverage, checksums, retention and an independently executed restore drill. Define recovery cadence and acceptable data loss from measured needs; do not promise zero loss or automatic failover.
6. Recovery to laptop is a deliberate restore of the same reviewed release/configuration/data, with cloud writes fenced before local writes begin. A source preview can remain available locally independently; production failover needs the separate data proof.
7. A stable hostname keeps clients' address stable. It does not keep an ephemeral cloud process alive. Public routing, restart supervision, host lifetime and persistent storage are separate evidence.
8. No existing live data directory is copied, reset, reseeded or migrated by the source recovery order. Credentials stay in approved secret storage, outside portable source archives.

The cloud worker owns release checks and verifies its actual hosting environment. Laptop owns integration, final evidence and source recovery. Phone provides disjoint Android validation. No device is assigned duplicate development work or an independent production database.
