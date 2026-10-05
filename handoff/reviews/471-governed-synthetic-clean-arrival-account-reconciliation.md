# Order471 — independent account reconciliation source review

Reviewer: Codex `/root/astra_review`, non-implementer. Date: 2026-09-20.
Current decision: **ACCEPT the fourth frozen Order471 source / no deployment
approval**. The fourth reviewer-executed follow-up below passes focused7/63,
typecheck, effective catalogue/ACL checks, fresh migrations and referee11/11, and
demonstrates payment activity ordering plus account-wide rejection. Original
findings and earlier rejected candidates remain as history; the final section
states residual coverage limits and the exact bounded approval.

Canonical authority: `handoff/orders/471-governed-synthetic-clean-arrival-account-reconciliation.md`.
Reviewed runtime root:
`D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.
Migration: `0094_governed_synthetic_clean_arrival_account_reconciliation.sql`.
SHA256: `B967775B0D9171581E9C9F8B47700B66EA51DA2D0464127A2A49CDB9D76FD17A`.

This was a source-only review applying PROJECT.md and Yellow PostgreSQL/entity
patterns. No database connection, command execution, source/test edit, public access
or secret access occurred. Only this review document was created. Source analysis
below is not claimed as executed negative proof.

## Blocking findings

### P1 — missing tenant context bypasses the definer guard (lines11–12)

`v_tenant := NULLIF(current_setting('app.tenant_id',true),'')::uuid` can be NULL.
The guard uses `v_tenant <> p_tenant` without an explicit NULL check or null-safe
comparison. With absent/empty context and all other valid inputs, the IF expression
is NULL rather than TRUE, so PostgreSQL skips the rejection. Subsequent SELECTs use
caller parameters under the owning SECURITY DEFINER role, which is precisely where
the missing-context check must be authoritative. The ordinary application wrapper
setting context correctly does not protect direct execution of this granted SQL
capability. This violates the explicit transaction-local tenant boundary.

Require non-null context and `IS DISTINCT FROM` for the expected tenant/identity/name
checks. Handle malformed context fail-closed with a controlled error as in0093.
Test a raw yellow_runtime transaction with SET LOCAL ROLE app_role and *no*
set_config, then empty/malformed/foreign context, not only the trusted wrapper.
No changed account or audit rows may survive any denial. Explicitly reject nullable
input bypasses rather than relying on downstream account.name NOT NULL failures.

### P1 — required no-payment guard is absent (line19)

Only `posting_line` is queried. An account can have payment activity without a
posting: migration0021 links `payment_operation.guest_account_id`/`folio_id`, with
payments linked by operation_id and authorization/pending/indeterminate phases that
need not have a journal posting. Thus the source does not enforce Order471's
explicit requirement of no postings **or payments**.

Implement a same-tenant/account/folio-bound payment guard using the existing payment
operation relationships; define conservatively whether any pending operation also
blocks this empty-fixture-only command. Existing operations with payment rows must
not be missed merely because no posting exists. Prove the boundary against pending/
authorization and posted cases plus concurrent activity; never contact a provider.

### P1 — identity and property-timezone truth are not revalidated

The account, reservation and folio are locked, but the function never validates or
locks the actual property, active actor or canonical active Party/guest-role state.
Hardcoded UUIDs and financial foreign keys establish identity links, not active
authorization or current property timezone. A disabled/missing actor is particularly
important: fact_log/outbox actor columns do not themselves supply that validation.
The function can also attach a correction to a no-longer-canonical Party/role shape.

Line23/24 derive business_date using literal UTC without checking the property's
timezone, unlike the accepted0093 command. If that property's timezone changes,
the recorded date can violate PROJECT invariant7 near midnight. Lock and validate
the source property and derive its date, or explicitly require its locked timezone
to remain UTC for this fixed fixture. Lock/revalidate the active actor and required
canonical Party/role relationships in an established consistent order before change.
Add wrong/inactive/missing/racing relationship proofs rather than treating UUID
constants as complete authorization.

### P2 — Order471 proof and event contract are absent

Source search found no test invocation of
`reconcile_synthetic_clean_arrival_account`, no `account.reconciled` registration in
EVENTS.md, and no command contract in CONTRACTS.md. The implementation currently
consists of the migration. Prior Party tests/referee results do not execute this
new financial-context capability or prove its grants/guards. Its order also lacks
an explicit file Scope list; admit the migration/test/contract/review paths before
continuing under the standing scoped-order rule.

## Positive source findings — not executable acceptance

- Exact constants bind tenant/property/Party/reservation/account/primary-folio/actor;
  caller-selected arbitrary non-null targets and arbitrary non-null names are
  rejected. The account requires guest role, USD, no credit limit and open status.
  Reservation identity/primary Party/confirmation and folio account/reservation/
  window1/open status are checked under FOR UPDATE locks.
- Account name uses CAS (`IS DISTINCT FROM`) and an equal canonical name returns a
  no-op. The only explicit domain UPDATE is account.name. Fact/outbox writes are in
  the same function transaction and contain only account identity, field name and
  request correlation, not the name value. No journal/posting/payment writes exist.
- The account lock is FOR UPDATE, not merely FOR NO KEY UPDATE. Existing immediate
  account foreign keys in migrations0001/0010 require a conflicting key-share lock
  for new posting rows. This is a credible fence for concurrent posting insertion;
  do **not** characterize the bare NOT EXISTS as the complete concurrency mechanism.
  Executable races in both lock orders remain required, with rejection if a prior
  posting commits before the reconciliation obtains its lock.
- Owner/search_path, PUBLIC revocation and app-role EXECUTE follow the existing
  guarded-function pattern. Direct account UPDATE is revoked at table level.
  Verify effective table and column privileges and alternate-role denial in the
  actual isolated database; source REVOKE alone is not executed ACL proof.

## Minimal acceptance proof plan

1. Freeze the corrected migration/contract/test hashes and apply them through the
   normal runner to a fresh isolated target. Preserve forward-only history; do not
   edit an already-applied migration in a retained/shared environment.
2. Run the actual SQL capability through yellow_runtime/app_role: changed once,
   canonical no-op, stale CAS, every wrong fixed identity and nullable input; raw
   absent/empty/malformed/foreign tenant context; wrong session/role; direct table
   and column UPDATE denial. Assert zero deltas for each rejected command.
3. Prove non-guest/closed/wrong-currency/credit-limit account, wrong/closed/nonprimary
   folio, broken reservation, inactive actor and canonical Party/role/property
   mismatch. Include posting and payment-operation/payment hostility separately.
4. Use two real connections and observable pg_blocking_pids synchronization for
   account/folio/reservation/property/actor/role drift and posting/payment races;
   do not substitute fixed sleeps or mocked calls. Revalidate after waits.
5. Inject AFTER INSERT outbox failure for `account.reconciled`. Compare account
   name, complete protected content fingerprints and fact/outbox state before/after,
   then retry after removing the test trigger. Check exactly one matching minimized
   pair with correct actor/request/property/date on success and none on no-op.
6. Fingerprint every other account and all non-name target columns, Party/roles/
   contacts/reservation/segments/guests/folios/occupancy/journals/postings/payment
   operations/payments/documents/identities/users around success and rollback.
7. Independent reviewer personally executes focused proof, typecheck where relevant
   and a canonical11/11 referee on an owned disposable database. Record commands,
   hashes and results. Source approval remains separate from any later live order;
   that order must preserve preflight fingerprints before the one allowed change.

No financial balance correction, generic account editing, fixture seed, live use or
Order461 readiness is authorized by this review.

## Revised-source-only follow-up — 2026-09-20

Reviewed0094 SHA256:
`A6C453E6C7E070FE24DE344FB486186D81A8CE8A8FDBA90D4C9A975D3404DE27`.
No database access or executable test was performed in this follow-up.

### Three original source findings addressed

- Explicit `v_tenant IS NULL` and `v_tenant IS DISTINCT FROM p_tenant` now reject
  absent/empty and mismatched tenant context before the protected reads.
- The command now locks/verifies the actual UTC property, active same-tenant actor,
  active unmerged person and exact canonical guest-role detail before mutation.
  Literal UTC business-date derivation is therefore anchored to locked property
  truth rather than an unchecked assumption.
- `payment_operation` existence by same-tenant guest account **or** primary folio
  now blocks the command. Migration0021 makes payment.operation_id NOT NULL and
  binds payments to operations, so this conservatively excludes linked payment
  activity, including unposted operations. Existing immediate account/folio foreign
  keys provide a relevant insertion fence while FOR UPDATE locks are held. Actual
  payment/posting interleavings still require executable proof.

These are source-review conclusions only, not proof that the revised function was
applied correctly or that its runtime behavior has passed the required hostility.

### P2 — incompatible shared lock order with accepted0093

Revised0094 locks **property -> actor -> Party**, while accepted0093 locks
**Party -> property -> actor**. A concurrent0094 can hold property while0093 holds
Party; each then requests the other's lock. PostgreSQL will abort one transaction
as a deadlock. That is not a claim of committed financial corruption, but it is an
avoidable failure in the shared-runtime correction workflow and conflicts with the
requested consistent locking/race proof.

Align the shared row-lock order before acceptance and add an observable two-session
proof covering both correction commands. Do not weaken the relationship locks or
change approved retained migration history merely to avoid the conflict. No
independent deadlock execution was performed in this source-only task.

### Still required before acceptance

The Order471-specific tests, account.reconciled event registration and command
contract remain absent in the inspected runtime tree. The canonical order still
needs an explicit admitted file scope. The complete seven-step proof plan above
remains applicable: fresh isolated migration; direct/raw tenant-context/role/target
denial; account/folio/Party/actor/property mismatches; existing and racing postings/
payment operations; successful/no-op/CAS behavior; after-outbox rollback/retry and
complete protected-state hashes; independent focused/type/referee11/11 evidence.

Validation polish to include with tests: malformed tenant context currently raises
the cast error rather than a controlled42501; remaining `<>` target/name checks are
not uniformly null-safe, so null inputs rely on later row/NOT NULL rejection. No
additional successful bypass through those remaining inputs is asserted here.

No source deployment, live reconciliation, balance change or public-readiness
approval follows from the three source repairs.

## Frozen-source executable review — 2026-09-20

Reviewer: Codex `/root/astra_review`, independent non-implementer. Applying
PROJECT.md and the Yellow PostgreSQL/entity patterns, I personally executed the
proof below; these are not implementer-pasted results. No runtime source/test was
edited. Only this canonical review was updated. No public database, port55503,
private environment file, public URL, provider or live application was accessed.

### Frozen bytes verified before and after execution

| Runtime file | SHA256 |
| --- | --- |
| migrations/0094_governed_synthetic_clean_arrival_account_reconciliation.sql | `867F54D3F94655FC5AA4B631433C37ED173AA20BB6E515F9DF39D52E1C1B7C89` |
| tests/synthetic-account-reconciliation.integration.test.ts | `E2E1FF6E45B3D559738E7E5C81E810A47222AEB2EDCD8772EAFF196979424BF1` |
| docs/EVENTS.md | `888BE5AF5F2B6A6B440110BE16C404C8D6492F03CE394ECC55059C7B72B398E4` |
| docs/CONTRACTS.md | `FDD9E024F9AFD989DE47322F4A396F4E155AAB4424304A2DB4DEE1D9A6475DAA` |

### Executed commands and outcomes

All commands ran from the runtime root above. Every connection was explicitly
bound to loopback55504 using the non-secret isolated test roles.

```powershell
$env:YELLOW_DEPLOY_DATABASE_URL='postgres://yellow_deploy@127.0.0.1:55504/yellow_order471_accountproof3'
$env:YELLOW_RUNTIME_DATABASE_URL='postgres://yellow_runtime@127.0.0.1:55504/yellow_order471_accountproof3'
$env:YELLOW_REQUIRE_SYNTHETIC_ACCOUNT_RECONCILIATION='1'
bun test tests/synthetic-account-reconciliation.integration.test.ts --timeout 120000
.\node_modules\.bin\tsc.exe --noEmit
```

Focused result: **3 passed, 0 failed, 22 assertions**, Bun1.3.14. Typecheck exit0.
The focused test personally demonstrates direct account UPDATE denial42501;
changed result and one minimized evidence pair; canonical no-op; stale CAS40001;
wrong fixed tenant/property/Party/reservation/account/folio/actor42501; closed folio
denial; AFTER-outbox exception rollback of its measured state followed by clean
retry; and an observable account-row lock wait followed by successful execution.

Using Python3.13/psycopg2 connected as yellow_deploy to the same loopback cluster's
`postgres` database, I executed exactly:

```sql
CREATE DATABASE yellow_astra471_referee_20260920
  OWNER yellow_deploy TEMPLATE template0;
