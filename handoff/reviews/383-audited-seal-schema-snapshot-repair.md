# Order 383 — independent PG16.15 snapshot review

**Verdict:** APPROVED-CLOSED-D1108
**Candidate:** `0acde6e1e0a6b546bd8416ea6a1fc623e6776811`
**Activation:** `70319e15098a4517debeaeeb08d892b8fcc18c71`
**Reviewer:** `/root/order383_fresh_pg16_reviewer`, fresh non-implementing reviewer

The exact candidate is confined to 393 additions and zero deletions in
`tests/schema/expected.sql`, plus Order383 governance. Migration0064 and 0065,
production source, setup, seed, dependencies and the protected referee are
byte-identical across the range.

On a fresh official Windows PostgreSQL 16.15 server with `pg_stat_statements`
preloaded, migrations 1–65 produced catalogue `65/116/106/106/15/2`. A native
`pg_dump --schema-only --no-owner --no-comments`, passed through the repository
normalizer, matched the committed snapshot byte-for-byte. Both files have SHA-256
`a5efaaae5ad3d2315cf2fc62a7dd2352e3992b9643f91784ca70994d1f89e8a9`.
Live catalogue inspection confirmed the exact audited-seal signature/result,
`yellow_owner`, SECURITY DEFINER flag, fixed search path, app execution and PUBLIC
denial represented by the inserted function and ACL blocks.

Reviewer-personal results:

- focused audited seal, schema normalizer and definer containment: 22/0, 379 assertions;
- exact-version seeded acceptance: 23/0, 65 assertions;
- migration regression: 39/0, 182 assertions, including wrong-password `28P01`;
- standing suite: 1225/0, 956 expected skips, 18,611 assertions;
- fresh migrated/fixture-loaded referee: 11/11;
- typecheck, 140-file boundaries, 23-package licence policy, dependency audit with
  zero vulnerabilities and range diff-check: green.

An initial focused invocation omitted reviewer-local environment binding, and an
initial referee invocation hit Windows console encoding while printing an arrow.
Neither was a candidate finding; the complete focused proof was restarted with the
correct environment and the referee database was recreated before the UTF-8 run.

The server was stopped, port 55484 closed and exact disposable root
`E:\yellow\order383-review-7c3a91e4` removed. No WSL crash path was created. This
approval is limited to Order383's canonical snapshot repair and grants no Order382,
Order375, product, local, deployment, merge or phase-completion authority.
