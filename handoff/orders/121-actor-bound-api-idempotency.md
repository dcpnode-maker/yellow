# Order 121 — Bind direct HTTP idempotency to the authenticated actor

**Status:** IMPLEMENTED; independently approved at exact executable SHA `bc27020e8c3f26e9cc68658cab00a2f9ac1929ed` under D-357
**Phase:** 5 · Cyber remediation
**Branch:** `phase-5/actor-bound-api-idempotency`
**Base:** `a2540fdf76f6436f2b59f3d09345b5b054d569c3` (approved Order 120 metadata head)
**Risk tier:** 2 — API authentication/idempotency boundary
**Finding:** sealed Cyber `actorless-api-idempotency`, occurrence
`occ_2160f7211ebce346c54b759e`
**Owner:** Codex implementation; independent non-implementing reviewer required

## Gate and disposition

Order 120 is independently approved at exact executable SHA `0ca144b9eb7ad3dcc13c1cac5931c89560e13448`
and its D-351 approval metadata head is this order's exact base. Implementation is
authorized only within the scope below. No migration, schema, sibling finding, merge,
push, deployment, or live-status work is authorized.

## Outcome

Every direct HTTP-adapter idempotency request hash includes the server-derived,
authenticated `actorId` in addition to the existing tenant, operation, route-resource,
and normalized request body fields. A retry by the same authenticated actor with the
same tenant, operation, key, and body remains an exact durable replay. A different
authenticated actor in the same tenant using the same operation/key/body receives the
existing idempotency conflict rather than replaying or taking over the first actor's
result. Actor identity is never accepted from a request body, query, or client header.

Existing service-layer actor-bound paths remain unchanged; this order closes only the
direct HTTP-adapter boundary. There is no migration or change to the durable
`api_idempotency` schema: the actor is part of the already-hashed canonical request,
not a new stored column.

## Source, control, and sink

- **Source / authority:** `TenantRequestContext.identity.actorId`, populated by the
  verified bearer resolver. Each mutating route already checks the required scope and
  exact property grant before claiming idempotency; the implementation must preserve
  that ordering and must not derive identity from request data.
- **Control / hash boundary:** the `request` object supplied by each direct
  `PostgresIdempotency.execute` call in `src/http/operator.ts`. Add a clearly named
  server-owned actor field (for example `actorId: context.identity.actorId`) to every
  direct adapter request object, including shared helper paths. Keep operation, key,
  transaction, replay response, and canonical JSON behavior unchanged.
- **Sink / durable evidence:** `PostgresIdempotency` canonicalizes and SHA-256 hashes
  the request into `api_idempotency.request_hash`; the existing tenant+operation+key
  claim then compares that hash. Do not add raw actor identity to the table, response,
  key hash, or browser payload.

## Exact scope

### In scope

- `src/http/operator.ts` — include the server-derived actor in every direct HTTP
  adapter idempotency request hash input, including the private rate-builder and
  inventory helper methods and all literal operation call sites.
- `tests/operator-idempotency-actor.integration.test.ts` — new focused authenticated
  HTTP proof (or an equivalently named single focused test file if the current test
  layout requires it) covering same-actor replay and same-tenant/different-actor
  conflict without caller-controlled identity.
- `handoff/orders/121-actor-bound-api-idempotency.md` — this order and final evidence
  only after the required gates.

### Explicitly out of scope

- `src/kernel/idempotency.ts`, `api_idempotency` schema/migrations, retention, key
  hashing, canonicalization, or conflict semantics;
- all context services and commands that already pass actor-bound audit/envelope or
  command inputs (`src/contexts/**`), including their existing idempotency paths;
- `src/http/extensions.ts` (no direct idempotency claim in this adapter), auth/JWT
  claim shape, tenant middleware, scopes, property grants, UI/browser JavaScript,
  response formats, operation namespaces, or route additions;
- any other sealed Cyber finding, security-definer work, container/MCP/login changes,
  financial behavior, ledger, event, occupancy, reservation, party, or product scope;
