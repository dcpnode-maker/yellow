# Review 623/624 — Group block workbench and public-demo PostgreSQL 18 cutover

Date: 2026-09-23
Reviewer: `/root/pg18_group_block_review`

## Scope reviewed

- Order 623: Opera-style group block read workbench.
- Order 624: Isolated public-demo PostgreSQL 18 cutover.

## Commands independently executed by reviewer

```powershell
bun test tests/order623-group-block-workbench.test.ts
bun run typecheck
Invoke-RestMethod http://127.0.0.1:3010/health
docker exec yellow-public-demo-postgres-1 psql -U yellow_deploy -d yellow_public_demo -tAc "select version();"
# Demo auth + GET /api/v1/properties/6081b544-22a1-534f-a86d-bb1ae0519e14/group-blocks
bun tools/probe-colleague-demo-readiness.ts
bun tools/probe-public-demo-performance.ts
```

## Findings and resolution

- Initial finding: the first cutover patch changed the repository default `docker-compose.yml` to PostgreSQL 18, widening the public-demo order into a repo-wide database upgrade. Fixed by reverting repository default Compose to PostgreSQL 16 and moving PostgreSQL 18 to the public-demo runtime override.
- Second finding: Compose initially rendered both the base PG16 volume and the PG18 volume. Fixed with `volumes: !override`, explicit `PGDATA=/var/lib/postgresql/18/docker`, and a single `yellow-pgdata-pg18:/var/lib/postgresql` public-demo mount.

## Accepted evidence

- Rendered public-demo Compose config shows one Postgres volume: `yellow-pgdata-pg18` targeting `/var/lib/postgresql`.
- Actual Postgres container has one mount: `yellow-public-demo_yellow-pgdata-pg18 -> /var/lib/postgresql`.
- Actual `data_directory`: `/var/lib/postgresql/18/docker`.
- Actual DB version: PostgreSQL 18.6.
- Group-block API returned 2 Locanda groups:
  - `LOC-MICE-0926`: blocked 32, picked up 4, remaining 28, 8 allotment rows.
  - `LOC-SOC-0928`: blocked 28, picked up 0, remaining 28, 6 allotment rows.
- `bun test tests/order623-group-block-workbench.test.ts`: 2 pass, 0 fail, 19 assertions.
- `bun run typecheck`: pass.
- Local health: `{"status":"ok"}`.

## Decision

Approved. No remaining findings from the final re-check.
