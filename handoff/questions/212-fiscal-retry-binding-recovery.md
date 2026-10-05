# Question212 — Recover original fiscal retry binding after reload

Accepted technical scope,2026-09-07; parent Order440. Does not change the
currently serving a1085178/frontier85 review app. Implementation begins in
parallel with Order444 presentation work; independent database proof precedes
application or migration promotion.

## Natural solution and invariant boundary

The submission already stores immutable provider extension UUID/version. Reuse
those fields and the existing read/retry routes. No table, column, index,
permission, financial state, new event, arbitrary SQL or provider activation.
Request authority and retry authority stay distinct. Tenant/actor/property come
from the verified session and existing transactional permission checks.

Forward0086 may replace only the existing receipt read projection to add
retryBinding:{providerExtensionId,providerExtensionVersion} for the exact
error/retry/known_not_sent persisted head. No binding in send/lookup/terminal or
legacy terminal variants; never infer original binding from providerKey or the
current provider-options directory. Preserve original documents, payloads,
attempts, signed receipts, response bytes and idempotency records.

Add one actually used private immutable helper
india_fiscal_submission_retry_binding_v1(text,text,text,uuid,integer)->jsonb.
It constructs only this bounded projection, owned by yellow_owner with EXECUTE
denied to PUBLIC/app_role/yellow_runtime. It is a semantic readiness capability
marker, not an unused version function. Maintain existing public read signature,
owner, search_path, volatility and effective permissions. Readiness must reject
old85 and hostile helper metadata/ACL drift before serving86.

The DTO validates own-data frozen nested UUID/version, exact keys and bounds.
Malformed bindings fail closed. If historical pending/error receipts without
binding remain representable for compatibility, they grant no retry capability;
current86 SQL must prove the binding exists for the exact retryable state.
Unknown/missing data must never be guessed or borrowed from current config.

The browser must recreate its controller after a genuine reload. Use the
existing retry endpoint with original provider UUID; retain the same request key
after an uncertain response. On reload, first read durable current receipt:
pending/send or submitted/lookup must not create a new retry. Only an explicitly
known-not-sent current head with valid original binding permits a new retry key.
Retry-only staff must not need provider-options/request authority. Clear stale
work on logout/property change; do not turn polling or storage into authority.

## Exact ownership

    provider_transport_builder:
      migrations/0086_fiscal_submission_retry_binding.sql (new)
      src/contexts/tax-fiscal/fiscal-submission-receipt.ts
      src/http/operator/invoices.js
      tests/fiscal-submission-receipt.test.ts
      tests/operator-invoices.browser.test.ts
      tests/india-native-fiscal-operator.test.ts
      tests/fiscal-retry-binding.integration.test.ts (new)
    coordinator or explicitly assigned integration worker:
      src/kernel/build-info.ts
      tests/build-readiness.test.ts
      tests/build-readiness.integration.test.ts
      tests/fiscal-retry-readiness.integration.test.ts (new; bounded retained-target proof)
      tests/runtime-database-authority.integration.test.ts
      tests/database-acceptance.integration.test.ts
      tests/migrate.integration.test.ts
      tests/schema/expected.sql (mechanically derived only)
      setup.sh
      setup.ps1
      tests/setup-current-catalogue-oracle.test.ts
      tests/native-fiscal-release-containment.integration.test.ts
      tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts
      tests/india-gst-accommodation-final-component-tax-recording.integration.test.ts
      .github/workflows/ci.yml
      .github/workflows/release.yml
      scripts/local-review.sh
      tests/release-workflow.test.ts
      tests/free-host-arm64.test.ts
      tests/fiscal-replay-workflow.test.ts
      tests/india-native-fiscal-populated-upgrade.integration.test.ts
    coordinator:
      handoff/questions/212-fiscal-retry-binding-recovery.md
      handoff/orders/440-fiscal-submission-lifecycle.md
      handoff/reviews/440-fiscal-provider-and-receipts.md
      docs/PROJECT-STATUS.md
      docs/design/BUILT-CAPABILITY-MANIFEST.md
      DECISIONS.log
      handoff/LEDGER.md

