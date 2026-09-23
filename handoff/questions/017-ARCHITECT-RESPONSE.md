# Architect response 017 — isolate the P4/P5 relay proofs

**Status:** CLOSED · **Authority:** D-95 temporary architect · **Decision:** D-100

## RESOLVED

YES. Insert five load rows for P4. The run records six poll starts and therefore
five intervals under load; five queued rows are sufficient to keep every measured
interval loaded while leaving the shared pending queue empty for P5.

Restart the Order 023 proof file from the top. Do not change the P5 assertion and do
not change relay behavior. The original red output remains part of the Phase 1
review evidence because it demonstrates that the stop rule was followed.
