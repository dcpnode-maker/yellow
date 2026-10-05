# Order 615 — DSH free-worker harness pilot

## Objective

Evaluate DeepSeek Harness (`dsh`) as Yellow's visible, durable free/local worker
control plane without changing the accepted public runtime or any product source.
Expose both the existing free-only OmniRoute lane and founder-owned Gemini API
lanes in its model picker, while keeping credentials isolated by harness. Admit it
only after an executable read-only comparison against the proven Goose worker.

## Scope

- this order and its review;
- an isolated, version-pinned DSH installation below `E:\yellow\dsh\`;
- private DSH home, provider configuration, prompts, receipts and logs below
  `.git/yellow-continuity/dsh-pilot/**`;
- an optional deterministic launcher below `tools/build-continuity/` that reads
  existing private OmniRoute or harness-specific Gemini credentials without
  printing or copying them;
- append-only ledger/decision entries after proof.

No Yellow product source, database, fixture, public container, phone setting,
credential value or accepted release artifact is in scope.

## Required behavior

1. Pin the installed DSH package/runtime version; do not execute an uninspected
   floating package on every launch.
2. Bind any Web UI to loopback only. Never expose filesystem or terminal tools to
   the LAN or internet.
3. Route OmniRoute requests only through the existing loopback endpoint and an
   explicit `:free` model. Gemini routes use only an explicitly selected model and
   a harness-specific environment variable. No paid fallback, implicit provider
   fallback, raw key duplication, or cross-harness key rotation.
4. Use an isolated DSH home and the isolated Order609 candidate. The first task is
   read-only and must use Windows PowerShell correctly.
5. Record provider/model, start/end state, exit reason, output/log paths and a
   candidate byte-diff proof. Redact secrets.
6. DSH does not receive a product writer lease until its read-only proof is accepted.
7. Retain Goose as the working fallback until DSH demonstrates at least equivalent
   completion, tool correctness, observability and bounded execution.

## Acceptance

- pinned DSH starts successfully on Windows x64;
- loopback binding and isolated home are proven;
- the Web UI model selector lists the configured Gemini Pro/Flash choices without
  embedding a key in the profile;
- an explicit-free read-only Order609 preflight returns the required six-field
  contract without command-family errors;
- the candidate differs from the accepted source only by approved order/review
  metadata;
- a comparison records whether DSH, Goose or a hybrid is the admitted primary.

## Forbidden

- global install, floating unattended `npx` execution, third-party plugins,
  unreviewed skills, public bind, raw API keys in repository or logs;
- shared-checkout edits, product edits, Docker/database/public-runtime changes;
- claiming DSH is superior merely from stars, marketing, or a successful boot.
