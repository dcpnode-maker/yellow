# Yellow interface atlas

## Current direction — 2026-09-05, Orders433/440

The founder now explicitly requires **different hotel and STR workspaces**, with
PriceLabs informing STR revenue workflows and Beds24/other PMSs informing operations.
See [staff journeys](design/STAFF-JOURNEYS.md), [feature IDs](FEATURE-REGISTER.md) and
[regional packs](architecture/REGIONAL-PACKS.md). One domain core does not require
identical screen arrangements. Property experience, visual material, locale and
authorization are independent dimensions.

The [Order440 staff workbench](design/STAFF-WORKBENCH-SPEC.md) is a concrete
interaction study grounded in the existing operator's workflows. Order442 refines
its materials with the founder-selected profile reference and adds three selectable
skins: Calm Workbench, Precision Desk and Service Timeline.
Desktop keeps the work queue beside its context; phone presents one focused task.
Its [research](research/HOTEL-OPERATIONS-REVIEW.md) and
[casebook](design/HOTEL-CASEBOOK.md) make ownership, acknowledgement, freshness,
privacy and guest follow-up part of visual acceptance. This prototype implements
three compositions for review; it does not retire any of the six production
appearances or claim new live modules. Portrait cards belong to guest and
staff/management identities. Generated portraits appear only in the fictional study;
production uses its existing authorized identity content. The new visual acceptance
gate remains blocked pending an authorized rendered capture, as [recorded](../design-qa.md).

For the next scoped redesign, replace the global Simple/Advanced/Expert selector
with contextual progressive disclosure and role-aware next actions. Preserve six
dedicated appearances: Apple, Android/Pixel, Win95/98, Glass, Neo and ERP. The founder's
supplied visual/video references below remain design provenance, not proof of a
pixel-exact native implementation or permission to redistribute third-party assets.

Each workspace has coherent semantic reading/focus order; appearance changes preserve
the active task, values and authorization but may use different responsive composition.
The older requirement for identical DOM/layout across every experience is not the
new product intent. Material authenticity needs actual visual/interaction evidence.

Order195 defined six appearances and retired the prior 98,304-byte cap through
D-526. Its three-detail-mode and cap criteria below are historical evidence, not the
new desired design ceiling.
Future implementation must explicitly reconcile the affected executable tests and
budgets in its own scope: measure first-use bytes, frame/interaction latency, memory
and accessibility; load optional 3D, voice and locale assets on demand. Do not silently
remove a gate, lower contrast, hide unsupported states or call extra payload harmless.
This documentation does not change the running UI or existing executable gates.

## Historical Order195 contract and reference provenance

**Status:** Order 195 implementation contract · D-493–D-526
**Catalogue:** Apple iOS · Android 17 / native Pixel · Windows 95/98 ·
Glassmorphism · Neomorphism · Enterprise ERP
**Default:** Apple iOS  
**Historical constraints:** the same authenticated Yellow application, server truth,
ordered semantic DOM and global detail selector in every appearance. These are
retained for existing review evidence only; they are not the new desired UX.

This document turns the founder's visual references into implementable rules. It is
not a mood board and it does not authorize one shared layout with superficial skins
over six dedicated appearances.
Each appearance is a complete composition, control, depth, state and motion system.
The workflows, values, permissions, URLs, focus order, idempotency and financial truth
remain identical.

## Non-negotiable product principles

1. **Truth before theatre.** Animation explains navigation, grouping or consequence.
   It never invents state, conceals a wait or makes a financial result look committed
   before the server confirms it.
2. **One task, one clear next action.** Dense expert information may surround the
   task, but hierarchy must still answer: where am I, what changed and what can I do?
3. **Native, not costume.** Apple and Android follow their platform interaction
   grammar; Windows follows classic desktop grammar; Glass and Neo have coherent
   physical models; ERP owns a dense analytic composition. Logos, wallpapers, fonts,
   icons and proprietary artwork are not
   copied.
4. **Depth has meaning.** Z depth distinguishes universe, navigation, current work,
   preview and irreversible confirmation. Decorative floating cards are forbidden.
5. **Motion has continuity.** The object the operator acts on is the object that moves.
   A folio tab becomes its workspace; selected charges become the transfer review.
6. **Still usable without effects.** Reduced motion, forced colours, coarse pointer,
   no backdrop filter and unsupported View Transitions all retain complete workflows.
7. **Fast by construction.** Routine motion uses transform and opacity, never animated
   blur or layout. No external runtime asset, WebGL scene or UI dependency is presumed.

