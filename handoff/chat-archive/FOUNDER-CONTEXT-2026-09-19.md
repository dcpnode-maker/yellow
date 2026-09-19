# Founder context recovered from recent conversations

Recovered 2026-09-19. This is a product-intent and delivery record, not executable
proof, a decision record, or an implementation claim. It deliberately excludes login
details, API credentials, personal data, screenshots and copied third-party material.
`PROJECT.md`, `DECISIONS.log`, approved orders and executable verification prevail.

## Immediate product priority

The immediate objective is a pleasing, shared **PMS demonstration** for colleagues
and hospitality practitioners. RMS/compset expansion is deferred. The demonstration
uses synthetic data, a single shared demo dataset and ordinary browser access. It
must let a tester experience a coherent operating journey rather than a collection of
unfinished screens:

1. create/find a reservation;
2. review arrival and guest context;
3. assign an eligible room and check in;
4. manage housekeeping/service visibility;
5. review/post only safe simulated folio activity;
6. check out and view the resulting audit trail/document preview.

The public demo must never use real guest data, PAN/CVV, a real payment charge, live
OTA publishing, statutory submission or external guest messaging. It needs clear
demo labels, reset/recovery capability and an honest capability indicator.

## Jarvis: AI and voice requirement

Jarvis is the future common conversational and voice interface across PMS, CRM, RMS
and operations. It is a UI controller and explanation layer, not a database actor.

- Fast path: deterministic commands open the relevant workspace or invoke typed
  Yellow actions.
- Semantic path: a lightweight/local resolver turns multilingual hotel language,
  aliases and shorthand into a typed intent.
- Escalation path: a stronger model handles unusual or ambiguous conversations,
  asks for missing facts and proposes a typed action.
- Every consequential action remains subject to Yellow permissions, validation,
  confirmation where required, idempotency, audit facts and outbox events.
- The same API serves desktop, mobile, chat and voice. An LLM may never execute
  arbitrary SQL or bypass financial, occupancy or tenant controls.
- Preserve short-lived interaction context (active room, guest, reservation and
  folio) to improve speed and reduce model calls.

Gemini may be connected as a server-side, optional model provider for the demo after
the founder supplies a secret through an approved host-secret mechanism. Do not put
keys in source, Git, browser code or chat. A Gemini subscription alone is not proof
of compatible API access or free use.

## Cost and model-routing requirement

Use lower-cost/local models for routine implementation, testing, classification and
repetitive tasks. Reserve Astra for architecture, difficult reasoning and independent
review. The intended long-term operating principle is native Yellow code first,
lightweight/local model second and premium model only for exceptions. The previous
local/free-model route has not yet been proven by a real Yellow change, test and
published review; it must not be described as operational until that happens.

## Operational data and workflow requirements

The previously incorporated hotel-operations supplement remains the detailed source:
`yellow-ota-rms-kb/HOTEL-OPERATIONS-REQUIREMENTS.md` in the shared external research
corpus. Its scope includes front desk, housekeeper, engineering, cashier, revenue and
group-management journeys; arrival-aware prioritization; governed payment exposure;
maintenance intelligence; guest-context assistance; exceptions; privacy; and proof
requirements. This record does not duplicate it.

The broad design direction also includes a unified operational graph around guest/
person, property, reservation/stay and timeline. Actions, service requests, tasks,
approvals, postings, messages and room events should be traceable to their relevant
stay and parties with actor and time evidence.

## Distribution and market-data direction

Use official/authorized interfaces where possible and distinguish partner-side
capabilities from public observations. Yellow should be compatible with external
channel managers during the transition to direct distribution. For future RMS work,
do not collect every theoretical room/rate permutation: first learn a property's rate
relationships, sample representative rates and selectively verify exceptions. Client
future horizon and multiple competitor URLs must be configurable. This is research and
product direction, not authorization to scrape or publish.

## Lighthouse research status

Lighthouse was requested as a thorough RMS competitive/product analysis covering
information architecture, workflows, rate shopping, compsets, room/rate-plan logic,
dashboards, reports, alerts, integrations, methodology, data clues and UX patterns.
It did **not** complete: the authenticated portal could not be safely accessed by the
available browser workflow. No private portal content has been incorporated. Resume
only with authorized interactive access, compliance review and a scoped research
record. Rotate any credentials that may have been shared outside an approved secret
store.

## Laptop-hosted public-demo plan

The intended topology is:

`tester browser → HTTPS tunnel → laptop web app/API → laptop demo database`

Do not expose PostgreSQL directly or use router port forwarding. A temporary
Cloudflare Quick Tunnel is suitable for an initial, disposable demo URL and does not
normally require an account, domain or card. It is not a stable production service.
A durable named URL requires a tunnel/DNS provider account and normally a domain; a
VPS remains the appropriate next step for persistent availability. The laptop must
stay powered, awake and online for laptop hosting.

As of this recovery, only PostgreSQL was listening locally; `/ready` on ports 3000 and
3001 was unavailable. The source in this checkout exposes a health route only.
Therefore no public URL may be claimed as a usable PMS until the tested PMS runtime is
identified, started and browser-verified locally.

## Retrieval sources

- `6aae623a-1490-83ee-ada4-51c29e05ca29` — authoritative post-limit Yellow intent,
  AI/voice and low-cost routing request.
- `6aae6cbc-7890-83ee-9e55-ad4b2c595ac0` — laptop-hosted shared-demo discussion.
- `6aacd5c3-5958-83e9-9f63-5856a6b1d1f9` — Lighthouse research objective and blocked
  access status.
- `6aa8fe7b-4c10-83ee-aaee-c5013572b522` — Jarvis/native execution and local-model
  recovery discussion.
- `C:/Users/astha/.codex/visualizations/2026/08/23/01a02df3-c84f-7773-a169-dec0e20c9da6/yellow-ota-rms-kb/`
  — detailed external requirements and RMS knowledge corpus.
