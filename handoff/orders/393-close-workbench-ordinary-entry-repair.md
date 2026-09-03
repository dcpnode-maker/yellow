# Order 393 — Close-workbench ordinary entry repair

**Status:** ACTIVE-D1132
**Phase:** 5 — Financials operator delivery repair
**Branch:** `phase-5/operator-business-day-close-workbench`
**Base:** exact withheld full-review tip `44ec326`
**Risk tier:** 3 — tenant-scoped financial-day discovery

Repair only D1131's ordinary-navigation dead end. An authorized operator who opens
the visible **Day close** workspace without a date must obtain the earliest persisted
unsealed business date from PostgreSQL, then load the existing exact one-statement
workbench and canonicalize the URL. No browser/server clock or fabricated default is
allowed.

## Exact scope

- `src/contexts/financials/business-day-close-workbench.ts` and its index export, only
  a minimized caller-Tx entry-date discovery;
- `src/http/operator.ts`, only a read-only collection entry route using middleware Tx;
- `src/http/operator/operator.js`, only undated entry/refresh/retry bootstrap;
- focused workbench domain/operator/browser tests, including a permanent executable
  D1131 regression;
- `docs/CONTRACTS.md`, `docs/UI-SPEC.md` only for the entry contract;
- this order, its independent review, `DECISIONS.log`, `handoff/LEDGER.md`.

No migration/schema/permission/seed, readiness/carry/bounds semantics, HTML/CSS/theme,
server construction, dependency, local runtime, `.yellow`, command, deploy, merge or
push.

## Contract

`GET /api/v1/properties/:property/business-days/close-workbench` uses the existing
tenant middleware transaction and `financials.business-days:read`. It returns exactly
`{businessDate}` for the earliest persisted unsealed day of the active same-tenant
property after confirming the active actor. No date list, opened time, counts or other
financial evidence is returned. No matching day/property/actor is the same unavailable
result. It performs one read statement and zero writes.

On an undated human route, the browser first requests that entry date, then requests
the existing dated workbench. The workbench itself remains exactly one composed
PostgreSQL statement/snapshot and enforces 366/367 plus 500/501 fail-closed limits.
Generation/property/view guards cover both requests; stale or failed discovery never
loads or renders a workbench. Success canonicalizes `?date=` and enables the selector
from the authoritative workbench response. Refresh/retry use the selected/deep-link
date when present and rediscover only when absent.

## Executable proof

1. Preserve D1131 as an intentional executable red before product repair.
2. Prove earliest persisted unsealed selection, sealed exclusion, no clock inference,
   tenant/property/actor containment, unavailable equivalence, exact JSON and zero writes.
3. Prove ordinary navigation requests discovery then dated workbench; deep links skip
   discovery; stale property/view generations, discovery failure, refresh and retry are safe.
4. Preserve every Order384/390–392 database, bound, carry, HTTP, UI and standing gate.
5. A different fresh non-implementing Tier3 restarts the complete Order384 review after
   approving this repair; no prior partial green verdict is reused.

## Definition of done

- [ ] Visible undated Day close navigation reaches an authoritative workbench.
- [ ] Date discovery is PostgreSQL-owned, least-data, read-only and caller-Tx.
- [ ] Fresh Tier3 repair approval and separate full Order384 approval are recorded.
