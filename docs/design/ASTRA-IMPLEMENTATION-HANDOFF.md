# Astra UI handoff — current implementation direction

## Current release direction — 9 September 2026

This section supersedes the earlier single-design, three-workspace and
prototype-only directions below. The founder selected eight light interfaces:
Ledger, Aura, Relay, Journey, Orbit, Atlas, Focus and Index. Concepts01/02 are
excluded;05/06 supply workflow inspiration only. Each presentation may use a
different screen composition; it must preserve the same authorized application,
data, commands, drafts and route identities.

Order458's initial implementation was rejected for insufficient visual fidelity.
Order459 now has distinct mounted Today and invoice compositions and five native
workflow groups across all15 existing destinations, informed by the founder's
[Hotel PMS reference](http://pms-test-alb-901282387.ap-south-2.elb.amazonaws.com/).
No global Simple/Advanced/Expert hierarchy or catch-all More workspaces menu is
the current direction. See [selectable interfaces](SELECTABLE-INTERFACES.md)
for implemented structures, device behavior and remaining design intent.

Root's actual-source Chromium proof passes1/0 with1,143 assertions using fictional
HTTP fixtures. This is technical source evidence, not founder visual acceptance,
complete journey coverage or native iOS/Android completion. Current source is
unpublished; local3000 is stopped. [Project status](../PROJECT-STATUS.md) owns the
release/runtime lifecycle. Do not infer new functionality from a presentation or
animate invented AI processing. Paused Order445 guest-picker changes are excluded
from this release; existing reservation/API safeguards remain unchanged.

## Earlier directions — retained history, not current release authority

**Founder clarification: 2026-09-07.** This records the latest direction, not a
claim that the current local app already implements it. Execute through
[Order444](../../handoff/orders/444-partner-review-and-astra-ui-integration.md).

## Source and precedence

- [Definitive founder-revision handoff](https://github.com/dcpnode-maker/yellow/pull/86#issuecomment-5564886892)
  was returned by Astra and personally read in full on 2026-09-07. It is the
  current design delta; the earlier summary below supplies historical context.
- [Complete Astra handoff](https://github.com/dcpnode-maker/yellow/pull/86#issuecomment-5556411974),
  from task **Review Yellow Findings**, was personally read by the coordinator.
- Candidate source is `397251e0b1756c746657e3fc85b746ab0f238686`:
  [UI direction](https://github.com/dcpnode-maker/yellow/blob/397251e0b1756c746657e3fc85b746ab0f238686/docs/design/UIUX-DIRECTION.md),
  [staff workbench](https://github.com/dcpnode-maker/yellow/blob/397251e0b1756c746657e3fc85b746ab0f238686/docs/design/STAFF-WORKBENCH-SPEC.md),
  [source order](https://github.com/dcpnode-maker/yellow/blob/397251e0b1756c746657e3fc85b746ab0f238686/handoff/orders/442-profile-cards-and-workspace-skins.md),
  [independent review](https://github.com/dcpnode-maker/yellow/blob/397251e0b1756c746657e3fc85b746ab0f238686/handoff/reviews/442-workspace-skins.md).
- Newer founder messages take precedence: follow Astra's complete flow changes;
  **leave neomorphism for now**; expose built functions in the partner review app.
  The request for creative freedom was delivered to the source task. Astra's
  reply is the definitive handoff linked above; no source/runtime changes or
  completed operational redesign are implied by that reply.

## What is selected

| Workspace | Main composition | Purpose |
|---|---|---|
| Calm Workbench | Quiet scoped queue and generous selected-task context | Make the next guest need, blocker, owner and next update clear |
| Precision Desk | Aligned dense records and contextual inspector | Fast comparison and keyboard work without losing selection |
| Service Timeline | Guest promise, ordered handoffs and durable receipts | Show responsibility, acknowledgement and what happens next |

These are three layouts of one Yellow app, not separate systems or permission
levels. Switching preserves mounted workflow, subject, drafts, property, focus and
request identity. They are distinct from the historical Apple/Pixel/Win95/Glass/
Neo/ERP appearance families. Do not mistake colour changes for this integration.
Expose only the three selected concepts in the intended review UX. Historical
six-appearance support does not require six public choices. A temporary internal
compatibility token may keep existing mounted controls styled during migration;
it is not an additional client skin or a claim of native-device fidelity.

Retire global **Simple/Advanced/Expert** in the new flow. Reveal details and actions
according to the current task, journey, authorized role and property. Keeping an
old selector because a historical test expects it is not product acceptance; the
scoped replacement must introduce meaningful behavioral tests.

## Hotel and STR journeys

Hotel prioritizes arrivals, departures, in-house guests, room readiness,
housekeeping, cashier/finance and cross-department work. STR prioritizes listing
portfolios, multi-calendar, turnovers, messaging, owners/statements, pricing and
channel exceptions. Both reuse one domain core and server authorization.

For each task, show who/what is affected, the blocker, accountable owner and next
guest update. Sending is not acceptance; cleaning is not inspection; inspection
is not check-in; a visual success state is not a committed financial receipt.
Phone presents a focused task with a reliable Back-to-queue path, rather than a
shrunk desktop table. Preserve selection and draft work through interruptions.

FO may receive permitted guest/stay details; HK receives room/access/task and
inspection context without unnecessary billing/identity data; finance receives
exact payer, folio, posting and reconciliation evidence. A skin, badge, department
selector, prototype checkbox or CSS-hidden field never grants access.

## Identity and visual sources

The right-hand Sophie Bennett reference informs **guest and staff/management
identity cards only**: nested rim, continuous portrait surface, softened lower
details and raised meaningful action. It is not the pattern for finance or task
rows. Production uses authorized identity content; fictional portraits stay in
the explicitly labelled study. Synthex supplies secondary palette, type and
hierarchy inspiration, not a requirement to copy its whole dashboard.

Use source-licensed components/assets where useful, cohesive geometry, readable
contrast, visible keyboard focus and interruptible reduced-motion-safe transitions.
Quality is judged in the running workflows. No pixel-perfect/native/device or
performance claim without the corresponding inspection and measurement.

## Voice-agent document and scope

The founder is consolidating a separate multilingual action-taking agent document
for final review and implementation. Preserve that upcoming input; do not invent
its final model, training or integration choices. The agent should be able to
retrieve, explain and carry out supported jobs such as reservation lookup,
check-in and invoice printing through the same authorized application commands.
Disambiguate targets, ask for missing facts, retain request identity on uncertain
outcomes, and obtain the confirmations required by sensitive actions. No arbitrary
SQL, tenant selection, permission escalation or direct financial mutation.

## Current delivery boundary

The historical local77 app is not this redesign. PR86 remains draft/conflicting;
its successful original CI does not establish integrated85 behavior. Its prototype
has14 fictional cases and16 department views, not16 released department modules.
Exact live route/API mapping, authenticated journey composition and current
rendered acceptance still have to be implemented and verified. The new review
release must record its actual source, schema, credentials/prefill behavior and
reachable implemented functions, with unsupported functionality clearly labelled.

## Definitive acceptance contract

The common journey is **queue → subject → permitted action/review → server receipt
→ handoff/next owner**. Returning retains queue position. Show guest/service need,
blocker, owner, next permitted action and next update from real authorized evidence.
Requested, accepted, cleaned, inspected, ready and checked in remain separate states.

- Review manifest: each completed feature's route, role/permission, actual
  read/command, persistence/test receipt, synthetic-data status and limits.
- Calm: concise department navigation, quiet queue, generous next-action panel.
  Precision: aligned dense records, pinned identity/status, contextual inspector,
  keyboard operation. Timeline: guest promise and ordered ownership/evidence/
  acknowledgement, with compact surrounding queue. No invented event history.
- Every switch preserves property, subject, drafts, filters, relevant scroll,
  keyboard focus and original request identity. No mutation, sensitive refetch,
  storage of guest data or remount solely for a layout change.
- Role disclosure is server-authoritative. Sales uses group/event/BEO versions
  and individual acknowledgements; F&B uses outlet/order and charge destination;
  spa restricts sensitive intake; management receives authorized exceptions and
  drill-down, not automatic unrestricted access. Unbuilt departments stay labelled.
- Golden cases: YC01 preparation → HK acceptance → cleaning → inspection → FO
  acknowledgement → separate arrival review; YC09 versioned BEO and each receiving
  department's acknowledgement; YC11 wrong-payer block with original attempt and
  receipt retained. A case is study-only until all required transitions exist.
- Reference palette/type: source blue/mint #1B405B/#DFF3EB, warm neutral/sage,
  near-black, restrained yellow; licensed self-hosted Urbanist/Phosphor provenance.
  4/8/12/16/24/32 spacing and 16px default body with aligned numeric figures.
- Feedback 120–180ms, panel transitions 180–240ms; these are targets, not measured
  claims. No success animation before receipt. Reduced motion removes decoration.
- Test 1440×900, 1024×768, 768×1024, 390×844, 320px reflow and 200% zoom. Phone is
  one focused task with reliable Back; table overflow is contained and labelled.
  Sticky controls do not cover errors, content or the on-screen keyboard.
- Primary targets ≥44×44 CSS px; visible focus, keyboard operation and restoration,
  announced async outcomes; normal text contrast ≥4.5:1, large text/controls ≥3:1,
  semantic status beyond colour, usable forced-colours mode.
- Distinct denied/stale/double-submit/wrong-payer/uncertain-network recovery. A
  timeout reconciles the original attempt; financial and tenant invariants remain.
- Capture all three layouts, identity variants and key states on one exact build.
  Compare flat target screens, not perspective marketing images. Do not claim
  pixel perfection or speed without rendered comparison/device measurement.
- Deliver partner walkthrough, capability manifest, exact SHA and verified access
  through existing release processes. No credentials in Git. Current CI and
  independent high-risk proof are required; original PR86 CI is historical.

RMS equalizer/value/distribution/margin/tiered-scanning proposals remain research,
not free connectivity, measured latency or guaranteed profit. The consolidated
voice document remains upcoming and does not block the completed-feature review.
