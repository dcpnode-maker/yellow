# Independent review — Order 105 operator folio statement and charge

**Result:** APPROVED

**Reviewed tip:** `97f3bdc`

**Implementation base:** `a72a782`

**Reviewer:** independent non-implementing Codex Tier-3 reviewer

**Date:** 2026-08-24

The reviewer did not implement Order 105. The exact `a72a782..97f3bdc` implementation
change stays inside the order's declared financial-query, operator adapter/assets,
review-seed permission, proof, documentation, governance and status scope. The range is
linear, has no merge commit, preserves the `[codex]` attribution convention and edits no
migration, schema snapshot, immutable baseline or referee. Commit `5f490fc` contains
only the intentional-red statement-export and Folios-workbench canaries and precedes
the production/permission implementation in `97f3bdc`.

`FolioStatementService.get` strictly validates tenant, property, exact folio UUID or
human reference, bounded page limit and a canonical versioned base64url cursor. The
cursor is bound to property, resolved folio and the complete
`(business_date, created_at, journal_id, seq)` keyset. One PostgreSQL statement resolves
the exact transaction tenant/property folio; computes signed exact decimal-string
balance and full-ledger running balances before the newest-first outer page; fetches
limit plus one; and returns only the folio's guest-account lines. Counterpart lines,
account/route ids, source, tax detail and Party/contact data are absent. Applicable
options contain only code, name and non-empty USALI line from an exact tenant/property/
currency read-only route to an open attributable revenue account. The query creates no
fact, event or idempotency artifact.

The two HTTP routes require distinct `financials.folios:read` and
`financials.charges:write` scopes and resolve current exact/ancestor property grants
before calling a financial service. GET delegates only to the statement query. POST
accepts only `{txCode,amountMinor,quantity?}`, reads idempotency only from the header,
creates one authenticated server audit envelope and delegates economic mutation only
to the already-approved `ChargeService.postCharge`. Real HTTP proof confirms read-only
cannot post, write-only cannot read, exact grants do not reach siblings, ancestor grants
reach descendants, foreign-property and foreign-tenant folios share one generic 404,
hostile input creates no artifacts, and exact replay retains one balanced journal while
changed content conflicts.

The Folios workbench renders server money and running-balance strings through created
nodes and `textContent`; its financial slice contains no `Number`, `parseInt`,
`parseFloat`, `Math`, `toFixed` or client balance calculation. The tx code is a bounded
server option, the irreversible untaxed confirmation is explicit, one key survives
retry/double-click, and no row or balance is painted before POST success plus a fresh
statement GET. Lookup, older-page and charge success/error/finally paths all capture and
check generation, property and folio identity. Property change and sign-out clear the
statement, options, form and pending key. The UI explicitly says this slice is not tax,
invoice, payment, settlement, fiscalization or checkout completion.

On isolated disposable PostgreSQL 16.15 databases, without altering the live
`yellow_dev`, the reviewer personally executed:

- Order 105 statement and operator/HTTP proof together — **22 passed, 0 failed, 144
  assertions**: statement **9/9**, including mixed signs beyond 2^53, exact
  microseconds, complete non-resetting pagination, hostile tenant/property/cursor
  disclosure checks and the indexed **10,000-line** page; workbench plus real
  authenticated HTTP **13/13**, including the canonical two-line Order 104 journal,
  minimized fact/outbox evidence and exact replay/conflict;
- inherited exact local-review permission suites on separate fresh databases — **30
  passed, 0 failed, 185 assertions**: review seed 11/39, operator holds 7/48, offline
  leases 6/70 and OOS policy 6/28. A first combined attempt was discarded because the
  legacy deterministic fixtures interfered, and a parallel retry was discarded after
  exhausting the disposable server's connection cap; all four then passed on isolated
  fresh databases;
- full Linux migration proof — **14 passed, 0 failed, 82 assertions**. A prior Windows
  attempt passed 13 cases and hit only host `EPERM` while creating the symlink fixture;
  the required Linux rerun passed that case and every migration assertion;
- fresh deployment acceptance — **4 passed, 0 failed, 10 assertions**; normalized
  schema drift exactly matched `tests/schema/expected.sql`;
- canonical isolated `setup.sh --db-only` — exact **85 public tables** and referee
  **11 passed, 0 failed of 11**;
- repository standing — **148 passed, 0 failed, 1,804 assertions**; TypeScript
  typecheck, **63-file** import boundaries, the 23-package permissive licence gate and
  `bun audit` all passed, with no vulnerabilities found.

Protected migration 0001 SHA-256 remains
`FE2A9FC949C6BACDED3F8D3FC4D14FC596A83EBDE9AEB043EB10845F07B30923`; the referee
SHA-256 remains
`3228279BD99A8F9B6AF99748F31D4D4B482A8E627E16D92644D9D859AD8BEFA1`.
User-owned `.agents/`, `.codex/hooks.json` and `handoff/chat-archive/` paths were not
modified. All disposable reviewer infrastructure was removed after proof.

No findings. Approval is exclusive to Order 105's exact-string operator folio statement,
strict property-scoped read/write adapters and stale-safe untaxed-charge workbench. It
does not approve tax calculation, invoices/documents, payment/deposit, settlement,
fiscalization, checkout completion, correction/transfer, trust, cashier, AR, day roll,
route authoring, guest/public presentation or any later Phase-5 work.

## Exclusive Order 105 discharge

- 105
