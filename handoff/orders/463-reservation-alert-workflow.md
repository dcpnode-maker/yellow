# Order463 — reservation alert workflow

Status: SOURCE IMPLEMENTED; isolated database and runtime-readiness proof accepted, 2026-09-12. Publication and runtime integration pending. Owner: Codex.
Phase4 receiving gap; high-risk data/tenant/evidence proof requires a separate
nonimplementer to execute real PostgreSQL tests before completion or activation.

## Outcome

Staff can create and deactivate reservation alerts in the existing detail drawer.
Reuse the baseline alert table and reservation.modified evidence. No new entity,
table, dependency, theme or reservation lifecycle is needed. The initial no-
migration assumption was disproved by review: frontier90 denies alert writes.
This closes alerts only; waitlist offers and the final Phase4 gate remain open.

## Exact scope and ownership

- Worker: src/contexts/reservations/alerts.ts and index.ts; src/server.ts;
  src/app.ts; src/http/operator.ts. Add tests/reservation-alerts.integration.test.ts,
  tests/reservation-alerts.test.ts, tests/operator-reservation-alerts.integration.test.ts.
- Root: src/http/operator/index.html, operator/operator.js and operator/operator.css;
  tests/operator-reservation-alerts-ui.test.ts. Keep existing paused445 picker
  changes and all unrelated edits byte-for-byte outside the alert additions.
- Root governance: this order, handoff/reviews/463-reservation-alert-workflow.md,
  docs/CONTRACTS.md, docs/EVENTS.md, docs/STATE-MACHINES.md,
  docs/PROJECT-STATUS.md, DECISIONS.log, handoff/LEDGER.md.
- Private synthetic proof preparation only under .yellow/evidence/order463.
  Actual database execution needs an exact existing isolated test target and
  native-only bounded admission; never use the retained serving data as fixtures.
- Root repair admission (question463): migrations/0091_reservation_alert_authority.sql;
  tests/runtime-dml-authority.integration.test.ts (exact alert columns/caller owner
  only); tests/reservation-alert-authority.test.ts; docs/SECURITY.md (named existing
  direct-SQL capability debt only). No live migration is authorized by source admission.
- Additive canManageAlerts expectation only in tests/operator-founder-reservation-journey.integration.test.ts,
  tests/operator-reservation-lifecycle.integration.test.ts and
  tests/operator-reservation-read-surface.integration.test.ts. No weakened assertions.
- Independent reviewer may repair/extend the new alert DB/HTTP/UI test harnesses;
  no reviewer production edits. Split deploy/runtime URLs with exact host/role/DB
  guards; use retained unique synthetic fixtures, not DELETE on facts or outbox.
- Source-only native proof preparation may target one new isolated database
  yellow_order463_review_20260909 on the already-running127.0.0.1:55503 server.
  Existing serving/recovery/referee/research databases are protected, not scratch.
  Bound native helpers under .yellow/evidence/order463; no actual CREATE DATABASE,
  fixture, migration or cleanup until root's exact execution admission. Include
  migration91 rollback/no-op/checksum and exact ACL/tenant/immutable-row checks.
- tests/schema/expected.sql may receive only the alert column ACL blocks generated
  by a verified canonical native PostgreSQL91 schema dump. Preserve all unrelated
  schema bytes; compare rather than manually inventing pg_dump serialization.
- Publication coherence (question463): src/kernel/build-info.ts and
  tests/build-readiness.test.ts may advance current source to91 and add the exact
  alert column-authority readiness check. Preserve every existing readiness gate
  and the frozen Order460/frontier90 source; no runtime activation follows.
- Current91 release-oracle updates only in the exact source/test paths
  enumerated in question463's publication inventory. Migration counts advance;
 129/119/119/28 table/RLS/policy/forced counts and historical partial frontiers
  remain unchanged. No setup or workflow execution follows from source scope.

## Contract

### Native proof execution admission — 9 September

Root fully inspected runner536a58fbacedae4daa9614f99696683150cf5a079b8d24584eb8f14fa0c3c0c0,
its pinned native helpers, canonical referee and fixture. Actual Inspect receipt
44850e2a59723f2b449cd9a3a06484303332f3b917b391da740f00e3ab2e547c
proves absent yellow_order463_review_20260909, exact PG16.15 PID9880 restart,
existing deploy authority and retained global fingerprints. Admit one Provision
with that exact receipt: CREATE only this template0 database owned by existing
yellow_deploy, canonical1–90, rollback-scoped0091 ACL proof, apply0091 and no-op,
private schema dump and global-fingerprint comparison. No other database write,
role repair, overwrite or retry. Native helper output is bounded; only its own
temporary stdout/stderr fragments may be removed after protected-log assembly.
An interrupted proof retains its target for diagnosis, never automatic reset.

