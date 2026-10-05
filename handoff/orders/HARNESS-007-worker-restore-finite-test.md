# HARNESS-007 — Restore two private workers and run finite coding proof

Status: BOUNDED IMPLEMENTER PROOF COMPLETE; independent review pending.
2026-09-28. Successor to the bounded HARNESS-006 check. Both exact private
sessions are stopped after evidence retention. Not connected-worker or harness
product acceptance. Current generated throughput: 13.8 t/s for each T4 pair.

## Founder authority

Founder explicitly approved restoring Worker 1's pinned Qwen model/runtime
(approximately 16.5 GB model download), repairing Worker 2's verified runtime
permissions, and one finite synthetic coding test each. Outputs remain proposals:
no generated-code execution, source application, paid API or public relay.

## Exact scope and limits

- Existing private Ankit G37 notebook14389f1658 and Arabian Nights
  notebookce88a28cae only. Never Run All or switch account identity implicitly.
- Inspect the exact existing pinned public model/runtime cells before execution.
  Verify model byte length and SHA256; retain the exact upstream runtime revision.
  Only repair execution bits and missing relative SONAME aliases on the exact
  inspected restored private runtime members. Validate ELF SONAMEs and reject
  conflicting aliases; never overwrite files or alter system permissions/libraries
  or security settings. See HARNESS-007-runtime-link-restoration question record.
  No worker-supplied bootstrap or shell.
- Restore Worker 1 using the reviewed model/runtime setup, existing source and
  bounded download/build commands; do not install another model or change pins.
- One finite synthetic coding prompt per worker; bounded tokens and subprocess
  timeout, print/export plain text as an untrusted proposal, never eval/exec/apply.
- Max setup observation 90 minutes per worker, no unattended retry loop, no
  inference replay after uncertain effects. Stop these exact owned sessions after
  results are retained, unless founder authorizes continued compute separately.
- Local evidence: `handoff/reviews/HARNESS-007-*`, this order, append-only LEDGER,
  and `D:/Yellow/harness/state-pilot/artifacts/worker-*`. No Yellow production,
  provider credential, public tunnel, separate durable task queue or billable model.

## Acceptance

Current hardware, pinned model digest, runtime revision and finite subprocess
result are recorded independently for each notebook. A useful generated answer
is not proof of correct code, accepted artifacts or a connected harness worker.
Manual result transfer remains the only authorized Kaggle integration.
