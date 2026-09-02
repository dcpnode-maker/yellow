# Question 181 — India accommodation component-tax rounding authority

**Status:** OPEN
**Raised by:** Codex future-readiness audit after Order350 build
**Date:** 2026-09-02

## Why a founder decision is required

Approved Order337 fixes the numeric levy rates and component order; approved Order341
selects a rate slab only for quoted room-night values; D991 and Order350 authorize a
later immutable final Section15 value for each room night. None of those authorities
decides how final tax fractions become integer INR minor units.

Order237 provides exact positive-tax rational arithmetic and half-up rounding, but
D624 explicitly calls that an inherited technical convention rather than an India
fiscal certification. It also leaves document residual allocation unresolved.
Approved Order341 deliberately does not decide whether a multi-night stay is one or
multiple statutory supplies or invoice items. Therefore a new order cannot honestly
choose among these materially different results:

1. round each IGST/CGST/SGST/UTGST component independently for each final room-night
   value, then sum the rounded component liabilities;
2. round aggregate GST for each room night once, then allocate any residual minor unit
   across ordered levy components; or
3. preserve exact fractions until a later invoice/item/document grouping exists and
   round only at that later boundary.

For example, a final value whose two 2.5% components each produce 2.5 minor units can
become 3+3 under component-first half-up, or an aggregate 5 allocated as 3+2 under an
aggregate-first rule. Both are deterministic; they are not the same liability.
Neither repository truth nor D991 authorizes selecting one. CGST Act section170
whole-rupee rounding of an amount payable/refundable is also a different downstream
boundary and must not be silently substituted for invoice-component paise arithmetic.

## Recommended founder decision

Approve all of the following, or replace any numbered clause:

1. **Final-value rate selection:** rerun the approved Order341 slab-selection rule
   against each persisted positive Order350 `transaction_value_minor`; the quoted
   slab is ancestry evidence only and cannot override a threshold crossed by final
   valuation.
2. **Component-first calculation:** for each room night, compute every ordered levy
   component independently as exact `finalValueMinor * rateBasisPoints / 10_000`,
   then round that component half-up to one INR minor unit. IGST has one component;
   CGST+SGST and CGST+UTGST round their equal-rate liabilities separately.
3. **Totals:** room-night tax is the exact signed-safe sum of its rounded components;
   valuation tax total is the sum of room-night component amounts; grand total is
   final transaction value plus tax total. No aggregate-first residual is invented.
4. **Boundary:** this produces immutable positive ordinary-final tax evidence only.
   It does not group invoice items, perform document-level residual allocation, apply
   section170 whole-rupee settlement rounding, post journals, issue/correct a document
   or calculate tax for `manual_valuation_required`.
5. **Corrections:** a later Order350 successor must create new component-tax evidence
   naming the prior tax result; it never edits prior money. Credit-note sign and
   fiscal-document correction remain separately governed.

## Consequence

If approved, draft Order353 can be migration-free and pure/read-only: replay exact
approved Order350 and complete Order340/337/341 ancestry, reselect the slab from each
final room-night value, reuse Order237's exact bounded rational and half-up primitives
without trusting its quoted inputs, and return recursively frozen tenant-bound
component/tax/grand-total evidence. Persistence, semantic account routing, posting,
invoice item grouping, document rounding, section170 settlement rounding and IRP stay
later orders.

If component-first rounding is not approved, the founder must select aggregate-first
residual allocation or defer all integer tax money until invoice grouping is decided.

## Exact dependencies and migration answer

- Mandatory predecessors: approved Order350/D991 final-valuation evidence;
  approved Order340 Section14-selected rate-version identity; approved Order337
  component schedules; approved Order341 transaction-bound ancestry and slab rule;
  Order237 exact bounded tax arithmetic only where this decision adopts it.
- Order350 is currently built pending fresh Tier3 review under D998, so Order353 may
  not activate before that approval.
- **Migration required for the recommended next slice: no.** A pure/read-only result
  is the smallest safe boundary. Persisting tax money would be a later insert-only,
  forced-RLS migration after this calculation contract is independently approved.