After root accepts the resulting Provision receipt, separately admit Integration:
canonical synthetic seed/referee and alert/authority tests on this database only.
The immutable referee's TC12.3 intentionally deletes only its newly created
synthetic dorm claims and linked synthetic reservation parents between race tests;
this is the exact test-harness cleanup exception, not business-data deletion.
No serving/recovery/research database, real hotel data or3000 process is touched.

Actual Provision passed19.3s with receipta78e875828456ed4b31e547057ed82a3736077de9f33490818e27c0b596ef36f:
frontier91, exact0091 rollback, apply-once/no-op and unchanged global fingerprints.
Native schema00905c1b38f0a1a6e90581c327d89a377a9ab0f33620626d4eb3d66f24cd13c3
is retained privately. Root accepts that receipt and admits one Integration under
the same536a58 runner/self-pin with that Provision path/hash and RootHandoff.
Only the above synthetic seed/referee/runtime-DML/alerts tests and schema/global
comparison are included. Retain any failure; no automatic reseed, reset or retry.

POST /api/v1/properties/:property/reservations/:reservation/alerts
accepts exactly {code: string|null, message: string, showOn: checkin|checkout|always}.
POST .../alerts/:alert/deactivate accepts exactly {}. This corrects the unpublished
colon-suffix draft to the application's existing slash-action convention.
Both require a valid Idempotency-Key, authenticated tenant/actor, existing
reservations.lifecycle:write scope and same-property role grants. Readback stays
under the existing reservation detail read permission. No client tenant, actor,
subject, timestamp or active-state input. Return {alert:{id,code,message,showOn,active},
changed,replayed}; never expose another reservation's alert by UUID.

Message is trimmed nonempty and at most1000 Unicode code points; code null or trimmed
nonempty at most64. Notes permit ordinary LF/CR/tab whitespace; codes remain single-
line. Reject NUL/other unsafe control characters. Treat text as plain text
in UI. No file, identity document or sensitive structured payload is accepted.
These are input/resource bounds, not a new guest-data collection policy.

Domain commands accept Tx and a validated actor envelope; lock the exact same-
tenant/property reservation before the matching alert. Subject is always
reservation. Create writes active=true; deactivate permits only true→false,
with an already inactive alert a no-op. No delete, edit, reactivation or changes
to reservation status, occupancy, guest identity, folio, finance or numbering.
Terminal reservations may retain/create/deactivate operational annotations;
this grants no authority to change their lifecycle or financial records.

Use existing PostgresIdempotency with operation reservation.alert.create or
reservation.alert.deactivate. Actor/property/reservation and complete request
participate in the request hash. Exact replay returns the saved result; changed
same key conflicts. One transaction contains changed alert, reservation.modified
fact and outbox, plus idempotency result. Minimized event/fact diff is
{alerts:{action:create|deactivate,alertId,active}}; never code/message/guest values.
No-op emits no extra fact/event. PostgreSQL/RLS remains the tenancy backstop.

## UI and proof

Put controls in the existing detail drawer, only for same-property write grants;
read-only users retain readable alerts. Label note, code, display trigger and
buttons accessibly. Prevent double submit, retain a command key for an uncertain
retry, refetch authoritative detail after success, surface failure without
inventing a successful update. No fabricated timestamps or chronology.

Tests must cover malformed input, wrong tenant/property/subject, absent/read-only
authority, replay/conflict/concurrency, deactivate/no-op, immutable unrelated
business rows, minimized evidence and complete rollback on publication failure.
Root/worker run focused source/type/boundary checks. A separate reviewer personally
executes real DB isolation/concurrency/rollback proof before a built/verified claim.

## Deferred, not silently omitted

### Native readiness proof admission — 2026-09-09

After personal full-source inspection and independent credential-free review,
root admits one read-only Run of `.yellow/evidence/order463/invoke-readiness91-proof.ps1`
at SHA256 `a477bbbc9a3ea700edcf699d2d7bbd2f9eae62c7d690520fb9819d0ebda89f8d`.
The probe `readiness91-proof.ts` is pinned to
`2375cf74b3ab54d4891ef5f0f0eac4babf8ce2eea71c743fa5fe9302db9e5fce` and reads
only `yellow_order463_review_20260909` on the retained native loopback PostgreSQL
instance, using yellow_runtime with read-only transactions and bounded timeouts.
Prerequisite Integration receipt is
`D:\Yellow\temp\order463-reservation-alert-proof\20260909-120435-636-5c90f3c3-integration.json`,
SHA256 `b633b5c7afb866d27862386c08f488d9e8800e213f0371e71fb2762efdf8c72d`.
No app launch, fixtures, DDL, grants, deployment, publication or serving-database
changes are authorized by this check. Persist only the minimized protected receipt.

