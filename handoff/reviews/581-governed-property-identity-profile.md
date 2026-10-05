# Order581 — independent Tier-3 review

## R1 — CHANGES REQUIRED / REJECT, 2026-09-21

Reviewer: Codex Astra `/root/astra_review`, independent of implementation. Read PROJECT.md, the Order581 scope, relevant property/grant/idempotency/schema decisions and current phase context; ran `./state.ps1`; read and applied the Yellow compliance, entity and PostgreSQL skills. These require tenant-local authority, immutable evidence and real contention proof, not reliance on implementer output. No implementation file was edited. No public database, app or provider was changed.

### Blocking findings

1. **P1 — inactive actor can commit after the property-lock wait.** The capability's authority SELECT locks only `property`, not the actor/tenant/grant/membership/scope rows used to authorize it. Reviewer held the exact property row `FOR UPDATE`, started the real `PropertyIdentityProfileService.rename`, and observed its backend in `pg_blocking_pids`. A separate committed transaction then changed the actor to `inactive`, after which the property lock was released. The command still committed `changed:true`, version2, a new name and atomic evidence. The joined authority snapshot survives the wait without revalidating the changed actor. This violates active/current authority, even though an actor inactive before the initial query is correctly denied. Lock and revalidate the complete authority roots with a consistent order, including relevant tenant/grant/scope/membership changes; execute both acquisition orders. Source: migration0098 authority SELECT near line122, `FOR UPDATE OF property` near148.

2. **P1 — revoked authority can replay after an idempotency wait.** The service's `#authorizedProfile` is an unlocked read before `PostgresIdempotency.execute`. Reviewer held the existing completed receipt row `FOR UPDATE`, started the real identical-key rename replay and observed the wait, then deleted/committed the write permission before releasing the receipt lock. The service returned `accepted:true,replayed:true`. Replay never invokes the capability and does not repeat a protected live authority check after waiting. Ordinary pre-existing-revocation HTTP403 is not sufficient. Hold bounded authority through replay or use a governed lock/revalidation path before the idempotency boundary and retain it through transaction completion. Source: `property-profile.ts` authorization-before-idempotency section near231–247.

3. **P2 — invisible-only property names persist despite the visible-name contract.** Personally executed service commands with names consisting solely of U+00AD SOFT HYPHEN and U+2063 INVISIBLE SEPARATOR; both committed as one-character names with fact/outbox/version advancement. Both survive NFKC and the TypeScript and SQL enumerated forbidden-character lists. The documented `1–200 visible characters` / no-zero-width-or-format contract must reject these (and consistently cover the intended Unicode format/control class), not count code points as visibility. The matrices should include empty-normalized, invisible-only, embedded format, NFKC and supplementary characters at both service and raw capability boundaries. Tab/newline input was also normalized to a space before the control check; either explicitly document that whitespace exception or reject raw controls consistently, rather than claim all controls are rejected. Existing C0, U+202E and201-character controls did reject.

### Personally executed environment and commands

Serving-source cwd: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

```powershell
$env:COMPOSE_PROJECT_NAME='yellow-astra581-review'
$env:YELLOW_POSTGRES_PORT='55581'
$env:YELLOW_VALKEY_PORT='56581'
./setup.ps1 -DbOnly
bun D:/Yellow/temp/astra581-proof.ts
bun D:/Yellow/temp/astra581-hostility.ts
bun D:/Yellow/temp/astra581-matrix.ts
```

Fresh, reviewer-owned Compose resources only. PostgreSQL image pinned to `postgres:16.15-alpine@sha256:ab5c955e9e57ae9879d4411ab49a912be9d162455676f7bf56e951b11ac73785`; actual server reports **16.15**. Isolated loopback port55581. Container `484aff24571854500130ee97e942fc8b5be210792e86d5ded224d1fcd18a59bc`. Passwords loaded from the designated local protected authority file into process memory, never printed; no credential was added to these reviewer scripts.

`setup.ps1 -DbOnly` personally provisioned isolated authority, migrated fresh yellow_dev and yellow_test through1–98, seeded canonical fixtures, and ran **11 passed,0 failed of11**. Table count129, tenant tables/RLS119/119, views/security_invoker2/2. The setup's printed `after migrations1–91` label is stale; actual applied ledger is98. The reviewer runner created a third fresh database `yellow_astra581_review`, migrated1–98, and ran the following with explicit required flags/paired isolated deploy-runtime URLs:

