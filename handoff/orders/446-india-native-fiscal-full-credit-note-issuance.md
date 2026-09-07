# Order446 — Native full credit note, complete non-UI backend

**Status:** Native backend independently accepted and published as7f416a0e in draftPR92; Q218 and Q220 correct missed current87 test oracles. Exact236df73d now passes all six required CI jobs and normal CodeQL. Not merged or deployed.
**Owner:** Codex coordinator. **Phase:**7. **Date:**2026-09-07.
**Authority:** PROJECT.md; founder-approved Q187/D1302 clauses1–7; D1426 resumes
functional work only. No UI/UX, prototype or local app changes belong to this order.
**Base:**86-migration fiscal source; PR92 now publishes the independently verified
native-helper-only correction at d0f2f86391dfa1529f5436e7d866834bedda3608.

## Required complete outcome

Q218 (`handoff/questions/218-current87-financial-catalogue-oracles.md`) admits the
two exact current87 assertion repairs and pure setup-oracle regression after actual
CI34152535210 fails a stale128-table expectation. No product or schema change.
Q220 (`handoff/questions/220-current87-migration-acceptance-oracles.md`) further
admits only the exact full-current migration-suite expectations and pure regression
after CI34153361691 clears Phase3 and exposes older1–86 catalogue/ledger literals.

An authenticated authorized issuer can fully credit one previously issued native
India invoice through a canonical command and signed-session API. One transaction
creates a balanced correction journal, immutable original-reference binding,
separately numbered C/FY credit document, fact/outbox and durable replay receipt.
The original invoice, its I-series number/hash, consideration, tax, transfers,
provider submissions and signed receipts remain unchanged. Return an authorized
readable receipt; this is not just a private helper or an interface mock.

Full credit is one coherent first correction operation. Partial credits, debit
notes, replacement invoices, refunds/payments and provider transmission are still
required future capabilities; they are not declared complete or silently dropped.
Current invoice-only provider guards must continue to reject CRN. This order does
not certify tax-return eligibility, IRP acceptance or any external provider.

## Financial and authority requirements

- Reuse document/document_series, journal/posting_line, fact_log and outbox. A
  narrow immutable credit-note binding expresses enforceable original/document/
  correction relationships; it is not a second ledger or a mutable balance.
- Authenticate the exact original native invoice and completed source graph.
  Credit only the persisted valuation-source allocation in its invoice folio.
  For each original consideration root, negate its current guest amount and
  compensate its exact revenue peer; include pre-issue negative corrections.
  Never reverse entire multi-root transfer journals or unrelated allocations.
- Negate the exact original native tax journal lines into the same correction
  journal; rounded-zero tax needs no synthetic tax posting. No recalculation from
  current rates, no new rounding residual and no floating-point money arithmetic.
- The new journal is kind correction, reverses NULL: one invoice can combine many
  original journals. Bind their complete identities explicitly. Guest, revenue
  and tax-payable totals must equal the exact inverse invoice consideration/tax;
  the complete journal balances to zero in INR.
- Derive date from the property timezone; post to the current open business day.
  Require current property-scoped tax-fiscal.documents:issue AND
  financials.adjustments:write. Additionally require
  financials.adjustments:post-seal if any consumed source/accounting/original
  invoice business day is sealed. Never reopen or rewrite a sealed day.
- Reuse the exact supplier/property/kind/FY-bound credit_note series, its existing
  separate configuration permission and C/YYZZ defaults. No caller chooses an
  amount, account, tax, folio, source, series, date, number or hash.
- Current active tenant/user/property permissions are rechecked on replay too.
  Same-key retries preserve the exact original receipt bytes after idempotency
  expiry and later state changes; changed payload conflicts. Concurrent equivalent
  requests for the same original create at most one full credit, not two postings.
- Preserve existing correction/issue account/folio/root/journal lock ordering;
  acquire business-day and C-series locks after financial locks, then the existing
  publication lock. Do not introduce inverse ordering or post-publication locks.

## Immutable binding and trigger design

Do not weaken invoice-only origin constraints or any generic issued-source guard.
The new credit binding is forced-RLS and insert-only, with tenant-coherent FKs to
original native origin/document, new credit document, correction journal and source
identities. Unique original, credit document and correction journal per tenant.
If creation order requires a forward reference, use preallocated UUIDs and a
DEFERRABLE final FK/constraint, not a pending row subsequently UPDATEd. All final
binding fields and planned hashes must be known before INSERT. A deferred complete
artifact check must reject missing, altered or additional postings/documents.

