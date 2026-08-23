# ORDER 030 — Model download and per-device benchmark

**Phase:** 0 (out-of-band build infrastructure)  
**Branch:** `phase-0/android-worker-foundation`  
**Written by:** OpenAI Codex (primary lead under D-91)  
**Date:** 2026-08-23 · **Tier:** 2  
**Source:** founder direction · **Decision:** D-94

## Goal

Extend the single Order 029 APK with a model-preparation path that downloads the
strongest approved local coding candidate, verifies every byte, benchmarks it on
the actual phone and falls back conservatively. Do not yet accept remote jobs or
run repository code.

## Approved immutable model catalog

| Priority | Model | Immutable revision | File | Bytes | SHA-256 |
| --- | --- | --- | --- | ---: | --- |
| 1 | `Qwen/Qwen2.5-Coder-14B-Instruct-GGUF` | `d0a692ef765eefbf2fabb130b3cb2e8917e3d225` | `qwen2.5-coder-14b-instruct-q4_k_m.gguf` | 8,988,110,272 | `c1e659736d89ac1065fb495330fb824d94001974a4bfa78e7270e43476a8d940` |
| 2 | `Qwen/Qwen2.5-Coder-7B-Instruct-GGUF` | `13fb94bfda8c8cf22497dc57b78f391a9acb426a` | `qwen2.5-coder-7b-instruct-q6_k.gguf` | 6,254,198,784 | `46291ddea1bfb608fe63d9a1907eea6918bda87a7626593edc4bf97c5fd73f9d` |
| 3 | `Qwen/Qwen2.5-Coder-7B-Instruct-GGUF` | `13fb94bfda8c8cf22497dc57b78f391a9acb426a` | `qwen2.5-coder-7b-instruct-q4_k_m.gguf` | 4,683,073,536 | `509287f78cb4d4cf6b3843734733b914b2c158e43e22a7f4bf5e963800894d3c` |
| 4 | `Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF` | `2ab9f8f42af02fc212effaef7c4850c885e965f4` | `qwen2.5-coder-1.5b-instruct-q8_0.gguf` | 1,894,532,160 | `507de59046601282ba768a9789900e6ccf60ed93ddf346730b7c68eb0715bc47` |

All upstream repositories declare Apache-2.0. The APK may request only the four
literal HTTPS `resolve/<revision>/<file>` resources above; no URL comes from a
job, intent, clipboard, QR code or editable preference.

## Scope — files Codex may change

- `tools/android-worker/**`
- `.github/workflows/android-worker.yml`
- `docs/android-worker/**`
- `DECISIONS.log` (append only)
- `handoff/LEDGER.md` (append only)
- `handoff/orders/030-model-download-and-benchmark.md`

## Required behavior

1. Keep one `com.yellow.worker` arm64 APK for the 10R, 11R and Nord 5.
2. Model preparation is explicit in the UI and begins with the 14B candidate.
3. A download runs only under the existing charging, unmetered, battery,
   storage, idle, screen and thermal gates, with the sticky **Pause now** path.
4. Store weights only below the app-private files directory. Request no media,
   document, all-files, accessibility, root or package-install permission.
5. Download to a `.part` file, resume only from a validated byte offset, enforce
   HTTPS redirects, exact final length and SHA-256, then rename within one
   directory. Preserve a valid partial on cancellation.
6. Reserve at least 8 GiB of free space beyond the candidate's remaining bytes.
   Storage-backed expanded memory does not count as RAM or free model capacity.
7. After verification, initialize the pinned llama.cpp engine, load the candidate
   and run a bounded prompt-processing/text-generation benchmark while the phone
   remains idle, charging and below moderate thermal status.
8. Activate a candidate only after that gate passes. On caught load/benchmark
   failure—or a retry after an interrupted load—advance exactly once through the
   ordered catalog without looping forever on any candidate. A failed candidate
   never becomes active.
9. Persist only model identifier, preparation status, benchmark text and failure
   reason. Do not persist prompts, personal data, Git credentials or repository
   content.
10. Show model/download/benchmark state in the app and foreground notification.

## Falsifying tests

- Changing either pinned revision, byte count or SHA without updating the catalog
  fixture makes `ModelCatalogTest` fail.
- A resumed response with the wrong status or `Content-Range` start is rejected or
  restarted from zero by `ResumePlanTest`; it is never appended blindly.
- A wrong digest or final length cannot produce a ready model in
  `ModelIntegrityTest`.
- `ModelSelectionPolicyTest` proves first attempt = 14B, every interrupted/caught
  attempt advances one position, and no fifth candidate exists.
- Scheduler tests prove all five Android constraints remain present for both model
  preparation and ordinary work; runtime gate tests remain negative-first.
- Manifest/APK tests fail on personal-data permissions or a non-arm64 library.

## Definition of done

- [ ] Order commit precedes implementation commit.
- [ ] Clean CI builds one generic fleet APK and all old/new unit tests pass.
- [ ] APK permission allowlist and arm64/no-x86 inspection pass.
- [ ] Catalog literals match official immutable revisions, exact sizes and SHA-256.
- [ ] Model download is resumable, cancellable, app-private and hash-gated.
- [ ] Every load failure deterministically reaches the next smaller candidate; no
      failed model is marked active.
- [ ] Benchmark activation is visible and remains fail-closed on unknown thermal state.
- [ ] PR remains draft and unmerged pending founder review and real-phone evidence.

## Forbidden

