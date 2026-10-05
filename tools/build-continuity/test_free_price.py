import unittest
from decimal import Decimal
from free_price import is_free_price


class TestIsFreePrice(unittest.TestCase):
    """Test cases for is_free_price function."""

    # ===== Zero forms (should return True) =====
    def test_string_zero(self):
        self.assertTrue(is_free_price({"prompt": "0", "completion": "0"}))

    def test_string_zero_point_zero(self):
        self.assertTrue(is_free_price({"prompt": "0.0", "completion": "0.0"}))

    def test_string_negative_zero(self):
        self.assertTrue(is_free_price({"prompt": "-0", "completion": "-0"}))

    def test_int_zero(self):
        self.assertTrue(is_free_price({"prompt": 0, "completion": 0}))

    def test_float_zero(self):
        self.assertTrue(is_free_price({"prompt": 0.0, "completion": 0.0}))

    def test_decimal_zero(self):
        self.assertTrue(is_free_price({"prompt": Decimal("0"), "completion": Decimal("0")}))

    def test_decimal_zero_point_zero(self):
        self.assertTrue(is_free_price({"prompt": Decimal("0.0"), "completion": Decimal("0.0")}))

    def test_decimal_negative_zero(self):
        self.assertTrue(is_free_price({"prompt": Decimal("-0"), "completion": Decimal("-0")}))

    def test_mixed_zero_forms(self):
        self.assertTrue(is_free_price({"prompt": "0", "completion": 0}))
        self.assertTrue(is_free_price({"prompt": 0.0, "completion": Decimal("0")}))
        self.assertTrue(is_free_price({"prompt": "-0", "completion": 0.0}))

    # ===== Extra zero fields (should return True) =====
    def test_extra_zero_fields(self):
        pricing = {"prompt": "0", "completion": "0", "extra": "0", "another": 0}
        self.assertTrue(is_free_price(pricing))

    def test_many_extra_zero_fields(self):
        pricing = {"prompt": "0", "completion": "0"}
        for i in range(10):
            pricing[f"field_{i}"] = "0"
        self.assertTrue(is_free_price(pricing))

    # ===== Missing fields (should return False) =====
    def test_missing_prompt(self):
        self.assertFalse(is_free_price({"completion": "0"}))

    def test_missing_completion(self):
        self.assertFalse(is_free_price({"prompt": "0"}))

    def test_missing_both_fields(self):
        self.assertFalse(is_free_price({}))

    def test_empty_dict(self):
        self.assertFalse(is_free_price({}))

    # ===== Non-dict inputs (should return False) =====
    def test_none_input(self):
        self.assertFalse(is_free_price(None))

    def test_list_input(self):
        self.assertFalse(is_free_price(["0", "0"]))

    def test_tuple_input(self):
        self.assertFalse(is_free_price(("0", "0")))

    def test_string_input(self):
        self.assertFalse(is_free_price("prompt=0,completion=0"))

    def test_int_input(self):
        self.assertFalse(is_free_price(0))

    def test_float_input(self):
        self.assertFalse(is_free_price(0.0))

    def test_bool_input(self):
        self.assertFalse(is_free_price(True))
        self.assertFalse(is_free_price(False))

    # ===== Bool/None/container values in dict (should return False) =====
    def test_bool_value(self):
        self.assertFalse(is_free_price({"prompt": True, "completion": "0"}))
        self.assertFalse(is_free_price({"prompt": "0", "completion": False}))

    def test_none_value(self):
        self.assertFalse(is_free_price({"prompt": None, "completion": "0"}))
        self.assertFalse(is_free_price({"prompt": "0", "completion": None}))

    def test_list_value(self):
        self.assertFalse(is_free_price({"prompt": ["0"], "completion": "0"}))

    def test_dict_value(self):
        self.assertFalse(is_free_price({"prompt": {"nested": "0"}, "completion": "0"}))

    def test_tuple_value(self):
        self.assertFalse(is_free_price({"prompt": ("0",), "completion": "0"}))

    def test_set_value(self):
        self.assertFalse(is_free_price({"prompt": {"0"}, "completion": "0"}))

    # ===== Nonzero values (should return False) =====
    def test_nonzero_string(self):
        self.assertFalse(is_free_price({"prompt": "1", "completion": "0"}))
        self.assertFalse(is_free_price({"prompt": "0", "completion": "0.01"}))

    def test_nonzero_int(self):
        self.assertFalse(is_free_price({"prompt": 1, "completion": 0}))
        self.assertFalse(is_free_price({"prompt": 0, "completion": -1}))

    def test_nonzero_float(self):
        self.assertFalse(is_free_price({"prompt": 0.1, "completion": 0.0}))
        self.assertFalse(is_free_price({"prompt": 0.0, "completion": -0.001}))

    def test_nonzero_decimal(self):
        self.assertFalse(is_free_price({"prompt": Decimal("1"), "completion": Decimal("0")}))
        self.assertFalse(is_free_price({"prompt": Decimal("0"), "completion": Decimal("-0.5")}))

    def test_both_nonzero(self):
        self.assertFalse(is_free_price({"prompt": "5", "completion": "10"}))

    # ===== NaN/sNaN/infinities (should return False) =====
    def test_nan_string(self):
        self.assertFalse(is_free_price({"prompt": "NaN", "completion": "0"}))
        self.assertFalse(is_free_price({"prompt": "0", "completion": "nan"}))
        self.assertFalse(is_free_price({"prompt": "sNaN", "completion": "0"}))

    def test_nan_float(self):
        self.assertFalse(is_free_price({"prompt": float("nan"), "completion": 0.0}))
        self.assertFalse(is_free_price({"prompt": 0.0, "completion": float("nan")}))

    def test_nan_decimal(self):
        self.assertFalse(is_free_price({"prompt": Decimal("NaN"), "completion": Decimal("0")}))
        self.assertFalse(is_free_price({"prompt": Decimal("0"), "completion": Decimal("sNaN")}))

    def test_infinity_string(self):
        self.assertFalse(is_free_price({"prompt": "Infinity", "completion": "0"}))
        self.assertFalse(is_free_price({"prompt": "0", "completion": "-Infinity"}))
        self.assertFalse(is_free_price({"prompt": "inf", "completion": "0"}))

    def test_infinity_float(self):
        self.assertFalse(is_free_price({"prompt": float("inf"), "completion": 0.0}))
        self.assertFalse(is_free_price({"prompt": 0.0, "completion": float("-inf")}))

    def test_infinity_decimal(self):
        self.assertFalse(is_free_price({"prompt": Decimal("Infinity"), "completion": Decimal("0")}))
        self.assertFalse(is_free_price({"prompt": Decimal("0"), "completion": Decimal("-Infinity")}))

    # ===== Optional nonzero price (should return False) =====
    def test_optional_nonzero_price(self):
        """Extra field with nonzero value should return False."""
        self.assertFalse(is_free_price({"prompt": "0", "completion": "0", "cache": "0.01"}))
        self.assertFalse(is_free_price({"prompt": "0", "completion": "0", "discount": 1}))
        self.assertFalse(is_free_price({"prompt": "0", "completion": "0", "fee": 0.5}))
        self.assertFalse(is_free_price({"prompt": "0", "completion": "0", "tax": Decimal("0.1")}))

    # ===== Input immutability =====
    def test_input_not_mutated(self):
        """Function must not mutate the input dict."""
        original = {"prompt": "0", "completion": "0", "extra": "0"}
        original_copy = original.copy()

        result = is_free_price(original)

        self.assertTrue(result)
        self.assertEqual(original, original_copy)
        self.assertIsNot(original, original_copy)  # Not checking identity, just values

    def test_input_with_nested_not_mutated(self):
        """Input with nested structures should not be mutated."""
        original = {"prompt": "0", "completion": "0", "nested": {"a": 1}}
        original_copy = {"prompt": "0", "completion": "0", "nested": {"a": 1}}

        result = is_free_price(original)

        self.assertFalse(result)
        self.assertEqual(original, original_copy)


if __name__ == "__main__":
    unittest.main()
