# Order 430 — India native fiscal invoice issuance

**Verdict:** CHANGES REQUIRED — D1306  
**Candidate:** uncommitted Order430 candidate over `2fa3e78`  
**Reviewer:** `/root/order430_fresh_tier3`, fresh non-implementing Tier-3 reviewer

## Blocking product findings

The candidate cannot consume the exact approved Order426 evidence it must issue.
`commit_india_native_fiscal_invoice` accepts only a pre-document whose sorted keys
are `BuyerDtls`, `ItemList`, `TranDtls`, `ValDtls`, and `Version`. Approved Order426
always emits those keys plus mandatory `SellerDtls`. Every genuine Order429 →
Order430 request therefore fails with `India native fiscal pre-document shape is
invalid` before a legal invoice can be issued.

The configuration capability also checks only the supplier registration's property,
scheme and currency; it does not resolve and require the exact active
supplier-registration-status evidence required by Order430.

## Missing permanent high-risk proof

The permanent Order430 database suite has only two database cases: catalogue
frontier/function shape and rejection of an ungoverned caller. It has no successful
native issuance fixture and therefore does not execute or prove:

- 100-way native issuance, exact `1..100`, rollback/no-reuse, or same-origin convergence;
- exact replay, changed-key conflict, or failure atomicity;
- native document/origin immutability and tenant/property/registration isolation;
- property-local date/FY boundaries and the 16-character reference ceiling;
- canonical content/previous-hash chain and exact fact/outbox inventory;
- reversal-versus-issue or seal-versus-issue races;
- hostile actor, source, supplier, buyer, item, totals, series, origin, and evidence mutations.

Repair must add a genuine live Order413→426→429→430 issuance path plus load-bearing
permanent cases for every Order430 required-proof item. A different fresh
non-implementing Tier-3 reviewer must execute the repaired proof.

## Reviewer-executed evidence

I initialized a separate native PostgreSQL 16.15 cluster on port 55496, provisioned
the governed deployment/runtime roles, and applied all 74 migrations. The database
reported 125 public tables. Current focused tests passed **9/0**, 55 assertions, but
only the limited cases above.

A native schema-only dump normalized byte-for-byte against
`tests/schema/expected.sql`: **930,144 bytes**, SHA-256
`ae13d18c09adcfdca3171545d8e1a75093edbd040c119d837f8da4574dd6989d`.
A separately created, freshly migrated and fixture-loaded database passed referee
**11/11** with 125 public tables. Standing gates passed **1,469 pass, 1,061 expected
environment skips, 0 fail**, 20,712 assertions across 2,530 tests/469 files. Strict
TypeScript passed; import boundaries scanned 161 files successfully.

No product, test, migration, schema snapshot, stable local, Docker, `.yellow`, commit,
push, merge, or deployment state was changed by this reviewer.

## Cleanup state

The review server is stopped and port **55496 is closed**. Tool policy blocked
recursive deletion. Exact stopped disposable artifacts retained are:

- `D:\Yellow\temp\order430-tier3-review` — 111,548,550 bytes;
- `D:\Yellow\temp\order430-tier3-schema.sql` — 930,328 bytes.

Order430 remains active and unapproved. No document, numbering, series, provider,
IRP, API/UI, local-runtime, Phase7, push, merge, or deployment authority is granted.