## Evidence map

### Founder-supplied screenshots

The supplied 16 screenshots are observation evidence and are not duplicated in this
repository. They contribute these reusable ideas:

| Reference cluster | Keep | Do not copy |
| --- | --- | --- |
| Paperpillar “Sense” | quiet ambient field, large soft work zones, translucent local grouping, reduced visible chrome | imagery, brand, exact card grid |
| Gleb Kuznetsov “Sam” | a stable environmental stage, one confident central work surface, spatial entrance | Windows wallpaper, Cyft branding or exact panel |
| RonDesignLab “Synthex” | strong editorial hierarchy, consolidated metrics, depth-of-field emphasis, restrained controls | imagery, project copy, exact dashboard arrangement |
| Flexy call analytics | dense operator surface with one primary canvas, secondary evidence rail and deliberate green action | branding, exact analytics panels |
| Outcrowd / Halo Lab | precise white work surfaces, modular information density, clear mode selectors | exact widgets, charts or composition |
| UI8 Neo examples | coherent raised/pressed states from one light source | portraits, exact cards, shadow-only semantics |
| dark industrial examples | high-information contrast and instrument-like focus | cinematic assets or ornamental game HUD |

Attributable public pages found from the screenshots:

- [Synthex UI — Analytics SaaS Dashboard](https://dribbble.com/shots/27131881-Synthex-UI-Analytics-SaaS-Dashboard)
- [Paperpillar work, including Sense](https://dribbble.com/paperpillar/shots)
- [Flexy LLC work](https://dribbble.com/flexyglobal/)

These links are visual provenance only. Yellow must make an original hotel-operations
composition and use its own assets, copy, data hierarchy and interaction model.

### Founder-supplied motion references

The two local videos were inspected through timestamped contact sheets. They remain
outside the repository.

#### Reference A · `62f9a42c4397d23187273b0ea6b97f28.mp4` · 26.5 seconds

- **0–4 s:** a stable environmental scene frames one translucent sign-in surface.
- **4–11 s:** the same surface widens and re-composes into setup; the universe does not
  jump, so the user retains location.
- **11–18 s:** content transforms inside the established object rather than replacing
  the whole page.
- **18–26.5 s:** the object resolves into a more information-dense dashboard while
  retaining spatial lineage.

Yellow application: authentication, property choice and the operational shell share
one stable scene. The current work plane may expand, split or settle, but navigation
and logical focus retain continuity.

#### Reference B · `dcf41d2cd5eb1ee968e0bad265fb3013.mp4` · 13.9 seconds

- **0–3 s:** bright file tabs sit in an ordered dark stack.
- **3–8 s:** the selected file rises, enlarges and becomes a readable document.
- **8–11 s:** highlighted fragments act as anchors inside that document.
- **11–13.9 s:** returning restores the exact stack and selected position.

Yellow application: sibling folio windows form a named, ordered stack. Activating a
window lifts it into the work plane. Selecting charge groups lifts those exact rows
into an organize review. Back/Escape returns them to their original positions without
losing selection, draft or focus.

## Shared spatial model

Every appearance expresses the same five semantic planes:

| Plane | Token | Meaning | Permitted content |
| --- | ---: | --- | --- |
| Ambient universe | 0 | property context and environmental identity | noninteractive field only |
| Content truth | 10 | board, statement, factual tables | server-derived information |
| Navigation | 20 | property, module, folio-window movement | bounded navigation controls |
| Workbench | 30 | active create, charge or organize task | editable draft and validation |
| Review / critical | 40 / 50 | derived preview, acknowledgement, correction warning | server preview and explicit commit |

No component invents a z-index outside this scale. A higher plane must represent a
stronger decision, not merely look more expensive.

## The 3D folio workflow

### 1. Enter the stay universe

The selected property establishes the stable ambient shell. Reservation and folio
context enter inside it. On smaller screens, navigation compresses into the platform's
native bottom or compact model; the work does not become a scaled desktop.

### 2. Open the folio stack

Sibling windows appear as an ordered file/tab stack with number, name, reference,
status and exact balance. The active window occupies the work plane. Its tab and panel
share a visible anchor so activation reads as one object changing depth.

### 3. Lift whole charge groups

“Organize charges” moves selected server-owned groups 8–16 px toward the viewer while
unselected rows remain in the content plane. Correction companions move as one bound
object. The browser never builds a group or calculates money.

### 4. Bridge source and destination

The preview creates a bounded two-sided bridge: source before/after on the leading
side, destination before/after on the receiving side, and unchanged stay total as the
fixed centre. A newly named window first appears as an outlined destination slot; it
does not look real until the server accepts the operation.

### 5. Commit, settle, or reject

- Pending: selected objects hold position; no money count animates optimistically.
- Success: the bridge settles toward the destination, then server truth refreshes and
  logical focus lands on that window.
- Validation or conflict: objects return to the source anchor; invalid control and
  global live region receive the exact error.
- Network uncertainty: objects remain in review with the same idempotency key and a
  clear retry action.

### 6. Reverse direction without rewriting history

Re-routing repeats the same choreography with a new immutable transfer. Correction
uses a paired contra visual, never deletion, strike-through disappearance or an edit
animation.

## Motion grammar

| Duration | Use |
| ---: | --- |
| 90 ms | pressed/released feedback, classic Windows immediate state ceiling |
| 150 ms | hover/focus/state-layer response |
| 220 ms | local panel and tab continuity |
| 280 ms | workbench lift/settle and predictive-back continuity |
| 400 ms maximum | one deliberate spatial hero transition |

- Every animation is interruptible and converges to current application state.
- Routine properties are `transform` and `opacity` only.
- Backdrop blur, shadows, gradients and layout are settled styles, not animated values.
- `will-change` may exist only for the duration of an imminent transition.
- Reduced motion replaces spatial travel with a maximum 100 ms crossfade or immediate
  state change.
- Forced colours removes material effects and uses system colours/borders.
- Coarse pointer removes pointer parallax and hover-only information.
- No supported transition may create a task over 50 ms; measured target is 60 fps on
  the founder laptop.

## Appearance 1 · Apple iOS

### Signature

Content-first, quiet and precise. A large contextual title compresses into compact
navigation as content moves. Controls float only where navigation or action requires
them; financial content stays on legible standard material.

### Composition

- Compact top context plus adaptive side/bottom navigation, never a permanent generic
  ERP rail.
- Grouped/inset content sections with strong whitespace and full-width list rhythm.
- Folio windows use a segmented/file-strip navigator; the active window becomes a
  spatial sheet on compact screens and a calm adjacent work plane on wide screens.
- The primary action lives in the reachable lower/middle action region on touch.

### Controls and states

- System font stack, optical size hierarchy and tabular numerals for money.
- 44 px minimum controls; icon-only controls have labels and platform-like circular or
  capsule hit regions.
- Tactile scale/opacity press state, restrained tint, clear destructive red and an
  externally visible keyboard focus ring.
- Lists and forms use native-feeling grouped rows; avoid a dashboard of identical
  rounded cards.

### Material and motion

- “Liquid glass” is limited to navigation/action layers above content. Tables, review
  values and errors use opaque or near-opaque material.
- Spring-like travel is bounded by the shared timing ceiling and becomes crossfade
  under reduced motion.
- Sheet-to-workbench continuity follows the selected folio anchor.

Platform basis:
[Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/),
[Materials](https://developer.apple.com/design/human-interface-guidelines/materials),
[Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios).

## Appearance 2 · Android 17 / native Pixel

### Signature

Edge-to-edge, adaptive and expressive. Information is grouped by deliberate shape,
tonal hierarchy and state layers. It must read as a current Pixel product, not Apple
with different colours.

### Composition

- Edge-to-edge content with safe insets.
- Bottom navigation on compact, navigation rail on medium and structured persistent
  navigation only when expanded width warrants it.
- A focused top app bar and contextual floating/contained action area replace the
  Apple large-title sheet model.
- Folio windows become expressive shaped tabs/chips on compact and an adaptive rail
  beside the active statement on wide screens.

### Controls and states

- 48 dp minimum touch controls, tonal filled/outlined/text hierarchy and visible
  hover/focus/pressed/dragged state layers.
- Purposeful shape families distinguish navigation, editable work and critical review;
  not every surface is a rounded rectangle.
- Money and dense ledger content remain aligned, calm and opaque.
- Predictive Back previews the previous workspace state without committing navigation.

### Motion

- Emphasized deceleration for entry, standard acceleration for exit, container
  transforms for selected-window continuity and bounded expressive moments only at
  meaningful task boundaries.
- No perpetual elastic/bouncy ornament.

Platform basis:
[Android 17](https://developer.android.com/about/versions/17),
[adaptive layouts](https://developer.android.com/develop/ui/compose/layouts/adaptive),
[Material 3](https://m3.material.io/).

## Appearance 3 · Windows 95/98

### Signature

An authentic operator desktop: compact, explicit, immediate and information dense.
It is not modern cards with square corners.

### Composition

- Application title bar, menu strip, client work area, classic status bar and bottom
  taskbar/start affordance.
- Folio windows are real-looking MDI child windows with title bars, active/inactive
  distinction and ordered overlap or tiling.
- Statement, Add charge and Organize charges behave like child tools inside the main
  application frame; wide layouts may tile source and destination.

### Controls and states

- System-grey surfaces, exact light/highlight and dark/shadow bevel pairs, square
  buttons, inset fields, compact menus, scrollbar grammar and pressed pixels.
- Dotted keyboard focus is mandatory and never relies on colour.
- Status and error messages occupy explicit status/message regions.
- Minimum hit-area contract remains even when the visible classic control is compact.

### Motion

- Immediate state changes; no easing, blur, parallax, elastic travel or glass.
- Window opening may use one ≤90 ms visibility/position transition only when it does
  not undermine the classic response.

## Appearance 4 · Glassmorphism

### Signature

A luminous spatial environment with refractive hierarchy. Blur supports the system;
it is not the system.

### Composition

- One original Yellow ambient field establishes depth without an external wallpaper.
- A stable translucent shell holds property and module context.
- Navigation, content, workbench and critical review occupy visibly distinct planes.
- Folio windows behave like layered glass files; the selected plane catches edge light
  and becomes the sharpest object.

### Material

- Every glass surface specifies opacity, saturation, blur, border light and shadow for
  its semantic plane. Adjacent planes cannot share the same recipe.
- Specular edges follow one coherent light direction.
- Ledger tables, form labels, money, errors and commit review sit on dense/opaque glass
  sufficient for contrast under every background position.
- Ambient gradients may move only as part of a bounded transition; animated blur and
  never-ending blobs are forbidden.

### Interaction

- Fine-pointer intent may produce a maximum 2°/6 px local parallax on the active plane.
  It resets immediately on pointer exit and is absent on coarse pointer/reduced motion.
- Window-to-document and charge-to-review continuity follows the two reference videos.
- Without backdrop support, layers become original solid translucent-colour fallbacks
  with borders; hierarchy must remain obvious.

## Appearance 5 · Neomorphism

### Signature

A calm tactile instrument panel built from one coherent virtual material and one light
source. Depth communicates affordance and state; shadows never replace semantics.

### Composition

- The page is a continuous low-chroma work surface, not a stack of floating white
  cards.
- Raised command clusters hold primary tasks; inset wells hold data entry and selected
  destinations; statement regions remain flatter for sustained reading.
- Folio tabs are raised keys; the selected key depresses while its workspace rises.

### Physical rules

- One global light vector defines paired light/dark shadows everywhere.
- Resting button: convex/raised. Pressed or selected: inset/concave. Input: inset well.
  Disabled: flattened with explicit border/text change. Error: border/icon/message, not
  red shadow alone. Focus: high-contrast ring outside the material shadow.
- Radius, elevation and shadow spread vary by semantic level, not component whim.
- Money tables use visible dividers and sufficient text/background contrast.

### Motion

- Press depth changes over 90–150 ms; workbench planes lift/settle over 220–280 ms.
- No springy gel, breathing shadows or endless surface animation.
- Forced colours removes shadows entirely and preserves bordered semantic states.

## Appearance 6 · Enterprise ERP

### Signature

A restrained, information-dense hotel command system for users who prefer conventional
enterprise scanning speed. It combines a compact dark module rail, a narrow command
bar, dense evidence tables and clear analytic summaries without becoming the shared
layout underneath the other dedicated appearances.

### Composition

- Persistent compact left rail; the active module is unmistakable without expanding
  or reflowing the workbench.
- Page title, filters and one primary command share a bounded command row.
- KPI and operational summaries use asymmetric bento spans only when they improve
  scanning; transaction tables remain aligned and compact.
- Drill-downs preserve the list/filter context and open beside or above the active
  evidence rather than replacing the entire application shell.
- Existing room/unit/space truth may gain a CSS-perspective spatial navigator, with
  list/table parity always available. It never invents geometry or owns configuration.

### Evidence interpretation

- [ERP Dashboard Free Sketch Resource](https://dribbble.com/shots/16273394-ERP-Dashboard-Free-Sketch-Resource)
  contributes compact rail, blue action hierarchy and dense summary rhythm.
- [Fashion & Lifestyle Trade ERP SaaS](https://dribbble.com/shots/25657982-Fashion-Lifestyle-Trade-ERP-Saas)
  contributes restrained monochrome hierarchy and the balance of simplicity with
  complex operational access.
- [3D Apartment Interactive Experience](https://dribbble.com/shots/27682972-3D-Apartment-Interactive-Experience)
  contributes spatial selection and list-to-detail continuity for room configuration.
- [Glass UI Kit](https://dribbble.com/shots/23435614-Glass-UI-Kit) contributes luminous
  environment, dark navigation glass, specular edges and multiple optical planes.

These are attributable references, not executable authority or copied assets/layouts.

## Structural signature test

Before colour is considered, a reviewer must identify every appearance from a settled
greyscale screenshot:

| Appearance | Unmistakable structure |
| --- | --- |
| Apple | content-first grouped planes, compressing title, spatial sheet/action layer |
| Android | edge-to-edge adaptive bar/rail, expressive shape containment, state layers |
| Windows 95/98 | title/menu/status/task bars, MDI windows, bevels and dotted focus |
| Glass | ambient universe, refractive shell and separated specular depth planes |
| Neo | continuous tactile surface, raised commands, inset wells and physical selection |
| ERP | compact dark rail, bounded command row, dense evidence table and analytic bento |

Failure means the implementation is a palette alias and is rejected.

## Responsive behavior

- **375:** one primary work plane; platform-native compact navigation; source and
  destination review sequence vertically; no horizontal root overflow.
- **768:** compact/medium adaptive navigation and two-column review where content fits.
- **1024:** window navigator and active statement coexist; critical review remains
  bounded and readable.
- **1440:** expert density may expose secondary evidence, but line length, scanning
  order and primary action remain controlled.
- **200% zoom:** equivalent to a narrow viewport; no clipped task, hidden error or
  focus loss.

The design supports touch, keyboard and pointer equally. Dragging may accelerate group
selection but never becomes the only route.

## State catalogue

Every appearance must have intentional rendering for:

- loading without layout jumps;
- empty account, empty window and no transferable groups;
- partial read failure versus write failure;
- validation, stale preview, permission denial and sealed-day denial;
- pending/retry with stable idempotency;
- success with server refresh and focus restoration;
- disabled and unavailable actions with a reason;
- dirty draft exit guard;
- signed-out and expired authentication.

No appearance may hide a state because its material treatment is inconvenient.

## Historical accessibility and performance acceptance

The following Order195 acceptance bullets preserve existing review evidence and
executable gates. They do not require the new contextual-disclosure UX to use one
global selector or identical semantic DOM/layout across all appearances.

- One ordered semantic DOM; visual reordering never changes reading or focus order.
- WCAG text/non-text contrast, visible focus, landmark/name/state correctness and live
  announcements in settled and fallback modes.
- 44 px minimum targets everywhere; Android uses 48 dp-equivalent touch targets.
- Zero root overflow at 375/768/1024/1440 and at 200% reflow equivalent.
- Exact route/property/window/draft/selection/destination/preview/idempotency/focus
  preservation across appearance changes.
- Zero runtime/console/request errors during the authenticated founder journey.
- Six appearances × the historical Simple/Advanced/Expert settled screenshots plus recorded active
  transitions, reduced motion, forced colours and no-backdrop proof.
- D-526's combined operator HTML/CSS/JavaScript gzip cap of 98,304 bytes is RETIRED
  for the new direction; any replacement budget must be measured and separately approved.
- No dependency, external font, external icon pack, telemetry or copied media.

## Implementation review checklist

- [ ] Each appearance changes composition, controls, depth, state and motion.
- [ ] Greyscale structural-signature test passes six out of six.
- [ ] The 3D folio flow operates on exact semantic elements, not a mock overlay.
- [ ] Financial values remain server-rendered strings; no optimistic money math.
- [ ] Every transition is interruptible and state-preserving.
- [ ] Reduced-motion, coarse-pointer, forced-colour and no-backdrop modes are complete.
- [ ] Full keyboard journey works, including roving folio tabs and focus restoration.
- [ ] Real authenticated browser evidence passes all target viewports and detail modes.
- [ ] Asset ceiling, typecheck, boundaries, licences, audit and protected hashes pass.
- [ ] Independent non-implementing Tier-3 reviewer executes the complete proof.
