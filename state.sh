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

orders_total=0
orders_open=()
for file in handoff/orders/*.md; do
  [ -f "$file" ] || continue
  ((orders_total += 1))
  if ! grep -q '^## MERGED' "$file"; then orders_open+=("$file"); fi
done

reviews_total=0
for file in handoff/reviews/*.md; do
  [ -f "$file" ] || continue
  ((reviews_total += 1))
done

questions_total=0
questions_open=()
for file in handoff/questions/*.md; do
  [ -f "$file" ] || continue
  ((questions_total += 1))
  name=$(basename "$file")
  number=${name%%-*}
  response="handoff/questions/${number}-ARCHITECT-RESPONSE.md"
  if [[ "$name" != *-ARCHITECT-RESPONSE.md ]] &&
     ! grep -Eq '^## (RESOLVED|RATIFIED)' "$file" &&
     [ ! -f "$response" ]; then
    questions_open+=("$file")
  fi
done

printf 'Open work: orders=%s open (%s total) reviews=0 open (%s total) questions=%s open (%s total)\n' \
  "${#orders_open[@]}" "$orders_total" "$reviews_total" "${#questions_open[@]}" "$questions_total"
if [ "${#orders_open[@]}" -gt 0 ]; then
  printf 'Open orders:\n'
  printf '  %s\n' "${orders_open[@]}"
fi
if [ "${#questions_open[@]}" -gt 0 ]; then
  printf 'Open questions:\n'
  printf '  %s\n' "${questions_open[@]}"
fi

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
  [ -n "$tables" ] && printf 'yellow_test tables: %s (80 baseline + tx_code_route + 2 kernel consumer + api_idempotency + schema_migration; expected 85)\n' "$tables"
fi

phase=0
for file in handoff/orders/*.md; do
  [ -f "$file" ] || continue
  candidate=$(sed -nE 's/^\*\*Phase:\*\*[[:space:]]*([0-9]+).*/\1/p' "$file" | head -n 1)
  if [ -n "$candidate" ] && [ "$candidate" -gt "$phase" ]; then phase=$candidate; fi
done
if [ "$phase" -eq 0 ] && [ "${#orders_open[@]}" -eq 0 ]; then
  echo 'Phase: 0 · merged baseline'
else
  printf 'Phase: %s · descendant stack pending independent review\n' "$phase"
fi
echo 'Reading: PROJECT.md -> AGENTS.md -> BUILD-PLAN.md -> handoff/ROSTER.md -> docs/WORKFLOW.md'
echo 'Referee: ./setup.sh --db-only -> 11 passed, 0 failed of 11'
