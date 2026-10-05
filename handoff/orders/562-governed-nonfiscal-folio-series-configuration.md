# Order 562 — governed non-fiscal folio-series configuration

## Objective

Add the missing auditable, property-scoped configuration boundary for exactly one
non-fiscal folio numbering series, then use the independently accepted command to
configure the fictional Locanda public property so Order 561 can resume without a
raw seed or privileged ad-hoc insert.

## Scope

- `migrations/0097_governed_nonfiscal_folio_series_configuration.sql`
- `src/contexts/financials/folio-series.ts`
- `src/contexts/financials/index.ts`
- `src/http/operator.ts`
- `src/app.ts`
- `src/server.ts` only if composition needs an explicit dependency
- `docs/CONTRACTS.md`
- `docs/EVENTS.md`
- `tests/schema/expected.sql`
- `tests/nonfiscal-folio-series-configuration.intentional-red.test.ts`
- `tests/nonfiscal-folio-series-configuration.integration.test.ts`
- `tests/operator-nonfiscal-folio-series-configuration.integration.test.ts`
- `tests/review-seed.integration.test.ts`
- `tests/public-folio-series-access-provisioning.test.ts`
- `tests/public-folio-series-access-provisioning.integration.test.ts`
- `scripts/seed-review.ts`,
  `tools/provision-public-folio-series-access.ts`, and
  `handoff/receipts/562-public-folio-series-access.json` only for
  an allowlisted grant of `financials.folio-series:configure` to the one existing
  full-access review role selected by independent preflight; no inferred/bulk grant
- Operator HTTP route `POST /api/v1/properties/:property/folio-series`
- Existing public Compose project `yellow-public-demo`, after independent source and
  deployment review
- One private pre-deployment and one private pre-configuration PostgreSQL checkpoint
- `handoff/reviews/562-governed-nonfiscal-folio-series-configuration.md`
- `handoff/LEDGER.md`

## Required behaviour

1. The command accepts only one trimmed 1–24 character ASCII prefix matching
   `[A-Za-z0-9/-]+`, an empty JSON object is not accepted, and server-derived tenant,
   property, actor, request correlation and property-local business date remain
   authoritative.
2. The caller must have `financials.folio-series:configure` over the exact property.
   Missing scope is 403, foreign/ungranted property is concealed/forbidden per the
   existing operator convention, and raw `document_series` DML remains unavailable
   to the runtime role.
3. A yellow-owner `SECURITY DEFINER` capability, callable only through the governed
   runtime app-role boundary, serializes the exact tenant/property series root and
   creates at most one row with `kind='folio'`, `fiscal=false`, `next_no=1`, null
   supplier registration, null financial year and null hash tail.
4. Exact prefix replay returns the canonical existing row with `created=false` and
   emits no duplicate evidence when it is a new idempotency key. Exact same-key replay
   returns the byte-equivalent original success status/body (`created=true` when the
   original call created it) and exposes replay only through the response header. A
   used series with `next_no>1` is never reset. A different prefix, a second matching
   series, any fiscal-shaped value, invalid property or concurrent conflicting request
   fails closed without partial state.
5. First creation atomically writes exactly one minimized `configured` fact and one
   `folio.series.configured` outbox event for the series. Payload is exactly
   `{seriesId,propertyNode,kind:'folio',prefix,fiscal:false}` and contains no guest,
   reservation, money, document, tax, credential or contact data.
6. The public property configuration uses the reviewed live API with one stable
   idempotency key and prefix `L3R-FOL-`. It must create one series only; same-key
   replay and fresh read prove no duplicate counter, fact or event.
7. No account, folio, document, journal, posting, payment, occupancy, reservation,
   guest, room, rate, tax/fiscal registration or unrelated configuration row changes.
8. Fresh PostgreSQL 16 migration, ACL/RLS/hostility, rollback, replay and concurrency
   proof, schema equality, focused tests, referee 11/11, typecheck and independent
   non-implementing review are mandatory before public use and again after promotion.
9. The database capability rechecks current active tenant/actor membership, the exact
   property grant and the dedicated permission under locks before creation and before
   every replay/no-op. It serializes on the same tenant/property non-fiscal-folio
   advisory root used by the allocator; an application-level scope check is not proof.
10. `docs/CONTRACTS.md`, `docs/EVENTS.md` and the canonical schema dump describe the
    exact request, response, permission, function and event contract. Permission-row
    changes in fixtures/live configuration are verified against an explicit allowlist.
11. The public provisioning helper may perform the one otherwise-excluded raw
    `role_permission` insert only after validating the exact loopback deployment,
    migration frontier/checksum, all 65 pre-existing permissions, and every current
    recipient/scope of role `05802175-9b05-5a8d-8596-bccfbe36e99f`. The reviewed
    topology is one active actor with nine exact property memberships; the added
    capability therefore follows that already-full-access role across those nine
    memberships. Any missing/extra permission, actor, membership, scope, recipient,
    inactive status, different database target or ledger drift fails before insert.
    The helper must lock the exact role and permission relationship roots strongly
    enough to exclude incoming membership and grant phantoms through commit, retain
    shared locks on every reviewed child row, and revalidate the complete permission
    and membership topology after insertion. Executable proof must cover writer-first
    rejection and helper-first serialization for both membership and permission
    recipients without deadlock; an unlocked reread or helper-only advisory lock is
    insufficient.

## Exclusions

- No fiscal invoice/credit/debit series, legal document numbering, document issue,
  hash chain, tax registration, charge, journal, posting, payment or settlement.
- No folio opening, check-in or other reservation mutation in this order.
- No generic document-series editor, delete, reset, prefix change or counter edit.
- No raw public-database INSERT/UPDATE/DELETE except the single exact allowlisted
  `role_permission` insert described in Required behaviour 11; no relaxation of
  current business-table DML ACLs.
- No claim that configuration alone completes PMS01, PMS14 or Order 561.

## Rollback boundary

Before public promotion, remove the candidate app image and discard the isolated
database. After the reviewed live configuration succeeds, the configured numbering
root and immutable evidence are retained; do not delete or rewrite them. Roll back
the application image only if needed, preserving the compatible forward migration
and configured public data.
