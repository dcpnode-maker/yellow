# Order 620 — Overwatch confirmation gate runtime slice

## Scope

- Add a bounded Overwatch runtime endpoint to the thin server checkout.
- Support simple multilingual operator prompts for English and Hindi/Indian English.
- Detect operational PMS intents and require explicit confirmation before any execution.
- Keep execution disabled until real workflow services and Gemini provider proof are wired.

## Out of scope

- Calling Gemini or any hosted model.
- Performing PMS mutations.
- Adding schema, migrations, runtime credentials, public-demo data, or live deployment changes.
- Claiming the colleague demo is ready.

## Acceptance

- `POST /api/v1/overwatch/message` accepts a plain prompt and returns a deterministic response.
- Non-operational prompts return guidance without requiring confirmation.
- Operational prompts return `requiresConfirmation: true`, `executed: false` and a confirmation phrase.
- Even with a confirmation phrase, execution remains disabled with an explicit reason until governed workflow services are connected and proved.
- Tests cover English and Hindi/Indian English examples and prove no false ready/Gemini/execution claim.
