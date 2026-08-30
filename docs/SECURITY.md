# SECURITY.md — threat model & controls (v1)

What we hold: guest PII, passport/ID numbers (statutory), payment TOKENS (never
PANs), owner financials, competitive rate data. What that makes us: a target.
This file is the checklist every phase builds against; Phase 0 CI enforces the
testable parts.

## 1. Authentication & sessions

- Passwords: `Bun.password` argon2id, per-user salt (built in). No password hints,
  no security questions. Reset via signed single-use token, 15-min TTL.
- Sessions: short-lived JWT (15 min) + rotating refresh token bound to device;
  refresh reuse detection revokes the family. JWT carries tenant_id + scopes;
  tenant NEVER read from request body (TC-13.3).

The current local workbench issues only the short-lived access token. Its HS256 signing
secret must be supplied by deployment or generated ephemerally by local setup; enabled
startup accepts no repository-known fallback. Secret rotation invalidates outstanding
access tokens and does not modify staff password hashes.
- MFA: TOTP for roles with financial or config scopes; enforced for owner/admin.
  SSO/SAML = enterprise trigger item (BUILD-PLAN parked).
- Kiosk: device-bound restricted token, no user session, rate-limited lookups.

## 2. Authorization

- Two layers, both mandatory: RLS in PG (tables AND views — TC-13.1/13.4) and
  scope checks in middleware before handlers. UI hides what scopes deny, but the
  API is the boundary.
- Approval_request gates: adjustments over threshold, trust-negative, seal
  override, erasure. Four-eyes by design, logged.
- api_client tokens: least-scope, per-integration, revocable, hashed at rest.

## 3. Data protection

- At rest: full-disk on OCI volumes + pgcrypto column encryption for identity
  document numbers (key in env-injected KMS file, never in repo).
- In transit: TLS everywhere (Caddy auto-cert internal, Cloudflare edge external);
  HSTS; TLS also on PG connections between nodes.
- Payment: tokens only (SAQ-A posture). PAN/CVV never in DB, logs, events, or
  error messages — a CI grep gate scans for PAN-shaped literals in fixtures/logs.
- Backups: pgBackRest to R2 with client-side encryption; restore drill monthly
  (doctrine) — an unencrypted backup is a breach in waiting.
- Logs: no PII in log lines; guest references by id. GlitchTip scrubbers on.

## 4. Application hardening

- Input: TypeBox validation at the edge (Elysia); SQL only via parameterized
  drivers; no string-built SQL (skill rule + review grep).
- Rate limiting: per-IP and per-token buckets at Caddy + app for auth, search,
  and booking-engine endpoints; Turnstile on public booking engine.
- The current loopback staff login implements the app-side portion in each process: a
  5-attempt source bucket refilling 20/minute, a 3-attempt normalized-account bucket
  refilling 8/15 minutes, 1/2/4/8/16/32/60-second failure backoff, four concurrent
  Argon2 verifications with no queue, and bounded 4,096/8,192-entry state. Only Bun TCP
  peer metadata selects the source; forwarded address headers are not trusted. This is
  not a shared multi-process or public-edge limiter.
- Headers: CSP (no inline script), frame-ancestors none (except kiosk origin),
  referrer-policy strict.
- Idempotency keys stored hashed; replay window 24 h.
- Dependency hygiene: Renovate + `bun audit` in CI; lockfile committed.

## 5. Tenant isolation failure modes (tested, not assumed)

- `yellow_runtime` is the tenant application, HTTP, worker, event and discovery
  login. It is `NOSUPERUSER`, `NOBYPASSRLS`, owns no Yellow object, and has one
  explicit membership edge: `yellow_runtime -> app_role`.
- `yellow_owner` is `NOLOGIN`, password-free, non-superuser and owns the public
  schema objects and bounded SECURITY DEFINER capabilities. `yellow_deploy` is a
  separate deployment/migration/seed/schema/referee administrator and is never
  present in an application environment. `app_role` remains an internal `NOLOGIN`
  capability role with no password or authentication path.
- `yellow_extension_registrar` is a separate `LOGIN`, `NOINHERIT` principal with
  connection limit four, zero membership/ownership/table/sequence authority, and
  only schema `USAGE` plus execution of the fixed extension-type registration
  command. Its max-two unprepared pool is reachable only after the authenticated
  platform-scope check and is never exposed as a generic transaction handle.
- Every application transaction establishes verified tenant context before
  `SET LOCAL ROLE app_role`; commit, rollback, nested failure and pooled backend
  reuse must restore `current_user = session_user = yellow_runtime` and clear the
  tenant setting. A hostile `RESET ROLE` can therefore return only to the runtime
  principal, which has no owner/deploy, DDL, cross-tenant or role-management power.
- Deployment tooling accepts only `YELLOW_DEPLOY_DATABASE_URL`; tenant application
  paths accept `YELLOW_RUNTIME_DATABASE_URL`, while the application alone also
  receives `YELLOW_EXTENSION_REGISTRAR_DATABASE_URL`. Migrate, seed and review seed
  never receive the registrar credential. All three credentials are distinct,
  generated/injected secrets and are never logged or committed.
- RLS through views — regression TC-13.4, permanent.
- SECURITY DEFINER choke points use the exact fixed search path
  `pg_catalog, public, pg_temp`, schema-qualify every Yellow relation and helper
  call, and deny `EXECUTE` to `PUBLIC`. `app_role` may execute only the
  occupancy record/release entry points; business-day sealing, outbox pruning,
  legacy hold expiry, and day-open assertion remain owner-only. Owner-only day
  sealing is a temporary least-privilege containment boundary, not the continuous
  day-close product: a future application path must be an authorized, audited
  domain command with server-derived actor evidence before it receives narrowly
  scoped execution authority. A hostile
  `pg_temp` proof must show that temporary shadow objects are neither invoked
  nor modified. These namespace and ACL controls contain definer escalation;
  they do not replace caller tenant validation or RLS.
- Cross-tenant IDOR: API handlers must scope EVERY query by session tenant even
  though RLS backstops — belt and braces, and the tests hit both.

### Positive runtime-DML boundary (migration 0016)

The runtime role must have a positive, machine-checked mutation catalogue rather
than blanket `app_role` table grants. Migration 0016 preserves only table/column
operations exercised by current production callers; it grants no mutation on
future tables, views, global coordination tables, tenantless metadata or
immutable records by default. `document` remains runtime-immutable and
`rate_price` permits only `UPDATE (superseded_by)`. Outbox publication is
function-mediated and must not remain a direct runtime update.

Canonical demo and review seed are deploy/tool operations. The external
`yellow_deploy` caller creates and verifies global tenant/property seed rows;
`app_role` performs only the exact tenant-context visibility/idempotency probe.
Runtime coordination, occupancy, due-hold discovery, extension reads,
publication marking and pruning use their existing signature-specific functions.

Account and folio rows expose no direct runtime `UPDATE` authority. Financial
commands obtain only structural row locks through
`lock_financial_rows(tenant, account_ids, optional_folio)`: a non-mutating,
owner-mediated function callable only after the trusted runtime transaction has
entered `app_role`. It accepts one or two distinct tenant accounts, locks them in
UUID order, optionally locks a folio belonging to that set, returns no business
data, and fails without identifying a missing or foreign target.

Extension-type registration is `register_extension_type(tenant,type,schema,actor,
property,request)`, not direct runtime DML. The `yellow_owner` function verifies the
dedicated session principal and audit authority, derives the UUIDv5 subject, and
atomically writes the global type plus one insert-only tenant fact; identical replay
returns false without another fact and divergence fails. Runtime, `app_role` and
`PUBLIC` cannot execute it or directly insert the catalogue row.

### Pure tax-evaluation containment

Order 237's evaluator is an in-process pure function with no database, HTTP, browser,
extension-registry, assignment, provider or event capability. Callers cannot override
a jurisdiction rate: one complete supplied `tax_jurisdiction` content value is
validated as hostile input, and unknown fields, hidden display/rounding defaults,
duplicate codes, malformed slabs or dependencies, fractional/unsafe quantities and
non-basis-point rates reject the whole evaluation without a partial result.

