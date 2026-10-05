# Order 487 independent review — synthetic commercial configuration

**Reviewer:** Codex independent reviewer (non-implementing)  
**Date:** 2026-09-20  
**Current verdict:** **Rejected — exact-canonical replay accepts altered policy and plan definitions.** See the final independent release review below; earlier startup/ACL failures are superseded.

## Proof executed

The reviewer inspected Order 487, the commercial provisioner, and the focused scenario
test. `bunx tsc --noEmit` exited 0. The non-database focused test returned 3 pass,
2 skipped, 0 fail and 30 expectations.

Using only the disposable `yellow_colleague_proof` database, the reviewer created a
random short-lived executor role, invoked
`bun scripts/provision-colleague-commercial-configuration.ts`, and removed that role
in the same command. No public database/runtime or deployment was touched.

The first invocation failed before configuration writes with:

```text
PostgresError 22P02: malformed array literal
```

The failure is in `requireExistingPolicies()`: `POLICY_NAMES` is supplied to
`name = ANY(${POLICY_NAMES}::text[])`, but the driver serializes the JavaScript array
as a non-PostgreSQL array literal. A read-only confirmation after the failure found
one scenario property, one existing BAR plan, zero current prices, and zero `Demo %`
policies. Thus the failure did not partially create the commercial configuration.

## Additional static findings

1. **P0 — BAR does not receive explicit supported policy references.** The existing
   BAR plan is required but never updated or recreated through the configuration
   service. Order 487 requires every one of BAR/FLEX/ADV/CORP to have explicit valid
   cancellation/deposit/guarantee references; only the three newly created plans are
   configured that way.

2. **P1 — replay is not exact.** The price replay logic treats any current
   plan/unit-type pair as complete regardless of its stay range, occupancy amounts,
   currency or DOW mask. A malformed but 16-row price set would be accepted. The
   provisioner must query and verify all canonical price fields before declaring a
   no-write replay.

3. **P1 — current-date pricing is hard-coded.** The rate range begins
   `2026-09-20`, rather than deriving a bounded future range from the property-local
   scenario date. A later valid current-date scenario would not receive a future price
   window.

4. **P1 — the focused test is textual only.** It has no disposable integration proof
   for 4 active plans, 16 exact bigint prices, plan policy references, rate-price
   facts/outbox events, repeat-safe configuration, or cross-tenant denial.

## Required remediation

Fix the PostgreSQL array parameter handling and add an executable disposable test that
provisions the scenario then commercial configuration twice. It must assert the
four-plan policy contract (including BAR), 16 exact `bigint`-safe prices across a
property-date-derived bounded range, the service-owned facts/outbox events, unchanged
replay counts and payloads, no duplicate property, and RLS denial from a second
tenant. Re-request independent review only after that proof passes.

## Remediation re-review — 2026-09-20

**Reviewer:** Codex independent reviewer (non-implementing)  
**Verdict:** **Rejected — the new disposable executable commercial proof fails at the
application runtime role boundary.**

### Current source and decision review

The malformed array literal is fixed: `requireExistingPolicies()` now converts the
JSON policy-name list through `jsonb_array_elements_text`. The price range is derived
from the property-local configured business date, and the post-write validation now
checks every current row's range, DOW mask, currency, and two numeric JSONB occupancy
values.

The prior BAR-policy finding is **withdrawn**. D-131 explicitly makes policy
references optional in the typed create-only rate-plan contract, and no governed
policy-link update exists. The existing reviewed BAR is therefore a visibly baseline
plan; this order only creates FLEX, ADV, and CORP with the supported references. It
must not be represented to users as a fully policy-composed commercial plan.

### Independent commands and results

From `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`:

```text
bunx tsc --noEmit
exit 0

YELLOW_REQUIRE_COLLEAGUE_SCENARIO=1
YELLOW_COLLEAGUE_SCENARIO_DATABASE_URL=<random short-lived executor against yellow_colleague_proof>
bun test tests/colleague-current-date-scenario.test.ts
5 pass, 1 fail, 37 expectations
```

