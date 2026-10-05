# Order 398 — Current approved single-local recovery

**Status:** APPROVED-CLOSED-D1172
**Phase:** 7 — founder-review runtime reflection
**Base:** exact independently approved Order397 closure `d1f6f45`
**Risk tier:** 3 — retained hotel data, forward migrations and local replacement

Restore exactly one founder-review Yellow application at `127.0.0.1:3000` from the
current independently approved source so the authenticated Project Status and built
operator journeys are visible without creating a second local or changing hotel data
semantics.

## Exact scope

- preserve the stopped Docker data image, images, volumes and containers; the already
  completed space preflight relocates only Docker's stopped 10.3GB WSL data directory
  to `E:\Yellow\docker-data\wsl` behind an exact Windows junction and preserves all
  bytes; stale Docker runtime-socket directories may be renamed intact to recover the
  backend, but factory reset, prune and data deletion are forbidden;
- recover the previously approved sole Order370 local if its exact containers/network/
  volume exist; otherwise restore only the verified Order274 backup through the
  already approved recovery path;
- verify the retained database identity, two-property and clean scenario counts before
  mutation, take a new protected backup, then apply only committed forward migrations
  0060–0068 with the production runner and prove a zero-apply rerun;
- build the exact clean approved source `d1f6f45`, retain the previous exact app image
  for rollback and replace only the sole app container on its existing environment,
  network and loopback `127.0.0.1:3000` binding;
- preserve protected existing founder/operator credentials and masked populated
  one-click login without reading, printing, rotating or copying secrets;
- verify health, no-store authentication, both properties, `396/397/91/phase7/18`
  status, all existing management routes, and the newly approved business-day and
  owner-trust workspaces using read-only or explicitly governed operations only;
- prove ports3002,3123 and3188 closed, PostgreSQL host-unbound, exactly one UI local,
  exact migration/schema/data/source/container identities and rollback readiness.

## Forbidden

No second local, reseed, credential rotation/disclosure, broad cleanup, factory reset,
public bind, production deployment, product/source/test change, phase-completion claim,
merge or push. No financial, fiscal or hotel-data mutation merely for demonstration.

## Required proof

Record pre/post Docker and disk identity, backup hash, migrations/schema/table/policy/
two-property and clean scenario counts, source/image hashes, health/auth/status/routes,
closed ports and rollback. A fresh non-operating Tier-3 reviewer must independently
verify the final runtime without performing business mutations.

## Builder evidence

- Docker's stopped WSL data moved byte-for-byte to `E:\Yellow\docker-data\wsl`
  behind the exact original-path junction; retained containers, images, network and
  `yellow_order311_clean_pgdata` volume were recovered without reset or prune.
- Exact retained migration-59 database matched the approved Order370 identity:
  110 base tables, 2 views, 100 policies, two properties and clean scenario counts
  8 parties / 0 contacts / 8 party roles / 75 facts / 22 outbox rows.
- Protected pre-migration custom backup is 833,216 bytes, has 1,426 catalogue lines
  and SHA-256 `45477fc4592dfae1f96e3645a6d643dcc17702295750a452ff58adaa22e482d1`.
- Production runner applied exactly migrations 0060–0068; immediate replay applied
  zero. Final database has migrations 1–68, 116 base tables, 2 views, 106 policies,
  unchanged two-hotel/scenario truth and zero journals/posting lines.
- Exact approved source `d1f6f45e1835df86bf0c27c50beba66113b4ae96` built image
  `sha256:15707acfdf251ab6e6269cbb7cee9ab9c8a1f84d919a889e8a205cc3b49ec247`;
  the prior image remains tagged `yellow-order398-rollback:pre-order398`.
- The sole app is healthy with zero restarts at `127.0.0.1:3000`; PostgreSQL is
  host-unbound; ports 3002, 3123 and 3188 are closed. Provider and Valkey dependencies
  are healthy on the retained exact network.
- Root/health/no-store populated protected login, two properties, authenticated
  `396/397/91/phase7/18` status and all management routes were verified. The exact
  upgrade-role gap exposed during workspace verification was resolved only through
  independently approved Order399; fresh login now returns trust 200 for both hotels,
  business-day 200 for the configured main hotel and bounded 404—not scope 403—for
  the identity-only hotel without a business-day fixture.
- Current runtime usage is approximately 192 MiB total across app, PostgreSQL,
  provider and Valkey. No second UI local, reseed, credential change, financial
  mutation, public bind, deployment, merge or push occurred.