Money and intermediate values remain bounded signed-safe `bigint`; JavaScript-number
money and unbounded arithmetic are invalid. Input lines, room-night components, tax
definitions, application groups, dependency lists, slab bands and rational complexity
have explicit limits. Inputs are positive only and results are
deeply frozen. The evaluator derives no tenant, property, date, guest category,
occupancy, currency, discount, rate-plan precedence or legal place of supply. It has
no authority to mutate a folio, journal, posting, tax detail, document number/hash,
fiscal submission, fact or outbox row. A computed tax component therefore cannot be
treated as posted money, a finalized quote or an issued/legally valid invoice.

Negative corrections, tax-line residual allocation, person-category rules,
`rate_plan.tax_inclusive` precedence and India CGST/SGST/IGST decomposition remain
explicitly outside this trust boundary and must fail closed at later integrations
until separately authorized.

### Read-only tax-jurisdiction resolution containment

Order 238 accepts only a property UUID and an already-derived property-local business
date inside the tenant transaction. PostgreSQL transaction-local tenant truth proves
the active same-tenant property and selects the containing `tax_assignment`; no
caller-supplied tenant, jurisdiction key, extension id, version, content or precedence
is trusted. Missing assignment is explicit, overlap fails closed and `[)` range
semantics require no process clock or timezone inference.

Global-plus-tenant extension visibility remains confined to the existing
yellow-runtime-only `ExtensionRegistry.listVisible()` adapter. There is no raw
extension-table read, new database capability, RLS/ACL change or app-role/PUBLIC
access. Exactly one active visible matching `tax_jurisdiction` is required; ambiguity
fails rather than selecting by tenant ownership or row order. Because the adapter
does not expose `extension.effective`, the resolver cannot assert or defeat extension
temporal applicability.

The recursively copied result is deeply frozen and binds exact assignment bounds,
extension identity/version, canonical content, SHA-256 content hash and deterministic
evidence references. Resolution writes no assignment, extension, fact, outbox,
journal, posting, document, series/hash, submission or provider state and emits no
event. Its evidence permits only later pure calculation; it is not quote, posting,
fiscal-issue or legal-invoice authority.

### Rate-quote tax-preview containment

Order 239 does not add caller-controlled tax inputs. The existing quote request is
unchanged, and the service must use its injected Order-238 resolver for every ordered
property-local night. Zero or partial assignment, or mixed exact extension id, owner,
key, version or content hash, produces explicit unavailable evidence without a
partial total. Blocked, unpriced or conflicting quotes do not evaluate.

The preview admits only an exact room-only quote of at most 366 nights with no
package evidence/allocation, included or extra amount, applied promotion or discount,
and a pre-tax subtotal exactly equal to room total. Its sole `room_revenue` line uses
the ordered nightly `bigint` amounts plus exact length of stay and party
person-nights; neither averages nor person categories are trusted. The exact active
same-tenant/property rate-plan currency and `tax_inclusive` truth must agree with the
jurisdiction `price_display`; neither overrides the other and mismatch fails closed.

Per-night assignment evidence, exact extension id/version/content/hash evidence and
the complete evaluator result are deeply frozen into `quoteHash`. HTTP money is
serialized only as canonical decimal strings. The preview has no write, cache, price
mutation, booking-commit, folio, posting, journal, tax-detail, document, provider,
fiscal, fact or event authority and exposes no new endpoint.

Folio preview is outside this trust boundary. Folio reads do not canonically prove
revenue group, service night, person-night, quote lineage, correction attribution and
transfer attribution for every positive charge; inferring them from USALI labels or
descriptive quantity would manufacture financial truth and is forbidden.

### Positive tax-attribution snapshot containment

Order 240 is a pure in-process canonicalization boundary around one calculated
Order-239 preview. It accepts no tenant lookup, database handle, extension resolver,
price input override or caller-selected tax authority. Version 1 admits only the
positive `rate_quote` origin and binds exact quote hash, currency, stable line and
`room_revenue` identity, positive input lineage, ordered room-night and
business-date assignment evidence, exact jurisdiction extension identity/version/
content hash, evaluator modes, totals, tax totals and ordered line components.

Transport values contain canonical non-negative decimal strings for every money and
quantity. Runtime `bigint`, JavaScript-number/float money, exponent forms, signed or
negative zero, unsafe magnitudes and non-finite values are rejected. Before hashing,
creation proves exact room-night/input, evaluator-input, base/tax/grand and
tax-total/component reconciliation plus unique coherent ordering. `snapshotHash`
covers the complete canonical value excluding only itself.

Parsing treats every value as hostile. It rejects unknown fields, getters/accessors,
cycles, malformed UUIDs, SHA-256 values, currencies, dates, evidence references and
decimal text, duplicate or out-of-order evidence, unsupported signs and any lineage
or total mismatch. Builder and parser do not mutate input and expose only recursively
frozen output, preventing a validated value from changing after its hash is checked.

This boundary has no database, HTTP, UI, fact, event, cache or mutation capability.
It cannot create or authorize a booking, folio, journal, posting, tax detail,
correction, reversal, transfer, tax-payable allocation, invoice, India
CGST/SGST/IGST split, document/series/hash chain, IRP payload, provider request,
submission or fiscal-final result. Consumers must obtain separately authorized
persistence, posting, correction, transfer and document semantics rather than treating
the snapshot as money or legal finality.

### India GST supplier-registration containment

Order272 adds one tenant-leading `property_fiscal_registration` root protected by
RLS. Its composite property reference prevents cross-tenant property binding; its
exact identity is structurally unique including nullable jurisdiction owner, and its
checks bound the sole `in-gstin`/`INR` scheme, hashes, names/address/locality,
GSTIN/current-state allowlist and pincode. `PUBLIC` and `yellow_runtime` have no table authority.
`app_role` receives SELECT only; raw runtime insert, update, delete and truncate stay
denied. Tenant context remains transaction-local, and cross-tenant rows are invisible.

The internal resolver accepts only canonical tenant/property/reservation identity and
reads the table only after the existing positive-tax eligibility owner returns frozen
snapshot evidence. Exact `IN`/`INR` plus property kind, extension id, nullable owner,
key, version and content hash are equality-bound in the query. Stored GSTIN
checksum/state, NFC text, control characters and every duplicated identity are
revalidated before a recursively frozen result and deterministic evidence hash are
returned. Missing, duplicate, malformed, stale, mismatched and cross-scope truth
fails closed without a fallback to mutable extension lookup, `org_node.config`,
display names, Party/guest records or code coincidence.

The boundary is read-only: it cannot author registration data or change journal,
posting, document, outbox, fiscal-submission or idempotency counts. It grants no buyer
GST/SEZ/place-of-supply decision, CGST/SGST/IGST split, document allocation,
posting/correction/credit note, numbering/hash-chain, IRP/provider request or
submission authority.

### India GST registered-recipient candidate containment

Order276 specifies one tenant-leading `party_fiscal_registration` root. Its composite
tenant/Party reference must prevent cross-tenant Party binding, every index must lead
with `tenant_id`, and RLS must use the transaction-local `app.tenant_id` context.
`PUBLIC` and `yellow_runtime` receive no table authority. `app_role` receives SELECT
only; insert, update, delete and truncate remain denied, including hostile direct DML.

The resolver must accept only the exact plain
`{tenantId,recipientPartyId,registrationId}` tuple and equality-bind all three values.
It may return evidence only when the exact Party is active and the exact registration
is visible under the same tenant. It must revalidate the `in-gstin` scheme, GSTIN
checksum/current-state match, NFC/control-character and text-length constraints, and
the exact six-digit nonzero PIN before returning a recursively frozen result with a
deterministic evidence hash. Missing, foreign, merged, anonymised, malformed or
mismatched truth fails closed with no registration, fact, outbox, journal, posting,
document, submission or idempotency write.

Mutable Party display/legal names, attributes, contacts, address rows and roles are
not trusted as registration fallback. Accounts, reservations and folios may not infer
the registration UUID. A successful read is registered-recipient candidate evidence,
not invoice-window or legal-buyer designation. It grants no `BuyerDtls`, `URP`,
export/SEZ/deemed-export, `Pos`, `SupTyp`, CGST/SGST/IGST decomposition, item/value/tax
calculation, allocation, posting/correction, document/number/hash-chain,
provider/submission, API, HTTP or UI authority. These protections are built with
executable product/database proof and are independently Tier-3 approved under D-725
with no remaining finding.

### India GST folio-window buyer candidate containment

