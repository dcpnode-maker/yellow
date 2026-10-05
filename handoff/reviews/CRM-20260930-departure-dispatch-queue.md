# Independent review — CRM-20260930 departure dispatch queue

**Date:** 2026-09-30
**Reviewer:** `/root/yellow_design`, independent non-implementer
**Requested reviewer configuration:** GPT-6.1 / ultra, assigned by the coordinator. Runtime model identity is not independently attested by a tool; the coordinator's model identity is not inferred.
**Basis:** `e06e400a57485cc10a8a35c21dcb1e01b5a667d1`
**Branch:** `phase-7/crm-departure-dispatch-queue-20260930`
**Verdict:** APPROVED for the frozen, bounded departure queue ordering behavior below. RELEASE GATES REMAIN RED. This is not full CRM completion, all-green PR acceptance, laptop integration, merge or deployment approval.

The reviewer changed no production source, tests, configuration, schema or assertions. This record is the reviewer's only repository edit. A read-only child reviewer assisted with source and proof sensitivity inspection; the reviewer personally executed the registered high-risk proof and its negative authority modes.

## Scope and design

The founder's primary priority is CRM operational task distribution: assignment and follow-through. This finite slice improves the existing departure guest-request queue using the existing task store and canonical commands. It introduces no task lifecycle, department ownership, shift, SLA, escalation policy, route, permission, schema or frontend change. The previously reviewed CRS artifact remains separate.

The entire production diff is the conditional ordering expression in `src/contexts/stay-operations/departure-service-coordination.ts:144`. In property mode, confirmed requests with task status `open`, `assigned` or `in_progress` rank before other confirmed requests. Both groups retain `due_at,id` ordering and the existing 100-row cap. Completed outcomes fill spare slots. This prevents 100 older completions from hiding the tested newer unfinished work without removing completion outcomes from small queues.

For non-null reservation mode every row receives the same rank, preserving exact `due_at,id` chronology. Command receipts use this same reservation mode plus the exact request ID. The WHERE predicates, tenant/property joins, result shape, eligible actions, authority calls, lifecycle commands and LIMIT are unchanged. No reservation-status filter was added: confirmed unfinished work remains visible after checkout.

Current authority is still checked through `assert_departure_service_authority` before reads and before/after idempotent command execution. The unchanged migration checks runtime session/transaction role, transaction-local tenant, active tenant/actor and current scoped role permission. Target roles remain routing metadata under existing property authority; this slice does not establish a personally owned staff inbox.

## Proof sensitivity and refinements

The reviewer personally ran the identical final dated test first against pristine tracked e06, then against the candidate, sequentially. The baseline failed at the intended first-five unfinished-work assertion; the candidate passed. The baseline HEAD was verified as e06, its tracked diff was empty, and the temporary copied proof file was removed afterward.

During independent inspection, early fixtures did not actually put the assigned request into `assigned`, did not establish equal due times, and could allow globally changed reservation ordering to pass. The builder repaired those proof gaps using canonical commands, same-transaction confirmations and a completed-before-delayed-open history fixture. Exact completion replay was added. These were proof refinements, not additional production defects or authorized product changes.

The original fingerprint listed selected tables, silently skipped absent relations and omitted posting lines. The final helper enumerates every public table, hashes the full row-content multiset, rejects missing required financial/idempotency tables or failed reads, and captures each public sequence's `last_value` and `is_called`. Table and sequence identifiers are quoted safely. The reviewer inspected this final repair and repeated both baseline and candidate execution against its exact frozen hash.

## Personally executed acceptance

Commands used pinned Bun 1.3.14 and only coordinator-owned disposable PostgreSQL 18 proof databases. Neither credentials, private runner configuration nor real guest/payment data were inspected or printed.

| Command | Actual result |
| --- | --- |
| `python3 /workspace/yellow-coordination/run-crm-proof.py --baseline` | Expected RED: exit 1; 0 passed, 1 failed, 14 assertions; first-five ordering assertion at final test line 218 |
| `python3 /workspace/yellow-coordination/run-crm-proof.py` | GREEN: exit 0; 1 passed, 0 failed, 33 assertions; no database skip |
| Same required runner with `--missing-runtime` | Expected exit 1: dedicated proof authority required; no accepted skip |
| Same required runner with `--owner-runtime` | Expected exit 1: restricted runtime identity required, before fixtures |
| Same required runner with `--mismatched-target` | Expected exit 1: mismatched disposable target rejected before connection |
| `PATH=/workspace/yellow-toolchain:$PATH bun test tests/departure-service-contract.test.ts tests/departure-service-http.test.ts tests/operator-departure-service.test.ts` | 10 passed, 0 failed, 40 assertions |
| `PATH=/workspace/yellow-toolchain:$PATH bun run typecheck` | Exit 0 on the final test revision |
| `PATH=/workspace/yellow-toolchain:$PATH bun run boundaries` | Exit 0; 205 TypeScript files; no violations |