Any targeted forward-only guard amendment must authorize only an exact immutable
credit binding and its exact derived journal lines. No GUC, caller source marker,
privileged-role shortcut or broad trigger disable may bypass historical guards.
Draft SQL stays outside the migration runner until executable proof is ready.
Canonical0087 is admitted only after draft execution; applied1–86 are immutable.

## Backend contract

- POST /api/v1/properties/:property/invoices/:originalDocument/credit-notes
  accepts exact JSON { reason } and Idempotency-Key; no query fields. Session owns
  tenant/actor; route owns property/original identity. Returns201 first issue,
  200 replay, original immutable body, with replay status in the response header.
- GET /api/v1/properties/:property/credit-notes/:creditDocument requires current
  tax-fiscal.documents:read and conceals missing/foreign objects consistently.
- Command input: tenantId, propertyNode, actorId, originalDocumentId, reason,
  idempotencyKey, envelope. Audit operation document.issued; all identity fields
  must agree with the verified envelope before the first database operation.
- Private owner capability commit_india_native_fiscal_credit_note receives
  tenant UUID, property UUID, actor UUID, original document UUID, reason text,
  idempotency key text and correlation UUID. It returns receipt_json text and
  replayed boolean. The original receipt JSON has documentId, documentKind
  credit_note, originalDocumentId, originalDocNo, originalSha256,
  correctionJournalId, seriesId, docNo, propertyNode, reservationId, folioId,
  supplierRegistrationId, recipientRegistrationId, financialYearStart,
  currency INR, status issued, businessDate, issuedAt, prevHash (nullable), sha256,
  sourceEvidenceHash, totalMinor (positive exact integer string), reason.
  Keep replay metadata outside this body. Read capability returns the same body.
- SQL rechecks authority and immutable source even if TypeScript is bypassed;
  TypeScript validates/snapshots inputs and returned rows without invoking
  getters/proxies, retaining exact receipt bytes and mapping sanitized errors.

## Exact scope and worker ownership

SQL/financial builder (no application, docs or live runtime edits):

- handoff/drafts/order446/0087_india_native_fiscal_credit_note.sql (new)
- tests/india-native-fiscal-credit-note.integration.test.ts (new)
- tests/fixtures/india-native-fiscal-credit-note-fixture.ts (new)
- tests/india-native-fiscal-credit-note-upgrade.integration.test.ts (new)

Typed command builder (no SQL, HTTP or global exports):

- src/contexts/tax-fiscal/india-native-fiscal-credit-note.ts (new)
- src/commands/issue-india-native-fiscal-credit-note.ts (new)
- tests/india-native-fiscal-credit-note.test.ts (new)

Coordinator integration:

- src/contexts/tax-fiscal/index.ts (new canonical command/read export only)
- src/contexts/financials/india-native-fiscal-credit-note-accounting.ts (if a
  cross-context accounting port is needed; no duplicate pure ledger)
- src/contexts/financials/index.ts (that port only)
- src/http/operator.ts (credit-note API methods/errors only, no UI assets)
- src/app.ts (two backend route registrations only)
- tests/operator-fiscal-credit-note.integration.test.ts (new)
- tests/india-native-fiscal-credit-note.intentional-red.test.ts (new)
- migrations/0087_india_native_fiscal_credit_note.sql (promotion after draft proof)
- tests/schema/expected.sql (mechanically derived after canonical proof)
- handoff/orders/446-india-native-fiscal-full-credit-note-issuance.md
- handoff/reviews/446-india-native-fiscal-full-credit-note-issuance.md (new)
- docs/CONTRACTS.md; docs/EVENTS.md; docs/STATE-MACHINES.md
- docs/PROJECT-STATUS.md; DECISIONS.log; handoff/LEDGER.md
- .yellow/evidence/order446/ (bounded ignored proof artifacts)

Any other path, canonical-frontier/readiness integration or database execution
target requires an exact written admission before editing/execution. No new
worktree, Docker/WSL, dependencies, existing-data deletion, global-role changes,
provider request, UI file or port3000 action. The draft is not production authority.

Q217 (`handoff/questions/217-credit-note-release-wiring.md`) is the subsequent
exact technical scope admission for bounded canonical87 release-wiring preparation.
Its historical-prefix preservation and frozen-candidate gates remain mandatory.

## Executable completion criteria

