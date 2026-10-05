# Review 593 — governed departure service coordination

**Reviewer:** `/root/order593_independent_review` (non-implementing)
**Date:** 2026-09-22
**Verdict:** **REJECTED — changes required; no deployment/publication authority**
**Candidate:** `D:\Yellow\temp\order593-departure-coordination-source`

I did not implement Order 593. I read `PROJECT.md`, `AGENTS.md`, ran the Windows
state ritual, inspected the order and relevant decisions, and personally inspected
migration 0099, the domain/HTTP adapters, fixture, React surfaces and focused tests.
The public app/tunnel were not started.

## Blocking findings

1. **No required browser proof exists.** There is no Order-593 Playwright/Chromium
   journey at 240, 375 or 1440px. The focused frontend tests are parser/static-source
   assertions only. Therefore proposal-only/no-write behaviour, confirmation, queue
   progression, retained history, unknown evidence, keyboard access and viewport
   containment have not been executed in a browser as Required proof 11 demands.
2. **Repository strict TypeScript is red.** `bunx tsc --noEmit` fails on
   `tests/india-native-fiscal-credit-note-list.test.ts:57` (write to readonly
   `actorId`) and two JSX-import/config errors in
   `tests/yellow-cashier-bill-window-allocation.test.ts` and
   `tests/yellow-voice-bill-window-allocation.test.ts`. The narrower frontend
   strict check passes, but it cannot replace the order's strict TypeScript gate.
3. **Fresh `setup.ps1 -DbOnly` did not run.** It fails at the Docker-daemon
   prerequisite. I continued on a separately isolated native PostgreSQL 16.15
   database to preserve useful domain proof, but that is not the mandated fresh
   setup gate. The manually loaded referee passed 11/11; the required setup command
   remains unsatisfied.
4. **No executable departure-service HTTP proof exists.** The only executable
   Order-593 backend suites are the domain contract and direct service/PostgreSQL
   integration tests. Route mounting, request-body rejection, scope/property
   authorization, status/error mapping, idempotency headers, queue route and HTTP
   response minimization are inspected source, not an actual HTTP journey. Required
   proof 10 explicitly calls for HTTP coverage.
5. **The required race matrix is incomplete.** The suite executes one real
   checkout-vs-confirm race. Departure amendment, room move, withdrawal and expiry
   are changed sequentially before confirmation, not raced against it. Role/grant
   removal is also sequential. Consequently the mandated adjacent lock-order and
   no-partial-state claims for those competing transactions remain unproved.
6. **Departure voice does not carry its parsed proposal into the checkout card.**
   `App.tsx` parses a requested service/timing and says it “prepared” that proposal,
   but `OverwatchCheckoutJourney` receives only the reservation/completed/room
   fields and initializes to `luggage_pickup` + `immediate`. A spoken minibar,
   inspection, escalation or delayed luggage request therefore opens the default
   card rather than the announced selection. In addition,
   `departureServiceConfirmationIntent` is referenced only by its unit test and has
   no mounted App consumer, so the claimed bounded “yes” confirmation path is not
   implemented. The static source test does not expose either mismatch.

## Personally executed evidence

### Source and frontend gates

```text
bun test tests/departure-service-contract.test.ts tests/departure-role-fixture.test.ts \
  tests/yellow-departure-coordination.test.ts tests/yellow-guided-checkout.test.ts \
  tests/yellow-voice-routing.test.ts
=> 57 pass, 0 fail, 440 assertions

bunx tsc -p frontend/yellow/tsconfig.json --noEmit
=> PASS

bunx vite build --config frontend/yellow/vite.config.ts
=> PASS, 484 modules; index JS 195.90kB, CSS 128.85kB

bun run license-check
=> PASS, 0 installed package(s) examined through this linked candidate

bun run boundaries
=> PASS, 204 TypeScript files scanned

bunx tsc --noEmit
=> FAIL, three errors described in finding 2
```

The licence command's zero-package result is retained as a limitation, not enlarged
into a dependency-policy claim.

### PostgreSQL proof

