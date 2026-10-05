# RESOURCE-20261001 — Android RMS engine build and simulation lane

Author: Codex laptop controller under the founder's explicit request to give the phone heavier RMS build work. Keep CompSet research separate. Use canonical Yellow rate logic, not a second pricing engine, guessed demand model or fabricated production data.

## Scope

- Read src/contexts/rates, their kernel dependencies, existing pure evaluator/model tests and relevant decisions/contracts. No product source, dependency, migration or live rate edits.
- Prepare a task-owned Node-compatible build of the existing deterministic RMS/rate-plan evaluation slice, exact input/output manifests and a multi-worker synthetic simulation harness beneath E:/YellowWorkspace/Data/BuildArtifacts/yellow-phone-rms-20261001-v1/.
- Use the existing canonical laptop Bun toolchain to compile a bounded pure entry when feasible, then the Android Node runtime for its own actual build/runtime workload. If Bun/PostgreSQL-only dependencies prevent a valid Node build, discover and isolate the real pure module graph; do not stub a database, replace the core evaluator or claim a backend engine build from a frontend label.
- Typed, immutable, SHA-bound phone requests under E:/YellowWorkspace/PhoneWorker/receipts/, reviewed/dispatched by root only. Existing authenticated targeted coordinator; no public source upload, account credentials, external proxy, detachment or deadlines bypassed. Fresh actual plan-only guard before each batch; account credits are emergency-only.

## Useful heavy work

Verify a meaningful fixed oracle before scale work: canonical rate model/AST operations, exact bigint minor-unit amounts, currency separation, rounding, valid/invalid inputs and determinism as supported by the current engine. Derive expected values independently from explicit synthetic cases, not by calling the same evaluator to generate its expected output. Existing tested fixtures may be reused with provenance.

Then execute a finite matrix of synthetic booking windows, rate-plan variations and supported operations in multiple actual Node worker threads. Bound concurrency to actual phone affinity/available memory (start four; at most six without contrary evidence). Use substantial cases only when they exercise distinct inputs/branches or reveal performance/correctness limits. Do not run arbitrary endless CPU loops, fill RAM or re-run an unchanged benchmark to simulate progress. No real business data, published rates, OTA calls, demand forecast or financial mutations.

Split work into separate owned jobs with at most48s internal time budget /60s worker deadline and bounded64KiB output. Each chunk records exact input/bundle/oracle hashes, worker count, completed work, digest and timings; retain full compact results/proofs on the laptop. Stage install/build/simulation only after preceding proof. No background child survives job return. Pause stops new dispatch and preserves completed chunk IDs/results; resume verifies immutable inputs/results before continuing incomplete chunks. No purchased model/API fallback or automatic plan reset.

## Acceptance

Root independently inspects the exact build/harness/jobs, runs Windows reference oracle checks, and personally validates actual Android runtime/architecture and outputs from every returned chunk. Native phone compilation and runtime proof are distinct; report exactly what ran on each. Compare complete result identities/digests against the independent oracle and source-bound workload definition; aggregate no missing chunks. Preserve failures, timeouts and partial evidence before bounded repair. Performance is diagnostic for this finite synthetic workload, not a production latency/SLA or completed autonomous RMS/dynamic-pricing claim.

The phone remains a validation/build worker; the laptop keeps source/control and PostgreSQL remains booking/rate authority. No product deployment, rate publication, new source of truth or entire ecosystem completion follows from this lane.
