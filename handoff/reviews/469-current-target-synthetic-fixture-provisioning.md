# Order 469 — current-target synthetic fixture provisioning evidence

**Date:** 2026-09-20 · **Executor:** Codex · **Target:** verified private-loopback
Yellow Demo database; no URL, credential or raw fixture value is recorded.

## Preflight fingerprint (read-only)

The database ledger was already at 93. A tenant-scoped `BEGIN TRANSACTION READ
ONLY` census captured count plus deterministic content fingerprint for Party,
Party-role, contact, reservation, segment, reservation-guest, occupancy, account,
folio, journal, posting, payment, document, identity-document, fact and outbox.
The values were deliberately emitted only to the protected execution transcript and
not copied here because even synthetic fingerprint sets are deployment evidence.

## Provisioner result

The reviewed provisioner was run once with its output suppressed. It exited 1 and
its output digest was `e4f43a30fe188d70b56c820bd454a8fc370ddd315d21c3667aa0e9883fab29e5`
(416 bytes). A second output-free classification confirms an exact-shape collision,
not a migration, permission, connection or duplicate-key failure.

Boolean-only classification localizes the failing fixture path to the canonical
clean-arrival branch and its account dependency. It does **not** authorize an
account, folio, reservation, occupancy or financial reconciliation. No partial
provisioning acceptance, reset, reseed, direct mutation or public-data change was
performed in this order.

## Decision

Order 469 cannot proceed until a new bounded, independently reviewed discovery
order identifies the current clean-arrival account mismatch using read-only,
tenant-scoped comparison. Financial primitives remain protected.
