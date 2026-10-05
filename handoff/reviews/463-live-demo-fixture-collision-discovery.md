# Order 463 — live demo fixture collision discovery

**Date:** 2026-09-20  
**Executor:** Codex  
**Authority:** Order 463  
**Target:** the private deploy-control connection was confirmed to target the currently serving synthetic-demo database. No connection value, credential, guest contact, or raw party field is recorded here.

## Method

One Bun process ran from the frozen runtime source. It derived the canonical
`review-checkin/clean` Party and reservation UUIDv5 identities using the source's
own `uuidV5` helper, opened a transaction, issued `SET TRANSACTION READ ONLY`, and
set the transaction-local `app.tenant_id` to the fixed Yellow Demo tenant.

The only SQL statements after that were tenant-scoped `SELECT` aggregates against
`party`, `party_role`, and `reservation`. They returned boolean comparisons and
row counts only. The transaction ended with `ROLLBACK`; no seed, test suite,
migration, DDL, function invocation, or mutation was executed.

The checked Party shape was: canonical UUID, tenant, `person` kind, display/legal
name equality to the reviewed fixture, exact fixture attributes, and active/not-
merged lifecycle. Party-role and reservation checks compared their reviewed
fixture structures without returning raw values.

## Result

| Check | Row count | Result |
|---|---:|---|
| Canonical clean-arrival Party identity and tenant | 1 | match |
| Party kind and active/not-merged lifecycle | 1 | match |
| Party display and legal-name fingerprint | 1 | **mismatch** |
| Party attributes fingerprint | 1 | **mismatch** |
| Guest party-role structure | 1 | match |
| `ARR-CLEAN` reservation structure and Party reference | 1 | match |

The live collision is therefore localized to mutable Party presentation/attribute
data, while the fixture's reservation and guest-role references remain canonical.
The reviewed provisioner calls `exact()` for that Party before it can continue;
another run would deterministically fail again. It is not an idempotent safe rerun.

## Consequence

No repair was performed. Any change to this Party would be a live-demo data
reconciliation and must be governed by a new narrow order, with a current-target
before/after census and an independent reviewer personally executing the proof.
It must not reset or reseed the database, change insert-only financial/occupancy
records, or disclose the affected values.
