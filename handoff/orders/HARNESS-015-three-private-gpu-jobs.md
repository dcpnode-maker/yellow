# HARNESS-015 — Three private Kaggle GPU job lanes

Founder authority, 2026-09-29: connect three GPU workers, choose fitting models,
assign public Yellow PR testing/review work, and show worker-only progress.
Specific approval permits encrypted provider-issued private Jupyter connections
for up to 24 hours and finite public-source/model jobs. No public relay.

## Scope

- This order and handoff/reviews/HARNESS-015-three-private-gpu-jobs.md.
- tools/yellow-harness/worker-jobs/{operator.mjs,owned-job.py,test_operator.mjs,
  test_owned_job.py,README.md}; fixed operator-driven commands, exact three
  notebook identities, immutable per-dispatch claims, bounded source/output,
  and progress derived from completed assigned jobs only.
- Existing D:/Yellow/harness/adapters/t3 private-Jupyter and DPAPI primitives
  are reused unchanged, not installed into the native T3 execution factory.
- Private per-worker credentials, enrollments, claims and sanitized receipts
  under D:/Yellow/harness/state-workspace; no plaintext private URL in logs/Git.
- Public pinned Qwen 27B weights and pinned llama.cpp build in each authorized
  ephemeral notebook; fixed resource/model probes and finite PR review/test
  batches against exact public source revisions. No generated-code execution
  or automatic source application. Retain all earlier receipts/denials.

## Exclusions and acceptance

No paid fallback, live guest/hotel data, arbitrary model tool access, host shell
from worker output, new public services, account-setting changes, self-merge,
or claim of native T3/whole-harness readiness. Existing execution admission
controls remain intact. Each job is independently observable; setup is not
counted as completed build work. A worker proposal is not accepted source or
independent personally executed high-risk proof. Parent integrates and tests.

Status: finite batch finished. Three private resource checks, seven source test
suites and three actual Qwen27B advisory calls have receipts; one original source
suite failed and remains red. Native T3/whole-harness readiness is not established.
