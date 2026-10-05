# Yellow feature register

**Updated:** 2026-09-05 · **Orders:** 433 requirements / 435 status / 440 department journeys · **Authority:** founder requirements,
[PROJECT.md](../PROJECT.md), [DECISIONS.log](../DECISIONS.log).

This is the durable index of the founder's current product direction, including the
September staff/STR, regional, voice, RMS and integration discussions. It does not
replace the complete [18-phase build plan](../BUILD-PLAN.md), earlier orders or
historical decisions. A specified requirement is not a shipped feature.

## How to read status

- **Specified**: acceptance intent is recorded; implementation is not asserted.
- **Foundation located**: relevant source exists; the complete requested journey has
  not been verified by this documentation order.
- **Access gated**: external permission, contract or credentials are needed for live
  integration, not for ordinary local design and adapter tests.
- **Built / verified / released** must name an implementation order, exact commit,
  executable proof, review where required, and runtime receipt respectively. Never
  infer these states from this table, a filename, or a vendor's feature list.

Phase status remains in [BUILD-PLAN.md](../BUILD-PLAN.md) and
[the recorded status model](../src/project-status.ts). Founder priority remains
11 → 13 → 17, subject to approved dependencies; these requirements create no new phases.

## Requirements and acceptance map

| ID | Required outcome | Owning phases | Current evidence and acceptance destination |
|---|---|---|---|
| YF-001 | One hotel/STR ecosystem: PMS, bookkeeping, channel manager, booking engine, CRS, CRM, RMS, reporting and interfaces; own the domain core, remain integration-ready | 0–17 | Specified across the build plan; [project map](PROJECT-MAP.md) defines shared boundaries. No all-modules-complete claim. |
| YF-002 | Different hotel and STR workspaces, not merely different labels or colours | 10, with 4–6, 9, 14–16 | Specified in [journeys](design/STAFF-JOURNEYS.md); hotel shift queues versus STR listing/turnover/owner workflows. |
| YF-003 | Detailed reservations with a short initial flow and contextual extra fields | 4, 10, 11, 15 | Foundation located in [reservation detail](../src/contexts/reservations/detail.ts). Acceptance includes occupancy, children/ages where needed, requests, payer, travel, source and stay changes without one giant form. |
| YF-004 | Today and future arrival/departure counts drill into the exact records, then reservation and guest | 4, 6, 10 | Foundations: [arrival roll](../src/contexts/reservations/arrival-roll.ts), [departure roll](../src/contexts/reservations/departure-roll.ts), [operator boundary](../src/http/operator.ts). Journey acceptance covers property/date/filter continuity and authorized counts. |
| YF-005 | Explainable room assignment, protected VIP/preferences, upgrades and useful sales suggestions | 2–4, 6, 13–15 | Full smart workflow specified, not verified. Hard occupancy, readiness, accessibility and assignment rules precede soft preferences; suggestions must explain evidence and trade-offs. |
| YF-006 | Checkout coordinates housekeeping room audit, minibar and luggage/bell-desk tasks | 5, 6, 10, 17 | Foundations: [checkout](../src/contexts/stay-operations/checkout.ts), [readiness](../src/contexts/stay-operations/checkout-readiness.ts), [housekeeping tasks](../src/contexts/housekeeping/tasks.ts). Full task orchestration and operational policy remain acceptance work. |
| YF-007 | Dirty, clean and inspected are distinct; staff can see cleaning progress and expected readiness | 6, 10, 17 | Foundations: [arrival cleaning](../src/contexts/housekeeping/arrival-cleaning.ts) and housekeeping tasks. Predicted readiness must not masquerade as a completed inspection. |
| YF-008 | Contextual cashier billing, append-only corrections, multiple folio windows and payer/invoice separation | 5, 7, 10 | [Cashier foundation](../src/contexts/financials/cashiers.ts), PROJECT invariants and existing financial orders govern. No deleted financial records; invoice eligibility is distinct from display grouping. Independent review D1323 rejected [Order430](../handoff/orders/430-india-native-fiscal-invoice-issuance.md). [Order434](../handoff/orders/434-native-fiscal-source-completion.md) is the independently approved repair under D1330: first native invoice without an external invoice, with persisted provenance, actual-date atomic issuance and no duplicate revenue. Its canonical77-migration source passed CI178 and merged through PR83; current source and runtime evidence remain in [PROJECT-STATUS](PROJECT-STATUS.md). |
| YF-009 | Post-business-day corrections require explicitly authorized users | 5–8 | Existing invariant and actor policies, not a UI preference. Preserve original records, current correction journal and exact post-seal authority. |
| YF-010 | Hotel configuration exercises realistic features and combinations before presentation claims | 1–4, 7–12, 17 | Specified: room classes/types/units, occupancy, amenities, charges, packages, meal plans EP/CP/MAP/AP, taxes and policies. Use synthetic fixtures, not deleted hotel data; tax/meal semantics must be explicit, not guessed from an abbreviation. |
| YF-011 | No global Simple/Advanced/Expert switch as the final UX; reveal detail in context within role access | 10 | Specified superseding design direction in [DESIGN.md](DESIGN.md). Existing runtime selector may remain until its scoped UI replacement; hiding a control never grants or removes server authority. |
| YF-012 | Dedicated Apple, Android/Pixel, Win95/98, glass, neo and ERP material/layout systems with accessible motion | 10 | [Design atlas](DESIGN.md) preserves supplied image/video/site provenance. No exact-native or screenshot-match claim without visual/interaction evidence; shared core does not require identical layouts. |
| YF-013 | Multilingual voice can answer tenant-scoped questions and perform authorized workflows conversationally | 13, then every integrated phase | Specified in [voice/RMS plan](architecture/VOICE-RMS-PLAN.md). Read, explain, clarify, preview, execute and receipt; no arbitrary generated SQL, cross-tenant context or unaudited autonomous financial action. |
| YF-014 | RMS forecasts and optimizes net revenue/profit using hotel data plus licensed market signals | 3, 9, 14, 16 | [Rate recommendation foundation](../src/contexts/rates/recommendations.ts); full RMS specified. Time-aware evaluation, price/value sensitivity, commissions, cancellations and turnover costs; no unsupported profit promise. |
| YF-015 | STR revenue workbench informed by PriceLabs: multi-calendar, rate reasons, stay restrictions and portfolio comparisons | 10, 14, 16 | Specified in voice/RMS plan. PriceLabs is a revenue benchmark, not a replacement for PMS, owner accounting, housekeeping or communications. |
| YF-016 | Channel connections cover global and regional hotel/STR channels, with explicit supported operations | 9, 15 | Specified/access gated in [OTA plan](integrations/OTA-CONNECTIVITY.md). Distinguish supply, demand, metasearch and iCal; do not mark a brand connected because public API marketing exists. |
| YF-017 | Compset observations are fresh enough for a decision, low-cost and source-permitted | 9, 14, 16 | Specified/access gated. Preserve search context, all-in price and observed time. No anonymity/real-time/completeness guarantee; no access-control or bot-protection evasion. |
| YF-018 | Own-extranet assistant retrieves allowed data and applies scoped authorized changes | 9, 13 | Specified/access gated. API/export first; provider-permitted UI fallback, human authentication where required, preview, durable audit and read-back reconciliation. Never assume our hotel account grants every extraction right. |
| YF-019 | Country, region/state, locality and owner/operator preferences without separate app forks | 1, 7–10, 12–17 | Specified in [regional packs](architecture/REGIONAL-PACKS.md). Arabic/RTL and Saudi Gathern/Almosafer are explicit discovery cases; legal policy is separately sourced/versioned. |
| YF-020 | Weather, airport, event and demand information improves RMS only when data rights and predictive value justify it | 14, 16 | Specified/access gated in voice/RMS plan. Flight activity is not passenger arrivals; public offers are not competitors' bookings; missing data remains visible. |
| YF-021 | Every phase/order has durable history and a navigable project-status record | 10 and delivery tooling | Order/review/decision/ledger foundations exist. Fully clickable order1-onward UI is a requirement, not verified by this document. Link exact work, research, tests, remaining gaps and commit evidence. |
| YF-022 | One repository lineage and stable local review app, low disk duplication and safe synthetic test data | Delivery tooling | [Project map](PROJECT-MAP.md) distinguishes main, worktree, CI and local runtime. Do not delete active work, seed production-like personal data, duplicate databases, or sync live virtual disks as a shortcut. |
| YF-023 | Any developer or AI can understand and safely change the system; efficient, low-latency OSS implementation | All | [Project map](PROJECT-MAP.md): canonical entry points, typed boundaries, contract tests, measured budgets, reproducible environment and evidence. No language/framework rewrite without a measured need. |
| YF-024 | RMS and distribution improve price/value positioning and OTA visibility together | 9, 14–16 | Specified: permitted content/amenity completeness, room/occupancy mappings, total-price parity, restrictions and authorized promotions; measure comparable offer exposure where a provider permits it. No guaranteed ranking, invented impressions or promotion spending without authority. |

