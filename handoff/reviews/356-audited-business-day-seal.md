# Order 356 audited business-day seal — fresh Tier-3 review

**Disposition:** APPROVE

**Reviewer:** `/root/order356_tier3_review`, fresh independent non-implementing Tier-3

**Exact candidate:** `b5a5fae1def756a16d3e8709d72fe4606adebf75`

## Scope and static audit

The reviewed change adds only migration0064's bounded audited seal capability, the
financial service/export, directly affected tests/oracles, seal documentation and
governance. The candidate creates one function and leaves the post-migration catalogue
at 64 migrations, 116 public tables, 106 tenant-RLS tables/policies, 15 FORCE-RLS
tables and two views. The migration checksum is bound by both migration and acceptance
oracles.

The reviewer independently normalized the complete mutable readiness fragment from
`BusinessDayCloseReadinessService` and migration0064; after removing only schema
qualification and parameter spelling, the fragments are byte-equivalent. The fixed
lexical 18-relation lock list covers every mutable authorization/readiness dependency
reported by the SECURITY DEFINER dependency oracle. D1067 explicitly narrows authority
to the exact granted property and replaces lock-upgrading SHARE with fixed-lexical
SHARE ROW EXCLUSIVE, preserving D1066's direct actor and same-transaction policy.

The service accepts no readiness/time/force/payload authority, validates fresh and
stored receipts to an exact bounded shape, derives the seal instant from PostgreSQL,
and places idempotency, fact and canonical version-1 event in the caller transaction.
The legacy seal remains unavailable to the app/runtime, and direct day/fact/outbox
mutation remains denied.

## Reviewer-executed proof and findings repaired

Review used Windows-native Bun 1.3.14 and a fresh disposable PostgreSQL 17.2 cluster
on E:, with no Docker, stable local or WSL execution. The native migration runner
applied migrations 1–64 in one exact ledger. The first proof attempts exposed and
withheld approval for four real issues: missing permission fixture registration,
generic Bun error-code selection masking SQLSTATE, PostgreSQL date decoding, and
descendant-property authorization; the concurrent SHARE lock-upgrade deadlock was also
reproduced. Candidates successively repaired each issue, and D1067 records the
authorization/serialization amendment rather than silently rewriting D1066.

On exact final candidate `b5a5fae`, the combined unit and real-database seal proof
passed **15/0 with 150 assertions**. It personally proved:

- exact fixed lock set and same-transaction readiness execution;
- owner/search-path/function ACL, legacy capability denial and direct
  business-day/fact/outbox DML denial;
- database-authored exact-property seal plus one minimized fact and one canonical
  event, with byte-stable replay and no duplicate effect;
- unknown due-in attribution, typed blocker, inactive/unauthorized/foreign actor,
  different property, missing day and tenant hostility all fail closed;
- twenty distinct keys yield exactly one winner, while twenty identical-key calls
  yield one effect and nineteen byte-equivalent replays;
- a real unpublished ARI event writer wins serialization and prevents sealing; and
- injected event failure rolls back latch, fact, event and idempotency before a clean
  retry succeeds.

Live catalogue queries returned `64` migration rows, `116` public tables and exact
`yellow_owner|true|search_path=pg_catalog, public, pg_temp` capability authority.
The focused SECURITY DEFINER suite passed **3/0**, including hostile `pg_temp`, exact
least execute authority and dependency containment. The paired acceptance/containment
run was **24/2 (274 assertions)**: every migration ledger, catalogue, ownership and
Order356-relevant assertion passed; the two failures were expected harness facts for
this reviewer-only environment (native PostgreSQL 17.2 rather than canonical 16.15
with preload, and deliberately no canonical demo seed). They are not candidate
failures and were not used to waive any Order356 assertion.

All reviewer PostgreSQL servers were stopped. No WSL crash dump was created. The host
policy rejected recursive cleanup of the exact verified stopped GUID directories, so
the following disposable, non-running paths remain for founder/build-owner cleanup:
`E:\yellow\order356-review-2adf985831ae45de9dc88e29895fa28a`,
`E:\yellow\order356-review-8e92266417f541a29af18f643b83c948`,
`E:\yellow\order356-review-1f477d69ca2f4b4dbd0357311169045a`,
`E:\yellow\order356-review-abe49f9a03a24e24827ae32bb31a4bc9`, and
`E:\yellow\order356-review-c48b4f64db53449b95e4cf6d2f105099`.

## Verdict

Order356 is **APPROVED** at exact candidate
`b5a5fae1def756a16d3e8709d72fe4606adebf75`. This approval covers only the bounded
audited application seal command. It grants no API/UI/local promotion, auto/batch
seal, reopen, deployment, merge, Phase-5 or application-completion authority.