No app.ts/operator.ts HTTP registration, endpoint or public barrel source change
is needed. Those files are owned by Q211. Never edit applied1–85 or frozen
Order444 helpers/probe/archive/seed/runtime targets. Do not remove the recorded
outstanding retry gap until complete implementation and independent proof pass.
If any additional path is genuinely needed, report it before editing.

## Integration and proof requirements

Current frontier becomes86; table/RLS/policy/forced-RLS/permission/view counts
remain128/118/118/27/15/2. Preserve exact historical80/81 and85 tests. Explicitly
pin Q209 populated upgrade and CI q208_fresh85 to <=85 input; add separate fresh86
and85→86 acceptance, not relabelled historical evidence.

Prove strict DTO hostile input, real disposed/recreated-controller retry-only
recovery, unknown-response same-key retry and no duplicate after lost committed
response. Remove undocumented extension fields from ordinary pending fixtures.
Actual PostgreSQL proof must include real signed-session API authorization,
read+retry actor without request scope, foreign and revoked actors, no original
document/financial/receipt mutation, stable attempts and exact85→86 preservation.
No mocks or a pasted builder result substitutes for a nonimplementer's execution.
Verify fresh/rollback/no-op/checksum/schema/readiness and canonical referee11/11.

Before any local database mutation, root records exact absent target names,
pristine source/role scope, canonical hashes, commands and preservation checks.
Existing native PG may be reused; do not allocate another cluster, run historical
global-role migrations there, reprepare the live review or activate a provider.
CI uses its own isolated cluster and separate bounded fresh86 target.

## Native proof admission — 2026-09-07

Root rechecked the retained loopback PostgreSQL16.15/55503 postmaster15956 and
pristine `yellow_order434_production` template:77 ledger rows,127 public tables,
zero tenants and zero other sessions. The following exact targets are absent
before creation and admitted only for synthetic Q212 tests:

- `yellow_order440_q212_fresh_20260907`: clone77, production-runner78–86, genuine
  signed-session retry/recovery proof on an initially empty86 target.
- `yellow_order440_q212_upgrade_20260907`: clone77, production-runner78–85, then
  the genuine test creates known-not-sent and cryptographically accepted cohorts
  before applying only86 and proving their immutable rows/bytes survive.
- `yellow_order440_q212_referee_20260907`: clone77, production-runner78–86, separate
  canonical seed/referee11/11; never used by an application.

All three clones have owner `yellow_deploy`. Read the retained protected seed/app
environment through the existing Order444 helper functions without invoking its
Prepare/Promote/Rollback functions or displaying secrets. Test connections use
the exact existing `yellow_deploy`/`yellow_runtime` credentials, only these names
and127.0.0.1:55503. No role/membership/global grant change, restart, drop, template
write, live application change or provider network access is admitted.

Before mutation, the database metadata outside ONLY these three names, role
attributes and memberships hash to
`df5c00d7b4cf895a8d10966bc89d687e76b2ab9085b0a002c8d4ac2655fe3fdd`.
The template inventory and ordered immutable ledger hash to
`1e718847650369cfe7f02a5b14fd3486062acbe1d798e7559489e23d260ae518`.
Repeat both preservation checks after creation, migrations and tests.

All local1–85 migration bytes match published a10851786f17f2fdea0cf970320ee8c46a45b670
source. The ordered86 filename:SHA256 manifest (LF separators, no trailing LF)
hashes to `8b6f565233ee09a25823eb6b3c62f50305e128bd1435b93f924da40d6baa0a32`;
86 itself is `8d8d557f8ee397bcd7c315c1bdd3d93661c13fcaede25421dbed425ccce9c2c0`.
Forward78–86 contain no CREATE/ALTER/DROP ROLE or membership grant/revoke.

Commands, with credentials supplied in process memory only:

1. `CREATE DATABASE <exact target above> TEMPLATE yellow_order434_production OWNER yellow_deploy`
   only after all three absence, pristine template and manifest checks pass.
2. `runMigrations({databaseUrl, migrationsDirectory})` from `scripts/migrate.ts`:
   full canonical86 source for fresh/referee; exact byte-checked1–85 prefix for
   upgrade. It verifies already-applied1–77 and applies only the forward suffix.
