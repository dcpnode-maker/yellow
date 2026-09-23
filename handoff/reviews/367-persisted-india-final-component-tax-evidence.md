# Order 367 — fresh independent Tier-3 review

**Verdict:** CHANGES-REQUIRED-D1191

**Reviewed product candidate:** `505a6bd2493715af6356de8debd3309adbe78619`

**Reviewed governance candidate:** `7e8fac278faa1aae2da49ce40f2af803113028dd`

**Approved base:** `5a65eb08d36688fce4045d59bbf8a69290c21f35`

**Reviewer:** `/root/order367_fresh_tier3`, fresh independent non-implementing
Tier 3

## Blocking finding

The required complete migration regression remains red. The historical-lineage
case in `tests/migrate.integration.test.ts` expects the migrations applied after its
version-44 fixture to end at
`0069_india_gst_accommodation_quoted_rate_applicability.sql`. The current migration
directory correctly applies Order367 migration
`0070_india_gst_accommodation_final_component_tax.sql` as well, so the exact
`appliedFiles` assertion fails.

Reviewer-personal result: **38 passed, 1 failed, 171 assertions**. The failing case
is `stages historical lineage then applies correction, repair and all India fiscal
evidence exactly once`; the mismatch is the additional valid 0070 filename at
`tests/migrate.integration.test.ts:1624-1650`.

The minimal in-scope repair is to append the exact 0070 filename to that expected
array. No migration, product behavior, schema, authority or other test widening is
indicated by this finding. A new candidate and a fresh independent Tier-3 restart
are mandatory after repair.

## Evidence completed before stop

I read `PROJECT.md`, current state, Order367/D1189, roster/workflow and the complete
Yellow PostgreSQL and compliance skills. I did not implement the candidate.

On a disposable isolated PostgreSQL **16.15** instance, without accessing retained
`.yellow` authority or the stable local stack, I personally obtained:

- migrations 1-70 applied successfully;
- exact catalogue **70/122/112/112/21/2**;
- Order367 focused static/live/intentional-red suite **18 passed, 0 failed, 694
  assertions**, covering first write, exact replay, correction, stale fork,
  absent/foreign applicability, current-head convergence, restricted authority and
  bounded financial writes;
- deterministic seed **10/10 (63 assertions)**;
- app-role non-login containment **5/5 (25 assertions)**;
- runtime database authority **10/10 (88 assertions)**;
- exact migration SHA-256
  `a9eefe19e7d31e71aba55bc88146cbdf1f0b75915c691bbc3dabbe50b627a4f2`;
- exact schema SHA-256
  `dbe66a1797c39f80d160f14f78942822546ec99e9b658166de59922a4383c77a`;
- exact diff/whitespace check green.

An initial acceptance run was invalidated by deliberately committed Order367 fixture
rows and a temporary app-role proof grant sharing that review database; it is not
counted as product evidence. I stopped the remaining approval-only gates once the
independent required migration matrix reproduced the blocking repository failure.

No product, migration, schema, stable database, local app, deploy, merge, push or
credential mutation was performed. Order367 remains unapproved.
