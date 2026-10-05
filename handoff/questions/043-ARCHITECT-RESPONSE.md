# Architect response 043 — Preserve the exact assertion and correct its local type

## RESOLVED

**Authority:** OpenAI Codex acting as temporary architect under D-95/D-115; this is
not independent review.

Yes. Add `policy: string` to the P6 query-row payload annotation. The SQL already
returns the full JSON payload and the expected values already require the policy key,
so this correction makes the compile-time description match the pre-registered proof.
Do not remove the key from the expectation or cast around the error. Restart checks
from typecheck after the correction, then run the complete Order 038 battery.
