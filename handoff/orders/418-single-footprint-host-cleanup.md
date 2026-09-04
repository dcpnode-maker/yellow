# Order 418 — Single-footprint host cleanup

**Status:** GUARDED EXECUTION PARTIAL — DOCKER APPROVED/CLEAN, FILESYSTEM PENDING
**Phase:** Cross-phase build hygiene
**Risk tier:** 3 — destructive host artifact handling
**Owner:** Codex inventory/coordination; fresh independent non-operating Tier-3 reviewer required before deletion or global Docker compaction

The first founder filesystem execution stopped safely during preflight because its
elevated PowerShell did not inherit Git on `PATH`. D1249 independently approves the
narrow repair: pin the existing Codex-runtime Git 2.53.0 executable, fail closed if
it is absent, and retain the byte-identical target block and every registered-
worktree guard. That failed run deleted none of the 49 approved targets.

## Objective

Recover space from obsolete Yellow proof, review, database-cluster, diagnostic and Docker artifacts across C:, D: and E: while preserving one authoritative repository, its one active worktree, all committed history/evidence, required build toolchains, and intentionally retained local AI models.

## Preserve exactly

- canonical repository `C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow`;
- registered active worktree `C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order175-folio-responsive-containment` and its untracked `.yellow` runtime-authority configuration;
- canonical Git objects, committed orders/reviews/decisions/ledger and source research;
- `E:\yellow\ollama` application and models;
- required pinned PostgreSQL/Bun/Valkey image/toolchain inputs needed for fast repeatable builds;
- founder files and every non-Yellow path.

## Candidate classes

- unregistered stopped PostgreSQL proof clusters named by completed orders under `D:\Yellow` and `E:\yellow`;
- unregistered temporary/review/proof source copies whose meaningful content is already committed or recorded;
- expired Yellow diagnostics, temp offload and build archives;
- unused Yellow Docker images and build cache, retaining the intended stack and required pinned base images;
- only after exact Docker collateral inventory and independent approval, compact unused blocks in `E:\yellow\docker-data\wsl\disk\docker_data.vhdx` without deleting the active Docker substrate.

## Required proof before deletion

1. Resolve every exact target beneath an explicitly named Yellow root; reject links/reparse points and path escapes.
2. Prove no target is a registered worktree, active process dependency, mounted Docker path, unique uncommitted source, credential authority, or sole evidence not represented in committed governance.
3. Record exact path, size, class and preservation rationale; independently review the manifest.
4. Inventory Docker containers/images/cache and retain the exact intended components plus pinned build bases.
5. Estimate recoverable logical and physical space. VHD compaction must stop Docker/WSL cleanly and requires its own reviewer-approved execution sequence.

## Required proof after deletion

- preserved repository/worktree Git status and object reachability are unchanged;
- Ollama application/models and required toolchains remain byte-present;
- no second Yellow repository or database authority is introduced;
- Docker starts with the retained topology when deliberately requested;
- all three drive free-space results and exact removed targets are recorded.

## Forbidden

No source/history/order/review/research deletion; no Ollama model deletion; no founder-file cleanup; no broad drive-root or wildcard deletion; no live Docker-VHD file deletion; no production/external mutation; no merge, push or deployment.

## Approved manifest and execution progress

- Fresh independent Tier-3 review approved 49 exact filesystem targets totaling 7,478,069,564 bytes and excluded the canonical repository, registered active worktree, auth configuration, Ollama, toolchains and Docker substrate.
- The exact host execution is recorded in `handoff/order418-approved-cleanup.ps1`; it validates preserved/registered paths and unlinks the two inspected external junction leaves before deleting only listed targets. It has not been executed because host recursive deletion is blocked in this environment.
- Docker's approved 146-image removal manifest hash was `2C00AE22D55988E48A80E6CEF69EC65C7DB5A236FD3FD31899325CA49DD97D39`. Execution reduced 152 images to the exact six approved keep IDs; zero non-keep images remain.
- Fresh independent post-execution review confirms the three intended stopped containers remain image-backed, mount-free and volume-free; only default networks plus empty intended `yellow_order311_local` remain. Build cache is retained at 215.7 MB because it currently reports zero reclaimable bytes.
- Review-side Ollama inspection auto-started two preserved processes; the operator stopped only those exact Ollama-path processes afterward. The 6.6 GB `qwen3.5:9b` model remains present.
- VHD compaction remains pending until filesystem cleanup and the approved full Docker/WSL shutdown sequence.