The reviewer created the executor only in `yellow_colleague_proof`, removed it in a
`finally` block, and did not access `yellow_public_demo`. The failing test is the new
commercial integration test. It fails before any commercial write with:

```text
PostgresError 42501: permission denied for table policy
```

`Database.withTenantTransaction()` deliberately executes `SET LOCAL ROLE app_role`.
Consequently this is the actual application authorization path, not an artifact of
the reviewer using a privileged disposable executor. The provisioner cannot read
`policy` under that role and hence cannot create or replay commercial configuration.

A separate read-only query against only `yellow_colleague_proof` after the failed
attempt returned one scenario property, only the pre-existing BAR plan, zero current
prices, zero `rate_price` facts, and zero `rate_price.created` outbox rows. BAR has
no policy references; per D-131 that is not itself a failure, but it confirms no
commercial configuration was partially persisted.

### Remaining required remediation

Grant the minimum governed `app_role` capability required by the existing rate
configuration service (including `policy` reads; verify all subsequent
service-owned writes and event/fact writes under the same role), through a scoped
order/migration if the permission is genuinely absent. Then reset or use the
disposable DB and rerun the exact executable test twice. The independent proof must
show four plans, sixteen unsuperseded prices, sixteen `rate_price` facts and sixteen
`rate_price.created` outbox events with no changes on replay. Commercial cross-tenant
denial remains unproved by the current focused test and should be added or proven
separately against `rate_plan` and `rate_price` before approval.

## ACL follow-up status — 2026-09-20

**Reviewer:** Codex independent reviewer (non-implementing)  
**Verdict:** **Not approved.** Migration `0095_rate_policy_runtime_read.sql` was
independently applied to a newly created disposable PostgreSQL database
`yellow_order487_review` in the isolated `yellow-order487-pg` container at
`127.0.0.1:55433`. The fresh migration chain applied `0001` through `0095` without
error. No public container or public database was accessed or changed.

This is schema/migration evidence only, not the required Order 487 end-to-end proof.
The reviewer was interrupted before independently seeding the disposable database and
executing the scenario plus commercial provisioner twice under `app_role`. Therefore
the required proof of four plans, sixteen exact price rows, facts/outbox evidence,
replay stability and rate-domain tenant isolation is still missing. Do not deploy the
commercial configuration based on this migration-only result.

## Final independent release review — 2026-09-20

Reviewer: Codex Astra, independent agent `/root/astra_review`; did not implement these changes. Decision: **REQUEST CHANGES / no commercial deployment**. Migration 0095 capability itself is accepted separately in review 488.

### Frozen source and scope

- `scripts/provision-colleague-commercial-configuration.ts` SHA256 `9B1214111138EC451A8D22BA8A0F096C653103765AB06F785843C1DA4AE4FDF3`.
- `tests/colleague-current-date-scenario.test.ts` SHA256 `D513006A7B5122527AE288BF68DBDE2AC68C46658DC0B5FF69AF856F0C393626`.
- `migrations/0095_rate_policy_runtime_read.sql` SHA256 `6FFB69469566CE3E5267F06F972DDBA7AB0C99B7EAFCF36287F3B1F953C186B0`.
- Read PROJECT, Orders 487/488, earlier reviews, D-131 and applicable entity/Postgres/code-review skills. The order Scope currently names the current-date script but not the separate commercial provisioner containing the implementation; the implementation owner should explicitly reconcile that scope before closure.

### Personally executed proof

Created a new reviewer-owned PostgreSQL **16.15** cluster at `D:/Yellow/temp/astra-order487-review-20260920/data`, bound only to `127.0.0.1:55514`; database `yellow_astra487_review`. No public database, private deployment environment, tunnel or app was accessed. Used binary directory `E:/yellow/toolchains/postgresql-16.15/pgsql/bin`.

Commands/setup, in runtime source:

