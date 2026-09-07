# Order440 / Q208 — Independent operator invoice workflow review

## Bounded document-read service review — 2026-09-07

Reviewer: fiscal_http_acceptance. Production implementer: root. Scope for this
assessment is only india-native-fiscal-document-read.ts, its focused
india-native-fiscal-operator.test.ts and the detailed Q208 contract. No production
edits, PostgreSQL execution, HTTP/UI approval or complete Q208 acceptance by this
reviewer. SQL82 and genuine two-tenant/current-role/privacy proof remain pending.

Personally ran `bun test tests/india-native-fiscal-operator.test.ts` on original
sourcef06e30e336fe01132246c15fb618a87a3e83cbc8da07f361b998623970802caa,
test15777a57254b05dbbfd3bf56cfbc2105a54aa40bbed6045210f72e37f3db78ec:
**8 pass,0 fail,89 assertions,86ms**. The following independent in-process
counterexamples passed malformed data through that source despite the green suite.

### F1 — Coherent count cannot silently produce an incomplete first page

With the ordinary September2044 scope, default limit25, no cursor, a single valid
document row with matching_count="3" returned ok, one item, matchingCount="3" and
nextCursor=null. A coherent pre-cursor count proves two records were omitted, but
the service presented the page as terminal. Root was asked to require first-page
cardinality min(matchingCount,limit+1), not merely count>=returned rows. This is
malformed-result boundary evidence, not a claim that the unfinished SQL currently
produces such rows or a demonstrated database authorization leak.

### F2 — Duplicate immutable document identity across keyset positions

Two rows sharing documentId00000000-0000-4000-8000-000000000010, at
2044-09-06T10:00:00.000002Z and2044-09-06T10:00:00.000001Z, were accepted because
the tuples were strictly descending. With limit1 the duplicate sentinel generated
a next cursor, permitting the same invoice to recur. Root was asked to reject
repeated document IDs across all consumed rows, including the sentinel.

Root reported permanent RED8 pass/2 fail,91 assertions, then implemented the
first-page cardinality guard and duplicate-ID set. That RED is implementer evidence,
not a personally executed reviewer RED. I independently inspected the change and
ran the focused suite: **10 pass,0 fail,92 assertions,105ms**. The prior one-row
snapshot positive control now correctly uses coherent count1 instead of3.
Intermediate source521a883ee054ce608fe8dc52574fb6dc65fe6796c8382b6d5a474d7b1c3cf124;
test67622e5670e768580e58988625c750f0b835965c3e59fa3d8751cfc2835e0848.

### Independent adversarial execution and remaining cross-page case

An in-process `bun -e` harness loaded only the fixture constructors preceding the
focused file's describe block, transpiled those constructors and independent
assertions, and imported the actual production read service. It registered no
replacement production logic and made no database or file writes. It recorded
**90 independent checks passed,0 failed**, twice on the intermediate repair:

- True distinct microseconds through nextCursor and actual bound SQL arguments;
  strict descending tuple/equality rejection; malformed calendars, times, fractional
  precision and timezone spelling rejected.
- Tenant/property/date/reservation/folio/query binding; canonical cursor encoding,
  duplicate JSON names, alternate numeric spelling, extra whitespace, BOM and bad
  UTF8 denied before SQL. Search normalization and scope are not authorization.
- Empty first/final-page metadata and preserved filtered totals; mixed/null/missing
  result shapes, inconsistent counts, sparse arrays and extra row fields rejected.
- Input/row accessors, revoked/non-revoked proxies, unexpected prototypes, symbols
  and nonenumerable fields; zero getter execution. Driver-only array metadata was
  ignored without invoking it. Inputs were detached before awaiting, and outputs
  remained frozen/detached after source mutation.
- Exact signed64 maximum accepted; max+1, negative, signed/leading-zero/decimal/
  exponent/numeric values and overflowing totals denied.
- Immutable content/hash/number/date/property/document checks, invalid identifiers,
  duplicate JSON members, BOM, oversized content and malformed UTF16 rejected even
  after recomputing the supplied content hash. Output retained the original string.
- Permission42501 mapped to sanitized permission_denied; general exceptions,
  code accessors and revoked error proxies produced sanitized database_error without
  executing getters or exposing messages.

Extending that harness to the next-page cursor found **90 pass,1 fail**: a cursor
whose last document11 is at.000002Z still accepts document11 at.000001Z on the next
page. The duplicate set starts empty instead of remembering the cursor document.
The malformed repeated immutable identity must also be rejected across that known
page boundary. Reported to root; pending repair/re-execution at this checkpoint.
A first attempt to assemble this extended command had a quoting/parser error before
any probe executed; the corrected harness produced the stated90/1 result.

No broad conclusion about SQL authority follows from mocked transaction results.
Actual scoped capability checks, immutable source associations, role revocation,
cross-tenant/property isolation, coherent query snapshots and the entire operator
workflow require separately admitted real PostgreSQL/HTTP/browser acceptance.
No complete Q208, financial, privacy or merge approval is granted here.

### Final bounded read-boundary correction accepted — 2026-09-07

Root initialized the consumed document-ID set with the cursor document when
present and added the same-ID/older-microsecond next-page regression. I inspected
that exact production/test delta; it preserves legitimate distinct-document
microsecond ordering, coherent empty final-page totals and all prior checks.

Personally reran `bun test tests/india-native-fiscal-operator.test.ts`:
**10 pass,0 fail,93 assertions,73ms**. Personally reran the full extended independent
in-process adversarial harness: **91 checks passed,0 failed**, including both first
counterexamples and the cross-page identity case. No production edit or database
action was performed by this reviewer. Final frozen SHA256:

- src/contexts/tax-fiscal/india-native-fiscal-document-read.ts:
  04968f70f65ce1f57f1f9f4d8f0975705dcfde24503938cd6f0a71e2a2a92848
- tests/india-native-fiscal-operator.test.ts:
  d25ad76f8af543f10944fcdd044ed7f3c58bc756766a6b1794bcbd2e48ff6ddc

F1 and F2, including the cursor extension, are discharged for this exact bounded
service. No further boundary finding was identified in the stated assessment.
Accepted for continued Q208 integration under the existing contract. Root's newer
HTTP tests and results are separate implementer evidence, not claimed here as a
personal HTTP review. Actual two-tenant/current-role SQL proof, HTTP/UI workflow,
privacy review, migration/referee and exact-source CI remain required before any
complete workflow or independent merge approval.

## D1314 fresh issue status and forward83 lock placement — 2026-09-07

Root requested a bounded nonimplementing review before prospective83 freeze.
Read applied82's v3, canonical77's v2, the shared statutory lock helper, stage5
document context, canonical55 dated-status identity constraint, D1314/D1359 and
the actual Q208 counterexample fixture. Applied82 SHA256
702f66b3e05547f397e2393ae5a608a6f0c3069ec534b2c947bfc309983bf185 is immutable.

### Personally reproduced original-policy bypass on genuine PostgreSQL

After the builder explicitly released the DB lane and froze the case, I executed
only `bun test tests/india-native-fiscal-operator.integration.test.ts --test-name-pattern 'reproduces D1314'`
on its already admitted synthetic yellow_order440_q208_build_20260907 at82.
Protected seed/app URLs were loaded in process, validated against exact deploy/
runtime users and127.0.0.1:55503 with no options, then only pathnames replaced.
The two YELLOW_ORDER440_Q208 URLs and required flag were scoped to that child.
Preflight verified exact82 ledger/hash and zero other target sessions.

Result: **1 pass,0 fail,4 filtered,6 assertions,4.96s**. This is a passing
counterexample test, not a successful enforcement test. Two genuine native
issuance fixtures used historical service/payment dates and Pacific/Kiritimati;
after their real series setup, only each synthetic property's timezone was moved
to Pacific/Pago_Pago and its shifted issue day opened. The dates differed. With
zero supplier-status rows at the new issue date, actual old issueNative/v2 still
completed the accounting/document transaction. The positive control added exactly
one bound active status at that date and also issued. No document was fabricated,
immutable status deleted or existing retained target reset.

Frozen test4e0b66bf870fb854ba7ee41142d0f4a135d24b616d456a7a2e85db39a4d29639;
fixturebbbee092e1082448eb893cff8c92d4b5965307917289ff3530bfdbd6e1e7e41b.
All three source hashes and the complete82 ledger remained unchanged; global
role/membership fingerprint1a404b9f0aa6c85deaf9ee4d9db2351be8327733b8d1b2f88f6b5221e2a9496e
was preserved. Other target sessions were zero and all owned pools closed.
The DB lane was explicitly released afterward. This existing builder-target run
is independent defect reproduction, not the separate full acceptance target.

### Smallest correct existing-policy correction

Forward83 should replace the existing private
lock_india_native_statutory_source_graph with the same signature/owner/config/ACL.
Fresh v2 calls it at canonical77:4155; fresh v3 calls it at82:627. Both completed
replay branches return before that helper, retaining current authority/request
checks without consulting today's status/open-day/series. A v3-only fix leaves
the independently reproduced old fresh-v2 bypass intact.

Resolve exactly one issue-date supplier status after the strict statutory reader
authenticates p_native_invoice_source, including its issue date against the actual
transaction timestamp in the locked property timezone. Bind seller UUID and
registration evidence hash from the authenticated prepared source. At the EXISTING
stage4 supplier-status289 slot, lock DISTINCT TOS and issue-status IDs in UUID order,
before supplierSEZ, recipientSEZ, classification and property-location groups.
Reread the graph and exact discovered issue row/hash/date after any wait; do not
chase newly discovered rows. Canonical55's unique tenant/supplier/hash/date identity
prevents a second matching row. Deduplicate if both dates share one status ID.

Do not add status FOR SHARE after lock_india_native_document_context: that helper
has already acquired stage5 day SHARE, series UPDATE and tail KEY SHARE, so acquiring
stage4 status afterward would violate D1359. Applied82's existing post-context
count-only guard may remain redundant; never rewrite applied82. No new public
capability, status policy, financial engine or completed-replay revalidation is
needed for this correction.

### Prospective83 inspection: not yet applied or approved

Read the complete first WIP83 at
migrations/0083_india_native_fiscal_operator_calendar_bounds.sql,
SHA25697ba8f777c12744b4e505ca1047935238ab2afd323a9213c81e8efd219b8e97f.
Its shared stage4 lock placement follows the above correction and leaves v2/v3
replay branches untouched. Two draft defects were reported before application:

- Introduced pg_catalog.coalesce is not valid qualified special-expression syntax.
  Personally executed SELECT COALESCE(NULL::integer,0), returning0, then the
  qualified form, which failed with SQLSTATE42883/function does not exist. These
  were read-only queries; frontier remained82. Both occurrences need unqualified
  COALESCE before the missing-calendar branch can be trusted.
- The private statutory helper postcondition checked only app_role. A direct
  yellow_runtime EXECUTE grant is absent from pg_get_functiondef's body hash and
  could survive replacement while that check passes. Require explicit private
  PUBLIC/app/runtime denial and exact owner/config checks. This is a static
  postcondition gap; I did not add a hostile grant to the builder target.

No83 freeze/application approval at this checkpoint. Required proof includes:

1. Actual fresh v2 AND v3 denial for absent/wrong-date/wrong-seller/hash evidence,
   with valid active controls and complete unchanged financial/evidence census on
   denial. Keep the actual pre83 counterexample as historical evidence.
2. Retained completed pre83 v2 and new v3 replay after clock movement/current-date
   status absence, with identical receipts/effects, current authority denial and
   request/selector identity still enforced.
3. A deterministic other-connection issue-status FOR UPDATE blocker. Issuance
   must wait in stage4 while independent NOWAIT checks can still acquire its
   businessday/series resources and D99 remains unheld. Release then exactly one
   issue; include same-ID deduplication and distinct status IDs in both UUID orders.
4. Fresh post-wait exact membership/hash/date recheck without lock chasing; full
   canonical82→83 rollback/drift/no-op/schema/private ACL checks.
5. Separately admitted independent two-tenant/full workflow, referee and exact
   source CI before complete Q208 acceptance. No production changes by reviewer.

### Revised83 bounded source disposition

Personally inspected revised prospective83 SHA256
5a8ac565f3aaebfee4245121a434dba5867f558091a58aad87f23bed5dee0705.
Both qualified COALESCE calls are corrected. The private helper postcondition now
checks explicit PUBLIC/app_role/yellow_runtime EXECUTE denial, yellow_owner and
fixed search-path/timezone/DateStyle settings; its exact predecessor function-body
hash also guards configuration/body drift before replacement. Shared stage4 status
lock ordering and completed-replay separation remain as assessed above.

