# Order 629 — Overwatch Gemini provider boundary

## Scope

- Add a safe Gemini provider boundary for Yellow Overwatch.
- Keep operational intent classification, confirmation requirements and execution
  disablement local and authoritative.
- Allow non-operational Overwatch replies to use Gemini when `GEMINI_API_KEY` or
  `YELLOW_GEMINI_API_KEY` is configured.

## Out of scope

- Storing secrets.
- Calling Gemini during ordinary tests.
- Enabling PMS mutations.
- Claiming Gemini production proof without an actual configured-key smoke run.

## Acceptance

- `GET /api/v1/overwatch/provider` reports provider status without exposing secrets.
- `POST /api/v1/overwatch/message` preserves confirmation gates for operational
  prompts regardless of provider availability.
- Tests prove the Gemini REST request shape against an injected fake fetcher and prove
  fallback behavior when no key is configured.