Order279 specifies one exact read-only tenant-transaction association. The boundary
accepts only the accessor-free five-key
`{tenantId,propertyNode,folioId,recipientPartyId,registrationId}` object, retains the
transaction-local tenant context and equality-binds tenant/property/folio to exactly
one account and reservation anchor. Account property and the explicit property must
match, and account/reservation currencies must agree. Missing, duplicate, foreign,
malformed or incoherent anchors fail closed.

Window/status, account role/status, reservation status and currency are returned only
as stored evidence. They confer no legal, issue, settlement or transition authority.
The query does not read account Party, reservation primary/booker Party, guest role,
folio name or folio number to infer the buyer. Only the exact explicit Party and
registration may enter the approved Order276 resolver and approved Order278 builder.

The result is recursively frozen and deterministically hashes its complete fixed-order
folio/account/reservation/window/status/currency, Party/registration/evidence and exact
BuyerDtls payload evidence. Exact sibling windows remain cryptographically distinct
even when Party and registration match. Discovery and resolution acquire no lock and
must leave folio, account, reservation, Party registration, fact, outbox, idempotency,
document, journal, posting and submission rows byte/count unchanged.

This boundary is candidate evidence, not persisted or legal buyer designation. It has
no `Pos`, `SupTyp`, B2C/URP, export/SEZ/deemed-export, tax decomposition, document,
submission, provider, API, HTTP or UI authority. Fresh independent Tier-3 execution
approves exact Order279 under D-731 with no finding.

### India property fiscal-location containment

Order280 adds one tenant-leading `property_fiscal_location` root. Its sole
`(tenant_id, property_node)` identity and same-tenant composite property reference
prevent duplicate or cross-tenant property binding. Every index is tenant-leading,
RLS is enabled and forced, and the policy uses the transaction-local
`app.tenant_id`. `PUBLIC` and `yellow_runtime` receive no table authority.
`app_role` receives SELECT only; insert, update, delete and truncate remain denied,
with no owner-mediated writer or runtime provisioning capability.

The resolver accepts only the exact plain, accessor-free, proxy-free and symbol-free
`{tenantId,propertyNode}` tuple. It retains tenant context, equality-binds both UUIDs
and returns evidence only for one exact tenant-owned property row carrying country
`IN`, a current GST state/UT code, canonical address line 1 and locality, and an exact
six-digit nonzero PIN. It must revalidate stored truth before returning the exact
recursively frozen result and deterministic SHA-256. Tenant identity is included in
the fixed-order hash evidence but is not exposed in the result.

Missing, duplicate, foreign, malformed, noncanonical or incoherent truth fails
closed. Supplier and recipient GSTIN states, `org_node` name/config/path, profiles,
spaces, unit types and GST-like tax codes are not trusted as fallback. Successful and
failed reads acquire no lock and leave location, registrations, tax lineage, facts,
outbox, financial/fiscal documents, journals, postings and submissions byte/count
unchanged.

This boundary is typed physical-property evidence only. It grants no IRP `Pos` or
`SupTyp`, accommodation/service classification, HSN/SAC, B2C/URP, export, SEZ or
deemed-export treatment, CGST/SGST/IGST decomposition, tax-rate, reservation/folio/
buyer association, posting/correction, document/number/hash-chain,
provider/submission, API, HTTP or UI authority.

### India GST accommodation-classification containment

Order281 adds one tenant-leading `india_gst_item_classification` assignment. Its
same-tenant property reference and exact unique tenant/property/frozen-jurisdiction/
room-line identity prevent duplicate and cross-scope assignments. Every index is
tenant-leading. RLS is enabled and forced and uses transaction-local
`app.tenant_id`; `PUBLIC` and `yellow_runtime` receive no table authority, while
`app_role` receives SELECT only. Insert, update, delete and truncate remain denied,
with no owner-mediated writer, application provisioning capability or runtime
classification mutation.

The resolver accepts only the exact plain, accessor-free, proxy-free and symbol-free
`{tenantId,propertyNode,reservationId,classificationId}` tuple. It retains tenant
context, obtains exact frozen positive-tax eligibility and equality-binds the selected
row to tenant, property and the eligibility result's complete jurisdiction extension
id, nullable owner, key, version and content hash. The row must revalidate as country
`IN`, line `room`, revenue group `room_revenue`, system `SAC`, service flag `Y` and
one exact launch code from `996311`, `996312`, `996313`, `996321`, `996322` or
`996329` before returning recursively frozen evidence.

The deterministic SHA-256 binds fixed-order unexposed tenant plus every returned
property, nested jurisdiction and classification field. Missing, duplicate,
cross-tenant, cross-property, foreign-reservation, malformed, stale or incoherent
evidence fails closed. HSN, goods flag, arbitrary code and mismatch of any lineage
field fail closed. `GST_ROOM`, `room_revenue`, USALI, transaction codes, semantic
routes, rate plans, profiles, spaces, unit types and property display/configuration
are not trusted as lookup, inference or fallback.

Successful and failed classification reads leave classification, eligibility,
registrations, tax lineage, facts, outbox, journals, postings, documents, fiscal
submissions and idempotency state byte/count unchanged. The boundary grants no IRP
`ItemList`, `Pos` or `SupTyp`, B2C/URP, export, SEZ or deemed-export treatment,
tax-rate or CGST/SGST/IGST decision, seller/buyer/folio-window composition,
posting/correction, document/number/hash-chain, provider/submission, API, HTTP or UI
authority.

### India accommodation place-of-supply candidate containment

Order282 adds no schema, grant, role, capability or writer. The resolver accepts only
the exact plain, accessor-free, proxy-free and symbol-free seven-UUID tuple
`{tenantId,propertyNode,reservationId,folioId,recipientPartyId,
recipientRegistrationId,classificationId}` and runs inside the already established
transaction-local tenant context. It delegates only to the approved supplier,
explicit folio/buyer, physical-property-location and accommodation-classification
resolvers; it adds no direct SQL or independent inference source.

Every returned root must revalidate as exact, deeply frozen evidence. Tenant,
property, reservation, folio, explicit Party/registration, classification and the
complete jurisdiction identity must be coherent; Indian country, `INR`, lodging SAC
service and each deterministic source hash must remain exact. Missing, duplicate,
foreign, stale, malformed, proxy/accessor-backed, surplus or mixed evidence fails
closed. Supplier or recipient GSTIN state, guest/account addresses, org/profile
fields, rate/tax-code labels and display/configuration values are never used as lookup,
comparison, inference or fallback for `pos`.

The sole place rule is `IGST_ACT_12_3_B`, and the exact Order280 physical-property
state is the sole `pos`. The fixed-order candidate body has exactly
`propertyNode,reservationId,folioId,jurisdiction,supplier,recipient,buyerAssociation,
classification,propertyLocation,legalRule,pos`; the nested jurisdiction retains its
full frozen identity, while every other evidence group contains only its specified
identifiers and hashes. Raw supplier/recipient states, SAC/service/line/group and raw
location state are validated but omitted. `candidateJson` is the exact fixed-order
body JSON and `candidateHash` hashes
`JSON.stringify({tenantId,candidate:body})`, so tenant identity is bound but remains
outside the body, JSON and returned result. Result and nested values are recursively
frozen; replay is byte-identical and caller inputs/source results stay unchanged.

Successful and rejected composition leaves supplier, recipient, folio/account/
reservation, classification, location, tax-lineage, facts, outbox, idempotency,
journals, postings, documents and submissions byte/count unchanged. Order282 adds no
advisory or row lock beyond locks inherited from its approved governed source
resolvers. It grants no intra/inter-state conclusion, CGST/SGST/IGST rate or
decomposition, `SupTyp`, `ItemList`, item values, posting/correction, document issue/
number/hash-chain, provider/submission, API, HTTP or UI authority.

### India accommodation registered-state comparison containment

Order283 adds no schema, role, grant, capability, resolver, transaction or writer. Its
pure value function accepts only the exact plain, accessor-free, proxy-free and
symbol-free `{tenantId,supplier,placeOfSupply}` shape. The supplier and place-of-
supply inputs must be complete, recursively frozen Order272 and Order282 values;
unknown keys, hostile prototypes, accessors, symbols, proxies, unfrozen objects or
malformed identities fail closed before any result is exposed.

