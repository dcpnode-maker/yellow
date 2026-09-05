# Local founder review

Yellow has one supported local-review stack at `http://127.0.0.1:3000`. It runs the
real tenant-scoped application, PostgreSQL schema, domain services, audit facts and
outbox. It uses synthetic hotel data and local provider fixtures; it is not a mock,
public endpoint or production deployment.

Read [RELEASE.md](RELEASE.md) first for the exact prerequisites and release boundary.
The launcher requires a supported Docker Engine/Compose environment, Bun 1.3.14,
Python 3.12+, `psycopg2-binary==2.9.12`, Git and curl.

## Start, inspect and stop

Select the exact clean revision named by the current review evidence, then run:

```bash
./scripts/local-review.sh start
```

The launcher refuses a dirty checkout. It provisions protected local credentials,
runs the migration and 11/11 invariant gates, loads the canonical base and founder
review seeds, builds the app from the exact Git SHA, starts the implemented workers
and verifies a real login. It uses the single Compose project `yellow-review` and
the standard local ports: app 3000, PostgreSQL 5442 and Valkey 6389.

Check the live receipt:

```bash
./scripts/local-review.sh status
```

The first response is process liveness. The second is release readiness and must name:

- `status: "ready"`;
- target `yellow_runtime_database`;
- the exact 40-character Git revision printed by the start command;
- expected migration frontier `77`.

The start command also verifies that this revision can authenticate the synthetic
operator. A green response establishes the serving source and bounded database
contract. It does not prove every feature, external CI, provider access or production
deployment.

Stop while preserving the PostgreSQL volume:

```bash
./scripts/local-review.sh stop
```

To refresh, stop the stack, select the next clean reviewed revision and run the start
command again. It reruns forward migrations, gates, idempotent seeds, image build,
readiness and login proof. Never point it at hotel records or a volume that must be
preserved.

## Authentication and credentials

The launcher creates two ignored owner-only files:

- `.yellow/runtime-database-authority.env` contains distinct deployment, runtime
  and extension-registrar database passwords;
- `.env.local-review` contains the operator password, distinct approver password
  and token-signing secret.

Both must be regular, non-symlink files owned by the current user. The launcher
enforces mode 600 for the review file and never prints the passwords. Do not copy
their contents into Git, chat, screenshots or another model.

The browser opens at `http://127.0.0.1:3000` and prefills the synthetic operator:

- hotel account: `yellow-demo`;
- email: `operator@yellow.local`;
- password: the protected `YELLOW_REVIEW_PASSWORD` value.

Approval journeys use the distinct `approver@yellow.local` identity and its protected
approver password. Sign out before changing actor. The two-user boundary is part of the
approval proof; never reuse one password or approve the actor's own request.

Bearer tokens, appearance choices and generated idempotency keys remain in browser
memory. Reload and sign-out behavior must not publish credentials or tenant data.
Property grants, scopes and transaction-local tenant context remain enforced by the
server.

## Implemented review surface

The consolidated application exposes these real, permission-bound workspaces:

- **Today and reservations:** arrivals, departures and in-house visibility; Party
  search/create; server-owned offers; temporary holds; reservation commit and detail;
  arrival/departure roll and bounded pickup/cleaning coordination.
- **Availability and setup:** availability, room types, physical spaces, sellable
  mappings, room creation, OOO/OOS state, restrictions, policies, rate plans, prices,
  quotes, corrections and approval-bound rate publication.
- **Folios and cashiering:** folio statements/windows, charges and immutable
  corrections, transfers, token-only payment operations, synthetic hosted deposits,
  settlement/close, receivables and cashier sessions.
- **Stay operations:** check-in readiness/commit, checkout readiness/commit, vehicle
  registration and governed parking.
- **Housekeeping:** room condition, task board/detail/actions, assignment sheets,
  arrival cleaning and discrepancy reporting.
- **Finance operations:** business-day readiness, discrepancy carry, audited seal and
  owner-trust expense preparation/approval/posting.
- **Project status:** the committed operational baseline plus live app/database/worker
  state and the embedded build receipt.

These flows use the same application commands, permissions, database transactions,
facts, outbox and replay controls as another client. The review seed is synthetic and
idempotent; a conflict fails closed instead of rewriting existing hotel truth.

## Explicit release limits

Local payment and hosted-deposit providers are synthetic. No live PSP, acquiring,
OTA, IRP/GSP, ZATCA or UAE ASP access is implied. Order434 completed native source,
replay, concurrency and migration0076/0077 acceptance, passed fresh independent
Tier-3 review and exact CI178, and merged through PR83 as main443e3826. Main now
expects77 migrations and127 public tables. Migration0075 still revokes the rejected
legacy issue capability; the reviewed native path is a separate governed entry.
IRP submission and operator invoice UI remain separately scoped. Source acceptance
does not prove that a retained local app was refreshed or a cloud host was deployed.

The broader 18-phase destination, including voice, RMS, distribution, native clients,
CRM/CRS and hotel interfaces, remains planned where PROJECT-STATUS says planned.
Screens and specifications are not proof that those capabilities are shipped.

## Founder walkthrough

1. Run `status` and match the readiness revision to the SHA printed by `start`.
2. Sign in as the operator and confirm the granted property and Project status build
   receipt.
3. Review Today, a reservation, its room/readiness context and the linked folio.
4. Exercise one bounded operational path, such as hold → reservation, room condition
   → housekeeping task, or folio correction. Use the approver identity only when that
   path explicitly requires independent approval.
5. Verify replay/idempotency feedback rather than repeating a state change blindly.
6. Check a representative desktop, tablet and narrow-phone width plus keyboard-only
   navigation. Sign out when finished.

If a surface is unavailable, verify its role/property scope, seed, worker flag and
serving SHA. Do not bypass authentication, grant broad database authority or recreate
the stack on an alternate port to hide the mismatch.
