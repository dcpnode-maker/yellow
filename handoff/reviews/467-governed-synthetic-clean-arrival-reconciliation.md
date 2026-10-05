# Order 467 — independent synthetic reconciliation review

Reviewer: Codex `/root/astra_review`, non-implementer. Date: 2026-09-20.
Current decision: **ACCEPT the bounded Order467 source at the final frozen hashes
below.** Independent focused/type/referee evidence closes the original P1 findings
and remaining proof gaps. Earlier rejected results remain below as history.
No live/public database was accessed. This source acceptance does not authorize
live migration, reconciliation, reseed or public-readiness claims.

## Reviewed source

Canonical order: `handoff/orders/467-governed-synthetic-clean-arrival-reconciliation.md`.
Runtime source: `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.
Review applied PROJECT.md and Yellow entity/PostgreSQL rules. No implementation or
test source was edited; only this review was written.

| File | SHA256 |
| --- | --- |
| migrations/0093_governed_synthetic_clean_arrival_reconciliation.sql | BDEDF2BFFD233CC5962C4F28D82339AAA277E7A64CEC8DF53A10C7D317331F4B |
| scripts/reconcile-synthetic-clean-arrival.ts | 393BDA331FCFAA5CE28BDC2F3E27BCEFE4D478F1BE4D29EF0C40FB5FFAD8C72C |
| tests/party-profiles.integration.test.ts | CFBD922C5DE29B9BC8FEF7CD4B984AA4EBB627EE8DE4B0DAA25DD0A3B250EAEE |
| docs/CONTRACTS.md | 79D3159310B69A7852DD804CFB40A04C7929D8B354314AF6DCC77432D703ED37 |
| docs/EVENTS.md | 98924828D7FFF138863F733EA8EBCEE801CD2FC1277AB3A4B3EFC553B6E6128B |

## Original blocking findings — P1 fixes verified in follow-up below

### P1 — relationship guards can become false before correction commits

Migration0093 checks property, active actor, reservation relationship and guest role
without locking them, then separately waits for `party FOR UPDATE`. These are
authorization/fixture-identity prerequisites, not advisory reads. The function does
not revalidate them after obtaining the Party lock and does not hold them stable
through commit.

Personally executed reproduction in the reviewer-owned disposable93 clone:

1. Insert only synthetic fixtures with the exact fixed IDs required by the command,
   canonical guest-role detail and ARR-CLEAN relationship, with drifted Party values.
2. Deploy transaction A: `SELECT id FROM party WHERE id=%s FOR UPDATE` for that Party.
3. Runtime transaction B: establish `set_config('app.tenant_id', %s, true)`,
   `SET LOCAL ROLE app_role`, then invoke the real reconciliation function with the
   fixed identities and matching expected/current values.
4. A separate observer verifies `cardinality(pg_blocking_pids(%s)) > 0` for B's PID,
   proving B has reached the Party lock after its earlier relationship checks.
5. A executes `UPDATE reservation SET confirmation_no=%s WHERE id=%s` with a
   noncanonical synthetic confirmation and commits. B then obtains the Party lock,
   completes the function and commits.
6. Read-only verification checks the canonical reservation predicate and counts the
   reconciliation event. The real result was:

```json
{"canonical_relationship_at_commit":false,"changed":true,"events":1}
```

Fix: acquire the necessary row locks in a consistent order and validate all required
relationships under locks retained through commit. Recheck after any blocking lock;
consider actor/property/role drift as well as reservation changes. Add a permanent
two-connection regression proving invalidation cannot race a successful correction.
The fix must follow forward-only migration policy; do not silently rewrite an
already-applied migration in a retained environment.

### P1 — offline command exposes raw database error detail

The script ends with uncaught `await main()`. Its happy-path message is minimized,
but database exceptions propagate to Bun's default error renderer. PostgreSQL DETAIL
can contain profile values (including the pre-reconciliation attrs).

Personally executed in the same private clone: restore the synthetic canonical
relationship and place an artificial privacy marker in the Party's current attrs.
Install a test-only BEFORE UPDATE trigger:

```sql
CREATE FUNCTION public.astra467_privacy_failure() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE='synthetic validation failure', DETAIL=OLD.attrs::text;
END;
$$;
CREATE TRIGGER astra467_privacy_failure BEFORE UPDATE ON party
FOR EACH ROW EXECUTE FUNCTION public.astra467_privacy_failure();
```

Run the actual offline script with its runtime URL pointing only at the private clone,
capture stdout/stderr instead of printing it, and test for the artificial marker:

```powershell
$captured = & bun scripts/reconcile-synthetic-clean-arrival.ts 2>&1
$probeExit = $LASTEXITCODE
```

Observed result: **exitCode1; leakedSyntheticPrivateMarker=true**. No real/private
value was used or disclosed. The failed command rolled back; all probe artifacts
were subsequently removed with the disposable database.

Fix: sanitized top-level failure handling with a nonzero exit status and a fixed or
allowlisted error code, never raw error/message/detail/stack/connection string.
Add a real-process failure test carrying a synthetic marker in database DETAIL.

### P2 — permanent Order467 proof does not meet its stated matrix

The added test exercises changed/no-op/stale CAS/wrong actor/direct-update denial and
successful protected-table hashes. It does not exercise wrong tenant/property/Party/
reservation identity, broken guest-role/reservation relationships, rejected desired
attribute shapes, or a `party.reconciled` outbox failure with rollback fingerprints.
The preceding Order466 trigger filters only `party.updated`; it does not test0093.
The offline script is not executed by the integration suite. Add the explicitly
required Order467 cases plus both reproductions above. Validate exact actor/request/
property evidence and minimized payload keys, not just absence of two name strings.

## Personally executed baseline proof

Commands ran from the runtime source root against the supplied isolated database
on127.0.0.1:55504. Connection values below are deliberately described by approved
environment names instead of recording connection strings in this Order467 review.
`YELLOW_DEPLOY_DATABASE_URL` and `YELLOW_RUNTIME_DATABASE_URL` targeted only
`yellow_order467_reconcile_20260920`, using its passwordless isolated deploy/runtime
test roles. `YELLOW_REQUIRE_PARTY_PROFILES=1` prevented silent skips.

```powershell
$env:YELLOW_REQUIRE_PARTY_PROFILES = '1'
bun test tests/party-profiles.integration.test.ts --timeout 120000
& .\node_modules\.bin\tsc.exe --noEmit
```

Results: **10 pass,0 fail,153 assertions,6.99s,exit0**; **typecheck exit0**.

## Personally executed canonical referee

Read-only preflight established zero tenant rows and93 migrations in the cleaned
isolated test database. Created only the unique reviewer-owned database:

```sql
CREATE DATABASE yellow_astra467_referee_20260920 OWNER yellow_deploy
TEMPLATE yellow_order467_reconcile_20260920;
```

Applied the unchanged `tests/seed_fixture.sql` in one transaction, then set
`YELLOW_DSN` to this clone on55504 and `PYTHONIOENCODING=utf-8` and executed:

```powershell
python tests/run_invariants.py yellow_astra467_referee_20260920
```

Result: **11 passed,0 failed of11; exit0**. Exclusive race1 winner; mixed race
exclusive1/beds0; capacity6; direct occupancy INSERT42501; throughput162 commits
in1.19s (136/s); unbalanced/sealed-day rejection, balanced commit, gapless100 numbers,
table RLS119/119/119 and security-invoker views2 all passed.
This is a fresh database clone of the reviewed93 frontier, not a claimed fresh
migration replay. The latest ledger row was personally checked to equal93 and the
reviewed0093 checksum. Both adversarial probes ran afterwards in this clone only.

After verifying the exact clone name and owner through `pg_database`, executed
`DROP DATABASE yellow_astra467_referee_20260920` without FORCE. Only that reviewer-
created disposable clone, synthetic fixtures and injected trigger were removed;
the original isolated test database and all public data remain untouched.

## Positive source observations and limits

Fixed identities, canonical desired attrs/name values, runtime role/tenant checks,
active unmerged person, Party CAS, three-column-only mutation, minimized same-Tx
fact/outbox and canonical no-op are present. No generic attribute editor or public
HTTP route was introduced. Those controls do not cure the demonstrated race or
failure-output leak. No live migration, reconciliation, fixture reseed, deployment
or public-readiness approval is granted.

## Revised-source independent follow-up — 2026-09-20

Current reviewed hashes:

| File | SHA256 |
| --- | --- |
| migrations/0093_governed_synthetic_clean_arrival_reconciliation.sql | C9201892E38BC8F3FBB55DEF457B7289E34CEE126282D57A386580B1F0C21346 |
| scripts/reconcile-synthetic-clean-arrival.ts | 29F831FE0E1D0E617C39F765C5278CE9817469FD26952701ED91D6872ECA42EA |
| tests/party-profiles.integration.test.ts | ABCA8D7CF14C6783ED343038FDA24CF815E0775FDEEDD4CBD395C04ADF57C0BB |

Personally reran the same focused Bun command and `tsc.exe --noEmit` from the runtime
root, with the required test flag and deploy/runtime environment variables now
targeting only `yellow_order467_reconcile_b_20260920` on isolated127.0.0.1:55504.
Results: **12 pass,0 fail,158 assertions,7.43s,exit0; typecheck exit0**.

### Original P1 findings closed

The command now locks the active target Party first, then locks and validates the
property, active actor, reservation relationship and canonical guest-role row. Those
row locks are retained through the correction transaction. The script catches
top-level failures and emits only a fixed generic message/nonzero status.

The reviewer personally executed the permanent two-connection regression and the
actual subprocess injected-DETAIL privacy test as part of the12 passing tests.
Additionally, the reviewer independently repeated the original changed-state race
probe in a separate disposable clone, explicitly waiting until
`cardinality(pg_blocking_pids(contender_pid)) > 0` before invalidating the reservation
in the holder transaction. This avoids relying on a timing sleep. The original
reproduction now correctly returns:

```json
{"events":0,"party_unchanged":true,"sqlstate":"42501"}
```

Thus both original product defects are closed on these exact hashes. No additional
product-code defect was found in this follow-up.

### Referee rerun on revised93 — passed

Read-only preflight verified zero tenant rows, frontier93 and the revised0093 ledger
checksum matching C9201892... above. Created only:

```sql
CREATE DATABASE yellow_astra467b_referee_20260920 OWNER yellow_deploy
TEMPLATE yellow_order467_reconcile_b_20260920;
```

Applied the unchanged canonical `tests/seed_fixture.sql` in one transaction and ran:

```powershell
python tests/run_invariants.py yellow_astra467b_referee_20260920
```

`YELLOW_DSN` pointed solely to this clone on55504; `PYTHONIOENCODING=utf-8`.
**11 passed,0 failed of11,exit0**. All eleven checks passed, including table/view RLS,
occupancy concurrency, journal/sealed-day guards and gapless numbering. The
deterministically synchronized race reproduction ran after this referee proof.
After verifying the exact database name and owner through `pg_database`, removed
only `yellow_astra467b_referee_20260920` without FORCE. All its synthetic probe data
was disposable; original isolated databases and public data were preserved.

### Remaining acceptance blockers — original P2 remains open

The permanent Order467 proof still lacks the order's wrong tenant/property/Party/
reservation identity cases, broken or missing guest-role/reservation relationship
cases, and rejection of noncanonical desired attributes. In particular, the helper
declares override parameters but only exercises actor override. Order466 tests do
not execute these0093 branches.

There is still no injected **AFTER INSERT outbox failure for party.reconciled** with
pre/post comparison of all three Party values, fact/outbox evidence and protected
table hashes. The new privacy trigger raises BEFORE UPDATE and asserts only process
output; it cannot prove rollback after0093 has changed Party and inserted its fact.
Add the explicit Order467 rollback case and an identical-state retry after removal
of the failure trigger. Also assert exact actor/request/property evidence and allowed
payload keys, rather than only checking absence of two particular strings.

Test reliability recommendation: replace the permanent race test's75ms sleep with
the observable lock-wait synchronization used by the independent reproduction;
otherwise a slow contender may test only ordinary post-change rejection. This is
not a new unresolved product defect.

Acceptance remains withheld for the stated proof gaps, not for the now-fixed P1s.
All live migration/reconciliation/reseed/public-readiness boundaries remain intact.

## Final frozen-source acceptance — 2026-09-20

**ACCEPT for the bounded source purpose. No remaining blocking finding.**

The reviewer personally inspected the completed negative/rollback cases, verified
the final test hash both before and after execution, and reran:

```powershell
$env:YELLOW_REQUIRE_PARTY_PROFILES = '1'
bun test tests/party-profiles.integration.test.ts --timeout 120000
& .\node_modules\.bin\tsc.exe --noEmit
```

The supplied deploy/runtime environment variables targeted only the passwordless
isolated test database `yellow_order467_reconcile_b_20260920` at127.0.0.1:55504.
Working directory was the reviewed runtime source root. Results:
**13 pass,0 fail,173 assertions,7.03s,exit0; typecheck exit0 without diagnostics**.

Final accepted SHA256:

| File | SHA256 |
| --- | --- |
| migrations/0093_governed_synthetic_clean_arrival_reconciliation.sql | C9201892E38BC8F3FBB55DEF457B7289E34CEE126282D57A386580B1F0C21346 |
| scripts/reconcile-synthetic-clean-arrival.ts | 29F831FE0E1D0E617C39F765C5278CE9817469FD26952701ED91D6872ECA42EA |
| tests/party-profiles.integration.test.ts | 49F2D069577D1B19722038B94B53311D86B0A5860EEDFDCDCF86157054DDCBC8 |
| docs/CONTRACTS.md | 79D3159310B69A7852DD804CFB40A04C7929D8B354314AF6DCC77432D703ED37 |
| docs/EVENTS.md | 98924828D7FFF138863F733EA8EBCEE801CD2FC1277AB3A4B3EFC553B6E6128B |

The expanded proof now exercises wrong tenant/property/Party/reservation/actor,
noncanonical desired attrs, corrupted guest-role detail and the invalidated
reservation relationship. The permanent race test observes a PostgreSQL blocker
before releasing the holder, rather than assuming a75ms delay establishes the race.
Evidence assertions check exact allowed payload keys, target/changed fields and
outbox actor/property/correlation against the controlled first request.

The reconciliation-specific AFTER INSERT outbox failure now executes the real0093
command, then proves rollback by comparing all three Party values, fact/outbox
counts and protected-table content hashes. Removing the injected trigger permits
retry. This particular rollback case changes attrs while preserving canonical names;
the comparison includes both names. The successful case separately changes all three
fields and verifies the minimized evidence and protected-state preservation. The
subprocess privacy regression continues to prove no artificial private DETAIL marker
escapes. This closes the previously identified proof matrix gaps.

The reviewer-executed revised93 referee **11 passed,0 failed** recorded immediately
above remains applicable: the accepted migration/script hashes are unchanged since
that run and the independent synchronized race probe. Only permanent test assertions
were completed afterwards; no fresh referee run is claimed for this final test-only
revision. All Order467 reviewer-executable focused/type/referee gates are satisfied.

An intermediate run passed13/0 with167 assertions in8.15s while the test changed from
98F186F9... to9AA0F16E...; it was explicitly treated as intermediate, not frozen-source
acceptance. The final173-assertion run above has identical pre/post49F2D069... bytes.

No implementation edits, live migrations, public database calls or seed/reconciliation
actions were performed by this reviewer. Isolated test setup/cleanup and the earlier
reviewer-owned disposable clones are described above. Source publication, fresh
migration replay/schema/CI gates, live deployment and a separately authorized exact
fixture operation remain distinct from this source acceptance.
