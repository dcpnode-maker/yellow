# Order 618 — repeatable public demo promotion

## Objective

Make the live Yellow public-demo promotion path repeatable from the current live
source folder, including the required Yellow Next asset mirroring step.

## Scope

- Add a script that:
  - runs focused verification commands,
  - builds Yellow Next,
  - mirrors `frontend/yellow/public/yellow-next` into Docker's packaged
    `public/yellow-next`,
  - rebuilds/restarts only the app service with the existing runtime compose files,
  - verifies local and public health.
- Add focused tests for the script's safety checks.

## Out of scope

- Database migrations or cutover.
- Git push/merge.
- Cloudflare named tunnel creation.
- Secret handling changes.

