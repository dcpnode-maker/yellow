# Order 359 / Order 351 decision-time and proof repair — fresh Tier-3 review

**Disposition:** WITHHOLD

**Reviewer:** `/root/order359_review_fast`, fresh independent non-implementing Tier-3

**Exact repair inspected:** `986f4daae008a5e0e3c4372329979931c07c01eb`  
**Exact governance inspected:** `d57b9fd2b87854fc5999d536e6742161f62a3f44`  
**Repair parent:** `662e30d83362f079acd33690eb883f86259b3bfb`

## Isolation and provenance

Review execution uses disposable detached worktree
`C:\Users\astha\AppData\Local\Temp\yellow-order359-fast-review` at exact governance
`d57b9fd`. The existing local application, stable port 3000, canonical `.yellow`, and
unrelated dirty worktrees are excluded.

## Code inspection

- The production repair is exactly one predicate in migration 0063:
  `NOT (a.decided_at <= transaction_timestamp())`. This correctly rejects NULL,
  future, and non-comparable decision instants while retaining PostgreSQL transaction
  time as authority. The expected schema and migration checksum were updated in lockstep.
- Scope is five paths: migration 0063, the new permanent integration suite, the
  focused source assertion, database-acceptance checksum, and expected schema.
- The committed suite contains eight PostgreSQL tests, but inspection finds that its
  names and D-1021 summary overstate several required proofs. The rollback test injects
  only event-publication failure, not failure after every transition/fact/event/deferred
  boundary. The twenty-contender test uses a fresh random idempotency key on every call,
  so it does not prove same-key contention despite saying so. Tenant/property/room/
  discrepancy/day/approval/actor/source/target hostility is not complete; inactive
  approver is not exercised. Financial proof compares only counts for journal,
  posting_line, payment, and document, rather than byte-identical journal/posting/
  folio/payment/document/tax/balance state. Direct-DML proof attempts only one carry
  INSERT and does not itself establish the complete raw mutation/ACL matrix or hostile
  `pg_temp` resistance.

These are executable-proof coverage findings against Order 359 required proof 2–4
and Order 351 hostile proof 3–8. They remain disposition-blocking after reviewer
execution of the hostile suite and priority repository gates below.

## Reviewer-executed gates

- Fresh PostgreSQL 16.15 migration on isolated Compose project
  `yellow-order359-fast-review`, port 5491: migrations 1–63 applied successfully in
  one backend (`applied=63`, transaction PID 249 for the fresh referee database).
- Permanent Order359 hostile suite with required database/runtime URLs:
  **8 passed, 0 failed, 47 expectations**. This confirms the implemented predicate
  kills the future-decision bypass and that the cases actually encoded by the suite
  pass. It does not cure the code-inspection coverage gaps above.
- Independent catalogue query: exactly **63 migrations / 116 public tables / 106 RLS
  tables / 15 FORCE-RLS tables / 2 views**.
- Fresh separately migrated and fixture-seeded `yellow_referee` database: invariant
  referee **11 passed, 0 failed of 11**, including occupancy races/direct-DML denial,
  journal balance, sealed-day rejection, gapless numbering, table RLS and both
  security-invoker views.

The required hostile-proof coverage finding is disposition-blocking because passing
tests cannot prove cases they do not execute.

## Additional reviewer-executed gates

- Deterministic bootstrap seed: applied cleanly.
- Fresh clean review-seed database: **24 passed, 0 failed, 111 expectations**. An
  earlier attempt after manually using a noncanonical approver-password shape is
  excluded; the cited result is from a newly created, migrated, bootstrap-seeded
  database and uses the test's canonical derived approver secret.
- Runtime-DML authority: **5 passed, 0 failed, 120 expectations**.
- SECURITY-DEFINER containment: **3 passed, 0 failed, 192 expectations**.
- Focused source/contract suite: **2 passed, 0 failed, 11 expectations**.
- TypeScript check passed; import boundaries passed across **139** files; licence
  policy passed for **23** packages; dependency audit reported zero vulnerabilities;
  exact repair diff hygiene passed; live schema matched `tests/schema/expected.sql`.
- Clean database acceptance: **23 passed, 0 failed, 65 expectations**.
- Standing suite at the repository default five-second timeout produced one inherited
  Order239 timing failure (the slow case completed in 6.31 seconds). The exact focused
  file passed **8/0** with a 30-second timeout, and the complete standing rerun with the
  same 30-second timeout passed **1216/0**, with **934 expected database skips** and
  **18,514 expectations** across 399 files.
- The separately started full migration integration command did not reach a final
  result in the available review window after its first four cases passed; it is not
  represented as green and was terminated during disposable-resource cleanup. Fresh
  migrations 1–63 were nevertheless executed successfully on three reviewer-created
  databases, including the referee and review-seed databases.

## Final finding and required repair

Order359/351 remains **WITHHELD** at exact `986f4da` / `d57b9fd`. The production
decision-time predicate behaves correctly, but the permanent proof does not satisfy
the explicit hostile matrix required for this high-risk irreversible transition.
Repair the permanent suite so it actually executes, with mutation-sensitive
assertions:

1. injected failure after every transition/fact/event/deferred-commit boundary and
   one clean retry after each;
2. true same-idempotency-key contention as well as distinct-key/two-approval races;
3. the complete tenant/property/room/discrepancy/day/approval/actor/source/target,
   inactive-decider and reuse matrix;
4. byte-identical pre/post journal, posting, folio, payment, document, tax and balance
   truth rather than four table counts; and
5. the complete raw mutation/ACL and hostile-`pg_temp` authority proof attributable
   to this capability/table.

A different fresh non-implementing Tier-3 reviewer must then personally rerun the
repaired hostile suite and every required full gate. This review grants no carry,
readiness, seal, reopen/roll, financial mutation, local, merge, push, deployment,
Phase-5 or application-completion authority.
