# Yellow UI/UX direction — efficiency, feel and visual identity

**2026-09-05 · Order440 · Research-based design recommendations.**

The product should make a busy shift feel manageable. The signature experience is
an employee seeing the next important guest need, understanding its evidence and
owner, completing the permitted action, and seeing that the next team received it.
The visual design should communicate that clarity before someone learns the product.
These recommendations build on the [hotel benchmark](../research/HOSPITALITY-UX-BENCHMARK.md),
[department journeys](STAFF-JOURNEYS.md) and [casebook](HOTEL-CASEBOOK.md). They are
original synthesis, not claims that Yellow already implements the proposed workflows.

## What to learn from established products

| Observed primary-source pattern | Yellow interpretation | Concrete design decision |
|---|---|---|
| Linear separates incoming work into a team triage inbox and exposes accept/decline/snooze actions and responsibility | A request needs an accountable recipient before it becomes accepted work | Show “Requested,” “Accepted by HK” and “Inspection pending” separately; retain sender responsibility until acknowledgement. [Source](https://linear.app/docs/triage) |
| Linear supports saved filtered views with scope, ownership and reusable links | A recurring shift should not require rebuilding the same filters | Propose role/property-scoped “Due arrivals,” “My rooms,” “Unacknowledged requests” and “Unreconciled checks”; a copied link must never grant access. [Source](https://linear.app/docs/custom-views) |
| Carbon tables support sorting, selection, expansion, toolbars and different densities | Finance and reservations need comparison across many records; a card per record can waste scanning space | Use an aligned table for accounts/arrivals, reveal one selected subject in a detail panel, and name the exact scope of bulk actions. [Source](https://carbondesignsystem.com/components/data-table/usage/) |
| Fluent uses spacing and proximity to express relationships and a four-pixel spacing ramp | Consistent grouping can make hierarchy clear without borders around everything | Propose 4/8/12/16/24/32 spacing tokens, fewer nested boxes, consistent control geometry and one dominant action. [Source](https://fluent2.microsoft.design/layout) |
| Fluent treats motion as communication and includes accessible motion guidance | A transition should explain what changed without making staff wait | Use brief acknowledgement and context transitions; keep receipts readable, honor reduced-motion settings and never animate an irreversible action into apparent success. [Source](https://fluent2.microsoft.design/motion) |
| WCAG2.2 target-size guidance specifies a 24×24 CSS-pixel minimum with defined exceptions | Mobile hotel work benefits from a more forgiving product target | Propose at least 44×44 primary touch controls, visible focus and text labels. This is a Yellow design target, not a claim that WCAG always mandates44 px. [Source](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) |

These are documented patterns, not hands-on benchmark measurements. Vendor claims
about speed or revenue are not adopted as Yellow performance results.

## Three screen directions to compare

All three use the same governed commands, tenancy, financial rules and future six
appearance families. They are alternative information layouts, not competing apps.
Keep Yellow as the working name until the [name review](../research/APP-NAME-SHORTLIST.md)
produces a selected brand. A selected visual target is needed before a fidelity build.

| Direction | Composition and feel | Best test |
|---|---|---|
| Calm workbench | Warm neutral canvas, concise department navigation, a quiet task list and one generous next-action panel. Yellow marks identity; strong text and a clear action color carry the interface. | Can a new FO employee immediately explain why the waiting guest cannot check in and who owns the next step? |
| Precision desk | A compact, aligned arrivals table with pinned identity/status columns and a restrained contextual inspector. Crisp geometry and minimal decoration support keyboard work. | Can an experienced receptionist find the right reservation, inspect conflicting room facts and recover a blocked action without losing place? |
| Service timeline | The selected guest promise leads; an ownership timeline shows preparation, acknowledgement and the next update. A narrow queue preserves other waiting work. | Can a duty manager reconstruct what was promised, what changed and which department needs to act next? |

Recommendation: develop the **calm workbench** as the initial FO learning surface,
retain **precision desk** for high-volume reservations/finance, and use the **service
timeline** as contextual evidence. Validate this combination; do not place all three
complete layouts on one screen. The current fictional workbench is an interaction
study, not proof that this visual direction is complete or selected.

## The actual screen contract

The first screen to refine is an early arrival waiting for room412. It needs only
four immediate answers: who is waiting, what is blocking arrival, who owns the next
step, and when the guest will hear from us. The main action requests preparation;
it must not imply that the room is inspected or that a key has been issued.

Use a 14–16 px body-text base, a short type hierarchy and readable money/date
alignment. Keep paragraph width comfortable. Put the room and reservation identity
beside the decision so staff do not mentally join distant panels. Status text must
explain state without relying on color. Yellow brand accents should never make every
item appear urgent. Use real, consistent icons from an admitted set with text labels;
do not fill the interface with mismatched emoji or decorative graphics.

For FO, show the arrival queue and the selected guest's context. For HK, prioritize
room/task identity, access restrictions, acknowledgement and inspection separately;
hide guest billing and unnecessary personal details. For finance, show the original
attempt, exact payer/folio, posted result and reconciliation evidence. Banquets needs
version deltas and acknowledgement by affected departments. Spa needs booking,
provider/room/equipment readiness and restricted form status; detailed form answers
must stay inside the correct role boundary.

On a phone, use a focused task and a reliable back-to-queue path, with a visible
next action that does not cover content. Preserve entered work during orientation,
keyboard and navigation changes where the real command permits drafts. Do not shrink
a desktop table until it merely fits. Watch surfaces should expose brief status and
acknowledgement only where approved; they are not miniature finance screens.

## Feel is also behavior

- Preserve position, selected subject and filter context after a successful action.
- Say “Request sent” before “HK accepted”; say “Cleaning complete” before “Inspected.”
- Show pending, rejected, stale and unknown outcomes explicitly. Network timeout is
  not proof of failure and must not create a new payment or posting attempt.
- Keep a visible receipt with subject, actor/team, time and action. Allow safe draft
  editing; financial corrections remain new governed records.
- Explain a disabled action next to it. Offer a valid recovery path instead of a
  generic error or an invitation to bypass authorization.
- Keyboard shortcuts supplement visible controls. Suppress single-letter shortcuts
  while typing, avoid browser conflicts and restore focus after dialogs/navigation.
- AI may summarize evidence or propose an action; the interface must distinguish
  suggestion from committed result and show the same permissions and approval gates.

## Reusable design-source inventory

| Source | Verified upstream licensing signal | Bounded use in Yellow |
|---|---|---|
| [shadcn/ui source](https://github.com/shadcn-ui/ui) and [license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md) | Repository includes MIT license | Candidate source for adaptable components if a later scoped frontend decision selects its stack; record exact files/revision and retain notices. No package or copied component was added by this research. |
| [Carbon source](https://github.com/carbon-design-system/carbon) and [license](https://github.com/carbon-design-system/carbon/blob/main/LICENSE) | Repository identifies Apache2.0 licensing | Candidate table/accessibility patterns and reviewed source assets. Import only needed pieces with provenance; do not assume IBM branding or every linked asset shares that permission. |
| [Fluent UI source license](https://github.com/microsoft/fluentui/blob/master/LICENSE) | MIT for the named repository's software | Candidate interaction/component source; verify the separate license of any font, icon or referenced asset before copying it. |
| Existing Yellow operator source and design files | Existing project-controlled implementation | Primary implementation starting point. Keep working flows, command boundaries and the six specified appearance families. |

No paid kit was purchased and no third-party design file was imported in this
research change. Reuse should remove duplicated component effort without forcing a
framework replacement or copying another hotel's brand. Public vendor screenshots
remain attributable research references; the planned screens use original Yellow
composition and synthetic hotel content.

## How to decide whether the design works

Run moderated tasks with actual FO, HK, finance, banquets and outlet staff once the
founder provides access to participants. Start with the casebook; counterbalance the
order of compared designs so the second design does not win merely through learning.
Measure correct completion, wrong-target attempts, recovery success, time-on-task,
backtracking, handoff comprehension and perceived effort. Report medians and ranges,
participant count, environment and observed failures. A small formative study finds
problems; it is not statistically representative market validation.

Before any production UI acceptance, test at least: YC-01 arrival/HK loop; YC-02
occupancy discrepancy; YC-09 revised BEO; YC-11 unknown outlet posting with wrong
payer; YC-13 spa prerequisites; YC-16 night audit. Test interruption, loading, empty,
permission-denied, stale and unknown outcomes. Keyboard/screen-reader checks, real
mobile widths, reduced motion and text enlargement accompany visual review.

Performance targets must be set and measured on the intended devices and network.
Track input responsiveness, rendering and domain-command latency separately. Do not
mask slow committed work with a success animation or claim a percentage time saving
before measuring a baseline and the revised flow.

## Visual fidelity and laptop evidence

For a selected design, preserve the original lossless reference and capture its
implementation at the same viewport, state, density, theme, font and browser/OS.
Use the [offline comparator](staff-workbench/compare.html) for strict RGBA differences
and combined visual inspection. Do not resize, hide changing regions or tolerate
mismatches silently to manufacture a zero-difference result.

The current [QA record](staff-workbench/design-qa.md) is blocked on a selected source
visual. The comparator's math passed its two tests, but its browser page was blocked
in this cloud session before it loaded. The [laptop handoff](../../handoff/orders/440-hotel-journeys-and-schema-guide.md#laptop-session-handoff--visual-reference-and-measured-fidelity)
keeps that local verification in the same Codex task. The founder reports a remote
connection; it has not exposed a callable laptop surface here, so dispatch and local
execution are unverified. Do not present a static image or an image-generator mock
as a running app, and do not declare the final experience pixel-perfect without
matched-source evidence.
