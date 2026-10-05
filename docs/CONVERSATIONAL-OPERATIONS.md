# Conversational hotel operations in existing Yellow

Date: 2026-09-23. Order 665. Research and design, not a deployment claim.

## Decision and boundaries

The requested connected guest/staff journey is feasible. Keep the existing Yellow
modular monolith and its latest approved screens. Voice is another input to the
same application functions used by forms, buttons and text commands; it is not a
second PMS or a model-controlled database.

The design uses the engineering system-design skill to separate requirements,
data flow, permissions, failure handling and measurable performance. It extends
[the five-stage journey](GUEST-STAFF-JOURNEY.md) and
[the PMS comparison](PMS-ARCHITECTURE-FLOW-COMPARISON.md).

Open-source components can remove model API charges on the local path, not the
cost of hardware, electricity, hosting, support or payment processing. No claim
of Gemini-equivalent quality, world-leading speed or production completion is
made without tests. Do not start new deployments or buy services for this design.

## One complete Mr. Adoor workflow

| User request or stage | Context and actual software responsibility | Visible outcome |
| --- | --- | --- |
| Show arrivals today | Authenticated property, its local business date, allowed reservation records | Filtered arrivals list, count and freshness; no LLM needed for the common command |
| Open Mr. Adoor | Search names/confirmation numbers; resolve multiple matches rather than guessing | Correct reservation workspace; no check-in mutation |
| Show his details | Link guest, booker, sharers, company/group, payer, reservation, visits, preferences, requests and authorised historical folios | Compact guest summary with expandable evidence and history |
| Find the best room | Eligibility first: booked product, full stay interval, occupancy locks, out-of-order restrictions, capacity, accessibility and room readiness; then rank eligible candidates by preferences | Available now, suitable alternatives and reasons; not an invented AI promise |
| Offer an upgrade | Read sellable categories, rate/contract/package entitlements, existing benefits, taxes, currency, authorised discounts and current availability | Itemised extra price, duration, quote expiry and acceptance; no guessed arithmetic |
| Original room still cleaning | Read housekeeping task, assignee, latest update and an explicitly recorded estimate | Honest estimated range or “estimate unavailable”; staff owns the estimate |
| Show check-in | Open the guided check-in screen | A screen, not an executed check-in |
| Check him in to the selected room | Present guest/room/date/price summary; validate policy, permission, current reservation version and readiness again; execute the existing governed stay function | Persisted stay and room assignment, reread confirmation and audit event |
| Edit after check-in | Same authorised field validation through touch, keyboard or dictation | Reviewed changes saved, with history; immutable financial documents remain immutable |

History is useful context, not blanket authority. Separate guest identity from
booker and payer, and distinguish verified preferences from inferred ones.
Do not expose internal notes, another guest's bill or a corporate contract to a
guest-facing assistant. Retrieve a small relevant summary first; load old bills
only when needed and permitted. Do not send all guest history to a model.

Room ranking is explainable application logic. A language model may explain the
result but cannot change availability, manufacture an entitlement or select a
more expensive option without acceptance. If two agents try to sell the last
room, the authoritative database transaction determines the winner.

### Early check-in and late checkout

These are sellable services governed by configuration, not just date fields.
Check existing inclusions, allowed windows, fees, approval limits, current/next
occupancy and housekeeping turnaround. A late checkout must account for the next
arrival and any protected maintenance time. Keep elapsed clock time distinct
from the property's business date and overnight inventory accounting.

Offer -> accept -> revalidate -> commit the time entitlement, required occupancy
effect and charge through the relevant governed operation -> update housekeeping
and arrival/departure queues. Changes to occupancy/financial rules require their
own scoped implementation order and independent executable review.

## Shared command contract

Proposed flow, not existing API names:

```text
Tap / type / microphone
          |
  Intent + entities + current screen context
          |
  Typed, allowlisted application command
          |
  Authorisation + validation + current data
          |
  Read result OR specific change preview -> confirmation
          |
  Existing domain function -> transaction -> reread result
```

Use one command catalogue carrying input schema, read/write classification,
permission, validation, confirmation policy and result type. The server supplies
tenant, property and actor from the session, never from model-generated values.
Models propose commands; the application owns execution and business rules.

- Reads/navigation usually run immediately. Ask only when identity or intent is
  ambiguous; “show check-in” differs from “check in”, and negation must be honoured.
- Dictation inserts text into a focused draft field. It never treats dictated
  content or a guest note as an instruction to execute unrelated actions.
- Mutations show a specific before/after or financial summary. Bind approval to
  that proposal, its expiry and record version. A previous generic “yes” cannot
  authorise a later changed price, different guest or different room.
