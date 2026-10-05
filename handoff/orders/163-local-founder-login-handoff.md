# Order 163 — Persistent local founder login handoff

**Status:** READY — human-testing credential availability
**Phase:** 5 · human-testable application
**Branch:** `phase-5/local-founder-login-handoff`
**Base:** `fed39eb`
**Approved executable:** `a4178ce4b3bdf1fd95b097439287802a1edb7f8c`
**Approved image:** `sha256:83a51f63ff284cab011b3405429ff3fda74bc6fc05251dbf591f271bf2433665`
**Risk tier:** 2 — reversible loopback-only credentialed local cutover
**Owner:** Codex operations; independent post-cutover verification

## Outcome

Keep the exact approved application while making its local review login persistently
available to the founder. Build a fresh parallel local database with one securely
stored distinct operator/approver password pair, verify on staging, then replace ports
3002 and 3000 one at a time without taking both human-test surfaces down.

## Scope

- local project `yellow-order163-local-founder-login`: PostgreSQL 5643, Valkey 6590,
  staging apps 3100/3102, then loopback 3000/3002;
- exact already approved image and executable above;
- ignored owner-only `.yellow/order163-founder-login.env` containing only
  `YELLOW_REVIEW_PASSWORD` and `YELLOW_REVIEW_APPROVER_PASSWORD`;
- this order, additive D-430, ledger and independent operational review.

No product, test, migration, schema, role, permission, UI, status, dependency or old
database mutation is in scope.

## Required behavior and proof

1. Generate the two distinct strong passwords once; atomically create the ignored file,
   disable inheritance/restrict it to the current user and SYSTEM, and never print,
   commit, log or transmit either value.
2. Create a fresh parallel stack while current 3000/3002 remain healthy. Run all
   migrations, fresh referee 11/11, normal seed and governed review seed.
3. Start two distinct containers from the exact approved image on 3100/3102. Prove
   loopback-only health, image/revision identity and full redacted authenticated
   Party → offer → hold → commit/replay → confirmation journeys.
4. Replace 3002 first while 3000 stays live; verify. Replace 3000 second while 3002
   stays live; verify. On either failure restore its retained Order161 container.
5. Independently repeat authenticated proofs on both final ports by reading the private
   file without printing it. Keep the file after review for founder use; clear process
   copies only.
6. Preserve all Order161 and Order147 app/image/database/Valkey/network/volume rollback
   resources. No public bind, row deletion, merge, push or irreversible cleanup.
7. Founder handoff is URL `http://127.0.0.1:3000`, hotel account `yellow-demo`,
   email `operator@yellow.local`, the private file path and a no-output clipboard
   command. Never place the password value in chat.

## Definition of done

- [ ] Staging and both final ports pass exact image, health and full CRUD journeys.
- [ ] Founder credential file is ignored, owner-only, persistent and independently used.
- [ ] Both final ports remain available and all prior rollback stacks are retained.
