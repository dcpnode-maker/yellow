# Order 651 independent review — governed housekeeping command

Reviewer: Codex child agent `/root/order651_housekeeping_review`
Date: 2026-09-23
Scope reviewed:

- `src/demo/governed-housekeeping-command.ts`
- `src/app.ts` route `POST /api/v1/demo/governed/housekeeping/condition`
- demo action-safety/readiness/proof/share truth updates
- `docker-compose.yml` `DATABASE_URL`
- focused tests and real PostgreSQL 18 proof

## Verdict

Rejected pending repair.

The confirmation gate, configured-database behavior, tenant transaction path, focused tests, and clean PG18 invariant referee proof pass. The confirmed route proof against the existing demo room `303` updated `unit_condition`, wrote exactly one `outbox` event, and did not move occupancy, folio, journal, posting, payment, document, or statutory table counts.

However, the implementation is not limited to updating an existing selected demo room. `executeGovernedHousekeepingCommand()` accepts arbitrary syntactically valid `roomCode` values, then calls `ensureDemoSpace()` before reading state. `ensureDemoSpace()` inserts into `space` and `unit_condition` when the room does not already exist. That widens the command from "unit_condition update + one outbox event" into a room-fixture creation command for confirmed calls, which contradicts Order 651's acceptance and the advertised proof-bundle/action-safety truth that the command mutates only `unit_condition` plus `outbox`.

Finding:

- P1 — Confirmed command can create `space` and `unit_condition` rows for arbitrary valid room codes.
  Evidence: `src/demo/governed-housekeeping-command.ts:69-70` calls `ensureDemoSpace(tx, roomCode)` inside the confirmed transaction. `ensureDemoSpace()` inserts into `space` at `src/demo/governed-housekeeping-command.ts:163-168` and inserts into `unit_condition` at `src/demo/governed-housekeeping-command.ts:179-183`. The route passes any string `roomCode` through at `src/app.ts:158-162`; `normalizeRoomCode()` only checks a loose format and defaults invalid values, it does not require the canonical demo room.
  Required repair: reject unknown/non-demo room codes or reread only a pre-existing demo room before the update. Do not insert `space` from this command path. If initial `unit_condition` fixture repair is still desired, it needs separate explicit order/proof because it is a different mutation family.

## Commands and results

Project grounding:

```text
Get-Content -Raw PROJECT.md
./state.sh
bash ./state.sh
```

`./state.sh` produced no output under PowerShell. `bash ./state.sh` failed because this host exposes only the Windows WSL launcher and `/bin/bash` is unavailable.

Focused source/test inspection:

```text
git diff -- src/demo/governed-housekeeping-command.ts src/app.ts src/demo/proof-bundle.ts src/demo/share-packet.ts src/demo/colleague-readiness.ts docker-compose.yml tests/demo-governed-housekeeping-command.test.ts tests/colleague-demo-proof-bundle.test.ts tests/colleague-demo-readiness.test.ts tests/demo-action-safety-matrix.test.ts tests/demo-share-packet.test.ts src/demo/action-safety-matrix.ts
Get-Content -Raw src/demo/governed-housekeeping-command.ts
Get-Content -Raw tests/demo-governed-housekeeping-command.test.ts
Get-Content -Raw src/kernel/index.ts
```

Focused tests:

```text
bun test tests/demo-governed-housekeeping-command.test.ts tests/demo-action-safety-matrix.test.ts tests/colleague-demo-proof-bundle.test.ts tests/colleague-demo-readiness.test.ts tests/demo-share-packet.test.ts
```

Result:

```text
17 pass
0 fail
196 expect() calls
Ran 17 tests across 5 files.
```

Static gates:

```text
bun run typecheck
bun run boundaries
```

Results:

```text
$ tsc --noEmit
```

```text
Import boundaries OK: 18 TypeScript files scanned
```

PostgreSQL service/version:

```text
docker compose ps
docker exec yellow-postgres-1 psql -U yellow -d yellow_dev -v ON_ERROR_STOP=1 -c "select version();"
```

Result: `yellow-postgres-1` was healthy and running PostgreSQL 18.6.

Pre-proof fixture/readiness:

