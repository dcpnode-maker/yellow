# START-HERE-WINDOWS.md — Windows 11 → Phase 0

Use this instead of `START-HERE.md` if you're on Windows. Same nine steps, Windows
mechanics. Budget ~40 minutes, most of it installers and one reboot.

## Which path: WSL2 (recommended) or native Windows

Claude Code runs natively on Windows now, so this is a real choice — but for **this**
project WSL2 wins clearly, and the reasons are specific rather than aesthetic:

- Our stack is Linux-native: Docker Postgres, bash scripts (`setup.sh`), a Linux
  toolchain. Run the agent where the project actually runs.
- The MCP ecosystem was written against macOS/Linux. On native Windows you spend time
  on `spawn npx ENOENT`, path quoting, and antivirus quarantining npx-fetched binaries.
- Claude Code's sandboxed execution works on WSL2 and **not** on native Windows.
- Your co-founder's Mac and your PC then run identical commands — one set of docs.

Native Windows is supported for the database baseline through `setup.ps1`; WSL2 is
still recommended for Bun, Node-based MCP servers, and parity with Linux CI.
Everything below assumes WSL2. If you stay native, use `./setup.ps1` and
`./state.ps1` from PowerShell; install Node before enabling the bundled MCP servers.

---

## Step 1 — Install WSL2 **[you]**

Open **PowerShell as Administrator** (Start → type PowerShell → right-click → Run as
administrator):

```powershell
wsl --install -d Ubuntu-24.04
```

**Reboot when prompted.** Ubuntu opens on restart and asks you to create a Linux
username and password — these are separate from your Windows login; write them down.

Verify in PowerShell:

```powershell
wsl -l -v          # STATE Running, VERSION must be 2
```

If it says VERSION 1, run `wsl --set-version Ubuntu-24.04 2`. WSL1 lacks a real Linux
kernel and several MCP servers will fail on it.

## Step 2 — Install Docker Desktop **[you]**

Download Docker Desktop for Windows, install, launch it, then:
**Settings → Resources → WSL Integration → enable Ubuntu-24.04 → Apply & Restart.**

Verify **inside the Ubuntu terminal** (not PowerShell):

```bash
docker info | head -3
```

If that errors, the WSL integration toggle didn't take.

## Step 3 — Install the toolchain **[you]**

Everything from here runs **inside Ubuntu**. Open it from Start → "Ubuntu".

```bash
sudo apt update
sudo apt install -y git python3 python3-pip unzip curl
curl -fsSL https://bun.sh/install | bash && source ~/.bashrc
sudo apt install -y gh          # if unavailable, see cli.github.com for the apt repo
git config --global core.autocrlf input
```

That last line matters: without it, Windows-side edits introduce CRLF endings and
bash dies with `bad interpreter: /bin/bash^M`. The repo also ships `.gitattributes`
enforcing LF as a second line of defence.

Verify:

```bash
git --version && python3 -V && bun -v && node -v
```

If `node` is missing: `sudo apt install -y nodejs npm` — the three MCP servers run
through `npx`.

## Step 4 — Install Claude Code **[you]**

Install it **inside Ubuntu**, not on the Windows side — it must live where the
project lives. Use Anthropic's native installer for Linux (current one-liner is on
docs.claude.com; the npm route `npm install -g @anthropic-ai/claude-code` also works
and needs Node 22+). Then:

```bash
claude doctor      # diagnoses most setup problems
```

## Step 5 — Move Yellow into the Linux filesystem **[you]**

**This is the single most important Windows-specific step.** Keep the project in the
Linux filesystem (`~/projects`), *never* under `/mnt/c/...`. Files on the Windows
drive cross the 9P boundary — I/O is dramatically slower and file-watching breaks,
which makes Docker and dev servers miserable.

```bash
mkdir -p ~/projects && cd ~/projects
cp /mnt/c/Users/<YourWindowsName>/Downloads/yellow.zip .
unzip yellow.zip && cd yellow
ls          # CLAUDE.md, START-HERE.md, setup.sh, migrations/, tests/
```

(Replace `<YourWindowsName>` with your Windows user folder name.)

## Step 6 — GitHub token **[you]**

github.com → Settings → Developer settings → Personal access tokens → **Fine-grained
tokens** → Generate. Scope to the single repo you're about to create; Contents +
Issues + Pull requests read/write. Then in Ubuntu:

```bash
echo 'export GITHUB_TOKEN=github_pat_...' >> ~/.bashrc
source ~/.bashrc
```