The boundary does not trust carried hashes. It independently revalidates the complete
fixed source shapes and recomputes the tenant-bound supplier evidence hash and
place-of-supply candidate JSON/hash. Property, reservation, folio, registration,
classification and every jurisdiction/source hash must remain coherent. Cross-tenant,
cross-property or cross-lineage substitution, tampered JSON/hash and stale or
malformed nested evidence fail closed without revealing foreign truth. Neither source
is normalized, repaired or mutated.

The only computation compares exact `supplier.stateCode` with exact
`placeOfSupply.pos`. Recipient GSTIN/address state, guest/account/organisation/profile
state and display/configuration truth never enter the relationship and cannot serve
as lookup, inference or fallback. The fixed body and nested lineage use the exact
Order283 shapes; `candidateJson` is its fixed-order body JSON and `candidateHash`
hashes `JSON.stringify({tenantId,candidate:body})`. Tenant remains unexposed. The
body, result and all nested values are recursively frozen, replay is byte-identical,
and successful or rejected calls perform no SQL, lock, read, write, fact, event,
financial or fiscal effect.

`same_state_or_union_territory` and `different_state_or_union_territory` are evidence
literals, not statutory intra-State/inter-State conclusions. Registered state does
not prove the applicable supplier establishment, and SEZ rules can make an otherwise
same-code supply inter-State. The boundary therefore grants no SEZ/non-SEZ or
supplier-location selection, B2C/URP, export/deemed-export, `SupTyp`, `IgstOnIntra`,
reverse charge, CGST/SGST/UTGST/IGST route/rate/amount, rounding/residual, `ItemList`
or item/value authority. It cannot post/correct money, allocate/issue/number/hash-chain
a document, call a provider/submission, or authorize API, HTTP, UI, local-runtime,
status or promotion behavior.

### India GST supplier service-location containment

Order284 adds one tenant-leading root with a same-tenant fiscal-registration FK,
exact constrained literals, RLS enabled and forced, and an `app_role` SELECT-only
grant. PUBLIC, runtime and app raw INSERT/UPDATE/DELETE/TRUNCATE remain denied; there
is no capability, owner-mediated writer, seed, fact, event or lifecycle command.

The resolver accepts only four canonical UUIDs in an exact plain object. It enters
transaction-local tenant context through established Order272 behavior, revalidates
complete current supplier evidence, and equality-selects one requested assignment by
tenant/id/registration/hash/scope. Cross-tenant, cross-property, cross-reservation,
missing, duplicate, stale, malformed, proxy/accessor/symbol or thawed evidence fails
closed without revealing a row. Result and nested evidence are recursively frozen,
the fixed hash binds the unexposed tenant, and all successful/rejected calls are
zero-write.

The assignment supplies only explicit section2(15)(a) supply-from and place-kind
truth. State/address/locality/PIN are copied only from the independently revalidated
Order272 result. GSTIN prefix, stored address alone, property fiscal location,
physical co-location, SellerDtls, recipient/folio/org/profile/config or Order283
equality cannot select a location. Section2(15)(b–d), SEZ, authorized operations,
supply nature, levy/rate/amount, `SupTyp`, `IgstOnIntra`, item, posting, document,
submission, API/HTTP/UI, local-runtime and promotion authority remain excluded.

### India GST recipient SEZ-status containment

Order285 adds one tenant-leading root with a same-tenant Party fiscal-registration
FK, constrained active official status/type/approval evidence, RLS enabled and forced,
and `app_role` SELECT only. PUBLIC, runtime and app raw DML/TRUNCATE are denied; no
capability, owner-mediated writer, seed, fact, event or lifecycle command exists.

The resolver accepts only four canonical UUIDs in an exact plain object, obtains and
independently revalidates complete current Order276 recipient evidence, and selects
only the requested tenant/id/registration/hash row. Cross-tenant/Party/registration,
missing, stale, unsupported, inactive, expired, future, malformed, proxy/accessor/
symbol or thawed truth fails closed. Results are recursively frozen, fixed-order and
tenant-hash-bound; reads and rejections are zero-write.

Affirmative regular official evidence is the only non-SEZ path; absence never
substitutes. Unit/developer status requires a complete type-compatible in-force
approval tuple whose finite validity contains the explicit evidence date. Party/
account/reservation/folio labels, GSTIN/address, BuyerDtls, property/Pos, Order283,
config/SAC/tax-code truth cannot select a result. Approval evidence does not prove
authorized operations or zero rating. Supplier-side SEZ, supply nature, levy,
`SupTyp`, `IgstOnIntra`, item, document, submission, network/API/UI/local authority
remain excluded.

### India GST supplier SEZ-status containment

Order286 adds one tenant-leading root with a same-tenant property fiscal-registration
FK, constrained active official status/type/approval evidence, RLS enabled and forced,
and `app_role` SELECT only. PUBLIC, runtime and app raw DML/TRUNCATE are denied; no
capability, owner-mediated writer, seed, fact, event or lifecycle command exists.

The resolver accepts only five canonical UUIDs in an exact plain object, obtains and
independently revalidates complete current Order284 supplier service-location evidence
and its Order272 registration id/hash, then selects only the requested
tenant/id/registration/hash row. Cross-tenant/property/reservation/location/
registration/status, missing, stale, unsupported, inactive, expired, future,
malformed, proxy/accessor/symbol or thawed truth fails closed. Results are recursively
frozen, fixed-order and tenant-hash-bound; reads and rejections are zero-write.

Affirmative regular official evidence is the only non-SEZ path; absence never
substitutes. Unit/developer status requires a complete type-compatible in-force
Form-G/B/C approval tuple whose finite validity contains the explicit evidence date.
Form F2 renewal remains unsupported and fails closed. GSTIN/address, property/org/
profile/config labels, SellerDtls, Order283 relationship and recipient Order285 status
cannot select a supplier result. Approval evidence does not prove authorized
operations or zero rating. Bilateral supply nature, levy, `SupTyp`, `IgstOnIntra`,
item, document, submission, network/API/UI/local authority remain excluded.

### India SEZ-unit first LoA-renewal containment

Order288 adds one tenant-leading same-tenant FK root with forced RLS and `app_role`
SELECT only. PUBLIC, runtime and app raw INSERT/UPDATE/DELETE/TRUNCATE are denied; no
capability, writer, seed, fact, event or lifecycle command exists. The resolver
accepts exactly seven canonical coordinates, fully revalidates and rehashes complete
frozen Order286 evidence, and equality-selects only the requested tenant, renewal id,
supplier-status id and explicit status date. It never selects latest or consults a
clock.

Only active supplier SEZ-unit Form-G evidence can proceed. Reference/hash lineage,
canonical strings and dates, Form-G-to-F2 issue chronology, finite `[)` renewal
validity, status-date containment and exact lower-to-upper continuity are rechecked
in process rather than trusted to database constraints. Cross-tenant/property/
reservation/location/registration/status/root/date evidence, gaps, overlaps, upper
boundaries, later chains, hostile shapes and stale hashes fail closed before result
exposure. Results are recursively frozen, fixed-order and tenant-hash-bound; replay
and rejection preserve caller/source bytes and write nothing.

Form F1 is not authority and this root cannot author Form F2 or assert authorized
operations, specified-officer endorsement, BLUT, zero rating, refund/payment mode,
supply nature, levy, rate/amount, `SupTyp`, `IgstOnIntra`, item/invoice/document,
posting, submission, network, API, HTTP, UI, local-runtime or promotion truth.

### India accommodation supply-nature containment

Order287 adds no schema, relation, role, grant, capability, transaction, resolver or
writer. Its pure function accepts only the exact plain, accessor-free, proxy-free and
symbol-free `{tenantId,supplyDate,registeredStateComparison,
supplierServiceLocation,recipientSezStatus,supplierSezStatus}` shape. Each upstream
value must be a complete exact recursively frozen approved Order283-286 result;
unknown keys, hostile prototypes, accessors, symbols, proxies, thawed objects or
malformed canonical identities fail closed before any result is exposed.

The boundary does not trust carried hashes. It independently revalidates complete
fixed-order upstream shapes and recomputes every tenant-bound candidate/evidence
hash. Property, reservation, folio, jurisdiction, Pos, supplier registration/
location and recipient Party/registration lineage must remain coherent at every
overlap exposed by the approved roots. Cross-
tenant, cross-property, cross-reservation, cross-folio, cross-jurisdiction, cross-
registration, cross-location or cross-status substitution, malformed candidate JSON
and stale/tampered hashes fail closed without revealing foreign truth. No source is
normalized, repaired, supplemented or mutated.

