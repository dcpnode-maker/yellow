# Question 187 — Phase 7 fiscal document origin and numbering policy

**Status:** FOUNDER DECISION REQUIRED
**Raised by:** Codex after independently approved Order429/D1300
**Date:** 2026-09-04

## Why this decision is required

Order429 is the final policy-neutral India IRP boundary. It proves that the current
posted source and validation-compatible pre-document evidence are complete, then
returns no permitted action because document origin, legal number format and fiscal
series binding are intentionally unresolved.

India IRP registers a supplier-generated invoice and returns the IRN and signed QR;
it does not originate the supplier's legal invoice number. CGST Rule 46 requires a
consecutive serial number, no more than sixteen characters, unique for a financial
year, and permits one or multiple series using alphanumerics, hyphen and slash.

## Recommended founder policy

Approve all clauses below, or replace a numbered clause.

1. **Origin:** Yellow natively originates every invoice, credit note and debit note.
   IRP is a post-issue reporting/registration adapter for eligible documents, never
   the invoice-number authority. External documents may later be imported only
   through a separately governed adoption workflow and never consume a native series.
2. **Series scope:** bind each fiscal series to the exact tenant, issuing property,
   supplier GST registration, document kind and Indian financial year. Invoice,
   credit-note and debit-note counters are distinct. A property with multiple GST
   registrations cannot share one counter across registrations.
3. **Format/reset:** the default visible formats are `I/2627/<n>`, `C/2627/<n>` and
   `D/2627/<n>` for FY 2026–27, always at most sixteen characters. A new immutable
   series begins at 1 on 1 April in the issuing property's timezone; an old series
   never resets or reopens. Tenant configuration may select another Rule-46-valid
   prefix before first use, but cannot mutate it after the first allocation.
4. **Gapless issue transaction:** allocate the next number under a row/advisory lock
   inside the same database transaction that inserts the immutable document, hash
   chain and outbox evidence. Any failure rolls the transaction and counter back.
   Issued/cancelled numbers are never reclaimed or reused.
5. **Correction:** issued documents are never edited or deleted. Financial correction
   uses a separately numbered credit/debit note referencing the original; IRP
   cancellation/response history is append-only fiscal-submission evidence and does
   not erase or renumber the original.
6. **Invoice grouping:** each governed folio invoice window and legal payer produces
   its own document. Never combine different property/GST registration, legal buyer,
   currency, supply type or tax treatment. Preserve the approved room-night item
   evidence and component-first rounded tax amounts; document totals only sum those
   integers and invent no new tax residual. Section-170 settlement rounding remains
   a separate later settlement/correction boundary.
7. **Authority:** only an authorized fiscal issuer may execute native issuance.
   Post-business-day corrections additionally require the already approved authorized
   correction actor policy. Browser/UI code can request but never allocate or assert
   a number, hash, legal date, series or IRP readiness.

## Consequence if approved

The next high-risk order can add a forward-only supplier-registration-bound fiscal
series capability and one atomic native issue path over exact Order429 evidence.
It must prove 100-way gapless concurrency, tenant/property/GST-registration isolation,
immutable hash-chain and correction lineage, replay/idempotency, sealed-day behavior,
RLS/ACL containment, exact schema, referee 11/11, and fresh independent Tier-3 review.

No provider credential, sandbox submission, deployment, stable-local promotion or
Phase 7 completion is implied by approving this policy.
