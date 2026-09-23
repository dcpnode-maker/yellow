# Question 059 — Order 054 proof payload and claim scope

## Trigger

The first implemented focused run returned 4 pass / 2 fail. Product behavior reached
the expected final policy with two facts and two events, and the injected publisher
failure returned 503 with config and evidence rolled back. Two proof queries were
incorrect:

1. P3 compared the entire audit payload to an object that omitted the domain-generated
   `request_id`, so the exact transition row counted zero despite the recorded payload
   containing the required policy, previous and value fields.
2. P5 counted every successful claim created by P2/P3 instead of the claim for
   `order054-failure`, so it received three rather than proving the failed key absent.

## Proposed correction

Keep all product code and expected behavior unchanged. Change P3's payload predicate
from equality to JSON containment for the three business fields. Hash the fixed P5
idempotency key with the same SHA-256 operation used by `PostgresIdempotency` and count
only that key. Recreate the database and restart the complete six-test file.

## Hard-floor status

No implementation or proof correction followed the assertion failures. Temporary
architect response required under D-92.