Both exact upstream `statusAsOf` dates must equal the canonical explicit
`supplyDate`. The function cannot select an earlier/latest/nearest row, consult a
clock, infer a property date or determine statutory time of supply. GSTIN/address,
recipient registered state, property/org/profile/configuration labels and Order283
alone cannot substitute for explicit bilateral status and location evidence.

The only legal branching is the admitted precedence: affirmative recipient or
supplier SEZ-unit/developer status forces `inter_state` under
`IGST_ACT_7_5_B`, with exact to/by/both direction evidence, before any ordinary
state comparison. Only affirmative regular/regular status may map Order283 same
State/UT to `intra_state` under `IGST_ACT_8_2` or different State/UT to
`inter_state` under `IGST_ACT_7_3`. The result, fixed-order body JSON and
tenant-bound hash are recursively frozen and byte-identical on replay. Success and
every rejection preserve caller and source bytes and perform no SQL, read, lock,
write, fact, event, financial or fiscal effect.

The result has zero levy, exemption, reverse-charge, component/rate/amount,
rounding/residual, `SupTyp`, `IgstOnIntra`, item/value, posting, correction,
document/series/number/hash-chain, provider/submission, network, API, HTTP, UI,
local-runtime or promotion authority. Form F2 renewal continuity is not accepted or
inferred and remains a separate future supplier-status evidence boundary. SEZ status
does not prove authorized operations: specified-officer endorsement and any
zero-rating/refund/payment-mode decision remain separate future authority boundaries.

### Tax-attribution persistence containment

Order 244 accepts only a value that survives the exact hostile Order-240 parser. All
stored duplicate identity is derived from that parsed value, never caller-selected,
and database constraints must agree with canonical JSON on every read. The active
tenant transaction resolves the contextual property and actor through composite
same-tenant references. Tenant RLS protects reads; PUBLIC and the app role receive no
raw insert, update or delete. The app role can execute only the bounded
owner-mediated record capability, whose security-definer body requires the exact
runtime session, effective app role and transaction-local tenant context.

Same-tenant snapshot-hash convergence and command idempotency prevent duplicate roots
and evidence under replay or concurrency. Root, fact, minimized outbox event and
receipt are one transaction: any parser, authority, fact or event failure leaves none
of them. The outbox event deliberately excludes the full snapshot, PII, amounts,
night/component detail, accounts, postings and documents.

The property id proves where the evidence was recorded, not that its quote belongs to
that property. No browser route or caller can convert this root into booking or
financial authority. Authoritative re-quote and hold/reservation binding, tax-payable
routing, journal topology, corrections, India tax decomposition, document allocation,
numbering, provider submission and fiscal finality remain separate guarded commands.

Named residual capability debt remains for approval decisions, extension
publication/retirement, hold transitions, inventory-policy and projection
replacement, operational-block updates, reservation/segment/guest lifecycle,
folio numbering, journal/posting transitions beyond this structural lock, and future task/fiscal/statutory or
document mutation. Extension publication/retirement remains separate debt; the
registration exception from D-417 is closed by migration 0018.

### Governed housekeeping transition containment (migration 0026)

Runtime has no direct `INSERT`, `UPDATE` or `DELETE` authority over `task` or
`unit_condition`. Migration 0026 adds one fixed-search-path owner-mediated capability
for the three Order-201 adjacent transitions only. It verifies the dedicated runtime
session/app role, exact tenant context, active actor and property, eligible
housekeeping/space task, active same-property space, authoritative condition and all
expected stale guards while holding the affected rows. `PUBLIC` and direct login
execution remain denied.

HTTP authority is separately least-scoped: `housekeeping.tasks:read` reads the board,
`housekeeping.tasks:work` starts/completes, and the distinct
`housekeeping.tasks:inspect` permission verifies. Tenant/property/actor/target state
are server-derived; foreign ids are concealed and browser-supplied authority is
ignored. The capability cannot create, assign, cancel or reopen tasks and cannot
write sheets, occupancy, reservations, financials, days or statutory records.

### Governed housekeeping sheet-generation containment (migration 0027)

Runtime has no direct `INSERT`, `UPDATE` or `DELETE` authority over `task_sheet` or
`task`. Migration 0027 provides one fixed-search-path owner-mediated generation
capability. It validates the dedicated runtime/app-role context, transaction-local
tenant, active actor/property, one active same-tenant staff attendant, exact
property-local date, effective tenant-over-global vertical profile, current in-house
segment and sanctioned same-space occupancy while holding the deterministic decision
keys. `PUBLIC`, direct login and raw runtime DML remain denied.

HTTP authority is least-scoped separately: `housekeeping.sheets:read` permits preview
and current-sheet reads; `housekeeping.sheets:generate` permits the deliberate write.
Tenant, property, actor, room set, cadence, occupancy, task state and task identity are
server-derived. Weekly/custom/missing/mixed/ambiguous cadence, foreign or inactive
staff and hostile property/actor ids create no sheet, task, fact, outbox or
idempotency artifact. The capability cannot mutate task lifecycle, room condition,
reservation, segment, occupancy, financial, business-day, key or statutory truth.

### Departure-readiness read containment

The Order-203 query is reachable only after the HTTP adapter proves
`stay-operations.checkout:read` and the exact property grant. The domain service then
validates exact lowercase UUID input and rebinds tenant/property/reservation inside a
transaction-local RLS context. Its single PostgreSQL statement joins only the
authorized reservation to operational segment, room, sanctioned segment occupancy and
reservation folio evidence; foreign or mismatched targets return the same concealed
not-found outcome.

The deeply frozen response excludes Party, contact, identity-document, reservation
note and payment-instrument data. It returns only operational identifiers, room code,
period boundaries, folio presentation labels/status/currency and canonical decimal
balance. The query has no mutation capability and creates no fact, outbox or
idempotency evidence. A ready snapshot is not a checkout authorization and cannot
release occupancy, settle/close a folio, close an account or transition reservation or
segment state.

### Governed checkout command containment

The write route is separately protected by `stay-operations.checkout:commit` and the
exact property grant. Its accepted HTTP body is empty; the adapter constructs the
actor-bound `reservation.checked_out` envelope and the domain independently validates
tenant, property, actor, reservation and idempotency identity. Foreign property,
tenant, actor or target authority is concealed and creates no durable artifact.

The command obtains deterministic reservation/segment locks, then locks the one
canonical guest account and every reservation folio only through the existing
owner-mediated financial-row capability. It revalidates the fixed readiness blockers
under those locks. Occupancy is released only through
`ReservationOccupancyService.releaseForSegment`; raw runtime status and occupancy DML
remain denied. Guarded non-lengthening state updates, release, idempotency, fact and
outbox evidence share one rollback boundary, including publication failure and
concurrent settlement or segment-change arbitration.

Facts and events contain minimized operational ids, states, periods, release count and
folio status/balance evidence only. They exclude names, contacts, identity documents,
notes and payment instruments. Checkout has no authority over account/folio state,
ledger, payment, business day, room condition, housekeeping, keys, documents,
statutory or fiscal truth.

### Vehicle-register read containment

The Order-205 read route requires the exact `stay-operations.vehicles:read` scope and
exact property grant before composition. The service independently validates the
server-derived tenant/property identity and executes under transaction-local RLS.
Linked reservation visibility is re-proven against both tenant and exact property;
linked Party visibility is re-proven against tenant. A missing proof fails the entire
read with one bounded association error and never returns the hostile identifier.

The minimized response excludes vehicle notes and `parking_space`, as well as Party
names, contacts, identity records and reservation content. Entry/exit timestamps are
returned only as recorded and convey no inferred onsite, access or security verdict.
Literal plate lookup and canonical keyset pagination do not expand authority. This
read has no write capability and cannot call occupancy, parking, vehicle lifecycle,
task, fact, outbox or idempotency paths.

### Vehicle-register exact-detail containment

Order 216 reuses `stay-operations.vehicles:read` and the exact server-derived property
grant for one no-query vehicle UUID route. The service independently validates the
server tenant, property and vehicle identities inside transaction-local RLS, then
re-proves a linked reservation against the same tenant and exact property and a
linked Party against the same tenant. Missing, foreign and wrong-property identities
are concealed as not found. A hostile stored association fails the entire read as a
bounded conflict without returning the foreign identifier or partial vehicle data.

