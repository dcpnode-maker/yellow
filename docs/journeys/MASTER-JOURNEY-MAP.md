# Master Journey Map

**Status:** Target journey architecture; implemented status is tracked separately in
[CAPABILITY-MATRIX.md](../research/CAPABILITY-MATRIX.md).
**Rule:** UI, API, automation, integration, voice, and AI invoke the same authorized
application commands. Events describe committed facts; they are not alternate write paths.

## Journey notation

- **Command** — an intention checked against current state, policy, permission, tenancy,
  concurrency, and idempotency.
- **Event** — a committed fact written to the outbox with the state change.
- **UI context** — the smallest surface that lets the persona understand and act.
- **AI** — interpretation/recommendation/preparation unless tenant policy authorizes more.
- Names marked `target` are proposed catalogue entries and require an approved event order
  before implementation.

## Guest journey

| Step | Entities | Commands → events | Permission and UI context | Automation / AI opportunities | Failure cases |
|---|---|---|---|---|---|
| Discover | Property, Content, Amenity, Location, Offer | `searchProperties`, `getProperty`; analytics facts only | Public; fast accessible web/search | Translate, summarize verified amenities, personalize with consent | stale content, unavailable locale, inaccessible UI, invented amenity |
| Search | Property, UnitType, RatePlan, Restriction, AvailabilityProjection | `searchAvailability` → no mutation | Public or agent; availability/price matrix | Alternate dates/property, intent extraction | stale projection, timezone error, cache/provider outage |
| Select/quote | Quote, PolicySnapshot, TaxQuote, Package | `createQuote` → `quote.created` target | Public/agent; comparison with total and policies | Explain differences, upsell relevant options | hidden fee, rule overlap, currency/rounding drift |
| Hold | Hold, OccupancyClaim, Quote | `placeHold` → `hold.created` | Public/staff; countdown and guarantee boundary | Recommend safe TTL | last-unit race, expired quote, abandoned hold |
| Book | GuestProfile, Reservation, Segment, Folio, PaymentIntent | `commitReservation` → `reservation.confirmed` | Guest/staff/channel; review + consent + payment | Extract details, detect duplicate profile | retry duplicate, auth succeeds/local rollback, inventory conflict |
| Confirm | Reservation, Document, Conversation | `sendConfirmation` → `message.sent` | Guest and permitted staff; confirmation/timeline | Localized summary and next actions | delivery failure, wrong recipient, stale policy text |
| Pre-arrival | Reservation, TravelDetail, Registration, Request, Deposit | `updateArrivalDetails`, `requestDeposit`, `preRegister` → facts/events | Guest portal and arrivals workspace | Infer ETA, collect only missing data, prioritize requests | fraudulent link, missing statutory data, flight delay, consent withdrawn |
| Arrival | QueueEntry, RoomAssignment, IdentityDocument, PaymentAuthorization | `arriveGuest`, `assignRoom`, `authorizePayment` → `queue.entered`/assignment facts | Front desk with specific overrides; readiness dependency view | Predict wait, propose room, prepare registration | dirty/OOO room, inaccessible room unavailable, guarantee failure |
| Check-in | Stay, Segment, Occupancy, FolioWindow, Key | `checkIn` → `reservation.checked_in` | Front desk/kiosk within property policy; one readiness workbench | Prepare command, translate, guide exceptions | concurrent move, statutory block, key/POS outage, dirty-room override |
| Stay/service | Stay, Message, Task, Incident, Asset, Charge | `requestService`, `sendMessage`, `postCharge` → task/message/journal events | Guest channel; role-shaped staff queues | classify/translate/route, draft response, SLA risk | duplicate request/charge, safety incident, DND, provider outage |
| Room change | Segment, Occupancy, RoomCondition, Key, Rate | `moveRoom` → `segment.moved` | Front desk/manager depending consequence; preview old/new | Recommend feasible room and operational impact | destination OOO/dirty, share split, rate-to-charge decision, race |
| Payment | Folio, Payment, InstrumentToken, Journal | `authorize`, `capture`, `settle`, `refund` → payment/journal events | Guest hosted PSP + finance/front desk scopes | Explain balance, detect anomaly | duplicate callback, partial approval, FX, timeout/reconciliation |
| Checkout | Stay, FolioWindows, Settlement, Invoice, RoomCondition | `checkOut` → `reservation.checked_out`, `folio.settled` | Departure workbench; balance/AR guards | Prepare settlement, express-check candidates | open windows, late charges, skipped room, AR credit failure |
| Invoice/receipt | DocumentSeries, Document, FiscalSubmission | `issueDocument` → `document.issued` | Guest + cashier/finance; immutable document view | Explain line/tax composition | numbering race, authority rejection, correction required |
| Feedback | Feedback, Review, Incident, Consent | `recordFeedback`, `requestReview` → target events | Guest; privacy-aware communication | classify sentiment, recover service, summarize themes | coercive request, wrong channel, retaliation risk |
| Return | GuestProfile, Preference, Loyalty, PriorStay | `recognizeGuest`, `applyPreference` → only consented facts | Guest/staff; returning-guest context | Surface useful verified preference | mistaken identity, outdated preference, privacy restriction |

