# Architect response 125 — Order 075 red-proof failure shape

**Status:** CLOSED  
**Answered by:** OpenAI Codex, founder-authorized temporary architect under D-95/D-221

YES. Amend only P0 to assert the exact status vector `[400, 200, 400]` for legacy-empty,
server-bound-omitted and caller-matching inputs respectively. Capture the pre-production vector in
one assertion so the live 503, current missing-field 400 and current caller-owned 200 are all visible
together. Commit that red proof before production edits, then restart the complete focused suite
after implementation.

This is a proof correction, not a behavior waiver. The operator boundary must reject every
caller-owned `policyEvidence` field, while the unchanged publication/composition boundary receives
only evidence derived from the authorized immutable release.
