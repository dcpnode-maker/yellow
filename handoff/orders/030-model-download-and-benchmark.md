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

Both upstream repositories declare Apache-2.0. The APK may request only the two
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
8. Activate 14B only after that gate passes. On caught load/benchmark failure—or
   a retry after an interrupted 14B load—schedule the 7B fallback without looping
   forever on 14B. A failed candidate never becomes active.
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
- `ModelSelectionPolicyTest` proves first attempt = 14B, interrupted/caught 14B
  retry = 7B, and no third candidate exists.
- Scheduler tests prove all five Android constraints remain present for both model
  preparation and ordinary work; runtime gate tests remain negative-first.
- Manifest/APK tests fail on personal-data permissions or a non-arm64 library.

## Definition of done

- [ ] Order commit precedes implementation commit.
- [ ] Clean CI builds one generic fleet APK and all old/new unit tests pass.
- [ ] APK permission allowlist and arm64/no-x86 inspection pass.
- [ ] Catalog literals match official immutable revisions, exact sizes and SHA-256.
- [ ] Model download is resumable, cancellable, app-private and hash-gated.
- [ ] 14B failure deterministically reaches 7B; no failed model is marked active.
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
