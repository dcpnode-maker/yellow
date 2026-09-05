# Yellow AI architecture

> **Development documentation snapshot — 2026-09-05.** Source:
> [`61dbeea`](https://github.com/dcpnode-maker/yellow/commit/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e).
> This updates the original project documentation on main; main's executable code
> is still an older integrated baseline. Implemented contracts, setup behavior and
> proof described below refer to that development revision, not a claim that main
> or the local app already runs them. Planned capabilities remain planned.


**Status:** provider foundation implemented by Order 090; agent platform, property knowledge,
training and adaptive revenue intelligence remain planned or research-required.  
**Precedence:** `PROJECT.md` → `DECISIONS.log` → executable domain contracts → this document.
**Model neutrality:** no model, provider or AI vendor owns a capability; implementation
ownership follows an approved order and its independent proof. See the proposed
[voice and RMS plan](architecture/VOICE-RMS-PLAN.md) for the bounded future workflow.

## 1. Principle

Yellow AI is an interpretation and intelligence layer over deterministic hospitality capabilities.
It is not a privileged database client and it is not a second application.

```text
human / voice / automation intent
              |
       minimized context
              |
  untrusted model proposal source
              |
 strict structured-output validation
              |
 typed Yellow command draft
              |
 human/policy approval when required
              |
 ordinary authorized domain command
              |
 PostgreSQL truth + fact + outbox
```

Inventory, reservations, money, tax, fiscal records, permissions and state transitions remain
deterministic. A model may explain or propose; it never makes hallucination authoritative.

## 2. What exists now

Order 072 provides one narrow rate-intent assistant:

- the default adapter is local, deterministic and makes no network request;
- the adapter receives a normalized intent, the current typed rate choices and a small model
  catalogue—never tenant, actor, bearer token, approval, publication or database authority;
- guardrail-bypass, secret, payment-card and executable requests are rejected before an adapter;
- adapter output must use one exact bounded JSON shape and must compile through the same complete
  rate authoring compiler used by Guided and Expert modes;
- Interpret, Apply, Save immutable draft, server Preview, independent Approval and Publish are
  separate actions; interpretation writes nothing.

Order 090 adds deployment-level runtime selection:

| Mode | Network | Intended use | Authority |
|---|---|---|---|
| `local` (default) | none | zero-cost exact common rate instructions and safe routing questions | proposal only |
| `openai-compatible` | one configured endpoint | compatible Azure/cloud deployment or on-prem inference gateway | proposal only |

The external adapter uses built-in `fetch`; Yellow adds no provider SDK. The deployment supplies an
exact endpoint and model/deployment id, so a compatible fine-tuned deployment can later replace a
base model without changing domain code. Compatibility describes the transport protocol, not
quality, privacy, price, licensing or compliance.

### Deployment configuration

| Variable | Meaning |
|---|---|
| `YELLOW_RATE_INTENT_PROVIDER` | omitted/`local`, or `openai-compatible` |
| `YELLOW_RATE_INTENT_ENDPOINT` | complete compatible chat-completions URL; HTTPS except exact loopback HTTP |
| `YELLOW_RATE_INTENT_MODEL` | bounded provider model/deployment id |
| `YELLOW_RATE_INTENT_AUTH` | explicit `bearer`, `api-key` or `none` |
| `YELLOW_RATE_INTENT_API_KEY` | required only for `bearer`/`api-key`; injected at deployment |
| `YELLOW_RATE_INTENT_DEPLOYMENT_KEY` | safe non-secret label shown in the provider badge |
| `YELLOW_RATE_INTENT_TIMEOUT_MS` | 500–30000; default 8000 |

Invalid selected external configuration fails startup. Omitted configuration remains local and
zero-network. Provider selection is not accepted from a browser, hotel command or model response.

## 3. Security, privacy and failure contract

The external provider is a separate trust zone.

- Only the minimized proposal input crosses the boundary. Guest/person data, raw database rows,
  credentials, tenant/actor ids, approvals, tokens and publication results are ineligible.
- The request uses one fixed system instruction, no tools, no URLs/files, no memory and no
  autonomous actions.
- Endpoint/auth/model come only from deployment configuration. Credentials never enter prompts,
  logs, browser responses or repository files.
- Non-2xx, wrong media type, timeout, redirect, oversized response, invalid envelope, invalid JSON
  and invalid proposal all fail closed to the existing manual/guided path.
- Core property operation does not depend on an AI provider. The deterministic UI and domain
  commands remain available during provider outage, quota exhaustion or model failure.
- A configured endpoint is not automatically private, free, secure, resident in the right region
  or suitable for personal data. Those are deployment/provider contracts requiring verification.

Before broader AI context is enabled, each field needs purpose, classification, legal basis or
policy, residency, retention, model eligibility and access logging. Cross-property learning is
opt-in only and must use a separately approved, minimized dataset.

## 4. Inference, retrieval, feedback and training are different

| Capability | Meaning | Yellow status |
|---|---|---|
| Inference | send a bounded task to a model and validate the answer | implemented only for rate-intent proposals |
| Retrieval | select authorized property knowledge/evidence and cite sources | planned; no vector database assumed |
| Feedback/evaluation | compare recommendation, operator decision and measured outcome | planned; needs explicit evidence and retention contracts |
| Fine-tuning/training | create or adapt model weights from governed datasets | research-required; no client data pipeline exists |
| Agent execution | use authorized Yellow queries/commands under autonomy policy | planned; no general tool gateway exists |

Property SOPs, policies, rate explanations and support knowledge should normally begin with
authorized retrieval and evaluation, not training. Training is justified only after a measured
quality gap, data-rights review, tenant isolation design, deletion/retention behavior, poisoning
controls and independent evaluation. Raw production databases are never a training source.

## 5. Future model routing and agent control

The future router may choose a provider/model by task, quality, latency, cost, privacy, region and
availability. It must preserve:

- task-specific structured contracts and validators;
- tenant/property context minimization and source attribution;
- model/provider/version and evaluation version;
- latency, token/compute cost and failure telemetry without prompt/PII leakage;
- sponsoring human/service identity, permissions, autonomy level and budget;
- recommendation evidence, confidence, expected outcome and later actual outcome;
- approval, revalidation, idempotency and ordinary domain-command execution;
- graceful fallback to deterministic/manual operation.

Autonomy levels remain tenant-configured: Observe, Recommend, Prepare, Execute within policy and
Autonomous domain. A level never overrides scopes, separation of duties, approval thresholds,
occupancy, money, tax, fiscal or state-machine safeguards.

## 6. Adaptive RMS destination retained for later orders

The founder's intended RMS is an adaptive, explainable revenue-intelligence layer. It is not the
Order-070 governed recommendation port by itself. The destination needs historical/recent PMS
evidence at portfolio, property, class, room type, rate code, channel, source, market group,
segment, booking window, LOS and stay-date levels, plus licensed/permitted market evidence,
compsets, events, product/amenity/reputation/policy differences, channel costs and OTA capabilities.

It should profile data readiness, build weighted compsets, identify mapping/parity/product gaps,
select or ensemble versioned models, backtest them, explain model choice and support governed custom
composition. Champion/challenger selection should consider contribution uplift, forecast accuracy,
stability, downside risk, explainability and channel feasibility—not only gross ADR.

### Exact value language

Avoid bare “ARR” where inclusions or denominator are unclear. Every metric defines currency,
stay/booking basis, room-night denominator and included costs using bigint minor units.

- **Gross booked ARR/ADR:** room revenue before channel deductions.
- **Net ARR/ADR:** expected room contribution after hotel-funded campaign discount, OTA commission,
  transaction/payment fees, expected cancellation/no-show/refund cost and other variable
  distribution costs. Fixed hotel costs are not subtracted here.
- **Contribution ARR:** net room revenue less available incremental servicing cost.
- **Displacement-adjusted value:** expected contribution after opportunity cost of displaced demand.

### Channel and campaign economics

Strategy must operate independently by OTA/channel/campaign/rate plan, not only at hotel level.
Each programme is an economic instrument with eligibility, visibility benefit, discount funding,
commission, payment/collection cost, cancellation/no-show/refund behavior, promotion stacking, tax
effect, parity implications, incremental-demand estimate and technical channel constraints.

For each stay date × room type × rate plan × channel/programme candidate, a later RMS should estimate:

1. demand without the programme;
2. incremental visibility and conversion attributable to it;
3. gross selling rate and guest discount;
4. expected net/contribution ARR after variable channel costs;
5. cancellation-adjusted realized value;
6. sale probability and remaining demand;
7. inventory opportunity cost;
8. whether the candidate breaches the current minimum acceptable ARR/bid price;
9. enable/restrict/cap/fence/close/replace recommendation; and
10. whether the channel can represent the proposed rate and restriction.

The minimum acceptable ARR/bid price is a dynamic shadow price for one remaining inventory unit. It
varies by stay date, room type/class, horizon, remaining inventory, uncertainty, segment/channel,
LOS, displacement risk and hotel guardrails. A later distribution adapter may use only channel
capabilities it can prove—stop-sell, allocation, rate, CTA/CTD, MLOS, advance purchase, campaign
participation, promotion cap or channel availability. It must never invent an OTA feature. A
versioned capability registry and pre-publish validator must explain incompatibilities and safe
alternatives.

Observed post-campaign bookings are not automatically causal. Evaluation should use holdouts where
feasible, matched periods or causal-uplift methods with confidence ranges, and distinguish genuinely
incremental demand from direct/other-channel cannibalization. The objective is portfolio-wide
distribution contribution, not one OTA's gross production.

### Online versus negotiated/group governance

- **Online:** Yellow may later recommend or, within explicit per-property/date/room/rate/channel/
  campaign/action approval and automation limits, publish channel decisions.
- **Offline negotiated/group:** management remains the decision-maker. Yellow supplies analysis,
  floor, alternatives and quantified risk. It does not auto-accept without a future explicit policy.

Group analysis must cover room-night pattern and peak pressure, rooms and ancillary revenue, all
variable/incremental costs and concessions, wash/attrition/cancellation/deposit/credit risk,
alternative dates/mix, displaced transient/group contribution, shoulder-night value and management
targets. Outputs should include gross revenue, variable cost, contribution, contribution per room
and constrained resource, requested/recommended/minimum rate, displaced revenue/contribution, net
value after displacement, break-even, confidence range, profit/loss/strategic-exception class,
accept/reject/counter recommendation and alternatives that make the group acceptable. A strategic
loss remains visible and requires explicit management approval.

Every later recommendation records model/version, input snapshot, objective, current/proposed
values, upside/downside, confidence, channel compatibility, guardrails, approval/override and
outcome. PostgreSQL remains sellability authority; price history stays insert-only/bitemporal;
distribution uses outbox/push cursors; property-local dates, tenancy and consent remain mandatory.

## 7. Historical Phase-4 conflict; current RMS ownership is Phase 14

The earlier heading, "Conflict with the current phase plan", described the Phase-4
planning checkpoint, not an unresolved conflict in today's 18-phase roadmap.
Earlier planning drafts placed some RMS prerequisites beside Phase 4. That placement is
historical and superseded: Phase 4 owns reservation correctness—search, hold, commit,
lifecycle, segments, guests and its review workbench—while the adaptive RMS is owned by
Phase 14, with supporting work in the phases recorded by the feature register. The RMS
prerequisites below remain outside Phase 4:

- canonical revenue metric/data contracts and data-readiness evidence;
- versioned model/backtest/evaluation contracts;
- channel/OTA capability and campaign-economics registry;
- distribution connection, reconciliation and safe pre-publish execution;
- contribution/bid-price optimizer and causal campaign measurement;
- group, ancillary, finance and displacement evidence;
- recommendation outcome storage, monitoring and approval/autonomy policy.

Implementing those now would silently widen Phase 4, duplicate Phase-3 pricing rules, invent Phase-9
channel authority and pre-empt Phase-5/11 finance/group contracts. Therefore this document retains
them as **planned/research-required**. Likely future order boundaries are: metrics/data readiness;
model/backtester; channel capability/campaign economics; net-ARR/bid-price optimizer; explanation
and approval UX; distribution preflight/publish; causal measurement; group displacement workbench;
and champion/challenger monitoring. Schema, events, states, RLS, cross-property learning and pricing
history changes each require their own scoped approved order, current owner and
executable proof.

## 8. Phase 13 governed voice and conversational destination

Phase 13 turns the existing human/voice/automation ingress into one usable, local-first
multilingual question and command layer. The pipeline is exact:

```text
consented microphone or text
  -> bounded multilingual speech-to-text (when voice)
  -> strict intent/query JSON validation
  -> server-selected authorized query catalogue or existing typed command
  -> tenant/property context injected by the authenticated transaction
  -> PostgreSQL/RLS evidence or ordinary command result
  -> cited answer with period, scope, freshness and deep links
  -> optional local text-to-speech
```

The model receives neither database credentials nor authority to choose tenancy, SQL,
tables, permissions or mutation routes. It cannot execute raw or model-authored SQL. An
authorized query catalogue may grow until it covers Yellow's governed data, but every
entry has fixed parameters, classification, result limits, evidence shape and property/
tenant authorization. Unsupported or ambiguous questions fail closed or ask a bounded
clarifying question; answers never fill missing facts from model memory.

Read-only retrieval lands before command execution. A later command draft must map to
an already approved `CONTRACTS.md` capability and preserve that capability's permission,
confirmation, separation-of-duties, approval, idempotency, audit and transaction rules.
Voice has no capability unavailable to text/manual operation.

Local/open-source speech and compact quantized language models are preferred deployment
candidates because latency, privacy and marginal cost matter, but no vendor/model is
canonical until reproducible multilingual domain benchmarks measure accuracy, latency,
memory, licensing, failure behavior and supported hardware. Provider-compatible cloud
fallback remains opt-in deployment policy and cannot receive ineligible data.

Training teaches Yellow vocabulary, schema relationships, workflow language and the
validated intent/query grammar using documentation, synthetic scenarios and reviewed
question/query pairs. Changing hotel facts are retrieved live. Raw guest, financial or
tenant production databases are not copied into shared model weights; tenant-specific
learning, retention, deletion and cross-property use require separate explicit policy.

Post-v1 scope identities are Phase13 Voice/Conversational, Phase14 Adaptive RMS,
Phase15 CRM/CRS/Direct Booking, Phase16 Reporting/Forecasting/Executive Intelligence
and Phase17 Events/Outlets/Hotel Interfaces. Founder delivery priority after Phase12 is
`[13, 17, 14, 15, 16]`; this does not relax any prerequisite or grant implementation.