```text
bun test tests/property-identity-profile.integration.test.ts tests/property-identity-profile-http.integration.test.ts tests/runtime-dml-authority.integration.test.ts tests/inventory-policy.integration.test.ts --timeout 120000
bun run schema:check
bun run typecheck
bun run boundaries
bun test tests/import-boundaries.test.ts
bunx tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --target ES2024 --module ESNext --moduleResolution bundler --types bun --skipLibCheck --allowImportingTsExtensions src/contexts/identity/property-profile.ts tests/property-identity-profile.integration.test.ts tests/property-identity-profile-http.integration.test.ts
```

`astra581-proof.ts` sets `YELLOW_REQUIRE_ORDER581_DATABASE=1`, both `YELLOW_ORDER581_*_DATABASE_URL`, `YELLOW_REQUIRE_RUNTIME_DML=1`, runtime/deploy URLs, `YELLOW_REQUIRE_INVENTORY_POLICY=1` and its isolated fixture URL. `schema:check` uses this reviewer Compose project and database, not a default/public instance.

Results:

- **20 pass,0 fail,219 assertions**, four files: six identity-domain, three actual `createApp` signed HTTP, six inventory-policy and five runtime-DML tests. Includes16 concurrent CAS contenders→one winner/15 conflicts, exact capability owner/ACL/search_path, direct name-DML denial, SQL unnormalized-input and wrong-session denial, no-op/no duplicate evidence, original receipt replay, stale/key conflict, supersession, outbox-injected rollback and caller rollback.
- **Schema byte equality passes** against frozen `tests/schema/expected.sql`. Ledger count/min/max=98/1/98; migration98 checksum exactly `c31396354bece1d904fffa6ef96213d5a26bf9712724bae2b0bb87a6d503131d`.
- Actual boundary checker **passes,203 TypeScript files**. Scoped strict ES2024 TS **exit0**.
- Root `bun run typecheck` **exit1**, solely two already-existing TS6142 JSX configuration diagnostics at `yellow-cashier-bill-window-allocation.test.ts:11` and `yellow-voice-bill-window-allocation.test.ts:14`, both importing frontend App.tsx while root JSX is unset. These are outside Order581 and are not attributed to this change; root-wide green is not claimed.
- `tests/import-boundaries.test.ts`: **6 pass,1 fail,15 assertions**. Its exact13-context assertion sees the pre-existing extra `jarvis` directory; execution fails there before later index checks. Actual boundary CLI and its hostile fixture tests pass. Do not misreport this as Order581 deep-import failure or claim the empty-index branch independently passed.
- Initial scoped CLI attempt needed TypeScript7 `--ignoreConfig`; a subsequent ES2022 attempt hit existing `String.isWellFormed` library requirements. Final explicit ES2024 command above passes. Initial catalogue query used nonexistent `checksum`; corrected `checksum_sha256` query produced the exact ledger evidence. These reviewer command mistakes were corrected, not product defects.

### Additional reviewer-owned real PostgreSQL proof

`astra581-hostility.ts` executes the actual service and real concurrent sessions, not mocks. Both race findings used observable blocking PIDs and completed revocation before releasing the blocking transaction. Ordinary normalized first commit affected **only org_node, fact_log, outbox, api_idempotency** in the all129-table census. Full non-name org_node JSON hash remained identical through the probe sequence, including timezone/currency/path/kind/full config and its large integer value. PostgreSQL property-local date was2026-09-22 for the locked Pacific/Kiritimati property at UTC2026-09-21 transaction time.

`astra581-matrix.ts` independently verifies:

- Changed actor and changed property under an existing successful key each produce `IdempotencyConflictError`, even when the alternate actor/property has authority.
- Raw capability absent, empty, malformed and foreign tenant context each return42501; runtime without `SET LOCAL ROLE app_role` returns42501. Foreign-tenant runtime RLS query sees0 target rows.
- **All129 full-table fingerprints unchanged** across these denial/conflict probes.
- All five accumulated changed-commit fact/event pairs bind the exact actor, property, correlation/request UUID and property-local business date. Event payload is exactly `{version,changed_fields:["name"]}`; no config/name is copied into the event. Original completed idempotency receipt remains200 and retains the original canonical profile/name rather than the latest name.
- HTTP tests execute the real router composition, require correct signed scope plus current database grants, reject sibling/extra-body/malformed/stale/key-reuse cases and compare exact seven-field property DTO; no tenant/config marker leak. Static-before-call revocation succeeds as403, but the timing gap remains as independently demonstrated above.

