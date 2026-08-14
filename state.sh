#!/usr/bin/env bash
# Read-only project state for any agent.
set -uo pipefail
cd "$(dirname "$0")"

default_project=$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g')
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$default_project}"
printf 'YELLOW state · Compose project %s\n' "$COMPOSE_PROJECT_NAME"

GIT=(git)
if ! git rev-parse --git-dir >/dev/null 2>&1 && command -v git.exe >/dev/null 2>&1 && command -v wslpath >/dev/null 2>&1; then
  GIT=(git.exe -C "$(wslpath -w "$PWD")")
fi
branch=$("${GIT[@]}" branch --show-current 2>/dev/null | tr -d '\r' || true)
head=$("${GIT[@]}" log -1 --pretty='%h %s' 2>/dev/null | tr -d '\r' || true)
dirty=$("${GIT[@]}" status --porcelain 2>/dev/null | tr -d '\r' | wc -l | tr -d ' ')
if [ "$dirty" -eq 0 ]; then dirty_text=clean; else dirty_text="$dirty uncommitted"; fi
printf 'Git: %s · %s · %s\n' "$branch" "$head" "$dirty_text"

orders=$(find handoff/orders -maxdepth 1 -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' ')
reviews=$(find handoff/reviews -maxdepth 1 -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' ')
questions=$(find handoff/questions -maxdepth 1 -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' ')
printf 'Open work: orders=%s reviews=%s questions=%s\n' "$orders" "$reviews" "$questions"

running=''
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  running=$(docker compose ps --services --status running 2>/dev/null || true)
fi
for service in app postgres valkey; do
  if printf '%s\n' "$running" | grep -qx "$service"; then status=up; else status=down; fi
  printf 'Service %s: %s\n' "$service" "$status"
done
if printf '%s\n' "$running" | grep -qx postgres; then
  tables=$(docker compose exec -T postgres psql -U yellow -d yellow_test -tAc \
    "SELECT count(*) FROM pg_tables WHERE schemaname='public';" 2>/dev/null | tr -d '[:space:]' || true)
  [ -n "$tables" ] && printf 'yellow_test tables: %s (80 baseline + schema_migration; expected 81)\n' "$tables"
fi

echo 'Phase: 0 · cumulative review pending'
echo 'Reading: PROJECT.md -> AGENTS.md -> BUILD-PLAN.md -> handoff/ROSTER.md -> docs/WORKFLOW.md'
echo 'Referee: ./setup.sh --db-only -> 11 passed, 0 failed of 11'
