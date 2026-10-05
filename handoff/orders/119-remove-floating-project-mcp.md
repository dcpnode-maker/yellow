# ORDER 119 — remove floating project MCP launchers

**Phase:** 5 · **Branch:** `phase-5/remove-floating-project-mcp`
**Base:** `fb7571b58cf13021bd8777f1e1d32b443aa9527a`
**Written by:** acting order owner · **Date:** 2026-08-24
**Tier:** 2 (credentialed supply-chain/configuration risk; independent
non-implementing review required)
**Status:** APPROVED at exact corrected implementation SHA `7ba93e4cfe88648e2f3b8bd8fe2edd93e7fdfdc1`; integration pending

## Goal

Close only the sealed Cyber finding `supply-chain.unpinned-project-mcp`
(`occ_f2201362eef2a3df87abf1b3`) by removing all repository auto-launched third-
party MCP commands from both project configuration dialects.

## Why now

`.mcp.json` and `.codex/config.toml` currently launch three packages through
unattended `npx -y`: `@modelcontextprotocol/server-postgres`,
`@modelcontextprotocol/server-github`, and `@upstash/context7-mcp@latest`.
This permits moving package code to run with local privileges, a database DSN,
and (for GitHub) `GITHUB_TOKEN`. The official npm pages identify the Postgres
server version 0.6.2 and GitHub server version 2025.4.8 as deprecated. Yellow
already has local `psql`/repository scripts for Postgres, `git`/`gh` for GitHub,
and built-in web/documentation access for current library docs. Removing the
unused launchers reduces both credential and context surface at zero runtime
cost; it does not remove Yellow's future ability to add a reviewed, explicitly
approved tool later.

Order 117 is the unrelated login-abuse-controls order and is explicitly out of
scope. Graphify and local project skills are unrelated and must remain untouched.

## Scope — files the implementer may create or change

Configuration and documentation:

- `.mcp.json`
- `.codex/config.toml`
- `docs/TOOLING.md`
- `docs/CODEX.md`

Static proof:

- one focused validator test under `tests/` (or one focused validator under
  `scripts/` plus its narrowly necessary test; choose one shape and keep it
  self-contained)

After the implementation is green, record the bounded result only in:

- this order file, if a checklist/status correction is needed;
- `handoff/LEDGER.md`;
- `DECISIONS.log`;
- the corresponding independent review file under `handoff/reviews/`;
- the existing project status artifact, only where its generated/status contract
  requires the finding/order to be represented.

Anything else is out of scope. If another file is required, stop and write a
question under `handoff/questions/119-*.md`; do not widen scope silently.

## Required implementation

1. Replace `.mcp.json` with a valid empty MCP configuration, retaining the
   `mcpServers` object with no server entries: `{ "mcpServers": {} }` (or an
   equivalent valid JSON representation).
2. Replace `.codex/config.toml` with a valid empty MCP configuration. Retain the
   project comments if useful and use an empty `mcp_servers` table; do not leave
   any `command`, `args`, package name, registry URL, credential environment
   variable, or launcher stanza.
3. Update `docs/TOOLING.md` and `docs/CODEX.md` so they no longer claim that the
   three servers are wired/connected, instruct users to export a token for them,
   or promise first-use `npx` installation. Explain the deprecation/functional
   tradeoff and the supported local replacements. Remove the future Playwright
   example containing `@playwright/mcp@latest`; if future tooling is mentioned,
   say that it requires a separate reviewed order with an exact provenance
   record.
4. Add one static, network-free validator that parses/checks both configuration
   files and proves the safety contract. It must reject any external package
   launch specification, including `npx`, `npm`, `bunx`, shell URLs, bare package
   names, `@latest`, tags, and version ranges; reject credential-bearing MCP
   environment entries; require the JSON and TOML configurations to represent
   the same empty-server behavior; and fail closed on malformed/unknown launcher
   stanzas. It must not install, resolve, start, or contact any MCP server.

## Parent-red proof (must fail before the change)

Run the focused validator at the exact base commit. It must fail and identify the
existing external launcher/package entries in both `.mcp.json` and
`.codex/config.toml`, including the explicit `@latest` tag and the GitHub token
environment entry. A fixture-only assertion is insufficient: the proof must read
the repository files and fail on the parent.

## Green proof (reviewer executes independently)

