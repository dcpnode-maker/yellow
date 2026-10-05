# HARNESS-006 — Current private worker check

Parent-executed UI evidence, 2026-09-28. Not live-model or whole-product acceptance.
Founder approved starting both notebooks for resource/status proof only and
explicitly declined public relay in favor of manual transfer.

## Current results

| Worker | Exact notebook/account | Current resource probe | Current runtime result |
| --- | --- | --- | --- |
| 1 | Ankit G37 / notebook14389f1658, Codex browser | 4 CPUs, 33659383808 RAM bytes, 2 Tesla T4s each 15636037632 bytes, Python 3.12.13, torch 2.10.0+cu128; tiny CUDA matmul true / 453.82 ms | Existing read-only status cell freshly executed at 14:54: RuntimeError, model/runtime files absent or unexpected. No new download. |
| 2 | Arabian Nights / notebookce88a28cae, isolated Chrome | Same CPU/RAM/GPU/Python/torch; tiny CUDA matmul true / 547.58 ms, cell completed 14:49 | Model file size passed, runtime member exists, but fresh `llama-cli --list-devices` failed PermissionError errno 13. Execution permissions not repaired under this order. |

Both are GPU notebooks now, not a currently verified TPU. Earlier 88–90 second
coding results and 12–14 tokens/second belong to historical retained outputs.
They were not rerun, inferred current or presented as fresh health.

No Run All, model download, generated-code execution, source application, secret
copy, account logout, public relay or paid provider action occurred. BrowserAct's
first Shift+Enter attempt did not execute Worker 2; explicit current-cell Run
produced the recorded fresh permission failure. Worker 1 iframe mouse input was
ineffective; supported keyboard activation executed only the inspected status cell.

## Cleanup and disclosed observation-bound miss

Both exact sessions show off/stopped after cleanup. Worker 1 menu keyboard
activation succeeded after mouse actions proved ineffective. Worker 2's exact
Stop session control succeeded. The order's five-minute observation bound was
missed while resolving these UI controls (roughly 11–12 minutes session time),
not hidden or treated as another authorized model run. No inference occurred.
Do not leave idle sessions active based on this proof.

Worker 2 screenshot attempt timed out after 100 seconds and did not create the
requested local file. That attempt is not screenshot proof. Current output and
off/stopped state were read directly through the authenticated UI.
Specific founder permission for restoration and finite tests is recorded separately
under HARNESS-007, not retroactively inferred by this check.
