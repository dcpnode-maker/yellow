# Independent review — Order 102 operator Party profiles

**Result:** APPROVED

**Reviewed tip:** `4e55818`

**Implementation base:** `41d9356`

**Reviewer:** independent non-implementing Codex reviewer

**Date:** 2026-08-24

The reviewer did not implement Order 102. Static inspection of the exact
`41d9356..4e55818` diff found scope exact to the order. The change composes the already
approved Party domain behind two strict property-scoped operator routes, adds only
`crm.parties:read` and `crm.parties:write` to the deterministic review role, and adds
the progressively disclosed Party search/create panel before the approved booking
journey. It adds no schema, entity, state, event, Party-domain mutation, reservation
command, occupancy, payment or fiscal behavior.

The HTTP adapter rejects malformed or unknown fields, checks the distinct requested
scope and exact property grant before invoking the tenant-bound Party service, and
derives tenant, actor, property, request id, operation and idempotency key from server
authority. Search PII travels only in a no-store POST body. Search writes no artifacts;
create delegates to the approved transactional Party service. Duplicate review returns
only the domain's sorted masked candidates, and the same pending idempotency key is
retained only for explicit acknowledgement retry. Validation, conflict and service
errors do not echo raw contacts or private exception text.

The browser uses safe text APIs, never persists tokens, Party/contact or duplicate data,
and fills the readonly booking Party field only after an explicit action on a server
profile or masked candidate. It never calculates duplicate authority, verifies a
contact, merges a Party, or invokes booking/occupancy/financial effects from the Party
adapter. Search and create capture property plus generation; late responses are
discarded. Property change and sign-out clear query/contact inputs, duplicate evidence,
pending create key/draft, selected Party and dependent offer/hold/commit state. Result,
duplicate and selected-state focus/live announcements, 44px controls, responsive layout
and reduced-motion behavior remain present.

On fresh disposable PostgreSQL project `yellow-order102-review`, port 5509, the reviewer
personally executed:

- `DATABASE_URL=postgres://yellow:yellow@127.0.0.1:5509/yellow_dev npx -y bun@1.3.13 scripts/migrate.ts`
  — migrations 0001–0008 applied successfully on one connection-affine backend;
- `YELLOW_REQUIRE_OPERATOR_PARTY=1 YELLOW_OPERATOR_PARTY_URL=postgres://yellow:yellow@127.0.0.1:5509/yellow_dev YELLOW_OPERATOR_PARTY_PASSWORD=<review-secret> npx -y bun@1.3.13 test tests/operator-party-profiles.integration.test.ts`
  — full real-HTTP P1–P4 passed 8/8, 0 failed, 151 assertions;
- `npx -y bun@1.3.13 test tests/operator-party-profiles.integration.test.ts tests/operator-assets-security.test.ts tests/operator-reservation-booking.integration.test.ts`
  — static Party, asset-security, selected-server-Party handoff, property/sign-out
  clearing, stale search/create guards and inherited booking proof passed 18/18,
  0 failed, 214 assertions; seven database-only cases were intentionally skipped in
  this no-database invocation after passing in the preceding full HTTP run;
- `YELLOW_REQUIRE_PARTY_PROFILES=1 YELLOW_PARTY_PROFILES_URL=postgres://yellow:yellow@127.0.0.1:5509/yellow_dev npx -y bun@1.3.13 test tests/party-profiles.integration.test.ts`
  — inherited approved Party domain passed 8/8, 0 failed, 118 assertions, including
  normalized per-token concurrency, later-email matching, exact acknowledgement,
  replay, publication rollback, corrupt child joins, tenant isolation and PII minimization;
- `npx -y bun@1.3.13 run typecheck` — passed;
- `npx -y bun@1.3.13 run boundaries` — 60 TypeScript files, no violations;
- `npx -y bun@1.3.13 test` — standing suite passed 135, skipped 357 database-gated
  cases, failed 0, with 1,717 assertions across 78 files.

The full HTTP proof personally queried the seeded role and established exact equality
with `REVIEW_PERMISSIONS`; the only `crm.parties:*` permissions were read and write,
with no merge, verify, consent, payment, document or identity authority. It also proved
read-only cannot create, write-only cannot search, ungranted and foreign properties fail
without Party-existence leakage, caller authority and unknown PII fields fail before
mutation, later-email duplicate evidence is stable and masked, exact acknowledgement
creates a distinct Party, replay is byte-equivalent, changed-key content conflicts, and
failure after outbox insertion rolls Party, roles, contacts, fact, event and idempotency
back before same-key retry.

The reviewer inspected the committed D-318/ledger evidence for the remaining project
gates: review seed 11/11, deployment 4/4, exact normalized schema, clean licence/audit
and fresh 84-table invariant referee 11/11. Those surfaces are untouched by Order 102.
Direct diff verification confirms no change to migrations, approved CRM domain, kernel,
state/event/extension contracts, dependency lock, Compose/Docker deployment or
`tests/run_invariants.py`. Migration 0001 SHA-256 remains
`FE2A9FC949C6BACDED3F8D3FC4D14FC596A83EBDE9AEB043EB10845F07B30923`; the referee
SHA-256 remains `3228279BD99A8F9B6AF99748F31D4D4B482A8E627E16D92644D9D859AD8BEFA1`.
The order header's four intentional Markdown hard breaks are the only whole-order
`git diff --check` reports.

The disposable `yellow-order102-review` containers, network and volume were removed.
User-owned `.agents/`, `.codex/hooks.json` and `handoff/chat-archive/` paths were
untouched.

Approval is exclusive to Order 102's two Party operator routes, exact local-review
permissions, accessible memory-only Party selection/create journey and server Party-id
handoff into the existing booking form. It does not approve Party editing, merge,
anonymisation, documents, addresses, preferences/consent, cross-source links, guest-360,
public booking, or any new reservation, occupancy, payment, tax, folio, journal,
document or fiscal behavior.

## Exclusive Order 102 discharge

- 102