```powershell
initdb.exe -D D:/Yellow/temp/astra-order487-review-20260920/data -U yellow_deploy --auth=trust --encoding=UTF8
# Hidden postgres process: -D <above data> -h 127.0.0.1 -p 55514
# Provisioned exact isolated owner/runtime/registrar roles with random in-process passwords.
# runMigrations({databaseUrl:'postgres://yellow_deploy@127.0.0.1:55514/yellow_astra487_review'})
# runSeed({databaseUrl:<same>}); inserted only synthetic review app_user and role prerequisites.
$env:YELLOW_REQUIRE_COLLEAGUE_SCENARIO='1'
$env:YELLOW_COLLEAGUE_SCENARIO_DATABASE_URL='postgres://yellow_deploy@127.0.0.1:55514/yellow_astra487_review'
bun test tests/colleague-current-date-scenario.test.ts
bunx tsc --noEmit
bun D:/Yellow/temp/astra-order487-review-20260920/proof.ts
```

The normal migration runner initially stopped safely at 0018 because the fresh cluster lacked the extension registrar; after creating that documented external role it resumed through 0095. Independent ledger verification subsequently proved contiguous 1–95 and **all 95 SHA256 checksums equal source**. This was a fresh cluster, not the implementer's database.

Results: focused suite **6 pass / 0 fail / 40 assertions** with no skips; TypeScript exit **0**. The retained reviewer harness exited **0**, including these independently asserted results:

- Same scenario property, four plans, four policies, sixteen current prices. Commercial fact counts `policy=4, rate_plan=3, rate_price=16`; corresponding created outbox counts `4,3,16`. BAR is the unchanged scenario baseline, not a fourth service-created plan.
- Two additional commercial replays preserve sorted whole-row hashes/counts of policy, rate_plan, rate_price, fact_log and outbox.
- Authenticated `yellow_runtime`, transaction role `app_role`: configuration service reads 4 policies/4 plans and 16 price rows. A typed policy → plan → bigint price create/read flow succeeds under that role and is intentionally rolled back; whole-row baseline restored.
- Foreign transaction-local tenant sees zero policy/plan/price rows, against nonempty positive controls. Policy UPDATE/DELETE/TRUNCATE and owner/deployer role escalation each fail SQLSTATE 42501.
- Static inspection finds no raw rate_price INSERT/UPDATE/DELETE in either scenario provisioner; commercial prices use `RatePricingService.create()`, whose fact/outbox share its caller transaction. Pricing inputs are bigint, not floating money.

The final reviewer harness is retained at the path above for exact replay (SHA256 `C3C0792A8BBAC57E7BD8F1C7AB2848DAC300EBF41C2BE2AABD28D604D09A4B70`). Early harness-only errors (ledger version returned as string; guessed outbox/column names; JSON restoration text cast) were corrected, and the complete final run passed its assertions. Hostile isolated fixtures were restored and the final whole-row hashes matched the baseline. The reviewer then stopped only this owned cluster using `pg_ctl.exe -D D:/Yellow/temp/astra-order487-review-20260920/data -m fast -w stop` (exit 0); retained data/harness can be restarted for follow-up proof.

### Release-blocking findings

1. **P1 — Policy replay validates names, not definitions** (`requireExistingPolicies`, lines 42–60). Independently changed Demo Card Guarantee content from `card_on_file` to `company_letter` in this disposable fixture. Commercial replay returned success, although the canonical policy is different. Compare exact kind/content (and identity cardinality) before accepting replay; add permanent hostile replay tests.
2. **P1 — Existing plan replay validates code/count, not canonical fields** (lines 80–93, 123). Independently changed FLEX name, status to inactive, and cancellation_policy to NULL. Replay again returned success. This violates the explicit active-plan/policy-reference and exact-canonical requirements. Verify every intended plan field/reference, retaining BAR unchanged, and refuse drift without repair or additional writes.
3. **P2 — Price replay checks only selected JSON values** (lines 118–122). Static inspection shows occ 1/2 are compared, not the full intended price shape; unexpected occupancy keys/extra-adult values can escape that comparison. This specific mutation was not executed. Require complete semantic equality and regression coverage before claiming exact pricing replay.

The happy-path test is green but does not cover these hostile replays. No whole-repository referee or public-current-state preflight was run in this review; neither a deployment approval nor financial KPI, published/sellable rate, historical preservation or production-readiness claim follows from these results.
