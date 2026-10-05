# HARNESS-014 — TokenHarbor free-only connection

Status: LOCALLY COMPLETE for connector enrollment and one synthetic live proof.
29 September 2026. Local harness tooling only; native T3 routing is unchanged.

## Authority

The founder supplied a TokenHarbor API key and said "just add it" after the
API compatibility, paid-route distinction and free-route retention warning.
Add the provider without changing the HARNESS-013 Codex-primary direction,
the existing T3/Kaggle jobs, approval controls or installed Codex credentials.
Initial live proof uses only a fixed synthetic prompt, not private source/data.

## Exact scope

- This order; append-only handoff/LEDGER.md; credential-free
  handoff/reviews/HARNESS-014-tokenharbor.md.
- tools/yellow-harness/providers/tokenharbor.mjs and tokenharbor.test.mjs.
- D:/Yellow/harness/state-workspace/tokenharbor-enrollment.json;
  credentials/tokenharbor.dpapi; artifacts/tokenharbor-connection.json.
- Reuse, without edits, the existing Windows CurrentUser DPAPI helper at
  D:/Yellow/harness/adapters/t3/windows-secrets.mjs.
- HTTPS requests only to https://tokenharbor.ai/v1/models and
  https://tokenharbor.ai/v1/chat/completions, no redirects or automatic retries.

## Required proof

Focused tests must reject ordinary/paid model IDs before credential reads or
network requests, sanitize transport errors, bound input/output and prove no
fallback. Enroll the supplied key encrypted, discover exact live :free IDs,
and attempt one finite synthetic completion. Report authentication and free
generation separately. Any auth/quota/consent failure stops without fallback.
Do not infer quota availability from successful catalogue discovery.

## Boundaries

No key in source, argv, environment, plaintext state, receipts or test output.
No gateway installer, subscriptions/top-ups, account-wide rotation, public
relay, private source upload, model-selected tool/code execution, new scheduler,
existing job dispatch, provider/default-model rewrite, public PR or merge.
This adds a callable provider connector, not a claim of completed automated
build/review routing or a native T3 chat-provider entry.

The state.sh attempt failed because the Windows WSL shim has no /bin/bash.
Repository branch/head/dirty state and relevant orders were inspected natively;
no Yellow database/referee or PR gate is claimed.

## Result

Parent executed connector tests 9/0, existing real Windows DPAPI tests 2/0,
syntax and diff checks, and a five-file zero-plaintext-credential check.
Actual discovery found five explicit :free IDs; one deepseek-v4-flash:free
request returned the exact synthetic marker, completion_tokens=34, at
2026-09-28T20:02:57.882Z. Remaining quota is not measured. The configured
independent reviewer could not start; no replacement or independent acceptance
is claimed. Exact evidence and integration limitations are retained in
handoff/reviews/HARNESS-014-tokenharbor.md.
