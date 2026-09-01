# Order 315 — Management-demo workspace local refresh

**Status:** READY-D871
**Phase:** 7 — Tax engine and India IRP (local presentation refresh)
**Branch:** `phase-7/management-demo-workspace-local`
**Base:** `13b8d60` (complete Order314 governance head)
**Risk tier:** 3 — replacement of the sole founder-visible local app; fresh independent non-operating verification mandatory

## Outcome

Build exact complete Order314 and replace only the sole loopback port-3000 application
container so the management demo visibly names every already-built workspace. Preserve
the approved Order311 database, two properties, provider, Valkey, credentials, status
snapshot and all business truth, and retain the prior exact app container/image for
immediate rollback.

## Exact scope

- this order plus append-only decision, ledger, plan, roadmap and fresh review evidence;
- build one exact image from clean candidate `13b8d60`;
- record pre-change app identity, topology, health, asset hashes and read-only database
  digest without printing secrets;
- stop and rename only `yellow-order311-app`, then start one replacement container on
  the same network, exact loopback port and existing in-memory environment;
- retain the stopped prior app container/image as rollback;
- verify health, one-click protected login, exactly two properties, exact
  Order310/311/91/P7 status, twelve workspace routes per property, preview copy,
  accessibility bind, closed obsolete ports and unchanged database digest;
- fresh independent non-operating Tier-3 review performs only read-only inspection.

## Forbidden

No second UI local or staging bind; no provider/PostgreSQL/Valkey/network/volume restart
or replacement; no schema/migration/seed/data/credential/environment-value change; no
status/review/phase advance; no business mutation; no secret output; no public bind,
merge, push, production deploy or rollback deletion.

## Rollback

If the replacement fails health or acceptance, remove only the failed new app container,
restore the retained prior app container name and start it on its original exact port.
Do not touch database or companion services.

## Required proof

1. Clean exact source candidate and image identity are recorded.
2. Only the app container changes and port3000 continuity is restored promptly.
3. Login, two properties, 24/24 routes, status and Order314 preview pass.
4. Database/catalogue/business counts, credentials, companion identities and obsolete
   closed ports remain unchanged.
5. Fresh independent non-operating Tier3 reviewer approves or records exact findings.

## Definition of done

- [ ] Exact image is built from clean Order314.
- [ ] Guarded app-only cutover and acceptance pass.
- [ ] Prior app rollback is retained and companions/data are unchanged.
- [ ] Fresh non-operating Tier3 review approves.

