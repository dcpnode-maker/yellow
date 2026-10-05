# HARNESS-008 — Bounded advisory-transfer acceptance

2026-09-28. Scoped local source/client proof only, not full-harness release.

Local source commits: T3 c6160289e08c1019592aa77b7e6eef40d1244f12;
adapter ddd7c6c0143e98e91dcca6118e09ed5be93bbdaa. Both source worktrees clean after
scoped commits. Generated Python bytecode moved recoverably to the marked
manual-python-test-cache-20260928 artifact directory, not deleted.

Independent reviewer: /root/harness_acceptance_luna, requested GPT-6 Luna medium.
Provider-returned model identity was not separately attested. Reviewer did not
implement the transfer. Personally ran the two focused web test files with
YELLOW_MANUAL_TEST_PYTHON / YELLOW_MANUAL_TEST_RUNNER configured: 17/17 passed,
including the synthetic JS/Python UTF-8 round-trip. Personally ran Python -B
test-manual-notebook-worker.py: six passed. No edits, real inference, notebook
activation, network transfer or coordinator changes by reviewer.

Reviewed task/worker/model/base identity, prompt and exact prefixed-input SHA256,
strict canonical result JSON, expiry/byte limits, fixed CLI argv, no shell/stdin,
unverified/possibly-truncated completion, and plain-text preview. No blocker
found. Reviewer then read the final namespace-import/useCallback delta and found
no admission/semantic regression; no duplicate test run claimed for that delta.

## Parent-executed proof

- Exact vp.cmd focused tests: 17/17; Python -B tests: 6/6. No real subprocess
  inference or generated-code execution in these tests.
- Web tsc --noEmit exit 0; focused formatting exit 0; diff whitespace gate 0.
- Initial cross-round-trip genuinely failed due Windows Python stdin decoding;
  strict explicit UTF-8 binary stdin/stdout fixed it. Hash checks were not relaxed.
- Initial linter could not load missing pinned plugin dependencies. Order 009
  restored exact locked ignored links, without plugin/source disabling. Final
  focused lint exit 0 retains two React Compiler manual-memoization warnings:
  optimization is skipped; this is not a zero-warning claim.
- Web build/licence gate exit 0; final build 76.7 seconds. Original first build
  6,020 modules/103 seconds also passed. Final server CLI build/staged client 0.
  Upstream large-chunk warnings retained. Installer remains old 66409d89 source.

Actual browser proof used only the marked synthetic pilot on 127.0.0.1:38873.
Normal supported CLI pairing created one standard client token, consumed via the
pairing form; no auth bypass or security setting change. Agents stayed disabled;
onboarding imported zero projects. The exact temporary session
b7e05711-a978-4c8d-8ac1-3da4fef65b40 was revoked after proof; owner desktop and prior
sessions were untouched. Only the new proof tab was closed; worker account tabs
and their off compute sessions were preserved.

Existing YEL-4 issue e1c5de0f-48ae-46da-a332-6437753c6966 exported handoff
3e9a3e9e-8c22-4f04-b44f-2fcda5c017c7, worker-2, base 66409d89686e47c988b7384db17c2e77f2ec6a27.
Downloaded bytes retained as manual-ui-export-20260928.json. Local fixture helper
created explicitly SYNTHETIC text, not a real worker result. UI accepted its
binding and displayed Arabic/emoji and literal script text; DOM had zero script
elements inside the proposal. Altered text was rejected: Proposal text digest
differs, preview count zero. Before/after API proof: five backlog/unassigned jobs,
three paused agents, zero runs. No queue state or generated source was applied.

Artifacts under marked state-pilot/artifacts: manual-ui-synthetic-proof.mjs,
manual-ui-export-20260928.json, manual-ui-synthetic-result-20260928.json,
manual-ui-preview-20260928.png. Screenshot proves the actual initial preview;
final callback-only lint correction was checked by reviewer and final tests/build.

After the final client staging, the exact owned desktop was restarted with the
reviewed lifecycle tool: old root 720 stopped with processCount 0; new root 30548
ready in 6,756 ms, eight processes. Log verifies an HTTP-source main window.
Paperclip root 29156 remained running, untouched. Final pilot guard passes with
all six providers disabled. This is local built runtime, not the older installer
or evidence of connected workers/native delegation acceptance.

This establishes unsigned advisory preview only. Digests are not identity/health
attestation, semantic completion, current worktree validation, task assignment or
artifact acceptance. No signed/public relay, new model variant, paid API, real
manual-worker inference, production mutation, PR, merge or full-product closure.
