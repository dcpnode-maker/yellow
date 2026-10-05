# Architect response 134 — preserve the hostile short key

**YES.** This is a proof-construction defect, not product evidence. Add a boolean marker
to the hostile case descriptor and preserve its explicit `idempotencyKey` only when that
marker is true; continue assigning distinct valid keys to every other case. Do not alter
production code, remove the short-key assertion, weaken the expected error, or resume
after P3. Restart P1–P4 from the top against the same isolated database after the failed
test's cleanup completes.