```

This was a fresh empty database, not a clone of the implementer's seeded database.
Then:

```powershell
$env:YELLOW_DEPLOY_DATABASE_URL='postgres://yellow_deploy@127.0.0.1:55504/yellow_astra471_referee_20260920'
bun scripts/migrate.ts
$env:YELLOW_RUNTIME_DATABASE_URL='postgres://yellow_runtime@127.0.0.1:55504/yellow_astra471_referee_20260920'
bun test tests/synthetic-account-reconciliation.integration.test.ts --timeout 120000
Get-Content -Raw tests/seed_fixture.sql | & 'C:/Users/astha/AppData/Local/Programs/Python/Python313/python.exe' -c "import psycopg2,sys; c=psycopg2.connect('host=127.0.0.1 port=55504 dbname=yellow_astra471_referee_20260920 user=yellow_deploy'); c.cursor().execute(sys.stdin.read()); c.commit(); print('Canonical fixture seeded'); c.close()"
$env:YELLOW_DSN='host=127.0.0.1 port=55504 dbname=yellow_astra471_referee_20260920 user=yellow_deploy'
$env:PYTHONIOENCODING='utf-8'
& 'C:/Users/astha/AppData/Local/Programs/Python/Python313/python.exe' tests/run_invariants.py yellow_astra471_referee_20260920
```

Normal runner: **94 migrations applied**, versions1–94, exit0. Fresh focused run:
**3 passed, 0 failed, 22 assertions**, exit0. Unmodified canonical fixture seeded.
Referee: **11 passed, 0 failed of11**, exit0: exclusive winner1; private/bed claims
never coexist; positional claims6; direct occupancy INSERT42501;162 concurrent
commits; unbalanced journal rejected; balanced journal committed; sealed-day
posting rejected;100 gapless invoice numbers;119/119 tenant tables with RLS/policies;
2/2 security-invoker views. This executes the referee directly with a dedicated DSN;
it is not a claim that setup.sh or the full application test suite was run.

Read-only psycopg2 catalogue queries on both isolated databases confirmed all94
schema_migration filename/checksum pairs equal current source SHA256 values, and
the stored0094 `pg_proc.prosrc` exactly equals the frozen SQL function body.
On accountproof3, the effective function catalogue additionally returned:

- Owner `yellow_owner`; SECURITY DEFINER true; search_path exactly
  `pg_catalog, public, pg_temp`.
- ACL `{yellow_owner=X/yellow_owner,app_role=X/yellow_owner}`; EXECUTE true for
  app_role, false for yellow_runtime directly and false for PUBLIC.
- Effective table UPDATE **and any-column UPDATE** false for both app_role and
  yellow_runtime on public.account.

Queries used `pg_get_userbyid(proowner)`, `prosecdef`, `proconfig`, `proacl`,
`has_function_privilege`, `aclexplode`, `has_table_privilege` and
`has_any_column_privilege`; database sessions were set read-only. The seeded
accountproof3 database was left intact apart from its authorized focused fixture
setup/cleanup. After verifying exact name and owner in pg_database, I dropped only
`yellow_astra471_referee_20260920` (without FORCE). Its disposable proof data is
reproducible with the commands above; no persistent/shared database was removed.

### Source findings now closed

The original missing-context bypass is repaired with a nonempty context guard,
controlled malformed-context rejection and null-safe comparisons for every fixed
target and desired name. Existing posting/payment activity guards are present.
Active unmerged Party, UTC property, active actor and canonical guest role are
locked and checked. Shared lock order now begins Party -> property -> actor,
matching0093; the earlier direct reverse-order cycle is removed by inspection.
The scoped order, event registration and bounded command contract are now present.
Only account.name is explicitly updated; immutable financial records are not
updated. Fact/outbox are in the same transaction and omit the actual account name.
These positive source conclusions do not fill the missing executable cases below.

### Remaining acceptance blockers — proof gaps, not demonstrated exploits

1. **P1 — required protected-table fingerprints are absent.** `targetState()`
   fingerprints only the one account minus name and one folio, plus counts of this
   account's reconciliation facts/events. It cannot detect changes to another
   account, Party/roles/contacts, reservations/segments/guests, occupancy, journals,
   postings, documents, payment operations/payments or other evidence. Order471
   explicitly requires protected-table fingerprints. Capture deterministic sorted
   content hashes before the first successful command and assert them after
   success, no-op, every rejected command, injected late failure and retry. Permit
   only target account.name and the precisely bound expected fact/outbox additions.

2. **P1 — no executable posting/payment boundary proof.** The three tests never
   create an existing posting or payment_operation and never race either insertion
   against the correction. The conservative account-or-folio payment predicate,
   no-postings predicate and their immediate FK/row-lock fencing remain source-only.
   Exercise existing posted and unposted payment-operation cases, separately cover
   the folio-only arm, and use real connections with observable blocking for
   activity-first and correction-first ordering. Assert rejection when activity
   commits before correction obtains its lock and no forbidden deltas on rejection.
   Do not contact providers or use live data.

3. **P2 — context/role and relationship hostility are incomplete.** Wrong UUID
   parameters are exercised, but no raw absent/empty/malformed/foreign tenant GUC,
   wrong session/current role, explicit NULL parameter, invalid desired name,
   inactive actor/Party, noncanonical guest-role detail, wrong property timezone,
   account role/currency/status/credit limit, reservation relationship or nonprimary
   folio case is executed. The helper uses `override ?? default`, so passing null
   through it would silently replace the intended hostile value; use a raw SQL
   invocation or distinguish undefined from null. Include unchanged protected-state
   assertions per denial, and validate fact.actor_id plus both business dates in
   addition to the currently asserted outbox actor/property/correlation/payload.

4. **P2 — observed wait is not revalidation/race proof.** The third test holds
   account FOR UPDATE, observes a waiter, and commits without changing the row.
   It therefore proves serialization on an unchanged account only. Mutate a
   relevant account/relationship predicate while holding the lock, commit, then
   require the waiting command to reject with no side effects. Bind the observed
   blocking PID to the actual contender; exercise the relevant folio/reservation/
   shared Party chain and both0093/0094 commands where lock-order compatibility is
   claimed. The referee's occupancy races do not test this command.

**Verdict: REJECT acceptance pending these targeted permanent proofs and fresh
reviewer execution.** No focused test, typecheck, migration or referee failure was
observed; green tests are accurately limited to what they assert. No current
successful tenant bypass, financial corruption or account mutation exploit is
claimed. Canonical no-op is a new request carrying the current expected name;
repeating the original stale expected-name request returns40001, not an idempotent
receipt replay. This is a one-fixture offline SQL capability, not an authenticated
public account editor. No live deployment, seed, balance correction, readiness or
application-complete approval is granted.

## Second frozen-source executable review — 2026-09-20

Reviewer: the same independent non-implementer `/root/astra_review`. Decision:
**REJECT acceptance pending remaining proof gaps**. This section supersedes the
previous section's coverage statements where explicitly noted; no failed
production behavior or exploit is asserted.

### Frozen source and personally executed result

Expanded test SHA256:
`507C719944BDA2614FAA90825BA4B1C16306A718C8C29F06E72369BC35859E34`.
Migration remains
`867F54D3F94655FC5AA4B631433C37ED173AA20BB6E515F9DF39D52E1C1B7C89`;
EVENTS and CONTRACTS remain the exact hashes in the preceding frozen table.
All four hashes matched before and after this review. I read the expanded test
completely and applied Yellow PostgreSQL/entity rules; I changed no implementation.

I created another empty reviewer-owned database through psycopg2 on explicit
loopback55504/postgres as yellow_deploy:

```sql
CREATE DATABASE yellow_astra471b_referee_20260920
  OWNER yellow_deploy TEMPLATE template0;
