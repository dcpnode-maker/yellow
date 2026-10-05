#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

: "${YELLOW_ROOT:=$HOME/.yellow-phone-worker}"
: "${YELLOW_MAX_TEMP_C:=45}"
: "${YELLOW_RESUME_TEMP_C:=42}"
: "${YELLOW_RETRY_SECONDS:=60}"

[[ "$YELLOW_MAX_TEMP_C" =~ ^[0-9]+([.][0-9]+)?$ ]] || { echo 'stop temperature must be numeric' >&2; exit 2; }
[[ "$YELLOW_RESUME_TEMP_C" =~ ^[0-9]+([.][0-9]+)?$ ]] || { echo 'resume temperature must be numeric' >&2; exit 2; }
[[ "$YELLOW_RETRY_SECONDS" =~ ^[1-9][0-9]*$ ]] || { echo 'retry seconds must be a positive integer' >&2; exit 2; }

python - "$YELLOW_MAX_TEMP_C" "$YELLOW_RESUME_TEMP_C" <<'PY'
import sys
stop, resume = map(float, sys.argv[1:])
if resume >= stop:
    raise SystemExit("resume temperature must be below stop temperature")
PY

if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock || true
fi

release_lock() {
  if command -v termux-wake-unlock >/dev/null 2>&1; then
    termux-wake-unlock || true
  fi
}
trap release_lock EXIT INT TERM

while true; do
  # Hysteresis prevents repeated starts and stops at the 45 C boundary.
  if ! YELLOW_MAX_TEMP_C="$YELLOW_RESUME_TEMP_C" "$YELLOW_ROOT/guard.sh"; then
    sleep "$YELLOW_RETRY_SECONDS"
    continue
  fi

  set +e
  YELLOW_MAX_TEMP_C="$YELLOW_MAX_TEMP_C" "$YELLOW_ROOT/start-server.sh"
  result=$?
  set -e

  # Missing/corrupt configuration is not transient. Thermal, battery, calls,
  # and Android memory pressure are retried after a bounded cooling pause.
  if [ "$result" -eq 2 ]; then
    exit "$result"
  fi
  sleep "$YELLOW_RETRY_SECONDS"
done