- Recheck permissions and versions on execution; use idempotency for retries and
  duplicate speech events. Never say “done” until the authoritative result arrives.
- Treat guest notes, website/menu text and model output as untrusted data. No
  arbitrary shell, raw SQL or open-ended tool access in the customer assistant.
- Offline/disconnected clients may prepare clearly marked drafts, not claim a
  committed check-in, room allocation, payment or room charge.

## Low-cost voice: recommended evaluation path

Speech recognition (hearing), intent resolution (understanding), application
execution and speech synthesis (speaking) are different components. They do not
all require a general-purpose LLM.

1. Microphone starts on an explicit tap. Stream partial transcripts for feedback;
   only completed utterances are eligible for interpretation. Provide Stop and
   Cancel, an editable transcript and a keyboard/touch fallback.
2. Use local voice-activity detection and benchmark on-device recognition. Match
   common commands and entities with a constrained parser plus screen context.
   If ambiguous, ask a clarification or use a bounded model fallback, not a guess.
3. Send only the necessary context to a local language model for complex wording.
   Any cloud fallback is opt-in and budget-capped; it is not silently enabled
   when local recognition fails. No always-running model per hotel reservation.
4. Generate concise responses from software results. Preserve Order 594's silent
   default and one-shot explicit Speak/answer-aloud consent. A future continuous
   conversation mode needs its own explicit activation and interruption behaviour.

