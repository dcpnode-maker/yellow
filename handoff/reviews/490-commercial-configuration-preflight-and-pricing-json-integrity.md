# Order 490 independent review — preflight and complete price JSON

Date: 2026-09-20. Reviewer: **Codex Astra**, independent agent `/root/astra_review`; did not implement this change.

**Verdict: ACCEPT the scoped Order 490 source remediation.** Both executable blockers from review 489 are fixed in the reviewed bytes. This is not a public migration/deployment authorization or a whole-repository release approval.

## Frozen source

Runtime source directory: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

- `scripts/provision-colleague-commercial-configuration.ts`: SHA256 `394373FE5A418C8BE63CD1109404F2A91456C778BE1A16E7F5342692CCE70EEB`.
- `tests/colleague-current-date-scenario.test.ts`: SHA256 `F15A2D965527DEF85305E542288BD606181632AD87EA72E038785193B5CCDF93`.
- Independent retained harness `D:/Yellow/temp/astra-order490-review-20260920/proof.ts`: SHA256 `C78C50F974361038D4DD4EA9F3006C612B833C8DAA9015A11C166F15BD1169C0`.

Inspected Order 490 against PROJECT, the preceding Orders 487–489 and their review findings, and D-131. Applied the code-review and Yellow Postgres/entity skills to service-owned writes, exact immutable evidence preservation, bigint representation and runtime RLS.

## Personally executed fresh proof

Created a new reviewer-owned **PostgreSQL 16.15** native cluster, not a reused implementer database, at `D:/Yellow/temp/astra-order490-review-20260920/data`, bound only to **127.0.0.1:55516**. Database: `yellow_astra490_review`. Binaries: `E:/yellow/toolchains/postgresql-16.15/pgsql/bin`.

```powershell
initdb.exe -D D:/Yellow/temp/astra-order490-review-20260920/data -U yellow_deploy --auth=trust --encoding=UTF8
# Hidden postgres: -D <above> -h 127.0.0.1 -p 55516
# Created exact documented yellow_owner/runtime/extension-registrar roles.
# Runtime/registrar and synthetic review passwords generated in-process with crypto.randomUUID().
# Created yellow_astra490_review owned by yellow_deploy.
# runMigrations({databaseUrl:<isolated URL>,logger:()=>{}})
# runSeed({databaseUrl:<isolated URL>})
# runReviewSeed({databaseUrl:<isolated URL>,password:crypto.randomUUID(),
#   approverPassword:crypto.randomUUID(),mode:'identity_inventory',logger:()=>{}})
$env:YELLOW_REQUIRE_COLLEAGUE_SCENARIO='1'
$env:YELLOW_COLLEAGUE_SCENARIO_DATABASE_URL='postgres://yellow_deploy@127.0.0.1:55516/yellow_astra490_review'
bun test tests/colleague-current-date-scenario.test.ts
bunx tsc --noEmit
bun D:/Yellow/temp/astra-order490-review-20260920/proof.ts
```

Results:

- Normal runner applied migrations **0001–0095**. The independent harness asserted contiguous ledger versions and **all 95 source SHA256 values equal ledger checksums**.
- Base and identity/inventory review seed completed with ephemeral credentials; none printed or retained. Focused suite then created the separate current-date scenario and commercial configuration.
- Focused suite: **7 pass / 0 fail / 55 assertions**, no skips.
- Strict root TypeScript: **exit 0**, independently rerun after proof.
- Independent retained harness: **exit 0**; every hostile case explicitly asserts rejection, not merely logging it.

## Independent findings and closed regressions

1. **Renamed-all-policy partial-write defect closed.** Renamed all four canonical policy rows while retaining original references/facts, captured full database fingerprints, then called the provisioner. Replay rejected; no replacement policy, fact or outbox row appeared. All **129 public tables** retained the same sorted whole-row hashes/counts as immediately before the call. Restoring only the deliberate test rename returned every table to the original baseline.
2. **Unexpected/full pricing JSON defect closed.** Independently injected `{"occ":{"1":760000,"2":760000},"unrecognized_fee":999}` and, separately, the same occupancy with `"extra_adult":null`. Both reject with all 129 table hashes/counts unchanged. Additional quoted money, missing occupancy key, altered amount, third occupancy tier, extra-adult amount and extra-child band also reject without writes.
3. **Prior policy/plan guards preserved.** Nested policy-penalty drift and unknown policy-content key reject. FLEX name, inactive status, cancellation/guarantee references, tax treatment, market and source were altered individually; each rejects with unchanged fingerprints.
4. **Clean replay preserved.** Two additional clean commercial replays preserve whole-row hashes/counts of every public table, including rate rows, full fact/outbox evidence and unrelated synthetic records. Own-tenant positive controls remain four named policies, four scenario plans and sixteen prices.
5. **Runtime isolation preserved.** Actual `yellow_runtime` login uses `app_role` within a tenant-local transaction; own-tenant reads succeed. Foreign context sees zero rows from policy, rate_plan, rate_price and **current_rate_price**. Direct policy UPDATE/DELETE/TRUNCATE and escalation to yellow_owner remain denied with SQLSTATE **42501**.

## Source inspection

- Before creating absent named policies, the new preflight queries existing immutable policy fact provenance using the current tenant and JSONB containment. Existing provenance with no canonical named rows fails before a service create, closing the reproduced replacement-write path. Partial or content-altered sets retain their existing rejection checks.
- `expectedPricingJson()` obtains bigint amounts from `expectedPricing()`, writes each unquoted numeric literal using `amount.toString()`, and uses JSON.stringify only for the occupancy key. **No bigint value is converted through Number.** PostgreSQL compares the entire stored JSONB value to this expected object, in addition to the existing decoded bigint comparison. Missing/extra keys, quoted values and explicit nulls cannot pass that equality.
- Production rate-price creation still goes solely through `RatePricingService.create()`. No raw rate_price INSERT/UPDATE/DELETE, new migration, schema/ACL change, BAR update or financial action was introduced. Direct fixture corruption exists only in isolated negative tests, not the provisioner.
- The authored focused test now covers renamed-all-policy and explicit-null regressions. The retained independent harness additionally supplies unknown-key, broader shape, per-field and whole-row preservation proof; promoting those broader probes into permanent checked-in tests is a useful non-blocking follow-up.

## Limits and disposition

Acceptance is bounded to Order 490's exact remediation and the sequential create/replay/hostile cases executed. It does not prove concurrent first-time provisioning or atomic rollback of every possible multi-stage initial-provision failure; the script still uses multiple service transactions. Whole-repository referee/CI and actual public-target preflight remain separate release gates. No public app, database, tunnel or deployment environment was accessed; no deployment, migration to public, financial posting or rate publication occurred.

The reviewer stopped only the owned cluster with `pg_ctl.exe -D D:/Yellow/temp/astra-order490-review-20260920/data -m fast -w stop`. Data and the exact executable harness are retained for reproduction. Prior review 489's two blocking examples are superseded by this passing frozen-source proof, not erased from history.