No remaining bounded source blocker identified for root-coordinated execution on
the admitted builder target. The builder reports a full forced-rollback migration
with the committed82 ledger/helper hash restored; that is builder evidence, not
my execution. This disposition permits progressing the proof, not full financial/
SQL83/Q208 acceptance. All actual fresh-v2/v3, retained completed replay, contention,
atomicity, independent full-target and canonical referee requirements above remain.

## Independent applied83 / candidate84 executable boundary review — 2026-09-07

Reviewer: Codex fiscal_http_acceptance, nonimplementer of production SQL and the
read service. Root requested bounded query execution/authorization/return-shape
review, then explicitly authorized personal rollback-only hostile probes on the
existing builder target. No full Q208 acceptance, publication or merge approval.

### Exact source and execution scope

Applied82 remains702f66b3e05547f397e2393ae5a608a6f0c3069ec534b2c947bfc309983bf185;
applied83 remains5a8ac565f3aaebfee4245121a434dba5867f558091a58aad87f23bed5dee0705.
Inspected candidate84 first at
f852a7e7738615b81c75a706c7b4a145c2905a9e63f2c6c333063a0c73b297f3,
then personally executed
9b8111b94d62c6c47ff3aa2c1cfb37b7a3584c48f08474c3c86fdb5d7770bc5d.
The intervening delta only qualifies chr(10) in its validation as pg_catalog.chr.
The discovery COALESCE correction and outer aliased list UNION ordering preserve
the five output columns, typed timestamp/count and same coherent source CTE. Their
source inspection is not evidence that every discovery/issuance branch works.

Read source remained04968f70f65ce1f57f1f9f4d8f0975705dcfde24503938cd6f0a71e2a2a92848.
Personally reran `bun test tests/india-native-fiscal-operator.test.ts`:
10 passed,0 failed,93 assertions,90ms. These fake-query tests do not establish
compatibility with actual PostgreSQL return values or driver errors.

After explicit builder lane handoff, ran a memory-only Bun script using
`bun -e` against yellow_order440_q208_build_20260907 at127.0.0.1:55503.
Protected deployment URL was loaded only in process from the admitted Order442
seed.env key, host/port/user checked and only pathname replaced; no secrets logged.
Preflight required exactly83 ledger entries with the above82/83 hashes and zero
other target sessions. The script reserved one deployment connection, opened one
transaction, set statement_timeout10s, and executed the complete canonical
candidate84 bytes. Each probe used a savepoint, SET SESSION AUTHORIZATION
yellow_runtime, SET LOCAL ROLE app_role and transaction-local app.tenant_id,
then rolled back to its savepoint. Existing deployment superuser authority was
used, not changed. Genuine issued rows came from document joined to native origin;
no immutable document, financial or origin rows were fabricated or modified.

A first invocation stopped on the diagnostic SELECT's reserved alias `day`
(42601), before BEGIN or candidate DDL. Correcting only that harness alias to
issued_date produced a terminal exit0 in0.90s. The complete transaction rolled
back. A subsequent read-only diagnostic transaction also exited0 in0.58s.

### Personally reproduced blocking findings

1. **Foreign-tenant role accepted by four new capabilities.** Baseline user_role
   references global role(id), not a tenant-composite role identity. Applied82
   lines72,147,197,241 join user_role directly to role_permission without requiring
   role.tenant_id=the actor tenant. Inside the rollback transaction, inserted a
   fresh actor in tenantA, a role in existing tenantB, the three read/request
   permissions on that role, and a user_role linking that actor/foreign role to
   the genuine tenantA property. That was the new actor's only grant.
   list_india_native_fiscal_documents returned one real invoice;
   read_india_native_fiscal_document returned its actual detail;
   read_india_fiscal_submission_delivery_receipt_by_document returned
   `not_requested`; list_india_fiscal_submission_provider_options passed its
   authorization check and returned zero choices on this fixture. The latter
   proves authority acceptance, not a nonempty provider-data leak. A same hostile
   role carrying issue/finalize permissions was correctly rejected42501 by the
   canonical discovery authority, which DOES join the role's tenant. The by-doc
   wrapper's early not_requested/legacy/ambiguous paths precede the stronger81
   receipt reader; that reader cannot protect those early responses. Minimum
   correction: exact same-tenant role joins in all four, preserving purpose and
   property checks; actual hostile denial plus valid same-tenant controls required.

2. **NULL SQL fetch limit bypasses the required bound.** With otherwise valid
   inputs, p_fetch_limit=NULL returned the genuine invoice;102 was correctly
   rejected22023. Applied82 line57 uses only NOT BETWEEN2AND101, which evaluates
   NULL, and line107 consequently executes LIMIT NULL. A separate actual PostgreSQL
   `SELECT count(*) FROM (SELECT generate_series(1,102) LIMIT NULL) generated`
   returned102. The retained target has eight genuine documents across tenants;
   this proof does NOT claim an actual capability response exceeding101 rows.
   It proves NULL acceptance and PostgreSQL's unbounded LIMIT semantics without
   fabricating102 issued documents. Require an explicit NULL denial and permanent
   raw-capability NULL/1/102 versus2/101 controls.

3. **Actual driver permission errors are misclassified.** The real invalid-actor
   list call produced own-data errno42501 and codeERR_POSTGRES_SERVER_ERROR.
   Calling the actual read service on that same connection returned database_error,
   not permission_denied. Its databaseFailure checks only code===42501. Repair
   using safe own-data SQLSTATE extraction across the documented driver fields;
   retain accessor/proxy rejection and sanitized messages. Existing invoice code
   already demonstrates the errno/sqlState/code own-descriptor pattern.

4. **Unsupported property silently becomes an empty India queue.** Inserted only
   a rollback-owned AED/Asia-Dubai property, same-tenant role and property-local
   grant. Raw list returned the metadata row with count0. The actual service
   returned `{ok:true,value:{items:[],matchingCount:"0",nextCursor:null}}`.
   Provider options likewise returned empty success. No jurisdiction applicability
   guard or explicit unsupported result was observed in these read paths. Q208
   requires unsupported jurisdiction to be explicit, not fabricated empty success.
   Root must define/admit the exact current capability predicate/error mapping;
   do not infer tax jurisdiction from timezone or invent a new policy.

5. **Real genesis invoice rejected by the detail DTO.** On the same genuine row,
   actual service.list succeeded with count1/items1, but service.read returned
   invalid_document. A subsequent read-only transaction isolated the cause:
   SQL returns previousHash=NULL for the first document in a real fiscal chain;
   read source line58 declares string and line244 requires SHA256. All14 keys
   were present; the other field types, content hash, document number, business
   date/DocDtls date and INV kind agreed. The existing issued-wire validator
   accepted the exact content. Actual issuedAt retained six digits:
   2026-09-07T00:23:39.146709Z. Preserve canonical genesis NULL in the DTO instead
   of inventing a zero hash; require real genesis and linked-document controls.

### Preservation, limitations and next gates

Before and after the rolled-back probe:18 tenants,36 users,18 roles,108 role
permissions,18 user-role grants,18 org nodes,8 documents and8 native origins.
Combined exact ledger/function-definition/global-role+membership/census fingerprint
remained8de1426aeff3761ba2c42001ac309abb0bceb12d1b5719bc04c63c59f8628543.
Every inspected source hash was unchanged. The committed frontier stayed83;
candidate84 was not applied or entered in the ledger. All owned sessions/pools
closed and other target sessions were zero. No global role attributes/grants,
template, existing evidence, preview, checkout or production files were changed.
The DB lane was explicitly released to native_resume_builder afterward.

Builder separately reports rollback candidate execution of list nonempty/empty/
exact-after-last, raw detail/by-doc/provider, selection_required and invalid-recipient
blocked branches. Its ready branch still reports supplier_issue_status_unavailable
because document-context supplier hash differs from retained authenticated status;
that is NOT my reproduced diagnosis or successful ready-branch proof. Do not loosen
evidence predicates to turn it green. The original empty-page test also supplied a
future9999 timestamp, which legitimately includes the actual row under descending
keyset comparison; correct the test to the exact last tuple, not production order.

Hold full Q208 acceptance. The five personal findings above and remaining genuine
ready/confirmed issue/rollback/concurrency/independent target/referee/CI gates are
open. The current84 admission covers only two query execution repairs; it does not
silently authorize these additional authorization, applicability or DTO changes.

## Independent local invoice-print QA — 2026-09-07

Reviewer: Codex fiscal_http_acceptance, nonimplementer of the print lane. Root's
bounded task uses fictional invoices only, existing local tooling, no software
installation/external service, no database work and review-report edits only.
Inspected the complete invoice-print module, permanent tests and vendored notice;
used the code-review skill's correctness/security/performance checks. This does
not approve signatures, provider registration or the full operator workflow.

### Frozen inputs and personally executed checks

- src/http/operator/invoice-print.js:
  f42c73c79fb96bb6428e5414db54ee35d1d6be6d1352f300dd04fb8f448f7b84.
- src/http/operator/vendor/qrcodegen-v1.8.0-es6.js:
  c6599a62397cf9cd70570c5f74b0f9b962eb21fc3444aadb440efbfbebe0d1d8.
- src/http/operator/vendor/QR-CODE-NOTICE.md:
  49dc6a84b301469ac30cba28f296002fc6db0043094533bbd1ec444b0c0b9284.
- tests/operator-invoice-print.test.ts:
  8b1f43962055c241f44c43d6620e4ec226296e8031c4d0de43757700d011ab85.

`bun test tests/operator-invoice-print.test.ts` personally passed10 tests,
0 failures,302 assertions in150ms. This exercises escaped fictional names,
decimal-string display, registration-state labels, genesis NULL, exact receipt
identity, matrix quiet zone, byte capacity rejection and stylesheet/vendor guards.
Additional direct calls accepted the compact fictional control and rejected
trailing LF/CR/CRLF/U+2028 without encoding. Personally removed only the final
22-byte ESM export from the in-memory vendor buffer: its first45,336 bytes hash
6a1116192ed1dd67fa1bf31e77f5817103d71c23bbac24c382e698b7668bdd01,
matching the recorded upstream artifact. No vendor file was edited or downloaded.

### Actual local browser and A4 output

Rendered the actual artifact built from the permanent fictional invoice/receipt
fixture using bundled Playwright with local Chrome152, driven by the bundled Node
runtime. HTML was provided directly in memory; every network request was blocked
and the actual attempted request count was zero. The stable application, user
browser profile and PostgreSQL lane were not used. One first Bun-to-Playwright
launch stalled before producing any page. Verified and stopped only its owned
root PID2740 and descendants16964,764,1556,3332,17384; the separate Node-driven
attempt completed exit0 in4.55s and closed its browser/context normally.

Actual widths1100,375 and320 CSS pixels, deviceScaleFactor1, all had document
scrollWidth equal viewport width and no measured descendant escaping the viewport.
The exact large total and sandbox warning remained in rendered text; no script or
image elements were created from the escaped hostile-looking names. The QR SVG
rendered at158.734375 square CSS pixels (42mm). Also exercised print media at794px
and generated the actual preferCSSPageSize A4 PDF. Local Poppler pdfinfo reports
two pages,594.96x841.92 points,50,632 bytes, no PDF JavaScript. Personally viewed
both rasterized PDF pages and the phone screenshot: legal fields, exact totals,
provider warning/QR and immutable source identity are present; source identity
occupies page2 without being clipped. A multi-page LINE-ITEM header repetition
test was not executed; the one-line fixture does not establish that gate.

Artifacts retained in D:/Yellow/temp/q208-print-review-ODhlRY:
desktop.png, phone.png, phone-small.png, A4.png, invoice-a4.pdf and a4-page-1/2.png.
PDF SHA256c5648bdd53dfa7a7c7244e019e73e71a69335b425e1a5b5a67def34b5bd0217e;
375px screenshot SHA256a522c75d58752b8a5292aa60cd12caf94475e087c7107e20ffe5f5a756cf83e0.
The abandoned first attempt's directory q208-print-review-jPvUtz contains no
rendered artifact. No production/test files were edited during this review.

### Remaining limitations and disposition

- Phone line-item headers and the deliberately large amounts wrap heavily at
  375/320px, sometimes one character per line in narrow columns. Absence of
  overflow is not a claim of good phone readability. Consider a dedicated mobile
  preview presentation while retaining the A4 table and every legal value.
