# Question193 — Native buyer approval creation through the existing kernel

**Status:** RESOLVED — routine technical scope amendment, D1366
**Order:** 434, Phase7
**Date:** 2026-09-05

## Executed authority correction — D1367

The first real kernel run exposed Bun Date binding22007, repaired by canonical
ISO binding, then PostgreSQL42501. Catalogue inspection confirms0016 grants
direct approval INSERT only on the original six columns; identity and expiry are
intentionally absent. Do not grant either new direct-DML column or edit0016.

Amend the preceding no-capability plan: admit one narrowly scoped
`create_approval_request_with_options(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,timestamptz)`
in the already-admitted non-runnable0076 completion fragment. Kernel's extended
request path calls it and retains its existing same-Tx fact/outbox publisher.
The owner-mediated operation only creates pending requests: fixed owner/search
path, governed runtime/app role, transaction-local tenant, active tenant/actor,
property scope, stable kind/subject and object payload. It controls defaults and
checks explicit expiry against PostgreSQL time; no status/decision/created-time
input. Native buyer requests additionally require existing property valuation
authority and a matching live reservation/folio subject. Existing consumer
validation remains mandatory and is not replaced by request creation.

The helper is private in draft storage. An isolated real-runtime proof may
temporarily grant only this exact signature to app_role and must revoke it from
PUBLIC/app_role/yellow_runtime in finally. No other approval-table privilege is
added. The original option-free legacy path and existing decide rules remain
unchanged. Complete0076 migration integration and independent proof must include
this operation; it does not enable the retained local application.

## Evidence and decision

The current generic `ApprovalService.request` cannot supply the `valid_until`
column required by the already-applied0062 buyer-override constraint. The native
valuation request hash also binds `approvalRequestId`, so the internal caller must
allocate that identity before constructing the exact approval payload. The current
positive fixture consequently inserts an approved row as deployment authority;
that proves consumption, not real request and different-user decision creation.

Under the existing primary-coordinator authority, admit exactly these additional
paths to Order434:

- `src/kernel/approval.ts`
- `tests/approval-request-options.test.ts`

The already-admitted native source-completion integration test will execute the
actual kernel request, then the unchanged different-user decision, then genuine
native finalization. Existing invalid/expired source fixtures remain explicitly
labelled fixture-only rejection cases, not runtime approval creation.

Extend only `RequestApprovalInput` with optional internal `approvalId` and
`validUntil: Date`. Validate UUID and a finite explicit timestamp. An expiry must
be later than PostgreSQL's transaction timestamp. Do not infer any expiry period,
add a default lifetime, or add an HTTP input. Preserve the exact legacy SQL path
when neither option is supplied, so Phase1 databases without0062 remain valid.
Preserve existing response shape, actor binding, state transitions, fact/outbox
publication and different-user decision rules. Explicit expiry may be included
in the request fact; old fact/event payloads remain unchanged when absent.

This supplies an existing kernel primitive with already-supported database fields;
it creates no permission, business policy, approval kind, table, migration or
decision authority. A proposed payload is not financial authority: the existing
native valuation writer must still recompute and compare the complete request,
service, relationship and approval-basis hashes and validate the current decider
and expiry. No raw approval insertion may stand in for the new positive proof.

No browser approval screen or new native approval-workbench API is claimed by
this amendment. Full Order434 source, concurrency, migration and independent
acceptance remains required. A non-implementer must personally execute the
bounded approval proof before it is described as independently verified.