```

From the runtime root, I executed:

```powershell
$env:YELLOW_DEPLOY_DATABASE_URL='postgres://yellow_deploy@127.0.0.1:55504/yellow_astra471b_referee_20260920'
bun scripts/migrate.ts
$env:YELLOW_RUNTIME_DATABASE_URL='postgres://yellow_runtime@127.0.0.1:55504/yellow_astra471b_referee_20260920'
$env:YELLOW_REQUIRE_SYNTHETIC_ACCOUNT_RECONCILIATION='1'
bun test tests/synthetic-account-reconciliation.integration.test.ts --timeout 120000
.\node_modules\.bin\tsc.exe --noEmit
Get-Content -Raw tests/seed_fixture.sql | & 'C:/Users/astha/AppData/Local/Programs/Python/Python313/python.exe' -c "import psycopg2,sys; c=psycopg2.connect('host=127.0.0.1 port=55504 dbname=yellow_astra471b_referee_20260920 user=yellow_deploy'); c.cursor().execute(sys.stdin.read()); c.commit(); print('Canonical fixture seeded'); c.close()"
$env:YELLOW_DSN='host=127.0.0.1 port=55504 dbname=yellow_astra471b_referee_20260920 user=yellow_deploy'
$env:PYTHONIOENCODING='utf-8'
& 'C:/Users/astha/AppData/Local/Programs/Python/Python313/python.exe' tests/run_invariants.py yellow_astra471b_referee_20260920
```

Results: migrations **94 applied**; focused **5 passed, 0 failed, 38 assertions**
(2.45s, Bun1.3.14); typecheck exit0; canonical referee **11 passed, 0 failed**
(162 concurrent commits,119 tenant-RLS tables,2 security-invoker views). Every
command exited0. Independently repeated read-only catalogue checks verified all94
ledger checksums against source and byte-equality of effective0094 function body;
owner yellow_owner, SECURITY DEFINER, configured path and exact ACL remain as
previously recorded. Both app_role and yellow_runtime still lack table UPDATE and
any-column UPDATE on account. No prior implementer test result was substituted.

After validating the exact database name/owner in pg_database, I dropped only
`yellow_astra471b_referee_20260920`, without FORCE. This discards only reproducible
reviewer-owned fixture/proof data. Existing accountproof3 was not touched this
round. No live/public database, port55503, public app, secret or provider access.

### Newly demonstrated coverage

- Raw yellow_runtime connections with SET LOCAL ROLE app_role reject absent,
  empty, malformed and foreign transaction-local tenant context with42501; a raw
  connection without app_role also gets42501. Each compares targetState unchanged.
  This closes the previously absent raw tenant-context proof and the direct
  wrong-current-role case; it is not a wrong-session-user-with-app_role test.
- The real account lock test now changes account.status to closed while the
  contender is observably blocked; after commit the contender rejects42501.
  Thus post-wait account-state revalidation is now demonstrated, not merely a wait
  on an unchanged account. Contender-specific PID binding and other relationship
  races remain absent.
- An actual preexisting payment_operation linked to both target account and folio
  causes42501 with unchanged targetState. A real balanced pair of posting lines
  including the target account independently causes42501. These close the total
  absence of existing-operation/posting proof; no payment provider is involved.
- A deterministic tenant content fingerprint now covers14 selected table groups
  after first successful change and canonical no-op. This is a material improvement
  but does not yet satisfy the preservation claim for the reasons below.
- Previous changed/no-op/CAS/fixed-target/direct-UPDATE/evidence and late-outbox
  rollback/retry cases continue passing.

### Remaining blockers and precise next proof

1. **P1 — preservation oracle still has substantive blind spots.** The account
   hash removes `name` from **every account**, allowing an unrelated account rename
   to escape detection. Exclude name only for the exact target UUID; preserve every
   column of all other accounts and include a non-target account sentinel in the
   success baseline. Hashes omit reservation_segment, reservation_guest, contacts,
   org_node, app_user, payment_instrument and business_day, among other protected
   structures. They are invoked only twice, after first success and no-op, never
   around late-outbox failure/retry, stale/hostile calls, lock rejection or activity
   rejection. Add the protected domains from the original plan and compare their
   hashes at each boundary, taking baselines after intentional fixture mutations.
   The current rollback test still only compares account/folio plus evidence counts.
   Excluding all target account.reconciled rows from general evidence hashes also
   requires an exact separate oracle for their complete content/count at each step.

2. **P1 — financial concurrency and independent payment arms remain unproved.**
   There is no concurrent posting/payment_operation insertion test in either lock
   order. The existing operation matches both account and folio, so deletion of
   either OR predicate arm would leave that test green. Add valid account-only and
   folio-only activity arrangements where the schema permits them; assert real
   blocking and post-wait behavior for activity-first and correction-first ordering.
   In particular, require activity committed before correction acquires its account/
   folio lock to be observed and rejected, and verify no partial correction/evidence.
   No actual payment row is created in this suite. The existing NOT NULL/FK linkage
   from payment to payment_operation supports coverage by the operation guard in
   source, but do not claim executed payment-row or authorization/posted-payment
   coverage; add a representative linked row if that claim is desired.

3. **P2 — relationship/nullable-input hostility remains partial.** Other than
   account closing during a wait and closed folio, fixed-target UUID substitutions
   are still the only relationship hostility. Exercise inactive actor/Party, missing
   or noncanonical guest role, wrong property timezone, account role/currency/credit
   limit, reservation binding and nonprimary folio as valid isolated fixtures. Test
   an alternate session user with app_role, NULL inputs and invalid desired name.
   The `??` helper still replaces explicit nulls with defaults; do not use it to
   claim NULL rejection. Relevant folio/reservation/shared-row races and0093/0094
   compatibility remain source-inspected rather than personally executed. Evidence
   assertions still omit fact.actor_id and both property-local business dates.

The smallest useful next change is permanent tests closing these exact holes,
not more source churn or additional claim wording. Existing source repairs remain
positively reviewed. **No live deployment/seed/account repair or full acceptance
is authorized by the passing5/38, typecheck and11/11 results.**

## Third frozen-source executable review — 2026-09-20

Independent reviewer `/root/astra_review`; **REJECT final acceptance pending the
remaining financial concurrency proof**. Source remains positively reviewed. This
section narrows and corrects prior findings; earlier missing cases are not all
still missing after remediation.

Frozen test SHA256:
`B692A6D5BB64156F80FDB0274829F2C347DE711399D14342A33FB1C2C42EA018`.
Migration0094 remains
`867F54D3F94655FC5AA4B631433C37ED173AA20BB6E515F9DF39D52E1C1B7C89`.
EVENTS/CONTRACTS retain their recorded hashes. All four hashes were independently
checked before/after execution and stayed unchanged. No implementation edits.

### Personally executed proof

Created a fresh empty reviewer-owned database via psycopg2 connected explicitly to
loopback55504/postgres as yellow_deploy:

```sql
CREATE DATABASE yellow_astra471c_proof_20260920
  OWNER yellow_deploy TEMPLATE template0;