- migration/schema/product edits and any new decision.

If implementation appears to require a file outside this list, stop and write a
question; do not widen the order silently.

## Required implementation contract

1. Enumerate every `PostgresIdempotency.execute` call reachable directly from the HTTP
   operator adapter (including calls using the private `#create`, `#createRate`, and
   `#runRateBuilderWrite` helpers). Every request hash input must contain the same
   server-owned actor identity for the authenticated request.
2. Preserve the existing operation/key/body/resource fields byte-for-byte in meaning.
   Actor inclusion must be deterministic and use the existing canonical JSON hash; no
   alternate hash, raw key storage, actor column, or actor-controlled input is allowed.
3. Routes with missing actor identity must remain rejected by the existing scope/auth
   narrowing before an idempotency claim; do not introduce an assertion or fallback
   actor. Existing scope and property authorization behavior must remain intact.
4. Same actor + same tenant + same operation + same key + same body/resource returns
   the stored response with `idempotency-replayed: true` and no second mutation.
5. Different actor + same tenant + same operation + same key + same body/resource
   returns HTTP 409 `request/idempotency_conflict`; it must not replay, overwrite, or
   create a second mutation. Tenant B behavior remains governed by existing tenant
   isolation and is not a substitute for the different-actor proof.
6. A changed body/resource for the same actor continues to conflict, and ordinary
   distinct keys/actors retain existing successful behavior. Existing service-layer
   tests and behavior must remain unchanged.

## Red proof (must fail before implementation)

On the exact Order 120 metadata base, use two valid bearer identities in one tenant
with the same authorized property/scope, the same mutating HTTP route, same valid body,
and same `Idempotency-Key`. Prove the current behavior is actorless: actor B receives
the actor A replay (or otherwise does not receive the required 409), while the stored
request hash is identical for both requests. Record the observed route, status,
replay header, mutation/artifact counts, and sanitized hash evidence. The red harness
must not mutate committed files and must use isolated disposable database state.

## Green proof (required after implementation)

Run on a fresh isolated PostgreSQL/database fixture with two authenticated actors in
the same tenant and one authorized property:

- same actor, same key/body: first mutation succeeds; exact retry is 2xx replay,
  `idempotency-replayed: true`, with no additional domain/fact/outbox artifact;
- different actor, same tenant/key/body: HTTP 409 `request/idempotency_conflict`,
  no replay header claiming success, no second domain/fact/outbox artifact, and the
  original actor's stored outcome remains intact;
- same actor, changed body/resource: existing 409 conflict remains;
- actor is taken from the verified bearer identity: body/header/query actor attempts
  are ignored or rejected, and no caller-selected actor enters the hash;
- cross-tenant negative isolation remains green, with no weakening of existing RLS or
  transaction-local tenant setup;
- at least one route using each shared helper family and representative literal
  inventory/rate calls is covered, or a static/exhaustive proof demonstrates every
  direct call includes actorId;
- injected command/publisher failure leaves mutation, fact, outbox, and idempotency
  artifacts rolled back exactly as before;
- typecheck, import-boundary, licence/audit checks, standing tests, schema/protected
  hashes, and the fresh app-never-started 11/11 referee remain green.

The independent reviewer must personally execute the focused red/green actor proof and
verify the exact scope. Builder output alone cannot close this finding.

## Resolved implementation choices

1. The exact route selected for the focused proof may be chosen by the implementer
   from the direct operator calls, provided it is authenticated, mutating, tenant-
   scoped, and uses the shared `PostgresIdempotency` boundary; selecting a route must
   not broaden scope.
2. The focused proof uses the new test file named in Scope. It may construct its own
   isolated fixtures, but must not edit an unrelated existing test to share helpers.

## Completion boundary

This finding is complete only when the current-line implementation is independently
reviewed at its exact executable SHA, the red proof is reproduced on the parent, the
green proof and required standing gates pass, and the coordinator records the review
and integration provenance. No merge, push, deployment, or closure of sibling Cyber
findings is implied.

