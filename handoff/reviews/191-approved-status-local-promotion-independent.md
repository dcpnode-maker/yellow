# Order 191 — approved status local promotion independent review

**Conclusion:** APPROVED LOCALLY

**Reviewed governance head:** `bf1e3d8165d3de849dc0cb98dc11ea5db2e3693b`

**Admitted product:** `ce3fc95709cfeccde4bb0070ae20ba38273f6ec8`

**Reviewer:** fresh independent non-operating OpenAI Codex reviewer

## Scope and independence

The reviewer did not build or promote Order191 and did not restart, recreate, migrate,
seed or mutate the local application or database. Runtime and database verification
was SELECT/read-only. A short-lived bearer token was generated only in process memory
from the already-running secret and an existing authorized identity; neither secret
nor token was printed, persisted or copied into evidence. The protected endpoint also
returned401 without authorization.

## Runtime identity and topology

- `yellow-local-current-app-1` is the only running Compose app service. It is healthy,
  binds only `127.0.0.1:3000`, has one attachment to
  `yellow-local-current_default`, and port3002 has no listener.
- The app runs exact image
  `sha256:d7a7fdcd1da27346542367635ad0ed8cecb19c60bdeffc49e24c01fe489cf4d3`
  with exact labels `yellow.git=ce3fc95709cfeccde4bb0070ae20ba38273f6ec8`
  and `yellow.order=190`.
- Retained rollback tag `yellow-order189-rollback:5a50503e89` resolves to exact image
  `sha256:5a50503e89c44d11bd313359ca74b40ff427354790b6b2a7c0b746120777906b`.
- PostgreSQL container
  `3072977b22f6287d966fa48cc08071fa038dfa0434cc40aae1b5c8df52061c43`
  and Valkey container
  `b39d0b80c0a80bcdfdeb88755c4b76295419f3acaed82b2fb5825285108890de`
  are both healthy. Recent app logs contain no error, fatal, panic, exception or
  unhandled marker.

## Served product and protected reads

- Root, health, CSS and JavaScript return HTTP200. Served CSS SHA-256
  `ee99b2d9b46dd3f58b45383f164e45949f4b165bc699e282bfe5f3f25c2e0e72`
  and JavaScript SHA-256
  `0a1d9c510eba4f26703adbf98f7e0373c77fbb717b157237904034731e5c27fe`
  are byte-identical to the admitted source files.
- Apple, Android, Windows95/98, Glass and Neo appearance markers are all present.
- Protected authorization returns exactly three granted properties. Authenticated
  Project Status is exact: recorded date2026-08-27, latest built189, current190,
  independent review-through91, no Order187 and Phase5 active. Representative
  reservation and `FOL-1` statement reads both return HTTP200.

## Persistent no-drift and immutable financial proof

- A fresh sorted `tablename=count` LF-only canonicalization has exactly85 public
  tables and48,604 rows, with SHA-256
  `753e12bdb05db990f6940c2e7b88a4369cb588d4c3d6358e490574c86e68cac2`.
- A fresh exact Order189 four-journal projection has eight ordered elements,948
  characters and SHA-256
  `cc5e3a56f0dc6bdbd86158f4de08f8af0c4c7e01aa43bfa38eb8f8f2232153fe`.
  The canonical SQL deliberately concatenates raw `p.folio_id::text`: three
  non-folio clearing/revenue rows therefore propagate NULL and `psql -Atq` returns
  three empty-string elements. LF-joining those eight elements produces three blank
  lines. Pipe-separated columns or `concat_ws` change NULL serialization and produce
  a different, invalid comparison digest.
- All four named journals have exactly two postings and sum to zero. Direct immutable
  evidence remains four facts and four outbox events for the four journal IDs.
  `app_role` has no UPDATE or DELETE on journal, posting_line or fact_log and no
  DELETE on outbox.
- `schema_migration` remains exactly20 rows.

## Repository scope

- Exact Order191 range from approved product `ce3fc957` to governance head `bf1e3d8`
  changes only `DECISIONS.log`, `handoff/LEDGER.md` and the Order191 order.
- There is no product, test or migration diff across the promotion range.
- Exact-range `git diff --check`, worktree `git diff --check` and pre-review
  `git status --short` are clean.

## Verdict

Order191 meets its bounded definition of done and is **APPROVED LOCALLY**. This
approval is limited to the exact sole-loopback local promotion. It does not merge,
push, bind publicly, deploy production, mutate persistent data or claim Phase5
complete.
