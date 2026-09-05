# Independent post-cutover review — Order 161

**Verdict:** APPROVED LOCALLY
**Approved executable:** `a4178ce4b3bdf1fd95b097439287802a1edb7f8c`
**Operator evidence:** `406f337f78682b71e1f43780bb8f3b60f1e28857`
**Runtime image:** `sha256:83a51f63ff284cab011b3405429ff3fda74bc6fc05251dbf591f271bf2433665`
**Reviewer:** OpenAI Codex, independent non-operating reviewer
**Date:** 2026-08-25

## Scope and identity

I did not perform the cutover. I read `PROJECT.md`, ran `./state.sh`, read Order161
and D-428, and performed the pre-operation and post-cutover reviews. The approved
executable is an ancestor of Order160 evidence `af61783` and Order161 admission. The
operator commit changes only the admitted operations review and ledger paths; no
product, test, migration, schema, role, permission, dependency or status-source path
changed.

Two distinct running containers independently resolved to the same exact approved
runtime image and carried both full `org.opencontainers.image.revision` and
`yellow.source_commit` labels equal to `a4178ce`:

- permanent container `4ba98b1a98f4...`, healthy, publishes only
  `127.0.0.1:3000 -> 3000`;
- preview container `4638e1972175...`, healthy, publishes only
  `127.0.0.1:3002 -> 3000`.

Both joined only `yellow-order161-local-active_default` and both runtime URLs resolved
inside that network to `postgres:5432/yellow_order161_reviewable`. The fresh
PostgreSQL and Valkey services were healthy and published only on loopback ports 5642
and 6589. A scan of all running Docker publishers found no wildcard or public bind.

## Reviewer-executed served proof

I consumed the final fresh-stack login credentials from the temporary private handoff
without printing them. Against **each** of ports 3000 and 3002 I independently ran a
unique synthetic served-HTTP journey:

`health 200 -> login 200 -> exactly one granted property -> authenticated live status
with app/database operational and tenantContext=true -> Party create 201 -> masked
Party search 200 -> server-owned bookable offer 200 -> active hold 201 -> reservation
commit 201 -> byte-identical idempotent replay 201 -> confirmation GET 200`.

The harness emitted only status and cardinality results. It asserted that Party create
and search responses contained neither synthetic email nor phone, and it did not print
tokens, passwords, DSNs, identifiers, raw idempotency keys or confirmation numbers.
The two journeys used different identities, keys and stay dates on the same final fresh
database.

## Rollback and isolation

The first operator cutover used one sequentially recreated app and left port 3002
unbound. My first review returned STOP. Operator evidence `406f337` discloses that
incident, the required candidate stop, restoration of the exact old app and successful
old `/health`, followed by the corrected two-container topology.

Final independent inspection found:

- old Order147 app retained stopped on image
  `sha256:050286a826f3eea99305ef900f01181251f1e0d3c4fc1d83b887b3138ac3de53`;
- rollback tag `yellow-local-app:rollback-pre-order161-20260825T174233Z` resolves to
  that exact image;
- old Order147 PostgreSQL and Valkey remain running and healthy; its named database
  volume and network remain present;
- superseded Order159 preview remains retained stopped on its original image;
- new apps target only the new isolated PostgreSQL service, providing an independent
  containment check against old-database mutation.

The first corrected-state review attempt then stopped before authenticated requests
because the operator had correctly cleared the review passwords. No reset or weakened
oracle was accepted. Operations created a final fresh database, governed seed and a
temporary credential handoff, restarted both exact-image containers, and reran its
smokes. I restarted the independent authenticated proof on that final state. After both
reviewer journeys passed, I removed the temporary handoff and cleared process copies;
the ignored database-authority file remains private and no secret path is staged.

## Verdict boundary

Order161 is independently approved only as the present loopback local workbench at
operator evidence `406f337`, executable `a4178ce` and image `sha256:83a51f63...`.
This is not a merge, push, public deployment, status-snapshot update, production
booking/payment approval, destructive cleanup authorization or broader Phase 5 claim.
The retained rollback resources must remain until founder acceptance.
