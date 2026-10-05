# Order559 independent deployment review — ACCEPT

Latest verdict: final live postflight ACCEPT, recorded below. Initial preflight and its pending gates are preserved as historical evidence.

Reviewer: Codex `/root/astra_review`, independent non-implementer. 2026-09-21.

**ACCEPT the bounded plan below, subject to its mandatory pre-mutation gates. This is not yet acceptance of a deployment.** No public app/container/database/data mutation, backup, migration, seed or reconciliation was executed by this reviewer. Live postflight remains required. No PMS01 or whole-PMS completion claim.

Read PROJECT.md, AGENTS.md, Order559, Review558, relevant D-601/602 and deployment decisions, current Compose/Dockerfile/migration runner and all five pending migrations. Engineering code-review and Yellow PostgreSQL guidance drove the authority, transaction and rollback checks. `bash ./state.sh` failed because WSL cannot execute `/bin/bash`; not represented as passed.

## Personally verified target and source

- Exact public project is `yellow-public-demo`, app loopback3010, PostgreSQL loopback55432. Separate source-project app3000/PG5442 exists and is OUTSIDE this order; never use it by default.
- App container `3d3edbeb6ae4ff4fecc5bbb6d00cae9dbc5f5ac843eadba24127a536370a9c58`, image `sha256:c5e9b5a42ef1f89165aae6662c6581bed8ede0c96cf5dbe343367a912dfea24f`, healthy.
- PostgreSQL container `9f507e09cc387e7a96a436835a94d036338ed3acf87e70309031347c5ee48cb5`, healthy, volume `yellow-public-demo_yellow-pgdata`.
- Valkey container `781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b`, healthy.
- Tunnel container `e17219ecd7aa403a70d4f82a755c45aca51a6768a82d63a802bb6dadc1acc92a`, running, targets host.docker.internal:3010. Existing external health and local3010 health personally returned200.
- Compared248 runtime image files (complete src tree plus package.json/bun.lock) with candidate: exactly one differing file, `src/contexts/stay-operations/checkin.ts`; zero added src files. Old service40699E5948A1E8AD9EA4CF0A975295EDD39D0EEA9BFB40880C18AB1B3125F373; accepted new B198FE443391A22C959EBB6FE928F183FCC5279AEA6A8C84340A19A4BB104033. Dependencies unchanged.
- Accepted App2EB5B38B6997C9BF73DC256588D9A17B6B3040556EB4B9157AE4258D5C573F6E; integration test C4B8147058E187DD868194FBC5EAD6FFE22987F222CE5E74ABEC9550B6287CDB; source test B192CCF15923F1978E9D3CD007705DF38C874FA41CB40190E55D46BE03C1020A all personally match Review558.
- Current runtime public/yellow-next and public image still carry old `index-D4gkmEEZ.js`. **A fresh accepted frontend build into public/yellow-next is mandatory before Docker build**; Review558 temp build is `index-BPw72iaf.js` / `index-HgZI0zi4.css`. Do not promote old assets with the new service.

## Database evidence and migration assessment

Personally executed `bun D:/Yellow/temp/astra-order559-preflight.ts` twice. It constructs only the designated loopback55432 deploy URL from protected env in memory, opens a REPEATABLE READ READ ONLY transaction, and emits no credentials or row contents. Both runs exit0.

- Public ledger contains exactly contiguous1–91, and every filename/checksum matches candidate source. All four new suffix functions are absent, so no CREATE collision observed.
- app_role/owner NOLOGIN, runtime LOGIN; none superuser/BYPASSRLS, all NOINHERIT. app_role/runtime direct INSERT/UPDATE/DELETE on Party, account, condition, occupancy, journal and postings all false.
- Snapshot of all128 public tables excluding schema_migration: count plus sorted complete-row MD5 fingerprint per table; SHA256 over ordered fingerprint collection `43DD508FBD674A3A63F6F06DF009293167320D7FB4EF56CED587B5C4E7307713`, identical over two reads. This is a current preflight baseline, not proof of future or historical preservation.
- Selected current counts: Party652, reservation654, segment654, guest653, occupancy233, task15, condition210, account12, folio7, fact953, outbox893, idempotency67; journal/posting/payment/payment-operation/document all0. These supersede old unrelated target counts.
- Full minimized receipt: `D:/Yellow/temp/astra-order559-preflight-receipt.json`, SHA256 EEDA15D17A4D05F95D95215B9BE825BE6D9F9C688811DEEE5276CEB3113B78DD. Reviewer script SHA25681A998EF94CB02DA8BAE38E7115630777C830B81FA08D102002DC2CAB153841B.

