"""Manually transcribed synthetic Worker 2 output; never imported by Yellow.

The source is the 28 September 2026 Kaggle notebook's 23.09-second
Qwen3.8-27B Q4_K_M non-thinking trial. Keep it only for the model rubric.
"""


def coalesce_nights(stays):
    if not stays:
        return []

    for start_day, end_day in stays:
        if end_day < start_day:
            raise ValueError(f"Invalid stay: end_day {end_day} < start_day {start_day}")

    sorted_stays = sorted(stays, key=lambda s: s[0])

    merged = []
    current_start, current_end = sorted_stays[0]

    for start_day, end_day in sorted_stays[1:]:
        if start_day <= current_end + 1:
            current_end = max(current_end, end_day)
        else:
            merged.append((current_start, current_end))
            current_start, current_end = start_day, end_day

    merged.append((current_start, current_end))

    return merged