1. Genuine native invoices become one full credit each: IGST, CGST/SGST,
   CGST/UTGST and rounded-zero tax; negative pre-issue corrections, multiple roots,
   transferred folios and unrelated multi-root transfer participants preserved.
2. Exact source/component integer values, 366-night and int64 bounds; complete
   original records and both invoice/debit series byte-identical.
3.100 distinct originals, contiguous C1–100 and recomputable C-only hash chain;
   same/different-key contention gives one effect per original; changed reuse fails.
4. Failure injection around every journal/binding/line/document/counter/fact/
   outbox/idempotency stage leaves no artifacts or number gaps. Incomplete or extra
   artifacts, direct DML/capability misuse and marker bypasses fail closed.
5. Current/open/sealed-source authority and both seal/credit race orders; current
   revoked user/property/permission and cross-tenant denial on first call/replay.
6. Actual signed-session POST/GET and unchanged exact replay body; malformed input,
   foreign objects and missing grants do not leak information or write anything.
7. Fresh1–87 and populated86→87 preservation, no-op/checksum refusal, strict schema,
   seed/referee11/11, existing invoice/correction/provider/receipt regressions,
   typecheck/boundaries/licences/full standing and exact-source CI pass.
8. Independent non-implementing reviewer personally executes high-risk database,
   financial, numbering, RLS, rollback and API proof; integration and deployment
   remain separately verified states. No UI completion claim.

## Source notes

Founder Q187 is the product-policy authority. IRP6's official IRN documentation
distinguishes INV/CRN/DBN and the notified schema has preceding-document number/date
fields: https://einvoice6.gst.gov.in/content/irn-2/ and
https://einvoice6.gst.gov.in/content/wp-content/uploads/2022/07/notification-60-central-tax-english-2020.pdf
(inspected2026-09-07). These sources do not grant provider activation or prove a
tax-return adjustment entitlement; no certification claim is made.

## Native synthetic database admission — 2026-09-07T16:46Z

Independent read-only preflight by `native_helper_release_proof` validates the
retained native PostgreSQL16.15/160015 loopback55503 postmaster15956, protected
credential ACLs, existing roles and immutable pristine77 template. The following
two exact names were absent and are now admitted for Order446 synthetic tests:

- `yellow_order446_credit_candidate_20260907`
- `yellow_order446_credit_upgrade_20260907`

Immediately repeat absence, postmaster and template checks before CREATE. Each
database is cloned from `yellow_order434_production` with OWNER yellow_deploy.
Template remains77 ledger rows/frontier77,127 public tables,0 tenants/other sessions;
public schema and all474 functions/506 relations retain yellow_owner ownership.
Existing protected `D:\Yellow\runtime\order442-review\seed.env` and `app.env`
provide deploy/runtime credentials only in process memory through the existing
Order444 AST-selected helper functions. Never invoke Prepare/Promote/Rollback and
never log credentials or put URLs in process command arguments.

Production `runMigrations` validates canonical1–77 and applies only78–86 to these
two clones. Current canonical86-file byte manifest is
3f1b9019ee970b2b1b247ceebee6228ecc1d1ee423f1fa7e45a5f1420a86aa54;
86 bytes hash40c55de6a34fb0f0ba354e5e37d210500038018fa649cf9437e29813fa0b915e.
No applied migration or global role/grant may change. Canonical0087 remains absent.
Candidate installs the current exact draft through native psql --single-transaction
with ON_ERROR_STOP. Record the draft hash per attempt: preflight20f7fff6… is not
substituted for a changed draft. Failed SQL installation rolls back completely;
retain its error and retry only a corrected whole draft on an unchanged86 target.

Candidate runs genuine integration and HTTP proof with exact paired
YELLOW_ORDER446_DEPLOY_DATABASE_URL/RUNTIME_DATABASE_URL and
YELLOW_REQUIRE_ORDER446_DATABASE=1. Upgrade stays86 without credit objects; its
separately paired UPGRADE URLs admit only the genuine populated-upgrade test and
its intentional PZ446 rollback. Do not run generic migration/bootstrap tests that
change cluster roles. No other databases, tenants, source prefix, provider, Docker,
WSL or live app are admitted. No target drop/reset is admitted at this step.

