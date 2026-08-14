#!/usr/bin/env bash
# state.sh — ground truth for ANY agent. Run this first, every session.
# Read-only: touches nothing, decides nothing. Prints the same thing for everyone,
# which is the entire point — "on the same page" has to be verifiable, not assumed.
set -uo pipefail
cd "$(dirname "$0")"

C='\033[0;36m'; G='\033[0;32m'; Y='\033[0;33m'; R='\033[0;31m'; D='\033[0;90m'; N='\033[0m'
hdr() { printf "\n${C}── %s ${N}\n" "$1"; }

printf "${C}YELLOW — project state · %s${N}\n" "$(date -u '+%Y-%m-%d %H:%M UTC')"

hdr "Git"
if [ -d .git ]; then
  printf "  branch  %s\n" "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  printf "  head    %s\n" "$(git log -1 --pretty='%h %s' 2>/dev/null)"
  DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [ "$DIRTY" -gt 0 ]; then printf "  ${Y}uncommitted: %s file(s)${N}\n" "$DIRTY"
  else printf "  ${G}clean${N}\n"; fi
  git remote get-url origin >/dev/null 2>&1 && printf "  remote  %s\n" "$(git remote get-url origin)"
  printf "${D}  recent: \n%s${N}\n" "$(git log -5 --pretty='    %h %an %s' 2>/dev/null)"
else
  printf "  ${Y}not a git repo yet — run ./setup.sh${N}\n"
fi

hdr "Phase"
PHASE=$(grep -n "^## Phase" BUILD-PLAN.md 2>/dev/null | head -20 | sed 's/^[0-9]*://')
LEDGER_LAST=$(grep -v '^#' handoff/LEDGER.md 2>/dev/null | grep -v '^$' | tail -1)
printf "  last ledger entry:\n    %s\n" "${LEDGER_LAST:-<none>}"
printf "${D}  (phases in BUILD-PLAN.md — read ONLY the current one)${N}\n"

hdr "Open work"
ORDERS=$(ls handoff/orders/*.md 2>/dev/null | grep -v TEMPLATE | wc -l | tr -d ' ')
REVIEWS=$(ls handoff/reviews/*.md 2>/dev/null | grep -v TEMPLATE | wc -l | tr -d ' ')
QS=$(ls handoff/questions/*.md 2>/dev/null | wc -l | tr -d ' ')
printf "  orders %s · reviews %s · ${Y}open questions %s${N}\n" "$ORDERS" "$REVIEWS" "$QS"
[ "$QS" -gt 0 ] && { printf "  ${Y}questions awaiting an architect:${N}\n"; ls handoff/questions/*.md 2>/dev/null | sed 's/^/    /'; }

hdr "Last 5 decisions (grep this file BEFORE deciding anything)"
grep -v '^#' DECISIONS.log 2>/dev/null | grep -v '^$' | grep -v '^---' | tail -5 | cut -c1-150 | sed 's/^/  · /'
printf "${D}  full history: DECISIONS.log (%s entries)${N}\n" "$(grep -c '^20' DECISIONS.log 2>/dev/null || echo 0)"

hdr "Services"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  for c in yellow-postgres yellow-valkey; do
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${c}$"; then
      printf "  ${G}up${N}      %s\n" "$c"
    else
      printf "  ${R}down${N}    %s  → docker compose up -d\n" "$c"
    fi
  done
else
  printf "  ${Y}docker unavailable${N}\n"
fi

hdr "Referee"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^yellow-postgres$'; then
  T=$(docker exec yellow-postgres psql -U yellow -d yellow_test -tAc \
      "SELECT count(*) FROM pg_tables WHERE schemaname='public';" 2>/dev/null)
  printf "  yellow_test tables: %s ${D}(expect 80)${N}\n" "${T:-?}"
fi
printf "  battery: ${D}./setup.sh --db-only${N} → must print ${G}11 passed, 0 failed${N}\n"

hdr "Reading order"
cat <<'EOF'
  1. PROJECT.md            canonical constitution (all agents)
  2. CLAUDE.md / AGENTS.md your role adapter
  3. BUILD-PLAN.md         current phase ONLY
  4. handoff/ROSTER.md     who reviews what (tiers 1-3)
  5. docs/WORKFLOW.md      the build→review loop and git conventions
EOF
printf "\n"
