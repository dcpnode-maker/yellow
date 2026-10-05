"""Execute the guard's actual embedded Python against bounded sensor fixtures."""
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch


GUARD = Path(__file__).parents[1] / "guard.sh"


class TemperatureGuardTests(unittest.TestCase):
    def run_guard(self, battery, sensors=None, threshold="45", sensor_error=None):
        source = GUARD.read_text(encoding="utf-8").split("<<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]
        error = sensor_error or (FileNotFoundError() if sensors is None else None)
        with patch.object(sys, "argv", ["guard", json.dumps(battery), "20", threshold]), patch(
            "subprocess.check_output", return_value=json.dumps(sensors), side_effect=error
        ):
            try:
                exec(compile(source, str(GUARD), "exec"), {"__name__": "__main__"})
            except SystemExit as exc:
                return str(exc)
        return None

    def test_hot_battery_stops_without_optional_sensor(self):
        self.assertIsNotNone(self.run_guard({"percentage": 95, "temperature": 45}))
        self.assertIsNotNone(self.run_guard({"percentage": 95, "temperature": 49}))

    def test_cool_battery_is_valid_fallback(self):
        self.assertIsNone(self.run_guard({"percentage": 95, "temperature": 34.5}))

    def test_unknown_temperature_fails_closed(self):
        self.assertIsNotNone(self.run_guard({"percentage": 95}))
        self.assertIsNotNone(self.run_guard({"percentage": 95}, []))

    def test_hottest_reading_wins(self):
        self.assertIsNotNone(self.run_guard({"percentage": 95, "temperature": 34}, [{"temperature": 46}]))
        self.assertIsNotNone(self.run_guard({"percentage": 95, "temperature": 46}, [{"temperature": 34}]))

    def test_hysteresis_stops_at_45_and_resumes_below_42(self):
        self.assertIsNone(self.run_guard({"percentage": 95, "temperature": 44.9}))
        self.assertIsNotNone(self.run_guard({"percentage": 95, "temperature": 42}, threshold="42"))
        self.assertIsNone(self.run_guard({"percentage": 95, "temperature": 41.9}, threshold="42"))

    def test_invalid_measurements_are_rejected(self):
        for value in (None, True, "NaN", "Infinity", "broken", -300, 300):
            with self.subTest(value=value):
                self.assertIsNotNone(self.run_guard({"percentage": 95, "temperature": value}))

    def test_optional_sensor_timeout_can_use_battery(self):
        self.assertIsNone(self.run_guard({"percentage": 95, "temperature": 35}, sensor_error=subprocess.TimeoutExpired("sensor", 5)))
        self.assertIsNotNone(self.run_guard({"percentage": 95}, sensor_error=subprocess.TimeoutExpired("sensor", 5)))

    def test_low_battery_and_unsafe_thresholds_are_rejected(self):
        self.assertIsNotNone(self.run_guard({"percentage": 19, "temperature": 30}))
        for value in ("46", "NaN", "0", "-1"):
            self.assertIsNotNone(self.run_guard({"percentage": 95, "temperature": 30}, threshold=value))


if __name__ == "__main__":
    unittest.main()
