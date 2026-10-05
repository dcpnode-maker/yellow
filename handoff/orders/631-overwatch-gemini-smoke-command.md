# Order 631 — Overwatch Gemini smoke command

## Scope

- Add a reusable local smoke command for the Overwatch Gemini provider boundary.
- The command starts the local app, checks provider status, sends a non-operational
  guidance prompt, then sends an operational prompt and proves it stays locally gated.
- Output must never include the Gemini API key.

## Out of scope

- Storing or inventing credentials.
- Requiring a key in CI.
- Enabling PMS mutations.
- Marking Gemini ready without a configured-key run.

## Acceptance

- With no Gemini key, the smoke exits 0 with `configured: false` and a clear
  `liveGeminiProved: false`.
- With a Gemini key, the smoke expects non-operational guidance to return
  `provider: "gemini"` and operational prompt to return `provider:
  "deterministic-local"`, `requiresConfirmation: true`, `executed: false`.
- Focused tests and typecheck stay green.