- Bundling model weights in the APK or repository.
- Mutable model references, arbitrary URLs or skipping length/digest verification.
- Counting expanded RAM as physical RAM or promising that 14B will fit every phone.
- Remote coordinator/jobs, repository clone, shell/process execution, code execution,
  patch application, GitHub credentials/writes or silent installation.
- Broad storage/personal-data permissions, root, Shizuku, accessibility or boot start.
- Direct push or merge to `main`; Codex may not merge its own PR.

## Evidence required from the phones

For each device record model chosen, physical RAM reported by Android, load result,
prompt-processing and generation throughput, start/end thermal status and elapsed
time. Until those three records exist, profiles remain provisional and no remote
job may be enabled.

## Founder amendment — explicit 10R test mode (D-95)

The founder requested that the first OnePlus 10R test respond directly to **Run**
and **Pause**, with normal idle parameters temporarily held. This amendment is part
of Order 030 and must be committed before its implementation.

### Additional scope

No new paths are added. The existing `tools/android-worker/**`, documentation and
append-only ledger/decision scope applies.

### Required behavior

1. Add an explicit **Run model test now** owner action. It schedules preparation
   without requiring charging, device idle, screen-off or an unmetered network.
2. Keep a connected network, battery-not-low and storage-not-low as coarse Android
   constraints. Keep the 8 GiB reserve and every download/integrity rule unchanged.
3. At runtime, manual test mode still fails closed on sticky pause, unknown thermal
   state, and `MODERATE` or hotter status. **Pause now** cancels it immediately.
4. Keep the original constrained idle scheduler intact as the non-test path.
5. Show determinate download progress in the activity as well as the existing
   foreground notification. Clearly label the temporary test behavior.

### Additional falsifying tests

- Scheduler tests prove manual test mode requires connected network, healthy battery
  and storage, but does not require charging or device idle; the original scheduler
  must still require all five coarse constraints.
- Runtime-gate tests prove manual test mode permits an interactive, unplugged phone
  while still rejecting manual pause, unknown thermal state and `MODERATE` heat.

### Additional definition of done

- [ ] The planning amendment commit precedes every test-mode implementation commit.
- [ ] Existing constrained-mode tests stay green; the override cannot weaken them.
- [ ] The signed update uses the existing application ID and update certificate so
      it installs over the founder's current APK without deleting partial weights.

### Still forbidden

- Remote or silent activation, removing the visible pause control, disabling thermal
  or storage integrity protection, or representing model preparation as Yellow code
  execution.

## Real-device recovery amendment — lower-memory ladder (D-96)

The first OnePlus 10R run downloaded and hash-verified both original candidates but
the pinned Android engine returned a non-zero result from native model loading for
each. The wrapper maps every such native load failure to
`UnsupportedArchitectureException`, so that class name alone is not evidence of an
unsupported CPU. With only 11.16 GiB total physical RAM reported by Android, memory
pressure remains the leading hypothesis but must not be represented as proven until
the smaller candidates run on-device.

### Additional required behavior

1. Preserve the verified 14B Q4_K_M and 7B Q6_K files across the APK update; do not
   redownload or automatically delete them.
2. Continue the existing marker chain at 7B Q4_K_M, then use 1.5B Q8_0 as a final
   engine/CPU diagnostic and bounded coding fallback. Both additions are official,
   immutable, Apache-2.0 Qwen GGUF resources with exact length and digest pins.
3. A marker from the installed app must skip its corresponding failed candidate, so
   **Run model test now** after updating starts at the first unattempted model.
4. Replace the misleading raw exception name in owner-visible state with a generic
   native-load failure message that records model-weight size and Android available
   RAM immediately before load. Do not diagnose memory or CPU architecture as fact.
5. Record both total physical and available RAM in successful benchmark evidence.
6. Keep all D-94/D-95 integrity, reserve, pause, thermal, permission and no-code-
   execution boundaries unchanged.

### Additional falsifying tests

- Catalog fixtures pin all four exact identities, revisions, byte counts and hashes.
- Selection-policy tests prove a persisted marker can walk 14B→7B Q6→7B Q4→1.5B
  without looping, and that interruption of the fourth candidate stops fail-closed.
- Existing downloader, integrity, scheduler, pause and gate tests remain green.

## Founder amendment — reclaim failed-model storage (D-97)

The founder directed Yellow Worker to delete model weights that the individual phone
cannot use. This supersedes only D-96's failed-weight retention requirement; catalog,
attempt-marker and all safety boundaries remain unchanged.

### Additional required behavior

1. Once a candidate has a persisted attempt marker, delete that candidate's exact
   final GGUF and `.part` path from the app-private model directory before advancing.
   Keep the marker so an update or restart cannot redownload the failed candidate.
2. Delete only paths derived from immutable `ModelCatalog` filenames. Never enumerate
   or delete unrelated files, active-model weights, unattempted candidates or marker
   files.
3. After a caught load/benchmark failure, release the native engine before reclaiming
   the failed weight. Download failures before an attempt marker retain their valid
   `.part` file for resumability.
4. Existing 14B and 7B Q6 markers on the 10R must trigger cleanup on the first v0.5
   model run, reclaiming 15,242,309,056 bytes when both verified files are present.
5. A candidate that passes activation keeps its GGUF and has its attempt marker
   removed exactly as before.

### Additional falsifying tests

- Cleanup tests prove only the selected candidate's final/partial files are removed,
  unrelated files and the marker survive, and the reclaimed-byte count is exact.
- Selection, integrity and download-resume tests remain green; cleanup must not turn a
  pre-load network failure into a permanent skip.
