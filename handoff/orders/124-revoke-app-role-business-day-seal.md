# Order 124 — Revoke application-role business-day sealing

**Status:** APPROVED at exact executable `b93574d3d9f2b5d5712173dfe7c160088a457521`; metadata head `8d95c834df4cbaf72b079f69d0b6f0e58269db2b`; not merged, pushed, deployed or live
**Phase:** 5 · Cyber remediation
**Branch:** `phase-5/revoke-app-role-day-seal`
**Base:** `9f97bd0c7301259f1242003b3e84bf674d238eee` — independently approved
Order 123 metadata head; exact reviewed executable `be279bb09536c6b122575f275cd11e09161e057e`
**Risk tier:** 3 — financial-close authority, forward migration and SECURITY DEFINER ACL
**Finding:** sealed Cyber `Cross-tenant destructive SECURITY DEFINER maintenance remains executable by PUBLIC and app_role`, occurrence `occ_0c5b4cfc4934049849c99d8f`
**Owner:** Codex implementation; independent non-implementing Tier-3 review required

## Admission gate

Order 123 independently passed Tier-3 review under D-359 and its governance-only
approval is present at the exact Base above. Parent-red and implementation work may
proceed only from this immutable line. No branch, migration number or dashboard is
treated as canonically merged, deployed or live merely because this admission gate is
discharged.

## Canonical finding disposition

The sealed scan originally proved two destructive direct-SQL paths:

- `public.prune_outbox(interval '-100 years')` was executable by PUBLIC/app_role and
  deleted published outbox rows across tenants;
- `public.seal_business_day(tenant,property,date,user)` was executable by
  PUBLIC/app_role and accepted caller-selected close attribution.

Order 108 already hardened search paths, revoked PUBLIC from both functions, revoked
`app_role` from `prune_outbox`, and rejects negative retention with SQLSTATE `22023`.
It intentionally retained `app_role` execution on `seal_business_day`. Order 118 makes
`app_role` NOLOGIN and unassumable, reducing direct-principal reachability, but the
remaining grant is still broader than the scan's required authority and permits any
SQL already executing inside a trusted application transaction to seal that tenant's
day with caller-selected `sealed_by`.

No production service or HTTP route currently performs day close. The safe current
boundary is therefore to revoke application execution completely. A later continuous
day-close order must introduce an audited typed command, server-derived actor, readiness
and approval policy before granting any narrowly scoped close capability. This order
does not invent that future workflow or preserve an unsafe grant for it.

## Outcome

After one forward migration, neither PUBLIC nor `app_role` can execute
`seal_business_day`. Only the deployment owner retains PostgreSQL's ownership authority,
used by deployment/referee proofs and emergency administration. Ordinary application
transactions cannot seal a day directly. Existing authorized posting behavior and the
sealed-day latch remain exact. `prune_outbox` containment and every Order 108 function
body remain byte-identical.

## Migration reservation

The next executable current-line migration is `0013`. Reserve
`migrations/0013_revoke_app_role_business_day_seal.sql` for this release-blocking high
finding. The approved but unimplemented finance drafts move mechanically without
semantic change:

- Orders 109–114: migrations 0014–0019 respectively;
- Order 115: setup/migration accounting through 0019.

Every planned table count remains unchanged. This renumbering is planning metadata,
not product implementation, and must be recorded visibly before the migration lands.

## Exact scope after unblocking

- `migrations/0013_revoke_app_role_business_day_seal.sql` only; never edit 0001–0012;
- `tests/business-day-seal-authority.integration.test.ts` for exact parent-red/current-green authority and attribution proof;
- `tests/security-definer-containment.integration.test.ts` only to change the exact expected seal ACL from app-allowed to app-denied;
- `tests/financial-postings.integration.test.ts` only to execute the existing seal-latch setup through deployment-owner authority and preserve the app-role denial/cross-tenant proof;
- `tests/migrate.integration.test.ts` and `tests/database-acceptance.integration.test.ts` only for migration ledger/checksum and exact ACL assertions;
- `scripts/run-phase-3-gate.ts` and `tests/phase-3-gate-runner.test.ts` only to add the new isolated proof exactly once;
- regenerated `tests/schema/expected.sql` only if a clean dump proves the ACL change;
- `docs/SECURITY.md`, `docs/CONTRACTS.md` and `docs/STATE-MACHINES.md` only for the owner-only current boundary and future audited-close requirement;
- `handoff/orders/109-transfer-adjustment-reversal.md`,
  `handoff/orders/110-token-only-payment-foundation.md`,
  `handoff/orders/111-hosted-payment-deposit-workbench.md`,
  `handoff/orders/112-governed-cashier-sessions.md`,
  `handoff/orders/113-folio-settlement-receivables.md`,
  `handoff/orders/114-trust-negative-authorization.md`,
  `handoff/orders/115-phase-5-finance-journey-gate.md`, and
  `handoff/PHASE-5-PLAN.md` only for the mechanical 0014–0019 reservation shift;
- `src/project-status.ts` and its founder-status assertions only after all gates are green, recording built/current Order 124 without advancing independent coverage;
- this order, one question if the exact integrated line conflicts, `DECISIONS.log`, `handoff/LEDGER.md`, and the independent review record.

