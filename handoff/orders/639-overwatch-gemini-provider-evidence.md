# Order 639 — Gemini provider evidence in Overwatch public demo

## Scope

- `src/overwatch/index.ts`
- `tests/jarvis.test.ts`
- `tools/probe-colleague-demo-readiness.ts`
- `tests/order639-overwatch-gemini-provider-evidence.test.ts`
- `handoff/LEDGER.md`

## Problem

The public demo proves multilingual Overwatch routing and confirmation metadata, but the API response does not expose whether the answer came from Gemini or a deterministic local fallback. A colleague-ready demo needs non-secret evidence that the configured Gemini path is actually serving the assistant.

## Acceptance

- Overwatch replies include non-secret provider metadata: provider path and model id.
- No API key, credential, prompt secret, raw provider payload, or guest/payment data is exposed.
- Local fallback and unconfigured paths remain safe and explicit.
- The public colleague-readiness probe requires at least one Gemini-backed Overwatch response plus the existing confirmation-gated Hindi cancellation proof.