Retain deterministic before/after metadata snapshots excluding only these two
names. Independent baseline outside DB/role/membership/db-role-settings hash is
1232059f6700f7fa7f6364065b0acb450105954c46b661bd37c64f83f8843d15;
template owner/schema/ledger/count hash is
d5bcf002be8270c2e3ba15920482bd9170bdadb5211831de59ccc158653ff8fe.
Repeat the same shaped comparison after creation, migrations and tests. Verify
live3000 remainsPID7568/parent9508/start08:09:36Z and3001 absent. A nonimplementer
must personally execute final corrected financial/RLS/numbering/rollback proofs.

### Iterative candidate-function proof admission

The first whole-draft installation rolled back on a reserved-word syntax error;
correctedf41e7e49… installed successfully with frontier86 unchanged. The first
ordinary test exposed missing synthetic fixture permission rows and produced no
credit. An independent scan found changed-original reuse was checked after source
lookup; this is being corrected and tested, not accepted as complete.

Only on `yellow_order446_credit_candidate_20260907`, admit transactional
CREATE OR REPLACE of the existing seven-argument
`public.commit_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid,text,text,uuid)`
using the exact current full-draft function definition with signature/security/
search_path preserved. Record old/new definition hashes and full draft SHA; prove
all table rows, ledger, ACLs and other function definitions unchanged. No DROP,
table reset, role/grant change, new signature or unrelated function refresh.
Upgrade remains86 and installs the whole current draft only inside its own test
transaction. Final whole-draft/fresh source equality is still mandatory; a patched
candidate alone does not prove fresh installation or canonical migration.

For before/after containment, a freshly captured deterministic snapshot with its
explicit query shape is valid; compare that exact same shape after each stage.
Do not compare hashes from different serialization/query shapes or wait on such a
comparison as a substitute for execution. Retain the independent preflight hashes
above as their separately shaped observations.

### Candidate-only search-path repair admission

Independent source inspection identifies a real temporary-schema shadow surface:
unqualified pg_locks can resolve to a runtime temp relation when pg_temp is omitted.
The draft must qualify pg_catalog.pg_locks and explicitly put pg_temp last on all
nine draft function clauses and three amended predecessor functions. This is a
repair under the existing strict authority contract, not a new capability.

Admit transactional candidate-only definition/proconfig refresh from the exact
current full draft for these12 functions: prevent_india_native_credit_mutation,
india_native_consideration_roots, india_native_credit_line_templates,
assert_india_native_credit_authority, guard_india_native_credit_birth,
guard_india_native_credit_artifact, assert_india_native_credit_complete,
commit_india_native_fiscal_credit_note, read_india_native_fiscal_credit_note,
india_native_journal_is_consumed, india_native_root_is_consumed and
guard_india_native_consumed_posting_line. Existing signatures, owners, return types,
volatility/security mode and ACLs stay exact; configuration becomes the approved
pg_catalog/public/pg_temp order, retaining existing UTC/ISO settings where present.
Record old/new definition/config hashes and full-draft hash. All rows, ledger,
constraints, triggers, ACLs and other definitions must remain unchanged.
No DROP/reset, other function, role/global grant, upgrade-target permanent write,
provider or app change is admitted. Genuine hostile TEMP pg_locks/type proof and
whole final draft/fresh equality remain mandatory before acceptance.

### Canonical upgrade and unchanged invariant referee admission

After independent final whole-draft schema equality, financial and signed-session
HTTP proofs pass, root may copy the exact frozen draft bytes to canonical0087.
The already admitted yellow_order446_credit_upgrade_20260907 may then permanently
advance from86 to87 through the unmodified production runMigrations only. Capture
its full original table-row hashes, functions/ACLs and complete1–86 ledger first;
require only0087 applied, exact canonical checksum, unchanged original rows and
ledger, then zero-file no-op. Never manually repair or insert a ledger row. The
incrementally repaired candidate remains a draft proof database with ledger86;
it is not relabelled87 or substituted for this canonical upgrade.

On the newly canonical87 upgrade target only, the unchanged tests/seed_fixture.sql
and tests/run_invariants.py may run once as the native equivalent of setup --db-only.
First verify its fixed tenant IDs00000000-0000-0000-0000-000000000001 and
00000000-0000-0000-0000-000000000002 and their fixture identities are absent.
No fixture reset/delete or alteration of the referee is authorized. If a collision
exists, stop this seed step and report it; do not replace previous evidence. Require
129 public tables and11passed/0failed, preserving every pre-existing non-referee
tenant row. Bounded protected credentials stay in process environment/memory.
No new database, role, cluster, Docker/WSL, live app or provider operation.
Capture normalized native schema and compare it to the independently checked
whole-draft shape; exact-source CI still proves a fresh canonical1–87 installation.