Pending immutable migration hashes:

| Migration | SHA256 |
|---|---|
|0092|105CA27C2F4D7FCB4F8BB6DFB6EB28B5A8C615D80EB9B4D863A006497DD47DDA|
|0093|C9201892E38BC8F3FBB55DEF457B7289E34CEE126282D57A386580B1F0C21346|
|0094|867F54D3F94655FC5AA4B631433C37ED173AA20BB6E515F9DF39D52E1C1B7C89|
|0095|6FFB69469566CE3E5267F06F972DDBA7AB0C99B7EAFcf36287F3B1F953C186B0|
|0096|3D0C1B99445620CA972CCD971D94F5847D2C983E0EB0B2F6E2EB09ED02093F1A|

0092–94 install bounded owner-mediated Party/profile and fixed synthetic reconciliation capabilities; their data-changing statements are function bodies, not migration-time invocation. Session/role/context/target/CAS gates and direct-DML revocations remain. **Never call the reconciliation functions/scripts in this deployment.** 0095 grants only app_role policy SELECT, preserves tenant RLS, revokes PUBLIC. 0096 installs reviewed tenant/property/session-bound condition lock/read, no condition mutation; fixed owner/search_path/app-role EXECUTE with raw DML revoked. No new table, row rewrite, seed, automatic reconciliation, role membership or destructive schema change occurs in this suffix. Existing image remains compatible with these additive capabilities/revocations: it already has the same direct-DML restrictions at91.

Normal runner verifies immutable ledger/checksums and serializes via advisory lock; each migration is a separate transaction. A failed suffix can leave earlier suffix migrations committed. Do not describe all five as one atomic transaction or retry blindly after a failure.

Review558 personally executed fresh1–96, check-in8/0/45, two real observed lock races plus ACL/rollback/replay4/0/31 and fresh separate referee11/11. That is an equivalent isolated current-schema proof, **not a restored copy of this public data or an executed public upgrade**. Earlier466/467/471 source reviews retain bounded capability proof and limitations.

## Mandatory gates and exact bounded plan

1. Revalidate identities/hashes and preserve current image before replacing its tag. Build the accepted frontend and app/migrate images before stopping the app, reducing downtime. No candidate source edits. Runtime cwd is the explicit Order559 D-source directory.

```powershell
$composeArgs = @('-p','yellow-public-demo','--env-file','D:/Yellow/runtime/yellow-public-demo.env','-f','docker-compose.yml','-f','D:/Yellow/runtime/yellow-public-demo.compose.yml')
docker image tag sha256:c5e9b5a42ef1f89165aae6662c6581bed8ede0c96cf5dbe343367a912dfea24f yellow-public-demo-app:pre-order559
bunx vite build --config frontend/yellow/vite.config.ts
docker compose @composeArgs build app migrate
```

Require every exit0; verify built HTML/assets match reviewed temp build and image contains accepted service/migration hashes. Do not run build with another Compose project/default cwd. Keep the rollback image ID binding.

2. **Privacy finding:** D:/Yellow/recovery currently inherits Authenticated Users Modify and Users Read. Never write a private dump into an inherited directory. Create one NEW timestamped Order559 child, disable inheritance and permit only actual owner/SYSTEM/Administrators; inspect effective ACL before any dump. Existing G:/My Drive/Yellow is absent; no Drive-copy success may be claimed. If it appears later, do not copy private data without equally restricted destination handling.

3. Make the required consistent custom-format backup using pg_dump in the designated PostgreSQL container, retaining it outside the container in the verified private child; verify SHA256 and `pg_restore --list` exit0 and nonempty catalogue. The backup command must use the container's existing POSTGRES_DB variable, never a printed URL/password. Example exact command family (fresh timestamp chosen once, private child already verified):

```powershell
docker exec yellow-public-demo-postgres-1 sh -c 'pg_dump -U yellow_deploy -d "$POSTGRES_DB" -Fc -f /tmp/order559-preupgrade.dump'
docker exec yellow-public-demo-postgres-1 pg_restore --list /tmp/order559-preupgrade.dump
docker cp yellow-public-demo-postgres-1:/tmp/order559-preupgrade.dump <verified-private-order559-child>/preupgrade.dump
Get-FileHash -Algorithm SHA256 <verified-private-order559-child>/preupgrade.dump
```

Never use PowerShell text redirection for the binary archive. Dump/create/catalogue/copy/hash failure is STOP before migration. This reviewer has not created or validated the future archive. Container-private temporary archive cleanup is optional only after independently verified retained copy; no broad recursive cleanup.

