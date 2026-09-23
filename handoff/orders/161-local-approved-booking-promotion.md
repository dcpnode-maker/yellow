# Order 161 — Local approved booking promotion

**Status:** READY — founder-directed local app update
**Phase:** 5 · human-testable application
**Branch:** `phase-5/local-approved-booking-promotion`
**Base:** `af617831615f1dd7da5b7645946f353644970870`
**Approved executable:** `a4178ce4b3bdf1fd95b097439287802a1edb7f8c`
**Risk tier:** 2 — reversible loopback-only local cutover
**Owner:** Codex operations; independent post-cutover verification

## Outcome

Make the independently approved Order160 Party → availability → hold → reservation
journey available for founder testing on both local ports. Create a fresh parallel
local-review database/Valkey/app stack, seed it through the governed deploy/runtime
authorities, prove the redacted synthetic CRUD journey on preview port 3002, then
replace only the permanent port-3000 app binding while retaining the complete old
app/database stack and an exact rollback image.

## Scope

- local Docker images, containers, networks and named volumes for project
  `yellow-order161-local-active`;
- loopback preview/cutover ports 3002 and 3000, PostgreSQL 5642 and Valkey 6589;
- exact approved executable `a4178ce4b3bdf1fd95b097439287802a1edb7f8c`;
- existing private Order161 worktree authority file and ephemeral shell secrets;
- this order, additive D-428, ledger, and an additive independent operational review.

No product, test, migration, schema, role, permission, status-snapshot, dependency or
repository implementation path is in scope. If any source edit is required, stop and
write a question.

## Required behavior and proof

1. Verify the approved executable and evidence ancestry, clean source tree, protected
   hashes and exact Order160 product-path identity before building. Label and verify the
   runtime image with the approved executable SHA.
2. Preserve the old port-3000 app, PostgreSQL/Valkey containers, image identity, network
   and database volume. Tag its exact image for rollback. Never run setup or seed against
   the old project.
3. Create a fresh parallel stack with distinct local-review passwords, loopback-only
   bindings, workbench and required workers enabled. Run fresh referee 11/11 and the
   governed review seed without printing authority, DSN, password or token material.
4. Replace the superseded Order159 port-3002 preview only after verifying its exact
   identity. Start the approved candidate on 3002 and prove health, OCI revision/image
   identity, login, one granted property, Party create/search masking, server-returned
   bookable offer, active hold, reservation commit/replay and confirmation GET. Use
   synthetic data and never print identifiers, contacts, tokens or raw idempotency keys.
5. After preview success, stop only the verified old app container, recreate only the
   approved candidate app on port 3000, and repeat health, image/revision, login and live
   system-status checks. A brief bind gap is allowed; no proxy is introduced.
6. On any failed cutover check, stop the candidate app, restart the retained old app and
   prove old health. Keep the old container, rollback tag, old DB/Valkey and volume until
   the founder accepts the new journey.
7. Report the status snapshot as historical metadata: it remains latest-built 155 /
   current 156 because Order160 forbids status-source edits. Deployed identity is the
   verified OCI revision plus exact image ID; do not fabricate a snapshot update.
8. Clear shell copies of secrets after use. Do not expose publicly, merge, push, or
   remove retained rollback resources.

## Definition of done

- [ ] Fresh parallel stack and referee/seed are green.
- [ ] Approved image and redacted full CRUD smoke are green on 3002.
- [ ] The same approved image is healthy on 3000 and both ports identify the same
      approved executable.
- [ ] Old app/database rollback is retained and independently verified.