```text
docker exec yellow-postgres-1 psql -U yellow -d yellow_dev -v ON_ERROR_STOP=1 -c "select count(*) public_tables from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"
docker exec yellow-postgres-1 psql -U yellow -d yellow_dev -v ON_ERROR_STOP=1 -c "select count(*) filter (where code='303') as demo_space_303, count(*) as spaces from space where tenant_id='6d9b7ce2-2d14-5576-b8c3-80f06501a603' and property_node='4518a22f-b455-54c6-a50a-4584383749b9'; select count(*) from unit_condition uc join space s on s.id=uc.space_id where uc.tenant_id='6d9b7ce2-2d14-5576-b8c3-80f06501a603' and s.code='303';"
```

Results:

```text
public_tables = 81
demo_space_303 = 1
spaces = 1
unit_condition rows for room 303 = 1
```

Real route proof, confirmed command against existing room `303`:

```text
docker exec yellow-postgres-1 psql -U yellow -d yellow_dev -v ON_ERROR_STOP=1 -c "select 'before' as phase, (select count(*) from unit_condition) unit_condition, (select count(*) from outbox) outbox, (select count(*) from space_occupancy) space_occupancy, (select count(*) from folio) folio, (select count(*) from journal) journal, (select count(*) from posting_line) posting_line, (select count(*) from payment) payment, (select count(*) from payment_instrument) payment_instrument, (select count(*) from document) document, (select count(*) from document_series) document_series, (select count(*) from statutory_submission) statutory_submission; select s.code, uc.condition, uc.updated_by from unit_condition uc join space s on s.id=uc.space_id where uc.tenant_id='6d9b7ce2-2d14-5576-b8c3-80f06501a603' and s.code='303';"
$env:DATABASE_URL='postgres://yellow:yellow@localhost:5442/yellow_dev'; bun -e "import { app } from './src/app'; const response = await app.handle(new Request('http://localhost/api/v1/demo/governed/housekeeping/condition',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({roomCode:'303',condition:'dirty',confirmationPhrase:'CONFIRM YELLOW OPERATION'})})); console.log(response.status); console.log(JSON.stringify(await response.json(), null, 2));"
docker exec yellow-postgres-1 psql -U yellow -d yellow_dev -v ON_ERROR_STOP=1 -c "select 'after' as phase, (select count(*) from unit_condition) unit_condition, (select count(*) from outbox) outbox, (select count(*) from space_occupancy) space_occupancy, (select count(*) from folio) folio, (select count(*) from journal) journal, (select count(*) from posting_line) posting_line, (select count(*) from payment) payment, (select count(*) from payment_instrument) payment_instrument, (select count(*) from document) document, (select count(*) from document_series) document_series, (select count(*) from statutory_submission) statutory_submission; select count(*) as event_count from outbox where correlation_id='5943ab47-b053-4c85-8503-d9008253d208' and tenant_id='6d9b7ce2-2d14-5576-b8c3-80f06501a603' and event_type='housekeeping.unit_condition_changed'; select s.code, uc.condition, uc.updated_by from unit_condition uc join space s on s.id=uc.space_id where uc.tenant_id='6d9b7ce2-2d14-5576-b8c3-80f06501a603' and s.code='303';"
```

Results:

```text
before: unit_condition=1, outbox=2, space_occupancy=0, folio=0, journal=0, posting_line=0, payment=0, payment_instrument=0, document=0, document_series=0, statutory_submission=0
route status=200
proof.beforeCondition=pickup
proof.afterCondition=dirty
proof.outboxSeq=3
proof.correlationId=5943ab47-b053-4c85-8503-d9008253d208
proof.authoritativeReread.condition=dirty
proof.authoritativeReread.outboxEventFound=true
after: unit_condition=1, outbox=3, space_occupancy=0, folio=0, journal=0, posting_line=0, payment=0, payment_instrument=0, document=0, document_series=0, statutory_submission=0
event_count for correlation = 1
```

Unconfirmed/no-DB proof:

