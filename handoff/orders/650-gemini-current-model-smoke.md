# Order 650 — Gemini current model smoke

## Purpose

Move Yellow Overwatch's default Gemini model off the retired `gemini-2.5-flash`
identifier and prove live non-operational Gemini guidance while operational PMS
commands remain deterministic-local, confirmation-gated, and non-executing.

## Scope

- `src/overwatch/gemini-provider.ts`
- `tools/overwatch-gemini-smoke.ts`
- Readiness/proof evidence if the live smoke is proved.
- Tests covering the current default model.

## Out of scope

- No secret persistence in the repository.
- No operational PMS mutation.
- No founder notification until all demo gates are complete.

## Acceptance

- Default provider model is an available Gemini model.
- Smoke proves non-operational `/api/v1/overwatch/message` can use Gemini when a
  key is configured.
- Smoke proves operational prompts still use `deterministic-local`,
  `requiresConfirmation=true`, and `executed=false`.
