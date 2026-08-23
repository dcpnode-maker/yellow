# ORDER 028 — Android worker safety shell and native llama.cpp foundation

**Phase:** 0 (out-of-band build infrastructure)  
**Branch:** `phase-0/android-worker-foundation`  
**Written by:** OpenAI Codex (primary lead under D-91)  
**Date:** 2026-08-23 · **Tier:** 2  
**Source:** `handoff/questions/011-android-idle-local-llm-workers.md` · **Decision:** D-92

## Goal

Produce the first installable OnePlus 10R worker APK: a native Kotlin application
that embeds a pinned official `llama.cpp` Android engine, runs only behind conservative
charging/network/idle/thermal/manual-pause gates, exposes immediate pause/resume, and
requests no access to personal data.

This foundation proves lifecycle, native build, safety gates, and packaging. It does
not yet accept remote jobs, GitHub credentials, or download the 9 GB model. Those are
separate security/integrity orders after this APK is green.

## Architecture fixed by this order

- Pilot lives under `tools/android-worker/` so the job contract and Yellow governance
  version together; it is isolated from `src/` and the hospitality runtime.
- Official `ggml-org/llama.cpp` is a git submodule pinned to commit
  `6657ded4faa3b8450221119fc6b4d002e35104a2` (release `b10590`, MIT).
- Reuse the pinned upstream `examples/llama.android/lib` module rather than copying or
  forking native inference code.
- Android configuration: minSdk 33, compile/target SDK 36, JDK 17, AGP 8.13.2,
  Kotlin 2.3.21, WorkManager 2.11.2, DataStore 1.2.1, arm64-v8a APK.
- CPU/KleidiAI path first. No speculative GPU/NPU or vendor SDK integration on the
  Dimensity 8100-MAX until CPU behavior is measured.
- Model weights and job source are never bundled in the APK. Future weights live only
  in app-private storage and future jobs use signed, size-capped temporary context.

## Scope — files Codex may change

- `.gitmodules`
- `.github/workflows/android-worker.yml`
- `vendor/llama.cpp` (gitlink only, exact pinned commit above)
- `tools/android-worker/**`
- `docs/android-worker/**`
- `DECISIONS.log` (append only)
- `handoff/LEDGER.md` (append only)
- `handoff/questions/011-android-idle-local-llm-workers.md` (resolution marker only)
- `handoff/orders/028-android-worker-foundation.md`

## Required behavior

1. **User control:** an activity shows current state and provides `Arm when idle`,
   `Pause now`, and `Resume when idle`. Manual pause is sticky in DataStore.
2. **Coarse scheduling:** unique WorkManager work requires charging, unmetered network,
   battery-not-low, storage-not-low, and device idle.
3. **Runtime fail-closed gate:** before native/model work, block while manually paused,
   interactive, not charging, or thermal status is moderate or worse.
4. **Visible work:** long work uses a foreground notification with an immediate pause
   action. The receiver is non-exported.
5. **Cancellation:** WorkManager cancellation and manual pause stop the coroutine and
   release any loaded model in `finally`. No background retry loop may ignore pause.
6. **Native readiness:** instantiate the upstream llama.cpp Android inference engine
   only after all gates pass. With no model installed, report `Waiting for model`
   without treating absence as a crash.
7. **Privacy:** manifest contains only the minimum network, foreground-service, and
   notification permissions. It must contain no storage/media, contacts, SMS, call
   log, phone-state, microphone, camera, location, accessibility, notification-listener,
   usage-stats, package-query, overlay, device-admin, or boot permissions.
8. **No autonomous trust yet:** no coordinator endpoint, credential, GitHub token,
   remote command, arbitrary prompt, shell command, or repository checkout.
9. **CI artifact:** a dedicated SHA-pinned GitHub workflow checks out the submodule,
   installs exact Android build packages, runs unit tests, assembles the debug APK, and
   uploads the APK artifact. It does not receive secrets.

## Falsifying evidence required

- Unit tests must prove each unsafe snapshot maps to a blocked gate: manual pause,
  interactive device, disconnected power, and moderate/severe thermal state.
- A manifest test must fail if any forbidden personal-data permission appears.
- A scheduler test must assert all five WorkManager constraints and unique-work policy.
- CI must build the native arm64 APK from a clean checkout with the pinned submodule.

## Definition of done

- [ ] `:app:testDebugUnitTest` passes.
- [ ] `:app:assembleDebug` produces an arm64 APK with the native llama.cpp library.
- [ ] Manifest permission allowlist test passes and no forbidden permission exists.
- [ ] Manual pause is durable and cancels unique work.
- [ ] Runtime gates are pure/tested and fail closed.
- [ ] Notification exposes pause; receiver is non-exported.
- [ ] Missing model produces `Waiting for model`, not inference or a retry storm.
- [ ] Existing Yellow application/schema/test files are unchanged.
- [ ] PR records exact dependency pins, test output, APK artifact, and residual risks.

## Forbidden

- `src/`, `migrations/`, `tests/run_invariants.py`, Yellow database/API contracts,
  product workflows, or existing CI jobs.
- Model weights, test models, personal files, screenshots, credentials, endpoints,
  signing keys, or tokens in git.
- Accessibility service, notification listener, usage access, broad storage access,
  root, Shizuku, device-owner enrollment, silent installation, or permission bypass.
- Remote job execution, shell execution, direct GitHub writes, repository clone, or
  arbitrary network payload execution in this order.
- GPU/NPU/vendor backend work, background boot start, or auto-resume after manual pause.
- Direct push or merge to `main`; Codex may not merge its own PR.

## Follow-on gates

Order 029: resumable, hash-verified app-private model download and 14B→7B benchmark
ladder. Order 030: signed job manifest, coordinator desired state, ephemeral context,
and branch/draft-PR output. Neither starts until this native safety APK is green.
