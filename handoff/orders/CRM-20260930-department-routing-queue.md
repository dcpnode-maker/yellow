# CRM-20260930 — Department routing queue

Status: authorized implementation. Founder explicitly directed continued PMS/CRM
completion without waiting for the laptop integration handoff. This order builds
on the independently accepted unfinished-work priority fix; it does not widen
that completed order or overwrite protected laptop source.

Basis: `40eb866a7f51645ee3de84806dbd1a8e17ca8a56` (e06 plus the accepted CRM fix).
Branch: `phase-7/crm-department-queue-20260930`.
Worktree: `/workspace/yellow-crm-routing`.

## Verified gap and outcome

The existing property departure queue returns at most100 requests from all
routing roles. One busy role's100 earlier unfinished tasks can hide a later
request for another role. Canonical `target_role_id`, configured roles and the
existing role-aware index already exist. Add explicit role selection before the
cap so dispatch staff can see that role's work. Preserve the default queue and
every existing command, history, receipt, permission and tenant boundary.

This is descriptive department routing, not personal staff ownership. There is
no canonical app_user-to-staff-Party linkage in this source. Do not invent one,
call this a personal inbox or infer extra work permission from a selected role.

## Exact scope

- `src/contexts/stay-operations/departure-service-coordination.ts`: optional
  fourth `list` argument `targetRoleId: string|null=null`, validated using the
  current UUID validator, allowed only in property mode. Pass into `#requests`
  and apply the role predicate before ORDER/LIMIT. Command callers/defaults stay
  exact; no action, grant, lifecycle, WHERE authority or result-shape changes.
- NEW `src/http/departure-services-query.ts`: strict query parser with bounded
  accepted parameter cardinality and UUID shape (no new raw URL byte budget) for
  exactly zero parameters or one `target_role_id` canonical UUID in property
  mode. Reject duplicate, empty, malformed, unknown parameters and any filtered
  reservation-history request. This parser grants no authority.
- `src/http/operator.ts`: small import/query guard/list-call hunk only in
  `departureServices`, retaining current scopes/grants/actor/transaction. This
  protected wiring is reviewed and exported separately for the laptop.
- NEW `tests/crm-20260930-routing-query.test.ts`: meaningful parser and actual
  operator denial/selection behavior with controlled ports.
- NEW `tests/crm-20260930-department-routing.integration.test.ts`: required
  real-PostgreSQL signed HTTP, backlog, history/receipt and current authority proof.
- `docs/CONTRACTS.md`: append precise optional property-queue query semantics.
- This order; NEW `handoff/reviews/CRM-20260930-department-routing-queue.md`.
- Append-only `DECISIONS.log` and `handoff/LEDGER.md` records.

No app.ts, UI, migrations, dependency, inventory, journal, payment, provider,
registration or task state change. Do not edit the previously accepted CRM test.
No merge, deployment, real guest data, credentials/settings export or paid fallback.

## Contract and acceptance

Existing `/api/v1/properties/{property}/departure-services` optionally accepts
`?target_role_id={uuid}`. Unknown or foreign role IDs yield no matching requests
only after current property authority succeeds; do not reveal role existence.
All current roles/staff metadata and eligibility remain unchanged. The selection
does not assign work or narrow/widen the actor's command permissions. Reservation
history and commands still reject query parameters and retain exact chronology.

Prove100 earlier roleA unfinished requests hide a later roleB request on the
unfiltered queue; filteredB returns it and filteredA retains its bounded order.
Create role/request fixtures through the current configuration and canonical
commands, including genuine assigned/in-progress states. Preserve no-filter
behavior, completed outcomes, reservation history and exact completion replay.
Real signed scope/property denials, foreign tenant/property, grant revocation and
actor disablement must remain effective. Fingerprint every public table's row
contents and actual public sequence states around successful/denied reads.

Required proof mode rejects missing authority, owner runtime and mismatched target
before fixtures; never treat a skip as acceptance. An independent non-implementer
personally executes high-risk proof. Run existing departure PostgreSQL and
contract/HTTP suites, accepted CRM backlog proof, typecheck, import boundaries and
complete staged/basis whitespace checks. Unchanged `./setup.sh --db-only`11/11
remains required before PR. Inherited license and legacy-offer gates remain RED
unless a separately governed repair actually resolves them. No self merge/deploy.

This is one useful operational slice, not whole CRM/PMS completion. The cap still
applies per selected role; staff inbox/acknowledgement, pagination, shifts and SLA
need separately verified commands and scoped work. Hotel/STR and multi-Airbnb/
co-host connections share these canonical tasks and property permissions.

## 2026-09-30 proof checkpoint

Implementation is frozen for independent final staging review. Independent
non-implementer personally reproduces baseline0/1/13 (filtered endpoint absent)
and candidate1/0/40 on required restricted-runtime PostgreSQL; missing runtime,
owner runtime and mismatched target reject before fixtures. Signed grants,
revocation, disabled actor, foreign property/tenant and full public row/sequence
fingerprints are checked. Reviewer personally focused14/0/62, types and205-file
boundaries; builder additionally reports existing departure12/0 and accepted
CRM backlog1/0. Coordinator unchanged canonical setup exits0 with11/11. Exact
hashes and limitations are in the dated review. No personal inbox, raw URL size
guard, second-tenant successful queue, laptop integration or release GREEN claim.
The contract repair investigation separately confirms physical-offer dedup is a
production contract discrepancy as well as fixture drift; historical RED proof
is retained and this order does not alter offers or license policy.