## Required implementation handoff for each ID

Order440 adds the following explicit continuation of the same Codex task:

| ID | Required outcome | Owning phases | Current evidence and acceptance destination |
|---|---|---|---|
| YF-025 | Full guest lifecycle and department workdays, with owned, acknowledged, versioned handoffs | 6, 10, 11, 12, 15, 17 | [Staff journeys](design/STAFF-JOURNEYS.md), [independent research](research/HOTEL-OPERATIONS-REVIEW.md) and [16 synthetic cases](design/HOTEL-CASEBOOK.md). Specified; full cross-department backend not asserted. |
| YF-026 | One next action with preserved context on desktop and phone; visible uncertainty, receipt and next owner | 10, then each owning domain phase | [Workbench specification](design/STAFF-WORKBENCH-SPEC.md) and [14-case interaction study](design/staff-workbench/index.html). Fictional in-memory prototype using one existing appearance; live authorization and domain integration remain acceptance work. |
| YF-027 | GitHub/setup distinguish immutable schema baseline from released and candidate frontiers | Delivery tooling | [Schema guide](SCHEMA-GUIDE.md) defines80/81/125/127 and exact source evidence. No global count replacement, applied migration rewrite or count-based feature-completion claim. |


Every implementing order names its YF IDs, exact scope, existing contracts reused,
acceptance scenarios, unavailable branches, data/permission impact, performance
measurement and rollback/recovery approach. Add links here to its commit and proof
when those exist; retain historical intent when a later decision supersedes it.

At least one complete synthetic hotel journey and one complete synthetic STR journey
must pass before calling this redesigned experience ready. Cover multilingual/RTL,
two-tenant isolation, room readiness, split-payer financial corrections, stale channel
data, ambiguous voice names, cancellation, partial failure, keyboard/mobile use and
reduced motion. Exhaustive real-world combinations are not a credible promise;
use a documented risk-based pairwise matrix plus targeted high-risk combinations.
