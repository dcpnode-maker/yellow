# RMS algorithm portfolio — Astra Ultra research

**Order441 · 2026-09-06 · unimplemented and unmeasured.** GPT-6 Astra with Ultra
reasoning owns this algorithm-research assignment. Public primary sources were
checked on this date, including recent 2025 methods and current OTA documentation.
Known methods, proposed combinations and eventual measurements are distinct: no
Yellow experiment, uplift, benchmark, novel-IP claim or ranking guarantee exists.

The recommended first experiment is a time-safe comparison of seasonal pickup
against cancellation-aware probabilistic pickup. It establishes whether Yellow can
predict pickup and attrition before attempting to optimize prices. Research serves
[Phase14](../../BUILD-PLAN.md#phase-14--adaptive-rms-and-revenue-intelligence);
[current development](../PROJECT-STATUS.md) remains Phase7 and the dependency-gated
priority remains 11 → 13 → 17.

## 1. Existing boundaries and future runtime

D-254/D-291 and [AI architecture](../AI-ARCHITECTURE.md#6-adaptive-rms-destination-retained-for-later-orders)
govern this proposal. The inspected
[recommendation seam](../../src/contexts/rates/recommendations.ts) binds adapter,
tenant, property, release, unit, night, currency and freshness. Missing/error/stale
adapters have explicit local-evaluator fallback; malformed, future or mismatched
evidence fails closed. It has **no channel, LOS, promotion or risk inputs**. Those
cannot be smuggled into an evidence reference; they need later scoped contracts.

[Publication](../../src/contexts/rates/publication.ts) requires exact approved
content/preview and fresh simulation; undo creates a new version. The
[economics calculator](../../src/contexts/rates/economics.ts) is exact arithmetic,
not a cost estimator or optimizer. Its integer occupied-night denominator and
single per-night minimum cannot silently represent fractional expected occupancy
or different nightly shadow prices. Cross-context use stays through `index.ts`.

Astra Ultra is a development researcher. Candidate runtime is small CPU-fitted
statistical models, bounded optimization and deterministic explanations; benchmark
fit time, peak memory, per-property refresh and p95 lookup before choosing it.
No hosted LLM is needed per quote. LLMs get no SQL, tenant selection, monetary
calculation, approval, spend or publication authority. PostgreSQL remains the
sellability authority; optimization consumes authorized inventory evidence and
never recreates availability or occupancy math.

## 2. Objective: explicit contribution, with displacement once

For one currency, define booked pre-tax room revenue `G`, hotel-funded discount
`D`, commission `K`, payment fees `F`, cancellation/no-show/refund loss `R`, other
variable distribution cost `V`, and incremental servicing cost `S`:

```text
NetRoomRevenue = G - D - K - F - R - V
RoomContribution C = NetRoomRevenue - S
DisplacementAdjustedValue = C - displacedContribution
```

This follows D-291. It is contribution profit under stated costs, not accounting
profit: rent, fixed payroll, depreciation and income tax are excluded. Keep signed
losses visible. Model each channel's actual commission basis, hotel versus
OTA-funded discounts, promotion stacking, refunds and fee retention. A discount
already netted from `G` must not also appear in `D`.

Use mutually exclusive stay/cancel/no-show scenarios to estimate `R`, retained
fees and servicing. Either start with gross booked revenue and subtract expected
loss once, or weight scenario receipts; never multiply by survival and subtract
the same lost revenue again. Simulate cancellation timing and resale so cancelled
inventory and its replacement booking are counted coherently. Correlated group
wash/event cancellations need shared scenarios, not independent Bernoulli draws.

Packages separate room allocation from incremental ancillary margin; included
breakfast is not additional room revenue. STR cleaning/turnover cost applies once
per actual turnover, plus occupied-night costs. Guest cleaning charges are revenue
on their documented basis, not a reduction in physical cleaning cost. Group
concessions, wash, credit exposure and displaced transient margin remain explicit
management evidence; acceptance stays with management.

Prices/costs remain bigint minor units; deterministic evaluation uses rational or
fixed-point probability weights with explicit rounding and bounds. Statistical
coefficients are not money. Expected-total and realized per-occupied-night metrics
are separately labelled; zero occupancy yields an undefined ratio, not zero ADR.
Compare contribution with the sum of nightly bid prices **or** subtract estimated
displacement. Applying both to the same opportunity cost double counts it.

The independent Order441 research review corrected the original report's B0/H1 target,
delayed-feedback attribution and propensity wording below. The original Order441
delivery hash remains historical evidence; these source-supported corrections do
not represent a new experiment or a measured result.

## 3. Known methods worth comparing

Let `N` be training cells/reservations, `p` features, `H` forecast dates, `A` allowed
actions and `M` scenarios. Complexity below is a design estimate, not measured
Yellow performance; all candidates require tenant-local, versioned data.

| Method | Concrete model and inputs | Cost, cold start and principal limitation |
|---|---|---|
| B0: seasonal/pace baseline | Current on-the-books room-nights plus the mean historical residual from that same-cutoff count to final actual occupied room-nights, at the same lead time, weekday and comparable season; intervals use those same matured residuals. The residual includes cancellations, no-shows and room/stay amendments. Also retain seasonal-naive and unchanged operator pricing baselines. | Aggregation `O(N)`, lookup `O(H)`. Fall back to coarse property-season cells; no comparable history means labelled operator baseline. Prior closures or changed policy bias pickup. |
| K1: count forecast plus survival | Negative-binomial GLM for new bookings by booking-time/arrival-date/LOS/channel; partially pool sparse coefficients within authorized property data. Separate discrete-time cancellation hazard by booking age, remaining lead and refund-policy version; map surviving bookings across their nights. | Gradient fitting approximately `O(iterations × N × p)`; hazards cost reservation-time cells. Coarse priors support cold start but uncertainty stays wide. Event shocks, group dependence and unrecorded cancellations break naive calibration. |
| K2: constrained price-response model | Monotone spline/logit on a bounded public offer-price grid; use displayed total stay price, policy, room/product attributes, choice set and exposure. Include outside/no-book choice and substitution among the property's offers. Optimize expected contribution. | Small models score about `O(Ap)` per context. No within-context price support means no elasticity-based recommendation. Monotonicity stabilizes estimates; it does not remove confounding or make observational elasticity causal. |
| K3: network inventory value | Forecast future stay requests, solve a contribution LP over room-type × night capacities, then compare whole-stay contribution with consumed resources' dual prices. Replan over scenarios; retain feasible integer solutions for scarce inventory. | LP size grows with resources and stays; scenario work scales with `M`. Integer variants can grow exponentially: cap solve time and report bounds/gap. Weak demand history requires conservative scenarios. Hotel pooling helps; a unique STR listing violates large-capacity intuition. |

B0 is deliberately competitive: [Weatherford and Kimes (2003)](https://www.sciencedirect.com/science/article/pii/S0169207002000110)
found simple pickup/smoothing methods robust on their hotel data. K1's probabilistic
pickup basis is supported by [Fiori and Foroni (2020; online 2019)](https://boa.unimib.it/handle/10281/237371);
the negative-binomial/survival combination here is a proposal, not their result.
[Romero-Morales and Wang (2010)](https://ora.ox.ac.uk/objects/uuid%3A614c3d16-4fff-414e-9052-c154da6dffc5)
support reservation-level cancellation modelling that changes across the booking
horizon; the accessible repository abstract was checked, not an inaccessible full
paper. [Talluri and van Ryzin (1998)](https://pubsonline.informs.org/doi/10.1287/mnsc.44.11.1577)
establish that bid-price controls are not generally optimal; large-capacity results
do not establish optimal STR decisions.

K2's choice-set treatment follows the principle of
[Talluri and van Ryzin (2004)](https://pubsonline.informs.org/doi/10.1287/mnsc.1030.0147),
whose single-leg airline model explicitly represents buy-up/buy-down. The proposed
hotel spline/logit and its causal identification need separate validation.

For K3, a transparent relaxation is:

```text
max sum_j expectedContribution_j * x_j
subject to sum_j nightsConsumed[r,j] * x_j <= inventoryEvidence[r]
           0 <= x_j <= forecastRequestCount[j]
lambda[r] = capacity dual; stay threshold = sum_r lambda[r] * nightsConsumed[r,j]
```

This values resources; it does not authorize accepting requests, create inventory
or validate a room assignment. Cancellations require time-indexed release scenarios;
expected retained occupancy alone cannot justify overselling. Overbooking is
excluded without its own governed policy and executable proof.

## 4. Identification and data readiness

Capture what was knowable at decision time: booking/change/cancellation observation
times, property-local stay dates, effective price/policy versions, inventory and
restriction snapshots, channel mappings, costs and actual published receipts.
Preserve observation time separately from later corrections. Record denied searches
and closure causes only through permitted, consented instrumentation.

Bookings are constrained sales, not latent demand. In a simple cell with a known
sales limit `b`, `Y=min(D,b)` gives likelihood `f(Y)` when uncensored and
`P(D>=b)` at the limit. This requires the censoring mechanism to be known. A
multi-night hotel with substitutions, reopening and cancellations needs the actual
choice/control history; a sold-out flag alone is insufficient. Compare likelihood
or EM unconstraining with an uncensored-only sensitivity baseline, and report
assumption dependence. [Queenan et al. (2007)](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1937-5956.2007.tb00292.x)
demonstrate why booking controls censor forecasting inputs; their study supplies
no universal correction factor.

Historical managers raise prices when they anticipate demand. Conditioning on
recorded season/events does not prove all that information is captured. K2 needs
approved randomized price variation or a defensible identification design with
overlap and explicit assumptions. Never infer elasticity from price/occupancy
correlation. Instrumental variables need an independently justified exclusion
restriction; weather/events are not automatic instruments because they affect demand.

For new properties, use operator floors/base prices and coarse own-property priors;
borrow other owned-property information only under a separately authorized data
contract. Independent competing hotels' confidential prices, future intentions and
occupancy must not be shared or used for coordinated pricing. Permitted public
comps may supply context, never a coordinated target. Before admitting competitor-
derived inputs, shared models or pricing feedback loops, obtain a review for the
actual launch jurisdiction and design; public availability alone is not clearance.
The US [FTC/DOJ hotel-pricing statement](https://www.ftc.gov/news-events/news/press-releases/2024/03/ftc-doj-file-statement-interest-hotel-room-algorithmic-price-fixing-case)
illustrates this concern, not a legal conclusion for India or another market.
External weather, airport and event features need archived as-of forecasts, licence and expiry; missing feeds
trigger the documented fallback, not invented signals.

## 5. Three proposed combinations to falsify

These are Yellow-specific research hypotheses assembled from known components,
not assertions of unique invention.

### H1: survival-weighted pickup with a readiness gate

For the first experiment, `newBookings` means future **accepted reservations before
cancellation**, grouped by booking-time/arrival-date/LOS; it never means checked-in
arrivals. Both B0 and H1 target the same mature label: final actual occupied
room-nights for stay date `d`, reconstructed from the property's governed stay
evidence after cancellation, no-show and room/stay amendments have matured. Freeze
the maturity rule and revision policy before fitting. A retained reservation is
not itself evidence of occupancy. B0's historical residual ends at this label.
The H1 decomposition must include actual occupancy after cancellation survival:

```text
ExpectedOccupiedNights[d] = sum_active_i E[actualOccupiedRooms_i[d] | history]
  + sum_new_cohorts_j E[newBookings_j * survivalFraction_j
                      * occupiedRoomsPerSurvivor_j[d] | history]
Compare K1 and B0 on matured outcomes; calibrate intervals by lead bucket.
If provenance, calibration or comparable-support checks fail: retain B0/abstain.
```

`occupiedRoomsPerSurvivor_j[d]` is the mean actual occupied-room contribution on
night `d` per non-cancelled reservation in that cohort, defined as zero when none
survive. It includes zero for no-shows and the effects of changed nights/room counts;
it is not a cohort total. Existing bookings need the same effects. Counts, survival
and conditional occupancy are jointly modelled; multiplying independent means is
not justified. Features remain as-of observations, never future realized labels.
If only cancellation labels can be reconstructed, this occupancy experiment is not
data-ready; use a separately named reserved-night target and re-register both models.
Capacity-inconsistent forecasts fail
readiness rather than acquiring occupancy authority. Separately, replacing accepted
bookings with unconstrained requests estimates latent retained demand, which can
exceed inventory. Never score that latent quantity against constrained occupancy
or silently cap it. Its validation needs unconstrained observations or explicit
censoring likelihood/sensitivity analysis; later feasible-sales scenarios require
the inventory owner's contract, without duplicating sellability calculations.

This separates cancellation from new demand and prevents weak pace evidence from
becoming a confident price recommendation. [Gibbs and Candès (2021)](https://proceedings.nips.cc/paper_files/paper/2021/hash/0d441de75945e5acbc865406fc9a2559-Abstract.html)
is a starting point for sequential interval adaptation with observed outcomes;
its guarantee is not established here for asynchronously maturing hotel labels.
The first experiment freezes calibration for each prediction window and scores only
mature outcomes. Any later online adaptation needs an explicitly justified delayed-
feedback method. Long-run marginal coverage is not conditional coverage for
tomorrow's event or a guarantee of narrow intervals. **Falsification:** ablate survival and pooling;
reject added complexity if untouched-window weighted interval score, bias and
calibration do not improve over B0, especially on high-cancellation dates.

### H2: whole-stay option value for STR gaps

Use only inventory-service-supplied feasible stay bundles. For bounded calendar
state `s`, candidate stay `j` and future-value approximation `V`:

```text
Advantage(j) = E[C(j) + V(nextState_accept) - V(nextState_decline)]
Score = Advantage - riskWeight * tailLoss - rateChangePenalty
```

`V` includes future contribution and turnover once, including continuation beyond
the planning horizon. It may use small-state dynamic programming or scenario
optimization; state growth is exponential, so expose truncation error and fallback.
One-night gaps matter only through realistic chance/cost of filling them; avoid a
fixed orphan-night discount. Preserve owner blocks, turnover buffers and min-stay
rules from their authorities. **Falsification:** compare against K3 nightly bid
prices and operator gap rules; vary booking-window/LOS/cancellation assumptions.
Reject if better gap occupancy fails to improve total realized contribution, or
displaces more valuable longer stays. Simulations test logic, not real uplift.

### H3: filter diagnostics plus controlled channel economics

For consistently defined query cohorts, decompose the booking funnel:

```text
ExpectedBookings = queryCount * P(exposure | query, offer)
                  * P(click | exposure) * P(book | click)
```

Diagnose truthful amenities/mapping, supported occupancy, total-price comparability,
availability and LOS compatibility before proposing rate/promotion changes. This
factorization is an accounting model for measurable cohorts, not an OTA formula.
[Booking.com's explanation](https://www.booking.com/content/how_we_work.en-gb.html)
(updated 31 May 2025) includes click-through, bookings, cancellations, content and
commercial factors. [Airbnb](https://www.airbnb.com/help/article/39) also describes
personalization and occasionally showing alternatives outside some filters: exact
filter matching neither guarantees nor exhaustively predicts exposure.
[Airbnb conversion tools](https://www.airbnb.com/help/article/2714) distinguish
impressions, clicks and bookings; access and export denominators require verification.

**Falsification:** where separately authorized, compare content repair, price change
and promotion with randomized controls; score all-channel net contribution after
costs and cancellations. More OTA bookings with equal total bookings may be direct
cannibalization. Missing impressions permits booking-level outcome analysis, not
claims about exposure, conversion or rank. Content changes must reflect reality;
no invented amenities, misleading offers or ranking guarantees.

## 6. Evaluation and first experiment

Freeze forecast targets, cohorts, baselines and rejection rules before fitting.
Rolling origins use only data observed by each cutoff; fit/tune/calibrate on earlier
blocks and retain untouched future stay-date blocks. Keep every version of the
same stay and overlapping booking horizons together where needed; mature labels
before scoring. Archive external forecast vintages, not realized weather/events.

Report pickup MAE/bias, probabilistic log/interval scores, 80%/95% coverage and width
by property/lead/channel/season, and cancellation Brier scores/reliability. Avoid
MAPE for zero-demand cells. Report property-level results and blocked uncertainty,
not only pooled averages. For decisions, measure total contribution per originally
eligible available room-night, realized contribution, cancellation/refund costs,
turnovers, price churn and worst-period losses. CVaR of loss measures average loss
in a specified worst tail; report its level, uncertainty and sample size. It is not
a loss guarantee.

Historical replays cannot reveal bookings under unpublished prices. Off-policy
[doubly robust evaluation](https://icml.cc/2011/papers/554_icmlpaper.pdf) combines
reward and behavior-policy models, with known or estimated action probabilities.
Reliability needs adequate action support, valid identification assumptions, mature
rewards and sufficiently accurate reward or propensity modelling. Yellow proposes
logging exact action probabilities as its own readiness rule; the cited method
does not universally require exact logged propensities. It does not cure hidden
confounding or unsupported actions. Report effective sample
size and clipping sensitivity. Inventory-changing policies also need sequential
evaluation; a one-step bandit estimator is insufficient.

[Conservative contextual bandits (ICLR2025)](https://proceedings.iclr.cc/paper_files/paper/2025/hash/dbca58f35bddc6e4003b2dd80e42f838-Abstract-Conference.html)
are a later candidate for bounded exploration, not the first runtime. Their
assumption-dependent baseline constraints do not guarantee hotel profit with
delayed cancellation, scarce inventory and changing demand.

First scoped experiment: one data-ready hotel's ordinary room type; B0 versus H1
at 1/7/14/30-day horizons, weekly rolling origins and a final untouched eight-week
window after labels mature. Proposed advancement criteria: at least 5% lower mean
weighted interval score, no worse absolute bias, and no material deterioration of
coverage or critical cohorts; pre-register uncertainty/sample-size rules and keep
B0 when improvement is inconclusive. These thresholds are experimental choices,
not results. Insufficient reconstructable history yields a readiness report and
prospective shadow collection. Pricing stays unchanged.

After offline acceptance, shadow recommendations record snapshot/model versions,
scope, objective/costs, prediction intervals, alternatives and abstention reason.
Only a later authorized controlled trial can establish contribution effects. Use
property/date blocks that account for shared inventory, cross-channel substitution
and LOS spillover; short switchbacks can retain carryover. An
[Airbnb pricing meta-experiment](https://business.columbia.edu/sites/default/files-efs/citation_file_upload/holtz-et-al-2024-reducing-interference-bias-in-online-marketplace-experiments-using-cluster-randomization-evidence-from%20%282%29.pdf)
demonstrates interference as a material experimental-design issue. Pre-register
power, minimum detectable contribution effect, maturation and stopping rules.

Guardrails require explicit property price/action bounds, verified channel
capability, fresh snapshots and ordinary approval/publication. Stop on stale data,
calibration drift, unsupported cost basis, excessive downside or sync failure;
return to the approved champion through a new version and reconcile channel
receipts. This research introduces no data collection, algorithm implementation,
dependency, database mutation, live experiment or price publication.
