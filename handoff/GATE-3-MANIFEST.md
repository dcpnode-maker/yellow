# GATE 3 MANIFEST — unverified orders awaiting independent review

Non-blocking. One row per completed order. Append and keep building; see
`handoff/GATE-3-REVIEW-CONTRACT.md`. Nothing in this file is approved.

Status legend: UNVERIFIED = built, proofs builder-asserted, not executed by the reviewer.

| Order | Tier | Impl commit | Status | Title |
|---|---|---|---|---|
| 045 | 2 | 36c9489 | UNVERIFIED | Order 045 — Fail-closed Windows handoff-state reporting |
| 046 | 3 | dc34076 | UNVERIFIED | Order 046 — Reproducible local-review demo inventory |
| 047 | 3 | fd9f438 | UNVERIFIED | Order 047 — Durable API idempotency foundation |
| 048 | 3 | fe6532f | UNVERIFIED | Order 048 — Operator inventory management |
| 049 | 3 | 4c7fc94 | UNVERIFIED | Order 049 — Operator restriction management |
| 050 | 3 | 4810439 | UNVERIFIED | Order 050 — Operator rate-plan management |
| 051 | 3 | 2a8adf8 | UNVERIFIED | Order 051 — Operator rate-price management |
| 052 | 3 | 413d568 | UNVERIFIED | Order 052 — Operator rate-price correction |
| 053 | 3 | 47f8650 | UNVERIFIED | Order 053 — Operator OOO/OOS lifecycle |
| 054 | 2 | 72cc2c5 | UNVERIFIED | Order 054 — Operator OOS sellability policy |
| 055 | 3 | 5c0da02 | UNVERIFIED | Order 055 — Operator cart-hold management |
| 056 | 3 | 41242de | UNVERIFIED | Order 056 — Audited hold-expiry worker |
| 057 | 3 | 5cdcb1b | UNVERIFIED | Order 057 — Operator bulk exclusive-room creation |
| 058 | 3 | af34ebc (order 7a72dbe) | UNVERIFIED | Order 058 — Truth-derived availability projection rebuild |
| 059 | 3 | 1b6523b (order 7cc613e) | UNVERIFIED | Order 059 — Durable availability-projection event consumer |
| 060 | 3 | 5ee75bd (order 40d13f1) | UNVERIFIED | Order 060 — Operator-controlled availability-projection bootstrap |

Protected hashes to re-quote each time:

- `migrations/0001_init.sql` — `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
- `tests/run_invariants.py` — `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`