- Exact-token QR round-trip decoding was NOT executed. Both installed Python
  environments lack cv2/zxingcpp/pyzbar; Pillow is not a decoder. Actual Chrome
  BarcodeDetector is undefined, including an experimental-platform-feature probe.
  BrowserAct has no configured browser; its skill-required approval/setup flow was
  not used to create one. A ZXing WASM asset exists in a bundled browser plugin,
  but no supported standalone callable reader was verified; it was not treated
  as executed proof or reverse-engineered into a new decoder. No package was
  installed and no QR image/input was sent to an external decoding service.
- The displayed unit fixture is51 bytes/37 total modules. The encoder accepts its
  nominal2953-byte bound with185 total modules, and rejects the next byte. Those
  facts prove generation/capacity behavior, not that a real reader recovers the
  exact fictional input from screenshots or paper. Near-capacity rendering at
  fixed42mm particularly needs independent reader/print-resolution verification.
- The fictional receipt's signature fields are structural test data, not proof
  of a cryptographically verified provider response. Real accepted-receipt→print
  integration, genuine token decoding, authenticated route/UI and full release
  gates remain separate requirements.

Bounded result: source/unit and desktop/A4 rendering checks executed successfully;
phone readability concern and independent QR-decoding gate remain open. No full
print acceptance or Phase7-completion claim.

## Independent installed ZXing decoding follow-up — 2026-09-07

Root explicitly requested bounded inspection of the installed reader's own wrapper
and metadata. This follow-up supersedes the earlier *unavailable in executed QA*
decoder limitation; the previous unsuccessful discovery remains historical evidence.
No installation, external service, PostgreSQL use or production edit occurred.

### Existing reader identified and executed

Installed bundle:
C:/Users/astha/.codex/plugins/cache/openai-bundled/browser/26.901.51231/scripts/.
Its browser-service.mjs wrapper identifies zxing-wasm@3.1.2 and documents its own
call sequence: initialize reader, _malloc image bytes, populate HEAPU8, invoke
readBarcodesFromImage (or grayscale readBarcodesFromPixmap), retrieve result vector,
then _free. These named methods were observed in the installed wrapper, not guessed
from raw WASM exports. The default remote locateFile URL was NOT used.

Extracted the unchanged self-contained Emscripten reader factory from the bundle
in memory, bounded by its observed async-function declaration and following wrapper
function; did not import/start the unrelated browser service or modify installed
files. Factory30,796 bytes SHA256
30d7b47da6e6fc6b8d3ed3521349f6ec7163d9a0f25ab5e5fe9cd042d2d8db44.
Loaded the adjacent zxing_reader.wasm as local wasmBinary, SHA256
0e8d688d71932ebb6b8b33f700d43d3cb997f59ed9cab3c05102d7f10288a392.
Confirmed the instantiated reader exposes both named image/pixmap methods.
The in-memory Node harness disabled fetch with a throwing guard and counted zero
network attempts. Used wrapper-equivalent reader options, QRCode format and Plain
text mode; compared BOTH returned text and returned bytes with the input.

### Personally executed round trips

`node -e` memory-only decoder probe first completed exit0 in0.48s. The expanded
PNG/SVG checks completed exit0 in3.89s; final actual-Chrome density checks completed
exit0 in4.90s, closing every owned browser/context and freeing image buffers.

- Existing desktop.png, phone.png, phone-small.png and a4-page-1.png each decoded
  one valid QR to exactly the original51 ASCII/UTF8 bytes and text. SHA256:
  dd009a6cb89d7bb1433c2ef57b9df7ec798c142a07ddbb375bd49ee7b0d07e88.
  A4 page2 correctly contained no decoded QR.
- Generated an ephemeral local2048-bit RSA key pair, signed fictional compact JWTs
  using RSASSA-PKCS1-v1_5/SHA256 and independently verified each signature before
  encoding. Private keys and token bodies stayed in process. These are local
  cryptographic test tokens, NOT provider-accepted/binder-approved receipts.
- The847-byte signed token produced105 modules including quiet zone. Final-run
  SHA2563a9f7d66acb2c1ded7ff692a39cfd31da21e353a2a46c3d99e4b93ee0040bd27.
  Independent decoding matched exact text/bytes after SVG rasterization at159px,
  496px and4pixels/module, and after actual Chrome42mm SVG screenshots at
  deviceScaleFactor1 and2.
- The2952-byte near-capacity signed token produced185 modules. Final-run SHA256
  4b09a8cda23a2ca29e77a8aa80bee5362676d01b0e7b97cc0a956f1da58cf2f8.
  Exact decoding succeeded at496px (42mm at300dpi),4pixels/module and actual
  Chrome deviceScaleFactor2. It returned ZERO symbols at159px and in the actual
  current42mm Chrome screenshot at deviceScaleFactor1.
- The exact2953-byte structural compact boundary token, not cryptographically
  signed, also produced185 modules. SHA256
  1c09fa8e913eeb93685dbe6724c51dafa90f3ed2353111d4c33d8113ac6ce1c1.
  It had the same positive300dpi/4pixels-per-module/Chrome2x results and the same
  zero-symbol159px/Chrome1x failures. No token was truncated or rewritten.

The rasterizer is the existing bundled Sharp; actual browser screenshots use the
existing bundled Playwright and local Chrome. Generated SVG/PNG/token data for
the longer-token checks stayed in memory. Original A4/phone artifacts remain at
D:/Yellow/temp/q208-print-review-ODhlRY, including phone.png, phone-small.png,
a4-page-1.png, a4-page-2.png and invoice-a4.pdf; locations sent to root.

### Confirmed screen-density finding and bounded disposition

Current CSS fixes QR width/height at42mm, approximately159 CSS pixels. That
undersamples a185-module near-capacity symbol at deviceScaleFactor1. The independent
reader failures above are actual Chrome screenshot results, not an assumption
based only on nominal matrix size. At higher resolution the exact same token
decodes, so this is a rendered-size limitation, not demonstrated encoder corruption.
Root was notified: retain the original token and quiet zone, and provide sufficient
screen resolution/size or an explicit full-resolution print/view affordance rather
than claiming all supported-capacity on-screen symbols are scannable.

Independent exact-token decoding is now personally established for the tested
adequate-resolution cases. Near-capacity1x display and phone-table readability
remain open presentation findings. Physical-camera/paper tolerance, genuine
provider-receipt-to-UI integration and multi-page line-item rendering were not
proved by this bounded test; no full Q208 or Phase7 approval follows.

## Independent genesis and driver-error HTTP correction review — 2026-09-07

Reviewer: Codex fiscal_http_acceptance, non-implementer. Read both current read
services and the invoice HTTP/app additions, plus all three focused test files.
This is a non-PostgreSQL boundary proof; the SQL builder retained the DB lane.

Personally executed in the active worktree:

`bun test tests/india-native-fiscal-operator.test.ts tests/operator-invoices.integration.test.ts tests/india-native-fiscal-confirmed-issue.test.ts`

Result: exit0,30 passed,0 failed,243 assertions,531ms. The HTTP suite uses actual
signed sessions and the real tenant middleware/services with synthetic SQL,
NOT a PostgreSQL connection. All three unsupported read routes return422 and
prove ROLLBACK without COMMIT; permission denial is403, unknown database errors
are sanitized503, and receipt scope remains independent of document-read scope.

Also personally executed a memory-only `bun -e` adversarial probe:12 error shapes
through each of list/read/readDelivery,36 service calls,145 assertions,0 getter
or proxy traps,exit0. Covered own code/errno/sqlState42501 and P2082; inherited
SQLSTATE, accessor, live/revoked Proxy, numeric errno, unknown error and null all
fail closed. Every result/error remained frozen and no private message escaped.

The corrected previousHash validator accepts actual chain-genesis NULL while
still requiring a lower-hex hash for any non-NULL value. It retains exact detail
shape, issued-content hash and document identity/date checks. Own data-descriptor
SQLSTATE inspection fixes the observed Bun errno shape without executing accessors.
No new blocking finding in this bounded delta. Actual corrected SQL84 execution,
unsupported-jurisdiction predicate, same-tenant authority and full Q208 acceptance
remain separate pending gates; passing synthetic HTTP tests does not prove them.

SHA256 snapshots at this execution:

- india-native-fiscal-document-read.ts: d759f04513b5718292fb6eef7fdd9c49769944fd07e84a6ae7596374ed1f0d24
- india-native-fiscal-operator.ts: bdf427c3a3f7fb59fb391672285446da4272af018cfe41172fe04a61d8e316fd
- src/http/operator.ts: 9f4d6b8b85ecb54c1595e0638afe2f07ed05fde222367e831d58cd253ca061fd
- src/app.ts: ba30a67435f46e082f330be72a453a6361a7568f2438bce79914b977e8b7c42d
- india-native-fiscal-operator.test.ts: acea6cbfa5245f23a36f0dab3876d03118f1d9875d9601da45dff24a910e3e72
- operator-invoices.integration.test.ts: 2c9239644e7a889326bec61075a2448bbc1a5cac9331a694d4b07cb273a7e85c
- india-native-fiscal-confirmed-issue.test.ts: 16e2601f8188d1c3924e26fab2f4f32c2c244be54c9b6cee162ef23b517a22ba

No production/test edit, database command, package installation, external service,
stable preview action or source integration was performed in this check.

## Independent candidate84 rollback execution — 2026-09-07

Nonimplementer fiscal_http_acceptance read the complete frozen84 candidate and
Q208 amendments. Candidate SHA256:
e9d8b75f832e687f567806e82faaece7672cdbcf4ee8813c9c7b56cfc78ecd69.
Applied82 and83 stayed702f66b3e05547f397e2393ae5a608a6f0c3069ec534b2c947bfc309983bf185
and5a8ac565f3aaebfee4245121a434dba5867f558091a58aad87f23bed5dee0705.

Personally executed memory-only `bun -e` on the sole admitted synthetic
yellow_order440_q208_build_20260907 at127.0.0.1:55503. Protected deploy URL was read
in process from the admitted seed.env; only pathname was replaced. No secret was
printed. Verified exact83 ledger/source and0other sessions before BEGIN. Executed
the full candidate84 DDL inside BEGIN with10s statement_timeout; each branch used
its own savepoint and actual session authorization yellow_runtime plus app_role
and transaction-local tenant context. All candidate DDL, issuance and synthetic
hostile role/property changes were rolled back; no committed application occurred.

The final probe exited0 in4.07s. Earlier reviewer-harness failures are retained:
first used nonexistent catalogue aliases gstin/state_code (42703), then expected
42501 instead of the existing deliberate NULL denial from detail. Both invocations
unconditionally rolled back and closed their handles. Corrected only in-memory
probe queries/assertions, not source or permanent tests.

Personally observed and asserted:

- Actual discovery twice on the same genuine unconsumed fixture returned ready
  with byte-equal results, selectors and confirmation hashes. Buyer registration,
  party, GSTIN, legal/trade name, address, locality, PIN and state exactly matched
  the current authenticated registration row. Configuration content hash matched
  taxPreview.selectedContentHash and was lower-hex SHA256, not NULL.
- Discovery preserved exact tenant snapshots of document, document_series,
  india_gst_native_invoice_timing, india_gst_native_fiscal_document_origin,
  api_idempotency, outbox, journal and posting_line.
- Actual production issueNativeConfirmed issued a new document with replayed=false;
  actual production list and detail services read it successfully, count1, exact
  issued hash and genesis previousHash=NULL. The enclosing savepoint discarded it.
- Changing the selected series prefix to STALE/ after discovery rejected the old
  confirmation with IndiaNativeFiscalInvoiceStaleEvidenceError (mapped P2081).
  Changing selected buyer legal_name rejected with55000 through the existing
  statutory ancestry checks. The same eight-table financial snapshots were equal
  before/after each rejected attempt. Mutations were confined to rollback scope.
- NULL and102 fetch limits both rejected22023. Genuine authorized list/detail
  succeeded. An actor linked only to a foreign tenant's role was denied in all four
  corrected capabilities: list/provider42501; detail/by-document NULL. Existing
  discovery also rejected42501. Real Bun errno42501 mapped to permission_denied.
- Authorized unsupported AED property list raised P2082 and the actual TS list
  mapped unsupported_jurisdiction. Detail and by-document returned NULL; provider
  options returned0. Those latter branches do not emit P2082 in this candidate.
  This exact coverage limitation was sent to root; fakeSQL422 HTTP tests are not
  proof that every SQL capability produces an unsupported outcome.

