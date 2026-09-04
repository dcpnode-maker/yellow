# START-HERE.md — from zip to Phase 0

Nine steps, about 30 minutes, most of it waiting on installers. `USAGE.md` is the
ongoing operating manual; this file is day one only.

Legend: **[you]** = something only you can do · **[auto]** = `setup.sh` handles it.

---

## Step 1 — Install the tools **[you]**

On macOS, with [Homebrew](https://brew.sh):

```bash
brew install git node python3 gh
brew install --cask docker          # or: brew install colima docker
curl -fsSL https://bun.sh/install | bash
```

Why each: **git** version control · **node** runs the three MCP servers via `npx` ·
**python3** runs the invariant battery · **gh** creates and pushes the GitHub repo ·
**Docker** runs PostgreSQL and Valkey · **bun** is the runtime from Phase 0 onward.

Then **start Docker** (open Docker Desktop, or `colima start`). Verify:

```bash
git --version && node -v && python3 -V && bun -v && docker info | head -3
```

## Step 2 — Get a GitHub token **[you]**

github.com → Settings → Developer settings → Personal access tokens → **Fine-grained
tokens** → Generate new token. Scope it to *only* the repo you're about to create,
with Contents + Issues + Pull requests read/write. Then:

```bash
echo 'export GITHUB_TOKEN=github_pat_...' >> ~/.zshrc
source ~/.zshrc
```

This is what the `github` MCP server authenticates with. Least scope, revocable.

## Step 3 — Unzip Yellow **[you]**

```bash
cd ~/projects            # or wherever you keep code
unzip ~/Downloads/yellow.zip
cd yellow
ls                       # you should see CLAUDE.md, setup.sh, migrations/, tests/
```

## Step 4 — Run setup **[auto]**

```bash
chmod +x setup.sh bootstrap.sh    # if you get "Permission denied"
./setup.sh                        # or: bash setup.sh
```

It will, in order: check prerequisites → start PostgreSQL and Valkey → migrate and
seed `yellow_dev` → recreate `yellow_test` through the production runner → load only
the two-tenant fixture → run the invariant battery → verify application health.

Option: `--db-only` runs the database path without starting/verifying the app.

## Step 5 — Confirm the gate **[you]**

The run must end with:

```
RESULT: 11 passed, 0 failed of 11
✔ All invariants green on this machine
```

**Do not continue if this is red.** Those eleven tests are the floor: no
double-booking under concurrency, an unbreakable ledger, sealed days, gapless
invoice numbers, tenant isolation through both tables and views. If they fail here,
they'll fail louder in production.

## Step 6 — Sanity-check the database **[you]**

```bash
docker compose exec postgres psql -U yellow -d yellow_test \
  -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
```

Expect **81**: 80 immutable baseline tables plus `schema_migration`.

For a second worktree, select a distinct Compose project and host-port triplet:

```bash
COMPOSE_PROJECT_NAME=yellow-review YELLOW_APP_PORT=3100 \
YELLOW_POSTGRES_PORT=5542 YELLOW_VALKEY_PORT=6489 ./setup.sh --db-only
```

## Step 7 — Open Claude Code **[you]**

```bash
claude
```

from inside `yellow/`. Then:

```
/mcp
```

All three should read **connected**: `postgres` (reads your real schema while
coding), `github` (issues and PRs), `context7` (live library docs, so it doesn't
call a Bun method that was removed two releases ago).

If `postgres` is down → containers aren't running (`docker compose up -d`).
If `github` is down → `GITHUB_TOKEN` isn't exported in *this* shell.

## Step 8 — Set the model **[you]**

```
/model
```

Choose **Fable 5** for the Phase 0 kickoff — it's a schema-and-foundations phase, and
`CLAUDE.md` routes those to Fable. After the scaffold is up, switch to Opus 5 for
implementation work and Sonnet 5 for tests and docs. The escalation rule in
`CLAUDE.md` governs when to switch back up.

## Step 9 — Start the current ordered work **[you]**

First, see where you stand — this is the command every agent runs at the start of
every session, and it prints the same ground truth for all of them:

```bash
./state.sh
```


Paste exactly this:

```
Read PROJECT.md, then your role adapter and BUILD-PLAN.md. Run ./state.sh and work
only from the current reviewed order. Keep the invariant battery green.
```

Phase 0 is done when: `bun test` is green in CI · a fresh clone can
`docker compose up` → migrate → seed → return 200 on health · the RLS smoke test
proves cross-tenant reads return zero rows **through views as well as tables** · and
the schema-drift check (dump vs `migrations/0001_init.sql`) is empty.

---

## What each file is for

| File | Role |
|---|---|
| `START-HERE.md` | This checklist. Day one only. |
| `PROJECT.md` | **The canonical constitution — every agent reads this first.** Invariants, boundaries, standards, session ritual. |
| `state.sh` | Ground truth for any agent: phase, last decisions, open work, service status. |
| `AGENTS.md` | Adapter for Codex (builder role). `CLAUDE.md` is the Claude adapter (architect/reviewer). |
| `handoff/` | How the agents talk: orders, reviews, questions, LEDGER, ROSTER. |
| `docs/WORKFLOW.md` | Build→review loop and git conventions. |
| `docs/CODEX.md` | Running Codex alongside Claude Code. |
| `docs/MERGE-PLAN.md` | Combining Yellow with your existing PMS. |
| `USAGE.md` | Operating manual: daily loop, rules, troubleshooting. |
| `CLAUDE.md` | The constitution Claude Code reads every session — invariants, boundaries, model policy. |
| `BUILD-PLAN.md` | 18 phases (0–17), each with a Definition of Done and decision gates. |
| `DECISIONS.log` | 44 locked decisions with rejected alternatives. Append forever. |
| `README.md` | Package map and the honest statement of what's not built yet. |
| `setup.sh` | One-command setup; `--db-only` to rebuild and retest. |
| `bootstrap.sh` | Git + GitHub only (subset of setup.sh). |
| `docker-compose.yml` | App/PostgreSQL/Valkey with configurable host ports and Compose-project isolation. |
| `.mcp.json` | postgres + github + context7 for Claude Code. |
| `.claude/settings.json` | PostToolUse hook: format and typecheck after edits. |
| `.claude/skills/yellow-*` | Three project skills, shared via git so both founders get identical behaviour. |
| `.env.example` | Copy to `.env` and fill. Never committed. |
| `migrations/0001_init.sql` | The validated schema — 80 tables, RLS, choke points. **Never edit; add new migrations.** |
| `docs/CONTRACTS.md` | API conventions and the availability contract. |
| `docs/STATE-MACHINES.md` | Every legal status transition and its guards. |
| `docs/EVENTS.md` | Event envelope, subjects, catalogue, consumers. |
| `docs/EXTENSIONS.md` | JSON Schemas for verticals, tax, policies, statutory, fiscal. |
| `docs/UI-SPEC.md` | Surface model, 12 screens, keyboard grammar, budgets. |
| `docs/SECURITY.md` | Threat model and controls. |
| `docs/DEPENDENCIES.md` | Vendor risk register and licence policy. |
| `docs/TOOLING.md` | MCP servers, what to add later, marketplace vetting rule. |
| `docs/PACKAGE-AND-COST.html` | Package summary and cost strategy. |
| `docs/mockups/ui-v1.html` | Five UI screens rendered from fixture data. |
| `tests/run_invariants.py` | The battery. Must stay green. |
| `tests/PMS_QA_Test_Suite.md` | 56 test cases across the guest journey. |
| `tests/seed_fixture.sql` | Two tenants, 16 spaces, rates, accounts, business days. |
| `tests/occupancy-stress.test.ts` | TypeScript port for the Bun suite (Phase 2). |
| `tests/RUN-RESULTS.md` | Evidence record of the 11/11 run. |
| `prototype/` | The stress test that found the double-sell, and its results. |

---

## In parallel — start these today, they run on calendar time

Certifications gate Phases 8, 9, and 12, and none of them move faster because you're
ready: **Booking.com** and **Expedia** partner programmes, **ZATCA** sandbox
onboarding (Saudi), **India IRP/GSP** access, and choosing a **UAE ASP** vendor.
Also worth doing while installers run: the Claude for Startups application and AWS
Activate. See `USAGE.md` §7.
