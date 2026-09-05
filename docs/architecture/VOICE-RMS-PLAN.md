# Voice and RMS plan (proposal)

> **Development documentation snapshot — 2026-09-05.** Source:
> [`61dbeea`](https://github.com/dcpnode-maker/yellow/commit/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e).
> This updates the original project documentation on main; main's executable code
> is still an older integrated baseline. Implemented contracts, setup behavior and
> proof described below refer to that development revision, not a claim that main
> or the local app already runs them. Planned capabilities remain planned.


**Order 433 · 2026-09-05 · design only**

This is a durable research and architecture proposal for Yellow staff voice and
revenue-intelligence surfaces. It does not implement a voice runtime, model, RMS,
provider integration, endpoint, schema, seed, UI, or benchmark. “Observed” means
present in this checkout; “proposed” means a future bounded order must design,
build, and prove it. Entry points are [the feature register](../FEATURE-REGISTER.md),
[staff journeys](../design/STAFF-JOURNEYS.md), [OTA connectivity](../integrations/OTA-CONNECTIVITY.md),
[current design](../DESIGN.md), [contracts](../CONTRACTS.md), and
[AI architecture](../AI-ARCHITECTURE.md).

## Decision in one paragraph

Keep Yellow's modular monolith and PostgreSQL authority. Add one replaceable,
local-first speech adapter and one typed intent/query pipeline; do not let a model
write SQL, select a tenant, bypass RLS, or mutate a domain table. Read questions
resolve through an allow-listed query catalogue and return source, scope, freshness,
and period. Actions are proposals until the authenticated server maps them to an
existing domain command and the operator's role, property grant, confirmation,
approval, idempotency, audit, and transaction rules pass. Build RMS analytics over
Yellow's own data first; treat licensed comps, weather, airport, and event feeds as
timestamped, fallible signals. PriceLabs is an STR revenue-workflow benchmark, not
a PMS replacement or an authority for Yellow inventory.

## 1. What exists and what does not

Observed in this checkout:

- docs/AI-ARCHITECTURE.md specifies provider-neutral, local-first AI, minimized
  context, structured validation, recommendation/execute separation, and a future
  adaptive RMS destination.
- The operator API has a typed, proposal-only rate-intent route and check-in
  readiness/commit routes. docs/CONTRACTS.md defines their scopes and server-owned
  checks.
- PostgreSQL remains sellability authority; occupancy, money, fiscal records,
  journals, outbox evidence, tenancy, and state transitions retain their choke
  points.

Not observed and therefore not claimed: a speech endpoint, microphone UI, streaming
ASR, TTS, generic tool gateway, authorized query catalogue, print command, RMS
forecast service, PriceLabs connector, live market/event/flight feed, or measured
voice/RMS latency. A future print flow may prepare a bounded folio or
registration-card artifact through document and authorization boundaries; this plan
does not claim that print authority exists.

## 2. Staff voice: one safe pipeline

~~~text
consented microphone or typed text
  -> bounded VAD/ASR adapter (voice only)
  -> normalized text + locale + confidence + transcript evidence
  -> strict typed intent/query JSON (constrained generation, then validation)
  -> server-selected query or existing domain command
  -> authenticated tenant/property/role and ordinary service authorization
  -> PostgreSQL/RLS evidence or command result + audit/fact/outbox as applicable
  -> cited, freshness-labelled answer and optional TTS
~~~

The model is an interpreter, not an authority. It receives no credentials,
arbitrary SQL, unbounded database rows, approval power, or authority to choose
tenant/scope. It may propose a property selector from the user's words; the server
resolves it only within the authenticated actor's allowed properties. Query names,
parameters, result limits, and data
classification are server-owned. Unsupported requests return a bounded “not
available” answer. A missing or ambiguous room, guest, reservation, date,
property, currency, or action target causes clarification; the model must not
guess from memory. A command is revalidated against fresh server state immediately
before execution, and voice can never do more than the equivalent typed/manual
action.

### Example staff interactions (proposed)

| Spoken request (illustrative) | Typed intent after parsing | Required gate and result |
|---|---|---|
| “आज आने वाले मेहमानों में कौन-से कमरे अभी साफ़ नहीं हैं?” / “Which arriving rooms are not clean yet?” | read_due_arrivals({property,stayDate,condition:[dirty,pickup]}) | Read grant, exact property and property-local date; return reservation/room evidence and freshness. |
| “اعرض وصولات اليوم التي لم تُجهّز” / “Show today's arrivals that are not ready.” | read_checkin_readiness({property,stayDate}) | Read-only readiness query; distinguish dirty, clean, inspected, and statutory blockers; ask which property if needed. |
| “Check in Ms Rao to room 204.” | prepare_checkin({property,reservationCandidate,spaceCandidate}) then commit_checkin(...) | Resolve duplicates; require exact grant, identity/statutory prerequisites, current readiness, idempotency, and the existing check-in service. |
| “Print Mr Khan's folio for checkout.” | prepare_folio_artifact({property,folioCandidate,format:print}) | Resolve exact folio and role; show a preview and current balance. Printing must not imply settlement, invoice issue, or fiscal finality; an implemented command needs its own contract. |
| “Set room 204 to ₹8,000 tomorrow.” | propose_rate_change({property,roomOrRatePlan,date,amount,currency}) | Voice does not bypass rate approval. After the required preview/approval, an authorized voice instruction may invoke the same publication command. Reuse rate rules, minor-unit money, approval, preview, and publish/sync controls; reject unsupported channel capability. |

The Hindi and Arabic lines are language-coverage examples, not accuracy claims.
Production acceptance must include hotel names, room numbers, guest-name
transliteration, code-switching, noise, accents, dates, currencies, and homophones
from consented or synthetic fixtures. Raw-audio retention, deletion, consent,
staff notice, and regional residency need explicit policy; “local” is a deployment
property, not an anonymity guarantee.

### Candidate runtimes and separate artifact review

The code/runtime licence never licenses a downloaded model, voice, tokenizer,
training data, or provider service. Before distribution, record exact version,
checksum, source, model or voice card, attribution, commercial-use terms, and
whether redistribution is permitted.

| Capability | Candidate evidence | Runtime/code licence evidence | Model/voice caveat |
|---|---|---|---|
| ASR | [whisper.cpp](https://github.com/ggml-org/whisper.cpp), [OpenAI Whisper](https://github.com/openai/whisper), [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx), or [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | Whisper and whisper.cpp publish MIT code; sherpa-onnx publishes Apache-2.0; faster-whisper publishes MIT. | Whisper model cards and converted CTranslate2/ONNX files are separate artifacts. Verify the exact model card; the [openai/whisper-base card](https://huggingface.co/openai/whisper-base) currently states Apache-2.0. Do not infer a model licence from the engine. |
| TTS | sherpa-onnx TTS is a replaceable candidate; historic [rhasspy/piper](https://github.com/rhasspy/piper) is archived and points to [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl). | sherpa-onnx runtime is Apache-2.0; historic Piper code is MIT; maintained piper1-gpl is GPL-3.0. | Piper voice documentation says to inspect each voice model card and warns some voices are restrictive. No Piper voice is approved by this plan. |
| Local LLM/parser | [llama.cpp function calling](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md) and [JSON/GBNF grammars](https://github.com/ggml-org/llama.cpp/tree/master/grammars) | llama.cpp code is MIT. | GGUF weights, chat templates, tokenizer files, and quantization are separately licensed and evaluated. Tool support varies by model/template; the official docs note generic handlers may be less efficient and extreme KV quantization can degrade tool calls. |

The first implementation should expose adapter ports and a typed fallback, not
hard-code one vendor. A small local model may be faster but less accurate; a
larger model may improve coverage while increasing memory, tail latency, and
cost. That trade-off is an experiment, not a claim that any candidate is fastest
or safest.

### Progressive, low-cost proof plan (proposed; no measurements yet)

1. **Text baseline:** replay a reviewed synthetic intent set through the typed
   validator and deterministic query/command registry. Measure exact intent match,
   slot/entity accuracy, clarification rate, unsafe-request rejection, and
   authorization invariants.
2. **Offline ASR:** on the same device classes, use consented or synthetic clips in
   each launch language. Measure WER/CER, room/guest/date accuracy, real-time
   factor, p50/p95 decode latency, peak RSS, CPU, and energy. Model downloads are
   outside this order.
3. **Streaming ASR plus parser:** measure end-of-utterance-to-validated-intent
   p50/p95 and confidence thresholds. Compare local CPU, optional accelerator,
   and an opt-in provider fallback with identical clips/options. Publish hardware,
   model checksum, quantization, threads, audio format, beam/VAD settings, and
   dataset split; do not copy README benchmark numbers.
4. **TTS:** measure time-to-first-audio, completion latency, intelligibility,
   locale coverage, interruption/barge-in behaviour, and memory. Keep spoken
   output optional and provide typed answers for hearing, privacy, and noise.
5. **Operational replay:** inject stale state, duplicate entities, missing
   permissions, expired holds, changed readiness, provider timeout, malformed model
   output, and database conflicts. Every case must fail closed or ask a bounded
   question, with no unauthorized write.

Engineering budgets should be set per supported hardware and recorded with
results, using separate p50 and p95 targets rather than marketing latency. A
green score on one language, model, or device does not generalize. The deterministic
path remains usable when audio, model, network, or TTS is unavailable.

Domain adaptation is a later measured option: hotel vocabulary, transliteration,
reviewed multilingual intent examples and safe terminology can improve recognition
or routing. Live guest, availability and financial facts remain retrieved through
authorized services, not memorized in model weights. Any fine-tuning needs an explicit
data-rights/consent and de-identification plan, held-out evaluation, tenant-isolation
assessment, exact model licence and a demonstrated cost/accuracy benefit over the
untrained baseline. This order neither trains a model nor uploads hotel data.

## 3. RMS: evidence before optimization

Yellow should own the canonical operational and financial evidence used to explain
a recommendation. A future RMS snapshot is property-local and versioned by
observation time, stay date, booking date, currency, room type/rate plan, channel,
segment, and source.

### Own-property data

Start with OTB/availability, booking pace and pickup, occupancy, ADR, RevPAR, LOS
and booking window, cancellations/no-shows, restrictions, and remaining inventory.
Join room revenue to variable distribution/payment/campaign costs and incremental
servicing cost to show:

- gross booked room revenue;
- net room revenue after named variable distribution deductions;
- contribution after incremental servicing cost;
- displacement-adjusted value where a counterfactual is explicit; and
- turnover/ancillary indicators only with a declared denominator and source.

“Profit” must be labelled as a defined contribution or profit measure with included
costs; fixed payroll, rent, depreciation, tax, and accounting profit must not be
silently conflated. Money remains bigint minor units with an explicit currency.
Recommendations explain inputs, model/version, guardrails, confidence range,
alternatives, and observed outcome later.

Revenue and distribution should also close the visibility loop (YF-024): correct
amenities, occupancy/room mappings, available dates, total-price comparability and
channel-supported offer content affect whether an offer is a useful match for a
guest's filters. Show permitted content/parity/restriction diagnostics alongside rate
advice. Promotions require the existing commercial/spending authority and supported
channel operations. Search exposure, impressions and rank may be evaluated only from
permitted comparable observations; do not promise OTA ranking or treat rank as profit.

### Pricing workspace and publication

The STR workspace should be distinct from the hotel workspace while sharing
governed domain contracts. Proposed interaction requirements are:

- pricing calendar by listing/room type/rate plan and stay date;
- base, minimum, maximum, date override, lead-time, gap-night, last-minute, and
  minimum-stay controls, each showing source and effective period;
- multi-listing review with grouping, parent/child relationships, bulk preview,
  and explicit per-listing exceptions;
- demand/pace/comp/event explanations beside each recommendation;
- draft → preview → operator approve (or policy-authorized publish) → channel sync;
- sync receipt with channel, capability/version, request id, timestamp, result,
  rejected fields, retry state, and reconciliation status; and
- rollback/new-version path for prices and restrictions rather than mutating history.

[PriceLabs' getting-started guide](https://help.pricelabs.co/portal/en/kb/articles/getting-started-with-pricelabs-a-comprehensive-guide)
describes Dynamic Pricing, Market Dashboards, Portfolio Analytics, a pricing
calendar, base/min prices, dynamic minimum stays, and an explicit Sync Prices step.
Its [Multicalendar guide](https://help.pricelabs.co/portal/en/kb/articles/multicalendar)
documents bulk save/refresh, sync, overrides, grouping, performance metrics,
events/holidays, and listing calendar views. Its [Portfolio Analytics guide](https://help.pricelabs.co/portal/en/kb/articles/what-is-portfolio-analytics-and-how-to-use-it-2-1-2024)
documents KPI/history, LOS and booking-window trends, report builders, and pacing
against prior year or market; the [pacing guide](https://help.pricelabs.co/portal/en/kb/articles/portfolio-analytics-14-12-2023)
describes forward rates, occupancy, ADR, RevPAR, and benchmark overlays.

These are observed product-documentation facts about a revenue/pricing platform,
not a claim that Yellow has these features or that PriceLabs exposes every
hotel/PMS workflow. PriceLabs is not a PMS: Yellow still owns reservations,
guests, rooms, occupancy, folios, housekeeping, payments, finance, statutory work,
and PostgreSQL sellability. A future adapter must negotiate per-channel capabilities
and preserve approval, outbox, retry, reconciliation, and authority boundaries;
it must never blindly copy an external recommendation into a booking or ledger.

### Models and backtesting

Candidate research tools include [StatsForecast](https://github.com/Nixtla/statsforecast),
which publishes Apache-2.0 code and statistical/econometric baselines,
[MLForecast](https://github.com/Nixtla/mlforecast), which publishes Apache-2.0
code for scalable feature-based forecasting, and [OR-Tools](https://developers.google.com/optimization/introduction/get_started),
whose Google documentation supports C++, Python, Java, and .NET and identifies
Apache-2.0 code samples. They are candidate libraries, not a forecast or an
accuracy guarantee. Dependencies, optional solvers, datasets, and model artifacts
need their own licence review.

For each property and segment, a later order should run rolling-origin,
time-ordered backtests:

~~~text
train <= observation cutoff < validation horizon <= test horizon
~~~

No future bookings, cancellations, final occupancy, weather revisions, event
outcomes, market prices, or post-stay revenue may leak into features at the
prediction cutoff. Keep untouched future windows, compare seasonal-naive and
simple statistical baselines, report calibration and prediction intervals, and
retain model/data/code versions. Evaluate forecast error, pickup bias, cancellation
sensitivity, net contribution, downside risk, stability, explanation quality, and
channel feasibility. A proxy can improve a forecast while failing to predict
demand; no signal guarantees occupancy, revenue, or profit.

## 4. External signals: useful, licensed, and explicitly uncertain

Signals are features with provenance, source time, retrieval time, freshness/expiry,
geography, coverage, transformation, licence, and fallback state. They cannot
silently become booking or pricing authority.

- **Weather:** [Open-Meteo's API and repository](https://github.com/open-meteo/open-meteo)
  document forecasts, historical data, open-source code, CC BY 4.0 data, and a
  free non-commercial API; the same source says commercial use requires contacting
  them and fair-use limits apply. [NOAA Aviation Weather's API](https://aviationweather.gov/data/api/)
  documents aviation observations/forecasts such as METAR. Forecast uncertainty,
  model revisions, station distance, and regional coverage must be retained;
  weather is not a demand label.
- **Airport/flight proxies:** [OpenSky's terms](https://opensky-network.org/about/terms-of-use)
  require a written licence for commercial or operational REST use, including a
  live product. No OpenSky production dependency is approved by this plan.
  Arrival counts, delays, and airport distance are proxies with missing,
  cancelled, or diverted flights and coverage limitations; use only under an
  authorized licence or permitted public feed.
- **Events:** the [Ticketmaster Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)
  documents event/venue search, API-key access, default quotas, and country
  coverage. Terms, branding, affiliate restrictions, freshness, and country
  coverage must be checked before use; its quota is not a guarantee of commercial
  access. Local calendars require their own permission and provenance.

For every external signal, show “source unavailable/stale” rather than impute a
confident event, flight, or weather effect. A recommendation may cite a signal as
context, never as proof of causality. Compset collection follows the separate
OTA/connectivity policy: only permitted, authorized sources and own-extranet
workflows, bounded collection, provenance, freshness, and approval. No unrestricted
scraping, access-control evasion, or anonymity promise.

## 5. Delivery map and durable guardrails

Proposed ownership is deliberately staged:

| Slice | Future owner | Proof before expanding |
|---|---|---|
| Voice adapter ports, transcript evidence, typed intent/query catalogue | Phase 13 | Multilingual accuracy/latency/memory/licence matrix; authorization and fail-closed replay. |
| Hotel and STR pricing workspaces, preview/approve/sync receipts | Phase 13/14 with distribution contracts | UI/API contracts, capability negotiation, idempotent outbox/retry/reconciliation proof. |
| Own-data metric/data-readiness contract | Phase 14/16 | Exact currency/denominator/cost definitions, tenant/property isolation, freshness and lineage. |
| Forecasts, rolling backtests, explanations, champion/challenger | Phase 14/16 | Leakage tests, baseline comparison, untouched time windows, calibration and outcome monitoring. |
| Weather/airport/event/compset adapters | Phase 14/17 and distribution owners | Source terms, licence/access record, expiry/fallback, geographic coverage, and no-causality wording. |

The current checkout does not implement these proposed slices. Future work must
preserve existing invariants: PostgreSQL is sellability authority; RLS and verified
identity enforce tenancy; money is exact minor units; insert-only financial and
evidence tables stay immutable; state-changing commands use existing domain services
and same-transaction fact/outbox evidence; and no model response can override a
role, approval, fiscal, payment, occupancy, or state-machine boundary. Any schema,
endpoint, dependency, provider, or production-data change needs its own bounded
order and executable proof.