```

From the runtime root:

```powershell
$env:YELLOW_DEPLOY_DATABASE_URL='postgres://yellow_deploy@127.0.0.1:55504/yellow_astra471c_proof_20260920'
bun scripts/migrate.ts
$env:YELLOW_RUNTIME_DATABASE_URL='postgres://yellow_runtime@127.0.0.1:55504/yellow_astra471c_proof_20260920'
$env:YELLOW_REQUIRE_SYNTHETIC_ACCOUNT_RECONCILIATION='1'
bun test tests/synthetic-account-reconciliation.integration.test.ts --timeout 120000
.\node_modules\.bin\tsc.exe --noEmit
```

Results: normal runner **94 applied**; focused **6 passed,0 failed,57 assertions**
(2.78s, Bun1.3.14); typecheck exit0. I then executed unchanged seed_fixture.sql via
the preceding section's psycopg2 stdin command, substituting only this third
database name, followed by:

```powershell
$env:YELLOW_DSN='host=127.0.0.1 port=55504 dbname=yellow_astra471c_proof_20260920 user=yellow_deploy'
$env:PYTHONIOENCODING='utf-8'
& 'C:/Users/astha/AppData/Local/Programs/Python/Python313/python.exe' tests/run_invariants.py yellow_astra471c_proof_20260920
```

Referee **11 passed,0 failed**, exit0;162 concurrent commits,119/119 tenant tables,
2 security-invoker views. Read-only catalogue checks confirmed ledger94/max94 and
the exact0094 checksum, plus the effective composite FK and required reference
columns discussed below. Owner/path/ACL/body checks from the prior review remain
evidence for unchanged migration bytes; they were not all repeated this round.
After validating exact name/owner, I dropped only this third disposable database,
without FORCE. Its proof data is reproducible. No public/live database, port55503,
secret, public app or provider access; no deployment.

### Findings closed or narrowed

- Account fingerprints now remove name only for the exact target UUID and retain
  all other account columns. The prior all-account-name exclusion is fixed.
- Fingerprints now include org_node, app_user, contact_point, reservation_segment,
  reservation_guest, payment_instrument and business_day along with previous
  protected domains. Broad protected-domain hashing is present.
- AFTER-outbox failure now compares the broad fingerprint as well as target
  state/counts. Rollback preservation at that boundary is personally demonstrated.
- Nine hostile-state cases now execute denial42501 with protected hashes unchanged:
  inactive actor, anonymised Party, wrong guest-role detail, non-UTC property,
  non-guest account, wrong currency, non-null credit limit, wrong reservation
  confirmation and nonprimary folio. Prior claims of absent state hostility are
  obsolete. Account-close revalidation, closed folio, raw tenant context, direct
  UPDATE, CAS/no-op, existing payment operation and balanced postings still pass.

### Reviewer correction: an impossible folio-only fixture is not required

Migration0021 and the effective catalogue prove:

```sql
FOREIGN KEY (tenant_id, guest_account_id, folio_id)
  REFERENCES folio (tenant_id, account_id, id)
