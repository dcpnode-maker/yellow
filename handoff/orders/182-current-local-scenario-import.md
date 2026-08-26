# Order 182 — Current-local scenario import

**Status:** READY — D-465
**Phase:** 5 · founder human testing data
**Branch:** `phase-5/two-hotel-scenario-seed`
**Base:** `459b4e5` (independently approved Order181)
**Risk tier:** 3 — reversible mutation of the founder's persistent local database
**Owner:** Codex operations; independent post-import verification

## Outcome

Apply the exact independently approved Order181 seed once to the sole current local
database so the founder can review Riverstone Test Hotel and Harbourlight Test Lodge
through the existing application at `http://127.0.0.1:3000`.

## Scope

- one timestamped, hashed pre-import database backup beneath
  `D:\Yellow\backups\order182\` with owner-only access;
- execute exact approved seeder `d7553761` against
  `yellow-local-current-postgres-1` on loopback port 5643;
- exact replay, bounded SQL cardinality/invariant checks, authenticated served reads,
  and one independent post-import review;
- this order, additive D-465, `handoff/LEDGER.md`, review and closure records.

No product, schema, migration, credential, unsupported lifecycle, tax/fiscal,
payment/document, group/block, OTA/channel, public bind, second local, port 3002,
merge, push or production deployment is in scope.

## Required operation and proof

1. Preflight proves exact approved head, one healthy current app on loopback 3000,
   healthy PostgreSQL/Valkey, port 3002 unbound, and zero existing scenario rows.
2. Create and SHA-256 hash a restorable custom-format PostgreSQL backup without
   printing credentials. Restrict the backup directory and file to the current owner.
3. Run the approved seed with protected deployment authority. Exact replay must be a
   no-op; any definition collision fails closed.
4. Prove the two scenario properties, four grants, 80 rooms/sellable units, 16 plans,
   80 prices, 2,192 reservations, 256 live non-overlapping occupancy claims, and 24
   balanced untaxed ROOM charges, with matching fact/outbox/idempotency evidence and
   zero unsupported payment/document/group/channel rows.
5. Prove the existing operator login sees Yellow Demo, Riverstone and Harbourlight;
   property switching, bounded reservation board/detail and INR/CAD folio reads are
   HTTP 200. Existing credentials remain unchanged and unexposed.
6. Independent non-operating reviewer verifies the active local, backup hash, exact
   cardinalities and served reads. The single local remains running after approval.

## Definition of done

- [ ] A hashed pre-import backup exists and is owner restricted.
- [ ] Exact approved Order181 data is present in the current local database.
- [ ] Exact replay, invariants and authenticated UAT reads pass.
- [ ] Independent reviewer approves the current-local import.
- [ ] Port 3000 remains the sole healthy local app and port 3002 stays unbound.
