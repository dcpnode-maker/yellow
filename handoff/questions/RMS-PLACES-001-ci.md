# RMS-PLACES-001 — required database proof wiring

## RESOLVED

Resolved by coordinating Codex under Ankit's parallel-build authorization,
before changing CI.

The new property authorization SQL needs a real signed HTTP/two-tenant database
test. This workspace cannot run `./setup.sh --db-only`: Docker is absent. The
existing CI job already provides disposable PostgreSQL and exact deployment and
runtime roles. Admit one step in `.github/workflows/ci.yml` to execute
`tests/market-map.integration.test.ts` there with its required-environment flag.
The test creates and removes only its own randomized database. It cannot silently
skip in CI. Existing canonical gates and permissions remain mandatory.

## Renderer acceptance continuation — 13 September

Resolved by coordinating Codex under Ankit's explicit "Fix it please" request,
before changing the proof wiring. Both attempts of CI34726472461 completed green,
including map isolation and canonical11/11. The remaining map acceptance was
blocked by the cloud browser's loopback restriction. Admit a required renderer
proof in the existing GitHub quality job, using its existing installed Chromium
and repository-owned disposable browser-test convention. This does not bypass
the cloud browser, install a new MCP or change a retained runtime.

The existing `tests/operator-market-map.browser.test.ts` keeps its VM cases and
adds actual browser cases. `scripts/research/verify-market-map-browser.ts` may
export its synthetic fixture factory for an ephemeral loopback listener. The
proof must fail when required Chromium/WebGL is unavailable, inspect flat/globe
rendering at desktop and390px, keyboard/list selection, export/context reset,
same-origin requests and deliberate engine failure. Bounded screenshot/receipt
artifacts may be uploaded by CI for review. Reuse the existing action pins where
available; no dependency, authority or operational-write change is admitted.

The receiving source advanced to Order467 at da9f97d46af3cb78f1ea98e49bed03581686a5ef.
Git's merge-tree found no source conflict; incorporate the published changes and
run the new combined candidate through its own gates. A stale GitHub mergeability
flag is not evidence of a code conflict or an accepted release.

The repository had no artifact-upload pin to reuse. Admit GitHub's official
`actions/upload-artifact`v7.0.1, commit043fb46d1a93c77aae656e7c1c64a875d1fc6a0a,
MIT, Node24. Its exact action definition and licence were read through the
configured GitHub connection. Only this proof's runner-temp directory is uploaded,
with hidden files excluded and seven-day retention. Source:
https://github.com/actions/upload-artifact/tree/043fb46d1a93c77aae656e7c1c64a875d1fc6a0a.
No application package, provider credential or permission broadening is involved.
