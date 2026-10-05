# Order 607 — OmniRoute free-provider activation

## Status

OPEN

## Purpose

Activate and prove the existing loopback-only OmniRoute/continuity tooling as a
bounded zero-cost proposal-worker pool for Yellow. Codex remains the coordinator,
integration owner, test runner and release authority. Gemini API and OpenRouter may
be used only through currently free, explicitly selected routes with hard zero-price
guards; local workers remain preferred for routine work when available.

## Scope

- `tools/build-continuity/**`
- `tools/local-ai/**` only where needed to expose the reviewed worker command
- `.goosehints`
- `handoff/GOOSE-HANDOFF.md`
- private runtime state under Git metadata (`.git/yellow-omniroute` and
  `.git/yellow-continuity`), never committed
- one pinned, checksum-verified open-source graphical agent harness installed under
  `E:\yellow\goose`, with its private user configuration outside Git
- `handoff/orders/607-omniroute-free-provider-activation.md`
- `handoff/reviews/607-omniroute-free-provider-activation.md`
- `handoff/LEDGER.md` and `DECISIONS.log`

## Required behavior

1. Preserve OmniRoute `127.0.0.1` binding, gateway authentication, disabled tunnel,
   disabled MITM, disabled background services and pinned package verification.
2. Store provider credentials only in private OS/Git-metadata state; never print,
   commit, place in task context, or copy them into Yellow application containers.
3. Verify each enabled provider with a minimal authenticated request. Reject unknown,
   nonzero, or fallback pricing before any task request.
4. Gemini and OpenRouter workers produce bounded proposals only. They cannot execute
   code, edit the checkout, deploy, access production data, or approve their own work.
5. Do not rotate accounts or keys to evade quotas. A quota or access denial pauses
   that provider. Multiple founder-authorized keys may be isolated by worker/device
   only when provider terms permit; they are not an automatic quota-bypass pool.
6. Run one real, low-risk, disjoint Yellow coding or review assignment and retain the
   receipt, proposal, model identity and zero-cost proof. Codex must inspect it and run
   the relevant repository tests before integration.
7. No Yellow application/database/schema/migration/seed/permission/production/public
   runtime mutation is admitted by this order.
8. The founder-facing harness must provide persistent graphical chat sessions and
   visible tool progress. Its default model is the loopback-only local Ollama worker;
   hosted providers are optional bounded fallbacks, never an implicit paid route.
9. Goose receives repository-native, secret-free continuity through `.goosehints`
   and a bounded handoff. Raw Codex transcripts, hidden instructions, provider keys,
   customer data and stale execution claims are never bulk-imported.

## Acceptance

- Focused tooling tests pass.
- OmniRoute local health is HTTP 2xx and unauthenticated model discovery is HTTP 401.
- At least one authenticated free provider generation succeeds with secret-redacted
  evidence, or the exact external credential/account blocker is recorded honestly.
- One bounded proposal task is completed and independently reviewed without granting
  the worker execution or release authority.
