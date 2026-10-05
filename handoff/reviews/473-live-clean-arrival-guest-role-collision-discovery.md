# Order 473 — read-only discovery

Date: 2026-09-20 · Executor: Codex `/root`.

The verified public-demo target has exactly one guest role for the fixed synthetic
Party, but its detail fingerprint differs from the reviewed canonical fixture:

| Metadata-only check | Result |
| --- | ---: |
| target guest-role rows | 1 |
| current detail MD5 | `761ff24de983cf7a55ca19a1e1dd3d4d` |
| canonical detail MD5 | `094ace4f4364a1953461d320a19d2cb3` |
| linked accounts / primary reservations / reservation-guest rows | 1 / 1 / 1 |

This was read-only. No migration, correction function, seed or target record was
changed. Because the role has account/reservation dependencies, a direct update is
not authorized. A new target-bound governed role-detail reconciliation, with
isolated rollback/race proof and independent review, is required before Order472
can resume.
