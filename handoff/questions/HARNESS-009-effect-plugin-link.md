# HARNESS-009 — Additional pinned plugin links

The first exact @oxlint/plugins restoration revealed the next pre-existing
missing link: `effect` imported from oxlint-plugin-t3code/rules/no-global-process-runtime.ts.
Stopped that original slice before touching another dependency.

Routine implementation-owner resolution: explicitly revise order 009 to restore
the plugin importer's two already-present, already-used pinned build-runtime
links, effect and @effect/platform-node 4.0.0-rc.112. Resolve the actual verified
junction targets from apps/web and apps/server respectively; do not substitute
another version, edit source/lockfile, download an extra runtime or disable rules.
If another missing dependency surfaces, retain the failed check and stop again.
