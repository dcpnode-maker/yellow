# Q267 — Order472 identity, saved-plan preview and market-only navigation

Status: RESOLVED by primary implementation owner before code,13 September2026.

## Complete gap and resolution

Q266 independently proves startup and manual evidence confirmation, but does not
complete the received URL/ID→confirmed-property→planner journey. Astra Ultra's
read-only integration audit identifies reusable identity and planner functions,
an explicit200-planner/500-compset bound mismatch, and availability-only shell
entry. Admit the source below. No new table, permission, migration, global role,
provider activation, network collection, dependency or theme redesign.

Natural-Solution Test: these are authorized reads/derived previews over the
existing immutable market_compset extension, not new stored operational entities.
Retain the original18-phase destination and Order472 outcome. A preview is not
scheduled work, supplier entitlement or a completed RMS decision engine.

## Fixed API contracts

- POST /api/v1/properties/:property/market/identity/suggest:
  {snapshot:{logicalId,sha256},target:{recordId?,publicUrl?,name?,coordinates?}}.
  At least one explicit target field. Reauthorize market-read through0092;
  resolve exactly one immutable server-held snapshot and reuse the existing
  identity helper unchanged. Return {suggestions:{snapshot,requiresConfirmation:
  true,ambiguous,candidates:[{reference,record,matchedBy,capturedAt,completeness}]}}.
  Candidate count is bounded500; reference selects that exact admitted snapshot.
  Never fetch, auto-select or persist input URLs. Unsafe/query/fragment URL input
  is rejected, not silently normalized into a different identity.
- POST /api/v1/properties/:property/market/plan/preview:
  {expectedCompset:{extensionId,version},comparatorIndexes,
  conditions:{destination,lookaheadMonths,selectedSources,guests,
  pointOfSaleMarket,language,lengthsOfStayNights}}.
  Reauthorize market-read, acquire the existing property extension-version lock,
  re-read/validate current persisted content, and reject changed expected ID/version.
  Distinct indexes select1–200 existing comparators;0 or201+ fails explicitly.
  Never silently truncate500 stored records or plan from an unconfirmed UI draft.
  Derive tenant/property/timezone/currency/server instant in the transaction.
  Call buildMarketSourcePlan unchanged with fixed preview-only entitlement,
  no collection history, maximum100 selected requests and batch size25.
  Return {preview:{previewOnly:true,executable:false,compset:{extensionId,version},
  conditions,propertyTimezone,currency,comparatorMapping,
  plan:{asOfUtc,propertyLocalDate,arrivalEndExclusive,requestedPotentialQueryCount,
  dueRequestCount,selectedRequestCount,deferredRequestCount,
  deferredDueToBudgetCount,deferredDueToCadenceCount,nextDueAtUtc},
  sample:[{source,arrivalDate,checkoutDate,lengthOfStayNights,daysAhead,cadence}]}}.
  Mapping is once per selected opaque token/index/reference; sample maximum10.
  Do not return execution keys or repeat huge evidence in every request sample.
- GET /api/v1/me/market-properties?cursor=...:
  {marketProperties:{properties:[{id,name,timezone,currency}],nextCursor}}.
  Active current tenant/user, coarse market-read and current tenant-bound
  role/permission/hierarchy predicate matching0092; no availability fallback.
  Fixed page size50, bounded opaque UUID keyset cursor (not OFFSET), deterministic
  order, exact query allowlist. Cursor grants no access. Every later property
  operation still executes0092's current locked authorization.

Existing result/error boundaries and the server16KiB request limit remain.
Domain constructor/input snapshots are immutable before the first await.
Methods producing only reads/derived previews must write no extension/fact/outbox/
idempotency rows. Existing confirm/current/discovery contracts stay compatible.

## Exact file ownership

- /root/astra_ultra_handoff: src/contexts/distribution/market-compset.ts;
  src/contexts/distribution/index.ts (explicit exports only);
  tests/market-compset.test.ts; tests/market-compset.integration.test.ts;
  tests/helpers/market-compset-fixture.ts (additional synthetic actors/grants only
  inside the same exact guarded target; no new provisioning; bounded pagination
  amendment below).
- /root/q258_runtime_cutover: src/http/market.ts; src/app.ts (these routes only);
  tests/market-api.test.ts; tests/market-api.integration.test.ts.
- /root/q258_source_adapter: src/http/operator/market.js;
  src/http/operator/operator.js (market/operational property lists, login fallback,
  view lifecycle only); src/http/operator/index.html (market-only pagination/access
  controls only); src/http/operator/operator.css (market-prefixed additions only);
  tests/operator-market.test.ts.
- Root: tests/operator-market.browser.test.ts; this question; Order472;
  docs/PROJECT-STATUS.md; docs/CONTRACTS.md;
  docs/design/BUILT-CAPABILITY-MANIFEST.md; receiving/review472; DECISIONS.log;
  handoff/LEDGER.md. Root may author a separate focused
  tests/operator-market-planner.browser.test.ts for independent integration proof.

No edits to market-batches.ts, market-discovery.ts, runtime/catalog/readiness,
0092, schema, seed, generic operational property grants, frozen471 or paused445.
Discovered required scope conflicts are recorded before code.

## Workspace and verification

Keep saved confirmed evidence separate from editable candidates. Preserve/display
its original source dates and historical references even if absent from today's
catalog. Show URL/ID suggestions and their reasons without selecting for the user.
Show saved-plan conditions, explicit comparator subset, preview bounds, unknown
source operating status and the difference between preview and live collection.
Changing property, session, snapshot, draft or saved-version context invalidates
the affected response/preview; never present stale results for the new context.

Keep operational and market property choices separate. A market-only user may
sign in and enter Market evidence without acquiring availability permissions;
other workflows retain their old authorization. Both paginated property lists
must be honest about remaining pages, not silently claim completeness.
No request-derived tenant/actor and no automatic real-user permission grants.

Tests accompany each source change. Root nonimplementer personally runs actual
Q265 guarded native service/API proofs plus browser proof on synthetic temporary
loopback only. Negative coverage includes foreign/revoked/disabled actors,
snapshot substitution, URL ambiguity, invalid/forged indexes, stale version,
0/201 bounds, unchanged DB after preview, timezone/calendar and market-only login.
Reuse the sole retained target; no new cluster/database or destructive cleanup.
Do not use an asynchronous rejection matcher inside native reserved transactions.
No publication, live migration/cutover, canonical-referee or phase-closure claim.

## Resolved native pagination fixture amendment

Before fixture changes, root admits an optional `additionalProperties` integer
0–60 in the existing guarded synthetic helper. These are fresh UUID property
nodes under that invocation's newly generated tenant-A root only, with synthetic
names, currency and timezone. Reuse the exact retained Q265 database and existing
roles. This enables actual SQL proof of page50 plus sentinel and keyset successor;
unit-only pagination would not establish the native query behavior. No other
tenant/root, migration, role, permission definition, new database or cluster may
be changed, and no cleanup/drop is admitted. Astra authors; root executes.

## Source acceptance checkpoint — D1491

Root nonimplementer personally executed the final19-file aggregate:
153pass/0fail/1641 assertions in61.41s, including20 actual PostgreSQL cases and
9 native filesystem cases. Real-shell browser2pass/0fail/82 uses synthetic HTTP,
not the live application. Strict types and202 import boundaries pass. Production
authors, exact commands, genuine failures/repairs and frozen identities are in
Review472. No schema/runtime/publication or phase-closure admission is implied.
Order472 remains active for its uncompleted map/attribute and release outcome.
