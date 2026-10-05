# HARNESS-014 — TokenHarbor connection evidence

29 September 2026. Parent-executed local connection proof, not independent
workflow acceptance or native T3 provider registration.

## Exact source

- tools/yellow-harness/providers/tokenharbor.mjs:
  SHA256 4a067ff0df7fbcde9c212cbd8fa419ab9172099c52fca5f2d5d45446180ba0b4.
- tools/yellow-harness/providers/tokenharbor.test.mjs:
  SHA256 ddcb96e7a72628912026af240f397fd7f21a29e0c24c7c5f4f1199b56f6cea25.
- No edits to the existing T3, Paperclip or pinned execution-adapter graph.
  Codex remains primary under HARNESS-013. Existing dirty files were preserved.

## Executed checks

- `node --test tools/yellow-harness/providers/tokenharbor.test.mjs`: 9 passed,
  0 failed. Paid/unknown IDs fail before key/network access; finite input/output;
  fixed HTTPS target/no redirects; no retries on authentication/quota failure;
  sanitized errors and credential reflection rejection; no tool execution;
  nonzero reported free-route cost rejection; actual timeout cancellation.
- `node --test windows-secrets.test.mjs` in D:/Yellow/harness/adapters/t3:
  2 passed, 0 failed, including actual Windows CurrentUser DPAPI protection.
- `node --check tools/yellow-harness/providers/tokenharbor.mjs`: exit 0.
- `git diff --check`: exit 0.
- Decryptability plus five-file inspection of connector/test, enrollment,
  public receipt and encrypted blob: 0 plaintext credential occurrences.
  Enrollment used no-echo stdin, not argv/environment/plaintext temporary files.
- Requested configured gpt-5.3-codex-spark reviewer was rejected as unavailable
  by the host. No fallback was spawned. These are parent proofs only.

## Actual provider proof

The explicit supplied key is retained only in the new CurrentUser-DPAPI blob.
It is not reproduced here. The exposure/rotation warning was given before the
founder instructed enrollment; no account-wide key rotation was attempted.

Discovery and one synthetic completion succeeded. Credential-free receipt:
D:/Yellow/harness/state-workspace/artifacts/tokenharbor-connection.json.
Provider timestamp: 2026-09-28T20:02:57.882Z.

Discovered explicit free routes:

- mimo-v2.5:free
- deepseek-v4-flash:free
- deepseek-v4.1-flash:free
- qwen3.8-flash:free
- mimo-v2.6-flash:free

Only deepseek-v4-flash:free was generation-tested. It returned exactly the
fixed TOKENHARBOR_FREE_READY marker, with 34 reported completion tokens.
No private source, client data, key or raw conversation was sent as prompt.
No remaining-quota or dashboard-billing measurement is claimed.

## Supported use and limitations

`enrolledClient()` returns a bounded proposal-only client. A coordinator may
call its `generate({model, prompt, maxOutputTokens})` with an enrolled explicit
:free ID and an authorized public/synthetic prompt. The client never provides
model-selected tools or applies/executes its output. The enrollment keeps
`freeOnly: true`, `paidFallback: false`, and synthetic/public prompt scope.

Native T3's model picker and automatic task routing were not modified. This
order does not establish automated build/review readiness, verified remaining
allowance, Kaggle readiness, private-code retention approval, main-model
migration, review acceptance, installation packaging or full harness completion.
No paid API route, subscription/top-up, public relay, approval weakening,
existing job dispatch, canonical Yellow runtime/database change, PR or merge.