After ROLLBACK the ledger, global role attributes/memberships, five public query
function bodies and retained census matched the preflight fingerprint exactly:
8de1426aeff3761ba2c42001ac309abb0bceb12d1b5719bc04c63c59f8628543.
Census remained18tenants/36users/18roles/108role-permissions/18user-role grants/
18nodes/8documents/8origins, frontier83,0other sessions. All captured source hashes
were rechecked. Separate final read-only template check exited0: exact
yellow_order434_production77, all77canonical migration checksums,127public tables,
0tenants and0other sessions. Template ledger hash:
f3f7e992e40ce6106f363a60a37ea559c26f20d18095cd37417f7477659aff0a.
All handles closed and the DB lane was explicitly released to the builder.

Completed v3 replay is NOT claimed here: no retained completed v3 fixture was
available, and fresh issuance/replay across real transactions cannot be established
by an uncommitted candidate whose first effect must be rolled back. The permanent
separate-transaction completed-replay gate remains required after coordinated
application. This is candidate rollback evidence, not independent full Q208 or
canonical migration/referee acceptance.

## Independent repaired QR density and actual clipping proof — 2026-09-07

Reviewed frozen print source1fca88ffa1d11a7c9f7fcc9793b154f0190801b04677f038ba385deda25cce31
and test6f11dc3d670e4d052aaf9213a10ad02b74a19a253fa0c01e0c9cbe13eb338886.
`bun test tests/operator-invoice-print.test.ts` personally passed10/0,311assertions,
230ms. Encoder/capacity/quiet zone are unchanged; screen size is3pixels/module,
print50mm. The installed ZXing reader/WASM and public reader invocation are the
same independently inspected local binaries recorded above. No package or network.

Personally executed memory-only Node/Sharp/Playwright Chrome probe, exit0 in6.76s,
0network attempts, closing every owned browser/context. Fresh fictional RSA2048
compact tokens were signed and verified locally before encoding. Both returned
decoder text and bytes had to equal the exact token. At intrinsic3pixels/module
and50mm/300dpi raster size591px, all847-byte signed,2952-byte near-capacity signed
and2953-byte structural boundary tokens decoded exactly. Final token hashes:

- 847bytes:12a841feab34048538258c88a9b94e6d7192f6a81e8917d98f98ee5bdf60ed6b
- 2952bytes:9fc9d1f37dbfd6bdb99cf958a9e051c194934b9b9db225add3854b110e66a4aa
- 2953bytes:1c09fa8e913eeb93685dbe6724c51dafa90f3ed2353111d4c33d8113ac6ce1c1

However, actual Chrome atDSF1 with the production stylesheet and provider-grid/
figure nesting reproduces a clipping defect. Desktop1100px still allocates46mm
(174px) to the QR column while SVG width is315px or555px. Independent decoding of
the visible figure yields ZERO symbols for all three tokens. At375px the figure
is334px:315px ordinary signed token decodes;555px tokens do not. At320px the figure
is279px and none decode. Page-level scrollWidth remains bounded, which does not
make a clipped QR usable. Horizontal scrolling cannot show the whole symbol at once.
Actual print-media SVG is188.97px (50mm), wider than its173.84px (46mm) grid column.
Generated A4 PDFs were successfully produced in memory; this follow-up did not
rasterize those PDFs or establish paper-camera decoding.

Root and print builder were notified. Encoder round-trip at adequate resolution is
proved, but responsive full-symbol presentation is still open. No production edit
was made, and no full print or phase acceptance is implied by these pure tests.

## Independent final QR presentation correction — 2026-09-07

Root's explicitly admitted presentation repair was reviewed at source SHA256
63bfdfcbcac67d7c1710b1e2ccf01166271d470753216e4562b7b392b57d153b;
print test SHA256cff71b4bacbfa50ed494273266ddaceaa9d757eb76375d23bb1740b105ac0b73.
Both were rechecked after execution. Personal `bun test tests/operator-invoice-print.test.ts`:
10passed/0failed/315assertions,264ms.

Personally executed the full actual print artifact using its original fictional
invoice/receipt fixture, local ephemeral RSA signatures and the installed independent
ZXing reader. Node/Playwright/Sharp/PDF.js/Poppler were already installed; no downloads
or network requests occurred. Initial harness stopped after screen checks because
pdftotext.exe is absent, then closed its browser. The successful memory-only harness
used the installed PDF.js public text API and pdftoppm to rasterize actual PDFs at300dpi.

All847-byte signed,2952-byte near-capacity signed and2953-byte structural maximum
tokens decoded exactly (both returned text and bytes) from actual DSF1 visible
figures at viewport1100/794/680/616px. Actual article/container widths were
702.984/702.984/664/600px. At viewport615/600/375/320px the narrower container hides
the SVG and visibly explains the full-size Print action instead. No figure/page
horizontal overflow remained. The threshold is container width, not viewport width.
An additional successful maximum-capacity sweep decoded the visible symbol at all
104integer viewport steps616..719, covering600px through the702.984px container cap.
Wider viewports retain the same capped geometry. All owned browser handles closed.

Actual A4 output for each case was2pages. Print media made SVG visible at188.969CSSpx
(50mm), hid the narrow-screen note, and retained legal number/date, both GSTINs,
exact large decimal amounts, acknowledgement number and SANDBOX label in PDF text.
Rasterized actual PDF page2 at300dpi decoded all three original tokens exactly.
The reviewer visually inspected both near-capacity PDF pages and375px screenshot:
no cropped QR or missing printed legal field found. The dense raw invoice table
remains compact on phone; this does not replace the separate actual-workbench
compact-summary journey acceptance.

Successful artifact directory: D:/Yellow/temp/q208-print-final-review-FhNHx1.
Each prefix rsa-signed, rsa-signed-near-capacity, exact-capacity-structural has
-1100.png, -375.png, -320.png, -A4.pdf and -A4-qr-page.png. Additional
rsa-signed-near-capacity-A4-page1.png is the inspected first page. Root received
exact locations. Failed-tool attempt retained at q208-print-final-review-sEpgHd;
width-sweep directory q208-print-final-review-B71C66 has no rendered artifacts.

Successful token hashes:

- 847bytes:c71f6ecd7b2eedfb2d9265b7d2d3723b3a78e95da142985ed621a40cbafd3d5f
- 2952bytes:1a08a4b36745ebc782114b53a32c9b5d7aaaa0dbd39f3c2ed1e4725aaa876309
- 2953bytes:1c09fa8e913eeb93685dbe6724c51dafa90f3ed2353111d4c33d8113ac6ce1c1

PDF hashes in the same order:

- 02ae3f428d629383ce133efd11b66abeff480cbc790dd673971cd38c5fda052f
- 3d86c00dd25645d5a4b751fd93a35dc02b15ad1725b170782df1dc427e471198
- f95ca19d4f4dae664d523db40bd0d5c7b353bf1c2df3efc322e608f932f4ca4e

The QR clipping/density finding is discharged for this exact source and tested
local rendering. Physical paper/camera tolerance and real provider acceptance are
not claimed. No PostgreSQL action or production/test edit was performed.
Separately, root reported authorization to the SQL builder for committed84 followed
by actual replay proof; that is not a reviewer claim that application/replay has
already completed. Proposed85 remains a separate forward change.

## Independent public staff boundary review — 2026-09-07

Nonimplementer fiscal_http_acceptance read the public Q208 contract, full operator
read service, HTTP body/permission/error mapping and app routes, public native v4
service/command changes and shared completion path. Personally executed:
`bun test tests/india-native-fiscal-operator.test.ts tests/operator-invoices.integration.test.ts tests/india-native-fiscal-confirmed-issue.test.ts`.
Result43passed/0failed/412assertions,1467ms. Signed HTTP middleware is real, but SQL
results/errors and completed receipts are synthetic. No PostgreSQL was used.

Document-read, dual issue/valuation readiness and receipt-read permissions remain
distinct. Staff input excludes internal selectors/money/tenant/actor; v4 receives
exactly15arguments in the middleware transaction. Exact10returned selectors feed
the existing native input/shared completion, with no extra connection reservation.
The public response excludes this graph; failures preserve rollback and sanitization.

Independent memory-only probe:20 malformed readiness mutations plus500/501 selection
bounds,45assertions passed,0getter/proxy traps. Covered identity/source rebound,
civil dates/year, unsafe config version, int64 overflow/negative/fraction money,
duplicate components, rate bounds, sparse arrays and private-root minimization.

BLOCKING driver compatibility finding: discover() uses strict dataArray() on the
outer Bun SQL result, requiring own-property count=length+1. Personally reproduced:
plain one-row selection_required result succeeds; identical content with metadata
count=1,command=SELECT,lastInsertRowid=null,affectedRows=null fails invalid_readiness.
That metadata shape was observed in the preceding actual PostgreSQL proof; this
specific reproduction was non-PG. Existing document-read code already snapshots
only numeric outer cells. Root notified: separate driver-row handling from strict
nested JSON array validation. Passing43mock tests does not discharge this finding.

Lower-risk observation: legalName with a lone UTF16 surrogate is accepted because
text() lacks isWellFormed(). PostgreSQL UTF8 normally cannot return that string;
this is not evidence of a database authorization bypass.

SHA256 snapshots:

- india-native-fiscal-operator.ts:5a864af4849d9f3d4fe32092657696fe443e307555ef3d31660d29c638ec3d5b
- india-native-fiscal-invoice.ts:52b71bfd95032d2f6501c379cd237e0ffeaf8009168d6591198d581c273a5351
- issue-india-native-fiscal-invoice.ts:f5af087977fd5086d4ba03bbb5ab70e801a8051da210eb05862debf2bfa7e31f
- src/http/operator.ts:4a3195fb0d34a21c2261a0e83f7d82f3023ff4c97bb8d8f5af31a7c713f395a5
- src/app.ts:5595239388557c0febe29d88eae6a8f0eace9fcdeaa351e1252810715344f008
- india-native-fiscal-operator.test.ts:b0e939bb55ea1ef19044068fd0302b3aa89e790be0244f438a5e84d4ea875c7e
- india-native-fiscal-confirmed-issue.test.ts:616d5904ac0ed06432b5a2dfd8748cf757642324ed38ae8f53159906237da9c4
- operator-invoices.integration.test.ts:1a27736c27ca50ff5fddd657c4fbc554ac1c9ffa702916cf4888a46ece4ca5be

Also read full proposed85 atc94c97efbb237fb99c5a35caf01faefa4d7fee98a07d8b30b89bec3ce0a7670c.
No additional static blocker found in durable selector reconstruction/v3 delegation.
No85application approval or real replay/concurrency proof is claimed; builder owns
the DB lane. Only this report was edited, not production/tests.

## Forward85 proof-only committed-application authorization — 2026-09-07

Root requested a distinct application decision, not product approval. Reviewer read
the full current85 and its exact Q208 authority: durable ten-selector reconstruction,
caller calendar/hash preservation, existing financial advisory lock, current authority
recheck and v3 delegation. No new store or financial engine; app-only execution.
The revised contract explicitly retains detail/by-document NULL semantics and adds
unsupported P2082 to discovery/provider options. Builder reported rollback DDL and
real branch probes, including a corrected initial multi-record INTO syntax error;
those remain builder evidence, not personal execution claims.

After builder confirmed no live handles, personally executed a memory-only read-only
`bun -e` preflight,exit0,717ms. Target exact
yellow_order440_q208_build_20260907 at127.0.0.1:55503 was frontier84; all84canonical
source checksums matched the ledger,85/v4 was absent,0other sessions. The target
contained39synthetic tenants/13documents after builder's subsequent84 proofs; none
were reset or altered. Both85 replacement predecessor hashes matched exactly:
223c3980622607354b9385af7544d7654955c1e378988dae99f7770cfcb28306 (discovery) and
319838391d06874b97475d5d40aa2aac48e3747de59abff4b48476729383bc6d (provider options).
Both were yellow_owner SECURITY DEFINER, fixed search_path/UTC, app EXECUTE true,
yellow_runtime/PUBLIC false. Global-role metadata/membership fingerprint:
1a404b9f0aa6c85deaf9ee4d9db2351be8327733b8d1b2f88f6b5221e2a9496e.
Template yellow_order434_production remained77 with all77canonical hashes,0tenants,
0other sessions and the unchanged f3f7e992... ledger hash recorded above.

Explicitly authorized builder to apply ONLY candidate85 SHA256
c94c97efbb237fb99c5a35caf01faefa4d7fee98a07d8b30b89bec3ce0a7670c through the
canonical runner to this existing synthetic target for executable proof. Candidate
hash was rechecked after the read-only inspection. Closed all handles and explicitly
released the DB lane. No personal DDL, DML, role change or application was performed.

This authorization does not approve product behavior, merge, local promotion or
any other target. Genuine separate-transaction v3/v4 completed replay, API-row expiry,
same-key concurrency, changed actor/route/recipient/calendar/key and rollback proof
remain mandatory before functional acceptance. Outer Bun readiness-array repair
also remains separate pending independent re-execution.

