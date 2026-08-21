#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

DB_ONLY=0
for argument in "$@"; do
  case "$argument" in
    --db-only) DB_ONLY=1 ;;
    *) printf 'Unknown option: %s\n' "$argument" >&2; exit 1 ;;
  esac
done

need() { command -v "$1" >/dev/null 2>&1 || { printf 'Missing %s. %s\n' "$1" "$2" >&2; exit 1; }; }
need docker 'Install Docker Engine/Desktop with the Compose plugin.'
need bun 'Install Bun 1.3.14 from https://bun.sh/docs/installation.'
need python3 'Install CPython 3.12+.'
docker compose version >/dev/null 2>&1 || { echo 'Missing Docker Compose plugin.' >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo 'Docker is not running.' >&2; exit 1; }
python3 -c 'import psycopg2' >/dev/null 2>&1 || {
  echo 'Missing psycopg2. Install psycopg2-binary==2.9.12 for the Python invariant referee.' >&2
  exit 1
}

default_project=$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g')
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$default_project}"
export YELLOW_APP_PORT="${YELLOW_APP_PORT:-3000}"
export YELLOW_POSTGRES_PORT="${YELLOW_POSTGRES_PORT:-5442}"
export YELLOW_VALKEY_PORT="${YELLOW_VALKEY_PORT:-6389}"
printf 'Compose project %s · ports app=%s postgres=%s valkey=%s\n' \
  "$COMPOSE_PROJECT_NAME" "$YELLOW_APP_PORT" "$YELLOW_POSTGRES_PORT" "$YELLOW_VALKEY_PORT"

docker compose up -d postgres valkey
ready=0
for _ in $(seq 1 40); do
  postmaster=$(docker compose exec -T postgres cat /proc/1/comm 2>/dev/null | tr -d '\r\n' || true)
  if [ "$postmaster" = 'postgres' ] \
    && docker compose exec -T postgres pg_isready -U yellow -d yellow_dev >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[ "$ready" -eq 1 ] || { echo 'PostgreSQL did not become ready. Run: docker compose logs postgres' >&2; exit 1; }

dev_url="postgres://yellow:yellow@127.0.0.1:${YELLOW_POSTGRES_PORT}/yellow_dev"
test_url="postgres://yellow:yellow@127.0.0.1:${YELLOW_POSTGRES_PORT}/yellow_test"
DATABASE_URL="$dev_url" bun scripts/migrate.ts
DATABASE_URL="$dev_url" bun scripts/seed.ts

docker compose exec -T postgres psql -U yellow -d postgres -v ON_ERROR_STOP=1 \
  -c 'DROP DATABASE IF EXISTS yellow_test WITH (FORCE)' -c 'CREATE DATABASE yellow_test'
DATABASE_URL="$test_url" bun scripts/migrate.ts
docker compose exec -T postgres psql -U yellow -d yellow_test -v ON_ERROR_STOP=1 < tests/seed_fixture.sql

tables=$(docker compose exec -T postgres psql -U yellow -d yellow_test -tAc \
  "SELECT count(*) FROM pg_tables WHERE schemaname='public';" | tr -d '[:space:]')
[ "$tables" = '83' ] || { printf 'yellow_test has %s public tables; expected 83 (80 baseline + 2 kernel consumer + schema_migration).\n' "$tables" >&2; exit 1; }
echo 'yellow_test tables: 83 (80 baseline + 2 kernel consumer + schema_migration)'

YELLOW_DSN="dbname=yellow_test user=yellow password=yellow host=127.0.0.1 port=${YELLOW_POSTGRES_PORT}" \
PYTHONIOENCODING=utf-8 python3 tests/run_invariants.py yellow_test

if [ "$DB_ONLY" -eq 0 ]; then
  need curl 'Install curl to run the application health check.'
  docker compose up -d app
  healthy=0
  for _ in $(seq 1 30); do
    status=$(curl -sS -o /tmp/yellow-health-body -w '%{http_code}' "http://127.0.0.1:${YELLOW_APP_PORT}/health" || true)
    body=$(cat /tmp/yellow-health-body 2>/dev/null || true)
    if [ "$status" = '200' ] && [ "$body" = '{"status":"ok"}' ]; then healthy=1; break; fi
    sleep 1
  done
  [ "$healthy" -eq 1 ] || { printf 'Application health failed on port %s.\n' "$YELLOW_APP_PORT" >&2; exit 1; }
  echo 'app health: 200 {"status":"ok"}'
fi

echo 'Setup complete. Start each agent session with: ./state.sh'
