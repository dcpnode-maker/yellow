# Order 646 — Overwatch AI rehearsal contract

## Scope

- Add a machine-readable Overwatch/Gemini rehearsal for the colleague demo.
- Prove the provider split:
  - non-operational demo guidance can use Gemini when configured;
  - operational PMS prompts never call Gemini and remain locally confirmation-gated;
  - Hindi/Indian-English prompt detection remains visible.
- Keep the route safe: no secret exposure and no PMS execution.

## Out of scope

- Storing API keys.
- Creating or rotating provider credentials.
- Real PMS mutations.
- Public tunnel work.

## Acceptance

- `/api/v1/demo/ai-rehearsal` returns provider status and three prompt rehearsals.
- The route never exposes the API key.
- Tests prove configured Gemini is used only for non-operational guidance with a fake fetcher.
- Tests prove operational prompts do not call Gemini even when a key is configured.
- Readiness/proof evidence points to the AI rehearsal while the demo remains not share-ready until a live configured-key smoke and public URL proof pass.