Anything else is out of scope. A need for a new runtime role, API, approval, event,
table, policy, UI or scheduler stops this order and requires a later product order.

## Required implementation

1. The forward migration must fail if the exact function is absent, then revoke all
   execution from `app_role` without changing its signature, owner, body, search path,
   PUBLIC ACL or any other function/grant.
2. Preserve owner execution for deployment/referee proofs. Do not add a LOGIN role,
   membership, password, maintenance role, finance role or application fallback.
3. Preserve Order 108 exactly: PUBLIC denial, non-negative prune validation, fully
   qualified relations, safe `pg_catalog, public, pg_temp` search paths and all other
   function ACLs remain byte-equivalent.
4. Existing posting code never gains direct close authority. Tests that need a sealed
   day use the deployment-owner fixture explicitly; an app-role transaction must get
   SQLSTATE `42501` before changing `business_day`.
5. Documentation must state that owner-only execution is a temporary least-privilege
   containment boundary, not the completed continuous day-close product. Future close
   must be an authorized audited domain command with server-derived actor evidence.

## Forbidden

- modifying applied migrations, the seal/prune function bodies, RLS, business-day
  state semantics, posting logic, `tests/run_invariants.py`, or protected files;
- granting seal to another existing role, creating a role/credential, adding an API,
  treating owner DSN use as safe runtime architecture, or closing the runtime-superuser
  sibling finding;
- changing retention policy, outbox pruning, occupancy, finance correction semantics,
  day-close readiness/approval policy, or UI;
- using caller body/header/query identity for `sealed_by`, weakening exact tenant
  checks, self-review, self-merge, push, deployment or live-status claims.

## Pre-registered proof

### P0 — exact-parent red

On the immutable approved Order 123 parent in a fresh isolated PostgreSQL cluster,
personally prove PUBLIC is already denied and negative pruning already fails `22023`,
then show `app_role` still has function privilege and, inside a valid tenant-local
transaction, can seal an open day while selecting an arbitrary same-tenant `sealed_by`.
Prove a mismatched tenant remains denied; this red is narrower than the original scan
because Order 108/118 controls are retained honestly.

### P1 — exact ACL and migration

Fresh migrations through 0013 produce one exact ledger/checksum entry. PUBLIC and
`app_role` both lack EXECUTE on seal; owner retains execution. All five sibling definer
ACLs, all function definitions/search paths, public-table/RLS counts and schema outside
the one ACL are unchanged.

### P2 — application denial and latch preservation

An ordinary `Database.withTenantTransaction` receives `42501` for any seal attempt,
including its own tenant and a foreign tenant, and writes no `business_day` change.
The deployment-owner fixture can still seal one exact open day once; repeat/missing day
fails exactly; posting versus seal locking and sealed-day posting denial remain green.

### P3 — no substitute authority

Catalogue proof shows no new role, membership, password, grant, API route, service,
worker or scheduler. Static diff proves no application product file acquired a seal
call. The future audited-close gap remains explicitly planned, not silently simulated.

### P4 — cumulative and independent review

Run the new focused proof, Order 108/118 security proofs, financial-posting suite,
complete current-line isolated matrix with the new mapping once, migrations/deployment,
standing/type/boundaries/licences/audit, exact schema/protected hashes and pristine
referee 11/11. A Tier-3 reviewer personally reproduces P0 and P1–P3 on exclusive fresh
clusters and confirms the scan occurrence's PUBLIC/app-role destructive paths are
closed while runtime-superuser and future audited-close work remain open.

## Definition of done

- [x] Order 123 exact integration tip is independently approved and recorded as Base.
- [x] Migration 0013 reservation and finance 0014–0019 shifts are collision-free.
- [x] Parent red proves only the remaining app-role seal authority; already-fixed
      PUBLIC/prune/tenant controls stay green.
- [x] PUBLIC/app_role seal denial and owner-only latch behavior pass from fresh state.
- [x] Full cumulative/referee/schema/hash/standing gates pass.
- [x] Independent Tier-3 reviewer approves the immutable executable SHA.
- [x] Only occurrence `occ_0c5b4cfc4934049849c99d8f` is discharged; owner-runtime,
      occupancy tenant binding and future day-close product gaps remain open.

## Builder evidence

Exact-parent red `fa234482db4c396c2cd1e3f262f9d25ed3820f01` preserves PUBLIC denial,
negative-prune `22023` and mismatched-tenant `42501`, then proves `app_role` still
selects a same-tenant actor and seals the day. Exact executable
`b93574d3d9f2b5d5712173dfe7c160088a457521` adds only migration 0013 and its scoped
proof/documentation changes. Fresh focused authority, containment, posting, runner,
database-acceptance and schema proofs pass; pinned Linux migrations pass 17/17; the
native-WSL cumulative restart passes 18/18; standing passes 171/0; typecheck,
64-file boundaries, 23 installed licences, dependency audit and protected hashes pass;
and a pristine 85-table referee passes 11/11 with healthy PostgreSQL, Valkey and exact
app health 200. Windows migration remains 16/17 only because its temporary symlink
fixture receives host `EPERM`, and Windows/bind-mounted matrix attempts stopped at the
disclosed inherited Order-069 timing ceiling before the full native-WSL restart.
This is builder evidence only: no occurrence is discharged before independent review.
