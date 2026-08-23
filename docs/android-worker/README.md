# Android idle worker — safety foundation

Status: **foundation only; no model or remote jobs are enabled**.

The OnePlus fleet worker is one native Kotlin APK for the verified OnePlus 10R,
OnePlus 11R and OnePlus Nord 5, backed by the official `llama.cpp` Android library.
It exists to prove that Yellow can package a local engine without granting access to
personal data or allowing arbitrary code execution.

## What this APK does

- starts in a durable manual-pause state;
- lets the owner arm, pause, or resume work;
- schedules one unique job only while charging, on unmetered Wi-Fi, with battery and
  storage healthy, and with Android reporting the device idle;
- rechecks screen use, charging, and thermal state before native work;
- blocks at thermal status `MODERATE` or above and fails closed when status is unknown;
- shows a foreground notification with an immediate **Pause now** action;
- initializes the pinned native engine and then reports **Waiting for model**.

## What it cannot do

It cannot read media, storage, contacts, messages, calls, microphone, camera, location,
notifications, app usage, or accessibility data. It does not start at boot. It has no
coordinator URL, GitHub token, shell, repository checkout, remote prompt, model
download, or inference path.

The APK uses app-private storage with backup disabled. Future model weights will live
under the app's private `files/models/` directory; expanded RAM is not treated as real
memory capacity. One package does not mean one performance profile: model, threads and
context remain benchmark-gated per hardware class, with the physical 12 GB 10R as the
conservative baseline.

## Owner controls

Android requires one explicit APK-install approval. The first arm/resume also requests
notification permission; work remains paused if that permission is denied so the
visible pause control cannot disappear. **Pause now** is sticky and cancels the unique
WorkManager job. The worker never silently installs, roots, or enrolls the phone.

## Next gates

Order 029 adds only a hash-verified, resumable app-private model download and measures
the 14B-to-7B fallback ladder. Order 030 separately defines signed jobs, ephemeral
context, and draft-PR output. Neither trust boundary is present in this foundation.
