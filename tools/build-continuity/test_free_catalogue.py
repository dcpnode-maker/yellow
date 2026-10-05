import copy
import unittest

from free_catalogue import require_free_model


class CatalogueChecks(unittest.TestCase):
    def test_exact_free_record_and_immutability(self):
        record = {"id": "example/code:free", "pricing": {"prompt": "0", "completion": "0"}}
        catalogue = {"data": [None, {"id": "another"}, record]}
        before = copy.deepcopy(catalogue)
        self.assertIs(require_free_model(catalogue, record["id"]), record)
        self.assertEqual(catalogue, before)

    def test_reject_malformed_catalogues_and_ids(self):
        for catalogue in (None, [], {}, {"data": {}}, {"data": None}, {"data": []}):
            with self.subTest(catalogue=catalogue), self.assertRaises(ValueError):
                require_free_model(catalogue, "example/code:free")
        for model in (None, "", False, 0, []):
            with self.subTest(model=model), self.assertRaises(ValueError):
                require_free_model({"data": []}, model)

    def test_duplicate_and_case_mismatch_fail(self):
        record = {"id": "example/code:free", "pricing": {"prompt": 0, "completion": 0}}
        for records, model in (([record, record], record["id"]), ([record], record["id"].upper())):
            with self.subTest(model=model), self.assertRaises(ValueError):
                require_free_model({"data": records}, model)

    def test_unknown_nonzero_optional_or_invalid_prices_fail_safely(self):
        for price in (None, {}, {"prompt": 0}, {"prompt": 0, "completion": 1},
                      {"prompt": 0, "completion": 0, "fee": 1},
                      {"prompt": "NaN", "completion": 0},
                      {"prompt": False, "completion": 0}):
            with self.subTest(price=price), self.assertRaises(ValueError) as raised:
                require_free_model({"data": [{"id": "private-marker", "pricing": price}]}, "private-marker")
            self.assertNotIn("private-marker", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
