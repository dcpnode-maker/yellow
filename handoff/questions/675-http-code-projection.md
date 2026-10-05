# Q675 — HTTP board serializer scope

Resolved by primary implementation owner before edits, 24 September 2026 (routine D-91 integration authority).

The existing src/http/operator.ts reservationBoardJson explicitly enumerates response fields. An additive domain projection alone cannot reach the UI. Admit only two fields in this serializer and focused HTTP contract tests under tests/order675-*.test.ts. No routing, auth, permissions or command changes. The source file was already dirty; preserve all earlier work. A deployment may copy this file only after the pre-675 source is proven equal to the serving file and the final diff is exactly the two fields. Otherwise deployment remains blocked, not broadened.