## Independent outer SQL row repair verification — 2026-09-07

Reviewed frozen operator service d1fa267f1a4608d65765c0e66fcc30a39756525ab3e01c9b98e0c5b92bbbd964
and test402b0d1f45b3957b59620dc1fc10ce4ddacb22035bf676d86e46aa4986511623.
The new singleResultRow consumes only the one own enumerable data cell and length,
without touching driver metadata. Nested dataArray remains strict; legal text now
requires isWellFormed(). No broader normalization or readiness policy changed.

Personally reran the exact previous memory-only metadata reproduction: both plain
and driver-metadata arrays now return the same successful selection result. Ran
the same three focused suites:45passed/0failed/421assertions,1001ms. The earlier
20negative/500501 readiness probe again passed45assertions with0traps; lone surrogate
is now rejected. An additional outer/nested probe passed12assertions with0traps:
metadata accessor ignored; consumed accessor/nonenumerable/hole, live/revoked Proxy,
multirow and nonarray rejected; nested metadata/symbol/accessor remain invalid.
Initial extra-probe instrumentation counted Promise assimilation's lookup of then
on a producer Proxy; narrowed the probe to descriptor/ownKeys traps before rerun.
No production/test edit or PostgreSQL work was used for these checks.

The reproduced outer-driver and malformed-text findings are discharged for this
exact boundary source. Genuine public readiness on applied85 and full separate-Tx
replay/concurrency acceptance remain pending reviewer execution. Builder reported
85application and an initial7pass/3fail actual run; that is not personal proof.
The DB lane remains coordinated with the builder and was not taken for this check.

## Independent current85 functional PostgreSQL proof — 2026-09-07

Reviewer: fiscal_http_acceptance, nonimplementer of production SQL and services.
Personally executed the following against ONLY the retained synthetic database
`yellow_order440_q208_build_20260907` on existing127.0.0.1:55503, after taking the
exclusive heavy DB lane. Protected Order442 deploy/runtime values were read only
in memory, their authority checked, and only their database pathname replaced.
The two Q208 URL variables and `YELLOW_REQUIRE_ORDER440_Q208_DATABASE=1` were
passed only to the child process; no secrets were printed or persisted.

```text
bun test tests/india-native-fiscal-operator.integration.test.ts --test-name-pattern 'reproduces D1314|v3 rejects missing|lists and reads|requires explicit buyer|serializes the public v4|returns every recipient|rejects nullable|v3 rejects changed stable|v3 rejects a changed authenticated'
```

Personal result: **9passed,0failed,1filtered,73assertions,27.46s**, exit0.
The filtered case is the explicitly separate fresh-install catalogue/no-assignment
test, not a passed gate. Its seven exact function signatures, yellow_owner ownership,
SECURITY DEFINER, fixed search_path/UTC and app-only EXECUTE checks were independently
queried and passed before and after this run. Retained synthetic assignments are not
a fresh-install oracle: observed65 before and77 after, rather than the earlier39.

Verified unchanged SHA256 before and after:

- migration85: c94c97efbb237fb99c5a35caf01faefa4d7fee98a07d8b30b89bec3ce0a7670c
- operator fixture: a4938c19876c8b6338d7464325005dcc12d7900e74cda00d927a4b9b0b6c50bd
- integration suite: 66266d4c4ebe5e3424aa5881ccf1766c182effb0770109a435779b5d3a2c50cb
- public operator read service: d1fa267f1a4608d65765c0e66fcc30a39756525ab3e01c9b98e0c5b92bbbd964

All85 ledger filenames/checksums were matched to actual canonical migration bytes
on both sides. Ledger fingerprint stayed
c032c5ae637c82562c3f4369621354d7f9059f9f90728f0d77db4deb97c5bbf8.
Global role attributes/membership fingerprint stayed
1a404b9f0aa6c85deaf9ee4d9db2351be8327733b8d1b2f88f6b5221e2a9496e;
database inventory metadata stayed
213cc30599af1a63aafab6b9c9b45167e7250b272984af5e8a080ac82310e626.
All pre-existing role permissions stayed
cb59da2c1418bc4b94cf968abbc6d7f8002a6a78238340d9d69d1b5c0ee0450e;
seven capability definitions/ACL/config fingerprint stayed
a886e2f635060bd16a18d11e406d728f23e2ed256b512f6fab86a99ba4b71836.
Target tenants65→77 and issued documents26→32 are the new synthetic fixture effects.
Target other sessions were0 before and after; every owned pool was closed.
Pristine yellow_order434_production remained77 canonical hashes,127public base
tables,0tenants,0other sessions; combined template ledger/state fingerprint stayed
3d57dde90878d408ffd84036a59fbd1747ffd56b245f5a868be671c32b1639e8.
No allocation, DDL, global-role mutation, existing-target reset, stable app change,
checkout or provider call was performed by this proof.

Non-vacuity inspection: public readiness runs the actual service against real Bun
SQL results and verifies minimization and exact buyer/configuration. The v4 helper
opens a separate tenant transaction per call; Promise.all exercises two live calls
and asserts the same document with fresh/replayed outcomes. It does not instrument
a pg_locks waiter/barrier, so no separate observed-wait claim is made. API expiry
deletes exactly the relevant document.issued key and asserts one RETURNING row;
replay after a real series-prefix mutation retains the original document. Changed
actor has actual current role assignments, and changed route has a real alternate
account/folio. The changed recipient case uses a random UUID: it proves durable
identity mismatch rejection, not rejection of a different existing registration.
Changed calendar requires the typed stale-evidence error, not an invented SQLSTATE.
Changed-input zero-effect assertions compare document/timing/journal/outbox counts;
they are not complete row fingerprints of every fiscal table. Separate v3 stale
config/buyer cases and D1314 v2/v3 positive/negative/replay controls also executed.
Actual500/501 selection, NULL-bound denial, foreign-role and revoked-grant denial,
and unsupported list/discovery/provider P2082 paths passed.

No-auto-grant evidence is kept distinct: exact applied82 source requires the new
permission to be absent, inserts only its permission catalogue entry, and its final
postcondition raises55000 if ANY role_permission assignment exists. Canonical82
bytes match the applied ledger;83–85 contain no role_permission assignment write.
This is checked source/applied-lineage evidence, not a personally rerun fresh82
pre/post grant census. The full unfiltered suite on a separately admitted fresh
target and exact-source CI remain required; retained fixture grants are not erased
or reclassified to manufacture a pass.

No new production blocker was reproduced in this bounded execution. This discharges
the prior pending personal current85 functional run only, not full Q208 integration,
fresh catalogue/schema/referee or UI-to-real-database acceptance. Parent and builder
were notified of terminal result and explicit DB-lane release.

## Independent strengthened v4 and clean current85 proof — 2026-09-07

Parent admitted exactly new-only fresh85 and upgrade85 targets in Q208 before this
execution. Reviewer fiscal_http_acceptance owned the serialized native DB lane and
made no production or acceptance-test edits. Protected URLs remained memory-only,
validated against existing127.0.0.1:55503 and their expected deploy/runtime users,
with only the exact target pathname changed and command-scoped child environments.

Inspected strengthened fixture
fefa326f01e79a848577c743b41cdd6961b7e7a6718140ac2facfbefd58028b6 and integration suite
1656efee820840e695a99334809eb239409790d4a5ca4e0dfcedffd224f22b43.
The second same-party registration has its own canonical legal-field evidence hash
and actual TOS/service-date active recipient-status rows. Genuine discovery must
return ready and bind that registration before original issuance; its later replay
is therefore not an invalid-random-UUID control. Changed actor/folio/buyer/calendar/
key rejections compare exact sorted full rows of fiscal_submission,
fiscal_submission_history, fact_log, outbox, document, document_series, journal and
posting_line. This discharges the preceding random-recipient/four-count limitations
for those cases. The snapshot is these eight named tables, not every database table;
the existing concurrent calls still have no separately instrumented waiter barrier.

Personally reran the preceding nine-case functional command on the retained build85
target: **9passed,0failed,1explicit catalogue filtered,75assertions,24.72s**. Sources,
all85 ledger hashes, seven capability definitions/ACL/config, global roles, database
metadata, pre-existing role permissions and pristine77 template matched pre/post;
all handles closed with0other sessions. Target79→91tenants,34→40documents and
79→91explicit read assignments were the new synthetic fixture effects.

### Empty1–85 safety stop, before creation

Read the actual canonical runner and migrations before allocating either target.
scripts/migrate.ts suspendExactRuntimeAppMembership calls global REVOKE app_role
FROM yellow_runtime for migration12, then restores it with GRANT; migration12 also
executes ALTER ROLE. Its guarded restoration is not permission to perform those
global operations in this shared cluster. Migration15 also rejects unexpected
pre-migration membership edges. Q208 explicitly requires preserving existing global
authority with no workaround. Therefore **yellow_order440_q208_fresh85_20260907 was
not created and canonical empty1–85 was not attempted**. This limitation was reported
immediately; no role/provisioning change or new cluster was substituted.

### New-only clean77→81→85 target

Verified both admitted names absent, exact deploy identity/CREATEDB authority,
global role fingerprint and pristine yellow_order434_production with all77canonical
source/ledger hashes,127tables,0tenants and0other sessions. Only then created
yellow_order440_q208_upgrade85_20260907 from that template with owner yellow_deploy.
No existing target was reused, reset or dropped.

Mechanically copied canonical1–81 bytes into unique owned temporary prefix:
`D:/Yellow/temp/q208-upgrade85-review-490b3411ab664af8af7a60630c927799/migrations-81`.
Verified every copy against canonical bytes. Called the actual exported runMigrations
with the protected target URL and that prefix: exact78–81 applied4, backend12948,
all four transaction PIDs12948. At81, tenants0 and new document-read permission0;
81-row ledger fingerprint1c86e7015698eeb5e400499320c7240fe44e90aae1c929b1490fa954ba625550.
Called canonical runner with its default directory: exact82–85 applied4,
backend15228/all four transaction PIDs15228. All85source/ledger hashes matched and
the complete prior81ledger remained byte-identical. At85 BEFORE fixtures:
tenants0, new permission1, assignments0, other sessions0. Canonical rerun returned
applied0/discovered85, backend18024. No-op and ledger preservation are actual results;
this empty81 predecessor does not establish preservation of populated historical
invoice/replay data or forward-upgrade failure rollback/drift.

Personally executed the actual catalogue test before seed or Q208 fixtures:

```text
bun test tests/india-native-fiscal-operator.integration.test.ts --test-name-pattern 'installs exact owner/app'
```

Result **1passed,0failed,9filtered,5assertions,396ms**. This discharges the preceding
pending no-auto-assignment census for the exact clean upgraded schema. It is not a
claim that the unsafe empty1–85 path executed.

### Actual schema, canonical seed and referee

Genuine native PostgreSQL16.15 pg_dump command used target-only PGPASSWORD in the
child environment, not a command-line URL:

```text
pg_dump.exe -h 127.0.0.1 -p 55503 -U yellow_deploy -d yellow_order440_q208_upgrade85_20260907 --schema-only --no-owner --no-comments
```

Applied the unchanged canonical normalizeSchemaDump(output,true), validating its
one restrict/unrestrict wrapper pair. Generated artifact:
`D:/Yellow/temp/q208-upgrade85-review-490b3411ab664af8af7a60630c927799/schema85.normalized.sql`
SHA256 **9c7c57c5c33b40866ef806488e6309c55f65d3a02ef7728264a447641c35cc18**,
1,732,510UTF8bytes. It differed from the then-stale expected.sql; sent the actual
artifact/hash to native_resume_builder, who owns snapshot generation. Reviewer did
not edit expected.sql or synthesize schema from migration text.

The adjacent source-inventory.json records85migration inputs plus runner,
normalizer, seed and referee:89inputs, compact inventory fingerprint
0f7d6d44037d05eecbcc8f130398e1e9a88283ab518a40afb10e8d42b11d7d1d.
Exact82–85 hashes respectively:

```text
702f66b3e05547f397e2393ae5a608a6f0c3069ec534b2c947bfc309983bf185
5a8ac565f3aaebfee4245121a434dba5867f558091a58aad87f23bed5dee0705
e9d8b75f832e687f567806e82faaece7672cdbcf4ee8813c9c7b56cfc78ecd69
c94c97efbb237fb99c5a35caf01faefa4d7fee98a07d8b30b89bec3ce0a7670c
```

