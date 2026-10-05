# RESOURCE-20261001 — Android frontend compilation lane

Author: Codex laptop controller. Founder explicitly requires more useful phone build work and maximum parallel use of laptop, cloud and phone without duplicated source or business data.

## Scope

- This order and handoff/receipts/RESOURCE-20261001-phone-frontend-build.md; current status section is root-owned.
- Read existing frontend/yellow source, package.json, bun.lock, frontend dependencies and configuration from the authoritative laptop checkout. No product source/dependency/lockfile edits.
- Prepare exact source-bound compilation input, manifest, isolated dependency lock, scripts and logs under E:/YellowWorkspace/Data/BuildArtifacts/yellow-phone-frontend-20261001-v1/.
- Typed immutable phone requests under E:/YellowWorkspace/PhoneWorker/receipts/, dispatched by root through the existing reviewed phone_command helper with fresh actual quota guard. Private source travels only via existing authenticated targeted job queue; do not publish raw source or add coordinator/artifact endpoints.
- Stage compressed source in independently hashed bounded chunks if needed. Unique fixed relative workspace, no overwrite or path escape; verify complete archive SHA and every input before extraction/execution. Preserve old workspaces.
- Install only the isolated frontend's exact necessary packages from HTTPS npm registry, respecting actual platform support and lockfile integrity. No broad upgrades, credentials, new proxy, paid service, Android root or detached processes. Disable lifecycle scripts where feasible and explicitly admit/inspect any required native setup rather than silently enabling arbitrary install scripts.
- Actual Android Node frontend compile with Vite/Rolldown, isolated output and manifest. The installed local Rolldown1.2.9 has an Android/arm64 optional binding; TypeScript7.0.2 does not list Android support, so do not claim native Android typecheck unless actually supported and executed.
- Windows/cloud retain strict types and release/database checks. Phone compilation is Android runtime/architecture evidence, not GUI/touch acceptance, a signed APK, an iOS app, release-ready bit identity or backend authorization.

## Execution

Existing command/output/deadline bounds remain; one owned phone job at a time, no background escape or artificial busy work. Staging/install/compile are dependent phases: root verifies each before proceeding. Installation uncertainty is inspected before repair, not replayed blindly. Every command has explicit hashes/input identity, measured output and retained failures. If npm diagnostic dependencies differ from canonical Bun's resolved graph, record the difference and do not promote that artifact as the same release.

Root independently reviews the prepared requests, exact inputs and actual results. Do not enqueue from the implementation agent. New work is assigned when source changes or a distinct unresolved diagnostic justifies it; do not run the same build repeatedly to make CPU/RAM look occupied.
