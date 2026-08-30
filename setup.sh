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

authority_dir='.yellow'
authority_file="$authority_dir/runtime-database-authority.env"
authority_tmp=''
trap 'if [ -n "$authority_tmp" ] && [ -f "$authority_tmp" ]; then rm -f -- "$authority_tmp"; fi' EXIT
mkdir -p "$authority_dir"
if [ ! -e "$authority_file" ]; then
  deploy_password=$(bun -e 'const b=crypto.getRandomValues(new Uint8Array(48));process.stdout.write(Buffer.from(b).toString("base64url"));')
  runtime_password=$(bun -e 'const b=crypto.getRandomValues(new Uint8Array(48));process.stdout.write(Buffer.from(b).toString("base64url"));')
  registrar_password=$(bun -e 'const b=crypto.getRandomValues(new Uint8Array(48));process.stdout.write(Buffer.from(b).toString("base64url"));')
  authority_tmp=$(mktemp "$authority_dir/runtime-database-authority.XXXXXX")
  chmod 600 "$authority_tmp"
  printf 'YELLOW_DEPLOY_DATABASE_PASSWORD=%s\nYELLOW_RUNTIME_DATABASE_PASSWORD=%s\nYELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD=%s\n' \
    "$deploy_password" "$runtime_password" "$registrar_password" > "$authority_tmp"
  mv -n "$authority_tmp" "$authority_file"
  rm -f -- "$authority_tmp"
  authority_tmp=''
  unset deploy_password runtime_password registrar_password
fi
[ -f "$authority_file" ] && [ ! -L "$authority_file" ] || {
  echo 'Local database authority path must be one regular, non-symlink file.' >&2; exit 1;
}
[ "$(stat -c '%u' "$authority_file")" = "$(id -u)" ] || {
  echo 'Local database authority file is not owned by the current user.' >&2; exit 1;
}
chmod 600 "$authority_file"
deploy_password=''
runtime_password=''
registrar_password=''
authority_lines=0
while IFS='=' read -r key value; do
  authority_lines=$((authority_lines + 1))
  case "$key" in
    YELLOW_DEPLOY_DATABASE_PASSWORD) deploy_password="$value" ;;
    YELLOW_RUNTIME_DATABASE_PASSWORD) runtime_password="$value" ;;
    YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD) registrar_password="$value" ;;
    *) echo 'Local database authority file has an unexpected key.' >&2; exit 1 ;;
  esac
done < "$authority_file"
[ "$authority_lines" -eq 2 ] || [ "$authority_lines" -eq 3 ] || {
  echo 'Local database authority file is malformed.' >&2; exit 1;
}
[[ "$deploy_password" =~ ^[A-Za-z0-9_-]{43,256}$ ]] \
  && [[ "$runtime_password" =~ ^[A-Za-z0-9_-]{43,256}$ ]] \
  && [ "$deploy_password" != "$runtime_password" ] || {
  echo 'Local database authority file is malformed.' >&2; exit 1;
}
if [ "$authority_lines" -eq 2 ]; then
  registrar_password=$(bun -e 'const b=crypto.getRandomValues(new Uint8Array(48));process.stdout.write(Buffer.from(b).toString("base64url"));')
  authority_tmp=$(mktemp "$authority_dir/runtime-database-authority.XXXXXX")
  chmod 600 "$authority_tmp"
  printf 'YELLOW_DEPLOY_DATABASE_PASSWORD=%s\nYELLOW_RUNTIME_DATABASE_PASSWORD=%s\nYELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD=%s\n' \
    "$deploy_password" "$runtime_password" "$registrar_password" > "$authority_tmp"
  mv -f "$authority_tmp" "$authority_file"
  authority_tmp=''
fi
[ "$authority_lines" -eq 2 ] || [ "$authority_lines" -eq 3 ]
[[ "$deploy_password" =~ ^[A-Za-z0-9_-]{43,256}$ ]] \
  && [[ "$runtime_password" =~ ^[A-Za-z0-9_-]{43,256}$ ]] \
  && [[ "$registrar_password" =~ ^[A-Za-z0-9_-]{43,256}$ ]] \
  && [ "$deploy_password" != "$runtime_password" ] \
  && [ "$deploy_password" != "$registrar_password" ] \
  && [ "$runtime_password" != "$registrar_password" ] || {
  echo 'Local database authority file is malformed.' >&2; exit 1;
}

