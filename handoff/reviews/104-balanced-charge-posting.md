# Independent review — Order 104 balanced charge posting

**Result:** APPROVED

**Reviewed tip:** `223f3dd`

**Implementation base:** `01dcddd`

**Reviewer:** independent non-implementing Codex Tier-3 reviewer

**Date:** 2026-08-24

The reviewer did not implement Order 104. The exact `01dcddd..223f3dd` change stays
inside the order's migration, financial-context command, proof, documentation and
status scope. It does not edit the immutable baseline or referee and adds no tax,
payment, deposit, settlement, transfer, correction, trust, fiscal, cashier, AR,
day-roll, HTTP, UI, worker or automation behavior.

Migration 0010 closes the baseline's single-column financial-reference gaps with
tenant-leading candidate keys and composite foreign keys. A journal is bound to its
tenant property and exact business day; a posting is bound to its same-tenant journal,
date and currency, an account in that currency, and—when present—a folio owned by that
same account. The deterministic line-currency backfill derives only from the owning
same-tenant journal and changes no historic amount, account, folio or economics.
`tx_code_route` has an exact tenant/property/currency/code key, coherent optional
account references, tenant RLS and app-role SELECT-only access; app role cannot mutate
the global transaction-code catalogue or business-day rows.

The replacement day-open trigger selects the exact tenant/property/date row `FOR
SHARE`, rejects a missing or sealed ordinary-posting day, and therefore serializes with
the security-definer seal update. Seal requires transaction-local tenant authority for
app-role invocation and rejects mismatched tenant arguments. Static inspection and both
executed race directions confirm that a charge holding the share latch commits before a
waiting seal, while a seal holding the row update makes a waiting charge observe the
sealed row and fail without artifacts. Adjustment/correction exceptions remain the
documented append-only correction path.

`ChargeService.postCharge` accepts only the order's strict shape. Money is parsed from
a canonical positive int64 decimal string into bigint; quantity is positive, bounded to
the database scale, normalized to three decimals and never multiplied into money. The
service derives property, currency and transaction-stable property-local date from the
locked open guest folio/account, requires the exact open day, attributable revenue code
and exact open revenue route, and never accepts a caller account, route, date, currency
or journal kind. It writes exactly guest/folio `+amount` and configured revenue
`-amount` with the same code/date/currency/quantity. Journal, two immutable lines,
minimized fact/outbox evidence and `financials.charge.post` idempotency commit or roll
back together. Exact replay returns the stored journal; changed content conflicts.

On isolated fresh PostgreSQL 16.15, the reviewer personally executed:

- migrations 0001–0010 from zero and the focused Order 104 P1–P5 proof — **10 passed,
  0 failed, 111 assertions**. This included exact signs/routing/date/currency/evidence,
  balanced and unbalanced commit behavior, replay/conflict, twenty-way same-key
  convergence, failure after real outbox insertion, both seal-race directions, hostile
  shapes/configuration/RLS/ACL boundaries, and **500 charges / 1,000 immutable lines**
  followed by an unchanged 500-key replay burst;
- canonical `setup.ps1 -DbOnly` on the isolated stack — exact **85 public tables** and
  **11 passed, 0 failed of 11** referee checks;
- migration proof — Order 104's exact migration/ACL/authority case passed, as did 12
  other executable cases. The sole remaining host result was an inherited Windows
  `EPERM` while the test fixture attempted to create a symlink before any migration
  assertion; it is an OS privilege limitation and is not counted as product proof;
- fresh deployment acceptance — **4 passed, 0 failed, 10 assertions**; normalized
  schema drift matched `tests/schema/expected.sql` exactly;
- repository standing — **137 passed, 0 failed, 1,720 assertions**; TypeScript
  typecheck, 62-file import boundaries, the 23-package permissive licence gate and
  `bun audit` all passed, with no vulnerabilities found.

Protected migration 0001 SHA-256 remains
`FE2A9FC949C6BACDED3F8D3FC4D14FC596A83EBDE9AEB043EB10845F07B30923`; the referee
SHA-256 remains
`3228279BD99A8F9B6AF99748F31D4D4B482A8E627E16D92644D9D859AD8BEFA1`.
User-owned `.agents/`, `.codex/hooks.json` and `handoff/chat-archive/` paths were not
modified.

Approval is exclusive to Order 104's untaxed two-line revenue-charge foundation,
migration 0010 and its documentation/proof. It does not represent completion of the
financial phase or approval of tax allocation, nightly charging, statements,
corrections, payments, settlement, trust, fiscal documents, cashier, AR, day roll,
route authoring or any operator/API surface.

## Exclusive Order 104 discharge

- 104
