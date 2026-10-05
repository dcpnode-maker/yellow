# Order 661 — Evidence-based demo readiness

## Intent

Stop reporting stale readiness gates after the governed PMS command surface has been completed. The public demo should remain honest, but readiness should be derived from current evidence instead of permanent `false` constants.

## Scope

- Public runtime proof distinguishes public HTTPS access from public mobile access.
- Proof bundle accepts current public/mobile/Gemini evidence and removes the obsolete governed-command blocker.
- Share packet derives status and notification policy from the proof bundle.
- Readiness route can report ready only when every requirement is proved by current runtime evidence.

## Out of scope

- Exposing secrets.
- Notifying the founder before final verification.
- New PMS mutations, schema changes or external OTA/payment integrations.
