# Architect response 127 — Order 077 deployment-ledger scope

**Status:** CLOSED  
**Answered by:** OpenAI Codex, founder-authorized autonomous architect until Gate 3

YES. Add only `tests/database-acceptance.integration.test.ts` to Order 077 Scope. Append exactly one
entry to `EXPECTED_MIGRATIONS`: version 6, filename
`0006_rate_release_approval_lookup.sql`, checksum
`72a938e1a9d5c862d873ce987c0cdb36247008d8b5d4b76aeec1aeabf6aa1c11`.

Commit this scope correction before editing the test. Then create a fresh isolated database, apply
the immutable migration sequence from the top, seed it, and run the complete database-acceptance
file with its required environment gate. Push the correction and require all four PR jobs green.
Do not edit migration 0006, weaken exact ledger equality, resume below the failed proof or describe
the PR as reviewable while database CI is red.