The real PostgreSQL proof binds deployment/runtime URL targets before connection and actual database name/OID, server address/port and postmaster start before fixtures. It verifies login as non-superuser/non-BYPASSRLS `yellow_runtime`, membership in `app_role`, transaction-local `current_user=app_role` and the exact tenant context. The mounted app uses actual signed bearer tokens and the existing operator/domain paths.

The dated proof creates 100 completed requests through propose/confirm/assign/start/complete, then tests open, assigned and in-progress work, equal due-time UUID ordering, the cap, spare-slot completed outcomes, reservation chronology, completion receipt and exact idempotent replay. Its checked-out visibility case sets synthetic reservation status in the disposable fixture; the existing canonical integration suite separately exercises actual checkout races and post-checkout completion.

Successful queue/history reads and signed denial cases retain all public-table content and public-sequence state. Tested denials include no token, missing token scope, malformed/unknown property, an existing same-tenant ungranted property, an existing foreign property/tenant claim, live grant removal and actor disablement after token issuance. Foreign fixtures contain existing tenant/property/actor metadata without their own authorized request queue. These are actual signed denial proofs; they do not establish a successful foreign queue, reused-backend two-tenant isolation scenario or newly enforced inbox ownership.

Safe personal command receipts are preserved outside the delivery source at:

```text
/workspace/yellow-coordination/crm-reviewer-final-baseline.log
/workspace/yellow-coordination/crm-reviewer-final-candidate.log
/workspace/yellow-coordination/crm-reviewer-negative-missing-runtime.log
/workspace/yellow-coordination/crm-reviewer-negative-owner-runtime.log
/workspace/yellow-coordination/crm-reviewer-negative-mismatched-target.log
/workspace/yellow-coordination/crm-reviewer-typecheck.log
```

## Coordinator evidence and open gates

The coordinator executed the unchanged existing `tests/departure-service.integration.test.ts`: 12 passed, 0 failed, 127 assertions. The reviewer inspected its safe log, including confirmation races, raw SQL/session denial, concurrent adjacent states, checkout and rollback cases. This is coordinator-executed evidence, not the reviewer's command.

The coordinator also executed unmodified `./setup.sh --db-only` in owned Compose project `yellow-crm-dispatch-referee`, using the original worktree Compose file plus an outside proof override, pinned toolchain and isolated ports. It exited 0 with 11 passed, 0 failed of 11. The reviewer inspected `crm-setup-db-only.log`: 100 migrations applied and 130 tables; the inherited migrations 1–99 summary prose is stale. No setup, migration or schema assertion was changed.

Inherited release blockers remain open. The existing license gate rejects `tslib@2.8.1` declaring `0BSD`. The required reservation-offer regression was previously personally reproduced by this reviewer on the separate CRS candidate and pristine tracked e06: both were 1 passed, 5 failed, 16 assertions. The license checker, dependency manifest/lockfile, offer test, review seed, setup and migrations have no CRM candidate diff. These previous RED results are not converted into passing CRM release gates; they were not rerun or weakened in this order.

The full standing suite and all historical release work are not claimed green. More than 100 unfinished requests remains the existing queue budget. Pagination, a complete operational CRM, staff inbox ownership, shifts and SLA require separate scoped work. Historical `state.sh`/status metadata does not supersede the human's dated priority and this exact source basis.

The dirty laptop's current departure source/hash has not been supplied. This is an isolated e06 patch, not laptop integration. Reconciliation must compare the laptop's exact current domain hunk and relevant proof/queue compatibility before applying it. No protected frontend or CompSet source was touched; no push, publication, merge or deployment occurred.

## Frozen reviewed source

The reviewer personally captured and recaptured these values around final proof. Later production/test changes require fresh review and relevant proof.

```text
50446498f208fda3d773b45f4221b2c0c140967a5a2cfaca8411789b1d2cfbb4  src/contexts/stay-operations/departure-service-coordination.ts
f837adc52ae63afbdffb7341c48d3fabd0d271ac758d7e05bd279a2f819a7ee5  tests/crm-20260930-departure-dispatch-queue.integration.test.ts
969f1b3d6b7e980d9f1d92246258a5522e1b78ee02a62eec6a858b327a00221f  docs/CONTRACTS.md
```

Only the dated order/review and allowed append-only contract/decision/ledger records accompany these source/test files. The coordinator may finalize those governance records without broadening product scope. Packaging must include the new records in its complete basis comparison; an unstaged tracked diff alone does not check untracked files.

## Complete staged-scope checkpoint

After the coordinator staged the final scope, the reviewer personally executed both `git diff --cached --check e06e400a57485cc10a8a35c21dcb1e01b5a667d1` and `git diff --check e06e400a57485cc10a8a35c21dcb1e01b5a667d1`: each exited 0 without diagnostics. The comparison includes the new order, test and review. It contains exactly seven allowed files: the departure source, dated test, contract, dated order/review, DECISIONS and LEDGER. The latter records append only; their STR references expressly describe separate proposed follow-on work and introduce no acceptance transition or authority.

The reviewer recaptured all three frozen source/test/contract hashes above; each matched final executable proof. This checkpoint adds only review evidence. The coordinator must restage this record and repeat the complete whitespace check before its local commit; product/test files remain unchanged.
