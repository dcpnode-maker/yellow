# HARNESS-011 — private Worker 1 API enrollment

28 September 2026. Implementer evidence, not independent release acceptance.

## Credential and actual API proof

The founder supplied a new Kaggle token specifically to continue Worker 1 setup.
The official token-introspection operation confirmed active account `ankitg37`.
No plaintext credential was written to source, logs, a task package, persistent
environment variable or shell argument. Enrollment uses existing Windows
CurrentUser DPAPI protection with a 24-hour local expiry, ending
`2026-09-29T17:19:18.179Z`; the exposed screenshot token needs founder rotation.

The encrypted file and credential-free reference remain in the separate retained
state workspace. Neither is copied into a notebook or a review package.

`kaggle-api.mjs` uses only four fixed read-only operations at Kaggle's official
API origin. It verifies active exact account and private exact notebook, bounds
JSON bytes/time, forbids redirects/ambient credentials and returns no source or
upstream error bodies. Failed/unknown requests are not automatically retried.
The SDK JSON contract was checked against official `kagglesdk` 0.1.37, isolated
outside source with published wheel SHA-256
`766e7d1e59379941b373957e7d80f612942e63ab4a638d99ae4ee3e9e92f050e`.

Actual credential-free proof is retained as
`D:/Yellow/harness/state-workspace/artifacts/worker1-kaggle-api-proof.json`.
At 17:50:49Z it verifies private `ankitg37/notebook14389f1658`, T4 GPU enabled,
TPU disabled and approximately 22.37 GPU hours remaining before the current
quota refresh. Missing pay-to-scale fields are reported unknown, not inferred
as free. `no_saved_run` is an API batch-status 404, not interactive session health.
The adapter explicitly reports `api_connected_not_dispatchable` and does not
mint model/worker grants, start compute or accept source.

## Session/cache fault and bounded restoration

The browser initially showed Worker 1's session off and `No persistence` selected.
One approved fixed resource-only cell started the two-T4 session. Its fresh
17:39:00Z result established four CPU cores, two 15-GiB T4 GPUs and **missing**
Qwen weights and source runtime. Old generation output is not current health.
The result is retained as `worker1-resource-check.json` beside the API proof.

Files-only persistence was selected and re-read as selected in Kaggle's UI;
credential-free proof is `worker1-kaggle-persistence.png`. No new account link,
billable setting, public relay or restart/all-cells execution was used. The
optional Colab Pro account-link dialog was cancelled without linking an account.
Persistence surviving a later session remains unproved.

The exact already-approved 27B weights/source pin is restoring in a new fixed
cell. `restore_weights()` avoids repeating the known incompatible prebuilt
runtime; it preserves invalid retained bytes and verifies exact model size/hash.
The existing source build retains its 40-minute build deadline and owned-group
timeout cleanup. This record does **not** yet establish successful restoration,
fresh generation, a live T3 worker or automatic dispatch.

## Focused proofs and preserved failures

- `node --test kaggle-api.test.mjs windows-secrets.test.mjs`: 16 passed, 0 failed.
  Includes actual Windows encryption plus token/source redaction, fixed origins,
  owner/privacy/expiry checks, bounded responses, unknown quota and canonical
  credential-reference enrollment tests.
- `py -3 .\test-pinned-qwen-restoration.py`: 9 passed, 0 failed.
- `py -3 .\test-pinned-qwen-source-runtime.py`: 4 passed, 0 failed.
- Adapter `git diff --check` passed, with existing CRLF warnings retained.

An initial unittest-discovery invocation found zero tests because the standalone
filenames contain hyphens. Direct script execution then exposed two fixture
failures from Windows path normalization; the fixture comparison was corrected
to Path equality and all nine actual tests ran. No production guard was weakened.
An iframe-coordinate action was refused before input; the named notebook frame
was used instead. These are not successful earlier proofs or erased failures.

## Activation boundary

The new API adapter is standalone and not imported into the live T3 execution
factory. Regenerate/hash-verify the complete executable module manifest before
activation; never loosen its pinning. Native T3 automatic job dispatch and the
full current build/review acceptance remain unfinished. Worker 2 is unchanged.
No new paid-model worker, generated-code execution, source application, approval
changes, pairing export, CompSet-denial rewrite, Yellow operational mutation,
public publication, PR, merge or Yellow referee is claimed.

## Subsequent evidence, 29 September continuation

Restoration subsequently completed and a provider-issued private Jupyter
connection produced a real bounded Qwen proposal. See
`HARNESS-011-private-jupyter-proof.md` for exact fresh pins, preserved resource
failure, one-shot generation receipt and CPU-only idle proof. The earlier
in-progress restoration wording is a dated checkpoint, not current status.

The no-plaintext-logs statement above describes the API-token enrollment only.
Subsequent browser observations accidentally included private provider URL / UI
token material in internal tool output before filters were corrected. Do not
export raw tool logs. No such material was placed in source, task packages,
these credential-free review files or a public relay. This redaction limitation
is retained rather than relabeled as a clean credential handling proof.
