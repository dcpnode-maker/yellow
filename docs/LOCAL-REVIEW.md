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
- real availability for five physical rooms across Standard and Deluxe types;
- visible restriction and operational-block evidence when those domain commands add it.

The browser is intentionally read-only in this order. Inventory editing, operational
blocks, restrictions and holds require later scoped API/UI orders; no direct browser-to-
table shortcut is permitted.