The no-store response is re-minimized to the already approved vehicle-register row:
literal registration, nullable make/model/colour/driver, optional reservation/Party
identifiers and literal entry/exit timestamps. It excludes notes, parking or space
truth, names or contacts, occupancy, tasks, access decisions and inferred onsite
state. The route has no mutation, polling or generic vehicle authority.

### Arrival-travel board containment

Order 206 reuses the existing reservation-board route, exact property grant and
`reservations.lifecycle:read` scope; it creates no travel-specific authority. The
domain query remains inside transaction-local tenant RLS, selects only
`travel_detail.direction='arrival'`, and re-proves an optional pickup-task reference
against both the active tenant and exact property. A missing, cross-tenant or
cross-property association fails the entire read with a bounded conflict and does not
return the hostile identifier.

The deeply frozen nested projection contains only validated literal mode, nullable
carrier/service/schedule, pickup-requested and association-presence values. It excludes
travel/task ids, notes, task state/assignment/payload, departure travel, Party/contact
data and inferred pickup outcome. Its joins do not change the existing created-at/id
keyset order, filters, cursor bytes or limit, and the read has no mutation, fact,
outbox, idempotency, occupancy, queue or task capability.

### Departure-travel board containment

Order 207 reuses that same reservation-board route, exact property grant and
`reservations.lifecycle:read` scope; it creates no departure- or travel-specific
authority. The domain query remains inside transaction-local tenant RLS and selects
only the row whose tenant, reservation association and
`travel_detail.direction='departure'` match the already-authorized board row.

The deeply frozen nested projection contains only validated literal mode and nullable
carrier, service number and scheduled instant. It excludes pickup/drop-off meaning,
pickup flags, travel/task ids, notes, task state/assignment/payload, Party/contact,
vehicle/parking and inferred transport outcome. Arrival stays a separate projection.
Neither join changes the existing created-at/id keyset order, filters, cursor bytes or
limit; repeated reads are mutation-free and have no fact, outbox, idempotency,
occupancy, task, queue or travel-write capability.

### Governed reservation-travel capture

Order 212 adds one fixed-search-path `SECURITY DEFINER` capability for the exact
arrival/departure resource command. It admits only a `yellow_runtime` session that has
assumed `app_role`, executes as `yellow_owner`, and matches the transaction-local
tenant context. The capability independently re-proves the active actor, exact property,
exact reservation and a modifiable reservation state while locking reservation and
travel truth. Direct app-role and runtime `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE`
authority on `travel_detail` remains denied.

Create requires expected absence; replacement requires exact normalized tuple evidence.
The capability refuses stale evidence, all-empty desired truth, departure pickup intent,
wrong property/tenant/state and a changed row already linked to pickup work. An existing
task reference must resolve in the same tenant and exact property even for an exact
no-op. The command cannot accept or return notes or task ids, cannot mutate tasks, and
cannot touch Party/contact, vehicle/parking, occupancy, financial or statutory truth.
Only a changed tuple is coupled to one actor-bound fact and one same-transaction outbox
event; idempotency, fact and event publication roll back with the travel write.

### Governed arrival pickup-task automation

Order 213 adds one fixed-search-path owner capability for the specialized durable
consumer. Only a `yellow_runtime` session that assumed `app_role` under the exact
transaction-local tenant may execute it. The capability independently locks and
re-proves active actor, exact property, exact `reserved|due_in` reservation and its
current arrival row. It creates only the canonical minimized transport guest-request
task and links only that newly created same-tenant, same-property task. Raw runtime
and app-role `task` and `travel_detail` write authority remains denied.

The consumer never trusts source payload identity or eligibility. Its marker, task,
link, fact and outbox event share one transaction, so crashes and concurrent drainers
cannot duplicate work. Foreign tenant/property/association, false pickup, missing
schedule, terminal state and an existing link are no-op or fail closed. No capability
exists here to mutate task lifecycle, assignee, priority, travel, Party/contact,
vehicle/parking, occupancy, finance or statutory truth.

### Reservation-scoped pickup-task detail containment

Order 215 adds one read-only route behind the existing
`reservations.lifecycle:read` scope and exact property grant. The adapter rejects any
query authority and validates all three path identities before a tenant transaction.
The domain read independently re-proves the exact reservation, its current arrival
link and the complete canonical transport-task shape. Foreign, stale, wrong-property
or unlinked task identity is concealed as not found; a hostile currently linked row
fails closed as conflict without disclosing partial task data.

The response is re-minimized to reservation/task identity, confirmation number,
canonical status and task timing only. It excludes payload, Party/contact/assignee,
notes, driver, vehicle, dispatch, property/tenant identity and internal transport
details. Every result is no-store. No generic task scope, cross-kind lookup, polling
or task lifecycle command is introduced.

### Room-condition board containment

Order 208 adds one read-only route behind the existing
`housekeeping.tasks:read` scope and exact property grant. The HTTP adapter accepts
only one optional literal condition, one canonical opaque cursor and a bounded limit;
duplicate, malformed and extra query authority is rejected. Missing grants and
foreign properties are concealed before the service read. Every response, including
failure, is `Cache-Control: no-store`.

The domain read independently rebinds the server-derived tenant and exact property
under transaction-local RLS and selects only active physical rooms with canonical
condition truth. The adapter re-minimizes the response to room id, code, floor,
condition and update instant. It cannot disclose updater identity, task/assignee,
occupancy, reservation/guest, OOO/OOS, readiness, source/reason or inferred status.
The Order-208 read itself has no condition-write authority, task transition,
condition, space, occupancy, reservation, fact, outbox or idempotency capability.

### Governed initial room-condition containment (migration 0030)

Migration 0030 adds one fixed-search-path owner-mediated, insert-only capability for
an absent `unit_condition`. It admits only the dedicated runtime/app-role context,
transaction-local tenant, active actor, exact property and one active same-property
space. The parent space is locked before absence is proved, so concurrent first
writes converge to one insert while every existing condition fails as a stale
conflict. Only `clean`, `dirty` and `pickup` are accepted; `inspected` remains reserved
for governed verification. `PUBLIC`, direct-login execution and raw runtime
`INSERT`, `UPDATE`, `DELETE` and `TRUNCATE` remain denied.

The separate exact-property `housekeeping.conditions:initialize` permission grants
only this bounded first write. Tenant, property, actor, updater, timestamp and prior
absence are server-owned. Actor-bound idempotency, the condition insert, one minimized
`unit.condition_changed` fact and one matching outbox event commit in the same
transaction. The capability cannot read or mutate tasks, reservations, check-in,
occupancy, OOO/OOS, financials, business days, documents or statutory state.

### Housekeeping-task exact-detail containment

Order 217 adds one read-only exact-task route behind the existing
`housekeeping.tasks:read` scope and exact property grant. The adapter rejects every
query parameter and validates both path identities before the service read. Missing
scope is forbidden, while an ungranted property and concealed task identity share the
same not-found boundary.

The domain read independently re-proves an eligible housekeeping task, its active
physical room and canonical room-condition truth under tenant-local RLS. Ambiguous or
hostile stored shape fails closed as conflict without returning partial detail. The
adapter explicitly re-minimizes the result to the Order 217 task fields, excludes
assignee identity, payload, notes, guest, reservation, occupancy and financial data,
and makes every response no-store. The human route serves the existing operator shell;
it adds no transition, assignment, mutation, polling or generic task authority. The
Order 201 board and lifecycle actions remain unchanged.

### Governed arrival pickup-task dispatch containment (migration 0031)

Migration0031 adds one fixed-search-path owner-mediated capability callable only by
the dedicated `yellow_runtime` session after it assumes `app_role` with an exact
transaction-local tenant. The capability locks and re-proves active actor, exact
property/reservation/arrival link, complete canonical Order213 task shape and current
expected status/assignee evidence. Assign also re-proves an active same-tenant Party
with an exact `staff` role. `PUBLIC`, direct-login execution and raw runtime task DML
remain denied.

