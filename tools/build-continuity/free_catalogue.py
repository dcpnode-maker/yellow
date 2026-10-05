from typing import Any, Dict

from free_price import is_free_price


def require_free_model(catalogue: Any, model_id: str) -> Dict[str, Any]:
    """
    Return the catalogue record matching model_id with verified free pricing.

    Raises:
        ValueError: If model_id is empty, catalogue is malformed, no match,
        duplicate matches, or pricing is not free.
    """
    if not isinstance(model_id, str) or not model_id:
        raise ValueError("model_id must be a nonempty string")

    if not isinstance(catalogue, dict):
        raise ValueError("catalogue must be a dict")

    data = catalogue.get("data")
    if not isinstance(data, list):
        raise ValueError("catalogue must contain a list 'data'")

    matches = []
    for record in data:
        if not isinstance(record, dict):
            continue
        if record.get("id") == model_id:
            matches.append(record)

    if len(matches) == 0:
        raise ValueError("model not found")
    if len(matches) > 1:
        raise ValueError("duplicate model id")

    record = matches[0]

    pricing = record.get("pricing")
    if not is_free_price(pricing):
        raise ValueError("model pricing is not free")

    return record