- Focused validator passes on the implementation commit with no network,
  install, process launch, Docker, database, or credentials.
- Validator confirms both configs are valid and semantically empty, with zero
  external package launch specs/tags/ranges and no MCP credential environment.
- Static search over the allowed config/docs surface finds no active MCP launcher
  or floating Playwright example.
- `bun test`, `bun run typecheck`, import boundaries, licences and dependency
  audit remain green. Exact schema and both protected hashes remain unchanged.
- The mandatory isolated `./setup.sh --db-only`/platform-equivalent pre-PR gate
  applies eleven migrations, retains 85 public tables, and prints canonical
  referee `11 passed, 0 failed of 11` even though this order changes no database
  behavior.
- `git diff --check` passes and the diff is restricted to Scope.

## Provenance and security boundary

This order deliberately removes the launchers rather than replacing them with
new versions. No npm package, checksum, registry metadata, or network evidence
may be introduced. Any future MCP reintroduction requires a separate order that
names exact versions, provenance/integrity evidence, maintainer/deprecation
review, credential scope, and an executable static/runtime proof.

## Forbidden in this order

- Pinning or upgrading the deprecated MCP packages instead of removing them.
- Adding replacement MCPs, plugins, package dependencies, global installs, or
  vendored artifacts.
- Network access or npm/Bun package resolution for MCPs, any MCP startup, or use
  of `GITHUB_TOKEN`. Ordinary repository tests and the mandatory isolated
  Docker/PostgreSQL setup/referee gate remain required and must not start an MCP.
- Editing application code, CI, migrations, Compose, Graphify outputs, local
  skills, Order 117 files, or unrelated status/features.
- Deleting either config file unless a client-behavior proof demonstrates that
  deletion is valid; the default is to retain valid empty configs.
- Treating absence of a server as proof that a replacement integration works.

## Review and closure

The implementer may not approve the change. An independent non-implementing
reviewer must personally run the parent-red and green validator proofs and inspect
the exact config/doc diff. The finding is closed only when the reviewer confirms
that all three repository auto-launched MCPs and the floating Playwright example
are gone, the deprecation/functional tradeoff is documented, and no unrelated
finding or order (especially Order 117) is claimed as fixed.

## Founder choice

No founder choice is required to execute this removal. Reintroducing any MCP,
choosing a future replacement, or requiring checksum-enforced package caching is
deferred to a separately approved order.

## Definition of done

- [x] Order and parent-reading validator are committed before configuration edits.
- [x] Parent red reads the real floating project configurations and fails exactly
      at `5c147b2`.
- [x] Both project configurations are valid, mirrored and contain zero MCP servers
      at implementation `014afb0`.
- [x] Tooling documentation names supported local replacements and no floating launcher.
- [x] Corrected focused validator, default tests, typecheck, import boundaries,
      and exact-base diff check pass at correction `7ba93e4`.
- [x] Standing, dependency-audit, integrity, and mandatory referee gates are
      rerun on the corrected tip; independent re-review remains separate.
- [x] Independent non-implementing reviewer approves the exact corrected implementation SHA.
- [x] Closure is exclusive to the named MCP supply-chain finding; no replacement or
      unrelated Cyber capability is claimed.

## Builder evidence (not review)

`5c147b2` is the intentional parent-red commit. Independent review rejected
`014afb0`: its TOML validator accepted duplicate `[mcp_servers]` tables and
illegal control characters, and its parent-red diagnostics did not explicitly
identify package/tag/env markers. Correction is pending; no finding closure is
claimed.

Correction `7ba93e4` adds fail-closed duplicate-table/control-character checks,
sanitized package/tag/env diagnostics, permanent negative fixtures, and parent
snapshot assertions. Its focused proof passes 3/3 with 7 assertions; default
`bun test` passes 166/0 with 1,924 assertions; typecheck and 64-file import
boundaries pass; `bun run license-check` passes; and
`git diff --check fb7571b58cf13021bd8777f1e1d32b443aa9527a..7ba93e4` is clean.
The junction-local zero-package licence result is discarded; byte-identical
package/lock/checker inputs pass 23 packages on the installed root tree. Audit is
clean, schema and protected hashes are exact, and isolated setup applies eleven
migrations, retains 85 public tables and passes referee 11/11 before its disposable
stack is removed. No MCP was installed, resolved, or started. Independent review
remains pending.
