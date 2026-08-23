# ORDER 029 — Unified OnePlus fleet APK

**Phase:** 0 (out-of-band build infrastructure)
**Branch:** `phase-0/android-worker-foundation`
**Written by:** OpenAI Codex (primary lead under D-91)
**Date:** 2026-08-23 · **Tier:** 1
**Source:** founder direction · **Decision:** D-93

## Goal

Make the already-green Order 028 foundation one installable Yellow Worker APK for
the verified OnePlus 10R, OnePlus 11R and OnePlus Nord 5. Keep one application ID,
one arm64 build and one update path while preserving per-device benchmark limits.

## Scope — files Codex may change

- `.github/workflows/android-worker.yml` (artifact labels only)
- `tools/android-worker/**` (fleet-facing labels/docs/tests only)
- `docs/android-worker/**`
- `DECISIONS.log` (append only)
- `handoff/LEDGER.md` (append only)
- `handoff/orders/029-unified-oneplus-fleet-apk.md`

## Required behavior

1. Package remains `com.yellow.worker`, minSdk 33, target SDK 36 and arm64-v8a only.
2. One APK and one CI artifact name cover all three verified phones.
3. UI and operator docs name the 10R, 11R and Nord 5 without implying identical
   inference limits.
4. No device product flavor, model bundle or model choice is introduced.
5. Future model/thread/context profiles are runtime configuration backed by separate
   measurement on each hardware class.

## Definition of done

- [ ] Clean CI produces exactly one generic OnePlus fleet artifact.
- [ ] APK still contains arm64-v8a native code and no x86_64 library.
- [ ] Existing safety, privacy, native and Yellow CI checks remain green.
- [ ] User-facing labels no longer call the binary 10R-only.
- [ ] No production Yellow runtime/schema/test file changes.

## Forbidden

- New application IDs, build flavors, APK splits or device-specific permissions.
- Assuming expanded RAM is physical RAM or assigning a model without measurement.
- Model weights/downloads, inference, coordinator, credentials, jobs or Git output.
- Direct push or merge to `main`; Codex may not merge its own PR.

## Follow-on gates

Order 030 owns the resumable hash-verified model download and per-device 14B→7B
benchmark ladder. Order 031 owns signed jobs, ephemeral context and draft-PR output.
