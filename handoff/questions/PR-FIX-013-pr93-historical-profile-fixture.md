# PR-FIX-013 - Current insertion-time profile cannot cover a historical stay

## RESOLVED

CI36499476998 showed `profile=[]` for the fixed September18 housekeeping fixture.
Generic launch extensions correctly begin at insertion time. Preserve that rule
and use the pinned PR86 test-owned, tenant-specific September17-20 profile instead.
No production registry backdating or weaker eligibility checks are authorized.
