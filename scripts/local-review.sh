#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

action="${1:-start}"
case "$action" in
  start|stop|status) ;;
  *) printf 'Usage: %s [start|stop|status]\n' "$0" >&2; exit 1 ;;
esac

authority_file=".yellow/runtime-database-authority.env"
review_file=".env.local-review"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-yellow-review}"
export YELLOW_APP_PORT="${YELLOW_APP_PORT:-3000}"
export YELLOW_POSTGRES_PORT="${YELLOW_POSTGRES_PORT:-5442}"
export YELLOW_VALKEY_PORT="${YELLOW_VALKEY_PORT:-6389}"

compose() {
  docker compose --env-file "$authority_file" "$@"
}

if [ "$action" = "stop" ]; then
  [ -f "$authority_file" ] || { echo 'Yellow local review is not provisioned.' >&2; exit 1; }
  compose down
  echo 'Yellow local review stopped; its PostgreSQL volume was preserved.'
  exit 0
fi

if [ "$action" = "status" ]; then
  curl --fail --silent --show-error "http://127.0.0.1:${YELLOW_APP_PORT}/health"
  printf '\n'
  curl --fail --silent --show-error "http://127.0.0.1:${YELLOW_APP_PORT}/ready"
  printf '\n'
  exit 0
fi

for command in git docker bun python3 curl; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Missing %s. Read START-HERE.md before local review.\n' "$command" >&2
    exit 1
  }
done
docker compose version >/dev/null

if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
  echo 'Refusing to label a dirty checkout as an exact local build. Commit or restore it first.' >&2
  exit 1
fi
revision="$(git rev-parse --verify HEAD)"
case "$revision" in
  ''|*[!0-9a-f]*) echo 'Git did not return an exact lowercase revision.' >&2; exit 1 ;;
esac
[ "${#revision}" -eq 40 ] || { echo 'Git did not return an exact 40-character revision.' >&2; exit 1; }
export YELLOW_BUILD_SHA="$revision"

if [ ! -e "$review_file" ]; then
  umask 077
  review_tmp="$(mktemp .env.local-review.XXXXXX)"
  trap 'rm -f -- "${review_tmp:-}" "${login_file:-}" "${login_response:-}"' EXIT
  review_password="$(bun -e 'const b=crypto.getRandomValues(new Uint8Array(48));process.stdout.write(Buffer.from(b).toString("base64url"));')"
  approver_password="$(bun -e 'const b=crypto.getRandomValues(new Uint8Array(48));process.stdout.write(Buffer.from(b).toString("base64url"));')"
  token_secret="$(bun -e 'const b=crypto.getRandomValues(new Uint8Array(64));process.stdout.write(Buffer.from(b).toString("base64url"));')"
  [ "$review_password" != "$approver_password" ] || { echo 'Credential generation collision.' >&2; exit 1; }
  printf 'YELLOW_REVIEW_PASSWORD=%s\nYELLOW_REVIEW_APPROVER_PASSWORD=%s\nYELLOW_TOKEN_SECRET=%s\n' \
    "$review_password" "$approver_password" "$token_secret" > "$review_tmp"
  mv "$review_tmp" "$review_file"
  review_tmp=''
  unset review_password approver_password token_secret
fi
[ -f "$review_file" ] && [ ! -L "$review_file" ] || {
  echo 'Local review credential path must be one regular, non-symlink file.' >&2
  exit 1
}
[ "$(stat -c '%u' "$review_file")" = "$(id -u)" ] || {
  echo 'Local review credential file is not owned by the current user.' >&2
  exit 1
}
chmod 600 "$review_file"

review_password=''
approver_password=''
token_secret=''
review_lines=0
while IFS='=' read -r key value; do
  review_lines=$((review_lines + 1))
  case "$key" in
    YELLOW_REVIEW_PASSWORD) review_password="$value" ;;
    YELLOW_REVIEW_APPROVER_PASSWORD) approver_password="$value" ;;
    YELLOW_TOKEN_SECRET) token_secret="$value" ;;
    *) echo 'Local review credential file contains an unexpected key.' >&2; exit 1 ;;
  esac