Assignment and work use separate exact-property scopes. Both the HTTP adapter and
domain capability bind the task to the reservation-scoped arrival link; knowing a
task UUID cannot create generic task authority. Actor-bound idempotency, task update,
one minimized fact and one matching outbox event commit atomically. Foreign, stale,
hostile and non-adjacent requests write nothing, and no contact, note, payload,
driver, vehicle, parking, occupancy, financial, business-day or statutory data is
accepted or returned.

### Governed arrival room-cleaning task containment (migration 0032)

Migration0032 adds one fixed-search-path owner-mediated create-or-return capability.
It is executable only by the dedicated `yellow_runtime` session after assuming
`app_role`, with `yellow_owner` as current definer and an exact transaction-local
tenant. The capability re-proves an active actor, due-in reservation, unique current
booked segment, unique active mapped room, canonical `dirty|pickup` condition and one
selected active same-tenant Party carrying the `staff` role. A room-scoped advisory
transaction lock serializes actionable-task discovery and creation. `PUBLIC`, direct
login and raw runtime `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE` on `task` remain
denied.

Candidate read and creation have separate exact-property permissions:
`housekeeping.arrival-tasks:read` and `housekeeping.arrival-tasks:create`. The HTTP
adapter accepts no query, validates canonical path/body identities and conceals
ungranted properties and ineligible targets behind not-found. The create body admits
only an attendant Party id; tenant, property, actor, reservation, room, condition,
task shape, due time and provenance remain server-owned. Knowing a reservation, room
or task UUID does not confer generic task authority.

Actor-bound idempotency, at-most-one task creation, one minimized `task.created` fact
and one matching outbox event commit atomically. One existing assigned/in-progress
exact-room housekeeping task is returned without mutation or evidence; multiple
actionable tasks fail closed. Open, done, verified, cancelled and unrelated tasks are
never adopted. Guest/contact/note/payment/statutory data is absent from the stored task
payload and the HTTP candidate. The capability cannot mutate room condition,
reservation, segment, occupancy, check-in, folio, financial, business-day, key,
travel, vehicle, parking or statutory truth.

### Governed due-in room-assignment containment (migration 0033)

Migration0033 adds one fixed-search-path owner-mediated assignment capability
executable only by the dedicated `yellow_runtime` session after it assumes `app_role`,
with `yellow_owner` as current definer and an exact transaction-local tenant. The
capability locks and re-proves active actor, exact-property due-in reservation, its
one latest booked segment, expected unit type and period, prior null assignment, zero
segment occupancy claims and one selected active same-property/same-type sellable unit
mapping to exactly one active physical room. `PUBLIC`, direct-login execution and raw
runtime reservation-segment or occupancy DML remain denied.

Candidate read and command reuse the existing exact-property
`reservations.segments:read` and `reservations.segments:write` permissions. The HTTP
adapter accepts no query, validates canonical path/body identities and conceals
ungranted properties and ineligible targets behind not-found. Tenant, actor, property,
reservation status, segment status, occupants, availability, mappings and condition
meaning remain server-owned. Candidate output is minimized to sellable/physical room
identity plus nullable current condition evidence; it contains no guest, contact,
price, hold or occupancy detail.

Actor-bound idempotency, the only sanctioned occupancy claim, null-to-selected
assignment and minimized existing `occupancy.recorded`/`reservation.modified`
fact/outbox evidence commit atomically. Stale, foreign, previously assigned or claimed
truth writes nothing; concurrent requests converge to one assignment and exact replay
adds no effect. The capability cannot infer or mutate room condition/readiness, run
check-in, move/split a segment, select an alternate automatically, or affect tasks,
folios, identity, money, business day, statutory, vehicle, parking or queue truth.

### Property-local due-in roll containment (migration 0034)

Migration0034 adds only `runtime_due_arrival_scopes(integer)`: a stable,
fixed-search-path `yellow_owner` capability executable by `yellow_runtime`, not
`PUBLIC` or `app_role`. It validates a 1–1000 limit and returns bounded distinct
tenant/property UUID pairs whose `reserved` parent and latest `booked` segment are due
on `(transaction_timestamp() AT TIME ZONE property.timezone)::date`. It returns no
reservation, segment, guest or stay detail, reads no `business_day`, and grants the
runtime login no direct reservation, segment, property or day-table access and no
transition capability.

For each discovered scope the worker enters the ordinary transaction-local tenant and
`app_role` boundary, then locks/revalidates exact-property parent and latest-segment
truth. Existing column-scoped parent-status authority changes only `reserved` to
`due_in`; the segment remains unchanged. Parent status, minimized fact/outbox evidence
and actor-bound idempotency commit or roll back together. Bounded batches,
`SKIP LOCKED`, deterministic replay and guarded status make contention converge once.
Foreign, future, past, missing/incoherent and non-reserved truth fails closed. The
worker is explicit opt-in and exposes no HTTP/operator command, catch-up, no-show,
check-in, occupancy, assignment, condition, task, folio, financial, statutory or
business-day mutation authority.

### Property-local due-out roll containment (migration 0035)

Migration0035 mirrors that boundary with only
`runtime_due_departure_scopes(integer)`: a stable fixed-search-path
`yellow_owner` capability executable solely by `yellow_runtime`. It returns bounded
tenant/property UUID pairs whose coherent `in_house` parent and latest `in_house`
segment depart on the transaction-stable stored-property local calendar date. It
returns no reservation, segment, guest, folio or room detail and grants no direct table
read or transition authority.

The ordinary tenant transaction re-proves and locks the complete shape, changes only
the parent to `due_out`, and commits minimized existing fact/outbox/idempotency
evidence atomically. The segment and occupancy remain unchanged; foreign, future,
past, missing and incoherent truth fails closed. The explicit opt-in worker adds no
checkout, occupancy-release, finance, day, condition, task, identity, statutory or
operator-command authority.

### Room discrepancy reporting containment (migration 0036)

Migration0036 exposes one volatile, fixed-search-path `yellow_owner` capability for
create-only room discrepancy classification. `PUBLIC` and `yellow_runtime` cannot
execute it directly; only a `yellow_runtime` session that has entered transaction-
local `app_role` under the exact tenant context can call it. The capability rechecks
session user, assumed role, current definer, tenant context and active actor, then
locks and derives exact-property room, mapping, reservation/segment and exclusive
occupancy truth. Browser or caller input never owns system presence, expected persons,
kind, timestamps or evidence.

`app_role` retains SELECT but no raw INSERT, UPDATE, DELETE or TRUNCATE authority over
`discrepancy`. The capability admits only one active physical room with one exclusive
mapping and coherent current truth; positional, shared, composite, inactive, foreign,
ambiguous and multiply occupied shapes fail closed. One unresolved room row is the
concurrency boundary. The surrounding tenant transaction commits it with one
minimized fact/outbox pair and actor-bound idempotency, or rolls everything back.
Matching truth writes nothing. This authority cannot resolve/carry/delete a
discrepancy or mutate condition, task, reservation, segment, occupancy, finance,
business-day or statutory truth.

### Vehicle parking assignment containment (migration 0037)

Migration0037 exposes one volatile, fixed-search-path `yellow_owner` capability.
`PUBLIC` and `yellow_runtime` cannot execute it directly; only a `yellow_runtime`
session that has entered transaction-local `app_role` under the exact tenant context
can call it. The capability rechecks session user, assumed role, current definer,
tenant context and active actor, then locks and re-proves the exact-property vehicle,
linked current stay, capacity-one parking space and occupancy truth.

`app_role` and `yellow_runtime` retain no raw vehicle mutation authority, and direct
`space_occupancy` DML remains denied. Caller-owned period, segment, claim, stay state,
registration or property truth is rejected. The capability can create only one
exclusive parking claim through `record_occupancy()` and bind one previously
unassigned vehicle. The ordinary six-argument recorder remains unchanged; its
vehicle-validating overload is owner-private. The canonical release name validates
parking parents, clears matching vehicle pointers and delegates all non-parking
typed parents to an owner-only invoker helper, so no additional public delete path is
created. The assignment cannot replace, manually release, enter, exit, delete or mutate any
other vehicle, stay, room, financial, business-day or statutory truth.

## 6. Statutory & privacy

### Quoted-tax hold binding containment

Order248 accepts no caller price, quote hash, snapshot or tax total. It re-normalizes
the complete quote input, acquires the exact rate-plan publication advisory lock and
requires a fresh exact-property/sellable bookable quote with complete calculated tax
before any mutation. The existing hold and attribution services remain the only
occupancy and snapshot writers; runtime cannot insert, update, delete or truncate the
new binding root directly.

