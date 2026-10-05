# Independent review — CRM-20260930 department routing queue

**Date:** 2026-09-30
**Reviewer:** `/root/yellow_design`, independent non-implementer
**Requested configuration:** GPT-6.1 / ultra, assigned by the coordinator; runtime model identity is not independently tool-attested and the coordinator's identity is not inferred.
**Basis:** `40eb866a7f51645ee3de84806dbd1a8e17ca8a56`
**Branch:** `phase-7/crm-department-queue-20260930`
**Verdict:** APPROVED for the frozen optional property-queue routing filter and actual mounted HTTP behavior below. RELEASE GATES REMAIN RED. No full CRM/PMS completion, dirty-laptop integration, all-green PR, push, merge or deployment approval is granted.

The reviewer authored only this record and made no production, test, assertion, configuration or schema edit. A read-only child assisted with source/proof sensitivity; the reviewer personally executed the high-risk proof and hostile controls.

## Source and contract

The domain diff adds one optional validated target-role argument and its SQL equality predicate before ordering and LIMIT100. Existing tenant/property/proposal predicates, active-first `due_at,id` ordering, joins, serializers, eligibility and authority remain intact. Default arguments preserve unfiltered reads and command receipts. A non-null role filter with a non-null reservation is rejected before SQL.

The new query helper accepts no parameters or exactly one `target_role_id` containing a canonical lowercase UUID. It rejects unknown, duplicate, empty, malformed and reservation-history filters. It performs no role lookup or authorization. Accepted filter cardinality/value shape is bounded; no new raw URL byte budget is claimed.

The operator changes are one import plus the query guard and fourth list argument in the existing departure read method. Existing token scope, live property grant, actor identity and tenant transaction checks remain in order. No app route, frontend, index export, permission, migration, task state or command changed. The response preserves roles and staff metadata. Contract wording was clarified from configured role to target role: existing routed work remains readable without a new current-roster eligibility rule.

Role selection describes request routing under existing property read authority. It confers no work permission or role membership and does not establish a personal inbox. Login app_user and staff Party remain separate identities without a canonical ownership link. Unknown and existing foreign-role UUIDs return empty request lists only after the same property authority succeeds; foreign properties remain denied.

## Personally executed proof

Commands used pinned Bun 1.3.14 and coordinator-owned disposable PostgreSQL18. No credentials/private authority files or real guest/payment data were read or printed. Baseline and candidate ran sequentially with the identical frozen dated test.

| Command | Actual result |
| --- | --- |
| `python3 /workspace/yellow-coordination/run-routing-proof.py --baseline` | Expected RED: exit1, 0 passed/1 failed, 13 assertions; filtered request HTTP400 versus expected200 at line201 |
| `python3 /workspace/yellow-coordination/run-routing-proof.py` | GREEN: exit0, 1 passed/0 failed, 40 assertions; no database skips |
| Required runner `--missing-runtime` | Expected exit1; proof authority missing, no accepted skip |
| Required runner `--owner-runtime` | Expected exit1; restricted runtime identity required before fixtures |
| Required runner `--mismatched-target` | Expected exit1; mismatched disposable targets rejected before connection |
| `PATH=/workspace/yellow-toolchain:$PATH bun test tests/crm-20260930-routing-query.test.ts tests/departure-service-contract.test.ts tests/departure-service-http.test.ts tests/operator-departure-service.test.ts` | 14 passed/0 failed, 62 assertions |
| `PATH=/workspace/yellow-toolchain:$PATH bun run typecheck` | Exit0 |
| `PATH=/workspace/yellow-toolchain:$PATH bun run boundaries` | Exit0;205 TypeScript files, no violations |

The unchanged baseline first proves that100 earlier unfinished requests for roleA occupy the unfiltered queue and hide later roleB work. Its subsequent HTTP400 proves the feature is absent; it is not a claim that the old filtered query functioned or that an old SQL filter was defective. The candidate finds both later unfinishedB and completedB through the mounted signed-token route, while filteredA matches the entire unfiltered request order. Roles/staff metadata remain equal.

Fixtures use canonical propose/confirm/assign/start/complete, including actual assigned and in-progress states. Completion returns outcome clear and exact replay returns the same receipt. Existing reservation history remains readable; filtered history and commands return400. The current predicate cannot become post-limit filtering without the backlog proof failing.

