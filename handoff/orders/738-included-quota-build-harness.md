# Order738 — external included-quota Gemini build harness

26 September2026. Founder explicitly requests Yellow builds using local/free
models only and an external harness when Codex cannot host those models. No GPT
implementation/review workers or paid fallback. Root coordinates only; Gemini
via the installed Antigravity CLI implements and independently reviews code.

## Authority and baseline

Actual checkout D:/Yellow/git-live-order611-source-v2; existing dirty work belongs
to the founder. Preserve it. Read PROJECT.md and AGENTS.md first. No branch switch,
reset, clean, staging-all, commit, PR, merge, deployment, role/schema/DB change,
credential access, network-settings change, installs or new recurring services.
The live synthetic preview and its tunnel must remain unchanged.

Root verified existing Antigravity Google AI Pro sign-in with Gemini quota:
weekly98.82%, five-hour100.00%,26September2026. Explicit model
gemini-3.8-flash-low returned READY in conversation4f81cc88-43cb-45e8-8d67-7da536385a5f.
This is existing included quota, not a promise of an unmetered free service.
Never enable paid credits/overage or fall back to another provider. CLI path:
C:/Users/astha/AppData/Local/agy/bin/agy.exe. Bun path:
C:/Users/astha/.bun/bin/bun.exe. PowerShell7 is available.

## Exact scope / ownership

Gemini builder may create/edit ONLY:
- scripts/free-build/Invoke-YellowFreeBuild.ps1
- scripts/free-build/queue.json
- tests/order738-free-build-harness.test.ts
- docs/FREE-BUILD-HARNESS.md
- handoff/receipts/738-free-build-harness.md

Root: this order; order739; docs/PROJECT-STATUS.md; handoff/LEDGER.md;
handoff/receipts/738-free-build-dispatch.md (root dispatch/blocker evidence only);
sanitized prompt/result artifacts under D:/Yellow/temp/order738/.
Independent separate Gemini session: handoff/reviews/738-free-build-harness.md
and personally executed read-only/mocked verification. Do not review own work.

## Required behavior

Build a minimal external queue runner for the installed AG CLI, not a new model
service. Default to report/dry-run. Explicit -Run processes a finite queue with
bounded per-job timeout, one worker at a time, durable per-job status/result and
resume without rerunning accepted jobs. Real execution must use the exact Gemini
model allowlist (initially gemini-3.8-flash-low only), never GPT/Claude/paid API keys,
fallback providers or permission-skip flags. Stop on eligibility/quota/network/
permission failures; never turn provider failures into successful completion.

Builder and independent reviewer are separate new conversations. Allowed build
edits are only each queued order's exact scope. Reviewer must not implement.
Hash the preexisting dirty working files and detect out-of-scope changes; stop and
report, never reset/delete them. Distinguish implementation success, verification
success and reviewer acceptance. Do not trust prose SUCCESS as test evidence.
Keep finite timeout/max-job limits; no daemon/scheduler or infinite retries.
No model downloads. No live app/source mutation beyond admitted queue scopes.

Retain normal AG tool approval/sandbox controls. If those prevent unattended
tests or edits, report needs-attention rather than bypass permissions or inventing
execution. Secret/config/attachment/provider-export directories are not task input.
Never emit tokens/passwords/cookies/.env contents. Harness logs should contain
safe task identity, status, commands and result metadata, not session credentials.

Initial queue is Order739's read-only frontend folio table pagination build plus
independent review. Do not implement Order739 in the Order738 builder session.
Document that Codex's current chat is still GPT; this harness is a separate
Gemini worker lane, not a switch of the current conversation's model.

## Verification

Write mocked tests with implementation. Prove default no-op, exact model/CLI
allowlist, path/scope validation, timeout/failure/quota stop, no paid fallback,
durable status/resume, no auto-deploy, independent review dispatch and secret-safe
logs. Use injected executor for tests; no nested real model calls or app/DB/tunnel
commands. PowerShell parser check and Bun focused tests must run and results be
recorded accurately. Execute no live queue until root independently checks scope
and the separate Gemini reviewer has personally executed the proof.
