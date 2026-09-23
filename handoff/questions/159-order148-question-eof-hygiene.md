# Question 159 — Order-148 correction-record EOF hygiene

**Status:** RESOLVED BY D-411 — CORRECTION READY
**Order:** 148 · post-127 approved integration
**Stopped candidate:** `3d93c7a`
**Related decisions:** D-88, D-410, D-411

## RESOLVED

The D-410 correction removed the Order-148 order-file EOF blank, but its newly added
Q158 record itself ended with one extra blank line. Base-to-candidate `git diff
--check` therefore still failed, now only at Q158 line 26. Remove only that blank line
and require the complete candidate hygiene/provenance/static/database proof to restart
on the next immutable SHA.

No executable, inherited governance, assertion, ancestry or proof-boundary change is
admitted. Stopped-candidate results remain diagnostic only.
