from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Union

Number = Union[str, int, float, Decimal]


def is_free_price(pricing: Any) -> bool:
    """
    Return True iff pricing is a dict containing at least 'prompt' and 'completion',
    and every value is a finite Decimal equal to zero.

    Accepted zero forms: "0", "0.0", "-0", 0, 0.0, Decimal("0").
    Rejects: missing fields, non-dict, None, bool, empty/invalid strings,
    nonzero values, NaN, infinities. Returns False on any malformed input.
    Does not mutate input.
    """
    if not isinstance(pricing, dict) or not pricing:
        return False

    required = ("prompt", "completion")
    for key in required:
        if key not in pricing:
            return False

    for value in pricing.values():
        if isinstance(value, bool):
            return False
        if not isinstance(value, (str, int, float, Decimal)):
            return False

        try:
            dec = Decimal(value)
        except (InvalidOperation, ValueError, TypeError):
            return False

        if not dec.is_finite() or dec != 0:
            return False

    return True