The proof checks normalized target pairing before connection and actual database/OID/server address/port/postmaster start before fixtures. Runtime login is non-superuser/non-BYPASSRLS yellow_runtime with app_role membership; tenant transactions verify current_user app_role and exact local tenant context. Full row-content fingerprints cover every public table, with required financial/request/task/idempotency relations checked; actual sequence last_value/is_called are included. Successful and denied reads leave these fingerprints unchanged.

Signed denials cover absent token/scope, unknown and same-tenant ungranted property, existing foreign property/tenant, removal of effective current read permission and post-token actor disablement. Foreign tenant/actor/role/grant metadata exists. No successful foreign request queue or reused-backend two-tenant isolation scenario is claimed. Existing work/command authority is preserved, not derived from selected routing role.

Additional personal inline probes rejected encoded duplicate keys, NUL suffix, bracket keys, prototype key, semicolon suffix, malformed percent escape and empty duplicate values. Direct filtered reservation history rejected with invalid before making any SQL call: eight checks passed, no source/test edit.

Safe receipts are `/workspace/yellow-coordination/crm-routing-reviewer-baseline.log`, `crm-routing-reviewer-candidate.log`, `crm-routing-reviewer-focused.log` and `crm-routing-reviewer-negative-{missing-runtime,owner-runtime,mismatched-target}.log`.

## Other evidence and limits

The builder reports unchanged existing departure PostgreSQL12/0 and accepted CRM backlog1/0, plus type/boundary success. Those reported regression executions are distinguished from the personal commands above. The coordinator executed unmodified canonical setup; the reviewer inspected `crm-routing-setup-db-only.log` showing11 passed/0 failed of11 and130 tables. Inherited migrations1–99 summary prose is stale; the100-migration source/setup were not changed.

The license gate and required reservation-offer regression remain RED. Earlier candidate/baseline offer failures are retained as observations, not classified as fixture-only: a separate source/contract investigation is checking room-type deduplication against the physical candidate-pair contract. No offer assertion, seed, dependency policy or gate was weakened in this order. No full standing-suite or release-green claim is made.

The cap remains100 per selected role. Pagination, staff ownership/acceptance, shifts and SLA remain separate scoped work. Protected laptop operator integration must compare the current local hunk before application; this isolated source endpoint proof is not verification of that dirty laptop runtime. Multi-Airbnb/co-host and Hotel/STR account architecture remains design only. Existing shared task and occupancy authority was preserved; CompSet was untouched.

## Frozen files

Personally captured before and after execution; later source/test changes require fresh relevant proof and review.

```text
39f80d399e8cbba116fe43d698338dd51774eb88ba94ea750c426b045c530275  src/contexts/stay-operations/departure-service-coordination.ts
cdacc720d2187eee35a3fca39d8d138cd627d26250478c88e88e5712076a8a09  src/http/departure-services-query.ts
d28334ccc74fe4aecc724925b3bfd84a9da62f29ee5b152a16ee431d1d72c679  src/http/operator.ts
16ac8cab819f73250cdcb9fce043aeb6ac5cdaea5d6c3bd40d54bdb84dd04955  tests/crm-20260930-routing-query.test.ts
0975357322b8a9f5c8970bbd43cf956b0d0ac682253e239dbb1e2280b252aaa2  tests/crm-20260930-department-routing.integration.test.ts
f952bdec2be3a0a0e1cacbfcc010d2f0b9553e6771ea7a6580c4a4490e8297bf  docs/CONTRACTS.md
```

The pristine baseline HEAD was personally verified as40eb866, its tracked diff was empty and the temporary test was removed. Only the ten order-allowed files may enter the final candidate. Governance updates do not broaden source scope. The complete staged/basis comparison must include new helper/test/order/review files; an unstaged tracked diff alone cannot verify them.

## Final complete-scope checkpoint

After final governance was staged, the reviewer personally ran `git diff --cached --check 40eb866a7f51645ee3de84806dbd1a8e17ca8a56` and `git diff --check 40eb866a7f51645ee3de84806dbd1a8e17ca8a56`: each exited0 with no diagnostics. The staged comparison contains exactly the ten allowed files, including all new records. DECISIONS adds two lines and removes none; LEDGER adds six and removes none. Every frozen source/test/contract hash above still matches. The order accurately limits the query bound to accepted parameter cardinality and UUID shape rather than claiming a raw URL byte guard. The coordinator must restage this review-only checkpoint and repeat the complete check before local commit.
