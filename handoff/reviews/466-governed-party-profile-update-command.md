# Order 466 — independent governed Party-profile update review

Reviewer: Codex independent agent `/root/astra_review` (non-implementer).
Date: 2026-09-20.
Current decision: **ACCEPT the bounded Order466 source after independent focused,
typecheck and 11/11 referee proof.** The follow-up below closes both initial blockers.
No remaining blocking finding for this source. Deployment, live execution and fixture
repair remain separately scoped; this is not approval to perform them.

The initial review and its rejection below are retained as history, not erased.

## Scope and source identity

Canonical authority: `handoff/orders/466-governed-party-profile-update-command.md`.
Reviewed/executed source root:
`D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.
The runtime's older Order466 invoice-workflow document is not authority for this work.
Reviewed PROJECT.md, the canonical order, migration, CRM service/export, tests and
contracts/events using Yellow entity and PostgreSQL review rules.

SHA256 of reviewed runtime files:

| File | SHA256 |
| --- | --- |
| migrations/0092_governed_party_profile_update.sql | 105CA27C2F4D7FCB4F8BB6DFB6EB28B5A8C615D80EB9B4D863A006497DD47DDA |
| src/contexts/crm/parties.ts | 970A2C3D3D323750836F7026A5E04F2F396C29E0A8DF65E58E18AFF11B8674E7 |
| src/contexts/crm/index.ts | 5A1F6939F907BEC6F6851504C0ECEA4A348E9E25B7C56771E84185A356E75F32 |
| tests/party-profiles.integration.test.ts | F804E9DB5C1083F59E09403C72CF8CDE9E64C6E05A29F926AF5A4E431A060573 |
| docs/CONTRACTS.md | 6523C698AEDA18299F60F2543DD3F59822602CAF2C435937B57A062121819E4A |
| docs/EVENTS.md | 8B85506E19F00AF4162484DE1063D3E6B59004F1E45C44573ABD0808C4588B03 |

## Personally executed commands and results

Working directory was the runtime source root above. Only the expressly authorized
isolated loopback cluster on port55504 was used, never public port55503.

```powershell
$env:YELLOW_DEPLOY_DATABASE_URL = 'postgres://yellow_deploy@127.0.0.1:55504/yellow_order465_party_profiles_test'
$env:YELLOW_RUNTIME_DATABASE_URL = 'postgres://yellow_runtime@127.0.0.1:55504/yellow_order465_party_profiles_test'
$env:YELLOW_REQUIRE_PARTY_PROFILES = '1'
bun test tests/party-profiles.integration.test.ts --timeout 120000
```

Bun1.3.14: **9 pass, 0 fail, 139 expect() calls, 5.79s, process exit0**.
This includes the new direct UPDATE SQLSTATE42501, stale CAS SQLSTATE40001,
wrong-property/actor, later-update replay and rollback fingerprint assertions.

```powershell
& .\node_modules\.bin\tsc.exe --noEmit
```

**PASS, exit0**, no diagnostics. The earlier attempt using a nonexistent `tsc.cmd`
shim was not a typecheck pass; this execution supersedes that tooling limitation.

Prior reviewer run of the earlier test hash5037129959B863EACA0D33FA74FB80137F84EBA9C9132395553AC3F6A79BB613
passed9/0 with132 assertions in6.22s; its missing-coverage rejection is retained here
as history, not recharacterized as complete proof.

## Initial findings and remaining gates — superseded by follow-up below

1. **P2: successful-command preservation is not yet proved.** The only
   `protectedTableFingerprint()` baseline is at test line1182, after all successful
   commands. Its line1234 comparison covers only the deliberately rolled-back
   command. A forbidden successful UPDATE would already be included in that baseline.
   Capture protected state before the first successful update and compare after
   success, replay and no-op, retaining the separate rollback check. Include forbidden
   payment data and non-name Party columns/other Party rows, not just the current
   twelve-table helper. Use content fingerprints rather than counts. This directly
   closes the order's protected-state preservation requirement.
2. **Mandatory independent referee remains outstanding.** This reviewer did not run
   the canonical11/11 invariant battery in this turn. Order466 expressly requires
   it before any live-demo use; the focused suite is not a substitute. Execute it
   against an appropriately isolated, seeded database, never the public database.

Additional useful coverage, not newly asserted as product defects: function ACL and
session-role hostility; no-op replay; identical-key retry after update rollback;
omitted legal name preserving an existing non-null name and explicit-null clearing.

## Positive findings and limits

- SQL checks runtime session/app-role/owner identity and transaction-local tenant;
  property and active actor are same-tenant. The active Party is locked and stale
  expected names fail compare-and-swap. Runtime direct Party UPDATE remains denied.
- Only display/legal names are changed. Actual changed fields are computed from the
  locked row. Minimized fact/outbox evidence and the service's idempotency receipt
  commit together; business date derives from the property's timezone.
- The service uses the governed command, not direct UPDATE. Its receipt is stable
  under later edits; current-state rereads no longer replace replay results. Optional
  legal-name semantics are explicit in the contract.
- Executed rollback proof covers both names, fact/outbox/idempotency counts and the
  listed protected-table content hashes. That is genuine rollback proof, not proof
  of successful-command preservation.
- No public database, provider, credentials, runtime promotion or fixture repair was
  accessed/performed. The test's setup/cleanup and injected trigger were confined to
  its explicitly authorized isolated database. Only this review document was edited.
- This change does not implement an authenticated Party-edit HTTP/UI route and does
  not authorize attrs reconciliation, seed execution or Order461/public readiness.

## Independent follow-up — both blockers closed, 2026-09-20

The nonimplementing reviewer personally reran the same focused command and the same
`tsc.exe --noEmit` command documented above. Results: **9 pass, 0 fail,143 assertions,
5.81s, exit0**; **typecheck exit0, no diagnostics**.
New test SHA256:
`DF25618A68937956AA6B10CE7B2501BAFAF66E49DE8BD89AA5139F8787759F9C`.
Migration, service, export and both contract/event hashes remain exactly as listed
above. The old test hash and143-versus139 assertion change are intentionally retained.

The test now fingerprints before its first successful command and compares after
first update/replay, no-op, later update/replay and display-only update, in addition
to rollback. It includes non-name Party columns, payments/payment instruments,
addresses/memberships/Party relationships and the previously protected tables.
This closes the successful-command preservation gap. The Party hash excludes the
two permitted name columns across that tenant; exact single-Party targeting is also
verified by the migration/service predicates, not claimed as an all-column hash of
every non-target Party. No additional product-code defect was found.

### Personally executed independent referee

The reviewer inspected `setup.sh` and did **not** run its shared Compose/credential/
database-reset workflow. Instead, the identical canonical seed and invariant runner
were executed on a newly created disposable database in the already-authorized
isolated cluster at127.0.0.1:55504. No public port55503 or shared credentials were used.
Before cloning, the source test database was read-only verified to contain92
migrations and zero tenant rows after its own test cleanup. The clone was a fresh
database copy of that reviewed92 frontier, **not a claimed fresh migration replay**.

Exact setup and execution commands, from the runtime source root:

```powershell
python -c "import psycopg2; c=psycopg2.connect('host=127.0.0.1 port=55504 dbname=postgres user=yellow_deploy'); c.autocommit=True; q=c.cursor(); q.execute('CREATE DATABASE yellow_astra466_referee_20260920 OWNER yellow_deploy TEMPLATE yellow_order465_party_profiles_test'); print('Created isolated referee clone'); c.close()"
Get-Content -Raw tests/seed_fixture.sql | python -c "import psycopg2,sys; c=psycopg2.connect('host=127.0.0.1 port=55504 dbname=yellow_astra466_referee_20260920 user=yellow_deploy'); q=c.cursor(); q.execute(sys.stdin.read()); c.commit(); print('Canonical referee fixture seeded'); c.close()"
$env:YELLOW_DSN = 'host=127.0.0.1 port=55504 dbname=yellow_astra466_referee_20260920 user=yellow_deploy'
$env:PYTHONIOENCODING = 'utf-8'
python tests/run_invariants.py yellow_astra466_referee_20260920
```

All commands exit0. Referee output:

```text
PASS TC-12.1 50-thread exclusive race: winners=1
PASS TC-12.2 private vs beds never coexist: exclusive=0 beds=6
PASS TC-12.3 40 threads for 6 beds: claims=6
PASS TC-12.4 direct occupancy INSERT blocked:42501
PASS TC-12.5 throughput:162 commits in1.04s =156/s
PASS TC-5.6 unbalanced journal rejected at COMMIT
PASS TC-7.1 balanced journal commits
PASS TC-5.4 posting to sealed day blocked
PASS TC-8.2 concurrent invoice numbers: issued=100 range=1..100
PASS TC-13.1 table RLS: A=16 B=0 tenant_tables=119 rls=119 policies=119
PASS TC-13.4 view RLS: A=2 B=1 views=2 security_invoker=2
RESULT: 11 passed, 0 failed of 11
```

Runner SHA256: `2AFA95BB7C02CD9637FFC9C3DF00D1DDF7CFC5D8D31C4FD8FAD29B950C1A418D`.
Seed SHA256: `F8E8147800BC3EE24BA5020B70F95AD77A987C698D3C63DD664ED8D4CBA1A409`.
The clone's latest `schema_migration` row was personally checked as version92 with
checksum equal to the reviewed0092 source hash. After verifying the exact clone name
and owner through `pg_database`, the reviewer dropped only
`yellow_astra466_referee_20260920` without FORCE. Its synthetic test data is removed
and reproducible from the documented seed; original Party test database remains intact.

The reviewer-executable focused/type/referee gates requested for Order466 are now
satisfied. This acceptance does not claim source publication, fresh migration replay,
schema-drift/CI/PR completion, HTTP/UI editing, public readiness, or authorization for
live migration/Party reconciliation/reseed. Those retain their own scoped gates.
