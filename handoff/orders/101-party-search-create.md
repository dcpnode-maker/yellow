# Order 101 — Tenant-safe Party search and create

**Phase:** 4  
**Branch:** `phase-4/party-search-create`  
**Base:** `69242f1`  
**Risk tier:** 3 — tenant PII, migration, duplicate/concurrency boundary  
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Implement the existing CRM `party` aggregate's first public domain surface: bounded
tenant search and idempotent person/organization creation with normalized contact
points, roles and server-recomputed duplicate suggestions. Staff can safely identify
or create the Party needed by reservation commit without inventing a second guest table,
auto-merging identities, or leaking raw contact data into facts/events/search results.

## Natural-Solution Test

The immutable baseline already contains `party`, `party_role`, `contact_point`, RLS and
the trigram name index; `party.created` is already catalogued. The natural solution is
one CRM service over those primitives, two tenant-leading search indexes, the existing
audit/outbox/idempotency kernel, and no new entity/state/event/table.

## Scope

- `migrations/0008_party_search_indexes.sql`
- `src/contexts/crm/index.ts`, `src/contexts/crm/parties.ts`
- `tests/party-profiles.integration.test.ts`
- `tests/database-acceptance.integration.test.ts`, `tests/schema/expected.sql`
- `docs/CONTRACTS.md`, `docs/research/CAPABILITY-MATRIX.md`
- `src/project-status.ts`, `tests/founder-status.integration.test.ts` only after green
- this order, `handoff/PHASE-4-PLAN.md`, `handoff/LEDGER.md`, `DECISIONS.log`,
  `handoff/questions/`, and the independent review record

## Required work

1. Migration 0008 adds only `party_tenant_status_id` and
   `contact_point_tenant_kind_value`, each tenant-leading and safe on existing rows.
2. `PartyProfileService.search` accepts a required 2–120 character query and limit
   1–50. It searches active tenant Party UUID, trigram display name and exact canonical
   email/E.164 phone or WhatsApp, returns deterministic relevance order, roles and only
   masked contact hints. Tenant id is explicitly bound in addition to RLS.
3. `create` accepts person/org, normalized display/legal names, bounded unique roles and
   contact points, a durable idempotency key, audit envelope and the exact sorted Party
   ids the operator acknowledges as possible duplicates. Email is stored trimmed/lowercase;
   phone/WhatsApp require canonical E.164; facts/events contain only Party id, kind,
   roles and contact kinds—never names or contact values.
4. Before duplicate lookup, acquire a transaction advisory lock derived from tenant plus
   normalized identity fingerprint. Candidates are active same-tenant parties sharing
   exact normalized display name or contact. No candidates requires an empty
   acknowledgement; any mismatch raises a duplicate-review error carrying masked,
   deterministic evidence and writes nothing. Concurrent identical creates therefore
   cannot both pass an empty review.
5. Exact acknowledged retry may create a distinct Party; it never auto-merges. Insert
   Party, roles, contacts, fact, `party.created` outbox event and idempotency outcome in
   one transaction. Publisher failure rolls everything back and same-key retry succeeds.
6. Results expose immutable Party id, kind, status, display name, optional legal name,
   roles and masked contacts. Raw contacts remain available only inside authorized CRM
   persistence; generic events, audit facts, idempotent response and duplicate evidence
   carry no raw contact values.
7. Preserve the complete destination: Party merge/anonymisation, identity documents,
   addresses, consent/preferences, profile editing, cross-source identity links and HTTP/
   operator surfaces remain later bounded orders, not silently implemented here.

## Forbidden

- Editing `migrations/0001_init.sql`, adding a table/status/event/role kind, or changing RLS
- A person/guest/profile shadow table, Party auto-merge, fuzzy-contact matching, global
  uniqueness, contact ownership assumptions, or treating reservation guests as Party rows
- Returning/storing raw contacts in search/duplicate/fact/event/idempotency responses;
  identity documents, DOB/nationality/tax ids, addresses, consent or marketing behavior
- Caller tenant/actor authority, direct HTTP/UI mutation, AI identity resolution, or
  bypassing `PostgresIdempotency`, `recordFact` or `EventBus`
- Unbounded search, offset pagination, `%term%` scans, missing tenant predicates, or
  client-asserted duplicate safety
- Any file outside Scope, self-review, self-merge, or claiming Party/CRM completion

## Pre-registered proof

### P0 — intentional red

Commit a focused import/public-surface canary before implementation. It fails because
`PartyProfileService` is absent.

### P1 — canonical search and privacy

Fresh PostgreSQL proves UUID, fuzzy name and exact normalized contact lookup; stable
ordering/limits, role joins and masked hints; no raw contact in returned JSON; query plan
uses the named indexes; tenant B and merged/anonymised parties are absent.

### P2 — duplicate review and concurrency

First matching create raises exact sorted masked candidates with no artifacts. Exact
acknowledgement creates; stale/missing/extra/foreign acknowledgements fail. Twenty
concurrent same-identity empty-review creates produce one Party and nineteen review
requirements, never twenty disconnected profiles.

### P3 — atomic idempotent creation

Person/org creation normalizes fields, roles and contacts; exact replay is byte-equivalent,
changed request conflicts, and only non-PII fact/event payloads persist. Injected event
failure leaves no Party/role/contact/fact/outbox/idempotency artifact; same-key retry wins.

### P4 — hostile boundaries

Malformed names, kinds, roles, contacts, duplicate contacts, limits, keys/envelopes and
foreign tenant evidence fail before mutation. App-role RLS cannot search or acknowledge
another tenant's Party.

### P5 — migration and project gates

Migration ledger 1–8/checksum, exact ACL/schema snapshot, typecheck, boundaries, standing,
licence/audit, protected hashes and fresh 84-table referee pass. A non-implementing
reviewer personally executes P1–P4 on fresh PostgreSQL and approves.

## Definition of done

- [x] Order exists before implementation.
- [x] Intentional P0 red is committed before production code.
- [x] Search is bounded, tenant-safe, deterministic and privacy-minimized.
- [x] Duplicate acknowledgement is server-recomputed and concurrency-safe.
- [x] Creation is atomic, idempotent, audited and emits catalogued non-PII evidence.
- [x] Migration/schema/deployment/standing/referee gates pass.
- [x] Independent reviewer approves executed proof.
- [x] Scope is exact; user-owned untracked material remains untouched.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
