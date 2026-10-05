# TOOLING.md — MCP servers, plugins, skills

Principle: **a short, well-chosen set beats a long one.** Every server adds tool
definitions to the agent's context budget, and every credential widens the surface
you have to trust. This repository starts with no auto-launched MCP; add one only
when a phase needs it and a separate order records its provenance.

## Project MCP configuration — intentionally empty

`.mcp.json` and `.codex/config.toml` retain valid, mirrored empty configurations.
They do not auto-launch third-party packages, resolve registry tags, or expose a
database DSN or GitHub token to an MCP process. This is deliberate: the official
npm pages mark the previously configured Postgres server 0.6.2 and GitHub server
2025.4.8 as deprecated, and the launch-on-first-use model created unnecessary
supply-chain and credential surface.

Use the existing local `psql`/repository scripts for Postgres, the configured
Git/GitHub connection, and the session's approved research/documentation tools.
These replacements preserve the repository workflows without silently installing
an external process. Deployment and schema/referee commands use only
`YELLOW_DEPLOY_DATABASE_URL`; the application, workers, event relay and tenant
discovery use only `YELLOW_RUNTIME_DATABASE_URL`. Never pass the deployment DSN
through an application environment or use it as a runtime fallback. A future MCP
must be introduced by a separate reviewed order
with an exact version, provenance/integrity record, and explicit credential scope.

The application additionally receives `YELLOW_EXTENSION_REGISTRAR_DATABASE_URL`
for the single authenticated extension-type registration command. That credential
must never be supplied to MCPs, migration, seed, review-seed, worker, event, login or
discovery tooling. Local setup stores its password beside the distinct deploy/runtime
passwords in the ignored owner-only authority file and Compose constructs the DSN.

## Add later, at the phase that needs it

Future tooling is not pre-wired. A future browser or error-tracking integration
requires a separate reviewed order with exact package provenance before it may be
added to either project configuration.

Error tracking gets an MCP once GlitchTip is actually running (Phase 0 ops). Add
nothing else speculatively — an unused server costs context on every single session.

## Deliberately NOT installed

- **Filesystem MCP** — redundant with the development environment's filesystem tools.
- **Generic web-search MCP** — use the session's approved research tools when a
  bounded order needs current external evidence.
- **Everything else in the marketplace** — see the rule below.

## The rule for anything from the marketplace

Agent plugin ecosystems contain many unvetted packages. **Skills, hooks, and MCP servers
execute on your machine with your GitHub token and database credentials.** This is
DEPENDENCIES.md's supply-chain risk pointed at your laptop.

Before installing anything:

1. **Read the code.** A hook is a shell command that runs on every tool use. Open it.
2. **Permissive licence** (MIT/Apache-2.0) and a real maintainer — prefer Anthropic's
   official directory or a first-party vendor server over an anonymous repo.
3. **Recent commits, real users, an issue tracker with answers.**
4. **Ask what it replaces.** If the answer is "nothing we do today," skip it.

## Your own skills beat all of it

The repository's project skills encode decisions no generic skill can
know — that folios belong to accounts, that views bypass RLS, that UAE clearance must
be provider-routed. When a pattern repeats across phases, write a fourth. That is
strictly better than shopping for one.