Read-only seed preflight found genuine global-key collisions on the populated
upgrade target: tax_jurisdiction and two fixed native GST extension UUID/version
rows already exist. No tenant collision exists, but unchanged seed must not run
there or delete those rows. The pristine77 template has zero seed-key collisions;
D: has25,102,934,016 bytes free. This supersedes only the referee-target selection
above, not its unchanged-seed/unchanged-referee requirements.

Admit one clean same-server proof clone named
yellow_order446_referee87_20260907 (read-only preflight currently absent). Repeat
absence/template77/zero-seed-key checks before cloning pristine
yellow_order434_production with existing yellow_deploy ownership. Apply exact
canonical78–87 through production runMigrations; no global role or grant changes.
Run the unchanged fixture and11-invariant battery only on this clean canonical87
target. Keep populated upgrade evidence intact; no target deletion/reset. This is
one temporary test database in the existing native server, not a new app, Docker
instance, cluster or worktree. The outside snapshot may exclude ONLY the two
previous exact446 names plus this third exact name; capture that same-shaped
baseline before creation and require equality after. All other database/role/
template metadata and live3000 identity remain unchanged. Stop on any collision
or failed preservation check instead of widening this authority.

### Root canonical execution — 2026-09-07, completed

After personally reading both bounded native helpers, root executes
`canonical-run.ps1 -Mode Upgrade -ExecuteAfterRootHandoff` and then the separately
admitted `-Mode CleanReferee -ExecuteAfterRootHandoff`. Both exit0. Helpers remain
under `.yellow/evidence/order446/`; runner SHA256
6b9e73cdb29d5ae21d1fa547277622354a09a6432500425c4eec87a291d4c74a,
upgrade helper97ce543628c1230a2597ec86cac2b98864d85d905cde1d2bd7cb963bf33f09f4.

Populated upgrade applies only canonical0087, validates its exact checksum and
all old rows/1–86 ledger/authority, and repeats with zero migrations. Evidence:
canonical-logs/20260907-181017-892-upgrade.log and its schema-equality log.
The clean referee clone applies exactly78–87 on pristine77, repeats with zero
migrations, then runs unchanged seed_fixture.sql and run_invariants.py once.
Evidence prefix canonical-logs/20260907-181127-860: clean-migrate,
clean-schema-equality, before-referee, seed, referee and after-referee logs.
Result:11passed/0failed of11; prior rows and ledger remain intact. The exact
referee proves119 tenant tables/RLS/policies and two security-invoker views.
This is the native equivalent of the repository db-only referee, not a claim
that Windows ran the Bash setup script or an authentic provider sandbox.

Canonical0087 SHA256c8b4ada5702807a0705a13e888e95730e0dbcc8ac7796e0ad2358208a5f873ba
is identical to the independently executed frozen draft. Both canonical schema
dumps equal the independent candidate/full-draft normalized snapshot,
SHA256d7e2b8516a9bf372d3e735ad688e702be0e08c5764667dacf4041627733b1ede,
1,783,378bytes. tests/schema/expected.sql is mechanically derived from that exact
snapshot, not hand-edited to silence a drift.

Three-name outside fingerprint remains
1232059f6700f7fa7f6364065b0acb450105954c46b661bd37c64f83f8843d15;
pristine77 template remains
d5bcf002be8270c2e3ba15920482bd9170bdadb5211831de59ccc158653ff8fe.
Postmaster15956 and live3000 child7568/parent9508/start08:09:36Z are unchanged;
no staging3001. Retain all three targets: the repaired candidate still has ledger86,
the populated upgrade and separate clean referee have canonical87. Do not rerun
the fixed seed/referee on retained targets, label the draft candidate87, or reuse
the earlier two-name outside hash query as though the third database did not exist.

Exact33-path nonvisual source tree705e95fb85e93c465a6cf48ad76ed87a60ec7339
is prepared from published d0f2f863 with real index unchanged. Archive SHA256
4242efddec25ca3588b2183d61e3c28cf3af40206e0c47845ed8fa0456f159f4;
diff SHA2564b78ec28db34f17919eb6a482e3a784885f90d3dc24754779092db168c9e0f9a.
Initial isolated standing1897pass/1375explicit skips/2 Git-history failures is
retained; final Git-context standing and exact-source CI remain separate gates.
No UI, app promotion, merge, provider operation or Phase7 completion is authorized
or claimed by these results.
