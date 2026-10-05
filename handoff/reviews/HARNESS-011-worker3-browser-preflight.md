# HARNESS-011 — Worker 3 browser and TPU preflight checkpoint

29 September 2026. Preparation only; not model/worker readiness.

The founder supplied the separate dcpnode account for TPU Worker 3 and approved
creation of a blank local Chrome profile. BrowserAct created
chrome_local_120817740752617624, name yellow-kaggle-worker-3, with no profile
import, proxy, paid service or public worker relay. No password is stored in
source or this review.

The isolated Google sign-in attempt reached the email step, then Google
rejected it with "This browser or app may not be secure." The password step
was not reached and no password was entered. No automation challenge solver,
browser-warning bypass or Google security-setting change was attempted.
The screenshot worker3-google-signin-rejected.png is retained in the separate
state-workspace artifacts directory. Do not export raw authentication URLs
from the browser-command logs.

The founder explicitly declined a manual-control link and chose normal Chrome
sign-in. This overrides the BrowserAct skill's remote-assist handoff default;
no remote-assist link was created. The owned headless setup session was closed,
then the same isolated profile was opened headed at Kaggle's login page as
yellow_worker3_manual_0929. Leave that session untouched while the founder
signs in. Do not claim account authentication until the founder returns and
the visible exact account/notebook is verified. Workers 1 and 2 were not
restarted or logged out.

## Prepared resource check

D:/Yellow/harness/adapters/t3/kaggle-tpu-preflight.py is a fixed resource-only
script, not an installed TPU model or activated T3 backend. It refuses a
non-Kaggle host, reads CPU/RAM/storage and installed package versions, then
requests only existing TPU device metadata through JAX in a 90-second child.
Missing runtime/memory values remain explicit unavailable/unknown states.
It installs/downloads nothing, generates no tensors/model output, exports no
environment variables or private notebook URL, and never executes proposals.
Its resource result cannot assert modelReady/automaticDispatchReady.

The API shape was checked against official JAX devices/Device documentation:
https://docs.jax.dev/en/latest/_autosummary/jax.devices.html
https://docs.jax.dev/en/latest/_autosummary/jax.Device.html

Parent executed py -3 test-kaggle-tpu-preflight.py: 4 passed, 0 failed.
These are local mocked guard/output tests, not a real Kaggle TPU measurement.
Worker 3 has not started compute, selected/downloaded a model, enrolled any
private Jupyter credential or connected to T3. Actual memory and device
compatibility must be established before choosing a TPU runtime; Worker 1's
CUDA/T4 binary is not copied as a TPU solution. Idle accelerators remain off.

No independent current runtime/workflow acceptance, paid model, public relay,
Drive grant, approval change, CompSet activation, generated-code execution,
source application, Yellow operational mutation, PR, merge, referee or full
harness completion is claimed.

## Authenticated fresh TPU retry, 29 September 2026

The founder completed manual sign-in, then deleted the first notebook and its
starting session and explicitly requested a new TPU attempt. The existing owned
BrowserAct session was reused, not another profile/account. A refresh of Kaggle's
Code page verified visible account dcpnode and the old notebook marked
`[Deleted Notebook]`; the stale editor was not restarted or resurrected.

Created and renamed one fresh notebook, `Harness Worker 3 TPU Preflight`:
https://www.kaggle.com/code/dcpnode/harness-worker-3-tpu-preflight/edit
The Share panel independently shows Private selected and dcpnode as Owner.
It was closed with Cancel; no permissions or sharing settings were changed.

Selected TPU v5e-8 through the normal Accelerator menu and confirmed Turn on.
The provider dialog displayed 20 hours remaining of its 20-hour weekly TPU
allowance. Then clicked Start session exactly once. Around
2026-09-28T19:28Z (29 September IST), the visible provider banner reported
`You are #299 in the queue`, while Draft Session remained Starting. Credential-
free screenshot: D:/Yellow/harness/state-workspace/artifacts/
worker3-tpu-fresh-queued-0929.png. No allocation ETA is known.

Leave that single request queued; do not repeatedly cancel/recreate it. This is
a real new allocation request, not successful TPU resource/model proof. The
default template has not been run; the fixed resource check has not been added
or executed while the session is starting. CPU/RAM/HBM/storage remain unmeasured,
no model/runtime downloaded, and no Worker 3 private connection/enrollment or
T3 dispatch is claimed. Workers 1 and 2 were not changed. The local state.sh
attempt still failed before execution because WSL /bin/bash is absent.