## Builder evidence — 2026-08-24

The permanent red proof was committed first at
`88648fe49ed59717b16e52edb1cc5971258c53fb` on planning parent
`e54904761b19206727c139a380addcac148867e9` (whose product tree is the exact approved
Order 120 base). Against fresh isolated PostgreSQL, actor A created one unit type and
its exact retry replayed. Actor B then used the same authorized tenant/property,
route, body and key and incorrectly received HTTP 201 rather than 409; the shared
response was a replay, the domain/fact/outbox counts stayed 1/1/1, and the single
stored request hash remained unchanged (sanitized prefix `d1f24534df36`). The focused
red run was 2 pass / 3 fail because both two-actor assertions and exhaustive source
coverage correctly detected the actorless parent.

Exact executable implementation SHA
`bc27020e8c3f26e9cc68658cab00a2f9ac1929ed` adds only the authenticated
`context.identity.actorId` to the existing canonical request object at all sixteen
direct adapter calls. Fresh focused proof passes 5/5 with 54 assertions: same-actor
replay, different-actor 409 with no replay/artifact, changed-body conflict, rejected
body injection, ignored header/query injection, foreign-tenant denial, publisher
rollback/retry, and exhaustive helper/literal-call coverage.

Fresh affected operator proofs passed projection 6/6 (50 assertions), holds 7/7
(48), offline leases 6/6 (70), OOS policy 6/6 (28), restrictions 6/6 (39), rate
builder 11/11 (75), inventory 6/6 (44), rate configuration 7/7 (50), rate pricing
6/6 (39), rate-price correction 7/7 (45), and bulk rooms 6/6 (495). The first
rate-price-correction setup hook timed out before assertions under host load; the
suite restarted from a new migrated database and passed completely without a code,
fixture, timeout or input change.

Standing proof restarted from the top after replacing a disposable `node_modules`
junction, whose zero-package licence result was discarded, with the frozen 23-package
install. The authoritative restart passed 171 tests / 399 skipped / 0 failed with
1,952 assertions, typecheck, 64-file import boundaries, licences for 23 installed
packages, and dependency audit with no vulnerabilities. Exact schema drift and
protected hashes passed:
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923` and
`3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`. Isolated
app-never-started setup applied all eleven migrations, produced 85 public tables,
RLS 75/75 and passed the referee 11/11.

Two unrelated inherited runs are disclosed and are not represented as green. The
fifteen-suite cumulative runner stopped after Order 069 P8 exceeded its 15-second
host timing budget at 20.8 seconds, the already-recorded D-338 performance debt; no
Order 069 file was changed or retried. Fresh Order 053 passed its six product cases
then its old P7/P8 fixture expected 17 permissions against the approved 27-scope
review seed. Question 142 and fixture-only Order 125 isolate that mismatch; Order 121
does not claim the Order 053 suite green.

This is builder evidence only. The sealed actorless-idempotency finding remains open
until an independent non-implementing reviewer reproduces the parent red and approves
this exact executable SHA. No merge, push, deployment, live status, sibling closure,
or Order 125 implementation is claimed.

## Independent review — 2026-08-24

An independent non-implementing Tier-2 reviewer APPROVED exact executable SHA
`bc27020e8c3f26e9cc68658cab00a2f9ac1929ed` with no implementation or scope
finding. The reviewer personally reproduced the exact-parent authenticated
same-tenant/different-actor 201 replay, passed the exact-SHA focused proof 5/5 with 54
assertions, enumerated all sixteen server-derived actor hash inputs, passed pristine
representative shared-helper and literal-route suites, standing 171/0, typecheck,
64-file boundaries, installed-tree licences 23, clean audit, exact schema/protected
hashes and a fresh 85-table referee 11/11. Full evidence is recorded in
`handoff/reviews/121-actor-bound-api-idempotency.md`. Approval closes only the named
Cyber finding; inherited Order 069 timing and Question 142 / Order 125 fixture debt
remain open. No merge, push, integration, deployment, live status or sibling closure
is implied.