## Staff operating journey

| Step | Entities | Commands → events | Permission and UI context | Automation / AI opportunities | Failure cases |
|---|---|---|---|---|---|
| Set up | Tenant, OrgNode, Property, User, Role, Extension, Space, UnitType | `configureProperty` family → configuration facts/events | Owner/admin; guided setup workbench | Import website/spreadsheet, detect gaps, propose defaults | divergent seed/import, missing jurisdiction, excessive privilege |
| Sell | Availability, Quote, Guest, Reservation, Hold | search/quote/hold/commit → reservation/hold events | Reservations/front desk/sales; command palette + workbench | intent capture, alternatives, duplicate detection | race, policy mismatch, unavailable payment |
| Prepare | Arrival, RoomCondition, Task, TravelDetail, Deposit | `buildArrivalReadiness` query; `assignTask` → task events | Front desk/HK/engineering views | prioritize room readiness and missing data | stale ETA, task conflict, maintenance discovery |
| Arrive | Queue, Identity, Assignment, Authorization | arrival/check-in commands → queue/check-in events | Front desk/kiosk with explicit overrides | prepare check-in and explain blockers | statutory/payment/room/key blockers |
| Operate | Stay, Reservation, Folio, Message, Task, Incident | move/extend/shorten/post/service commands → domain events | Entity drawer/workbench with deep links | summarize context, recommend next action | concurrent edits, dependency outage, permission boundary |
| Serve | Conversation, Request, Knowledge, Preference | `sendMessage`, `createTask`, `recordPreference` → message/task/profile events | Unified inbox and mobile queues | classify, translate, draft, retrieve SOP | hallucination, wrong guest, missed urgency |
| Maintain | Asset, WorkOrder, OOO/OOS, Space, Task | `openWorkOrder`, `takeOutOfService`, `closeWorkOrder` → maintenance/inventory events | Engineering mobile/control workbench | diagnosis suggestions, preventive scheduling | parts delay, unsafe reopen, multi-room impact |
| Settle | Folio, Journal, Payment, Cashier, AR | post/transfer/adjust/settle/cashier commands → finance events | Cashier/finance workbench; dual control where required | anomaly/exposure warnings | unbalanced journal, duplicate payment, sealed day |
| Audit | BusinessDay, Discrepancy, InterfaceQueue, Document | `getCloseReadiness`, `carryForward`, `sealDay` → day events | Night-audit label/finance authority; exceptions-first | Explain blockers, assign owners | open cashier, late interface, unresolved stay, duplicate close |
| Analyze | Projection, Report, MetricDefinition, SavedView | queries/export/schedule → report facts if material | Role/property scoped analytics | explain variance, natural-language query with citations | inconsistent metric, stale projection, unauthorized detail |
| Optimize | RatePolicy, StaffingPlan, Workflow, Recommendation | `approveRecommendation`, domain commands → decision + domain events | Manager/revenue/owner approval surfaces | forecast, recommend, simulate | weak evidence, policy breach, model drift |
| Handoff | Shift, Task, Queue, Note, Approval | `handoffWork` → task/queue target events | Shift summary by role | summarize unresolved work with source links | notification spam, lost ownership, sensitive overexposure |

## Commercial journey

