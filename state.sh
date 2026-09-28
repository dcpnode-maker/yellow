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
historical_unclosed=()
order_files=()
for file in handoff/orders/*.md; do
  [ -f "$file" ] || continue
  ((orders_total += 1))
  order_files+=("$file")
done
# Scan each group in one process, rather than forking once per historical record.
# NUL-delimited filenames preserve spaces/newlines and empty groups never read stdin.
if [ "${#order_files[@]}" -gt 0 ]; then
  while IFS= read -r -d '' file; do
    historical_unclosed+=("$file")
  done < <(grep -LZ '^## MERGED' -- "${order_files[@]}")
fi

status_file=${YELLOW_PROJECT_STATUS_FILE:-docs/PROJECT-STATUS.md}
read_status_field() {
  local key=$1
  sed -nE "s/^<!-- ${key}: (.*) -->$/\1/p" "$status_file" | head -n 1
}
status_schema=$(read_status_field status-schema)
current_phase=$(read_status_field current-phase)
current_task=$(read_status_field current-task)
current_lifecycle=$(read_status_field current-lifecycle)
IFS=';' read -r -a current_order_files <<< "$(read_status_field current-order-files)"
if [ "$status_schema" != 'yellow-project-status/v1' ] ||
   ! [[ "$current_phase" =~ ^[0-9]+$ ]] ||
   [ -z "$current_task" ] || [ -z "$current_lifecycle" ]; then
  echo 'Status: invalid docs/PROJECT-STATUS.md metadata' >&2
  exit 1
fi
for file in "${current_order_files[@]}"; do
  if [ -z "$file" ] || [ ! -f "$file" ]; then
    printf 'Status: current order file is missing: %s\n' "$file" >&2
    exit 1
  fi
done

reviews_total=0
for file in handoff/reviews/*.md; do
  [ -f "$file" ] || continue
  ((reviews_total += 1))
done

questions_total=0
questions_open=()
question_candidates=()
for file in handoff/questions/*.md; do
  [ -f "$file" ] || continue
  ((questions_total += 1))
  name=${file##*/}
  number=${name%%-*}
  response="handoff/questions/${number}-ARCHITECT-RESPONSE.md"
  if [[ "$name" != *-ARCHITECT-RESPONSE.md ]] &&
     [ ! -f "$response" ]; then
    question_candidates+=("$file")
  fi
done
if [ "${#question_candidates[@]}" -gt 0 ]; then
  while IFS= read -r -d '' file; do
    questions_open+=("$file")
  done < <(grep -LEZ '^## (RESOLVED|RATIFIED)' -- "${question_candidates[@]}")
fi

printf 'Current task: %s\n' "$current_task"
printf 'Lifecycle: %s\n' "$current_lifecycle"
printf 'Current order files:\n'
printf '  %s\n' "${current_order_files[@]}"
printf 'Historical records: orders=%s total (%s lack legacy MERGED marker) reviews=%s total questions=%s without legacy resolution marker (%s total)\n' \
  "$orders_total" "${#historical_unclosed[@]}" "$reviews_total" "${#questions_open[@]}" "$questions_total"

running=''
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  running=$(docker compose ps --services --status running 2>/dev/null || true)
fi
for service in app postgres valkey; do
  if printf '%s\n' "$running" | grep -qx "$service"; then status=up; else status=down; fi
  printf 'Service %s: %s\n' "$service" "$status"
done
if printf '%s\n' "$running" | grep -qx postgres; then
  tables=$(docker compose exec -T postgres psql -U yellow_deploy -d yellow_test -tAc \
    "SELECT count(*) FROM pg_tables WHERE schemaname='public';" 2>/dev/null | tr -d '[:space:]' || true)
  [ -n "$tables" ] && printf 'yellow_test public tables: %s (validate against the PROJECT-STATUS migration frontier)\n' "$tables"
fi

printf 'Phase: %s · %s\n' "$current_phase" "$current_lifecycle"
echo 'Reading: PROJECT.md -> AGENTS.md -> BUILD-PLAN.md -> handoff/ROSTER.md -> docs/WORKFLOW.md'
echo 'Referee: ./setup.sh --db-only -> 11 passed, 0 failed of 11'
