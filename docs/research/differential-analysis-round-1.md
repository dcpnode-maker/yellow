# Differential Analysis — Round 1

**Sources:** Mews Connector API operation index (public), Apaleo Open API surface (public), both fetched 12 Aug 2026.
**Compared against:** `PMS-master-build-prompt.md` v0.1
**Provenance:** Both sources are published for third-party integration. Clean to work from.

---

## Summary

24 genuine gaps found. Three are **architectural** — they change the entity model rather than adding a feature, and need resolving before the ERD. The rest are additive.

The most important finding: **our folio model is wrong.** It assumes a folio belongs to a stay. Both Mews and Apaleo model folios as independent of reservations, and they're right.

---

## A. Architectural gaps — resolve before the ERD

### A1. Folios must not belong to reservations ⚠️ **highest priority**

- Mews has *paymasters*; Apaleo has *external folios*. Both allow a folio to exist with no reservation attached.
- Required for: house accounts, walk-in POS charges, event/banquet billing, permanent department accounts, deposits taken before a booking exists, group masters that outlive individual stays.
- **Correct model:** `Folio` is owned by an `Account` (guest, company, house, outlet, event). A reservation *links to* folios; it does not own them. Billing windows become folios-with-a-shared-owner rather than subdivisions of a stay.
- This is the single most expensive thing to retrofit. Fix it in the ERD.

### A2. Routing should generalise into billing automations

- Mews **deprecated** their routing-rules API and replaced it with *billing automations* — scheduled/triggered billing actions with assignment rules, of which routing is one case.
- That's a strong signal from a company that has run both models in production. Static routing instructions don't cover: recurring charges, deferred posting, conditional transfers, payment plans.
- **Proposal:** model a `BillingAutomation` with trigger (event or schedule), condition, and action (route / post / transfer / request payment). Routing, fixed charges, and deposit schedules all collapse into it.

### A3. Time-slice definitions as a configured entity

- Apaleo makes the *unit of stay* configurable per property: overnight and day-use patterns, each with its own check-in/check-out times, and rate plans filtered by pattern.
- Our slot model handles this conceptually but the spec never defined the configuration layer. Without it, hourly/day-use/long-stay products get hardcoded.
- **Proposal:** `SlotPattern` entity — template, duration unit, check-in/out times, applicable rate plans. Slots are instances of a pattern.

---

## B. Missing entities — additive but should be in v1 of the ERD

| # | Gap | Why it matters |
|---|---|---|
| B1 | **Counters** | Sequential number generators as a configurable entity (bill series, invoice series, registration numbers). We had "sequential invoice numbering" as a property, not a primitive. Jurisdictions mandate specific series behaviour. |
| B2 | **Outlets + outlet bills** | POS outlets as first-class entities with their own bills, not merely an inbound interface. Needed for F&B, spa, retail operating semi-independently and settling to room or to their own tender. |
| B3 | **Vouchers + voucher codes** | Distinct from promotions: issued instruments with codes, redemption tracking, and validity. We only had promo codes. |
| B4 | **Resource access tokens** | Digital keys as an entity — validity interval, permissions, per-resource grants, revocation. We mentioned mobile keys without modelling them. |
| B5 | **Message threads** | Two-way threaded guest messaging. Our spec had outbound delivery only. Guest messaging is now table stakes. |
| B6 | **Identity documents** | Separate entity with full CRUD *and* a bulk-clear operation for GDPR erasure. We folded this into profile fields. |
| B7 | **Age categories** | Configurable per service, not hardcoded child buckets. Drives pricing and occupancy rules. |
| B8 | **Departments** | Task routing targets as entities. Our traces/tasks had no explicit assignee model. |
| B9 | **Company contracts** | Negotiated commercial terms as a dated entity, distinct from the negotiated rates they produce. |
| B10 | **Payment requests / payment method requests** | Asking a guest to pay, or to supply a payment method, as a tracked object with lifecycle and cancellation. We only had deposit chase. |
| B11 | **Availability blocks vs adjustments** | Mews separates grouped availability updates (blocks) from raw adjustments. Useful for attributing *why* availability changed. |
| B12 | **Ledger balances by day** | Daily balance snapshots as a queryable projection. Fits our event-sourced ledger; needs to be an explicit projection. |

---

## C. Refinements to existing spec items

| # | Item | Change |
|---|---|---|
| C1 | Charges | Add **transitory charges** — posted to a folio before payer assignment, resolved later. Common in POS integration. |
| C2 | Adjustments | Add **allowances** as a first-class negative adjustment *linked to a specific charge*, distinct from a discount on a rate. Different accounting treatment. |
| C3 | Occupancy pricing | Replace fixed occupancy tiers with **capacity offset pricing** — price as a function of offset from base occupancy. Cleaner generalisation. |
| C4 | Segmentation | Separate **business segment** from market segment and source. Mews treats these as distinct dimensions; conflating them loses reporting fidelity. |
| C5 | Overbooking | Make limits explicitly **per service, per date range**, not a single property-level number. |
| C6 | Reservation | Add **travel purpose** (business/leisure) — required for statutory reporting in several EU jurisdictions and for corporate reporting. |
| C7 | Webhooks | Specify **per-topic subscriptions with event filters and wildcards** (Apaleo's model). Ours said "webhooks" without a subscription model. |
| C8 | Property setup | Add **property lifecycle actions**: clone, archive, set-live. Multi-property rollout automation — directly relevant to your chain ambitions. |
| C9 | Platform | Add a **UI extension API** — third parties injecting UI into the PMS, not just calling it. Apaleo does this and it deepens the integration moat. |

---

## D. Where our spec is already ahead

Worth recording, since the question was whether we're differentiated:

- **Continuous day-close.** Neither competitor exposes a logical-close model; both still run a night-audit-shaped process.
- **Offline-capable front desk.** Neither offers this. It remains a genuine differentiator.
- **Typed, versioned, diffable configuration.** Both have configuration APIs; neither treats config as promotable versioned artefacts.
- **Tiered multi-tenancy.** Both are single-model SaaS. Our shared-RLS → schema → dedicated ladder is an enterprise sales lever they can't match without re-architecture.
- **org_node / ltree hierarchy.** Both are essentially property-and-chain; deeper brand/region/building hierarchies are ours.
- **Intelligence layer over the event log.** Neither exposes anything comparable.
- **Migration tooling as a product.** Neither treats this as a first-class feature.

---

## E. Notes on interpretation

- Both sources are *integration surfaces*, not complete feature sets. Internal-only capability (housekeeping task allocation algorithms, reporting, revenue management internals) is under-represented in API docs. Absence here is not evidence of absence in the product.
- Mews' deprecations are the most valuable signal in this document. They mark places where a mature product changed its mind — routing → billing automations, accounting items → payments + order items, merge customers → merge accounts (i.e. generalising from guest-specific to account-generic). All three point the same direction: **generalise the account, generalise the billing action.** We should start where they arrived.

---

## F. Recommended next actions

1. Rework the folio/account model (A1) — this blocks the ERD.
2. Decide on billing automations vs static routing (A2).
3. Add `SlotPattern` to the inventory model (A3).
4. Fold B1–B12 into the entity list.
5. Apply C1–C9 to the master prompt as v0.2.
6. **Round 2:** Cloudbeds (STR/hostel angle — likely surfaces gaps in your short-term-rental scope) and the OpenTravel/HTNG message specs for field-level completeness.
