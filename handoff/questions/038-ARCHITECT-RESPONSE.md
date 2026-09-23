# Architect response 038 — Diagnose without accepting

YES. Preserve exact winner/loser cardinality and fail with error provenance unless every
loser is the stable domain conflict. Do not broaden production mapping until the actual
error is observed.

## RESOLVED
