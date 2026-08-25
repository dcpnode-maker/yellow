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
export YELLOW_REVIEW_APPROVER_PASSWORD='<choose a different local-only password>'
./setup.sh --db-only
docker compose --env-file .yellow/runtime-database-authority.env --profile tools run --rm seed bun scripts/seed-review.ts
export YELLOW_TOKEN_SECRET="$(bun -e 'const bytes = crypto.getRandomValues(new Uint8Array(48)); process.stdout.write(Buffer.from(bytes).toString("base64"));')"
docker compose up -d --build app
```

The ignored `.yellow/runtime-database-authority.env` file is the sole local
authority input; it contains passwords only and is owner-readable. Compose builds
the deployment DSN inside the tools container, so no secret URL is placed in shell
history. The application and worker receive the separate runtime credential; do not
export the deployment URL into the app process or reuse its credentials.

The generated signing secret exists only in that shell and is never printed or written
to the repository. Generate a fresh value after opening a new shell. `./setup.sh` without
`--db-only` performs the same ephemeral generation automatically; an enabled workbench
fails closed when no secret is supplied and rejects Yellow's retired legacy placeholder.

Open `http://localhost:3200` and sign in with:

- Hotel account: `yellow-demo`
- Email: `operator@yellow.local`
- Password: the value supplied through `YELLOW_REVIEW_PASSWORD`

For the independent rate-publication decision, sign out and use:

- Hotel account: `yellow-demo`
- Email: `approver@yellow.local`
- Password: the distinct value supplied through `YELLOW_REVIEW_APPROVER_PASSWORD`

The seeder is safe to rerun with the same pair of passwords. It verifies both distinct
operators and their exact existing property grant, and creates nothing on an identical
rerun. It also creates or exactly verifies four review policies and one `FLEX` / Flexible
public rate at USD 125.00 per night. A fresh rate is requested by the operator, approved
by the distinct approver and published through the normal immutable publication path.
Shared passwords or conflicting users, roles, inventory, policy, plan or active-release
data stop the run rather than rewriting hotel configuration.

## Current review surface

- local database-backed staff login;
- property grant enforcement;
- Apple-calm and Pixel-expressive interchangeable visual skins;
- a Project status page with graphical roadmap/review progress, a committed snapshot
  drift-checked against the Gate-3 manifest, and authenticated live app/database/runtime
  configuration checks;
- real inventory configuration lists for room types, physical spaces and sellable units;
- idempotent, audited creation of room types, spaces and their sellable mappings;
- atomic creation of 1–200 ordinary exclusive hotel rooms from a reviewed range or pasted
  code preview, with one physical space and one sellable mapping committed per room;
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
- a configurable Guided, Expert and AI-assisted universal rate builder with immutable
  release history, server preview, a bounded two-operator approval inbox, explicit
  approve/reject decisions and publication restricted to the operator who approved;
- one reproducible active local-review `FLEX` release over the five seeded rooms, with a
  real two-night quote at USD 125.00 per night and all four review policies attached;
- real availability for five physical rooms across Standard and Deluxe types;
- ten-minute audited cart holds placed only from bookable availability, with active-hold
  visibility, explicit release and supervised audited due expiry; a hold protects
  inventory but is not a reservation;
- an authenticated founder booking journey that creates or finds a masked Party, searches
  the server-owned two-night offer, protects it with a ten-minute hold, commits that hold
  exactly once to a reservation and reads the resulting confirmation;
- visible restriction and operational-block evidence when those domain commands add it.

The browser keeps its bearer token, appearance choice and generated idempotency keys in
memory only. Inventory, restriction, rate-configuration and rate-pricing writes call the same tenant-scoped domain services,
audit log, outbox and durable replay primitive as any future production client. General
inventory import, positional dorm/bed generation, inventory update/delete, restriction
update/delete and tax/FX calculation require later scoped API/UI orders;
no direct browser-to-table shortcut is permitted.

The local `FLEX` quote deliberately reports `taxAssignmentState: none`. Its USD 250.00
two-night subtotal is pre-tax review evidence, not a final payable amount. This does not
constrain hotel-configurable tax treatment or pricing models; tax calculation and each
country's non-disableable compliance rules remain later governed work.

## Reading Project status correctly

Open **Project status** after signing in. “Live service checks” come from the running
process and the active tenant-scoped PostgreSQL transaction. A green app/database card
means those services answered that request; it does not prove every feature. Worker cards
say only whether their explicit runtime flags are configured. Valkey and external CI remain
`not_connected` until governed application integrations exist, so the page never guesses.

“Recorded build snapshot” is committed build evidence, not a network query. Its roadmap
denominator is the 13 named BUILD-PLAN phases, and its independent-review bar distinguishes
reviewed Orders 001–044 from later builder-green Gate-3 debt. Read current GitHub Actions on
the pull request itself; the localhost runtime intentionally carries no GitHub token and does
not scrape external CI.

The app is deliberately disabled unless `YELLOW_OPERATOR_WORKBENCH=1` is explicit.
Hold expiry is independently explicit with `YELLOW_HOLD_EXPIRY_WORKER=1` and starts only
when the workbench is enabled; local Compose supplies that opt-in.

Local staff login is guarded inside each Yellow process. A source and normalized hotel
account each have rolling attempt budgets, failed authentication adds a capped retry
backoff, and no more than four Argon2 verifications run concurrently; excess work is
rejected immediately rather than queued. The source is derived only from Bun's TCP peer
metadata. `Forwarded`, `X-Forwarded-For` and `X-Real-IP` are ignored, while direct test
handlers without peer metadata share the restrictive `unknown` source.

These controls are intentionally process-local. Starting another Yellow process creates
another bounded budget. Do not expose a multi-process workbench as though this were a
shared edge limiter; public/multi-node deployment requires a separately approved shared
limiter and explicit trusted-proxy topology.
# Founder UI walkthrough (Order 158)

After starting the local review stack, use the served application rather than direct
database commands for founder acceptance:

1. Sign in and confirm the selected property is visible in the workspace navigation.
2. In **Availability**, search a stay and inspect the server-owned bookable, blocked and
   warning evidence. Place and release a temporary hold when a bookable result exists.
3. Use **Open reservations** to search for or create a Party, select a server-owned offer,
   place its temporary hold, commit the reservation and read the resulting confirmation.
   Verify the completed booking. The flow creates no payment, folio, tax or fiscal artifact.
4. Change property while **Project status** is active and confirm live status refreshes
   once. Sign out when finished; reload must not restore the bearer token or Party data.

Review at 375, 768, 1024 and 1440 CSS-pixel widths, and complete one keyboard-only pass.
The local surface is an authenticated Phase-5 review application; it is not public or a
claim that deferred vendor, payment, tax, fiscal, housekeeping or public-booking phases
exist.