`setup.ps1 -DbOnly` failed immediately with `Docker daemon prerequisite check
failed (exit code 1)`. Docker Desktop was requested but its Linux engine did not
become usable, and port 5442 remained closed.

I then created fresh, isolated native PostgreSQL 16.15 databases on loopback port
55514 and applied migrations 0001–0099 with `yellow_deploy`. On
`yellow_order593_review_20260922`:

```text
YELLOW_REQUIRE_DEPARTURE_SERVICE=1 bun test tests/departure-service.integration.test.ts
=> 10 pass, 0 fail, 64 assertions
```

This independently proved: mixed-key twenty-confirmation convergence to one task,
fact and event; replay and post-retention canonical uniqueness; 20-way assign/start/
complete contention; active-staff revalidation; target-role membership removal;
wrong-session capability and foreign-property denial; exact queue reads; invalid
schedule/role rejection; the checkout race; post-checkout completion of already
confirmed work; injected outbox failure rollback and same-key retry; and unchanged
reservation, unit-condition, journal and occupancy evidence for bounded outcomes.

Additional direct catalog/authority probes showed migration frontier `99/99`, 130
ordinary public tables including the migration ledger, forced RLS on
`departure_service_request`, SELECT-only app-role access there, and permission-denied
results for INSERT/UPDATE/DELETE/TRUNCATE against both `departure_service_request`
and `task`. RLS observation for the retained synthetic Order-593 tenant was 16 rows;
an unrelated tenant observed zero.

After loading `tests/seed_fixture.sql`, the canonical referee personally returned:

```text
RESULT: 11 passed, 0 failed of 11
```

This is useful isolated evidence, but does not cure the failed required setup
command.

### Fixture proof

On separate fresh `yellow_order593_fixture_20260922`, migrations, base seed and
review seed succeeded. The exact five departure roles/users/property grants/staff
Parties/party roles/permissions hashed identically before and after a second run:

```text
56369E243C6F216AB8F682B263895B9C5B5B12B39ED05F9C4C9D046E9BC70F2C
```

Changing the deterministic Duty Manager role name caused the next seed to fail
with `Departure role Duty Manager collides with non-canonical local-review data`;
the isolated probe row was then restored. A separately fresh review-seed integration
database passed `27 pass, 0 fail, 117 assertions`, including the two updated exact
token-scope oracles.

## Frozen candidate hashes (SHA-256)

```text
115BD87EE7C247F8ED3CCDF2F870860D7DA96217E232DAE577FF09CC477E51E4  migrations/0099_governed_departure_service_coordination.sql
2167EBB0953027B6015C93A3D36961693CC82D957C167EEEC5D9EA53AFB55F83  src/contexts/stay-operations/departure-service-coordination.ts
A904222DFCC74A406F006C0B64509F0DAF9D718373FF713D9E26361F7C19B6F2  src/contexts/stay-operations/index.ts
87637A69EBB728100A71840A0819488992B1BF0285EB4A18F5AE256219B5DD96  src/http/operator.ts
E6E00875706722E8A60821930F6FAED1197C6288BA073CB96402285237D53A1B  src/app.ts
CC0B67181F7CD7FCA9F3E3A85DAD2A4312EED17002F37436695936F8598C0248  scripts/seed-review.ts
E5462DB0150A184DFD235354B32E9F670E76623496A2C06E6C54F3DB7B13E7F6  frontend/yellow/src/yellow-api.tsx
9C0A14EAF7A55AC960B427E373C0C4932E55053C18DD56FE50FDEF0979111ADE  frontend/yellow/src/workspaces/ReservationWorkspace.tsx
9BA6FEB8247770047A5236FB9A72672CC1CCBFBA43F7F4B76F48D20298AD2A36  frontend/yellow/src/workspaces/OperationalHub.tsx
A877042D7AFC125CF47CBE9866022F4FF9BD9091A8A59AA13CB6299BC3FEE3D4  frontend/yellow/src/App.tsx
F5F32DC4D77C3B9AC836B394014295EF3C7EEB98556A1C7BFC141B14797C7D86  frontend/yellow/src/voice.ts
F9E275F096F0ABD093CC2E615F7C719376EFB73261EAEA9CA7B6E65D31FFBC7F  frontend/yellow/src/styles.css
90246CBDC94EA1697BCFAF2CE1252045E8003C815ABD31F9C63A60A6386C3D4F  tests/departure-service.integration.test.ts
7EA1ACE05C1027A89B2D4520600DCAB8CBD64F5EB4F85D6E4C99FC3BD24DC67D  tests/departure-service-contract.test.ts
3F86237CA2FCF13CC376AC45EF4D25CC6BD95F62BC6CCE3C6C5FA26A97922EB0  tests/departure-role-fixture.test.ts
5E288F8D881BFE936CF0B730E52ED9735E57ED5230FDE1E2BF7B79A09CAEFA19  tests/yellow-departure-coordination.test.ts
CF5D95D6D53F3E99436091B7F9A8D4B776A633D7576939CAF9824CFD0EC67206  tests/yellow-guided-checkout.test.ts
```