| Candidate | Supported role / source evidence | Yellow decision and limitation |
| --- | --- | --- |
| [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | Apache-2.0 runtime; local streaming/offline ASR, TTS and VAD; Android, Windows and WebAssembly support | First runtime to benchmark for shared device/browser speech; select and check each model's separate licence and accent/language coverage |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | MIT runtime, CPU inference and quantisation; published base/small reference memory approximately 388/852 MB | Accuracy comparison for multilingual recognition; memory fit does not prove phone speed, streaming latency or noisy-lobby accuracy |
| [Browser Web Speech](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API) | Recognition may use a server; explicit local recognition needs available language packs | Compatibility fallback only with clear processing location; [`processLocally`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally) is experimental, not universal offline support |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | Small open-weight TTS with Apache-2.0-labelled weights | Candidate for spoken output, not understanding; Indian-English voice quality must be auditioned, not assumed from English support |
| [OmniVoice](https://github.com/k2-fsa/OmniVoice) | Multilingual TTS and voice design/cloning; repository Apache-2.0; documented examples use accelerator-backed PyTorch | If this is the “Omni voice” intended, it supplies speech output, not a complete voice assistant. Do not select it as the default phone engine without measurements; verify exact weights/dependencies and consent for any cloned voice |
| [Gemini Live](https://ai.google.dev/gemini-api/docs/live-api) | Streaming audio, interruption and [function calling](https://ai.google.dev/gemini-api/docs/live-api/tools) | Reference for interaction quality, not a required dependency or a promise of unlimited free use; application still validates every proposed action |

Indian English is the initial target, including Indian names, room numbers,
amounts and hotel vocabulary. Recognition language and output accent are separate
settings. Contextual vocabulary hints should improve recognition without silently
forcing an uncertain surname into the wrong guest record. Hindi/code-switching
needs its own test set. No engine above was downloaded or benchmarked in this order.

## Website, POS and room billing are one connected service flow

Use configured service/menu items shared by the guest website, guest portal and
staff POS: outlet, service hours, availability, variations, structured modifiers,
prices, taxes, fulfilment location and hotel-approved policy. Do not duplicate
separate menu/pricing logic in a chatbot.

Example: “One sandwich, no onions, charge to my room.”

1. Build a draft with the exact item, quantity and modifier; clarify alternatives
   or unavailable modifications. “No onions” is not automatically an allergy.
   An explicit allergy requires the appropriate kitchen acknowledgement; never
   promise allergen safety from a language-model inference.
2. Show itemised total, fulfilment estimate, delivery location and payment choice.
   Authenticate the guest/stay; a room number alone cannot authorise room charges.
3. On confirmation submit one idempotent order. Staff accepts or rejects the
   modifier, and the guest sees that acknowledgement and subsequent progress.
4. Route to the outlet/kitchen and shared staff task queue. Expose useful guest
   statuses, assignee/team where appropriate and escalation; internal notes and
   staff-only approvals remain private. Amendments/cancellations follow policy.
5. Online payment and room billing are distinct settlement paths. Reconcile
   verified provider events for online payments; use the authorised posting
   function for room charges and enforce limits. Never collect online and then
   post the same unpaid amount to the room. Rejections/refunds/reversals must
   reconcile the order and ledger. An order acknowledgement is not a paid receipt.

Website order, kitchen ticket, guest-visible progress, staff ownership and folio
must reference the same service order. Share data and domain operations, while
keeping each surface's role-specific view. This extends across the five journey
stages: pre-arrival requests, arrival offers, stay services, departure settlement,
and post-departure issue resolution.

## Performance, cost and UI

Keep the current modular monolith, transactional source of truth, established
outbox and domain boundaries. No microservice split or language rewrite is needed
just for voice. Speech runs off the rendering thread, loads on demand and does
not block manual workflows. Reuse small model instances where practical; cap
concurrency to avoid memory pressure rather than claiming free infinite capacity.

Use indexed bounded reads and small authorised read models for arrivals, guest
summary, assignment and service queues. Refresh/invalidate affected data from
committed events. A cached room view is a preview, never authority to sell it.
Keep expensive analytics and AI summaries out of the check-in transaction.

Retain the approved glass Today overview, grey/white ribbon with thin neon-yellow
selection, backing cards only for major tabs, and semantic status colours without
LED-bulb effects. The mic belongs in the common command area; field dictation is
clearly different. Show history, room choices and proposed actions in existing
workspaces, not a competing AI dashboard. Mobile uses focused steps; desktop can
show guest context beside the room plan. Keep sufficient contrast and reduced
motion/transparency options; glass effects must not slow the operational grid.

Define separate targets and publish measured p50/p95 values:

- 50 ms is a target for local interface feedback and selected warm bounded server
  operations under a named load/hardware profile, not a universal end-to-end SLA.
- Cold navigation, network transit, audio endpoint detection, recognition and
  external payment confirmation have separate timing budgets.
- Measure end-of-utterance to action preview, ASR real-time factor, peak RAM,
  thermal throttling, relevant entity accuracy and accepted/rejected command
  correctness on the actual laptop, 10R and 11R. No results are assumed here.
- Test noise, accents, interruptions, duplicate messages, negation, homonyms,
  stale quotes, room conflicts, provider timeout and disconnected sessions.
  Include “show check-in”, “don't check him in”, “room four fourteen”, and amounts.
- Correctness gates include no unauthorised/cross-tenant action, no double posting,
  current-state revalidation and independent proof for high-risk writes. Test
  results bound what was verified; they are not a claim of military certification.

## Current evidence and next integration slice

Observed source, not a live-deployment audit. The coordination checkout is a
bootstrap/demo lineage; it is not the complete operator frontend. Do not infer
whole-product absence from the three files below:

- `src/overwatch/confirmation-gate.ts` uses keyword regexes including `check-in`
  and `arrival`; its result is explicitly `executed: false`. It cannot be treated
  as the complete semantic command executor. Navigation versus mutation needs
  explicit coverage, including negation.
- `src/overwatch/gemini-provider.ts` is a text `generateContent` adapter, not a
  streaming native-audio Live session. Configuration is not proof of connectivity.
- `src/demo/governed-guest-profile-command.ts` has a real database command path
  but is explicitly limited to one public-demo reservation and fixed fixture
  identities. That is reusable proof structure, not general guest-profile support.
- Prior Orders 511 and 594 specify pause-to-submit and silent-by-default speech
  controls in other source snapshots. Their existence does not prove that the
  exact published app has all of them. Preserve rather than overwrite those UX
  decisions when choosing the authoritative implementation source.
- Independent read-only inspection of the Order 593 frontend snapshot found
  `guestProfileVoiceAction` / `guestProfileVoiceCandidates`, `InlineGuestProfile`,
  `reservationGuestAllocationIntent` and `replaceReservationGuests`, plus
  `OverwatchCheckInJourney.assignSelectedRoom` invoking `assignDueInRoom`.
  These preserve useful history/ambiguity/proposal/revalidation functionality.
  `cashierChargeIntent` proposes and `postFolioCharge` posts through the same API
  as the cashier UI. No full POS/menu/order flow was evidenced in that bounded
  inspection. Reuse these components; do not rebuild them from the bootstrap gate.

The subsequent founder request to run one live app is handled separately in
Order 666, which identifies the active full-app source through Docker labels as
`D:/Yellow/git-live-order611-source-v2`. This document is not a runtime receipt.

The first end-to-end acceptance slice should be: real arrivals search -> resolve
guest -> authorised history -> live room/upsell offer -> guided check-in -> edit
guest fields. Prove it through manual controls first, then invoke the same commands
through text and voice. Complete service ordering as the next connected slice.
This is sequencing, not removal of group, sharer, finance or ecosystem scope.

No application code, database, devices, paid APIs or deployment changed in this
research order. Documentation completion does not mean the above flows are live.