Runner1c744395992ad99cb7eb44c5db811c4edddf2fb1169720aac96445d1042c6354;
normalizer5b3815c3709e23bf5b1dae47ce1f988e6f74f98818be5ae31826e8a63fdd3d36;
seed f8e8147800bc3ee24ba5020b70f95ad77a987c698d3c63dd664ed8d4cba1a409;
referee2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d.
All were rehashed unchanged after execution.

```text
psql.exe -h 127.0.0.1 -p 55503 -U yellow_deploy -d yellow_order440_q208_upgrade85_20260907 -X -v ON_ERROR_STOP=1 -f tests/seed_fixture.sql
python.exe tests/run_invariants.py yellow_order440_q208_upgrade85_20260907
```

Used the canonical seed unwrapped, with no observer/test wrapper and no single-
transaction switch. Seed exit0; log canonical-seed.log in the same artifact directory,
hash73eb9348ac2e8f44fe385dc69a4b62d4bd192e74813169c38ed3f311aec6670d.
Existing Python313/psycopg2 executed referee with YELLOW_DSN command-scoped only.
Actual **11passed,0failed of11**: exclusive race1winner; exclusive/beds disjoint;
6bedclaims; direct INSERT42501; concurrent commits; deferred unbalanced denial;
balanced commit; sealed-day denial;100gapless invoice numbers;118tenant-table RLS
policies;2security-invoker views with isolated tenants. canonical-referee.log retains
the exact output. Re-dumped schema after seed/referee was byte-identical to the
unseeded artifact. Target then2tenants,0document-read assignments,0other sessions.

### Full unfiltered current85 acceptance

After canonical clean seed/referee, personally ran without testcase filtering:

```text
bun test tests/india-native-fiscal-operator.integration.test.ts
```

**10passed,0failed,80assertions,28.86s**, exit0. Its catalogue case again executed at
0assignments before the suite created any Q208 synthetic roles. Afterward target
14tenants,106documents,12explicit Q208 read assignments,0other sessions. All85ledger
and frozen source hashes, seven capability fingerprint, global role fingerprint,
all pre-existing seed-role permissions, database inventory and pristine77 template
matched pre/post. New-target database inventory fingerprint is
22472f470dc2e4ac917097913e4a4946035826483a4d8044181a6c9afa09158f; the inventory
excluding this one admitted new target matches the earlier213cc305 fingerprint.
Template fingerprint remains3d57dde90878d408ffd84036a59fbd1747ffd56b245f5a868be671c32b1639e8;
global roles remain1a404b9f0aa6c85deaf9ee4d9db2351be8327733b8d1b2f88f6b5221e2a9496e.
All owned sessions/pools closed, and parent/builder received explicit DB-lane release.

No new production finding arose. Current85 source/schema/no-auto-grant, strengthened
functional suite and canonical11/11 are personally executed evidence. Empty1–85,
populated81-upgrade preservation, migration rollback/drift, complete current/historical
compatibility, exact-source CI and real UI/database journey remain separate gates;
none is waived or inferred from this run. Stable local preview and all existing
databases, roles, credentials and applied migration files were preserved.

## Independent configured-provider backend proof — 2026-09-07

Reviewed the Q208 configured-provider amendment and loader→validated presentation→
availability→operator SQL/HTTP composition. Loader derives provider key/environment
from the same immutable protocol text only after genuine adapter validation. Its
presentation exposes only UUID/version/key/environment; default-off yields both
empty arrays. Availability validates exact matching identity, environment, at most
16presentations, duplicate/shape/accessor/proxy denial, and detached frozen results.
Identity-only callers remain valid but do not gain guessed presentation data.
Server passes registry identities and the loader presentation together. HTTP uses
signed session tenant/actor, current request permission/property grant, no query,
same tenant transaction and no-store response. PostgreSQL remains authoritative for
effective provider rows; no broad SELECT, provider activation, secret or cache added.

Personally ran six focused files (loader, adapter-availability, native operator unit,
operator-invoices HTTP, operator-fiscal-submission integration and intentional-red).
Initial result52pass/8explicitDB+POSIXskip/1fail/623assertions exposed the old exact
one-argument availability-constructor expectation at intentional-red line22.
Reported it; root explicitly admitted/repaired that test, preserving pre-pool and
default-off assertions and binding the validated second argument. Reviewer made no
test/source edits. Rerun **53passed,8explicit skips,0failed,636assertions,2.59s**.
Repaired oracle SHA7ec966122efb8daa81dd0526b6273382ea8d9cb787695b972e8de98242d96bdc.
Independent memory-only hostile probe passed21assertions,0getter/proxy traps and
0SQLqueries for rejected ingress: malformed labels/UTF16, version/row shapes,
consumed accessors/nonenumerable cells, sparse/oversized/Proxy results, metadata
accessor avoidance,16boundary, detached configuration and sanitized driver errors.

Personally executed real production providers() against retained build85, inside
one rollback-owned deployment transaction switching session authorization to actual
yellow_runtime and SET LOCAL ROLE app_role with transaction-local tenant context.
Used existing synthetic authorized property/actor and one rollback-only fictional
fiscal-provider extension with canonical schema. Genuine provider positive returned
exact UUID/version/key/label/sandbox. Changed id,version orkey separately returned no
choice. Both configured AND empty presentation sets returned permission_denied for
ungranted actor and current role-permission revocation, and unsupported_jurisdiction
after target-local jurisdiction removal. This actually proves the PL/pgSQL guard
executes despite the outer ANY('{}'::uuid[]) filter; the mock's SQL-call counter alone
would not establish that. Restored positive control then rolled back everything.
Exact full16table/global-role snapshot remained
1cba33720f068840b28846a5f39ce9a8460f2fcc1b39e75523911eb490a79287; all pools closed,
other sessions0. No committed mutations, provider request or new target. DB lane was
released and parent notified. Actual probe was an inline bun-e harness retained in
reviewer session as q208ConfiguredProviderActual; hostile probe q208ProviderHostileProbe.

Frozen source SHA256, all unchanged before/after actual proof:

```text
india-irp-provider-configuration.ts ff96acd53b1bbd9b063193094c56dfef0a045d1171afb0b851360f6b0919f92b
fiscal-submission-adapter-availability.ts 5cc3e800717c7baf27883a92816eb035ef3a369bb666f47b9ff83b6f4dea0724
india-native-fiscal-operator.ts a0fb299a10399e2590523678a7a1992df7b1ee4cd2b2bd6ee80bc2aeffc92e48
src/server.ts 72d1f8475e18bf1f006f0838952ef11432b7c9a0c04239bf81946227c607056c
src/app.ts 3144b09e1e4061c6f37864f623d1bac64370c6eb25894db4deb59ff5711d3b36
src/http/operator.ts b56c1cc131e73892c49bc318477c4b391afaef5f16351c3e3caeab71cf676fc4
```

No remaining blocker in this bounded backend projection after the oracle repair.
Actual HTTP-to-provider delivery, UI request/retry composition, current release
readiness and exact-source CI remain their own gates; none is implied by this read.

## Independent current85 release-canary blocker — 2026-09-07

Reviewed frozen build-info2f3b9af75da885ba61f781c4a2e02c323b216865af80b73c5b5b2ec8ad041f00,
its pure/integration tests and CI wiring. Personally ran build-readiness.test.ts,
fiscal-replay-workflow.test.ts, release-workflow.test.ts and free-host-arm64.test.ts:
21passed,0failed,291assertions,1288ms. The code checks seven exact app-only public
capabilities, two owner-private helpers and two index structures, then uses a real
read-only app_role transaction to check the global permission code exists. It does
not require zero assignments or compare the permission description; the latter is
a catalogue acceptance check, not an asserted runtime requirement here. Historical
80/81 CI prefixes remain separate from the required empty current85 Q208 target.
No actual Linux/ARM64 CI result is inferred from static wiring tests.

Personally attempted healthy baseline with an actual direct yellow_runtime SQL pool
against admitted upgrade85 before any hostile change. First re-dumped native schema:
9c7c57c5c33b40866ef806488e6309c55f65d3a02ef7728264a447641c35cc18, byte-equal to both
the prior actual artifact and mechanically updated expected.sql. Actual
assertRuntimeReleaseReadiness rejected at its first catalogue gate. A second
read-only execution of the exact production query showed q208IndexesExact=false
and every other14boolean=true. No permission-read second phase or hostile mutation
was reached; all pools closed.

Concrete cause: pg_get_indexdef(index_oid,column_ordinal,true) returns bare column
names, not ordering suffixes. Actual document cursor columns are
[tenant_id,property_node,business_date,issued_at,id], while the canary expects
business_date DESC/issued_at DESC/id DESC. The full native index definition IS the
correct canonical descending index and actual indoption is `0 0 3 3 3`;
submission index columns are [tenant_id,property_node,document_id,id] with indoption
`0 0 0 0`. Both are yellow_owner-owned, valid/ready/live with correct partial
predicate and key counts. This is a canary false-negative, not a schema defect.
Reported root and runtime builder; suggested bare-column comparison plus exact
sort/null-order bits or exact full definition, not removal of order validation.

Current runtime approval is withheld until an independently rerun repaired baseline
and target-local hostile ACL/config/index controls pass with rollback/schema
preservation. No production/test edit was made. The planned hostile probe forbids
the permission-read second phase on its transaction-owned connection, preventing
an accidental nested begin/commit from committing candidate DDL. Healthy baseline
uses the genuine SQL pool and genuine read-only transaction. DB lane released while
the builder repairs the source; no new target, global role or preview change.

## Independent repaired current85 canary acceptance — 2026-09-07

Inspected the three-file correction: bare key-column names plus exact indoption
`0 0 3 3 3` for the document cursor and `0 0 0 0` for the submission index. This
retains descending and NULL placement verification rather than deleting it. The
DB-gated permanent test adds both wrong ASC and DESC NULLS LAST controls. Frozen:

```text
src/kernel/build-info.ts 9153edbbd173a547e65acd67a2d43cd859c7e0f93b1ddc90a77fd67e5d29666b
tests/build-readiness.test.ts 2f0fb31168c3df37bdb4e615f7b3b5b44c40d68e8eed0a0ba5d798ed6ab1e6f8
tests/build-readiness.integration.test.ts 5cd8bda82aed65fc0890d1c670265f554c3f1081c8ec717e92460db8b26469d3
```

Personally reran:

```text
bun test tests/build-readiness.test.ts tests/fiscal-replay-workflow.test.ts tests/release-workflow.test.ts tests/free-host-arm64.test.ts
```

Result **21passed,0failed,296assertions,638ms**. Did not execute the known unsafe
Windows fresh-database readiness suite or its global-role migration path.

Personally executed actual assertRuntimeReleaseReadiness with a direct protected
yellow_runtime SQL pool on existing admitted yellow_order440_q208_upgrade85_20260907.
Healthy baseline succeeded, including the production read-only app_role permission
transaction. After return, current_user/session_user were yellow_runtime and role
was none; transaction_read_only returned to the ordinary outside-transaction off.

Then executed twelve independent target-local transactions as yellow_owner, changing
only owned function/index catalogue state. Switched session authorization to actual
yellow_runtime for the exact production catalogue query. Every case rejected with
the exact sanitized runtime-readiness error:

- v4 EXECUTE to yellow_runtime and PUBLIC, or removal from app_role;
- owner-private helper EXECUTE to app_role and PUBLIC;
- provider TimeZone drift, v4 search_path drift and private volatility drift;
- missing document cursor, wrong tenant-leading submission-key order;
- document business_date ASC and business_date DESC NULLS LAST.

All cases reached genuine PostgreSQL on the same reserved transaction, not mocked
catalogue booleans. A guard forbade the permission-read begin phase on these hostile
connections to prevent nested begin/commit from committing DDL; it was invoked0times,
so every rejection occurred at the intended first catalogue gate. Each case was
unconditionally rolled back and session authorization reset. The healthy control
before and after used the genuine SQL pool/read-only transaction without this guard.
This distinction is explicit; no transaction wrapper result substitutes for the
healthy runtime probe.

Actual probe command was inline `bun -e` using reviewer memory harness
q208Canary85RepairedActual; exit0,6.94s. Global-role attributes/memberships, exact85
ledger/checksums and all permission/role_permission rows matched after every rollback:
combined fingerprint af24d8b0e9ec60ecf2df6320698e93b3656ea085c2811aeae1cf1d72268118cd.
Native16.15 normalized schema before and after remained byte-equal to expected.sql
and prior proof artifact, SHA9c7c57c5c33b40866ef806488e6309c55f65d3a02ef7728264a447641c35cc18.
All ten runtime-lane source hashes were verified before/after; the other seven:

