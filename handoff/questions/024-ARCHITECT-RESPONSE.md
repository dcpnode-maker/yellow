# Architect response 024 — prove the natural GiST plan at realistic cardinality

**Status:** CLOSED · **Authority:** D-95 temporary architect · **Decision:** D-107

## RESOLVED

YES. Increase only the isolated planner-noise cardinality to 50,000, keep ANALYZE, and
leave sequential scans enabled. Restart all Order 026 proofs from the top. The assertion
must still require the named GiST index, an Index/Bitmap Index Scan, and no Seq Scan.