| Step | Entities | Commands → events | Permission and UI context | Automation / AI opportunities | Failure cases |
|---|---|---|---|---|---|
| Observe demand | MarketObservation, SearchSignal, Event, Pickup | `recordObservation` → `market.observed` target | Revenue/portfolio; evidence timeline | classify sources, freshness/confidence | illegal source, duplicate/stale observation |
| Forecast | Forecast, BookingCurve, Segment, CancellationModel | `generateForecast` → `forecast.generated` target | Revenue/GM; assumptions and versions | probabilistic forecast and scenarios | sparse data, event cancellation, drift |
| Price | RatePlan, RatePrice, PricingRule, Restriction | `recommendPrice` then `setRatePrice` → `rate.changed` target | Revenue scope + guardrails/approval | elasticity and comp reasoning | floor/ceiling breach, wrong currency/date |
| Distribute | CanonicalARI, ChannelMap, PushCursor | `requestAriPush` → `ari.push_requested` | Distribution health workbench | adaptive batching/retry | partial provider success, mapping drift, throttling |
| Convert | Quote, BookingSession, Reservation, Attribution | quote/hold/commit → reservation events | Public/agent/channel | personalization with consent, funnel analysis | bot/card testing, abandoned hold, inconsistent totals |
| Collect | Payment, Deposit, Settlement, Commission | payment commands → payment/journal events | Hosted PSP + finance controls | chase deposit, risk detection | auth/capture split, VCC timing, fraud |
| Reconcile | ChannelBooking, Commission, Payment, Journal, ProviderStatement | `reconcileChannel`/`reconcilePayment` → target exceptions | Finance/distribution | match and rank discrepancies | missing payout, FX, duplicate provider entry |
| Measure | StatsDaily, Attribution, NetRevenue, Outcome | projection queries; `recordOutcome` → target fact | Revenue/owner/GM, defined metrics | explain ADR/RevPAR/net contribution | attribution drift, inconsistent denominator |
| Optimize | Recommendation, Approval, Policy, Experiment | approve/execute through domain command → decision + domain event | Autonomy-policy controls | continuous evidence→action→outcome loop | feedback bias, unsafe automation, no rollback |

## Owner and asset journey

| Step | Entities | Commands → events | Permission and UI context | Automation / AI opportunities | Failure cases |
|---|---|---|---|---|---|
| Onboard | Owner, Unit, Agreement, Property, PayoutInstruction | `createManagementAgreement` target | Owner/authorized manager; guided legal/config flow | extract terms for review | wrong authority, ambiguous fee/tax basis |
| Make available | OwnerStay, Restriction, Space, SellableUnit | `blockOwnerStay` through occupancy/inventory commands | Owner policy + manager approval where required | show revenue opportunity cost | conflicts with guest booking/maintenance |
| Monitor | Asset, Reservation, Revenue, Expense, Incident | scoped queries | Owner portal, never staff/guest secrets | summarize performance with definitions | stale data, cross-owner leak |
| Approve | ApprovalRequest, WorkOrder, RatePolicy, Expense | `decideApproval` then domain command | Owner/manager separation of duties | prepare evidence and alternatives | self-approval, changed underlying state |
| Receive statement | OwnerStatement, Payout, Commission, Tax, Adjustment | `issueOwnerStatement` target | Owner/accounting; immutable versioned statement | explain gross-to-net bridge | payout hold, cancellation recovery, FX |
| Analyze | AssetMetric, Benchmark, Forecast | scoped analytics queries | Owner/portfolio | variance drivers and scenarios | metric inconsistency, privacy leakage |
| Maintain asset | Asset, WorkOrder, Vendor, Cost, Downtime | maintenance commands → work-order/inventory target events | Owner visibility; engineer execution | preventive planning | disputed responsibility, unsafe reopen |
| Change/exit | AgreementVersion, FutureReservation, PayoutBalance | `amendAgreement`/`terminateManagement` target | dual confirmation/legal policy | impact preview | active stays, unpaid balances, data retention |

The owner journey is a target bounded context. It must remain separate from guest folios
and requires an approved model before schema or code.

## Financial journey

| Step | Entities | Commands → events | Permission and UI context | Automation / AI opportunities | Failure cases |
|---|---|---|---|---|---|
| Configure | Account, TxCode, TaxAssignment, RoutingPolicy | configuration commands → version facts | Finance admin; maker/checker where needed | mapping suggestions | invalid account role, retroactive rule |
| Accrue/post | Journal, PostingLine, Folio, BusinessDay | `postCharge` → `journal.posted` | Authorized service/cashier | anomaly warning | imbalance, sealed day, duplicate key |
| Route/transfer | FolioWindow, Account, RoutingRule | `transfer` → journal event | Scoped finance/front desk | preview net effect | overlapping routing, currency mismatch |
| Collect/refund | Payment, Instrument, Journal | provider commands → payment/journal events | PSP-hosted collection; finance scopes | reconciliation | callback duplication, timeout, dispute |
| Correct | Journal, PostingLine, Document | `adjust`/`reverse` → journal/document events | Reason + approval thresholds | explain history | attempted mutation, wrong business date |
| Close | Cashier, BusinessDay, Discrepancy | cashier close/seal → finance/day events | Exceptions-first workbench | readiness summary | open items, retry duplication |
| Invoice | DocumentSeries, Document, FiscalSubmission | issue/submit → document events | Jurisdiction permissions | validate payload | numbering race, rejection, expired cancellation window |
| Reconcile/report | AR, ProviderStatement, TrialBalance, Report | reconcile/allocate/export | Finance/accounting | match discrepancies | missing/duplicate statement, FX drift |