3. With exact target URLs and `YELLOW_REQUIRE_ORDER440_Q212_DATABASE=1`, run
   `bun test tests/fiscal-retry-binding.integration.test.ts`; upgrade additionally
   sets `YELLOW_ORDER440_Q212_APPLY_UPGRADE=1`. A nonimplementer personally executes
   both, records commands/results, and does not substitute source inspection.
4. Native `pg_dump --schema-only --no-owner --no-comments` plus the existing
   schema normalizer compares fresh/upgraded schema. Update expected.sql only
   from verified actual output. Canonical `tests/seed_fixture.sql` and unmodified
   `tests/run_invariants.py` execute only on the separate referee target.

Generated exact prefix/evidence directory `.yellow/evidence/order440-q212/` is
admitted for byte-identical prefix85 files, bounded logs and normalized dumps.
No extra checkout/dependency/runtime copy. Existing generic migration/readiness
integration setup remains isolated-CI-only: its historical global-role setup must
not run on this retained shared cluster. Rollback-only, target-local readiness
hostility and no-op/checksum checks may use the admitted proof targets.

### First native execution found an exact catalogue mismatch

All three admitted clones were created. Fresh applied78–85, then86 failed55000
and rolled back on the same usable connection; upgrade/referee remain77. Root
and independent q212_independent_proof queried the actual85 catalogue: its
DateStyle is exactly `ISO,YMD`, matching applied81 source. Both86 guards wrongly
expected `ISO, YMD`. All other authority/predecessor guards match;86 ledger and
helper remain absent. Outside/template preservation hashes are unchanged.

Before reattempt, root corrected ONLY those two unapplied86 literals and added a
permanent static red1/1→green2/0 regression. Repaired86 SHA256 is
`40c55de6a34fb0f0ba354e5e37d210500038018fa649cf9437e29813fa0b915e`;
repaired86 manifest is `3f1b9019ee970b2b1b247ceebee6228ecc1d1ee423f1fa7e45a5f1420a86aa54`.
Genuine signed-cohort test source is now
`373cde6ee78a279cbccdc5b54b54e40279e4040945182d3cd1f693f79b8901af`.
The failed SQL was never applied;1–85 are unchanged. Continue only the recorded
existing partial targets: fresh85→86, upgrade77→85, referee77→86. Never recreate,
drop, alter old ledger rows or hide the failed execution. Independent actual
fresh and populated85→86 proof remains required after this correction.

### Independent retry replay oracle correction and bounded fresh rerun

Independent actual fresh86 run reached5pass/1fail(39 assertions): it incorrectly
expected body `replayed:true`. Existing D1389/CONTRACTS1 and operator.ts require
exact successful response bytes with body false and replay metadata only in the
header. Root corrects only the test to false and strengthens it with full byte
equality against the unconsumed original response, consumed AFTER recovery. No
product replay behavior or guards change. Repaired test SHA256:
`1498f9a6f0f9cd86ac36e1a53408b17e1caf63a03fb2f32f149b0ec54d9775c5`.

Retain the failed fresh target and its two synthetic tenant cohorts as evidence.
Root checked exact `yellow_order440_q212_fresh2_20260907` is absent and admits
this fourth, bounded synthetic target: same pristine77 template/owner/credentials,
same frozen manifest, production-runner78–86, no new cluster or live runtime.
Outside baseline excludes ONLY the four exact admitted names and still matches
`df5c00d7b4cf895a8d10966bc89d687e76b2ab9085b0a002c8d4ac2655fe3fdd`;
template hash remains unchanged. Upgrade is still empty85 and available for the
independent populated proof. Root's separate canonical referee on the existing
referee86 target passed11/11, unmodified seed and battery; reviewer acceptance
and schema/readiness remain separate requirements.
The target-local readiness proof may also use the existing failed-fresh86 target
for controlled committed helper/read-function metadata/ACL mutations followed by
exact restoration in finally blocks and positive controls. This permits actual
separate yellow_runtime login checks without uncommitted-catalogue visibility
shortcuts. It may never mutate shared roles, database identities, tenant data or
live targets. The new bounded test accepts only explicit Q212 deploy/runtime
URLs and86; it never creates/drops databases or replays historical migrations.
Generated `migrations86-drift/` under the same admitted evidence directory may
contain an exact canonical1–86 copy with ONLY one test comment inserted into
copied86. Use it only to prove applied-checksum refusal and unchanged ledger;
canonical migration bytes and applied ledgers must never be rewritten.

