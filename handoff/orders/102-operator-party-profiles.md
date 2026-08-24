# Order 102 — Operator Party search/create and booking handoff

**Phase:** 4  
**Branch:** `phase-4/operator-party-profiles`  
**Base:** `41d9356`  
**Risk tier:** 3 — tenant PII, property authorization and identity creation  
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Make independently approved Order 101 usable by staff inside the existing reservations
workbench. An authorized operator can search tenant Parties through one property-scoped
HTTP adapter, inspect only masked contact hints, deliberately select an existing Party
for booking, or create a canonical Party after reviewing the server's exact duplicate
evidence. The selected server Party id flows into the already approved offer/hold/commit
journey; the browser never creates a guest/profile shadow record or gains reservation,
occupancy, merge or verification authority.

## Natural-Solution Test

The canonical `PartyProfileService`, tenant middleware, property grants, operator shell,
idempotency kernel and reservation booking form already exist. The natural solution is
two adapter routes, two least-privilege permissions and one progressive Party panel that
hands an existing Party id to the booking form. No migration, table, state, event, entity,
client store or alternate booking command is needed.

## Scope

- `src/http/operator.ts`, `src/app.ts`, `src/server.ts`
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`
- `scripts/seed-review.ts`
- `tests/operator-party-profiles.integration.test.ts`,
  `tests/operator-assets-security.test.ts`, `tests/operator-holds.integration.test.ts`,
  `tests/review-seed.integration.test.ts`
- `docs/CONTRACTS.md`, `docs/research/CAPABILITY-MATRIX.md`
- `src/project-status.ts`, `tests/founder-status.integration.test.ts` only after green
- this order, `handoff/PHASE-4-PLAN.md`, `handoff/LEDGER.md`, `DECISIONS.log`,
  `handoff/questions/`, and the independent review record

## Required work

1. Add exact `crm.parties:read` and `crm.parties:write` permissions to the
   deterministic local-review role and its exact-role proof. They authorize Party data,
   not reservation, merge, verification, consent, payment or identity-document behavior.
2. Compose the approved `PartyProfileService` in the production root. Add
   `POST /api/v1/properties/{property}/parties:search` and `POST` on the Party
   collection. Both require an authenticated actor, the matching scope and an exact
   property grant before the tenant-wide Party operation; tenant comes only from the
   transaction. Search accepts an exact body with `query` plus optional integer limit,
   keeps PII out of URLs/history, and returns the Order 101 profile shape with masked contacts.
3. POST accepts only Order 101's kind, normalized names, bounded explicit roles/contacts
   and sorted acknowledged duplicate ids. The idempotency key comes only from the header;
   actor, tenant, property, request id and `party.created` operation are server-derived.
   Successful creation returns 201 and exact replay metadata. Domain validation remains
   400; exact masked duplicate review is a stable 409 response carrying candidates;
   no raw contact is added to problem/evidence bodies.
4. Add a progressively disclosed **Find or create Party** panel before offer search.
   Search results are keyboard-selectable, announce result counts, show names/roles and
   masked hints, and provide an explicit “Use for reservation” action that fills the
   booking Party id from server output. Create exposes the canonical kind, name, roles
   and email/phone/WhatsApp fields without documents, DOB, nationality, address, consent,
   verification or payment fields.
5. On 409, show the complete current masked candidate set with two deliberate paths:
   select an existing candidate, or confirm creation of a distinct Party by acknowledging
   the exact displayed ids and retrying the same pending command/idempotency key. Never
   auto-select, auto-merge, or convert a masked hint back into identity data.
6. Party search/create and duplicate state is memory-only, cleared on property change and
   sign-out, and protected by captured property/generation guards so late old-property
   responses cannot repaint or fill a booking. No local/session storage, cookie, URL,
   console, analytics or DOM data attribute retains raw contact input.
7. Preserve the complete destination: Party editing, merge/anonymisation, addresses,
   documents, preferences/consent, cross-source links, guest-360 and public booking remain
   later bounded work; the panel must name these boundaries honestly.

## Forbidden

- A guest/person/profile shadow table or browser-owned Party id; direct Party SQL in HTTP
- Caller tenant/actor/property authority, scope reuse from booking/guest allocation, or
  read implying write
- Auto-merge, automatic duplicate acknowledgement, hidden candidate selection, fuzzy
  contact matching, contact verification, or exposing raw contacts in search/evidence
- Inline reservation commit, hold, occupancy, payment, deposit, tax, folio, journal,
  document or fiscal behavior in the Party adapter
- New schema/state/event/role kind, editing `migrations/0001_init.sql`, or files outside Scope
- Browser persistence of token/Party/contact/duplicate data, stale cross-property repaint,
  inaccessible result actions, self-review or self-merge

## Pre-registered proof

### P0 — intentional red

Commit a focused asset canary before implementation. It fails because the operator shell
has no `party-profile-search-form`, result list or create/duplicate-review controls.

### P1 — strict search adapter

Fresh PostgreSQL proves authorized UUID/name/email/phone search, deterministic limit and
masked serialization through real HTTP. Missing/wrong read scope, malformed/extra body,
foreign property and tenant B fail without leaking Party existence. Search writes no fact,
event or idempotency row, and no search PII appears in the request URL.

### P2 — create, duplicate review and replay

Strict person/org creation persists normalized Party/roles/contacts plus exact non-PII
fact/event. Exact replay is byte-equivalent; changed request conflicts. A matching first
or later contact returns stable sorted masked candidates and no artifacts; selecting an
existing candidate writes nothing; explicit exact acknowledgement creates a distinct
Party. Event failure rolls Party/evidence/idempotency back and same-key HTTP retry wins.

### P3 — authority and hostile boundaries

Read-only can search but cannot create; write-only cannot search; wrong property, foreign
tenant evidence, missing/invalid keys, unknown fields, raw server-owned verification/PII
fields and malformed roles/contacts fail before mutation. The exact local role includes
all prior permissions plus only the two new Party scopes.

### P4 — accessible server-authoritative journey

Asset and extracted-production canaries prove labelled 44px controls, keyboard/focus
behavior, live result/duplicate announcements, explicit existing-vs-distinct choices,
server Party-id handoff into booking, property/sign-out clearing and stale search/create
response rejection. Static/runtime checks forbid token/contact persistence, auto-merge,
browser duplicate authority and any booking/occupancy/financial shortcut.

### P5 — project gates

Focused HTTP/assets plus inherited Order 101 and booking proofs, review seed, typecheck,
boundaries, standing suite, deployment/schema/protected hashes, licences/audit and fresh
84-table referee pass. A non-implementing reviewer personally executes P1–P4 on fresh
PostgreSQL and approves.

## Definition of done

- [x] Order exists before implementation.
- [x] Intentional P0 red is committed before production code.
- [x] Search/create routes are strict, least-privilege and tenant/property safe.
- [x] Duplicate review is explicit, masked, exact and artifact-free.
- [x] Booking receives only a deliberately selected server Party id.
- [x] Accessible UI clears stale/sensitive memory and has no client authority.
- [x] Standing/referee gates pass and scope is exact.
- [ ] Independent reviewer approves executed proof.
