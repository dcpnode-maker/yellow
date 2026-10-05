# Order 564 — commercial attribution and roll-up model

## Objective

Define and then implement Yellow's governed hotel-commercial hierarchy so every
reservation and revenue/room-night measure can drill down and roll up consistently
from hotel/chain scope through market segment group, market segment, source/channel,
company/booker, product and room dimensions.

## Required model

- Organisation scope: group/chain → brand/sub-brand → continent/region → country →
  state → city → property, reusing `org_node` and its existing hierarchy semantics.
- Demand scope: market segment group (MSG) → market segment (MS), intersected with
  independent source/channel and company/booker dimensions. Applicability rules may
  constrain intersections, but do not force unlike dimensions into one false tree.
- Product scope: property → existing version-local commercial room-class snapshot →
  room type/product. Bed configuration is an independent attribute; sellable rooms
  and their many-to-many physical spaces are a separate non-additive assignment
  relationship.
- Examples remain configurable rather than hard-coded: Corporate, OTA, Website,
  Travel Trade and Groups/MICE as MSGs; corporate accounts, social, defence,
  incentive, engagement and birthday groups as descendants where the client needs
  them.
- Every leaf contributes room nights and revenue. Roll-ups derive occupancy, ADR and
  RevPAR only at semantically valid inventory scopes; additive measures use sum,
  ratios are recomputed from their numerators/denominators rather than averaged.

## Architecture constraints

- Reuse reservation `market_code`, `source_code`, `origin_code`, `channel_code`,
  `booker_party`, existing Party/company profiles, `unit_type`, `stats_daily` and
  `org_node` before introducing any storage.
- Configurable taxonomy belongs in versioned extension/config rows unless executable
  query proof shows a hot typed relation is required. Do not encode client examples
  as a universal fixed enum.
- Preserve one canonical leaf attribution per reservation with explicit governed
  overrides and immutable audit evidence. A single booking may participate in
  several independent dimensions, but not multiple parents within the same
  hierarchy version.
- Map/reduce semantics: map each reservation/posting to canonical leaf dimensions;
  reduce additive room-night/revenue facts upward; recompute ADR, occupancy and
  RevPAR at every requested scope.

## Deliverables before implementation

1. Natural-Solution Test against existing primitives and exact current schema.
2. Cardinality and effective-dating rules for one-to-one, one-to-many and many-to-one
   relationships, including company parents and chain roll-ups.
3. API/filter/drill-down contract and mobile segmented-control interaction spec.
4. Query plan and correctness tests for hotel, brand, region, MSG, MS, source,
   company, room type and room class roll-ups.
5. Independent architecture review before any migration or public data mutation.

Architecture record: `handoff/drafts/564-commercial-attribution-and-rollup-model.md`.

## Exclusions

- No unreviewed migration, historical reclassification, OTA write, RMS pricing action
  or claim that averages can be safely aggregated.
