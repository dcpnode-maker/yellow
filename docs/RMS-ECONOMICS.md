# Yellow RMS economics contract

Order 091 gives Yellow one executable vocabulary for room-revenue economics. It is arithmetic over
already-supplied evidence, not an estimator, accounting subledger, tax engine, rate recommendation or
distribution command.

## Fixed basis

Every snapshot is version 1 and declares:

- one uppercase three-letter currency;
- exact signed-range bigint minor units internally and canonical decimal strings in transport
  evidence;
- `occupied_room_nights` as the denominator;
- `room_revenue_excluding_taxes` as the tax basis;
- gross booked room revenue before the named distribution deductions; and
- `fixedHotelCostsIncluded: false`.

“Per occupied room night” is an exact rational value, not a JavaScript floating-point average. The
snapshot retains numerator, positive integer denominator, truncating quotient and exact remainder.
Consumers can prove `quotient × denominator + remainder = numerator` and choose presentation
rounding later without changing the economic result.

## Named inclusions

All input components are non-negative exact minor units. Results remain signed so unprofitable
business cannot disappear.

```text
distribution cost
  = hotel-funded campaign discount
  + OTA/channel commission
  + transaction/payment fees
  + expected cancellation/no-show/refund cost
  + other variable distribution costs

net room revenue
  = gross booked room revenue - distribution cost

contribution
  = net room revenue - incremental servicing cost

displacement-adjusted value
  = contribution - displaced contribution opportunity cost
```

The expected cancellation/no-show/refund cost must already be probability-weighted by a later
versioned estimator. This contract never invents the probability. “Other variable distribution
costs” is deliberately not a generic hotel-cost bucket: it covers attributable variable channel
distribution cost only. Fixed payroll, rent, depreciation, general overhead and other fixed hotel
costs do not enter net room revenue.

Taxes are excluded from this room-economics basis. A later channel-economics order must calculate the
actual commission/fee amounts from the correct contractual tax basis before supplying them. Order
091 does not calculate tax, recognized revenue, profit, a journal or a statutory figure.

## Bid-price comparison

The optional minimum acceptable contribution per occupied room night is supplied by a later
versioned bid-price model. Order 091 multiplies it by occupied room nights and compares contribution
to that total with exact bigint arithmetic:

```text
required contribution = minimum contribution per room night × occupied room nights
surplus or shortfall   = contribution - required contribution
meets minimum          = surplus or shortfall >= 0
```

The comparison uses contribution rather than displacement-adjusted value because a bid price is the
shadow price/opportunity-cost threshold. A caller must not encode the same opportunity cost in both
the supplied bid price and `displacedContributionMinor`; that would double count it. Displacement is
retained separately for group/portfolio reporting and counterfactual analysis.

## What later orders must supply

This contract does not claim that any component is currently available or accurate. Later orders
must separately govern:

- canonical source/data-readiness evidence and property-local observation windows;
- versioned channel/OTA capability and campaign-economics inputs;
- commission, payment, cancellation and servicing-cost estimation;
- causal campaign incrementality and cannibalization measurement;
- demand, remaining-inventory and dynamic bid-price estimation;
- model/backtest champion/challenger evaluation and confidence;
- group/ancillary/resource-displacement analysis;
- explanation, human approval and automation guardrails; and
- distribution preflight, outbox publication, reconciliation and outcome monitoring.

Those future layers may supply exact inputs and cite this versioned evidence. They may not redefine
the component arithmetic, use floating-point money, invent unsupported channel capability, treat a
model proposal as authority or bypass PostgreSQL sellability, approval, audit, fiscal or tenant
boundaries.

## Roadmap placement and conflict

This contract is the first safe boundary from the adaptive RMS roadmap retained in
`docs/AI-ARCHITECTURE.md`. The remaining sequence is deliberately not hidden inside Order 091:
canonical data readiness; model contract and backtesting; versioned OTA capability and campaign
economics; net-contribution and bid-price optimization; explanation and approval UX; guarded
distribution preflight/publication; causal campaign measurement; group displacement and
profitability; and champion/challenger monitoring each require their own order and proof.

That destination crosses the current Phase-4 reservation plan and later Phase-5 financial,
Phase-9 distribution and Phase-11 group boundaries. It therefore cannot silently acquire schema,
event, state-transition, RLS, pricing-history, channel-publication, accounting or group-acceptance
authority here. Online automation remains subject to future per-action guardrails and proven channel
capability. Offline negotiated/group business remains management-decided unless a future explicit
policy and order changes that governance.
