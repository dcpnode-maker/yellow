# Order 488 independent review — rate-service policy read authority

**Reviewer:** Codex independent reviewer (non-implementing)  
**Date:** 2026-09-20  
**Current verdict:** **Source capability accepted after independent execution; not a public deployment authorization.** See final review below. Order 487 remains rejected for separate canonical-replay defects.

## Independently executed evidence

Using only the isolated Docker PostgreSQL container `yellow-order487-pg` on
`127.0.0.1:55433`, the reviewer created a fresh disposable database named
`yellow_order487_review` and personally ran:

```text
YELLOW_DEPLOY_DATABASE_URL=postgres://yellow_deploy@127.0.0.1:55433/yellow_order487_review
bun scripts/migrate.ts
```

The command applied migrations `0001_init.sql` through
`0095_rate_policy_runtime_read.sql`, inclusive, with `applied=95` and no migration
error. The public `yellow-public-demo-*` containers and database were not accessed or
modified.

## What remains unproved

Order 488 requires an ordinary `app_role` request to read only its transaction-local
tenant policies, complete the typed policy/rate-plan/rate-price creation/replay flow,
and be denied cross-tenant reads and unauthorized DML/role escalation. The independent
reviewer did not complete the disposable seed and service-level execution before this
review window was stopped. A successful migration proves the ACL can be installed; it
does **not** prove those runtime semantics.

Accordingly this review does not authorize public migration 0095, Order 487
configuration deployment, or any assertion that the runtime commercial flow is safe.

## Final independent release review — 2026-09-20

Reviewer: Codex Astra, independent agent `/root/astra_review`, non-implementer. **ACCEPT migration 0095's least-privilege source change**. Public migration/deployment was neither performed nor authorized by this review; Order 487 remains release-blocked.

Reviewed migration SHA256: `6FFB69469566CE3E5267F06F972DDBA7AB0C99B7EAFCF36287F3B1F953C186B0`. Its only statements grant app_role SELECT on public.policy and revoke PUBLIC table authority. It changes no table shape, RLS expression, ownership, write capability, role membership or service/state-machine code.

### Personally executed proof

Used a completely new reviewer-owned PostgreSQL 16.15 native cluster bound to `127.0.0.1:55514`, database `yellow_astra487_review`; never connected to the public database. Full preparation/commands and frozen configuration/test hashes are recorded in the final section of review 487.

```powershell
$env:YELLOW_REQUIRE_COLLEAGUE_SCENARIO='1'
$env:YELLOW_COLLEAGUE_SCENARIO_DATABASE_URL='postgres://yellow_deploy@127.0.0.1:55514/yellow_astra487_review'
bun test tests/colleague-current-date-scenario.test.ts
bunx tsc --noEmit
bun D:/Yellow/temp/astra-order487-review-20260920/proof.ts
```

- Normal runner applied 0001–0095 on this fresh cluster. Reviewer verified contiguous ledger 1–95 and every source SHA256 against its ledger entry.
- Focused scenario suite **6 pass, 0 fail, 40 assertions**, no skips; TypeScript exit **0**; final reviewer harness exit **0**.
- Actual login `yellow_runtime`, effective transaction role `app_role`, reads four policies through RateConfigurationService, four scenario plans, sixteen prices. Its typed policy → plan → bigint price create/read flow succeeds; explicit rollback leaves whole-row policy/plan/price/fact/outbox hashes unchanged.
- Commercial replay executed twice additionally with no row/hash changes; exact counts four policies/four plans/sixteen prices and service-created fact/outbox counts 4/3/16 independently verified.
- Same runtime role with a foreign transaction-local tenant sees zero policies, rate plans and rate prices; own-tenant positive controls are 4/4/16.
- Direct policy UPDATE, DELETE and TRUNCATE, SET ROLE yellow_owner and SET ROLE yellow_deploy all rejected with **42501**.
- Catalogue: policy/rate_plan/rate_price each retain `yellow_owner`, RLS enabled, FORCE RLS false (unchanged), identical `tenant_isolation` USING and WITH CHECK on transaction-local tenant. app_role has SELECT but no table UPDATE/DELETE/TRUNCATE on all three.
- PUBLIC policy table ACL entries: **zero**. Existing app_role column INSERT entries remain exactly **content, kind, name, tenant_id**. Only app_role membership is yellow_runtime with admin=false, inherit=false, set=true; no new escalation path.

### Limits and follow-up

This closes the previous missing executable runtime/tenant-isolation proof for 0095. It does not validate exact canonical commercial replay under drift: the independent hostile policy/plan probes reproduced Order 487 defects, detailed there. Permanent checked-in permission/hostility tests remain desirable; the retained reviewer harness supplies this review's independent proof. Whole-repository referee and live preflight remain separate release gates. No public state, migration or rate publication was changed.