4. Stop only app, take a new hash-only READ ONLY complete-row baseline after workers drain, verify no runtime sessions/ongoing writers remain. Preserve that stopped baseline separately; current active preflight may legitimately age. No terminate/reset/seed action is authorized.

```powershell
docker compose @composeArgs stop app
docker compose @composeArgs run --rm --no-deps migrate
```

**`--no-deps` is essential:** base migrate depends_on provision, which must NOT run. No `compose up` without explicit service/no-deps, no down, no provision, no seed. Run migration authority once. Require exactly0092–0096 applied/discovered96; after failure retain stopped app, logs and checkpoint for scoped review, no improvised recovery.

5. Before app restart, independently verify contiguous1–96/checksums, exact new functions/owner/SECURITY DEFINER/search_path/ACL, policy RLS/SELECT and no runtime direct-DML. Compare ALL128 table counts/fingerprints with stopped baseline; schema_migration alone changes. Any discrepancy is STOP and investigation, not a count-only preservation assertion. Do not use a real write to test direct-DML denial on public data; catalogue proof plus isolated executable tests suffice.

6. Recreate only app using prebuilt image:

```powershell
docker compose @composeArgs up -d --no-deps --no-build --force-recreate app
```

Verify new app healthy, old PG/Valkey/tunnel IDs and volume unchanged, local/public200, exact accepted served assets, automatic session and non-mutating readiness, desktop/375px containment and image-free neon. Do not confirm a task/folio/check-in action. After restart workers may legitimately update projections/evidence; distinguish that interval from the quiesced migration no-delta proof. Ask independent reviewer for postflight before closing559.

7. If only app startup fails after completed compatible migrations, restore the exact old image tag and recreate app only with the same no-deps/no-build command. Retain96 and the backup; never down-migrate, restore/reseed or recreate PG automatically. Database restore is destructive and needs a separate recovery order. A successful image rollback is not a claim that old clean-check-in semantics satisfy558.

## Remaining release evidence

Required before final live ACCEPT: private readable backup receipt, frozen stopped baseline, exact one-run migration output and independent catalogue/data comparison before resume, image/assets/health/identity postflight and bounded read-only browser/session/readiness checks. Plan acceptance authorizes none of the excluded operational or reconciliation actions. Reviewer will append postflight only after personally observing these facts.

## Final independent live postflight — ACCEPT (2026-09-21)

**ACCEPT the bounded Order559 deployment.** Reviewer personally executed the checks below after the coordinator's accepted plan. No reviewer migration, seed, reconciliation or operational submission. This is not whole-PMS completion, a destructive restore test, or a reduced-motion accessibility pass.

### Backup and preservation

Executed `Get-Acl`/`Get-FileHash` on `D:/Yellow/recovery/order559-20260921T013937567Z-3621eb69/preupgrade.dump` and its parent. Parent inheritance is disabled; effective file rights inherit only owner ASTHA/astha, SYSTEM and Administrators FullControl. No Users/Authenticated Users grant remains on this checkpoint. The file itself inherits that restricted parent; do not falsely describe the file's own AreAccessRulesProtected as true.

Dump2,584,670bytes, SHA256 `49EDD5231572EEA3AE3CD56CAF9E79C05472CFB3032C348256DEC496C30AC6FC`. Reviewer personally streamed the RETAINED local archive bytes through `docker exec -i yellow-public-demo-postgres-1 pg_restore --list`, exit0 and2083 catalogue lines. Initial attempt to inspect the suggested container-temporary path found it absent; this was not the retained backup. The subsequent retained-file check passes. No restore or container file was created by the reviewer. Drive copy not claimed.

Executed `bun D:/Yellow/temp/astra-order559-postflight.ts` twice, including final function-body verification. Both final read-only database/artifact runs exit0. Script uses only designated protected fields in process memory and a loopback55432 REPEATABLE READ READ ONLY transaction; emits no row contents/credentials.

