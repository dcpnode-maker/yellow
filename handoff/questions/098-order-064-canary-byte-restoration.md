# Question 098 — Order 064 canary byte restoration

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 064  
**Observed:** both +/- one snapshot canaries made the exact drift assertion red, but after textual
restoration `src/project-status.ts` did not match its pre-canary SHA-256. Current inspection shows
canonical LF bytes and the static proof is green, but the cause of the one-time byte difference is
not independently established. The first canary run therefore cannot satisfy the byte-identical
restoration requirement.

May the proof record the first run as invalid, take the current compiler/static-green LF file as a
new explicit SHA-256 baseline, repeat both mutations separately, restore through the same patch
mechanism, and accept P3 only if the final hash equals that new baseline exactly?

## Answer

Yes. Do not claim the first run. Re-run typecheck/static proof before the new baseline, repeat each
counter canary separately, and require the final SHA-256 to match. If it differs again, stop without
further normalization or standing checks.

