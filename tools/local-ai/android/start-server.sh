#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

: "${YELLOW_ROOT:=$HOME/.yellow-phone-worker}"
: "${YELLOW_MODEL:=}"
: "${YELLOW_CONTEXT:=8192}"
: "${YELLOW_THREADS:=4}"

if [ -z "$YELLOW_MODEL" ] && [ -s "$YELLOW_ROOT/run/model" ]; then
  YELLOW_MODEL="$(cat "$YELLOW_ROOT/run/model")"
fi

[ -n "$YELLOW_MODEL" ] && [ -f "$YELLOW_MODEL" ] || { echo 'YELLOW_MODEL must name an existing GGUF file' >&2; exit 2; }
"$YELLOW_ROOT/guard.sh" 2>/dev/null || { echo 'worker guard refused start' >&2; exit 3; }
[ -x "$YELLOW_ROOT/bin/llama-server" ] || { echo 'run bootstrap.sh first' >&2; exit 2; }
[ -s "$YELLOW_ROOT/run/api-key" ] || { echo 'missing API key' >&2; exit 2; }
"$YELLOW_ROOT/bin/llama-server" -m "$YELLOW_MODEL" --host 127.0.0.1 --port 8080 --api-key-file "$YELLOW_ROOT/run/api-key" --ctx-size "$YELLOW_CONTEXT" --threads "$YELLOW_THREADS" --parallel 1 --jinja --no-ui &
server_pid=$!

stop_server() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
}
trap stop_server EXIT INT TERM

while kill -0 "$server_pid" 2>/dev/null; do
  sleep 30
  if ! "$YELLOW_ROOT/guard.sh"; then
    echo 'worker guard stopped the running server' >&2
    stop_server
    exit 3
  fi
done

wait "$server_pid"
