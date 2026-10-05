# Question 111 — Order 068 evidence fixture literal widening

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 068

The first implemented compiler gate stopped before assertions because P4's local restriction and
operational-block arrays widened their `kind` literals to `string`, while the returned composition
contract correctly exposes closed unions. May the test import the two exported evidence types and
annotate only those local arrays before restarting typecheck and the complete focused file?

## Answer

Yes. Type only the two test fixtures as `readonly RateRestrictionEvidence[]` and
`readonly RateOperationalBlockEvidence[]`. Do not cast production output, widen the evidence kinds or
change runtime normalization. Restart the compiler and all seven focused proofs.
