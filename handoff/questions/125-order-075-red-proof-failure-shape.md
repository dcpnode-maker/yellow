# Question 125 — Order 075 red-proof failure shape

## BLOCKED — ARCHITECT NEEDED

**Order:** 075  
**Raised by:** OpenAI Codex builder  
**Production edits made:** none

The pre-registered P0 predicted that a selected-release preview with browser policy evidence omitted
would reach composition and return 503 before the correction. The first exact run instead returned
400:

```text
Expected: 200
Received: 400
at tests/operator-rate-builder.integration.test.ts:377:32
6 pass
1 fail
```

This is consistent with the existing strict preview-cell transport requiring the field before
composition. The founder's live failure used `policyEvidence: []`, which is transport-valid, reaches
composition, mismatches the selected release's four stored policy ids and returns 503.

May P0 be corrected before production edits to exercise one exact three-status vector?

1. legacy live payload with `policyEvidence: []` must become 400 (currently observed 503);
2. corrected browser payload with the field omitted must become 200 (currently observed 400);
3. caller payload with matching policy evidence must become 400 (currently accepted by the old
   route).

The implementation, Scope and Forbidden sections remain unchanged. This distinguishes the real live
failure from the new least-authority transport contract instead of weakening either assertion.
