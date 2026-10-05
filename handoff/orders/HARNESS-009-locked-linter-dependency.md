# HARNESS-009 — Restore one locked linter dependency

Status: LOCAL TOOLING PROOF COMPLETE. 2026-09-28. Explicit revision 2
after recording HARNESS-009-effect-plugin-link.md; no silent scope expansion.

## Authority and scope

Standing implementation authority permits restoring the exact reviewed lockfile
dependency needed to verify the scoped manual-transfer source. The plugin's
node_modules link is absent; the cache has only 1.79.0, whereas its importer locks
@oxlint/plugins 1.68.0. Do not substitute the cached newer version or disable lint.

Scope: one official npm archive for @oxlint/plugins 1.68.0 under marked
state-pilot/artifacts/npm-gate, its extracted package there, and one new ignored
dependency junction at t3code/oxlint-plugin-t3code/node_modules/@oxlint/plugins.
Revision 2 additionally permits exactly two new ignored dependency junctions
for effect and @effect/platform-node 4.0.0-rc.112, pointing to the existing
apps/web and apps/server importers' resolved reviewed package targets.
This order, its review and append-only governance ledger are also in scope.

No source/lockfile/package manifest changes, lifecycle scripts, dependency purge,
broad install, provider activation, model inference, database or production edits.
If another dependency or source change is required, stop this slice and record it.

## Proof

Match the downloaded archive SHA512 against pnpm-lock.yaml integrity, before
extraction/use. Reject existing junction/targets rather than overwrite. Then
execute only the focused HARNESS-008 linter check with all plugins enabled.