compose() {
  YELLOW_DEPLOY_DATABASE_PASSWORD="$deploy_password" \
  YELLOW_RUNTIME_DATABASE_PASSWORD="$runtime_password" \
  YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD="$registrar_password" \
    docker compose "$@"
}

default_project=$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g')
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$default_project}"
export YELLOW_APP_PORT="${YELLOW_APP_PORT:-3000}"
export YELLOW_POSTGRES_PORT="${YELLOW_POSTGRES_PORT:-5442}"
export YELLOW_VALKEY_PORT="${YELLOW_VALKEY_PORT:-6389}"
printf 'Compose project %s · ports app=%s postgres=%s valkey=%s\n' \
  "$COMPOSE_PROJECT_NAME" "$YELLOW_APP_PORT" "$YELLOW_POSTGRES_PORT" "$YELLOW_VALKEY_PORT"

compose up -d postgres valkey
ready=0
for _ in $(seq 1 40); do
  postmaster=$(compose exec -T postgres cat /proc/1/comm 2>/dev/null | tr -d '\r\n' || true)
  if [ "$postmaster" = 'postgres' ] \
    && compose exec -T postgres pg_isready -U yellow_deploy -d yellow_dev >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[ "$ready" -eq 1 ] || { echo 'PostgreSQL did not become ready. Run: docker compose logs postgres' >&2; exit 1; }

dev_url="postgres://yellow_deploy:${deploy_password}@127.0.0.1:${YELLOW_POSTGRES_PORT}/yellow_dev"
test_url="postgres://yellow_deploy:${deploy_password}@127.0.0.1:${YELLOW_POSTGRES_PORT}/yellow_test"
YELLOW_DEPLOY_DATABASE_URL="$dev_url" YELLOW_RUNTIME_DATABASE_PASSWORD="$runtime_password" \
  YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD="$registrar_password" \
  bun scripts/provision-local-database-authority.ts
YELLOW_DEPLOY_DATABASE_URL="$dev_url" bun scripts/migrate.ts
YELLOW_DEPLOY_DATABASE_URL="$dev_url" bun scripts/seed.ts

compose exec -T postgres psql -U yellow_deploy -d postgres -v ON_ERROR_STOP=1 \
  -c 'DROP DATABASE IF EXISTS yellow_test WITH (FORCE)' \
  -c 'CREATE DATABASE yellow_test OWNER yellow_deploy'
YELLOW_DEPLOY_DATABASE_URL="$test_url" bun scripts/migrate.ts
compose exec -T postgres psql -U yellow_deploy -d yellow_test -v ON_ERROR_STOP=1 < tests/seed_fixture.sql

tables=$(compose exec -T postgres psql -U yellow_deploy -d yellow_test -tAc \
  "SELECT count(*) FROM pg_tables WHERE schemaname='public';" | tr -d '[:space:]')
[ "$tables" = '110' ] || { printf 'yellow_test has %s public tables; expected 110 after migrations 1-58.\n' "$tables" >&2; exit 1; }
echo 'yellow_test tables: 110 after migrations 1-58'

YELLOW_DSN="dbname=yellow_test user=yellow_deploy password=${deploy_password} host=127.0.0.1 port=${YELLOW_POSTGRES_PORT}" \
PYTHONIOENCODING=utf-8 python3 tests/run_invariants.py yellow_test

if [ "$DB_ONLY" -eq 0 ]; then
  need curl 'Install curl to run the application health check.'
  if [ "$DB_ONLY" -eq 0 ] && [ -z "${YELLOW_TOKEN_SECRET:-}" ]; then
    generated_token_secret=$(bun -e 'const bytes = crypto.getRandomValues(new Uint8Array(48)); process.stdout.write(Buffer.from(bytes).toString("base64"));')
    export YELLOW_TOKEN_SECRET="$generated_token_secret"
    unset generated_token_secret
    echo 'Generated an ephemeral local JWT signing secret for this setup invocation.'
  fi
  compose up -d app
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
