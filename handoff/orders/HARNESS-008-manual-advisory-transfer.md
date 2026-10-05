# HARNESS-008 — Manual advisory task/result transfer, no public relay

Status: SCOPED LOCAL PROOF COMPLETE. 2026-09-28. Local implementation, Phase 0.
See review HARNESS-008-manual-transfer-acceptance.md. Not a full-product release
or accepted/connected worker workflow; no PR, merge or new installer claimed.

## Authority and scope

Founder wants the harness completed and explicitly selects manual result transfer
instead of a public relay. This slice makes that operator workflow usable without
pretending that an unsigned notebook proposal is an authenticated executor result.
T3 remains the one UI; Paperclip remains sole durable job coordinator.

- T3: new `apps/web/src/components/universalHarness/manualTransfer.ts` and its
  paired tests, new `ManualWorkerTransfer.tsx` and paired component tests,
  focused wiring in `UniversalHarnessPage.tsx`, operating doc only.
- Adapter: new fixed `manual-notebook-worker.py` and its stdlib test, README only.
  This runner is operator-started for one JSON task and one fixed pinned model,
  not a scheduler, server, shell executor or arbitrary model loader.
- Governance: this order, HARNESS-008 reviews/questions, append-only LEDGER;
  synthetic fixtures beneath the marked state-pilot artifacts directory.

## Contract and guardrails

Export a user-visible immutable advisory envelope for an existing current
Paperclip task, explicit worker/model/source-base/prompt and SHA256 binding.
Export does not assign, claim, start, approve or close a coordinator job. An
operator decides whether to transfer the prompt to a notebook; no background
upload, network request, public endpoint or credential copy is added.

The Python runner accepts strict bounded JSON, verifies the fixed model
digest/runtime revision, calls one finite pinned binary without shell=True,
and returns a bounded plain-text proposal. It cannot execute/apply generated
code, evaluate prompts, accept commands, select a fallback model or fetch weights.

Import validates exact task/worker/model/envelope and output digests, bounds,
expiry and forbidden fields; it renders text only. This is unsigned operator
transfer, not worker identity/health attestation. It stays local to the current
UI session and can be downloaded as evidence; it does not write a parallel job
queue, coordinator state, executor receipt or accepted-artifact record.

Completion evidence boundary: the pinned llama-cli discards API finish_reason.
All finite text is therefore explicitly `completion: unverified` and
`mayBeTruncated: true`, even for exit 0. Preview is permitted, never completion or
acceptance. Reject nonzero exits, timeout, empty/excess output and known context
limit failures. Bind both original prompt bytes and exact fixed-prefixed runtime
input; the prefix prevents CLI `/read`/`/glob` prompt commands. No token-limit
completion assertion or automatic retry is inferred from a successful exit.

Separate future scoped integration is required to attach independently accepted
artifacts to an authoritative coordinator run. Do not call this preview that
integration, a signature, worker readiness or complete project-build acceptance.

## Proof

Round-trip fixed canonical JSON between JS and Python; deny altered prompt,
task/worker/model/digest/base, duplicate/excess fields, excessive byte size,
expired/future identity and failed/oversized outputs or false completion claims.
Bounded text explicitly remains possibly incomplete. Render imported script/HTML
as text, never execute. Python tests substitute a fixed subprocess stub only,
prove one finite argv/no shell, never run generated output or real inference.
Actual owned UI export/import proof and independent bounded review required.