The new function reuses org_node + immutable fact/outbox primitives; no new table, mutable history, financial or occupancy write is added. Expected snapshot contains the capability/ACL and matched a fresh pg_dump exactly. This reuse and green ordinary proof do not waive the observed current-authority defects. Full every-denial-history preservation was not exhaustively expanded after rejection; the explicit all-table matrix and authored rollback tests above are the measured claims.

### Frozen hashes

All ten hashes personally matched the coordinator's frozen manifest at start and end:

| File | SHA-256 |
| --- | --- |
| migrations/0098_property_identity_profile.sql | C31396354BECE1D904FFFA6EF96213D5A26BF9712724BAE2B0BB87A6D503131D |
| src/contexts/identity/property-profile.ts | 5D963FB872A3BB67403F3B107ADBBD46553841FF78B1550BF1EED285D874F869 |
| src/contexts/identity/index.ts | 015448F795F1B16FB868F0CC2390302D29250F907E193BD3813DFBEA058F26FE |
| src/http/operator.ts | 426B983E35F61F3E9179A1AA67C76365767DE5918C3265E73F2A641CF0E8FBCE |
| src/app.ts | FA911122BAA258C3557E497A10EDFF5D08D48188D86E4E268D3C0D3FA7827003 |
| tests/property-identity-profile.integration.test.ts | 92121B1D34CA2EFFF70E36B6F32DF784E1B21393368ED257092867D5E8AA814C |
| tests/property-identity-profile-http.integration.test.ts | C55EA664E09D1DA85DE87871BBEE2EE2D5FA2D6B29687861BB1A6010FD862025 |
| tests/schema/expected.sql | 6A08AC22B77FA0BB8562B2474D2FE447C49B8B6BFA2CB47E3E0E434CDA82A40F |
| docs/CONTRACTS.md | 6A5139DC6CBBA6913910C35D7A5923E014DC106FF5B7A15B1DE0075E2A64270D |
| docs/EVENTS.md | A16E0810542A019576AB362648B11285598E025A4EC3D2764731E2A9A03DA4FD |

### Cleanup and disposition

After read-only identity/label checks, removed only `yellow-astra581-review-postgres-1`, `yellow-astra581-review-valkey-1`, volume `yellow-astra581-review_yellow-pgdata` and network `yellow-astra581-review_default`. Final label-filtered container/volume listings empty. The disposable proof databases are deleted with their volume; no recovery is intended. Reviewer scripts and this evidence remain. Public/default databases and containers were untouched.

**CHANGES REQUIRED.** Preserve this R1 failure history. Remediate authority retention/revalidation for first execution and replay, add permanent actual both-order revocation races and Unicode invisibility controls, regenerate the schema snapshot from a fresh candidate, freeze new bytes and obtain fresh independent review. No migration/public promotion or property-name operation is accepted by this review.

## R2 — CHANGES REQUIRED, 2026-09-21

Independent non-implementing reviewer: Codex Astra `/root/astra_review`. Reread PROJECT/order/R1 and the remediation note, reran the Windows state ritual and Yellow skill review. No candidate source edit or public operation. Exact frozen hashes matched at start and end.

### Measured closure of R1

Reviewer-owned `D:/Yellow/temp/astra581-r2-hostility.ts` executes real service calls and real PostgreSQL sessions, with `pg_blocking_pids` witnesses:

- Exact original actor race: hold property, start rename, observe wait, deactivate/commit actor, release property. Now `PropertyIdentityAuthorizationError`, no rename/idempotency/fact/outbox residue.
- Exact original replay race: hold completed idempotency row, start identical replay, observe wait, remove/commit write permission, release receipt. Now authorization denial rather than replay.
- Authority-writer-first actor and permission cases: hold uncommitted deactivation/deletion, observe service waiting on authority, commit revocation. Both deny.
- Authorized replay transaction retained open before commit: subsequent actor deactivation and permission removal each visibly block until that transaction commits. Replay is valid in that serialization order; revocation then completes. No deadlock in these six probes.
- After restoring only the intentionally changed authority fixture, **all129 table fingerprints match each case's baseline**, including receipts and immutable/protected data. These are six executed interleavings, not an exhaustive arbitrary multi-resource administrator workload proof. The command-first retention cases use actual replay transactions; new-command contention is separately described below.
- Service now rejects raw tabs/newlines and all11 tested control/format examples, including U+00AD/U+2063/U+200D/U+061C/U+202E/U+2061/U+2062/U+2064/U+0600, with all129 unchanged. Valid French/Portuguese, Japanese, Arabic and Hindi names each commit unchanged as entered.
- The two R1 named raw capability examples, U+00AD and U+2063, now reject22023. Broader raw SQL format coverage still fails, below.

### Blocking residual findings

1. **P1 — normal competing renames now deadlock; the service masks this as ordinary stale CAS.** The authored16-way CAS test passes its one-winner/15-conflict assertion but took15.699s; the fresh isolated domain database had **15 PostgreSQL deadlocks** immediately afterward. Reviewer then ran `D:/Yellow/temp/astra581-r2-deadlock.ts`: hold the exact property, start two real distinct-key service renames at the same expected version, observe both waiting, then release it. One succeeds, the other becomes `PropertyIdentityConflictError`, while the database deadlock counter increases **15→16**. The server explicitly logs `deadlock detected` with mutual transaction ShareLocks between backend1338 and1337.

   Each command has already inserted its idempotency row and therefore holds a tenant FK KEY SHARE lock before reaching the capability. The new `FOR UPDATE OF target_tenant,...` authority locking conflicts with the other transaction's retained FK lock while that transaction waits on the first command's property lock. PostgreSQL kills a victim; the service translates40P01 to a stale-version error, hiding the mechanism from the authored oracle. Use a lock strength/order compatible with retained FK locks while still preventing authority changes, and prove ordinary same-property and shared-authority/different-property contention does not generate deadlocks. Do not merely extend timeouts or regard mapped40P01 as acceptable CAS proof. Source: both migration authority-root `FOR UPDATE` clauses and the service40P01 conflict conversion.

2. **P2 — the owner capability's Unicode boundary is still weaker than the service.** The TypeScript parser now rejects Unicode Cf generally. Raw app-role calls to `rename_property_identity`, however, still successfully commit names consisting solely of **U+2061 FUNCTION APPLICATION, U+2062 INVISIBLE TIMES, U+2064 INVISIBLE PLUS and U+0600 ARABIC NUMBER SIGN**. These are format characters; the first three are invisible-only names. The SQL change added only the two previously named code points to its enumerated list. The order/remediation note requires the corresponding hostile input boundary at the capability, not just an HTTP/service filter. Complete and align the governed SQL policy and test direct capability calls as well as service input. Accepted raw calls produced real isolated name/version/evidence changes; these were not static guesses.

The new `assert_property_identity_write_authority(uuid,uuid,uuid)` was personally inspected in the live catalogue: SECURITY DEFINER true, owner yellow_owner, config `search_path=pg_catalog, public`, ACL exactly owner/app_role EXECUTE. The full schema snapshot matches fresh SQL. Its addition closes the replay timing gap in the observed cases, but does not resolve the lock-strength cycle above.

### Fresh environment and personal gates

The originally named R1 project had been recreated by another process after R1 cleanup. An initial R2 `setup.ps1` discovered it already running; that invocation recreated its isolated yellow_test and ran11/11, but **is not counted as fresh-cluster R2 proof** and those now-shared resources were not removed. Coordinator notified. A new unique reviewer project was used instead. Port55582/56582 was already owned by the implementer's repair cluster; the new project's first start failed cleanly on binding. Selected verified-unused55691/56691 and continued with its still-fresh volume.

Authoritative R2 fresh command:

```powershell
$env:COMPOSE_PROJECT_NAME='yellow-astra581-r2-1659'
$env:YELLOW_POSTGRES_PORT='55691'
$env:YELLOW_VALKEY_PORT='56691'
./setup.ps1 -DbOnly
bun D:/Yellow/temp/astra581-r2-proof.ts
bun D:/Yellow/temp/astra581-r2-hostility.ts
bun D:/Yellow/temp/astra581-r2-deadlock.ts
```