```text
tests/runtime-database-authority.integration.test.ts 31d83ff082c66c008e93912de2e2af538a9d3f00d0ec52e47c6652a519034409
scripts/local-review.sh 5a08601237341df7b64ce2af283ab593c685c3f235aff16f52dbe191e5d4d2fa
tests/release-workflow.test.ts 66c14f62da0b3aff259bfb646c97a76936defb6ad6b68320979a857df24dec63
tests/free-host-arm64.test.ts 313b0bf7fcfb8d682b9b64e27cb4c3bb5954f05b9733e82cf6ffe5a25ace39eb
tests/fiscal-replay-workflow.test.ts 8bb7764351c8cdc2cce770b19055ff00efe95c1ed21b311aa5f5f1665a82109d
.github/workflows/ci.yml 011f82701736f79023ab566a9fa64c88e7fc30688ea326be5894431933caa544
.github/workflows/release.yml 2b279e24626aced98c31bff0ad34e0affdd5f3d53f635e0a59761d4c2d020d79
```

Restored actual direct-runtime readiness succeeded, all owned connections closed,
and target other sessions0. Parent/runtime builder received explicit DB-lane release.
No new target, source/assertion edit, global role mutation, provider call, local
promotion, commit or merge occurred. The reproduced canary false-negative is
discharged for this frozen source. These completed-function readiness results may
support a separately verified review-app update; they neither require all Phase7
work to be finished nor themselves establish complete Phase7 or exact-source CI.

## Q209 populated predecessor proof construction — 2026-09-07

Under the accepted Q209 two-path ownership, fiscal_http_acceptance authored only
tests/india-native-fiscal-populated-upgrade.integration.test.ts and this evidence.
This is proof implementation, not independent approval of that new test; root must
inspect and personally execute it. No production SQL or source was changed.

The test requires an explicitly isolated, empty canonical81 target. It uses genuine
native issuance and authenticated HTTP fiscal request/retry, runtime claim/reconcile,
and the existing fresh-RSA signing/actual issued-source binding-verifier fixture.
It prepares accepted attempt4 with all three retry keys, rejected, pending and
in-flight submissions, two genuinely linked same-series native invoices, and an
unissued statutory/valuation graph before applying unchanged82–85. Full retained
tenant-row snapshots, original response bytes, prior ledger and role assignments
are compared. New85 reads and confirmation use separately recorded synthetic
read grants, with unauthorized and foreign-tenant controls. No provider network
execution is claimed by this direct-capability/real-crypto construction.

Personally ran `bun run typecheck` (exit0), and the final
`bun test tests/india-native-fiscal-populated-upgrade.integration.test.ts`:
1passed/1explicit database skip/0failed,5assertions,373ms. The executed test is only
the connection-free target guard. Current test SHA256:
78cabed514a5b8797ce84adc80c29c5a2b066f34b219e4fd4197464b1959dc05.
Earlier construction caught a test-only unknown-receipt TypeScript mismatch;
source inspection corrected the old HTTP replay201 oracle and document prev_hash
column before any database execution. None is an observed production failure.

Proposed exactly one native target to root:
yellow_order440_q209_populated_review_20260907, existing127.0.0.1:55503, from the
reverified pristine yellow_order434_production77 template. Target absence,
template77 hashes/zero tenants/zero other sessions, global roles/memberships and
database inventory must be recorded before allocation. Canonical byte-copy78–81
preparation precedes this test; no historical1–12/global-role path is permitted.
No database was allocated, queried or mutated in this construction turn. Actual
populated preservation remains pending explicit native admission and execution;
PR92 published3a0a013/CI34087312357 does not cover this later uncommitted test.

### Q209 first genuine populated run and retained test-oracle failure

Read root's exact native admission before mutation. Created only the absent
yellow_order440_q209_populated_review_20260907 from verified pristine77. All89
canonical inputs matched inventory0f7d6d44037d05eecbcc8f130398e1e9a88283ab518a40afb10e8d42b11d7d1d.
Template77 had127tables,0tenants/0other sessions; captured template rows/state hash
772c6f02352f6a295fa301271bd876cb0e2f13fe8b442eecd3edaeb0f863d720.
Complete outside43database,19role and4membership inventories were compared in
memory before/after; combined hash
0b3b3f8dacff9ff4cf53853045adedc11ce72a9fa8124cbaf308adb97bd3ea94.

PowerShell mechanically copied canonical1–81, without content changes, into
D:/Yellow/temp/q209-populated-review-65095b713571494088f44024d558f596/migrations-81.
In-process Bun read only the protected Order442 seed.env deploy key and app.env
runtime key, checked127.0.0.1:55503/exact split users, and replaced pathname only.
No secret values were printed. Canonical runner applied only78–81 (backend4108,
all four transaction PIDs4108), then a child process ran the full new test with
Q209 deploy/runtime environment variables and requiredflag1. No helper was saved
to disk; the exact memory-only orchestration is retained as q209CreateAndRun in
this agent's tool store. No reset, role mutation or existing-target cleanup occurred.

Actual first run:1passed/1failed,116assertions,15.41s, exit1. Before failure, the
populated81→85 migration, complete tenant-row and assignment preservation, original
request/three retry bodies, signed receipts and both real native chain replays
passed. The failure was my test line260 expecting permission_denied for ungranted
detail; actual result was {ok:true,value:null}. Exact82 lines147–151, document-read
service lines306–307 and existing authority integration lines472–482 explicitly
retain NULL for detail/by-document denial while list denies42501. This is a test
oracle defect, not a production authorization regression or a full passing run.

Corrected both detail-denial expectations and added the pregrant list-denial
assertion. Current test hash6104d175a9db09d30be0190236abb1b355f782a15d7319f3d45237db8e964d91;
typecheck exit0, connection-free run1passed/1explicit DBskip/0failed,5assertions321ms.
The original target is preserved at85 with6tenants/6documents/0other sessions.
Outside inventories, pristine template and all89canonical source inputs matched;
all owned pools closed. A separately admitted new target is necessary for a full
rerun; no conversion of the retained85 target back to81 is authorized or attempted.

## Root independent populated predecessor execution — 2026-09-07

Reviewer `/root` did not implement the populated proof or fiscal services. Root
read the complete corrected test, canonical NULL detail-denial service mapping
and existing revoked-authority integration proof, then personally executed frozen
`6104d175a9db09d30be0190236abb1b355f782a15d7319f3d45237db8e964d91`.
Question209 admits only new absent
`yellow_order440_q209_populated_repaired_review_20260907` on127.0.0.1:55503.
Protected values were read in-process; none appeared in arguments or output.

Preflight: canonical89 inventory
`0f7d6d44037d05eecbcc8f130398e1e9a88283ab518a40afb10e8d42b11d7d1d`,
pristine77/127tables/zero tenants/zero other sessions template
`772c6f02352f6a295fa301271bd876cb0e2f13fe8b442eecd3edaeb0f863d720`,
19 global roles/4 memberships/44 outside databases inventory
`ef924958a9feff88bae13aacfb18afc19f85c7afb5dec973950f0f84d562a097`.
Root cloned the exact template once; canonical78–81 applied on backend15272,
all four transaction PIDs15272. Child Bun ran the entire test with the two explicit
Q209 split-authority URL environment keys and requiredflag1.

Actual result: **2passed,0failed,143 assertions,21.78s**, child and wrapper exit0.
Final target85/6tenants/7documents/zero other sessions. All three inventories
above rechecked unchanged, as did all canonical inputs and frozen test bytes;
the outer unconditional finally closed the admin handle. No template/global-role/
outside-database/app mutation or cleanup. The first failed author's target remains.

This accepts populated81→85 document/receipt/replay preservation and current85
composition, not an external provider transport, seed acceptance or runtime update.
CI wiring added after this proof requires execution on its own published head.

## Independent Q209 review-seed execution — blocking findings, 2026-09-07

Nonimplementer fiscal_http_acceptance read the new seed scope and PostgreSQL/entity
patterns, the four frozen seed files and their reused baseline setup. No seed
implementation was edited. Frozen SHA256:

- scripts/seed-review.ts: b767ed9783f2e0de39255af16c7ffc614505d2403789842bd964c809c543c294
- scripts/seed-fiscal-review.ts: 92b1a255e1216073059ccce22fe017401470c1d24b9b519662911ac5ebd06027
- tests/review-seed.integration.test.ts: bce9a74dc24af84c6ee3e1d485c2dda9afc638fa2c9ec6fbde48dcf1976b9ece
- tests/fiscal-review-seed.integration.test.ts: 4df344eec977f1158b751d51cc6d4b69f167e9526b9060e534f7a018d1e5b54b

The connection-free two-file run passed5 with29explicit database skips,0failures,
24assertions431ms. Neither test drops/truncates/resets a database. Existing baseline
setup does delete two exact synthetic checker/operator grants and one synthetic
initialization-room condition; its hostile rate test restores the exact extension
content in finally. Those effects were explicitly admitted only on the new target.

After reading root's exact target admission, verified absent
yellow_order444_q209_seed_review_20260907 at127.0.0.1:55503 and cloned pristine
yellow_order434_production77 once. Template127tables/0tenants/0other sessions and
hash772c6f02352f6a295fa301271bd876cb0e2f13fe8b442eecd3edaeb0f863d720 matched.
All89canonical inputs matched inventory0f7d6d44037d05eecbcc8f130398e1e9a88283ab518a40afb10e8d42b11d7d1d.
Complete outside45database/19role/4membership inventories were captured and compared;
combined fingerprint3684deb97356e095f02ab1bae09e7d1d6860b76fda56ac664488633d790f2e87.
Canonical78–85 applied on backend14636, all eight transaction PIDs14636. No1–12,
cluster role, template, retained-runtime or prior-database mutation was performed.

The memory-only q209SeedCreateAndRun orchestration used the protected Order442
deploy/runtime env keys, verified split users/loopback endpoint and replaced only
the new pathname. A fresh fictional password was generated only in-process; no
founder password was read/replaced or printed. The first child command was:
`bun test tests/review-seed.integration.test.ts`, with command-scoped deploy/runtime
URLs, YELLOW_REVIEW_SEED_PASSWORD and YELLOW_REQUIRE_REVIEW_SEED=1.

Actual result **25passed/2failed,110assertions,6.39s**. Concrete findings:

1. **Blocking grant leak:** the real checker login contains all five new operator
   fiscal scopes. scripts/seed-review.ts:766–773 iterates the expanded shared
   REVIEW_PERMISSIONS for the checker and excludes only three existing financial
   permissions. This violates Q209's operator-only fiscal grant contract. The
   existing exact checker-token assertion at test1424 caught it. Do not repair the
   test by broadening expected checker scopes.
2. The new grant query passes a JavaScript array directly to ANY(...::text[]),
   producing PostgreSQL22P02 malformed array literal. The same raw-array pattern
   exists in new fiscal seed/static-check and fiscal-test paths. Reported to the
   implementer for scoped repair, not changed by this reviewer.

The dependent fiscal-review-seed suite was NOT started after baseline failure.
Target retained at85/1tenant/0documents/0other sessions; outside inventories,
template, all89inputs and four seed hashes were unchanged. All handles closed and
root notified the native lane was free. No reset or cleanup was attempted.

Separate unexecuted coverage concerns were sent to the implementer: fiscalDates
recomputes property dates despite constant original command keys/statutory IDs, so
next-day rerun needs explicit proof; the current fiscal snapshot omits series,
facts/outbox and may omit non-folio contra lines. The fiscal test currently lacks
real signed-session invoice list/detail/readiness and denied/foreign controls.
These are not claimed as executed failures or discharged acceptance.

Read-only CI check: workflowe094d89b05b6962f0ca92f22e4eb9b53adb086de3942e12ac0e4ac57cb7bbf15
places required isolated Q20980clone→81prefix→populated85 test before Q208, with
existing cleanup trap and no inherited prefix in the child. Current Compose146
publishes127.0.0.1 and CI331 resolves `docker compose port postgres 5432`, not a172.x
container address. Keep the test's loopback guard; this is source verification,
not an actual new Linux CI result. No Docker/WSL command was run locally.

### Independent repaired seed execution — baseline green, fiscal composition red

Reviewer: fiscal_http_acceptance, nonimplementer of both seed scripts/tests.
Root explicitly admitted new-only `yellow_order444_q209_seed_repaired_review_20260907`
after the original ephemeral proof password was lost when its process ended.
The prior failed target was preserved, not reset or given a replacement password.
The admitted unique `D:\Yellow\temp\q209-seed-proof-ce3bf7c91fde4b3daf7f067a6eadcaf0`
directory has inheritance disabled and only the current user ASTHA\astha FullControl;
its small proof.env retains generated synthetic credentials for this exact target.
No credential values are recorded here or in the command output.

