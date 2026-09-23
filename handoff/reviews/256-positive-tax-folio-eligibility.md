# Review 256 — Authoritative positive-tax primary-folio eligibility

**Reviewer:** independent Codex Tier-3 reviewer (`/root/order247_verify`)
**Decision:** APPROVED
**Date:** 2026-08-29
**Reviewed commit:** `87529fa83caf8f241fcf8d432b7e2519d7488672`
**Authority:** Order256 / D-664 / D-665 only

## Verdict

APPROVED. No blocking Order256 finding.

The reviewed resolver is a tenant-transaction-scoped, read/lock/re-read prerequisite.
It starts from the unique reservation lineage, joins the complete immutable hold-
binding identity, reparses and hash-verifies the canonical Order240 snapshot, and
requires the exact reservation and lineage-named sequence-1 segment. It selects only
reservation window 1 and requires its open folio to point to one open guest account
whose tenant, property, Party and currency agree with reservation truth. It invokes
the existing bounded financial lock for that exact folio/account, then re-reads and
revalidates the graph before returning fresh, deeply frozen evidence.

The service performs no INSERT, UPDATE, DELETE, journal, posting, fact, outbox,
idempotency, document or fiscal operation. The lock capability takes row locks only;
it returns no business data and changes no row. No additional folio is selected, no
folio/account is created, no mutable reservation status is imposed, and no tax code,
account route, business date, India rule or document-rounding policy is invented.

This approval grants no posting, route authoring, document, India/IRP, HTTP/UI, local
promotion, merge, deploy, Phase7-complete or application-complete authority.

## Inspection findings

- Input is an exact plain three-field record with canonical UUID validation. The
  supplied tenant must also equal the transaction-local `app.tenant_id`; RLS remains
  the database backstop and foreign tenant/property/reservation probes reveal no row.
- The lineage-to-hold-binding join retains tenant, binding, property, hold,
  attribution, sellable unit, period, quote hash, snapshot hash and currency. The
  attribution row, reservation and exact segment are all joined under the same tenant.
- Stored lineage, attribution metadata, reservation property/currency/Party and
  segment parent/sequence are checked before any financial root is accepted. The
  snapshot parser verifies canonical shape, totals, lineage evidence and its SHA-256.
- The database uniqueness constraint permits at most one `(tenant,reservation,window
  1)` folio. Missing primary/window-1 evidence is not-found; ambiguity and divergent
  truth are conflicts. Settled/closed folios, frozen/closed/non-guest accounts and
  property/Party/currency mismatch fail closed.
- `public.lock_financial_rows` is called only for the resolved guest account and folio.
  It validates the runtime app role and transaction-local tenant and locks both rows.
  The resolver then re-runs the complete query and compares all returned identities,
  hashes, property and currency. Concurrent account mutation serialized, and a change
  committed ahead of lock acquisition was rejected by the post-lock re-read.
- The parser creates new frozen arrays/records, and the returned wrapper is also
  frozen. Focused proof recursively verified every nested object is frozen and that
  the returned snapshot is not the fixture object.
- The exact commit diff is confined to the new tax-fiscal service/export, focused
  tests, Order256 and Phase7/build/decision/ledger evidence. It adds no migration,
  schema, ACL, seed, credential, runtime or UI change.

## Personally executed proof

All successful database proof used a manually created standalone container, not
Compose:

- container `yellow-order256-review-pg`;
- host port `55476`;
- named volume `yellow-order256-review-pgdata`;
- exact PostgreSQL image
  `postgres:16.15-alpine@sha256:ab5c955e9e57ae9879d4411ab49a912be9d162455676f7bf56e951b11ac73785`;
- `shared_preload_libraries=pg_stat_statements`;
- separate canonical `yellow_dev` and invariant/focused `yellow_test` databases.

Before migration, `docker inspect` returned the exact new container name, host port
and only `yellow-order256-review-pgdata:/var/lib/postgresql/data`; it did not contain
the stable volume name. In one PowerShell process I then provisioned the normal
owner/runtime/registrar authority, ran the production migration runner, canonical
seed or invariant fixture as appropriate, and executed:

- `bun test tests/database-acceptance.integration.test.ts` against canonical
  `yellow_dev`: **10 passed, 0 failed, 22 assertions**. PostgreSQL 16.15,
  `pg_stat_statements`, exact migrations 1–42, ownership, ACL/RLS and the canonical
  single demo property all passed.
- `python tests/run_invariants.py yellow_test` with UTF-8 output:
  **11 passed, 0 failed of 11**.
- `bun test tests/positive-tax-folio-eligibility.intentional-red.test.ts
  tests/positive-tax-folio-eligibility.integration.test.ts` with split deploy/runtime
  URLs: **7 passed, 0 failed, 48 assertions**. This covered P0–P6, full lineage,
  primary-folio/account coherence, hostile and cross-tenant inputs, snapshot tamper,
  real lock serialization, post-lock divergence, nested freeze and zero effects.
- The exact acceptance test asserted migrations 1–42 and the required **96 public
  tables / 86 policies**; the referee independently confirmed **86 tenant tables,
  86 RLS-enabled tables and 86 policies**.
- `bun x tsc --noEmit`: pass.
- `bun run boundaries`: pass, **94 TypeScript files scanned**.
- `git diff --check 3139f09..87529fa83caf8f241fcf8d432b7e2519d7488672`:
  pass.

The standalone container and volume were removed in the same process after each run.

## Review-infrastructure incident and recovery

The first attempted disposable setup used a WSL child shell. Although the initial
attempt honored the custom project, a later Windows-to-WSL invocation did not inherit
the custom Compose variables and resolved the existing worktree Compose project. It
started that project's PostgreSQL and Valkey containers and dropped/recreated only
its disposable `yellow_test`; migration then stopped at 0012 because an active runtime
session was present. It did not address `yellow_dev`, start/recreate the application,
or change the retained PostgreSQL volume.

I initially stopped those two containers based on the earlier state snapshot, then
observed that the app had since been started externally. I immediately restarted the
same exact PostgreSQL and Valkey container IDs without recreation. Recovery proof was:

- application, PostgreSQL and Valkey all healthy;
- `GET /health` **200** and `GET /` **200**;
- retained `yellow_dev` had exactly two properties — `Yellow Demo Property` and
  `Yellow Identity Gate Review Property` — and one active tenant;
- PostgreSQL retained the exact mount
  `yellow-order175-folio-responsive-containment_yellow-pgdata`.

The coordinator independently confirmed the same container IDs, mount and health.
No further setup, migration or destructive action was run against that Compose
project or volume. One later optional `schema:check` invocation was stopped after its
hard-coded `docker compose exec` read the stable project's incomplete disposable
`yellow_test` and reported an irrelevant schema mismatch. It made no database change
and is not represented as Order256 proof. The corrected standalone evidence above is
the approval basis.

Two additional reviewer-harness failures were also retained rather than hidden: the
first standalone referee run hit Windows CP1252 while printing a Unicode arrow, and
the first standalone acceptance run lacked the production preload/canonical seed.
Both disposable targets were removed automatically; the corrected UTF-8 and exact
two-database production topology passed in full.

## Cleanup

No `yellow-order256-review-pg` container or
`yellow-order256-review-pgdata` volume remained after proof. Apart from this review
record, the reviewer made no repository change. The sole local app and its retained
`yellow_dev` data are healthy and unchanged by the approved Order256 implementation.
