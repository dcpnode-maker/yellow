# HARNESS-016 — Live, Kaggle-only progress

Founder explicitly requests a live progress bar or percentage for Kaggle work,
not Codex. Scope: tools/yellow-harness/worker-jobs/{progress.mjs,test_progress.mjs},
this order, README.md and the HARNESS-015 receipt. Serve read-only sanitized
telemetry at127.0.0.1:38885; no public relay, pairing token, raw connection,
model prompt, proposal or host execution endpoint. Poll only enrolled existing
fixed job status. Stop remote polling after each finite job completes/fails.
Denominator is the ten predeclared test/review steps across three workers;
completed tests include failures, which stay visibly distinct from passing.
Startup/download/build setup must not inflate that percentage. Measure process
RAM before retaining the optional UI server. This is not native T3 acceptance.
