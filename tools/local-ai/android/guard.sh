#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

: "${YELLOW_MIN_BATTERY:=20}"
: "${YELLOW_MAX_TEMP_C:=45}"

command -v termux-battery-status >/dev/null || { echo 'termux-api is required' >&2; exit 2; }
raw="$(timeout 15 termux-battery-status)" || { echo 'battery probe unavailable' >&2; exit 3; }
python - "$raw" "$YELLOW_MIN_BATTERY" "$YELLOW_MAX_TEMP_C" <<'PY'
import json, math, subprocess, sys

def number(value, label, lower, upper):
    if isinstance(value, bool) or value is None:
        raise SystemExit(label + " unavailable")
    try:
        result = float(str(value).replace("°C", "").strip())
    except (ValueError, TypeError):
        raise SystemExit(label + " invalid")
    if not math.isfinite(result) or not lower <= result <= upper:
        raise SystemExit(label + " invalid")
    return result

minimum = number(sys.argv[2], "battery threshold", 20, 100)
maximum = number(sys.argv[3], "temperature threshold", 0.1, 45)
try:
    battery = json.loads(sys.argv[1])
except (ValueError, TypeError):
    raise SystemExit("battery probe invalid")
if not isinstance(battery, dict):
    raise SystemExit("battery probe invalid")
if number(battery.get("percentage"), "battery percentage", 0, 100) < minimum:
    raise SystemExit("battery below worker threshold")

# Battery temperature is available on devices without the optional thermal tool.
# Never mistake an absent sensor command or an empty sensor list for a cool phone.
values = []
if "temperature" in battery:
    values.append(number(battery["temperature"], "battery temperature", -20, 125))
try:
    output = subprocess.check_output(
        ["termux-thermal-sensor"], text=True, timeout=5, stderr=subprocess.DEVNULL
    )
    sensors = json.loads(output)
except (OSError, subprocess.SubprocessError, ValueError):
    sensors = []
if isinstance(sensors, list):
    for item in sensors:
        if not isinstance(item, dict):
            continue
        for key in ("Temperature", "temperature", "temp"):
            if key in item:
                values.append(number(item[key], "sensor temperature", -20, 125))
if not values:
    raise SystemExit("temperature unavailable; worker stopped")
if max(values) >= maximum:
    raise SystemExit("thermal limit reached")
PY
