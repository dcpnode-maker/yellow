# Order 683 — First free GPU coding-model smoke

Status: IN PROGRESS. Branch: `phase-0/yellow-harness-controller`.

## Intent and review context

Prove one real coding-model response on the personally operated, non-commercial
synthetic Kaggle GPU notebook established by Order 682. This is a first worker
candidate only; model output never edits Yellow. The eventual harness target and
its independent review gates are stated in Order 682. This order does not close
Order 681's state-machine review or authorize remote worker transport.

## Scope

- This order file and new files under `tools/yellow-harness/model-eval/**`.
- One small official coding model with published license and fixed revision:
  `Qwen/Qwen2.5-Coder-1.5B-Instruct` at
  `2e1fd397ee46e1388853d2af2c993145b0f1098a` (Apache-2.0). One synthetic Python task,
  fixed generation settings, bounded output, timing and memory receipt.
- Use only packages already in the notebook image. No private source, keys,
  hotel/guest data, account changes, model server, tunnel, or paid resource.
- Stop the Kaggle session after the run and preserve the local receipt.

## Acceptance

1. The exact notebook cell is versioned locally and has local syntax/contract tests.
2. The notebook visibly reports model identity, fixed revision, output and elapsed
   time, or an exact failure. Quality is not asserted from one prompt.
3. No background Kaggle session remains running after the smoke.