These hashes were re-read after all proof runs and matched the initial snapshot.

## Disposition

Order 593 must remain open. Repair must add real HTTP proof; real concurrent
amend/move/withdraw/expiry/revocation races; mounted voice-to-card state continuity;
mounted unambiguous confirmation behavior; and a guarded browser journey at all
three required widths. The repository-wide strict typecheck and exact fresh
`setup.ps1 -DbOnly` gate must be green. A non-implementing reviewer must then rerun
all evidence against a newly frozen candidate. Nothing in this review authorizes a
public app, tunnel, deployment, merge, or data change.

---

## Independent re-review R2 — 2026-09-22

**Reviewer:** `/root/order593_independent_r2` (non-implementing; did not perform
the Order-593 repair)  
**Candidate:** `D:\Yellow\temp\order593-departure-coordination-source`  
**Verdict:** **REJECTED / APPROVAL WITHHELD — mandatory reproducible setup and
schema gates remain unavailable; the repository-wide suite is also red.**

I re-read `PROJECT.md`, `AGENTS.md`, Order 593, the relevant decisions and R1.
`bash ./state.sh` could not start because local WSL `/bin/bash` failed; the Windows
equivalent `./state.ps1` completed and reported the main checkout at `a043bb29`,
with app, PostgreSQL and Valkey down. I inspected the candidate-to-source diff
against `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`
and personally inspected migration 0099, its authority/locking/idempotency
functions, service and HTTP adapters, fixture, mounted React state flow and tests.
I did not edit candidate product files.

### R1 repair disposition

R1 findings 1, 2, 4, 5 and 6 are repaired in this frozen candidate. A mounted
Chromium/CDP journey executes all three widths and the required interactions;
root and frontend strict TypeScript pass; mounted HTTP tests exercise the adapter;
fresh PostgreSQL tests execute true waiting-lock races for every required competing
transaction; and voice service/timing plus bounded pending-confirmation state are
mounted through the app. R1 finding 3 remains blocking: the exact setup command
still aborts before creating the mandated environment, so the Docker/PG16.15 exact
schema comparison is also unavailable. Native-PG proof below is not represented as
a substitute for either mandatory gate.

### Personally executed focused, HTTP, browser and build evidence

```text
bun test tests/departure-service-contract.test.ts \
  tests/departure-service-http.test.ts \
  tests/operator-departure-service.test.ts \
  tests/departure-role-fixture.test.ts \
  tests/yellow-departure-coordination.test.ts \
  tests/yellow-guided-checkout.test.ts tests/yellow-voice-routing.test.ts
=> 64 pass, 0 fail, 473 expectations

bunx tsc --noEmit
=> PASS
bunx tsc -p frontend/yellow/tsconfig.json --noEmit
=> PASS

bun test tests/yellow-departure-coordination.browser.test.ts
=> 1 pass, 0 fail, 15 expectations

bunx vite build --config frontend/yellow/vite.config.ts
=> PASS, 484 modules; index JS 196.56kB, CSS 128.85kB
bun run boundaries
=> PASS, 204 TypeScript files scanned
bun run license-check
=> PASS, 0 installed package(s) examined through this linked candidate
```

