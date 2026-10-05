# PR-FIX-012 - Restore the existing frontend delivery budget

Founder authority: repair existing PRs. PR97's real frozen suite measures its
committed emitted entry at 215300 bytes against the unchanged 200000-byte cap.

## Scope

- `frontend/yellow/vite.config.ts`: assign existing shared local voice/API/query
  utility modules to a named Rolldown chunk; preserve React/vendor chunks and
  lazy finance/reservation workspaces. Do not edit application behavior.
  Disable copying the unused frontend/public/yellow-next recovered compiled
  backup into the generated output: the backend serves only its emitted index
  and direct assets. Preserve that original backup source byte-for-byte.
- `tests/yellow-frontend-bundle-splitting.test.ts`: pair the explicit source split
  with real emitted entry/chunk/manifest checks and existing exact budgets.
- `public/yellow-next/index.html` and its directly referenced generated assets:
  Vite's normal scoped rebuild in that configured generated output only. Old
  generated hashed assets may be replaced; no other public directory is in scope.
- This order, paired question and receipt, ignored finite proof logs/artifacts.

Do not raise 200000/500000-byte limits, suppress warnings, change dependencies or
licence decisions, replace lazy modules with duplicate entry code, change tenant
or finance commands, or alter live services. The pinned metadata/lockfile and all
migrations remain unchanged. Unrelated files are excluded.

## Acceptance

Frozen build, actual emitted byte/manifest proof, types/boundaries, full native
suite and real reservation/finance lazy navigation where existing finite fixtures
support it. This remains an unaccepted source candidate pending dependency policy,
the isolated referee and independent invariant-adjacent acceptance.