PostgreSQL actual16.15, pinned `postgres:16.15-alpine@sha256:ab5c955e9e57ae9879d4411ab49a912be9d162455676f7bf56e951b11ac73785`; reviewer container `5e6824802bccef041ee6478f773b3fdc613b7495d63eeca4a928800002cb0101`. Fresh dev/test plus fresh `yellow_astra581_r2` all migrated1–98. Final ledger98/1/98 and migration98 checksum `6c9018bbe43a0844c0b284716f28cc39a244237aab247204a46f0b56e518c4f0`. Protected authority values stayed process-local and were not printed.

- Actual `setup.ps1 -DbOnly` **11 passed,0 failed of11**,129 tables,119/119 tenant RLS,2/2 security-invoker views.
- Same four-file domain/createApp HTTP/runtime-DML/inventory command as R1: **20 pass,0 fail,223 assertions**. Ordinary ACL/DML/scope/no-op/replay/body conflict/stale/supersession/rollback/evidence/immutable-field controls pass. The mapped-deadlock caveat prevents treating its contention test as clean serialization.
- `bun run schema:check` **exit0**, byte-identical frozen snapshot.
- `bun run boundaries` **exit0**,203 files.
- R1's explicit scoped strict TypeScript command with `--ignoreConfig --target ES2024` **exit0**.
- Root `bun run typecheck` still has exactly the two inherited TS6142 frontend-App imports without root JSX. `tests/import-boundaries.test.ts` still6pass/1fail/15 due pre-existing extra jarvis context. Neither is attributed to581, neither is called green.

Reviewer harness correction disclosure: first hostility start raced the independent migration runner and failed on missing new permission FK; only its four partial reviewer fixture rows were removed in the owned database after migration completion. The final hostility run above completed. First two-contender observer used a Bun tagged integer-array query and stalled its observer/cleanup; the exact owned Bun process17860 was stopped, releasing only its uncommitted reviewer locks. The corrected bounded observer uses literal validated backend integer IDs, releases the reserved lock in finally, and completed exit0 with the measured15→16 deadlock delta. These harness missteps do not count as product failures; the final server-observed cycle does.

### R2 source binding

Changed frozen files, independently rehashed at end:

| File | SHA-256 |
| --- | --- |
| migrations/0098_property_identity_profile.sql | 6C9018BBE43A0844C0B284716F28CC39A244237AAB247204A46F0B56E518C4F0 |
| src/contexts/identity/property-profile.ts | 2E4B5626F3D851C95161EB455482BE6886FDDB07FB96FF653BDE0BBBFE855E13 |
| tests/property-identity-profile.integration.test.ts | 91A9A3D01418F5F0E9315682A42373506816BB68E4E05EFF9039A8B7B82FD0AD |
| tests/schema/expected.sql | 525124A771825EEA0534989A73F10953F8B267CF544BC406FD67735E266A35EA |

All six other scoped implementation/documentation files match the complete R1 manifest exactly. No implementation bytes changed during this review.

After exact project-label/resource checks, removed only the new reviewer's postgres/valkey containers, `yellow-astra581-r2-1659_yellow-pgdata` and its network; final project container/volume listings empty. Deleted proof databases were disposable, not intended for recovery. Recreated old/shared R1 resources and implementer's repair cluster were left intact; public/default resources untouched.

**R2 verdict: CHANGES REQUIRED.** R1 authority races are closed in the measured interleavings; ordinary-command deadlock and incomplete SQL Unicode policy remain blockers. Preserve R1/R2. Require permanent real race oracles that distinguish40P01 from40001 and verify zero deadlock growth, raw capability Unicode cases, fresh schema/referee/regressions and another frozen independent review. No public migration/deployment or property-name operation is authorized.

## R3 — current-hash Tier-3 closure, 2026-09-22

Independent non-implementing reviewer: Codex `/root/order593_http_proof`. The
reviewer reread Order581 and the complete preserved R1/R2 record, compared the
current repair to the rejected R2 bytes, and edited no product file. The proof used
only the candidate-owned PostgreSQL target; it did not mutate the public database,
start a tunnel, or perform a provider operation.

### Frozen current source

The following SHA-256 values were re-read after all proof:

