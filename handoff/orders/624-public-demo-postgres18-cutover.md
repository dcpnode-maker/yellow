# Order 624 — Public demo PostgreSQL 18 cutover

## Scope

- Upgrade the isolated public-demo PostgreSQL container from PostgreSQL 16 to PostgreSQL 18.
- Preserve the existing PostgreSQL 16 volume/container data; do not delete or overwrite it.
- Use a fresh custom-format dump from the current public-demo database.
- Restore into a fresh PostgreSQL 18 volume.
- Run core safety checks after restore: version, counts, RLS, security-invoker views, invalid indexes, invalid constraints.
- Keep app and tunnel on the same canonical source checkout.

## Out of scope

- Schema redesign.
- Editing `migrations/0001_init.sql`.
- Production/customer data.
- Removing the preserved PostgreSQL 16 rollback volume.

## Verification

- PostgreSQL reports version 18.x.
- Public app `/health` returns `{"status":"ok"}`.
- Public colleague readiness probe passes.

