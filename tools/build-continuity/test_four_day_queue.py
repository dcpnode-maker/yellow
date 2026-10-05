from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_four_day_queue import QueueError, validate_queue


ROOT = Path(__file__).resolve().parents[2]
QUEUE = ROOT / "tools" / "build-continuity" / "four-day-queue.json"


class FourDayQueueTests(unittest.TestCase):
    def payload(self) -> dict:
        return json.loads(QUEUE.read_text(encoding="utf-8"))

    def test_real_queue_is_valid_and_bounded(self) -> None:
        result = validate_queue(ROOT, self.payload())
        self.assertEqual(4, result["days"])
        self.assertGreaterEqual(result["tasks"], 20)
        self.assertGreater(result["dependencies"], 0)

    def test_rejects_unknown_lane_and_missing_order(self) -> None:
        payload = self.payload()
        payload["days"][0]["tasks"][0]["lane"] = "imaginary"
        with self.assertRaisesRegex(QueueError, "unknown lane"):
            validate_queue(ROOT, payload)
        payload = self.payload()
        payload["days"][0]["tasks"][0]["order"] = "handoff/orders/not-real.md"
        with self.assertRaisesRegex(QueueError, "does not exist"):
            validate_queue(ROOT, payload)

    def test_rejects_cycle_and_duplicate_id(self) -> None:
        payload = self.payload()
        first = payload["days"][0]["tasks"][0]
        last = payload["days"][-1]["tasks"][-1]
        first["depends_on"] = [last["id"]]
        with self.assertRaisesRegex(QueueError, "cycle"):
            validate_queue(ROOT, payload)
        payload = self.payload()
        payload["days"][0]["tasks"][1]["id"] = payload["days"][0]["tasks"][0]["id"]
        with self.assertRaisesRegex(QueueError, "unique"):
            validate_queue(ROOT, payload)

    def test_rejects_unordered_overlapping_writer_scopes(self) -> None:
        payload = self.payload()
        left = payload["days"][2]["tasks"][0]
        right = payload["days"][2]["tasks"][2]
        right["depends_on"] = ["D2-06"]
        left["writes"] = ["shared:area"]
        right["writes"] = ["shared"]
        with self.assertRaisesRegex(QueueError, "unordered overlapping"):
            validate_queue(ROOT, payload)


if __name__ == "__main__":
    unittest.main()
