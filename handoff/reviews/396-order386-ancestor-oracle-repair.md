# Orders 386/396 — fresh independent Tier 3 review

**Verdict:** APPROVED
**Base:** `c711f10fd058775dee41f7d53bff33733030492f`
**Order 386 product commit:** `696f472f3601b8d3dbf5fa6a985466a9577460ca`
**Repair governance:** `5fcb55df307c991bcb2966421d17603df93094c3`
**Executable candidate:** `f30a7425aa8b21b2888982daa84ec328673d1388`
**Reviewer:** `/root/order396_fresh_tier3`, fresh non-implementing Tier 3

I independently approve the Order 396 ancestor-oracle repair and the complete
Order 386 owner-trust expense workbench it proves. I read `PROJECT.md`, current
`state.sh` truth, Orders 386/396, D1158-D1162, the complete
`yellow-compliance-rules` skill, the Phase 5 plan, roster and workflow before
reviewing or executing proof.

## Exact ancestry, scope and diff

The ancestry is exact: base `c711f10` -> Order 386 product `696f472` -> repair
governance `5fcb55d` -> executable candidate `f30a742`. The Order 386 product
diff is the declared 31-file, 1,150-insertion/20-deletion surface. Its only
production mutation capability added is migration 0068's read-only preparer;
the existing, previously approved Order 344 posting capability remains the
sole journal writer.

The Order 396 executable diff `5fcb55d..f30a742` contains one D1162 line, one
ledger line, Order 396 evidence/status text and exactly these three one-line
test-oracle replacements:

- `tests/operator-business-day-seal.integration.test.ts`: the constructor tail
  now includes the thirteenth `ownerTrustExpenses` dependency;
- `tests/operator-reservation-travel.integration.test.ts`: the same constructor
  tail repair;
- `tests/operator-flagship-motion.test.ts`: the intentional workspace-domain
  icon count changes from 10 to 11.

Each repaired test has numstat `1/1`. There is no Order 396 byte change in
`migrations/`, `src/`, `docs/`, `scripts/`, `setup.sh`, `package.json`,
`bun.lock` or `tests/schema/expected.sql`; `git diff --check` is clean. Manual
inspection confirms the three replacements match the Order 386 production
surface and are not weakened assertions.

## Reviewer-personal database proof

I used a newly initialized official Windows PostgreSQL **16.15** cluster on
loopback port 55696. Host authentication was SCRAM, password storage was
`scram-sha-256`, `pg_stat_statements` was preloaded, and a wrong password was
personally rejected. Migrations 1-68 applied to a fresh database. Personally
executed results were:

- migration regression **39/0 (187 assertions)**, including the redacted wrong
  credential path preserving SQLSTATE **28P01**;
- canonical seed followed by database acceptance **23/0 (65)**;
- review seed **25/0 (113)**;
- schema normalizer/current-catalogue proof **5/0 (25)**;
- native PG16.15 normalized schema byte identity, actual and expected SHA-256
  `19c4bc53cd78703b97b935d40c6566b538bc6dde65ad74ca4ba109243e475b71`;
- migration 0068 SHA-256
  `19eedaa18ae6816825535c98a794c5fa0ed420c4c12776f960183dced1966884`;
- separately fresh, migrated and fixture-loaded referee database **11/11**;
- runtime database authority **10/0 (88)** with the exact deploy identity tuple.

The first acceptance probe was intentionally before canonical seed and reported
the absent demo tenant; seeding then produced the clean 23/0 acceptance result.
The first runtime-authority probe exposed that my temporary deploy role omitted
the repository's Docker-equivalent `REPLICATION BYPASSRLS` attributes; correcting
that reviewer setup produced the exact 10/0 result. Neither was a candidate
failure.

## Order 386 and standing proof

The seven exact Order 386 files passed **18/0 (113 assertions)**, including real
Chromium at 390 and 1280 pixels across all six approved appearances. The owner
trust database/domain foundation, workbench and runtime-DML suites passed
**17/0 (168)**. Together they exercised exact input and signed-int64 bounds,
control/bidi/normalization-hostile reasons, tenant/property/actor/account/owner/
route/currency concealment, minimized responses, zero-write previews, bounded
MAX+1 failure, exact server-derived evidence, maker/checker separation, pending/
rejected/expired/self/foreign/wrong-kind/wrong-subject/wrong-payload/stale/reused
approval denial, replay/change conflict, concurrent requests/posts, two-spender
serialization, seal races, late-failure rollback, runtime DML denial, journal
balance and privacy.

The three repaired ancestor files passed **13/0 (118 assertions)**. The complete
operator sweep (142 `operator-*` files plus the operator discrepancy-carry file)
passed **546/0**, **124 expected skips**, **5,963 assertions across 143 files**.
The complete standing suite then passed **1,287/0**, **996 expected skips**,
**19,023 assertions across 426 files**. TypeScript passed; import boundaries
passed for 143 TypeScript files; the 23-package licence policy passed; production
dependency audit reported zero vulnerabilities.

The candidate was exported byte-for-byte from Git because the shared checkout
was a later, unrelated and dirty `main`. The first standing run's only two
failures were archive-provenance tests invoking `git show`; attaching the
candidate export to the repository's read-only Git object database and rerunning
the exact complete suite produced the 1,287/0 standing result above. This was an
isolation-harness correction, not a candidate failure.

## Complete production mutation map

| Surface | Mutations and authority |
| --- | --- |
| account discovery / approval inbox | SELECT-only, exact tenant/property and active permission joins; bounded MAX+1 fails complete rather than truncating |
| expense preview | `prepare_owner_trust_expense` only selects and takes deterministic transaction locks; no row mutation |
| approval request | one `api_idempotency` claim/completion, one `approval_request` insert, one immutable `fact_log` row and one `approval.requested` outbox row |
| approval approve/reject | one `api_idempotency` claim/completion, the permitted `approval_request` status/decider/timestamp transition, one immutable `fact_log` row and one `approval.decided` outbox row |
| expense post | one `api_idempotency` claim/completion; the existing SECURITY DEFINER capability inserts one `journal`, exactly two balanced `posting_line` rows and, only when projected trust is negative, one immutable `trust_negative_authorization`; service then inserts one immutable `fact_log` row and two outbox rows (`journal.posted`, `trust.owner_expense_posted`) |

All mutations above receive the middleware-owned `context.tx`; no nested
transaction is opened. The workbench re-prepares financial truth under the
canonical financial lock order, then locks the approval, and the database
capability revalidates active maker/checker authority, exact property/account/
owner/payable/currency/route, exact payload, one-use approval, open business day
and signed-int64 balance before any financial insert. A late capability, fact,
outbox or idempotency-completion error rolls the whole transaction back.

Adversarial inspection mapped every security-relevant branch to executable
proof: changing the account/approval bounds, tenant or exact-property joins,
actor/scope checks, request shapes, header-only idempotency, minimized response,
lock order, exact payload comparison, self-approval exclusion, one-use check,
business-day seal check, balanced lines, DOM stale-generation guards, retry-key
retention, confirmation/focus or server-derived action flags breaks a personally
executed assertion. The repair's three ancestor assertions each also fail if its
corresponding production addition is removed.

No product, test, migration, schema, seed, stable local, `.yellow`, Docker,
port 3000, deployment, merge or push surface was changed by this reviewer. Only
this order-authorized review record was added; governance closure remains
root-owned.
