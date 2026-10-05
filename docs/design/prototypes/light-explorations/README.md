# Ten light explorations — Order456

These are historical alternative interaction architectures, not production screens.
The founder selected03/04/07/08/09/10 on8 September2026, excluded01/02 and allowed
05/06 as inspiration only. Order458 carries implementation into eight selectable
interfaces; see ../../SELECTABLE-INTERFACES.md. The prototypes retain their original
fictional content and are not evidence that their illustrated functionality exists.

Open `index.html` locally for the gallery. Each concept is a self-contained HTML
mockup with a local demo action and reset. No backend requests, real financial
actions, real guest information, model calls or third-party assets are used.

| Concept | Different organizing principle | Primary question |
|---|---|---|
|01 Atelier|Editorial spread and attention hierarchy|What matters this morning?|
|02 Meridian|Spatial building and room assignment|Which physical room fits this arrival?|
|03 Ledger|Three-pane master/detail financial context|What is booked, known and owed?|
|04 Aura|Layered translucent contextual workspaces|Which working contexts should stay open?|
|05 Dispatch|Departmental queues and handoffs|Who needs to do what next?|
|06 Canvas|Sequential guest journey chapters|What is the next check-in decision?|
|07 Orbit|Command → evidence → proposed action|What can the assistant prepare safely?|
|08 Atlas|Map-first distributed STR portfolio|Which unit needs attention where?|
|09 Focus|Separate mobile role/task compositions|What can this staff member do on a phone?|
|10 Index|Room/date tape with contextual detail|Where does this stay fit without losing context?|

## Design method and boundaries

UI/UX Pro Max supplied accessibility, interaction, motion and typography checks.
Its initial generic brutalist/landing recommendation was not adopted: this is an
operational product. A second enterprise query identified Soft UI Evolution, used
as one input rather than a repeated master layout. Each author owned disjoint
concepts. No prior prototype was recolored or replaced.

Light backgrounds, visible labels/focus, restrained motion and readable content
take priority over decorative effects. Aura and Meridian explore material/spatial
depth; the other concepts intentionally test different operational structures.
Motion respects reduced-motion preferences. No dark variant is supplied because
the founder explicitly excluded it.

## Capture

`bun docs/design/prototypes/light-explorations/capture.ts` uses one installed,
owned headless Chromium and local file URLs. It blocks HTTP(S) assets, captures
1440×1000 initial/interaction screenshots, checks demo/reset states and records
console errors/overflow/resources. A two-digit argument captures one concept.
The exact owned browser profile is removed afterward; no persistent server is
started. Screenshots/receipts live in `.yellow/evidence/light-explorations/`.

These are desktop concept studies with responsive fallbacks, not certified mobile
or accessibility-ready production applications. Focus is a separate phone-oriented
exploration. Browser smoke checks do not establish full usability acceptance,
screen-reader conformance, native-app behavior or any phase completion.

The live app and backend work are unchanged. A selected direction requires its
own production design/implementation scope after founder approval.

## Verified prototype checkpoint

All ten HTML concepts have initial and changed-state screenshots. Their local
action/reset checks pass with no JavaScript exceptions, missing images or remote
HTTP(S) requests. Final individual captures fit 1440×1000; `overview.png` fits
1440×1800. Root visually checked each and corrected several spacing/contrast issues.
See Order456 for exact receipt names. The `overview` capture argument renders the
ten-screen comparison; the normal gallery retains full-size and prototype links.

The selected design directions do not make these prototype files deployed. Controls outside the demonstrated workflow
may be illustrative. Assertions such as occupancy, balances, room readiness and
assistant evidence are fictional presentation content, not queries of hotel data.
