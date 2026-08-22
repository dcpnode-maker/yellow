# Phase 3 plan — Universal rate plans, reproducible quotes and safe hotel choice

**Product direction:** founder instruction recorded by D-147 and D-230  
**Baseline entering this phase:** Orders 032–036 and 050–052 already provide validated policy
creation, base rate plans, exact append-only prices, immutable correction, manual restrictions
and a progressive operator workbench. This phase extends those primitives; it does not replace
them.

## Product promise

A hotel can configure a rate plan at the level that matches its operation:

- **Guided mode** starts from tested presets and asks only the decisions needed for that model.
- **Expert mode** (the founder's “God mode”) exposes the full typed rule graph, precedence,
  simulation, conflicts and version history.
- **AI-assisted mode** accepts a hotel's plain-language intent, translates it into the same typed
  draft used by the two visual modes, shows its interpretation and conflicts, and explains what
  is impossible or forbidden before a human or authorized automation publishes it.

These are three authoring experiences over one canonical command/query model. There is no
AI-only mutation path and no separate “simple” pricing engine.

## Universal five-step flow

1. **Create rate** — name, stable code, currency, tax-display treatment and model family.
2. **Pricing** — static, calendar, fixed, BAR adjustment, derived, room matrix, contract,
   occupancy/LOS-responsive, approved RMS/API input, floor/ceiling and explicit overrides.
3. **Who gets it** — company, market group, market, source, channel, segment, agent and campaign.
4. **Where and when** — property, class, unit type, exact sellable/room, local stay dates, day of
   week, booking window, occupancy, length of stay, guest mix and distribution conditions.
5. **Review and publish** — simulate quotes, identify conflicts, show tax/policy/restriction
   effects, approve, publish an immutable version, and undo by publishing a new version.

## Model catalogue

The initial catalogue must offer these composable choices rather than a single giant form:

| Model | Meaning | Required evidence |
|---|---|---|
| Simple fixed | One exact amount for a bounded date/day/room scope | Exact bigint minor units and currency |
| Calendar | Explicit date-cell amounts and closed/open cells | Date coverage and gap preview |
| BAR ladder | Base available rate with typed +/- percentage or exact amount steps | No floating-point money; deterministic rounding |
| Derived | Versioned relation to another plan with typed adjustment | Parent change/child override history |
| Room matrix | One model across room classes/types/sellables with explicit deltas | Most-specific resolution and equal-specificity conflict refusal |
| Occupancy/LOS | Typed bands for occupancy, stay length and booking window | Boundary and timezone tests |
| Contract/negotiated | Company/agent/segment eligibility with effective dates | Party-role authorization and eligibility proof |
| Package | Room price plus versioned elements such as meal plan or allowance | No parallel money or inventory truth |
| RMS/API managed | Recommendations imported through an adapter and reviewed or policy-authorized | Source/version evidence, bounds and fallback |
| Expert composition | A validated combination of registered rule kinds | Reproducible AST; no arbitrary executable formula |

Dynamic never means an opaque model can write a price directly. A recommendation becomes a
typed, attributable draft or a pre-authorized bounded command whose evidence is retained.

## Applicability and conflict rules

- Physical specificity is **exact sellable/room > unit type > class > property**.
- Commercial and temporal dimensions add specificity only through a documented resolver; no
  object iteration order or database row order may decide a price.
- An explicit override beats an inherited value only inside its declared scope and dates.
- Two simultaneously applicable rules with equal effective specificity are a publish-blocking
  conflict unless the model defines a unique explicit priority. The UI warns before publish;
  the server independently refuses an unresolved draft.
- A lower floor or upper ceiling is a guard on the resolved amount, not another competing price.
- Restrictions (closed, CTA, CTD, minimum/maximum stay and advance), policies and availability
  remain separate evidence in the quote. Pricing cannot silently cancel a restriction or create
  physical availability.

## Hotel choices versus mandatory guardrails

Hotels may choose models, dimensions, scopes, codes, policies, adjustment bands, approval
thresholds, distribution targets and whether an authorized RMS recommendation can auto-publish.
They may create their own typed composition through the UI or AI intent layer.

Hotels may not disable or redefine:

- integer-minor-unit money, ISO currency and deterministic rounding;
- tenant/property authorization and RLS;
- immutable rate history, facts/outbox evidence and reproducible quote versions;
- occupancy truth, restriction truth or authorization boundaries;
- statutory taxes, fiscal document rules, accounting balance, audit retention or country-required
  checks. A jurisdiction adapter may supply mandatory rules that the rate builder displays but
  cannot weaken.

## Requirement-to-order matrix

| Order | Tier | Deliverable | Founder requirements covered | Pre-registered proof focus |
|---:|---:|---|---|---|
| 064 | 3 | Versioned rate-model draft and registered model catalogue | create/name/code, guided/expert foundation, static/derived/dynamic/contract selection | Published versions immutable; invalid/unknown model AST rejected; tenant isolation |
| 065 | 3 | Applicability and commercial targeting resolver | property/class/type/room; company/market group/market/source/channel/segment/agent/campaign; inheritance/exceptions | Every specificity permutation deterministic; equal-specificity conflict blocks publish |
| 066 | 3 | Typed pricing model evaluators | calendar, fixed, BAR +/- percent/amount, derived, room matrix, contract, occupancy, LOS, booking window, DOW, floors/ceilings, overrides | Exact bigint/currency, parent change history, N/2N bounded work, timezone boundaries |
| 067 | 3 | Policy, package and distribution composition | guest mix, promo, package, meal, refund/cancellation, CTA/CTD, min/max stay, distribution | Quote keeps price/policy/restriction evidence separate; package allowance exact; no availability bypass |
| 068 | 3 | Draft simulation, conflict review, approval, publish and versioned undo | review, warn before publish, bulk edit scope/dates/fields, preview cells/conflicts, approve/publish/undo | No partial bulk publish; stale approval rejected; undo creates a new version; history reproducible |
| 069 | 3 | Universal quote resolver and approved RMS/API adapter port | final resolution order, approved external recommendation, manual override | Same evidence returns same quote; source/model/version attributable; outage fallback bounded and explicit |
| 070 | 2 | Guided and expert workbench | simple-to-extreme UI, five-step builder, calendar/matrix/bulk review, theme parity | Both modes emit byte-equivalent commands; accessibility; no hidden auto-publish or browser authority |
| 071 | 3 | AI intent compiler and explanation boundary | hotel describes desired model; AI says what is possible, impossible or forbidden | Intent compiles only to registered draft schema; confirmation/authority enforced; adversarial prompt cannot bypass guardrails |

Order numbers are reserved by this plan but are not implementation permission. Write and commit
each exact order immediately before its work, after reading the then-current schema and decisions.

## Required preflight for every implementation order

1. Run the Natural-Solution Test against `rate_plan`, insert-only `rate_price`, `policy`,
   `restriction`, `party`/`party_role`, `extension`, `automation`, `fact_log` and outbox.
2. Search `DECISIONS.log` before selecting persistence or precedence.
3. Name every new event/state transition/schema change in the order. A migration or invariant
   question hits the D-92 hard floor and stops.
4. Start with an intentional red proof and preserve the exact failure output.
5. Re-run protected hashes and the fresh app-never-started referee before handoff.

## Phase exit evidence

- A base-plan change flows through a derived plan while a historical quote remains reproducible.
- The same draft authored in guided, expert and AI-assisted modes produces the same canonical
  command and preview.
- A room-specific rule beats type/class/property; an equal-specificity collision cannot publish.
- A bulk edit either publishes one complete immutable version or nothing.
- Currency/money, timezone, tenant/property, policy/restriction and jurisdiction guardrails remain
  exact under hostile inputs.
- RMS/API absence cannot erase the last valid governed price or silently remove a floor/ceiling.

