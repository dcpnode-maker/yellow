# Question190 — Preserve incomplete0076 work without enabling it

**Raised:** 2026-09-05, Order434, before creating additional draft paths.

The reserved0076 completion migration needs independent preparation and
Financials implementation lanes. Putting unfinished capability code in the
production migration directory would make it runnable before full canonical
issuance acceptance. Sharing one mutable SQL file would also conflict with
exclusive lane ownership.

## RESOLVED — D1346, technical scope amendment only

Admit these non-runnable implementation fragments:

- `handoff/drafts/order434/0076-native-preparation.sql`
- `handoff/drafts/order434/0076-native-accounting.sql`

The coordinator owns preparation; the bounded Financials SQL worker owns
accounting. The fragments must use the already approved tables, events, lock
order and capabilities in Order434. They are assembled into the one reserved
`migrations/0076_india_native_fiscal_source_completion.sql` only with complete
canonical preparation/commit and all required verification. They are not extra
production migrations, executable deployment permission, a new feature boundary,
or separately completed orders. No public index/API/local promotion is implied.

All source, monetary, tenant, numbering, immutable correction and independent
acceptance requirements of Order434 remain unchanged.
