# HARNESS-011 — Worker 1 real generation and T3 manual transfer

28 September 2026. Implementer evidence, not independent release acceptance.

Worker 1's private Ankit G37 notebook completed one new fixed synthetic task.
The pinned Qwen3.8-27B GGUF was reused; no substitute or paid worker was called.
Generated text was not executed or applied. Worker 2 was not changed.

## Binding and artifact

- Existing company: `507332e8-54e2-4e2c-9f9d-e72ee972896f`.
- Existing YELA-3 task: `7cc2b476-6988-42bf-bb78-beb6cbab757e`, unassigned backlog.
- Source base: `d4b4ea0d146b9207900874bacb4c364f03281422` plus disclosed local UI edits.
- Handoff: `c3e73e11-faa2-44b6-b1e4-34ddb4061714`.
- Task digest: `610ba0155802af0a527a39ddd462a12f9266d99c58b2d5c5c387b9f925294a00`.
- Output digest: `399d9d06f0fcd5627e7d727d56b76443b7259d63e1921403ef4419208c4926bb`.
- Completion: `1790610109937`; proposal exit 0, 158.4 prompt t/s, 13.7 generation t/s.
- Task and compressed exact result: `D:/Yellow/harness/state-workspace/artifacts/worker1-t3-manual-task.json`
  and `worker1-t3-manual-result-wire.json`. Decoded canonical result is 6367 UTF-8 bytes.

The executed package was created using T3's pure package contract and a current
read-only YELA-3 snapshot, not a coordinator dispatch. An earlier desktop export
had a different handoff (`66b73f53-c2c0-4030-a31a-518ef2211420`) and an unsuccessful
Save dialog. It was not used, and no result identity was relabeled to match it.

## Implementation and verification

The fixed notebook runner now selects Worker 1's source-built runtime, checking
its exact binary and full runtime manifest before loading the unchanged model.
The old prebuilt runtime remains the explicit Worker 2 route; its current health
is not claimed. No arbitrary runtime retarget, fallback download or shell added.

T3 can restore an existing exact package after navigation. Duplicate keys,
noncanonical package bytes, expiry, another company or a closed task are rejected.
Import remains inert text with no RPC, source edit, run or acceptance effect.

- Python runner: 8 tests passed.
- Two focused web files: 19 passed, 1 optional Python cross-roundtrip skipped.
- Scoped web typecheck, four-file lint and formatting, `git diff --check`: passed.
- Web build (including license gate) and upstream server/client staging: passed.
- Pure T3 package/result importer checked the actual artifact and output digest.
- Actual paired desktop restored this package, received the exact result, and
  displayed `Bindings checked` plus `Unsigned, unverified proposal · not accepted work`.
  Screenshot is retained under the artifacts folder as `worker1-t3-result.jpg`.

Source hashes:

- `manualTransfer.ts`: `123ccf50e8a6b2f2fe372eeac01c2d5d0cd770c5fe3648df44f54c7ddfb3c3bd`.
- `ManualWorkerTransfer.tsx`: `f0e1b11fd5e9a92f2c357f549153ff718e84f940bf3642cdebe6a9577dc5f3ed`.
- `manual-notebook-worker.py`: `60b21df63978c6a62033ecf94b0550e868a866c5e23e0b98b5cfbeba4c93a62a`.

## Retained failures and boundary

Initial pnpm invocation attempted automatic dependency reconciliation and aborted
before removing modules. Direct installed Vite+ entrypoint used instead; no
dependency/lock rewrite. Missing isolated Desktop directory was created. The
first owned startup reached ready, then received before-quit and its activation
helper failed; cause unconfirmed. Identity checks established zero descendants
before a direct desktop-only launcher succeeded. No broad process stop or
unconfirmed replay was used. Latest checked desktop root 23164, coordinator 26504.

T3/Paperclip connection is working. The Kaggle transport is still manual and
unsigned; this result does not register a live worker or start/accept YELA-3.
Automatic private Kaggle dispatch needs an explicitly enrolled account API
credential, and current whole-workflow independent acceptance remains open.
No public relay, approval-control changes, private pairing export, CompSet denial
rewrite, Yellow operational mutation, PR, merge, referee or complete-harness claim.