### Post-execution atomic rollback proof

The independent reviewer found that the generic migration86 rollback case checked
SQLSTATE55000 without its injected message. An early precondition failure could
therefore pass without executing86. Admit test-only strengthening within the
already scoped tests/migrate.integration.test.ts and
tests/fiscal-retry-binding.integration.test.ts; canonical86 is applied and immutable.

In the populated85 upgrade path, install exactly one temporary target-local
regular AFTER INSERT trigger `q212_migration_rollback_probe` on schema_migration
and its private function `public.q212_migration_rollback_probe()`. It must refuse
pre-existing probe objects. For ledger version86 only, verify the inserted
canonical filename/checksum, installed helper and changed reader before raising
unique SQLSTATE PZ086 / `Q212 migration86 ledger insertion reached`. Invoke the
unmodified canonical production runner, require that exact error and a usable
rolled-back connection, and compare the original full85 ledger including
timestamps, reader definition/authority, absent helper, genuine signed receipt
bytes/projection and financial/state rows. Remove only the probe objects in
finally. Then apply the same canonical86 normally and finish the existing full
upgrade/recovery proof. No role or canonical ledger edits, application or provider
operation, alternate migration source or product behavior changes are admitted.
The generic copied-SQL rollback case must additionally require its exact tail
message; it remains a separate isolated-CI case, not native execution authority.

Native execution needs one additional synthetic target because all four prior
targets are already86: `yellow_order440_q212_rollback_20260907`. Read-only inspection
finds it absent. Root must repeat absence, pristine77/template and outside-role/
database fingerprints before cloning; only after those checks may clone77 with
existing yellow_deploy ownership and apply the byte-identical78–85 prefix.
The upgraded test itself creates the two genuine cohorts. The same existing
loopback55503/postmaster15956 and retained process-memory credentials apply.
Outside preservation may exclude ONLY the four prior names plus this exact fifth
name. No other database, cluster, role, runtime or live app is admitted.
Independent personal execution of the strengthened populated proof is required.

Root preparation receipt: repeated target absence and the original outside/
template hashes passed. All canonical/published/exact-prefix1–85 bytes matched,
and frozen86 remained40c55de6. The fifth target was cloned once and the production
runner applied only78–85 (8 files). It is yellow_deploy-owned, empty85/zero tenants;
postmaster15956 and both preservation hashes remain unchanged. It is ready only
for the admitted strengthened proof, not a founder app or provider.

### Nonvisual candidate isolation

Root may assemble a temporary Git index from exact HEAD a1085178 plus ONLY the
Q212 product/migration/setup/CI/test paths listed in Exact ownership above.
Do not consume the real index's staged Q210/Q211 work. Preserve and hash that
index before/after. Generate one immutable Git-tree archive and extracted test
snapshot under `D:\Yellow\temp\order440-q212-validation-20260907`, with a junction
to the existing node_modules only (no dependency install/copy, .git/worktree,
credential, database or live runtime). This bounded verification artifact is
not another authoritative project or app. Record its exact tree and archive hash.
Full standing/types/import-boundary/licence tests there establish the nonvisual
candidate's own evidence, not acceptance of the unapproved Q211/Q214 design.
Publication must use that exact reviewed source or repeat changed-source gates;
no commit, push, merge or local promotion is implied merely by assembling it.

### Exact draft publication — 2026-09-07

Following the independent preflight recorded in review440, root committed only
the28 product/migration/setup/CI/test paths as
`4c46bee35759b26a5a767695e7356841c3d68370` and pushed the existing draftPR92
branch. The committed tree is exactly
`5c3df19c88ea6cb1dc271f3ebfd83f01fb97da6d`, matching the tested artifact.
Every publication blob matched before commit; normal Git LF normalization was
confirmed for the one raw-CRLF test file. Canonical86 and0001 hashes are unchanged.
The2018 unrelated index entries, including staged visual work, preserve semantic
fingerprint8005c168f5f39d6a0232ab5738464295a8ebe3c8f06df701790af101a7bd5f23.
No visual implementation, credentials or private evidence directory was committed.
CI34121615979 and normal CodeQL run against the new source; this receipt does not
claim their eventual result, merge, live86 promotion or UI approval.
