# Order 489 independent review — canonical commercial replay

Date: 2026-09-20. Reviewer: **Codex Astra**, independent agent `/root/astra_review`, not the implementer.

**Verdict: REJECT / request changes. No public deployment.** The original policy-content and plan-field defects are repaired, and the authored suite passes. Two additional executable probes still violate the complete-shape and rejected-replay/no-write requirements.

## Frozen source

Runtime source: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

- Commercial provisioner SHA256: `0F8B63FD47D4EDEDFDB8E85D96098C0009C65B0B0C9C3C7D5CCB99EA16A37CE8`.
- Focused test SHA256: `50F42393DF7E749F65D07D60D976EA53885D45DAF764E002F5233C8C922DFC37`.
- Migration 0095 remains the separately reviewed SELECT-only policy capability. All 95 migration source checksums were independently verified against this fresh ledger.

Read PROJECT, Orders 487–489 and preceding review findings. Used the Yellow Postgres/entity and code-review skills to check service ownership, immutable evidence, full-field equality and actual runtime RLS, rather than accepting the happy-path test alone. Order 489 now explicitly scopes the separate commercial provisioner, resolving the previous scope-list omission for this remediation.

## Independently executed environment and commands

Created an entirely new PostgreSQL **16.15** native cluster at `D:/Yellow/temp/astra-order489-review-20260920/data`, bound only to **127.0.0.1:55515**, database `yellow_astra489_review`. This is neither a public database nor an implementer-owned test database. Binary directory: `E:/yellow/toolchains/postgresql-16.15/pgsql/bin`.

```powershell
initdb.exe -D D:/Yellow/temp/astra-order489-review-20260920/data -U yellow_deploy --auth=trust --encoding=UTF8
# Started hidden postgres with: -D <above> -h 127.0.0.1 -p 55515
# Created documented yellow_owner/runtime/extension-registrar roles.
# Login passwords were random, generated in-process and never printed or retained.
# Created database yellow_astra489_review owned by yellow_deploy.
# runMigrations({databaseUrl:<isolated URL>,logger:()=>{}})
# runSeed({databaseUrl:<isolated URL>})
# runReviewSeed({databaseUrl:<isolated URL>,password:crypto.randomUUID(),
#   approverPassword:crypto.randomUUID(),mode:'identity_inventory',logger:()=>{}})
$env:YELLOW_REQUIRE_COLLEAGUE_SCENARIO='1'
$env:YELLOW_COLLEAGUE_SCENARIO_DATABASE_URL='postgres://yellow_deploy@127.0.0.1:55515/yellow_astra489_review'
bun test tests/colleague-current-date-scenario.test.ts
bunx tsc --noEmit
bun D:/Yellow/temp/astra-order489-review-20260920/proof.ts
bun D:/Yellow/temp/astra-order489-review-20260920/partial-write-proof.ts
```

Migrations 0001–0095 completed; ledger independently asserted contiguous 1–95 and every source checksum equal. A setup-output expression initially guessed the runner result field `applied` incorrectly and threw after successful migration; direct ledger verification confirmed all 95 before seeding. No migration failed or was skipped.

Base seed plus `identity_inventory` review seed completed with ephemeral credentials. This mode supplies the synthetic operator/inventory prerequisites without introducing unrelated published price facts into the focused suite.

Results: **7 pass / 0 fail / 50 assertions**, no skipped tests. Strict root TypeScript check exited **0**. Both retained independent probe scripts exited **0**; they intentionally report the reproduced defects, not approval.

Reviewer harness SHA256:

- `proof.ts`: `8EFF03A4F34DCD42FB6677B57948B43B1CEFD72CBEC06004A5A2083A41BFA4E1`.
- `partial-write-proof.ts`: `39746ACE0E80AC8083807403CCA89CFFCAB3144A1B02C80B9A1770B9B72DB102`.

## Passing independent checks

- Two clean commercial replays preserve sorted whole-row hashes and counts of **all 129 public tables**, not merely counts of the targeted rows. This includes policy/plan/price, facts/outbox and unrelated synthetic records.
- Runtime login `yellow_runtime` becomes `app_role` within the tenant transaction. Own-tenant service reads find the four named policies, four scenario plans and sixteen prices. A foreign tenant sees zero rows in policy, rate_plan, rate_price **and current_rate_price**.
- Direct policy UPDATE/DELETE/TRUNCATE and owner-role escalation are denied with **42501**.
- Independent hostile probes reject nested cancellation-penalty changes and an unknown policy-content key.
- Each FLEX field was altered separately: name, inactive status, cancellation reference, guarantee reference, tax treatment, market and source. Every replay rejects, with all 129 table hashes/counts unchanged from the hostile pre-call state.
- Additional occupancy tier, explicit extra-adult amount and an extra-child age band all reject with no row/evidence change. Bigint decoded money equality avoids the previous Number conversion.
- The primary probe restores each intentionally corrupted isolated test fixture and asserts the original whole-database row hashes afterward. Production provisioner contains no raw rate_price writes; service writes still bind their fact/outbox to the same transaction as each individual command.

## Remaining blocking findings

### P1 — A rejected replay can commit replacement policies and evidence

The separate retained `partial-write-proof.ts` created a reviewer-owned clone `yellow_astra489_partial_review` from the clean reviewer database. It renamed the four canonical policies, preserving their rows and existing plan references, then captured evidence and invoked replay. `requireExistingPolicies()` finds zero canonical names, so the provisioner creates and commits four replacement policies in its first write transaction. Plan validation in the next transaction rejects because FLEX/ADV/CORP still reference the original policy IDs.

Exact result:

```text
Replay rejected: colleague commercial rate plans are not canonical
policy:   4 -> 8
rate_plan: 4 -> 4
rate_price: 16 -> 16
fact_log: 223 -> 227
outbox:   172 -> 176
```

The requirement that hostile replay fails before mutation is therefore not met. This is not just a theoretical transaction concern. Preserve the insert-only evidence; do not fix by deleting the new facts/events. Make the full operation atomic or complete collision validation before any separately committed creation, with appropriate consistent snapshot/locking. Add a regression covering this zero-named-policy/existing-referenced-plan collision and equivalent later-stage rejection paths.

### P2 — Complete stored pricing shape is not validated

`samePricing()` compares the decoded service model, but `RatePricingService.get()` projects only known pricing components and discards unknown JSON keys. The independent probe replaced one isolated BAR/COSY pricing object with:

```json
{"occ":{"1":760000,"2":760000},"unrecognized_fee":999}
```

Replay **succeeded**. An explicit `extra_adult:null` shape was also accepted (semantically decoded as absent); that normalization alone may be a deliberate semantic choice, but the unknown key is unequivocally outside the declared full configuration and is not rejected. Verify the permitted stored shape/keys in addition to lossless bigint semantic values, without passing money through JavaScript Number or expanding production write authority. Add permanent tests for unknown top-level keys and explicitly document allowed normalization.

## Limits and disposition

No runtime implementation file was changed by this reviewer. Direct hostile fixture corruption was confined to the reviewer-owned disposable databases for negative testing. The clone retains the reproduced partial-write evidence; it was not cleaned by deleting immutable facts/outbox rows. No public app, database, tunnel, migration, seed or deployment was accessed.

The owned cluster was stopped after proof with `pg_ctl.exe -D D:/Yellow/temp/astra-order489-review-20260920/data -m fast -w stop`; its data and harnesses are retained for reproduction. Whole-repository referee/CI and public-current-state deployment preflight were not run and must not be inferred. This review does not reverse Order 488's separately established narrow ACL acceptance, but **Orders 487/489 remain unapproved for commercial deployment**.
