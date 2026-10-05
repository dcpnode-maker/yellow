# Order 160 — Local review booking journey authority

**Status:** READY — founder-priority human CRUD journey
**Phase:** 5 · human-testable application
**Branch:** `phase-5/local-review-booking-journey-authority`
**Base:** `ee42950fef5edece967295a049e68f96cf527157`
**Risk tier:** 3 — reservation commitment and occupancy proof
**Owner:** Codex implementation; independent non-implementing Tier-3 review

## Outcome

Make the authenticated local-review operator capable of completing the existing
production-bound Party → availability → hold → reservation journey. Add only the
existing `reservations.booking:write` permission to the deterministic local-review
role, preserve least privilege, and prove the whole served workflow against fresh
PostgreSQL with durable artifact, replay, conflict, denial and isolation checks.

## Scope

- `scripts/seed-review.ts`;
- exact-role assertions in `tests/offline-leases.integration.test.ts`,
  `tests/operator-holds.integration.test.ts`,
  `tests/operator-inventory.integration.test.ts`,
  `tests/operator-oos-policy.integration.test.ts`,
  `tests/operator-operational-blocks.integration.test.ts`,
  `tests/operator-rate-configuration.integration.test.ts`,
  `tests/operator-rate-pricing.integration.test.ts`,
  `tests/operator-restrictions.integration.test.ts`, and
  `tests/review-seed.integration.test.ts`;
- new `tests/operator-founder-reservation-journey.integration.test.ts`;
- `docs/LOCAL-REVIEW.md`;
- this order, additive D-427, `handoff/LEDGER.md`, and one additive independent review.

No operator HTML/CSS/JavaScript, HTTP/domain implementation, migration, schema,
production role, credential, CI/runner/setup/package or financial path is in scope.
`tests/operator-party-profiles.integration.test.ts` must be rerun but requires no edit
because it consumes the shared permission constant. If another implementation path is
required, stop and write a question.

## Required behavior

1. Add exactly `reservations.booking:write` to the idempotently provisioned local
   review role between existing rate and guest-reservation permissions. Exact role
   membership grows from twenty-seven to twenty-eight and no production role changes.
2. On a fresh isolated database, run the normal seed and review seed with distinct
   deploy/runtime URLs and review/approver passwords. Connect runtime services through
   the runtime URL with `prepare: false` and the same service composition as the real
   server.
3. Log in as the review operator and prove the JWT contains the booking scope exactly
   once and only the granted property. Create/replay/search a Party with masked search
   evidence; search a future two-night stay; choose a server-returned bookable offer;
   place/replay a hold; commit/replay the hold-based reservation; then read its
   confirmation through the real HTTP surface.
4. Prove exactly one reservation, one segment, one primary guest and one consumed
   hold; zero hold occupancy and one segment occupancy for the exact period; exact
   Party-created, hold-created/consumed and reservation-confirmed facts; and the exact
   corresponding Party, hold, occupancy and reservation outbox events.
5. Prove exactly one complete, redacted, 24-hour idempotency record for each of
   `profiles.party.create`, `operator.inventory.holds.place`, and
   `reservation.commit`. No raw idempotency key or PII may enter evidence.
6. Exact Base reservation commit must return 403 with zero reservation artifacts. The
   candidate returns 201; a changed request with the same key returns 409 without
   mutation. A token without the scope and a token for another property remain denied.
7. The proof may not create a folio, account, journal, posting, payment, fiscal or
   document-number artifact. Close clients and drop the isolated database; never
   row-delete insert-only facts, outbox events or occupancy records.

## Proof

- exact-Base 403 and zero-artifact denial, followed by candidate served end-to-end
  success on the same product flow;
- focused review-seed and all nine inherited exact-role suites;
- Party profile suite plus the new founder reservation journey suite under real
  unprepared PostgreSQL runtime wiring;
- exact durable cardinality, time range, state, fact/outbox, idempotency, denial,
  replay, conflict, tenant/property and no-financial-artifact assertions;
- standing tests, typecheck, boundaries, licences, audit, runtime/security gates,
  protected hashes and fresh app-never-started `./setup.sh --db-only` referee 11/11;
- independent non-implementing Tier-3 reviewer personally reruns Base/candidate,
  focused journey and cumulative proofs.

## Forbidden

- Production-role, migration, schema, route, state, event, UI, financial, public-access
  or dependency changes.
- Broad reservation/admin authority, wildcard permission, bypass of HTTP/services,
  mocked persistence, preselected fake offers or destructive cleanup of append-only
  evidence.
- PII/raw-key disclosure, weakened denials, merge, push, deployment, self-review or
  self-merge.

## Definition of done

- [ ] Exact Base is denied with zero artifacts and the candidate completes the full
      served Party-to-confirmation journey.
- [ ] The review role contains exactly twenty-eight expected permissions and all
      no-scope/foreign-property boundaries remain closed.
- [ ] Durable reservation, occupancy, fact, outbox and idempotency evidence is exact,
      with no financial/fiscal artifacts or sensitive output.
- [ ] Fresh referee is 11/11 and an independent Tier-3 reviewer approves one immutable
      candidate.