## Step 7 — Run setup **[auto]**

```bash
chmod +x setup.sh bootstrap.sh    # if you get "Permission denied"
./setup.sh                        # or: bash setup.sh
```

Commits 37 files → creates the private GitHub repo `yellow` and pushes → starts
`yellow-postgres` (port 5442) and `yellow-valkey` (6389) → loads schema and fixture
→ runs the invariant battery.

**The gate:** it must end with `RESULT: 11 passed, 0 failed of 11`. Don't continue
if it's red.

Sanity check:

```bash
docker exec -it yellow-postgres psql -U yellow -d yellow_test \
  -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"   # expect 80
```

WSL2 forwards localhost, so `localhost:5442` also works from Windows-side tools
(pgAdmin, DBeaver, a browser) if you want a GUI.

## Step 8 — Open Claude Code **[you]**

```bash
cd ~/projects/yellow
claude
```

Then `/mcp` — `postgres`, `github`, and `context7` should all read **connected**.
If postgres is down, containers aren't running (`docker compose up -d`). If github is
down, `GITHUB_TOKEN` isn't exported in this shell.

Then `/model` → **Fable 5** for the Phase 0 kickoff (`CLAUDE.md` routes foundations
work to Fable; switch to Opus 5 for implementation afterwards).

## Step 9 — Start Phase 0 **[you]**

First, see where you stand — this is the command every agent runs at the start of
every session, and it prints the same ground truth for all of them:

```bash
./state.sh
```


```
Read PROJECT.md, then CLAUDE.md and BUILD-PLAN.md. Execute Phase 0.
The invariant battery in tests/ must stay green from Phase 2 onward.
Log any decision you make in DECISIONS.log before moving on.
```

---

## Windows-specific troubleshooting

| Symptom | Cause / fix |
|---|---|
| `bad interpreter: /bin/bash^M` | CRLF line endings. `git config --global core.autocrlf input`, then `dos2unix setup.sh` (or re-clone). |
| `docker: command not found` in Ubuntu | WSL Integration not enabled for Ubuntu-24.04 in Docker Desktop settings. |
| MCP servers fail with `spawn npx ENOENT` | Node isn't installed *inside WSL*. Installing it on Windows doesn't help. |
| Everything is extremely slow | Project is under `/mnt/c/`. Move it to `~/projects`. |
| `claude: command not found` | Installed on the Windows side instead of inside Ubuntu, or PATH not reloaded (`source ~/.bashrc`). |
| WSL VERSION shows 1 | `wsl --set-version Ubuntu-24.04 2` |

## Editing files — the lightweight stack (no VS Code)

Claude Code writes the code. You mostly **read, review diffs, and approve** — so
optimise for that, not for an IDE.

**1. Windows Terminal** (already on Windows 11) is the main surface. Split panes with
`Alt+Shift+D`: Claude Code left, `bun test --watch` top-right, `psql` bottom-right.

**2. Zed** — the GUI editor. Rust, DirectX 11 rendering, not Electron, and it
**integrates directly with WSL**, so it opens `~/projects/yellow` inside Ubuntu with
no extension needed. Hit 1.0 in April 2026 with a full-time Windows team. Install on
the Windows side from zed.dev, then open the WSL project from its project picker.

*Honest caveats:* Windows is Zed's least-mature platform (macOS > Linux > Windows),
and it has ~800 extensions against VS Code's ~50,000. Irrelevant for this stack —
TypeScript, SQL, and Markdown are first-class — and our database browsing happens
through `psql` and the postgres MCP anyway.

**3. lazygit** — the daily workhorse. Reviewing what Claude Code changed before you
commit is the single most frequent task in an agentic workflow, and lazygit is the
fastest way to do it:

```bash
sudo apt install -y lazygit    # or: brew install lazygit on the Mac
lazygit                        # inside ~/projects/yellow
```

Stage hunks, read diffs, write commits — all keyboard, instant, no GUI weight.

**4. Optional: helix** — a zero-config terminal editor (single binary, LSP and
tree-sitter built in) for quick edits without leaving the terminal:
`sudo apt install -y helix` then `hx file.ts`.

**Fully terminal option:** Windows Terminal + helix + lazygit. Nothing else. This is
the fastest possible setup and everything lives inside WSL where the project lives.

## If your co-founder is on the Mac

`START-HERE.md` covers that path; from Step 4 onward the commands are identical
because both machines are running Linux-flavoured shells against the same repo.
