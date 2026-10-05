# HARNESS-006 — Bounded private Kaggle worker check

Status: COMPLETE — bounded proof only, both model/runtime failures recorded.
2026-09-28. Read/execute proof only, no source implementation. See
`handoff/reviews/HARNESS-006-current-private-worker-check.md`, including the
disclosed observation-bound miss and exact-session cleanup. No healthy-worker claim.

## Founder authority

Founder explicitly answered the current asynchronous question: "Yes, start both
for the bounded check"; separately rejected a public relay: "No public relay;
use manual result transfer". This narrowly supersedes HARNESS-005's compute-off
boundary for the two checks below; it does not activate any automatic worker,
public endpoint or billable provider. HARNESS-005 remains in progress separately.

## Exact scope

- Ankit G37 account's existing notebook14389f1658 (Worker 1), accessible in Codex
  browser; Arabian Nights account's existing notebookce88a28cae (Worker 2),
  accessible in the isolated BrowserAct Chrome session.
- Inspect configured accelerator and quota; execute only the existing bounded
  read-only hardware probe and existing model/runtime status cell after fully
  inspecting their code. Do not Run All. No model or runtime download/build,
  public tunnel, code application, generated-code execution or credential copy.
- Record observed current resource data separately from historical retained
  model outputs. Off/stopped/missing model must not be described as ready.
- Time bound: observe each launched check for at most five minutes. If queued or
  unavailable, report the actual state; do not bypass quota/concurrency limits.
- Evidence and governance limited to `handoff/reviews/HARNESS-006-*`, this order
  and append-only LEDGER. Screenshots/retained receipts beneath marked
  `D:/Yellow/harness/state-pilot/artifacts/` only.

## Acceptance and remaining authority

Current authenticated UI shows exact intended notebook; current output confirms
accelerator and model/runtime file existence or records concrete failure. Neither
historical results nor signed-in sessions prove a current healthy worker.

No automatic Kaggle connection is authorized. Future harness task exchange must
be manual artifact transfer, preserving exact model, task, digest and independent
review boundaries. Synthetic bounded output is not whole harness acceptance.
