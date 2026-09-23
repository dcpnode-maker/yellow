# Question 049 — Order 046 fresh PostgreSQL initialization race

**Order:** 046 — Reproducible local-review demo inventory
**Hard-floor trigger:** P6 standing self-check stopped before referee execution

The first fresh-volume `./setup.sh --db-only` run created the isolated Compose project,
then `scripts/migrate.ts` failed with `Connection closed`. PostgreSQL logs show the exact
race: the setup loop's in-container `pg_isready` succeeded against the image entrypoint's
temporary initialization postmaster; immediately afterward the entrypoint performed its
mandatory fast shutdown and started the final postmaster. The migration connected across
that restart. No referee test ran and no invariant result was produced.

May Order 046 gain only `setup.sh` and `setup.ps1` so readiness requires both a successful
database probe and PID 1 already being the final `postgres` process? Then remove and
recreate the exact isolated project and restart the whole P6 gate from the top, with no
timeout, migration, Compose image, database, referee or assertion change.