The owner-mediated binding capability rechecks active-tenant property, actor, cart
hold and attribution identity and emits only minimized ids/hashes/currency. Outer
idempotency, root creation, fact and outbox share one rollback boundary. Expired or
released holds do not delete evidence, and no binding reader or writer gains
reservation, financial posting, document or fiscal-submission authority.

### Token-only payment containment

Runtime may select and insert only the enumerated columns on payment operations,
attempts and provider receipts; update/delete/truncate remain denied. Every new table,
key, index, RLS policy and reference is tenant-leading. The only provider credential is
an opaque active instrument token delivered directly to the provider port in memory.
PAN, CVV, raw callbacks and secrets are forbidden from source, schema, seeds, logs,
facts, outbox and reconciliation storage. Operation and financial-row locks serialize
money decisions; receipts and effects commit atomically.

Hosted deposit links add a bearer surface without adding payment credentials. The
256-bit raw bearer is shown once, is sent only in the guest URL, and is never persisted,
logged, emitted, cached, stored by browser APIs or forwarded to the provider origin.
Provider handoff and callback use non-secret correlation plus bounded, expiring HMAC
signatures; callback verification covers exact raw bytes and path before parsing.
Guest/provider pages are same-product but separate origins with no-store/no-referrer,
strict CSP, no cookies and no third-party assets. Operator creation, status and
application retain separate scopes and exact property grants.

- Identity data retention per country config; scheduled anonymisation after the
  legal window. Erasure = anonymise party, preserve financial rows (GDPR
  Art. 17(3)(b)) — TC-8.5.
- Statutory submissions logged with receipts; transport per adapter (SFTP host
  keys pinned, REST over TLS).

## 7. Ops & incident basics

- Secrets: .env files never committed; per-environment; rotated on offboarding
  (it's two founders — still write it down).
- Access: SSH via Cloudflare Tunnel + key auth only; no password SSH; no shared
  accounts.
- Incident: severity ladder + a one-page playbook (isolate → snapshot → rotate →
  notify affected tenants per contract/law). Draft the tenant-notification
  template BEFORE you need it.
- Audit trail: every mutation carries actor + correlation id (kernel envelope);
  fact_log + insert-only financials make tampering evident.

## 8. What we deliberately do NOT do (yet)

- No SOC 2 audit pre-revenue (controls above are SOC-2-shaped so the audit is a
  documentation exercise later — enterprise trigger).
- No WAF beyond Cloudflare free rules; revisit at first attack pattern.
- No field-level encryption beyond identity docs; revisit with first Gulf
  enterprise contract.

### India GST supplier current-status containment (Order 289)

The exact ten-column snapshot is tenant-leading, same-tenant FK-bound to the approved
supplier registration, forced-RLS protected and granted only SELECT to `app_role`.
INSERT, UPDATE, DELETE and TRUNCATE remain owner-mediated and denied at runtime. The
resolver first reconstructs and rehashes complete Order284/272 lineage, then performs
one equality-only id/date/registration/hash read under the caller transaction.

No live GST Portal request, latest/nearest query, server clock, GSTIN/address fallback
or Form-G/Form-F2 substitution exists. The explicit date is evidence time only and
cannot select or prove statutory time of supply. Canonical input/row validation,
tenant-bound hashing, recursive freeze and zero-write rejection contain proxy,
accessor, duplicate, cross-lineage and stale-date attacks. The root grants no current
LoA, supply-nature, zero-rating, tax, document, API or UI authority.

### India GST accommodation service-provision-date containment (Order 290)

The exact 15-column snapshot is tenant-leading, exact-composite-FK-bound to the
complete Order252 reservation/first-segment posting-identity tuple, protected by
forced RLS and granted only SELECT to `app_role`. PUBLIC, `yellow_runtime` and
`app_role` receive no INSERT, UPDATE, DELETE or TRUNCATE authority. No application or
runtime writer, ingestion command, operator identity, attestation workflow or network
source lookup is admitted; deployment fixtures may stand only for already governed
external evidence.

The resolver accepts one exact plain five-key input and first reconstructs and
rehashes the complete Order252 lineage, then independently reparses the canonical
Order240 attribution and requires exact `rate_quote`/`room`/`room_revenue` plus
quote/snapshot/currency coherence. Only then may an equality-only tenant/property/
reservation/root-id/date read return the exact source
`governed_service_provision_record`, legal literal
`CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY` and evidence digest. Strict row
shape, finite-date and hash checks, deterministic tenant-bound hashing, fixed-order
recursive freeze and zero-write failure contain proxy/accessor/symbol, duplicate,
cross-tenant, cross-lineage and stale-hash attacks while keeping tenant identity
unexposed.

No latest, nearest, server clock or fallback participates. Order287 `supplyDate`, the
Order240 room-night `businessDate`, Order252 planned period, reservation arrival or
departure, check-in, occupancy, checkout, journal and posting dates may neither derive,
substitute for nor be compared with the root date. The result is evidence input only:
it does not decide CGST section 13 time of supply and grants no invoice, payment, tax,
item, posting, document, submission, API, UI or local-runtime authority.

### India GST accommodation payment-receipt-date containment (Order 291)

The exact twelve-column payment-receipt snapshot is tenant-leading, forced-RLS and
bound by the exact service-provision root to the complete Order290→Order252→Order240
property/reservation/first-segment/attribution lineage. `PUBLIC`, `yellow_runtime` and
`app_role` receive no INSERT, UPDATE, DELETE or TRUNCATE authority; `app_role` is
SELECT-only. No application writer, ingestion command, bank/provider lookup, operator
attestation or payment allocation workflow exists.

The resolver accepts only the exact plain six-key input
`{tenantId,propertyNode,reservationId,serviceProvisionSnapshotId,
paymentReceiptSnapshotId,paymentReceiptDate}`. It reconstructs complete lineage,
reparses canonical `rate_quote` / `room` / `room_revenue` attribution, and requires
full positive amount, matching currency, exact ids/hashes, source and legal literal
before an equality-only read. It returns both statutory dates and requires
`payment_receipt_date = LEAST(supplier_books_entry_date,
supplier_bank_credit_date)`.

Exact source `governed_supplier_payment_receipt_record`, lowercase evidence SHA-256,
and legal literal `CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY` are
mandatory. Missing, duplicate, malformed, cross-tenant, cross-property,
cross-reservation, cross-service-root, cross-attribution, stale-hash, wrong
amount/currency, partial coverage, one-source-only and shape/proxy/accessor/symbol
attacks fail closed. Fixed ordering, recursive freezing, deterministic tenant-bound
hashing and zero-write behavior contain replay and result tampering without exposing
tenant identity.

Payment-operation/provider-receipt, journal/posting, folio, reservation, invoice,
voucher, settlement, refund, reversal, business-day, operational and clock dates are
not statutory source substitutes. No latest, nearest, fallback or inference is
allowed. This root is evidence input only: it computes no section 13 result and
grants no payment, invoice, voucher, tax, item, posting, journal, document,
submission, API, UI or local-runtime authority.

### India GST accommodation invoice-issue-date containment (Order 292)

The exact twelve-column invoice-issue snapshot is tenant-leading, forced-RLS,
SELECT-only and bound through Order290 to complete Order252→Order240 lineage.
`PUBLIC`, `yellow_runtime` and `app_role` receive no mutation authority. The
resolver accepts only the exact plain eight-key shape, independently rechecks the
lineage and canonical `rate_quote`/`room`/`room_revenue` attribution, and requires
full positive amount, matching currency, exact series/serial/date, source, legal
literal and lowercase evidence SHA-256. Source is exactly
`governed_supplier_tax_invoice_record`; legal literal is exactly
`CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY`.

Duplicate, missing, malformed, partial, stale, mixed-lineage, cross-tenant,
identity, amount/currency or shape evidence fails closed. No writer, ingestion,
network lookup, document rendering or invoice-number allocation exists. Series,
serial and issue date are evidence only: generic documents, folio, journal, posting,
payment/provider, reservation, service-provision, room-night, business-day,
operational and clock dates cannot substitute. No validity, Rule47 regime/deadline,
timely/late or section13 result is computed, and no tax, payment, voucher, document,
IRP, submission, API, UI or local-runtime authority is granted.
