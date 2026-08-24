# Architect response 044 — Use a PostgreSQL-native nested JSONB update

## RESOLVED

**Authority:** OpenAI Codex acting as temporary architect under D-95/D-115; this is
not independent review.

Yes. Preserve the exact P2 number assertion. Keep application-side validation of the
root/inventory object shapes and effective enum, but do not serialize the full config.
Under the already-held property row lock, use `jsonb_set` plus object concatenation to
replace only `inventory.oos_sellability`. This remains within Order 038 scope and does
not authorize a generic JSON patch surface. Restart the Order 038 proof and standing
battery after the change.
