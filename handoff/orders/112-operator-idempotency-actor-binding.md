# Order 112 — Operator idempotency actor binding

**Phase:** 5
**Branch:** `phase-5/security-hardening`
**Base:** `a587a23`
**Risk tier:** 3 — authenticated mutation replay and audit attribution
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Make every durable idempotency claim created directly by the operator HTTP adapter
part of the authenticated staff actor's request identity. An exact retry by the same
actor must continue to replay byte-equivalently. Reuse of the same tenant, operation,
key and business request by a different actor must fail with the existing generic 409
`request/idempotency_conflict`; it must never return the first actor's cached success or
silently omit the second actor from audit evidence.

## Natural-Solution Test

`PostgresIdempotency` already hashes canonical request identity and correctly conflicts
when the hash changes. Reservation commit/lifecycle/guest/segment and Party creation
already include the authenticated actor in their domain request identities. The gap is
limited to the sixteen direct operator-adapter call sites, each of which builds a
business-only request object. The natural repair is one private operator helper that
adds the verified actor before delegating to the unchanged kernel, and routes every
direct operator claim through that helper. No table, migration, token claim, operation
name, business command, event, state transition or browser behavior is needed.

## Scope

- `src/http/operator.ts`
- `tests/operator-idempotency-actor-binding.test.ts`
- `tests/offline-leases.integration.test.ts`,
  `tests/operator-inventory.integration.test.ts`,
  `tests/operator-oos-policy.integration.test.ts`,
  `tests/operator-operational-blocks.integration.test.ts`,
  `tests/operator-rate-configuration.integration.test.ts`,
  `tests/operator-rate-pricing.integration.test.ts`,
  `tests/operator-restrictions.integration.test.ts`
- `docs/SECURITY.md`, `docs/CONTRACTS.md`
- `src/project-status.ts`, `tests/founder-status.integration.test.ts` only after green
- this order, `handoff/PHASE-5-PLAN.md`, `handoff/LEDGER.md`, `DECISIONS.log`,
  `handoff/questions/`, and the independent review record

## Required work

1. Add one private operator-adapter idempotency helper. It receives the verified
   `TenantRequestContext`, stable operation, caller-owned business request and command;
   it alone delegates directly to `PostgresIdempotency.execute` and constructs the
   canonical request identity as authenticated `actorId` plus the existing business
   request. Tenant, actor and key come only from verified context/header boundaries.
2. Route every direct operator-adapter idempotent mutation through that helper. Preserve
   all sixteen stable operation names, existing business request fields, success bodies,
   replay headers, command/audit envelopes and rollback-before-HTTP behavior.
3. Preserve the established kernel and domain contracts. Same-actor exact retry remains
   a byte-equivalent replay. Same-actor changed-request reuse remains a 409. Different-
   actor same-key reuse, even with an identical body, becomes a 409 before the second
   command executes and does not disclose the first actor's cached body.
4. Add a source boundary proof that the operator adapter has exactly one direct kernel
   delegation, inside the actor-binding helper, and that all mutation handlers use the
   helper. This is a regression guard against a later handler silently omitting actor
   identity; it does not replace the real PostgreSQL proof.
5. Add a real two-authorized-actor HTTP proof on fresh PostgreSQL. Actor A creates one
   canonical inventory object. Actor B sends the identical body, operation and key:
   the current implementation must reproduce the vulnerable cached 201 during P0, and
   the corrected implementation must return generic 409 with no replay header/body
   disclosure and no actor-B fact/outbox/domain artifact. Actor A's exact retry must
   still replay once with unchanged evidence.
6. Document the contract precisely: the database key namespace remains tenant +
   operation + hashed key, while actor identity participates in the request hash. Any
   unexpired pre-fix key reused after deployment may fail closed as a conflict; this is
   safer than replaying an identity-unbound response and requires no data rewrite.
7. Per Questions 137 and 138, repair only the seven stale exact-role proof labels/literals reached
   by P3. They must require the already canonical sorted 25-scope set; production seed,
   permission, token and route behavior remain byte-identical.

## Forbidden

- Any migration, schema, RLS, role/grant, tenant middleware or idempotency-table change
- Editing `migrations/0001_init.sql`, any migration, `tests/run_invariants.py`, occupancy,
  reservation lifecycle, Party identity, journal, fiscal, rate or payment logic
- Actor identity from JSON, query, URL, cookie or any browser-owned field
- Adding actor to response bodies, facts, events or logs beyond existing audit envelopes
- New operation names, new idempotency rows for a same-actor replay, key namespacing by
  browser input, or weakening changed-request conflicts
- A source-only proof without real PostgreSQL replay/conflict evidence
- Files outside Scope, self-review or self-merge

## Pre-registered proof

### P0 — intentional red

On fresh PostgreSQL, commit the two-actor inventory replay case before production code.
Actor A's request succeeds. Actor B then uses the same operation, key and exact body.
The current base returns Actor A's cached 201 with `idempotency-replayed: true`, while
the preregistered expectation is generic 409 and therefore fails red. Record the exact
status/header/body delta; do not weaken it or edit the database fixture to force green.

### P1 — actor-bound conflict and same-actor replay

The corrected focused database proof shows Actor B receives exactly 409
`request/idempotency_conflict`, no cached success fields, no replay=true header and no
Actor-B fact/outbox/domain artifact. Actor A's identical retry remains byte-equivalent,
returns replay=true and retains exactly one fact/event/domain object.

### P2 — complete operator boundary

The source proof enumerates every direct operator mutation and proves all use the one
actor-binding helper, with exactly one raw `PostgresIdempotency.execute` delegation in
that helper. The reservation and Party domain idempotency paths remain outside this
adapter repair and byte-identical.

### P3 — inherited behavior

Run every existing operator suite that exercises idempotent mutations plus typecheck,
import boundaries and the standing non-database suite. Existing same-actor replay,
changed-request conflict, publisher rollback and exact response assertions remain green.

### P4 — project and independent gates

Deployment/schema/protected hashes, licence/audit and a fresh app-never-started referee
must pass. A non-implementing reviewer inspects the exact diff and personally executes
P0's corrected two-actor proof plus P1–P2 on a fresh database before approval.

## Definition of done

- [x] Order exists before implementation.
- [x] Intentional two-actor P0 red is committed before production code.
- [x] All direct operator claims bind the verified actor through one choke point.
- [x] Cross-actor key reuse conflicts without response or audit-envelope confusion.
- [x] Same-actor replay/rollback and every inherited operator contract remain exact.
- [x] Standing/referee gates pass and protected files remain unchanged.
- [x] Independent non-implementing reviewers personally execute and approve the rebased proof.