- Personally checked stopped receipt01:41:38.898Z and postmigration receipt01:42:17.791Z: all128 ordered table fingerprints identical and aggregate43DD508FBD674A3A63F6F06DF009293167320D7FB4EF56CED587B5C4E7307713.
- Independently recomputed CURRENT all128 complete-row fingerprints after app restart: still exactly the same aggregate, zero changed tables. This also equals the reviewer's own preflight before deployment, so bounded before/after preservation does not rely only on implementer receipts. Schema_migration is deliberately excluded from business-data hashes.
- Live ledger now contiguous1–96, all96 filenames/checksums personally compare exactly to source. Prior ledger1–91 was personally captured. Coordinator reports a single normal runner invocation applying only92–96; reviewer verified the resulting exact ledger transition, not an independent count of process invocations.
- Four installed capability bodies byte-match their reviewed migration $$ bodies; all are owner yellow_owner, SECURITY DEFINER, exact search_path pg_catalog/public/pg_temp, app_role EXECUTE, raw yellow_runtime/PUBLIC denied. Policy has RLS, app_role SELECT and no raw runtime SELECT. Direct INSERT/UPDATE/DELETE on Party/account/condition/occupancy/journal/posting remains false for both roles.
- No public raw UPDATE attempted to test denial. Isolated executable denial/race/atomicity/referee evidence remains Review558, personally executed fresh1–96 and11/11, not transplanted onto live data.

### Exact artifact and infrastructure

New app container `123be8c60d54f7974166b9d98ecff5c3fd444e37273618ada422e25e0efc7fe8`, image `sha256:f2c2eb029e4262da43312b7fd529f65cc0f4d08ae551129cbf10b1e618fa7850`, healthy. Exact PG/Valkey/tunnel IDs from preflight and PG volume unchanged. `yellow-public-demo-app:pre-order559` still resolves to c5e9b5a42ef1f89165aae6662c6581bed8ede0c96cf5dbe343367a912dfea24f. Container service SHA256 B198FE443391A22C959EBB6FE928F183FCC5279AEA6A8C84340A19A4BB104033 matches accepted source.

Local3010 and existing external /health both200. Personally downloaded exact JS/CSS through BOTH origins and compared bytes to the independently reviewed558 build:

- index-BPw72iaf.js SHA256 `0EE6D44EF8D8FB3BBDD4BE7E55AD91252F6361187172E0E291150834E66D0401`.
- index-HgZI0zi4.css SHA256 `6E7A7BF25BB04BB270945A36ECC21DB8D9080C74844D5867477335F834F8D8A1`.

### Personally executed read-only browser proof

BrowserAct had no configured browsers; app computer surface returned no browsers/apps. Used existing local Selenium/Chrome with reviewer-owned headless session; `python D:/Yellow/temp/astra-order559-browser.py` final exit0. Fresh public /today?lane=due_in route,375×812 CDP mobile metrics. Guarded fetch forbids every non-GET/HEAD except the existing automatic demo-entry POST; zero blocked operational attempts. No password entered or token printed. Session returned200.

Native Activate Yellow, typed the existing fictional named-arrival preparation command, submitted only that local preparation query. Canonical readiness GET200 returned inspected, canCheckIn=false, sole blocker primary_folio_not_open. Visible separate folio checkbox remained unchecked; folio button disabled. Final check-in checkbox unchecked/disabled and check-in button disabled. Reviewer never checked either box or submitted a domain command.

Mobile innerWidth/scrollWidth375/375. Desktop1440/1425, no document horizontal overflow. Procedural field exists with own/before/after background-image all none; img/canvas count0. Actual screenshots personally viewed: `D:/Yellow/temp/astra-order559-mobile.png` and `D:/Yellow/temp/astra-order559-desktop.png`. Old harness expected nonexistent static Prepare button on dashboard and subsequently waited for a text selector prematurely; those attempts timed out without mutation. Corrected to the actual named-conversation and canonical proposal controls; final proof passes.

### Known inherited accessibility finding — separately scoped560

Additional reduced-motion test genuinely **fails** in the result state: matchMedia('(prefers-reduced-motion: reduce)')=true, yet computed animation remains `yellow-neon-result, yellow-neon-breathe` and a scale transform remains. The more-specific `.yellow-ai-mode.yellow-ai-result .yellow-neon-field` rule overrides the media rule's single-class animation reset. A35-second assertion run failed; final diagnostic run records the defect rather than claiming motion disabled.

CSS is unchanged from the pre559 image/accepted558 build; this is inherited, not deployment drift or an inspected-readiness regression. Coordinator explicitly confirmed scope disposition to retain bounded559 ACCEPT and open immediate Order560 CSS-only repair/review/promotion. No reduced-motion green claim is made. Image-free/containment and all mandatory559 migration/readiness gates pass independently of that follow-up.

Retained reviewer postflight script SHA256 `05CFDD27F5256CB2F38D94D34E08D1497B61309C653E83FE3AD4F247FAEC3F31`; browser script SHA256 `41C430A9D2DEB87CAE95AE81659B8412ACF52905E00FB01B40EBC29A14BD3104`. Scripts and screenshots are retained under the above exact paths. No implementation edit, service restart, container deletion or public operational write was performed by this reviewer.
