# Local founder review

This is a loopback-only development surface. It provisions real tenant-scoped data and
uses the same inventory, audit and outbox services as the application; it is not a UI
mock and is not a production deployment.

## Automated setup

From the repository in WSL:

```bash
export COMPOSE_PROJECT_NAME=yellow-review-app
export YELLOW_APP_PORT=3200
export YELLOW_POSTGRES_PORT=5642
export YELLOW_VALKEY_PORT=6589
export YELLOW_OPERATOR_WORKBENCH=1
export YELLOW_REVIEW_PASSWORD='<choose a local-only password>'
./setup.sh --db-only
DATABASE_URL="postgres://yellow:yellow@127.0.0.1:${YELLOW_POSTGRES_PORT}/yellow_dev" bun run db:seed-review
docker compose up -d --build app
```

Open `http://localhost:3200` and sign in with:

- Hotel account: `yellow-demo`
- Email: `operator@yellow.local`
- Password: the value supplied through `YELLOW_REVIEW_PASSWORD`

The seeder is safe to rerun with the same password. It verifies exact data and creates
nothing on an identical rerun. A conflicting user, role, room type, room or sellable
unit stops the run rather than rewriting hotel data.

## Current review surface

- local database-backed staff login;
- property grant enforcement;
- Apple-calm and Pixel-expressive interchangeable visual skins;
- real inventory configuration lists for room types, physical spaces and sellable units;
- idempotent, audited creation of room types, spaces and their sellable mappings;
- active OOO/OOS cause listing plus idempotent audited open and close actions, with OOO
  clearly identified as physical removal and OOS as commercial unavailability;
- audited per-property OOS sellability choice between blocked and allowed-with-warning,
  with a conservative blocked default and no way to make OOO sellable;
- deterministic listing and idempotent, audited creation of manual restrictions;
- configurable property-wide or room-type/channel restriction scope, with half-open
  stay dates and progressive value guidance for length-of-stay and advance rules;
- validated cancellation, deposit, guarantee and no-show policy authoring;
- base rate-plan composition with currency, tax treatment, market/source and exact-kind
  policy choices;
- append-only exact-minor-unit price creation with dynamic occupancy tiers and child
  bands, plus current-price lookup using PostgreSQL date/mask/latest precedence;
- audited price correction by loading the current row and creating an immutable
  successor while its plan, room type, dates, weekdays and currency remain locked;
- real availability for five physical rooms across Standard and Deluxe types;
- visible restriction and operational-block evidence when those domain commands add it.

The browser keeps its bearer token, appearance choice and generated idempotency keys in
memory only. Inventory, restriction, rate-configuration and rate-pricing writes call the same tenant-scoped domain services,
audit log, outbox and durable replay primitive as any future production client. Update/delete/bulk
inventory, restriction update/delete, tax/FX calculation and holds
require later scoped API/UI orders;
no direct browser-to-table shortcut is permitted.