## Distribution journey

| Step | Entities | Commands → events | Permission and UI context | Automation / AI opportunities | Failure cases |
|---|---|---|---|---|---|
| Connect | Channel, CredentialRef, Capability | `connectChannel` → target connection fact | Platform/property admin | capability discovery | expired credential, unsupported property |
| Map | ChannelMap, UnitType, RatePlan, Policy | `setChannelMap` → `map.changed` | Distribution specialist | suggest match with confidence | ambiguous/retired mapping |
| Publish | CanonicalARI, PushCursor | `requestAriPush` → `ari.push_requested` | Automated within limits | adaptive batching | rate limit, partial success |
| Receive | InboundMessage, RawEnvelope | `acceptInbound` → `inbound.received` | Service identity | classify/version | invalid signature, duplicate/out-of-order |
| Apply | Reservation, Occupancy, Guest, PaymentTerms | `applyInboundBooking` → `inbound.processed` + reservation event | Adapter invokes normal commands | field mapping assistance | confirmed overbooking, missing map |
| Recover | ErrorQueue, ReplayAttempt | `replayInbound` → processed/failed | Operator workbench | suggest repair | replay duplicates, stale manual email |
| Reconcile | ProviderSnapshot, CanonicalARI, Commission | `reconcileChannel` → target discrepancy | Distribution/finance | rank divergence | provider outage, eventual consistency |
| Offboard | Channel, FutureBookings, Maps | `disconnectChannel` target | Admin with impact preview | migration checklist | messages in flight, orphan mappings |

## AI journey

| Step | Entities | Commands → events | Permission and UI context | Automation / AI opportunities | Failure cases |
|---|---|---|---|---|---|
| Observe | EvidenceRef, EntitySnapshot, KnowledgeVersion | read-only authorized queries | Agent scope and minimized context | summarize/classify | PII overexposure, prompt injection |
| Interpret | Intent, CandidateCommand, Confidence | no mutation | Command palette/inbox/agent task | parse language/voice | ambiguity, wrong property/entity |
| Recommend | Recommendation, Evidence, ExpectedOutcome | `createRecommendation` target | Explainability surface | simulate alternatives | unsupported evidence, stale state |
| Prepare | CommandDraft, ApprovalRequest | `prepareCommand`/`requestApproval` | Human review or policy gate | fill structured arguments | hidden consequence, unauthorized field |
| Revalidate | EntityVersion, PolicyVersion | domain command dry-run/query | Same command boundary as humans | compare current state | approval stale after state changed |
| Execute | Domain aggregate | authorized domain command → normal domain events | Tenant autonomy level/budget | low-risk policy execution | retry duplication, provider outage |
| Measure | Outcome, Cost, Latency, Incident | `recordAgentOutcome` target | Agent control center | evaluate value/quality | attribution error, delayed outcome |
| Learn/govern | Evaluation, Policy, ModelRoute | controlled config/approval | Platform/tenant admin | route by quality/cost/privacy | regression, vendor outage, data retention |

## Cross-journey dependency graph

```text
Identity + tenancy + permissions + audit + events
                      |
Property + configuration + inventory
                      |
Occupancy arbitration -> availability -> rates/policies
                      |                         |
                      +------ reservation <-----+
                                 |
             guest/profile -> stay operations -> housekeeping/maintenance
                                 |
                         folio/ledger/payments
                                 |
                  documents/tax/statutory/reporting
                                 |
        distribution <-> commercial intelligence <-> owner/asset
                                 |
        automation and AI use the same commands across every layer
```

## Journey acceptance template

A journey step is ready for implementation only when its order identifies:

- command input and output;
- owning aggregate/context;
- transaction and concurrency boundary;
- permission/policy;
- audit fact and pre-approved event;
- idempotency key;
- expected/exception/failure states;
- recovery or compensation;
- API and role/device UI;
- tests that would fail if the invariant broke;
- honest completion classification.

This prevents a screen, table, prompt, or integration adapter from being mistaken for a
working journey.
