#!/usr/bin/env bash
# ============================================================================
# Yellow — one-command laptop setup.
#   ./setup.sh              full setup (git + github + db + schema + tests)
#   ./setup.sh --no-github  skip repo creation (local only)
#   ./setup.sh --db-only    just rebuild the database and re-run the tests
# Safe to re-run. Nothing here is destructive except --db-only's DROP DATABASE.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")"

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; NC='\033[0m'
say()  { printf "${BLUE}▸ %s${NC}\n" "$1"; }
ok()   { printf "${GREEN}✔ %s${NC}\n" "$1"; }
warn() { printf "${YELLOW}! %s${NC}\n" "$1"; }
die()  { printf "${RED}✖ %s${NC}\n" "$1"; exit 1; }

GITHUB=1; DB_ONLY=0
for a in "$@"; do
  case "$a" in
    --no-github) GITHUB=0 ;;
    --db-only)   DB_ONLY=1; GITHUB=0 ;;
    *) die "unknown option: $a" ;;
  esac
done

# ---------------------------------------------------------------- 1. tooling
say "Checking prerequisites"
MISSING=""
need() { command -v "$1" >/dev/null 2>&1 || MISSING="$MISSING $1"; }
need git; need docker; need python3
[ -n "$MISSING" ] && die "missing:$MISSING
  macOS:  brew install git python3 && install Docker Desktop or colima
  Ubuntu: sudo apt install -y git python3 docker.io docker-compose-plugin"
docker info >/dev/null 2>&1 || die "Docker is installed but not running — start it and re-run."
command -v bun >/dev/null 2>&1 || warn "bun not found — needed from Phase 0 (curl -fsSL https://bun.sh/install | bash)"
command -v npx >/dev/null 2>&1 || warn "node/npx not found — the three MCP servers need it (brew install node)"
command -v gh  >/dev/null 2>&1 || warn "gh CLI not found — GitHub step will print manual commands instead"
[ -n "${GITHUB_TOKEN:-}" ] || warn "GITHUB_TOKEN not set — the github MCP server needs it (see docs/TOOLING.md)"
python3 -c "import psycopg2" 2>/dev/null || {
  say "Installing psycopg2-binary (test runner dependency)"
  python3 -m pip install --quiet --user psycopg2-binary 2>/dev/null \
    || python3 -m pip install --quiet --break-system-packages psycopg2-binary \
    || warn "could not install psycopg2 — invariant battery will be skipped"
}
ok "Prerequisites present"

# ------------------------------------------------------------------ 2. git
if [ "$DB_ONLY" -eq 0 ]; then
  if [ -d .git ]; then
    ok "Git repo already initialised"
  else
    say "Initialising git repository"
    git init -b main >/dev/null
    git add -A
    git -c user.email="${GIT_EMAIL:-founder@localhost}" \
        -c user.name="${GIT_NAME:-Founder}" \
        commit -qm "PMS build package v1.6 — schema (80 tables, validated), specs, tests (11/11), mockups"
    ok "Committed $(git ls-files | wc -l | tr -d ' ') files"
  fi
fi

# --------------------------------------------------------------- 3. github
if [ "$GITHUB" -eq 1 ]; then
  if git remote get-url origin >/dev/null 2>&1; then
    say "Pushing to existing remote"
    git push -u origin main && ok "Pushed to $(git remote get-url origin)"
  elif command -v gh >/dev/null 2>&1; then
    say "Creating private GitHub repository"
    gh auth status >/dev/null 2>&1 || gh auth login
    gh repo create yellow --private --source=. --push \
      && ok "Pushed to github.com/$(gh api user -q .login)/yellow"
    warn "Insurance: add a second remote later (Forgejo mirror) — see docs/DEPENDENCIES.md"
  else
    warn "No gh CLI. Create an empty PRIVATE repo on github.com, then run:"
    echo "    git remote add origin git@github.com:<you>/yellow.git"
    echo "    git push -u origin main"
  fi
fi

# ------------------------------------------------------------- 4. database
say "Starting PostgreSQL 16 + Valkey"
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
$DC up -d >/dev/null
printf "  waiting for postgres"
for i in $(seq 1 40); do
  if docker exec yellow-postgres pg_isready -U yellow -d yellow_dev >/dev/null 2>&1; then break; fi
  printf "."; sleep 1
  [ "$i" -eq 40 ] && { echo; die "postgres did not become ready — check: $DC logs postgres"; }
done
echo; ok "Database up on localhost:5432 (user pms / db yellow_dev)"

say "Loading schema and test fixture into a clean yellow_test database"
docker exec -i yellow-postgres psql -U yellow -d yellow_dev -q \
  -c "DROP DATABASE IF EXISTS yellow_test;" -c "CREATE DATABASE yellow_test;" >/dev/null
docker exec -i yellow-postgres psql -U yellow -d yellow_test -q -v ON_ERROR_STOP=1 < migrations/0001_init.sql >/dev/null
TABLES=$(docker exec -i yellow-postgres psql -U yellow -d yellow_test -tAc \
  "SELECT count(*) FROM pg_tables WHERE schemaname='public';")
ok "Schema loaded — $TABLES tables"
docker exec -i yellow-postgres psql -U yellow -d yellow_test -q -v ON_ERROR_STOP=1 < tests/seed_fixture.sql >/dev/null
ok "Fixture loaded (2 tenants, 16 spaces incl. 6-bed dorm)"

# ---------------------------------------------------------------- 5. proof
if python3 -c "import psycopg2" 2>/dev/null; then
  say "Running the invariant battery against YOUR machine"
  echo
  YELLOW_DSN="dbname=yellow_test user=pms password=pms host=127.0.0.1 port=5432" \
    python3 tests/run_invariants.py yellow_test || die "invariants failed — do not start Phase 0 until green"
  echo
  ok "All invariants green on this machine"
else
  warn "Skipped invariant battery (psycopg2 unavailable)"
fi

# ----------------------------------------------------------------- 6. next
cat <<'EOF'

────────────────────────────────────────────────────────────
Setup complete. Open Claude Code in this folder, run /mcp to confirm
postgres + github + context7 are connected, then paste:

  Read CLAUDE.md and BUILD-PLAN.md. Execute Phase 0.
  The invariant battery in tests/ must stay green from Phase 2 on.

Useful:
  ./setup.sh --db-only     rebuild db + re-run invariants
  docker compose down      stop services (data persists)
  docker compose down -v   stop and DELETE the data volume
────────────────────────────────────────────────────────────
EOF
