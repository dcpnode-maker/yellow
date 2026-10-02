# BOOKING-20261002 — Published property guest booking

Status: bounded backend implemented and independently native-reviewed; canonical
105/schema/setup proved on owned synthetic targets. Laptop integration pending. The laptop controller
reserved migration0105 under the 20261002 order identifier (execution Oct1); independent native review precedes admission.
The founder explicitly authorized uninvited booking through a staff-published
site binding. Invitation booking is a separate completed backend slice.

Source: 7b64ede37a4ded1ffe2e77295f2d3e95b30442be (reviewed invitation/context successor).
Laptop owns source3039, restored UI, session changes and public hosting.

## Scope

New identity/public-booking-site.ts, reservations/public-booking.ts,
http/public-booking.ts and focused token/domain/HTTP/native tests; relevant context
index exports. Extend the existing guest signer with distinct public purposes;
extract shared quote input/policy fingerprint helpers if necessary, preserving
invitation behavior. Proposed owner SQL is proposed at
handoff/proposals/BOOKING-20261002-public-site-authority.sql and will be admitted as migrations/0105_public_booking_site.sql only after review. Required schema/frontier closure is explicitly recorded in
questions/BOOKING-20261002-public-site-frontier.md: schema snapshot, kernel build
identity, setup/local-review/CI/release literals and matching tests. No gate waivers. App/server hooks are a separate small patch. No frontend/auth/session/
header/ribbon edits, migration104 rewrite, hosting or real business-data writes.

Scoped records: docs/CONTRACTS.md, docs/EVENTS.md, DECISIONS.log,
handoff/LEDGER.md, handoff/contracts/orders/questions/reviews/receipts/proofs and
separate app/server patch, per questions/BOOKING-20261002-public-site-records.md.

## Contract

One explicitly published site per property in existing org_node configuration,
with opaque siteUUID, version, active flag, staff publisher, allowed property plans
and channel. Staff publish/withdraw requires all five invitation issuer scopes
plus crm.parties:write, checked and locked live. Protect this reserved configuration
key against raw runtime writes. No new PMS entity or parallel tenant/task/inventory
store. A narrow runtime directory capability exposes only the explicitly published
binding; unpublished properties remain inaccessible. Actual commands use tenant
transactions/RLS and recheck current publication/version and issuer authority.

Flow: site → anonymous session → shop → quote → canonical complete-tax hold →
guest details → held reservation commit. No Party stub for shopping. Actual guest
profile creation uses PartyProfileService and its existing duplicate-review gate.
Never expose or attach an existing profile by self-asserted contact information;
duplicate guests require approved identity resolution or staff help.

All price/policy/release, tax, occupancy, audit/outbox and money operations reuse
canonical services. Public tokens have distinct purposes and cannot authenticate
invitation/staff routes. Session-scoped exact idempotency prevents changed choices,
duplicate profiles/reservations and foreign-hold adoption. Guests cannot choose
raw tenant/property/actor/Party/hold authority. Clock checks follow blocking I/O;
withdrawal, revision and issuer revocation stop old sessions.

## Proof

Independent nonimplementer executes real PostgreSQL owner/caller/tenant/property,
publication/revocation, search_path/temp-spoof and commit-boundary proof, plus
complete tax, duplicate-profile safety, last-unit, expiry/retry/outbox rollback.
Types, boundaries, strict schema, canonical11/11 and mounted HTTP remain required.
Only owned disposable prototype targets before migration admission; preserve the
private444 app and all laptop/production data. Exact-head CI/controller receiving
integration remain separate. No payments/provider activation/PAN/paid resources/
CompSet/tunnel probes. Global plan<=1% stops all work with checkpoints; emergency
credits remain untouched.