Frozen source SHA256: seed-review `31b4851fc296e49185ef7a8ee705236d82b4b3dbf861df53a89f4e7e3914144b`;
seed-fiscal-review `249bd94f720f367ea35fb3e4a5b720107074bf810ce24b918638f206b8682d35`;
review-seed test `e7840d288d746c7efb38450a8265805de2ddac2d4e6d0c5f178557d1a068682e`;
fiscal-review-seed test `0a715f4f2860dc8231d5f54d7d50eebc602e48d10467a795602f85e9631fc8b4`.

Personally executed inline Bun orchestration: read protected Order442 deploy/runtime
URLs in-process, verify exact loopback55503 and split users, replace pathname only;
verify target absent and pristine77/all canonical checksums; clone once; call the
unchanged production runMigrations to85; run `bun test tests/review-seed.integration.test.ts`
then `bun test tests/fiscal-review-seed.integration.test.ts` as separate serial child
processes. Each child receives command-scoped deploy/runtime and retained synthetic
passwords, with respectively YELLOW_REQUIRE_REVIEW_SEED=1 and
YELLOW_REQUIRE_FISCAL_REVIEW_SEED=1. No test-name filter or skip substitution.

Canonical78–85 applied8 on backend17924, all eight transaction PIDs17924.
Baseline: **27 pass, 0 fail, 117 assertions, 5.37s**. This includes the original
checker least-scope token assertion and exact five operator/no-checker fiscal grants.
Fiscal: **0 pass, 1 fail, 680ms**, beforeAll failed before any fiscal assertion:
PartyProfileValidationError `audit operation must be party.created`, parties.ts207,
seed-fiscal-review.ts694. Seed supplied `profiles.party.create` at693; the real
production service requires `party.created`. Sent defect to the implementation owner;
no reviewed production source was edited. No fiscal issuance, signed-session fiscal
HTTP or cross-day acceptance is claimed from this failed run.

Final target85/one tenant/zero documents/zero other sessions. Before/after outside
inventory covers46 databases,19 roles,4 memberships, fingerprint
`0a54f588b823aec6eaba2e68425fa5c0ff59098d180503c141b0381abb40eb7a` unchanged.
Pristine template77/127 tables/zero tenants/zero other sessions fingerprint
`772c6f02352f6a295fa301271bd876cb0e2f13fe8b442eecd3edaeb0f863d720` unchanged.
All89 canonical inputs fingerprint
`0f7d6d44037d05eecbcc8f130398e1e9a88283ab518a40afb10e8d42b11d7d1d`
and all four frozen seed source hashes rechecked unchanged. Handles closed in finally.
No old runtime, global role, template, applied SQL or other database changes.

### Retained-target operation repair — next exact production boundary failure

Reviewed seed-fiscal SHA `03e2f00078fbb350e3ff00b70d3921f2e3ed7d15d072b276e00053b1e9f21ede`
and fiscal-test SHA `585440168203c3f0916334bf52e69ca2a490c7b43a0e6e4eb9ea0ec52ea857e2`;
baseline script/test hashes remain31b4851f/e7840d28 above. Party operation now matches
`party.created`. Independently compared all other eleven service operation literals
against production guards; no second operation mismatch found. The test now creates
an active real foreign tenant/property/actor/current document-read role and positively
checks its signed-session property list before denying access to the first tenant.
Prior-day initial service selection plus exact retained service snapshots are added;
these are source observations, not yet successful executed acceptance.

Reviewer orchestration mistakenly repeated the entire baseline on this already
populated/partially fiscal-seeded target. Result **25 pass, 2 fail, 78 assertions,
11.01s**: P1 expects fresh-created6 rooms/2 types and rate.created=true, while the
retained target correctly returned existing counts; P5 expects exactly two old
properties while the earlier partial fiscal setup added its legitimate third.
This is a fresh-fixture prerequisite mismatch; no test assertions were weakened,
no data reset, and the original fresh27/0 remains the baseline acceptance receipt.

Then personally ran the full fiscal test alone with the same retained synthetic
identity and all preflight/finally checks. Actual **0 pass, 1 fail, 1.42s** in beforeAll:
`TaxAttributionSnapshotError: snapshot component tax shape conflicts with its rounding mode`.
Production attribution.ts401 requires null component taxMinor for document rounding;
the seed supplied500 while declaring document rounding. Aggregate tax remains500;
the reviewer did not change this input or any production assertion. Sent exact defect
to the implementation owner. No fiscal issuance or signed-session assertions ran.

Both attempts preserved target85/one tenant/zero documents/zero other sessions,
outside46DB/19roles/4memberships fingerprint0a54f588…eb7a, pristine template772c6f…d720,
all89 canonical inputs and their respective frozen seed hashes. All handles closed.
The original failed proof database and retained application were untouched. No
additional target, auth rotation, global privilege change or cleanup was performed.

### Rounding/status repair — genuine progress, five-second setup deadline

Reviewed source `a4c5903395b659f9df6ca85f8b2391dca62a8a3559129a810e8e7b57a7cbc5ae`
and test `b96d998f8081a5e648bea4e2962d68c0436ac435299a573bdf81a8910c3d8576`.
Component taxMinor is now null under document rounding, aggregate tax remains500;
deterministic active supplier registration snapshots cover distinct service/TOS
and issue dates without rewriting existing rows. Personally executed fiscal suite
ONLY on the same retained repaired target/private identity, unchanged canonical85.
Actual **0 pass, 1 fail, 6.16s**: unnamed beforeAll hook exceeded the default5s
at5003.95ms; no assertion-specific error preceded it. No blind rerun/deadline edit.

Read-only post-failure census established forward progress:2 service snapshots,
2 payment snapshots,2 final valuations,0 native document origins; API operations
party1/reservation2/folio2/charge2/attribution2. Supplier active status dates are
2026-09-06 and2026-09-07. The initial diagnostic incorrectly referenced a plaintext
api_idempotency key column and returned42703; after reading canonical4, the corrected
operation-count SELECT succeeded. Neither diagnostic mutated data.

All frozen sources,89 canonical inputs, outside46DB/19roles/4memberships fingerprint
0a54f588…eb7a and pristine template772c6f…d720 were preserved. Target85/one tenant/
zero documents/zero other sessions; all handles closed. The implementation owner
and root received the completed-stage census and default-hook boundary. No issuance,
immutable fiscal rerun or signed-session fiscal acceptance is claimed yet.

### Bounded setup completes — actual invoice and replay, two test-oracle defects

Root admitted beforeAll60s only. Verified fiscal test SHA
`f424d025bdd447b493d9b6f1d4c2638f628563f0fbddcb324c81a05128e31bfe`
and unchanged fiscal sourceA4c59033…c5ae; ran full fiscal test ONLY with same target
and retained identity. Reviewer child watchdog90s bounds the overall process; it
did not fire. Actual **6 pass, 2 fail, 73 assertions, 6.31s**.

Genuine invoice issuance and complete before/after fiscal/accounting snapshot
equality now passed. Prior-day service evidence and exact active service/issue
status-date assertions passed. Real operator login/list/detail/readiness, no-auth401
and checker403 also reached and passed. Remaining failures were exact test oracles:
the snapshot expected6 postings but returned8; the real foreign identity's positive
`/me/properties` control returned403 because that route requires availability scope,
not the fiscal document-read scope actually granted to the foreign role/token.

Personally queried all eight actual fiscal-property posting rows: two room journals
each guest+10000/revenue−10000; one tax journal contains CGST guest+250/payable−250
and SGST guest+250/payable−250. All three journals balance; the extra rows are required
contra postings, not duplicate charges. An initial read-only diagnostic referenced
nonexistent journal.source_id and returned42703; the corrected catalogue-grounded
SELECT succeeded. No diagnostic changed data. Recommended exact8 plus explicit
balanced posting assertions, and a positive own-property fiscal search using the
same granted fiscal capability before cross-tenant denial, without broadening roles.

Target85/two tenants/one document/zero other sessions. Outside46 databases,19 roles,
4 memberships fingerprint0a54f588…eb7a, template772c6f…d720, all89 canonical inputs
and frozen source hashes remain unchanged. Pools and child closed normally. Both
test findings sent to their implementer; reviewer did not edit source or assertions.

### Foreign fiscal positive control reaches jurisdiction guard

Test-only correction SHA `4499f3a9816a440c380904613dfd18847f978ffa6f951fc5f86d2d14044089ac`
retains all production/source bytes and now expects canonical8 postings and uses
own-property fiscal search under the exact documents:read capability. Personally
ran the complete fiscal suite on the same retained target: **7 pass, 1 fail,
77 assertions, 6.53s**. All source/prior-day/status-date/immutable snapshot/role
checks passed. The foreign positive fiscal search returned422, not expected200.
Canonical84 lines72–77 explicitly require an in-gst-lodging tax_assignment even
for an empty list; the foreign test property has none. Reported this incomplete
positive fixture to its owner; no production guard or grant was relaxed. The final
cross-tenant assertion was not reached. Target85/two tenants/one document/zero other
sessions; source89/template/outside fingerprints above all preserved, handles closed.

### Independent final Q209 synthetic fiscal seed acceptance

Final source SHA256:

- scripts/seed-review.ts: `31b4851fc296e49185ef7a8ee705236d82b4b3dbf861df53a89f4e7e3914144b`
- scripts/seed-fiscal-review.ts: `a4c5903395b659f9df6ca85f8b2391dca62a8a3559129a810e8e7b57a7cbc5ae`
- tests/review-seed.integration.test.ts: `e7840d288d746c7efb38450a8265805de2ddac2d4e6d0c5f178557d1a068682e`
- tests/fiscal-review-seed.integration.test.ts: `d5b0268722f54a7ef5930d0b3640ae7c0109069759aea808cb772e763ab3ba32`

Reviewed the exact final test-only foreign in-gst-lodging assignment and its current
catalogue assertion. It adds no permission or production bypass. Personally ran
`bun test tests/fiscal-review-seed.integration.test.ts` with the same retained-target
protected split URLs and synthetic passwords, required fiscal flag1,60s beforeAll
and reviewer90s child watchdog: **8 pass, 0 fail, 79 assertions, 5.38s**, child/wrapper0.
No filtering; all four real DB cases and four pure cases executed.

Executed acceptance includes one production-issued invoice and a second eligible
source; component rounding null with aggregate500; exact eight posting rows across
three balanced journals; immutable original document/hash/origin/reservation/folio/
valuation/service/status/series/fact/outbox/submission and all contra posting bytes
unchanged on rerun. Both service dates precede the issued business date, and active
supplier status evidence matches retained service/TOS plus issue dates. This proves
the older-service-date and retained-date branch without changing clocks or existing
financial evidence. It is not a claim that wall-clock midnight was crossed, arbitrary
multi-day delay remains eligible, or the statutory ordinary issuance window disappears.

Actual signed operator login/list/detail/readiness passed. No-auth401 and checker403
passed. A real active second-tenant actor with exact current property-scoped fiscal
read authority and supported jurisdiction received200/coherent empty own-property
invoice search, then403 for the first tenant's document. No availability grant was
added. Setup-only series permission remains separate from operator and checker.

The initial fresh baseline receipt remains **27/0,117 assertions,5.37s** against its
unchanged source/test. The retained baseline prerequisite failure is recorded above,
not presented as green or repaired by resets. Earlier genuine fiscal setup and test
failures remain in this report; this final proof did not recreate the target.

Final retained target `yellow_order444_q209_seed_repaired_review_20260907` is85/two
tenants/one document/zero other sessions. Complete outside46DB/19roles/4memberships
fingerprint `0a54f588b823aec6eaba2e68425fa5c0ff59098d180503c141b0381abb40eb7a`
unchanged; pristine77/127tables/zero tenants/zero other sessions fingerprint
`772c6f02352f6a295fa301271bd876cb0e2f13fe8b442eecd3edaeb0f863d720` unchanged.
All89 canonical input inventory fingerprint
`0f7d6d44037d05eecbcc8f130398e1e9a88283ab518a40afb10e8d42b11d7d1d`
and all four final source hashes verified before/after. All child/pools closed;
heavy native database lane explicitly released to root. Original failed target,
template, global roles and retained review application were untouched. No provider
calls, fabricated receipts, database cleanup, app promotion or integration approval.

Narrow disposition: independent seed source/database acceptance discharged for this
scoped synthetic fixture workflow. Exact-source CI and the separately reviewed native
runtime update remain required; this does not merge PR92 or claim complete Phase7.