```text
bun -e "import { executeGovernedHousekeepingCommand } from './src/demo/governed-housekeeping-command'; const started=Date.now(); const result=await executeGovernedHousekeepingCommand({databaseUrl:'postgres://yellow:yellow@127.0.0.1:1/unused', roomCode:'303'}); console.log(JSON.stringify({elapsedMs:Date.now()-started, result}, null, 2));"
$env:DATABASE_URL='postgres://yellow:yellow@localhost:5442/yellow_dev'; bun -e "import { app } from './src/app'; const response = await app.handle(new Request('http://localhost/api/v1/demo/governed/housekeeping/condition',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({roomCode:'303',condition:'inspected'})})); console.log(response.status); console.log(JSON.stringify(await response.json(), null, 2));"
docker exec yellow-postgres-1 psql -U yellow -d yellow_dev -v ON_ERROR_STOP=1 -c "select 'after_unconfirmed_route' as phase, (select count(*) from unit_condition) unit_condition, (select count(*) from outbox) outbox, (select count(*) from space_occupancy) space_occupancy, (select count(*) from folio) folio, (select count(*) from journal) journal, (select count(*) from posting_line) posting_line, (select count(*) from payment) payment, (select count(*) from payment_instrument) payment_instrument, (select count(*) from document) document, (select count(*) from document_series) document_series, (select count(*) from statutory_submission) statutory_submission;"
```

Results:

```text
invalid-port unconfirmed call: elapsedMs=0, confirmed=false, executed=false, realPmsExecuted=false, proof=null
unconfirmed route status=200, confirmed=false, executed=false, realPmsExecuted=false, proof=null
after_unconfirmed_route: unit_condition=1, outbox=3, space_occupancy=0, folio=0, journal=0, posting_line=0, payment=0, payment_instrument=0, document=0, document_series=0, statutory_submission=0
```

Tenant/RLS proof:

```text
docker exec yellow-postgres-1 psql -U yellow -d yellow_dev -v ON_ERROR_STOP=1 -c "begin; select set_config('app.tenant_id','00000000-0000-0000-0000-000000000001',true); set local role app_role; select current_setting('app.tenant_id', true) as tenant_context, count(*) as visible_wrong_tenant from unit_condition where tenant_id='6d9b7ce2-2d14-5576-b8c3-80f06501a603'; rollback; begin; select set_config('app.tenant_id','6d9b7ce2-2d14-5576-b8c3-80f06501a603',true); set local role app_role; select current_setting('app.tenant_id', true) as tenant_context, count(*) as visible_correct_tenant from unit_condition where tenant_id='6d9b7ce2-2d14-5576-b8c3-80f06501a603'; rollback;"
```

Results:

```text
wrong tenant context visible_wrong_tenant = 0
correct tenant context visible_correct_tenant = 1
```

Referee proof:

First attempt on existing `yellow_test` failed because the database was already dirty from prior runs:

```text
$env:PYTHONUTF8='1'; python tests/run_invariants.py
```

Result:

```text
FAIL TC-12.1 winners=0
then aborted at sealed business date 2026-09-15
```

I then reproduced the `setup.sh --db-only` reset path natively because this Windows host does not have a usable Bash shell:

```text
docker compose exec -T postgres psql -U yellow -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yellow_test WITH (FORCE)" -c "CREATE DATABASE yellow_test"
$env:DATABASE_URL='postgres://yellow:yellow@127.0.0.1:5442/yellow_test'; bun scripts/migrate.ts
Get-Content tests\seed_fixture.sql | docker compose exec -T postgres psql -U yellow -d yellow_test -v ON_ERROR_STOP=1
docker compose exec -T postgres psql -U yellow -d yellow_test -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
$env:YELLOW_DSN='dbname=yellow_test user=yellow password=yellow host=127.0.0.1 port=5442'; $env:PYTHONUTF8='1'; python tests/run_invariants.py yellow_test
```

Results:

```text
DROP DATABASE
CREATE DATABASE
migration applied: 0001_init.sql
migration summary: applied=1 status=applied backend_pid=11112 transaction_pids=11112
yellow_test public tables = 81
RESULT: 11 passed, 0 failed of 11
```

## Notes

- `src/kernel/index.ts` uses `SELECT set_config('app.tenant_id', ..., true)` followed by `SET LOCAL ROLE app_role` in `withTenantTransaction()`, satisfying the transaction-local tenant context requirement for this command path.
- I did not edit implementation files. This review file is the only file I changed.

## Addendum — P1 repair re-review

Reviewer: Codex child agent `/root/order651_housekeeping_review`
Date: 2026-09-23
Scope: P1 repair only.

Verdict: P1 repaired and approved.

The repaired implementation removes `ensureDemoSpace()` and performs the room-scope check before creating a `Database` connection. Confirmed `roomCode=999` now returns `executed=false` / `realPmsExecuted=false` / `proof=null`, and a direct invalid-port call returns in `0 ms`, confirming the out-of-scope path exits before DB use. Live PostgreSQL counts stayed flat: no `space` row for `999`, no `unit_condition` row for `999`, and no new `outbox` row.