```

Both guest_account_id and folio_id are NOT NULL. With the target folio bound to the
target account and locked by0094, a target-folio/foreign-account operation cannot
be valid. The earlier independent folio-only OR-arm test demand is **withdrawn as
a blocking requirement**. Never disable constraints to manufacture it. The valid
remaining case is activity on the target account through a *different* folio,
which detects a missing account-wide predicate that the current both-matching
fixture cannot catch.

No actual payment row is created, but payment.operation_id is mandatory and
FK-bound to payment_operation. Existing-operation rejection therefore has a sound
source-level link to payment exclusion. A representative payment-row test would
strengthen coverage; its absence alone is not an independent blocker and must not
be described as executed payment-row coverage.

### Outstanding focused proof

The principal blocker is still actual concurrent posting/payment_operation
insertion, not account-status drift. Use real connections and contender-bound
pg_blocking_pids for both orderings:

1. Commit valid financial activity while correction waits on its account/folio
   protection; require correction to observe it, reject42501 and preserve that
   post-activity baseline without account.reconciled additions.
2. Hold correction's transaction after its command and start valid activity;
   prove activity cannot cross the immediate FK protection before correction
   commits. Verify the allowed serial outcome or controlled rejection with no
   partial writes or duplicate correction evidence.
3. Include the valid same-account/different-folio operation case above.

Residual coverage limits: there is no non-target account sentinel during first
success; broad hashes are not checked after clean retry or every earlier hostile/
raw/fixed-target/activity call; the new relationship loop excludes target.name and
target reconciliation evidence without pairing targetState. Explicit NULLs still
cannot be tested through the `??` helper. Alternate session user, invalid desired
name, fact.actor_id, both business dates, additional relationship races and
concurrent0093/0094 compatibility are not executed. Close the small oracle/input/
evidence gaps or describe them accurately; do not claim exhaustive execution of
the original seven-step plan.

No test/type/referee failure or source exploit was observed. **No final acceptance,
live fixture repair, seed, deployment or readiness approval is granted.**

## Fourth frozen-source executable review — 2026-09-20 — ACCEPT SOURCE ONLY

Reviewer: Codex `/root/astra_review`, independent non-implementer. **ACCEPT** this
exact Order471 source for its one fixed synthetic account-name capability. This
supersedes earlier candidate rejections, not their historical execution records.
No live/public migration, repair, seed, balance change or deployment is authorized.

### Exact candidate

- Migration0094 SHA256:
  `867F54D3F94655FC5AA4B631433C37ED173AA20BB6E515F9DF39D52E1C1B7C89`.
- Test SHA256:
  `7ACD9F6AB593C3D080FB2E16E483060B878543BABBF9CBEBD1274696C236B361`.
- EVENTS SHA256:
  `888BE5AF5F2B6A6B440110BE16C404C8D6492F03CE394ECC55059C7B72B398E4`.
- CONTRACTS SHA256:
  `FDD9E024F9AFD989DE47322F4A396F4E155AAB4424304A2DB4DEE1D9A6475DAA`.

All hashes were personally checked before and after execution. I inspected the
expanded test, unchanged source, contracts and relevant effective FK definitions.
Only this review was edited; no implementation or test source was changed.

### Personally executed fresh proof

Using psycopg2 as yellow_deploy connected explicitly to loopback55504/postgres:

```sql
CREATE DATABASE yellow_astra471d_proof_20260920
  OWNER yellow_deploy TEMPLATE template0;
