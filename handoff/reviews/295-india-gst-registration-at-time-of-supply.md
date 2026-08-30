# Order 295 independent Tier-3 review

**Reviewer:** fresh non-implementing Codex Tier-3 agent
**Candidate:** `fe6cb55fc1f2d1135a0f0d1b7f928dca0250024c`
**Base:** `92f2036d6153069897ddcbf13a1456b89fd08fb3`
**Result:** CHANGES REQUIRED

## Finding

The candidate has no committed Order295 live PostgreSQL integration test. Its focused
test uses a mocked transaction, so it cannot prove the real schema, RLS, runtime role,
tenant concealment or zero-effect behavior required by the admitted order. Add a real
Order289+294 chain exercised through `yellow_runtime` / `app_role`, then submit a new
exact candidate for fresh executable review.

## Reviewer-executed evidence

- focused/adjacent: 14 passed, 0 failed, 159 assertions;
- standing: 1,028 passed, 871 expected database skips, 0 failed, 15,770 assertions;
- typecheck, 118 import boundaries, 23-package licence policy, audit 0 and diff green;
- independent source and official CGST sections 25/29/30 plus Rule21A inspection found
  no additional product defect;
- Docker Linux engine/required PostgreSQL16.15 was unavailable; host PostgreSQL17 was
  not accepted as substitute proof.

No approval or downstream authority is granted.
