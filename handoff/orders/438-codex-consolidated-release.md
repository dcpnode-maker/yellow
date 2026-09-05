# Order 438 — Codex-owned consolidated release and current project record

Status: ACTIVE — implementation and independent verification in progress.

## Authority and intent

Ankit's 2026-09-05 directive in the Astra takeover conversation authorizes Codex as
Yellow's sole development and coordination owner, internal model delegation,
consolidation of working user flows into main, accurate core project files, cleanup
of superseded pull requests, a matching local app, and a traceable Git-to-cloud
delivery path. It also asks that the earlier shared conversation and Astra's
independent research become part of the canonical Yellow task.

The shared source is https://chatgpt.com/share/6a9c5732-db10-83e9-b237-2f507e686e77.
The full visible conversation was read; redacted assistant entries are not evidence.
This order preserves all 18 phases and all product requirements. It does not declare
unfinished native fiscal issuance, voice, RMS, native clients or provider integration
complete. Independent executable review remains mandatory; no implementer self-merges.

## Scope

- Integrate the current PR80 operational application and fresh upstream checkpoints
  without rewriting history or discarding uncommitted work in older checkouts.
- Core status and ownership: PROJECT.md, AGENTS.md, CLAUDE.md, README.md,
  BUILD-PLAN.md, START-HERE.md, START-HERE-WINDOWS.md, USAGE.md,
  docs/CODEX.md, docs/WORKFLOW.md, docs/PROJECT-MAP.md, docs/TOOLING.md,
  docs/LOCAL-REVIEW.md, docs/ARCHITECTURE-V1.md and docs/YELLOW-CONSTITUTION.md
  (current-state pointers only; preserve their architectural/product destination),
  handoff/ROSTER.md, handoff/ROADMAP.md and handoff/PHASE-7-PLAN.md.
- Add docs/PROJECT-STATUS.md, docs/RELEASE.md, docs/research/ASTRA-TAKEOVER-REVIEW.md,
  handoff/CONSOLIDATION-MANIFEST.json, release-review evidence and a single current
  task entry. Preserve append-only DECISIONS.log and handoff/LEDGER.md history.
- Truthful status tooling: state.sh, state.ps1, scripts/state*, matching status tests;
  recognize review evidence without treating historical order creation as open work.
- Reproducible local/release setup: package.json, bun.lock if dependency changes are
  necessary, Dockerfile, .dockerignore, docker-compose.yml, .env.example, setup.sh,
  setup.ps1, scripts/local*, scripts/release*, scripts/build*, scripts/verify*,
  .github/workflows/ci.yml and .github/workflows/release.yml, release provenance in
  src/app.ts, src/server.ts, src/kernel/build-info.ts and focused corresponding tests.
- Exact stale catalogue assertions may be updated for Order439's added containment
  migration; existing financial/tenant/occupancy assertions must not be weakened.
- Close PRs whose implementation is proven preserved; preserve exact refs and unique
  files for distinct older OTA/Android/prototype work before closing their old PRs.
  Do not merge conflicting historical order identities into active handoff records.

## Companion safety scope

Order439 separately contains rejected migration0074's issue capability using a new
forward migration. Orders438/439 must be reviewed together as the release candidate.
Order434 development and evidence remain preserved but unreleased until complete.

## Acceptance

1. Exact source commit, migration frontier, active work and deferred scope are visible
   and consistent across main status, local app/release metadata and GitHub.
2. Fresh/upgrade/no-op migrations, schema and real PostgreSQL 11/11 invariants pass;
   independent reviewer personally runs the high-risk proof and relevant operational,
   financial and tax compatibility suites. Skipped tests are reported separately.
3. Main changes only through reviewed PR; obsolete PR closure preserves provenance.
4. Local app starts with real isolated PostgreSQL and usable review data, with exact
   start/stop/update instructions. A scratch preview is not the user's Windows host.
5. Release automation builds a traceable immutable image after green CI, uses separate
   deployment/runtime authority and fails closed when no approved cloud target is
   configured. Do not invent OCI hosts, credentials, DNS, or a deployed public URL.
6. The review explains findings, remedies, evidence and remaining product work plainly.

## Forbidden

No force push; no rewriting applied migrations; no synthetic financial/provider
completion; no direct production data cleanup; no new spending or accounts; no broad
runtime grants; no review bypass; no statement that planned work is shipped.
