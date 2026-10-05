# RESOURCE-20261001 — Android Node build-validation receipt

Status: both targeted Node phone jobs completed successfully. Root independently inspected the exact job inputs and verified the Android and Windows outputs. The independent receiving-source reconciliation reviewer found no blocking discrepancy in the final request. No Yellow source or existing test file was changed by this lane.

## Inputs and provenance

- Receiving checkout HEAD: `e06e400a57485cc10a8a35c21dcb1e01b5a667d1`.
- Source `frontend/yellow/src/table-query.ts` was untracked at that HEAD; SHA-256 `bb719b3bacd25b661d6f987c1a82b8090448d2f9a53a9aefbee999fdbe7efefe`.
- Contract test `tests/order674-table-query.test.ts` was untracked at that HEAD; SHA-256 `b9dd5f42ac709322b27843486faf563babf823bcb587f84f21b1440350d9256d`.
- Standalone Node ESM bundles were built with Bun targeting Node, with no external package dependencies. Main bundle SHA-256: `0a802be74b14f719db72da1ad78dea1e0367b38ca39bf4ee77d57932b8e49004`; worker bundle SHA-256: `b9fbb77849a6ec9d5f2825e86687bd1fb4e5cec61223b58b2adf770fce800ea4`.
- Immutable stage job JSON SHA-256: `805bd834a7d93af1be894847470828922e4d6370d551cf8127a1da8c7b090847` (`resource-20261001-oneplus10r-node-harness-stage`). Immutable benchmark job JSON SHA-256: `5690ada330f00b2fcc966d959a6b4ed5322264148b4133ed32f0d90223ad13aa` (`resource-20261001-oneplus10r-node-table-benchmark`). Both values were verified against their `.sha256` sidecars in `E:/YellowWorkspace/PhoneWorker/receipts/`.

## Device runtime and bundle execution

The reviewed Termux package-manager job `resource-20261001-oneplus10r-node-lts-install` installed `nodejs-lts` and npm from the configured repository. The command completed with exit code 0 in 33.268 seconds; the installed versions reported by the actual package output were Node 24.18.0 and npm 11.20.0. No broad package upgrade was performed.

The actual phone result reports Node `v24.18.0`, Android, `arm64`; the device is the OnePlus 10R CPH2423 on Android 15. Node's `os.cpus()` reported 0 on this Android build. That API result is not a hardware CPU count: the earlier phone Python preflight observed eight logical CPUs and eight CPUs in affinity. This harness result did not report physical memory; it recorded process RSS and CPU time below.

The same bundles also passed root's Windows Node 24.19.0 x64 execution. Both environments reported the same source and bundle hashes, all semantic checks passed, and the full ordered result checksum matched: `f1eed5c2a153a660a1ca7033aaa4e687303fbc8ac22c2ed20625ed0bf1183778`.

## Semantic and performance result

Nine semantic checks passed for the existing table-query helper: six AND filters; four-level stable sorting; natural numeric sort; exact bigint comparison; sort priority and reorder; clear preserving other rules; invalid rules failing closed; blank values last in both sort directions; and input immutability with original row references preserved.

The bounded diagnostic used 10,000 synthetic reservation rows and an independent ordered oracle applying the explicit filter predicate, numeric arrival ascending, bigint amount descending, then original index for stable ties. The sequential baseline's complete ordered ID list matched that oracle. Four workers each ran three queries; all 12 worker samples returned the expected 6,818 rows and exact oracle digest. This is an in-memory UI helper measurement, not server-side authorization, database, RBAC, or whole-property scale acceptance.

On Android, total harness time was 564.698 ms. Across 12 parallel query samples, p50 was 36.832 ms and p95 was 71.874 ms (min 16.878 ms, max 71.874 ms). These small-sample percentiles are exploratory diagnostics, not an SLA. Process CPU time was 1,845,517 microseconds user and 130,466 microseconds system. Process RSS increased from 54,374,400 bytes to an actual 165,675,008 bytes (111,300,608 byte delta). Each worker had JavaScript isolate limits of 64 MiB old generation, 16 MiB young generation, and a 4 MiB stack; those limits do not hard-cap native RSS, which was measured.

The Android result is saved at `E:/YellowWorkspace/Data/BuildArtifacts/yellow-phone-node-20261001-v1/android-node-proof.json`; the Windows result is `root-windows-node-proof.json`. Bundles, source-derived harness, and bundle manifest are in the same named artifact directory.

## Acceptance boundaries

This lane proves the existing local table helper's semantics and one bounded Android Node performance run. It does not prove signed APK build or installation, Android SDK availability, iOS build, on-device product UI/browser acceptance, Termux reboot/boot, Doze, or travel recovery. The benchmark does not establish backend or whole-property scale behavior.