The mounted browser proof retained `minibar` and `15 minutes` from voice input;
performed no write during selection/check; made exactly one proposal write and no
confirmation before explicit `yes`; confirmed exactly the pending request from
typed and spoken `yes`; exercised assign/start/complete with bounded values;
rendered retained history and unknown `Not recorded` evidence; verified keyboard
focus; retained exactly five ribbon tabs and two pointer-inert depth cards; remained
contained at 240/375/1440; captured non-empty screenshots; and had no runtime errors
or console warnings. The browser plugin was not installed, so I used the repository's
real Chrome/CDP harness and record that limitation. The licence command's
zero-package scan is likewise retained as a limitation, not an exhaustive claim.

### Fresh independent PostgreSQL evidence

I initialized a new disposable PostgreSQL 17.2 cluster at
`D:\Yellow\temp\order593-r2-pg-20260922`, port 55516, created fresh databases and
independent deploy/runtime credentials, and applied migrations 1–99. Credentials
are omitted. The cluster was stopped and removed after proof.

```text
YELLOW_REQUIRE_DEPARTURE_SERVICE=1 \
  bun test tests/departure-service.integration.test.ts
=> 12 pass, 0 fail, 127 expectations
```

This personally proved proposal-without-task; 20-way mixed-key confirmation
convergence; exact replay, changed-request/actor conflicts and post-retention
uniqueness; all service types and escalation; 20-way assignment; adjacent
start/complete and outcome constraints; unchanged reservation, unit-condition,
journal and occupancy evidence; mounted HTTP validation/authority/idempotency/
queue/minimization; real waiting-lock races against amendment, room move, expiry,
withdrawal and target role/grant removal; raw-DML/session/foreign-property denial;
invalid schedule/role; checkout-versus-confirm; confirmed work after checkout; and
atomic rollback plus exact retry after injected outbox failure.

```text
YELLOW_REQUIRE_REVIEW_SEED=1 bun test tests/review-seed.integration.test.ts
=> 27 pass, 0 fail, 117 expectations
```

The canonical five roles/permissions/users/property grants and five staff
Parties/party roles hashed identically before and after reseeding:

```text
D58E7FE2620FD787E3FDF741C30DA2AFA027DA2B2EB62460B7EBB800EF0C15D5
```

Changing the deterministic Duty Manager role name made the next seed exit 1 with
`Departure role Duty Manager collides with non-canonical local-review data`; the
disposable row was restored.

On another fresh database after `tests/seed_fixture.sql`:

```text
python tests/run_invariants.py order593_r2_referee
=> RESULT: 11 passed, 0 failed of 11
```

The fresh catalog reported frontier `99/99`, 130 public tables, forced RLS and one
tenant policy on the new table, SELECT-only app-role table access, 120 RLS tables,
29 forced-RLS tables, 120 tenant policies and zero non-security-invoker public
views. The three Order-593 definer functions were `yellow_owner`-owned,
`SECURITY DEFINER`, fixed-search-path and executable only by `app_role`.

```text
bun test tests/build-readiness.test.ts tests/release-workflow.test.ts \
  tests/free-host-arm64.test.ts tests/setup-current-catalogue-oracle.test.ts
=> 21 pass, 0 fail, 420 expectations
```

### Mandatory setup/schema blocker

```text
docker info
=> FAIL: //./pipe/dockerDesktopLinuxEngine is unavailable

powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -DbOnly
=> ABORTED at the Docker-daemon prerequisite; no setup completion result
```

`C:\Program Files\Docker\Docker\Docker Desktop.exe` is absent, so that engine
could not be started. The shell wrapper surfaced a misleading native exit status
after PowerShell printed the terminating error; the explicit abort is failure.
`schema-drift.ts --check` is Docker-only. A native PG17.2 dump differs from the
frozen PG16.15 artifact immediately on version boilerplate and PG17's
`transaction_timeout`; I did not normalize this or claim equivalence. Exact setup
and frozen-schema proof therefore remain unresolved blockers.

