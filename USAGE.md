# USAGE.md — how to use Yellow

**Yellow** is the codename for this project: a multi-tenant hospitality ERP built as a
modular monolith on TypeScript/Bun/Elysia over PostgreSQL 16. It is deliberately
isolated by its Compose project, databases, and configurable host ports (defaults:
app 3000, PostgreSQL 5442, Valkey 6389).

---

## 1. First run (once, ~10 minutes)

```bash
unzip yellow.zip && cd yellow
./setup.sh
```

What it does: checks prerequisites → starts PostgreSQL and Valkey → runs the
production migration and deterministic demo seed on `yellow_dev` → recreates
`yellow_test` through the same runner → loads only the two-tenant fixture → runs the
invariant battery. Full setup also verifies exact application health.

You are ready when you see `RESULT: 11 passed, 0 failed`. If you don't, stop and fix
that first — those eleven tests are the floor the whole system stands on.

`--db-only` runs the database path without starting/verifying the app. Setup never
creates external accounts or repositories.

## 2. Daily loop

```bash
cd yellow
./state.sh                         # ground truth: phase, decisions, open work
docker compose up -d               # if not already running
codex                              # open OpenAI Codex here
```

In Codex, first session of the day:

```
/mcp                               → postgres, github, context7 all "connected"
```

Then work one phase at a time:

```
Read PROJECT.md, then your role adapter and BUILD-PLAN.md. Run state.sh and work only
from the current reviewed order.
```

A phase can run for hours largely unattended — writing code, running tests, fixing
failures. Check in, answer questions, let it work.

## 3. The rules that keep it coherent

- **Run `./state.sh` first.** Every agent, every session — it prints identical
  ground truth so nobody starts from a stale picture.
- **`PROJECT.md` is the constitution.** `AGENTS.md` adds Codex's role. The legacy
  `CLAUDE.md` adapter is inactive. If an adapter disagrees, PROJECT.md wins.
- **One phase per session.** If a session spans phases, stop and re-scope.
- **Green before moving on.** A phase is done when its Definition of Done passes in
  CI — not when the code "looks right."
- **Log decisions.** Anything decided goes in `DECISIONS.log`, one line, with the
  alternative rejected. This is what stops the same question being re-litigated at
  your expense in session 60.
- **Model routing** (in `AGENTS.md`): use the strongest Codex model for architecture,
  security, schema-adjacent reasoning, concurrency, and phase gates. Use faster models
  only for routine work already bounded by an order.
- **Never edit `migrations/0001_init.sql`.** Schema changes are new numbered
  migrations. The file is the validated baseline.

## 4. When something breaks

| Symptom | Do this |
|---|---|
| Tests fail after a change | `./setup.sh --db-only` — rebuilds and re-runs. If still red, the change broke an invariant; that's the test doing its job. |
| Port already in use | Set `YELLOW_APP_PORT`, `YELLOW_POSTGRES_PORT`, and `YELLOW_VALKEY_PORT`; do not edit Compose or stop another worktree. |
| `/mcp` shows postgres disconnected | Containers down (`docker compose up -d`) or DSN mismatch with `docker-compose.yml`. |
| `/mcp` shows github disconnected | `GITHUB_TOKEN` not exported in the shell that launched Codex. |
| Codex targets an outdated API | Require a Context7/official-doc check before implementation. |
| Something is deeply wrong | Give Codex the exact error and logs; it can inspect the shell, files, and database. |

## 5. Where everything lives

```
yellow/
├── PROJECT.md             canonical constitution — read every session
├── AGENTS.md              Codex primary-lead adapter
├── BUILD-PLAN.md          13 phases, each with a Definition of Done
├── DECISIONS.log          43 locked decisions; append forever
├── setup.sh               one-command setup / --db-only rebuild
├── docker-compose.yml     app/PostgreSQL/Valkey, isolated by Compose project
├── .mcp.json              postgres + github + context7
├── .claude/skills/        three Yellow-specific skills, shared via git
├── migrations/0001_init.sql   the validated schema (80 tables) — never edit
├── docs/                  CONTRACTS · STATE-MACHINES · EVENTS · EXTENSIONS
│                          UI-SPEC · SECURITY · DEPENDENCIES · TOOLING
│                          PACKAGE-AND-COST.html · mockups/ui-v1.html
├── tests/                 invariant battery, QA suite, seed fixture
└── prototype/             the stress test that found the double-sell
```

## 6. Optional: a ChatGPT Project for strategy chats

Codex builds in the repository; a ChatGPT Project can hold strategy context. Create
one named **Yellow** and add `PROJECT.md`, `AGENTS.md`, `BUILD-PLAN.md`,
`DECISIONS.log`, and the relevant `docs/*.md` files with instructions:

> This project builds Yellow, a multi-tenant hospitality ERP. PROJECT.md and
> DECISIONS.log govern; never contradict a locked decision without flagging it
> explicitly. Prefer verification by execution over assertion.

Re-upload `DECISIONS.log` whenever it grows meaningfully — that keeps strategy chats
in sync with what the build has actually settled.

## 7. What isn't done yet

Application code — all of it. Phases 0–12 derive it from these specs. Also yours to
start now, because they run on calendar time rather than build time: Booking.com and
Expedia partner certification, ZATCA sandbox onboarding, India IRP access, and a UAE
ASP vendor. Those gate Phases 8, 9, and 12.

---

**Next command:** `./setup.sh`, then `./state.sh` and the current issued order.
