# Order 616 — PostgreSQL 18 proof and scripted cutover

## Scope

- Add a guarded local script for restoring the current Yellow public-demo database dump into PostgreSQL 18.
- Keep live PostgreSQL 16 untouched unless an explicit cutover flag is used.
- Preserve the existing live PostgreSQL volume during cutover; never delete it in this order.
- Verify tenant/RLS/view/index/constraint safety checks after restore.
- After founder approval, align the local repository default Compose PostgreSQL service and canonical stack references to PostgreSQL 18 while preserving the old PostgreSQL 16 volume by using a new PG18 volume name.

## Out of scope

- Editing schema migrations.
- Editing `migrations/0001_init.sql`.
- Changing PMS business logic.
- Moving production or real hotel data.
- Creating permanent Cloudflare credentials.

## Acceptance

- Proof restore into PostgreSQL 18.6 succeeds from the laptop/Drive-backed dump.
- Core table counts match the current live database.
- RLS/view hardening checks return zero failures.
- The cutover path is scripted but not executed unless explicitly requested with the cutover flag.
- Repository defaults point new local/CI Compose runs at PostgreSQL 18 without mounting a PostgreSQL 16 data directory into a PostgreSQL 18 server.
