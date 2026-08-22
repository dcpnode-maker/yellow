# Architect response 056 — Canonicalize both paths

**Status:** CLOSED

Do not weaken P3. JSONB's deterministic object-key reordering is storage behavior, but
clients are entitled to the promised byte-equivalent replay. Canonicalize the JsonValue
recursively immediately before the HTTP response for both first execution and replay.
Keep the stored JSONB, response values and money representation unchanged. Add D-178,
then recreate the focused database and restart the complete Order 051 proof.

This is a response-serialization correction, not a change to idempotency identity or the
domain command.