| File | SHA-256 |
| --- | --- |
| migrations/0098_property_identity_profile.sql | DC8472FAEBBD05C4EBD3BAF34D6582E3A7BD9F370BE0D1BC8AFC66284DB69E2A |
| src/contexts/identity/property-profile.ts | 29A033977BC35403269DAEF432400DC16B882757736769096FBB1143A62D0C99 |
| tests/property-identity-profile.integration.test.ts | 0E36E658A37E7EC42C40A1B6FEB036F8C884C01957C6FB6BDF5AE0C7A4417DB2 |
| tests/property-identity-profile-http.integration.test.ts | C55EA664E09D1DA85DE87871BBEE2EE2D5FA2D6B29687861BB1A6010FD862025 |
| tests/schema/expected.sql | 6C1ACD7F559B9425E77A767E04454E85C61978D07028FA9933D4126234356BB4 |

Fresh exact setup ran on the candidate PostgreSQL **16.15** target and applied
migrations 1–99. The live isolated ledger recorded migration98 as
`0098_property_identity_profile.sql` with checksum
`dc8472faebbd05c4ebd3baf34d6582e3a7bd9f370be0d1bc8afc66284db69e2`;
the catalogue contained130 public base tables.

### Personal executable proof

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -DbOnly
=> exit 0; migrations 1-99; 130 tables; RESULT: 11 passed, 0 failed of 11

bun test tests/property-identity-profile.integration.test.ts \
  tests/property-identity-profile-http.integration.test.ts \
  tests/runtime-dml-authority.integration.test.ts \
  tests/inventory-policy.integration.test.ts --timeout 120000
=> 22 pass, 0 fail, 246 expectations

bun run schema:check
=> schema matches tests/schema/expected.sql

bun run typecheck
=> exit 0

bun run boundaries
=> exit 0; 203 TypeScript files scanned

bun test
=> 2389 pass, 1557 skip, 0 fail, 44065 expectations, 644 files
```

The first focused four-file invocation used two wrong environment-variable names:
its eleven Order581 tests passed, while the inventory and runtime-DML files rejected
the missing required URLs before tests. The corrected declared variables produced
the green22/0 result above. The first authoritative full-suite attempt had two
resource-sensitive timeout/status failures; both files immediately passed14/0, and
the complete clean rerun above passed2389/0. These corrected harness outcomes are
retained rather than hidden and are not product failures.

Reviewer-owned in-memory race probes executed the actual current service and
PostgreSQL sessions. Both same-property contenders were observed blocked behind a
held property lock before release; afterward exactly one committed and one returned
the expected stale-version conflict. The server deadlock counter stayed **0→0**.
Two different properties sharing the same tenant, actor, role and permission roots
were likewise both observed blocked before release; both then committed serially,
and the deadlock counter again stayed **0→0**. This closes R2's ordinary-command and
shared-authority lock-cycle blocker rather than masking `40P01` as CAS: the service
maps `40001` to the domain conflict and no longer maps `40P01`.

Six real authority/replay interleavings also passed with all-table fingerprints
stable around each denial or replay: command-waits-then actor revocation,
command-waits-then permission revocation, actor-writer-first, permission-writer-first,
authorized replay retaining authority through commit while a later actor revocation
blocks, and the equivalent permission revocation. The first four deny with
`PropertyIdentityAuthorizationError`; the last two replay in the valid serialization
order and release the waiting revocation only after command commit.

The service rejected eleven control/format cases without table drift. Direct calls
through the governed runtime capability rejected U+00AD, U+2063, U+2061, U+2062,
U+2064 and U+0600 with SQLSTATE `22023`; French/Portuguese, Japanese, Arabic and
Hindi positive controls remained accepted. Live catalogue inspection retained the
authority assertion as `yellow_owner`-owned, `SECURITY DEFINER`, fixed
`search_path=pg_catalog, public`, and executable only by `yellow_owner` and
`app_role`.

### R3 disposition

**ACCEPTED.** The exact current migration98/service/test/schema hashes above close
both preserved R2 blockers and satisfy Order581's independent Tier-3 gate. This is a
source and isolated-database acceptance, not evidence that any particular public
target was migrated or preserved correctly; release execution remains subject to its
own order, backup, data-fingerprint, app-identity and independent target-bound proof.
