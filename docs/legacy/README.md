# docs/legacy/ — capture from the existing PMS

Drop here before the merge (see ../MERGE-PLAN.md):
- `schema.sql` — pg_dump --schema-only of the existing database
- `screens/` — screenshots of every screen, incl. empty and error states
- `features.md` — one line per feature: keep · rethink · drop
- `usage-notes.md` — what got used daily, what was dead, what annoyed you
- `sample-data/` — a few anonymised reservations/folios as migration fixtures

This folder is INPUT to Yellow, never a source of code to copy.