The admitted probe failed at assert_release_readiness with no success receipt.
After full source inspection, root admits one read-only diagnostic Run using
invoke-readiness91-diagnostic.ps1 at
9d26b56e3741f6524ac15083efc81cdd2cba07cd0d970c8bc9b3f90bc4383e01,
with TS400ff3667957dfc0da7820cfe817d2f4d3dffc25eda6528741aad93922bca94a.
It executes the exact captured production catalogue and, if all catalogue flags
pass, the existing read-only permission transaction. Output is only known boolean
names/states, phase enums and five-character SQLSTATE; no raw errors or data.
This remains the same isolated91/runtime-role target, with no mutations or launch.

The first diagnostic invocation was stopped pre-credential by the temporary3001
listener. After owned cleanup, Bun compilation exposed two newline-before-as
syntax errors before any database query. Preserve both outcomes. Root inspected
the exact two-line cast repair and personally compiled all three Order462/463
private TS helpers with Bun.Transpiler, independently of tsconfig exclusions.
Admit the corrected same read-only diagnostic once: TS909463f12d3c4162fc8145167d2c4019e413534ec89aff80c03ab80ed3855e0a,
runner6c9f7faf388a15b2bd3e56c37adab062cb662db82dd8f48de18a2adf54ceeb2f.
No predicate, SQL, identity, output or authority changes accompany the parser repair.

The sparse waitlist_entry table is not an implemented offer workflow. Founder
choice between manual offers and automatic promotion is being clarified while
alerts proceed. Offer snapshot/configurable window/priority/expiry and canonical
hold→commit composition need a separately admitted contract; no second reservation
lifecycle or ungoverned capacity promise is introduced here.

### September12 readiness correction receiving

The actual September9 diagnostic receipt7d024410d8b503d98dfa2067018dd4df51172cc6abd17465d5f2b8d611c3683a
records catalogue SQLSTATE22023. Root's scoped correction in build-info.ts
b6149f8c89336b4a9ac33fa3a26fb4657590b47810f11368aa8c74327170f2e2
passes nullable attribute.attacl directly to aclexplode instead of constructing
an empty ACL array. No role, privilege, tenant, SQL output or expected frontier
is relaxed. Updated unit82242a91add9e89586c35c4ae631fbc809ee188cb3587d00efe60536a7b8ee4d
pins the correction; root and nonimplementer focused8/0(250) pass.
Admit fresh source-only private proof preparation against the same isolated91
database after native host recovery: old empty-array22023, NULL zero rows and
strict-function metadata, then the actual exported runtime-readiness function.
Require read-only yellow_runtime sessions, exact fresh host receipt and before/
after identity checks. No fixture/migration/role write or serving app follows.
An exact root Run admission remains required after independent helper review.

Root personally reads the complete fresh e5952d33463e847ec4f4676ca81bac071ec3f0d506cc19d62210a1cf1fbdc48f
wrapper, unchanged probeae3a448f46f01c5d69c521d756817f75a2050060d2936435fed21d41e7b1aa64,
shared bindingb40646de518261dfcc9e36b8a269197aaee5364f35453710a542a37b29a8ee15
and original16f118 helper. Root repeats the receipt-only15 and successor18
assertions/credential-free Review; nonimplementer /root/readiness91_verify
independently executes those and private TS compilation. Admit exactly one Run
-RootHandoff of that exact wrapper on the existing isolated91 database using
the saved runtime role, read-only SQL and bounded output/timeouts only. Bind
restart563fc164/companion9b5592a1/precontrol223247f4 and PID2340 exact full start.
Check host before query, after result before success receipt, and in finally.
No DDL, seed, provider, app or serving-database modification is admitted.

Actual one-shot read-only successor passes on September12. Independent receipt
b2a2e0065a87d9662d4f8df001bc43d7f35397e718a95df209c6d4797cd35e3b and log
ec949d7d115c9333f2861246cb9420d815af5c837584d23fe9e298f994983f66 confirm
old22023, NULL zero rows, strict aclexplode and actual exported readiness true at91.
Root independently hashes/reads the bounded receipt and log identity. Current
source/readiness proof is accepted; publication/runtime integration remain pending.
No Phase4/7 completion or live workflow follows from this result.
