# Order 602 — Cumulative execution-artifact reconciliation

## Objective

Remove the final environment-shaped cumulative-suite failures by making the Windows
PriceLabs proof collision-safe and regenerating the committed Yellow frontend from
the already accepted source and bundle-splitting configuration.

## Scope

- `tests/pricelabs-import.test.ts`
- `public/yellow-next/index.html`
- `public/yellow-next/assets/*`

No application source, backend/API, database, migration, seed, dependency,
credential, configuration, or product behavior is in scope.

## Required behavior

1. The Windows ACL wrapper test creates a unique private parent for every execution;
   it must not depend on or collide with a fixed directory retained by a prior run.
2. Cleanup remains bounded to test-created unique roots and never deletes a shared or
   repository directory.
3. The committed Yellow frontend is rebuilt from `frontend/yellow` with the accepted
   Vite/Rolldown split configuration.
4. Every emitted JavaScript chunk remains below 500 kB and the HTML-selected app
   entry remains below 200 kB.
5. No assertion is weakened and no production behavior is hand-edited in generated
   output.

## Acceptance evidence

- `tests/pricelabs-import.test.ts` passes twice consecutively on Windows.
- `tests/yellow-frontend-bundle-splitting.test.ts` passes against the regenerated
  committed output.
- Strict TypeScript and import boundaries remain green.
- The cumulative suite is rerun with Git provenance bound explicitly to the canonical
  repository when executing from the non-Git candidate directory.

## Exclusions

- No Overwatch, operator gallery, ribbon, workflow, hotel data, local-model,
  deployment, Docker, or database change.