Confirmed `roomCode=303` still updates the existing `unit_condition` row and writes exactly one `housekeeping.unit_condition_changed` outbox event. Counts moved only from `outbox=5` to `outbox=6`; `unit_condition` stayed at `1`, and `space_occupancy`, `folio`, `journal`, `posting_line`, `payment`, `payment_instrument`, `document`, `document_series`, and `statutory_submission` remained `0`.

Commands and results:

```text
git diff -- src/demo/governed-housekeeping-command.ts tests/demo-governed-housekeeping-command.test.ts handoff/reviews/651-governed-housekeeping-command.md
Get-Content -Raw src/demo/governed-housekeeping-command.ts
Get-Content -Raw tests/demo-governed-housekeeping-command.test.ts
```

The implementation no longer contains `ensureDemoSpace()`. It checks `roomCode !== DEFAULT_ROOM_CODE` before `Database.connect(...)`.

```text
bun test tests/demo-governed-housekeeping-command.test.ts
```

Result:

```text
5 pass
0 fail
25 expect() calls
Ran 5 tests across 1 file.
```

Baseline before out-of-scope proof:

```text
before_recheck: space_999=0, unit_condition_999=0, unit_condition=1, outbox=5, space_occupancy=0, folio=0, journal=0, payment=0, document=0, statutory_submission=0
```

Out-of-scope route proof:

```text
$env:DATABASE_URL='postgres://yellow:yellow@localhost:5442/yellow_dev'; bun -e "import { app } from './src/app'; const response = await app.handle(new Request('http://localhost/api/v1/demo/governed/housekeeping/condition',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({roomCode:'999',condition:'dirty',confirmationPhrase:'CONFIRM YELLOW OPERATION'})})); console.log(response.status); console.log(JSON.stringify(await response.json(), null, 2));"
bun -e "import { executeGovernedHousekeepingCommand } from './src/demo/governed-housekeeping-command'; const started=Date.now(); const result=await executeGovernedHousekeepingCommand({databaseUrl:'postgres://yellow:yellow@127.0.0.1:1/unused', confirmationPhrase:'CONFIRM YELLOW OPERATION', roomCode:'999', condition:'dirty'}); console.log(JSON.stringify({elapsedMs:Date.now()-started, result}, null, 2));"
```

Results:

```text
route status=200
confirmed=true
executed=false
realPmsExecuted=false
databaseConfigured=true
reason="Room 999 is outside the governed public-demo housekeeping command scope."
proof=null
invalid-port direct call elapsedMs=0
```

Post-999 counts:

```text
after_999: space_999=0, unit_condition_999=0, unit_condition=1, outbox=5, space_occupancy=0, folio=0, journal=0, payment=0, document=0, statutory_submission=0
```

Accepted `303` proof:

```text
before_303: unit_condition=1, outbox=5, space_occupancy=0, folio=0, journal=0, posting_line=0, payment=0, payment_instrument=0, document=0, document_series=0, statutory_submission=0
$env:DATABASE_URL='postgres://yellow:yellow@localhost:5442/yellow_dev'; bun -e "import { app } from './src/app'; const response = await app.handle(new Request('http://localhost/api/v1/demo/governed/housekeeping/condition',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({roomCode:'303',condition:'inspected',confirmationPhrase:'CONFIRM YELLOW OPERATION'})})); console.log(response.status); console.log(JSON.stringify(await response.json(), null, 2));"
```

Results:

```text
route status=200
proof.beforeCondition=pickup
proof.afterCondition=inspected
proof.outboxSeq=6
proof.correlationId=cdd8e2ea-0db3-4197-a1e3-5771cebbbc0a
proof.authoritativeReread.condition=inspected
proof.authoritativeReread.outboxEventFound=true
```

Post-303 counts:

```text
after_303: unit_condition=1, outbox=6, space_occupancy=0, folio=0, journal=0, posting_line=0, payment=0, payment_instrument=0, document=0, document_series=0, statutory_submission=0
event_count for cdd8e2ea-0db3-4197-a1e3-5771cebbbc0a = 1
room 303 condition=inspected updated_by=00000000-0000-0000-0000-000000000651
```