```

From the reviewed runtime root:

```powershell
$env:YELLOW_DEPLOY_DATABASE_URL='postgres://yellow_deploy@127.0.0.1:55504/yellow_astra471d_proof_20260920'
bun scripts/migrate.ts
$env:YELLOW_RUNTIME_DATABASE_URL='postgres://yellow_runtime@127.0.0.1:55504/yellow_astra471d_proof_20260920'
$env:YELLOW_REQUIRE_SYNTHETIC_ACCOUNT_RECONCILIATION='1'
bun test tests/synthetic-account-reconciliation.integration.test.ts --timeout 120000
.\node_modules\.bin\tsc.exe --noEmit
```

Normal runner: **94 applied**, exit0. Focused: **7 passed,0 failed,63 assertions**,
3.27s on Bun1.3.14. Typecheck: exit0. No skips or implementer-pasted substitutes.

I repeated the unchanged canonical fixture seed through psycopg2 stdin, with this
fourth database as the explicit target, then ran:

```powershell
$env:YELLOW_DSN='host=127.0.0.1 port=55504 dbname=yellow_astra471d_proof_20260920 user=yellow_deploy'
$env:PYTHONIOENCODING='utf-8'
& 'C:/Users/astha/AppData/Local/Programs/Python/Python313/python.exe' tests/run_invariants.py yellow_astra471d_proof_20260920
```

Referee **11 passed,0 failed**, exit0: exclusive winner1, positional claims6,
direct occupancy42501,162 concurrent commits, journal balance/sealed-day checks,
100 gapless numbers,119 tenant-RLS tables and2 security-invoker views. This is the
canonical runner executed on a dedicated target, not an assertion that setup.sh
or the full application suite was run.

Independent read-only catalogue checks again proved all94 migration checksums
match source;0094 pg_proc.prosrc exactly matches the SQL function body; effective
owner yellow_owner, SECURITY DEFINER, search_path pg_catalog/public/pg_temp and
ACL only yellow_owner/app_role EXECUTE. Both app_role and yellow_runtime have no
effective account table UPDATE or any-column UPDATE. Effective posting_line
account foreign keys were also inspected: account_id -> account(id), and
(tenant_id,account_id,currency) -> account(tenant_id,id,currency), both NOT DEFERRABLE.

After checking its exact name and owner, I dropped only the reviewer-created
`yellow_astra471d_proof_20260920`, without FORCE. Its disposable synthetic data is
reproducible. No accountproof3 mutation this round, port55503, live/public target,
secret, provider or public application access.

### Why the remaining blocker is closed

The actual same-account/different-folio payment_operation now independently causes
rejection, demonstrating the account-wide activity predicate. The new race uses
real PostgreSQL connections and observed pg_blocking_pids, not a fixed delay:

- Activity-first: correction waits on its first Party lock; the holding transaction
  inserts and commits a valid operation through the second folio before releasing
  correction. Correction then rejects42501 and target name remains the drifted one.
- Correction-first: the actual runtime/app_role correction runs inside an open
  transaction. A valid concurrent operation is observably blocked by that correction
  PID; only after correction commits does activity finish and commit. Target name
  is canonical. This demonstrates the valid serial outcome, not a claim that
  financial activity must remain forbidden forever after the name repair.

Combined with existing-posting rejection, nine relationship-state denials,
raw-context/role and fixed-target rejection, actual account post-wait revalidation,
direct UPDATE denial, CAS/no-op behavior, minimized evidence, broad success/no-op
fingerprints, AFTER-outbox rollback fingerprints and clean retry, this satisfies
the order's bounded executable race/tenant/role/folio/preservation requirements.
The earlier source gaps are closed; no unresolved source defect was identified.

### Remaining limits — nonblocking for this fixed source, not claimed executed

There is no separate concurrent posting-line insertion test or actual payment-row
case. Existing postings are exercised; the effective immediate account FKs and
FOR UPDATE lock provide the inspected posting insertion fence. Payment-row
exclusion depends on its mandatory operation FK. Those are source/catalogue
arguments supplementing the personally executed payment races, not disguised
posting-race/payment-row execution. A general financial editor would require a
larger proof, but this function only changes the one fixed synthetic account.name.

Additional NULL/invalid-name/alternate-session vectors, a non-target account
sentinel during first success, complete evidence/date assertions on every branch,
each individual relationship race and simultaneous0093/0094 are still absent.
Existing lock observation predicates bind the known blocker, not the exact waiter
PID; on the fresh isolated serial test there was only the intended contender.
These are worthwhile regression-strengthening items, not discovered bypasses or
remaining blockers to this narrow source acceptance. The prior suggested full
matrix must not be represented as exhaustively executed. The impossible folio-only
OR-arm demand remains withdrawn as explained in the third review.

Acceptance is restricted to the four hashes above and the canonical fixed target,
CAS-only name update, empty-account/folio relationship guards and same-transaction
minimized fact/outbox. Any later live operation needs its own scoped authority,
current-target preflight, persisted protected-state baseline, exact migration
provenance and independently checked postflight. This review establishes no
historical live no-delta proof, generic editing capability, seed readiness, balance
correction, application completeness or deployment approval.
