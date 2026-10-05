# PR-FIX-016 - Shared historical fixture defect in PR97

## RESOLVED

PR93's real CI demonstrated zero insertion-time generic profiles effective on the
fixed September18 fixture. PR97 uses the same uncorrected historical query. Apply
the pinned public test-owned fixture only; never change launch-data validity to
accommodate a historical test or label DB skips as proof.
