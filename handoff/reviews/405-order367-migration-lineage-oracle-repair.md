# Orders 405/367 — fresh different independent Tier-3 review

**Verdict:** APPROVED-CLOSED-D1194

**Reviewed repair candidate:** `eae6fc0`

**Reviewed governance candidate:** `918d72b`

**Reviewed Order367 product:** `505a6bd`

**Reviewer:** `/root/order405_fresh_tier3`, fresh different non-implementing Tier 3

## Findings

No blocking finding remains. The exact `176fa2a..eae6fc0` repair delta is the
authorized one-line addition of
`0070_india_gst_accommodation_final_component_tax.sql` to the historical
`appliedFiles` oracle, plus Order405 activation governance. The subsequent
`eae6fc0..918d72b` delta is builder-status governance only. Production,
migration0070, schema, setup, authority and every other test remain unchanged.

Migration0070 remains SHA-256
`a9eefe19e7d31e71aba55bc88146cbdf1f0b75915c691bbc3dabbe50b627a4f2`.
The canonical schema remains 830,219 bytes with SHA-256
`dbe66a1797c39f80d160f14f78942822546ec99e9b658166de59922a4383c77a`.

## Reviewer-personal execution

I read `PROJECT.md`, current state, Orders367/405, D1191-D1193 and the complete
Yellow PostgreSQL and compliance skills. I did not implement either candidate.

Using fresh isolated PostgreSQL 16.15 resources with `pg_stat_statements`
preloaded, distinct generated deployment/runtime/registrar credentials and no
retained `.yellow` access, I personally obtained:

- all **39** migration-regression cases green with **182 assertions**, including
  the repaired historical-lineage case;
- migrations 1-70 and exact catalogue **70/122/112/112/21/2**;
- Order367 focused application/database/intentional-red matrix **22/22 (703)**,
  including the original required 18 Order367 proofs;
- canonical database acceptance **23/23 (65)**, deterministic seed **10/10
  (63)**, app-role/runtime authority **15/15 (113)**;
- normalized fresh schema byte-equal at **830,219 bytes** and the exact hash above;
- official isolated `setup.sh --db-only`: 122 tables after migrations 1-70 and
  referee **11 passed, 0 failed of 11**;
- standing suite **1,310 pass, 1,008 expected skips, 0 fail, 19,518 assertions**;
- strict typecheck, **145-file** import boundary, **23-package** licence policy,
  dependency audit with no vulnerabilities and exact diff/whitespace checks green.

An initial parallel seed/acceptance attempt shared cluster-global role state with
another live proof and was invalidated; the affected gates were rerun serially on
clean isolated databases and passed as reported above. It is not product evidence.

Disposable review resources were removed after proof. The stable loopback-3000
application and its Order311 PostgreSQL/provider/Valkey services, retained
`.yellow`, deployment, merge and push were untouched.

Orders405 and 367 are approved and closed. This approves the bounded persisted
final-component-tax evidence only; it does not itself complete Phase7 or authorize
local promotion, deployment, merge or push.