done < "$review_file"
[ "$review_lines" -eq 3 ] || { echo 'Local review credential file must contain exactly three entries.' >&2; exit 1; }
for value in "$review_password" "$approver_password" "$token_secret"; do
  case "$value" in
    ''|*[!A-Za-z0-9_-]*) echo 'Local review credential file contains an invalid value.' >&2; exit 1 ;;
  esac
done
[ "${#review_password}" -ge 43 ] && [ "${#approver_password}" -ge 43 ] && [ "${#token_secret}" -ge 64 ] || {
  echo 'Local review credential file contains a short value.' >&2
  exit 1
}
[ "$review_password" != "$approver_password" ] || { echo 'Local review passwords must differ.' >&2; exit 1; }

export YELLOW_REVIEW_PASSWORD="$review_password"
export YELLOW_REVIEW_APPROVER_PASSWORD="$approver_password"
export YELLOW_TOKEN_SECRET="$token_secret"
export YELLOW_OPERATOR_WORKBENCH=1
export YELLOW_LOCAL_REVIEW_PREFILL=1
export YELLOW_LOCAL_REVIEW_TENANT=yellow-demo
export YELLOW_LOCAL_REVIEW_EMAIL=operator@yellow.local
export YELLOW_LOCAL_REVIEW_PASSWORD="$review_password"
export YELLOW_HOLD_EXPIRY_WORKER=1
export YELLOW_AVAILABILITY_PROJECTION_WORKER=1
export YELLOW_PICKUP_TASK_WORKER=1
export YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER=1
export YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER=1
export YELLOW_BUSINESS_DAY_ROLL_WORKER=1

./setup.sh --db-only
compose --profile tools run --rm \
  -e YELLOW_REVIEW_PASSWORD -e YELLOW_REVIEW_APPROVER_PASSWORD \
  seed bun scripts/seed-review.ts
compose up --detach --build app

ready_file="$(mktemp)"
trap 'rm -f -- "${ready_file:-}" "${login_file:-}" "${login_response:-}"' EXIT
ready=0
for _attempt in $(seq 1 40); do
  if curl --fail --silent --show-error \
    "http://127.0.0.1:${YELLOW_APP_PORT}/ready" > "$ready_file" 2>/dev/null \
    && BUILD_SHA="$revision" READY_FILE="$ready_file" bun -e '
      const body = await Bun.file(process.env.READY_FILE).json();
      if (body.status !== "ready"
          || body.target !== "yellow_runtime_database"
          || body.build?.revision !== process.env.BUILD_SHA
          || body.build?.expectedMigrationFrontier !== 75) process.exit(1);
    '; then
    ready=1
    break
  fi
  sleep 1
done
[ "$ready" -eq 1 ] || { compose logs app >&2; echo 'Yellow local review did not become ready.' >&2; exit 1; }

login_file="$(mktemp)"
login_response="$(mktemp)"
LOGIN_FILE="$login_file" LOGIN_PASSWORD="$review_password" bun -e '
  await Bun.write(process.env.LOGIN_FILE, JSON.stringify({
    tenant: "yellow-demo", email: "operator@yellow.local", password: process.env.LOGIN_PASSWORD,
  }));
'
login_status="$(curl --silent --show-error --output "$login_response" --write-out '%{http_code}' \
  --header 'content-type: application/json' --data-binary "@$login_file" \
  "http://127.0.0.1:${YELLOW_APP_PORT}/api/v1/auth/local:login")"
[ "$login_status" = "200" ] || { echo "Local review login check returned HTTP $login_status." >&2; exit 1; }
LOGIN_RESPONSE="$login_response" bun -e '
  const body = await Bun.file(process.env.LOGIN_RESPONSE).json();
  if (body.tokenType !== "Bearer" || typeof body.accessToken !== "string" || body.accessToken.length < 32) process.exit(1);
'

unset review_password approver_password token_secret
printf 'Yellow local review is ready.\nURL: http://127.0.0.1:%s\nRevision: %s\nLogin: operator@yellow.local\nCredentials: %s (mode 600; ignored by Git)\n' \
  "$YELLOW_APP_PORT" "$revision" "$review_file"
