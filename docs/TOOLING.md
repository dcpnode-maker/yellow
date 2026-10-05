# TOOLING.md — MCP servers, plugins, skills

Principle: **a short, well-chosen set beats a long one.** Every server adds tool
definitions to the agent's context budget, and every credential widens the surface
you have to trust. Three servers is the starting set; add one only when a phase
needs it.

## Wired in this repo (`.mcp.json`) — nothing to install

| Server | What it gives Claude Code | Auth |
|---|---|---|
| **postgres** | Reads your real schema and data while coding — no more guessing column names. Points at `yellow_dev` on localhost. | none (local) |
| **github** | Issues, PRs, branches, code search. Turns Claude Code into a participant in the repo, not just an editor. | `GITHUB_TOKEN` env var |
| **context7** | Live, version-specific library docs (MIT, open source). The fix for a model confidently calling a Bun or Elysia method that was removed two releases ago. | none needed; a free key at context7.com/dashboard raises rate limits |

`npx` fetches each on first use — no global install. Open Claude Code in this folder,
run `/mcp`, and all three should read **connected**.

### Two things you must do
1. **GitHub token** — create a fine-grained PAT (repo scope, this repo only), then
   `export GITHUB_TOKEN=ghp_...` in your shell profile. Least scope, revocable.
2. **Database running** — `./setup.sh` applies the runner and demo seed to
   `yellow_dev`, then uses the runner plus the separate fixture for `yellow_test`.
   `docker compose up -d postgres` only starts the service; it does not migrate it.

## Add later, at the phase that needs it

```bash
# Phase 10 — real-browser tests for keyboard flows and offline sync
claude mcp add playwright -- npx -y @playwright/mcp@latest
```

Error tracking gets an MCP once GlitchTip is actually running (Phase 0 ops). Add
nothing else speculatively — an unused server costs context on every single session.

## Deliberately NOT installed

- **Filesystem MCP** — redundant. Claude Code ships Read/Edit/Write/Glob/Grep with
  permission rules and sandboxing.
- **Web search MCP (Exa etc.)** — Claude Code has web search built in. Exa stays
  useful in the claude.ai chat for research, which is where it's already connected.
- **Everything else in the marketplace** — see the rule below.

## Optional: cost observability (vet before installing)

Useful given the model-routing policy in CLAUDE.md — these read local session logs
and show which tool, agent, MCP server, or skill is actually burning quota, so you
can verify the policy works instead of assuming it:

```bash
npm install -g claude-token-lens     # read the source first — see rule below
```

Deliberately not wired into `setup.sh`: auto-installing third-party global packages
is exactly the risk the rule exists to prevent.

## The rule for anything from the marketplace

The Claude Code plugin ecosystem is enormous — thousands of plugins across ~200
community marketplaces — and largely unvetted. **Skills, hooks, and MCP servers
execute on your machine with your GitHub token and database credentials.** This is
DEPENDENCIES.md's supply-chain risk pointed at your laptop.

Before installing anything:

1. **Read the code.** A hook is a shell command that runs on every tool use. Open it.
2. **Permissive licence** (MIT/Apache-2.0) and a real maintainer — prefer Anthropic's
   official directory or a first-party vendor server over an anonymous repo.
3. **Recent commits, real users, an issue tracker with answers.**
4. **Ask what it replaces.** If the answer is "nothing we do today," skip it.

## Your own skills beat all of it

`.claude/skills/` already holds three skills encoding decisions no generic skill can
know — that folios belong to accounts, that views bypass RLS, that UAE clearance must
be provider-routed. When a pattern repeats across phases, write a fourth. That is
strictly better than shopping for one.