### Complete repository-suite disclosure

```text
bun test
=> 2365 pass, 1557 skip, 21 fail, 42864 expectations
   3943 tests across 644 files in 192.74s
```

The failures are outside focused Order 593 and span older/cumulative source/layout
contracts, browser/layout and budget expectations, a PriceLabs temp-directory
collision, and Git-parent provenance checks against this non-Git candidate. I found
no additional Order-593 domain defect in them, but the red full suite is not waived
or represented as repository-green.

### R2 frozen hashes (SHA-256)

```text
FE2A9FC949C6BACDED3F8D3FC4D14FC596A83EBDE9AEB043EB10845F07B30923  migrations/0001_init.sql (candidate and exact source)
115BD87EE7C247F8ED3CCDF2F870860D7DA96217E232DAE577FF09CC477E51E4  migrations/0099_governed_departure_service_coordination.sql
6C1ACD7F559B9425E77A767E04454E85C61978D07028FA9933D4126234356BB4  schema/expected.sql
2167EBB0953027B6015C93A3D36961693CC82D957C167EEEC5D9EA53AFB55F83  src/contexts/stay-operations/departure-service-coordination.ts
F688A90600BC688728368884B0440355611D982128A85E2C641EAC4105D6DE2D  tests/departure-service.integration.test.ts
E46D9BF7F53D9DE022CA0319316B3514A688ED137D3DDFEF0E076A19400B6C99  tests/departure-service-http.test.ts
6EF1FEA3A5350FA1E2C83E4AB32489565FA5DC20E9EE29F7E226476AD37BC9CF  tests/yellow-departure-coordination.browser.test.ts
93AD2EBB463092FD641AC7AA01237380D6CDF66560952ADE09AB1A0237A739C0  frontend/yellow/src/App.tsx
6D70E5AAA5DEB162981AADA17EA58CAFB24582DFA2FE3387AB3E6590CFA0A8A5  frontend/yellow/src/workspaces/ReservationWorkspace.tsx
```

Hashes were re-read after proof. Protected migration 0001 exactly matches the
source. R2 is strictly bounded to Order 593; separately scoped cumulative material
was not silently absorbed into this decision.

### R2 disposition

The repairs materially close R1's product-proof findings and I found no new
Order-593 behavior defect. Nevertheless Order 593 remains open and unapproved
until an independent reviewer can run exact `setup.ps1 -DbOnly` with the
Docker/PG16.15 schema oracle successfully and the repository standing-suite policy
is reconciled or made green. Nothing in R2 authorizes merge, deployment, tunnel,
public app or data change.

## R3 — Exact Docker/PostgreSQL 16 gate after host recovery (2026-09-22)

Reviewer: non-implementing `/root/order593_http_proof`.

The reviewer first diagnosed the user-local Docker Desktop installation and verified
the recovered engine as Docker `29.7.2`, Linux, x86_64. An initial reviewer attempt
was invalidated when a concurrent root setup reset the shared fixed `yellow_test`
database; the reviewer identified the forced connection close, terminated only the
reviewer's stranded setup process, and retained that attempt as non-evidence. Root
then stopped all setup activity.

The reviewer personally reran the exact gate once, serialized:

```text
cd D:\Yellow\temp\order593-departure-coordination-source
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -DbOnly
=> exit 0
=> migrations 1-99 applied/no-op as appropriate
=> yellow_test tables: 130
=> RESULT: 11 passed, 0 failed of 11
=> Setup complete
```

PostgreSQL and Valkey containers were healthy. The reviewer edited no product file
and manually deleted no container, volume or database. R3 closes R2's exact
Docker/PG16.15 setup/schema prerequisite blocker. It does not waive the independently
disclosed cumulative-suite failures, which remain separated under Order 597 and its
scoped repair successors; no merge, deployment, tunnel or public-runtime authority is
granted by this gate alone.
