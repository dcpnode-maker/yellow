# Yellow Continuum — approval prototype

One visual direction, not another theme picker. This is a fictional design study
for founder approval under Order444 / Question214. It is not the current app, an
operational check-in, a functioning AI agent, or a completed native mobile app.
No database, hotel API, authentication, speech service or payment connection is
used. The existing local app on port3000 is unchanged.

## Current revision: Luminous

The first dark study was rejected as eye-straining. The current proposal uses
warm ivory, graphite, restrained champagne and sage, a readable ERP task surface
and architectural room depth. The original captures remain design history; new
captures are under `.yellow/evidence/continuum-prototype/luminous/`.

The guest screen now lets the reviewer edit partial sample contact/profile fields
and retain them when navigating. **Preview ID capture** opens editable synthetic
candidate fields and requires a staff-review checkbox before copying them into the
draft. There is no camera access, image upload or OCR engine. Drafts exist only in
page memory, disappear on reload, and must not contain real guest information.

**Preview checks** replays four labelled sample stages: booking/preferences,
guest/guarantee gaps, eight room candidates with five inspected, and a comparison.
It can be stopped. This demonstrates progress presentation, not live AI or an
exhaustive optimization claim. Production must display actual authorized backend
events and warnings, without artificial waiting or fabricated thinking. A sample
guarantee deadline never sends a reminder, charges or cancels a booking.

Actual reservation/profile editing limits were audited separately and recorded in
[the capability inventory](../../BUILT-CAPABILITY-MANIFEST.md). Seeing a field in
this study does not make the production capability built.

## What to judge

- **Desktop:** a spatial room-selection stage, a stable evidence panel and one
  connected guest journey. Depth helps distinguish rooms and the selected guest;
  operational evidence remains upright and readable.
- **Phone:** focused chapters, vertically arranged room choices and reachable
  next/back controls. It is a device-specific composition, not scaled desktop.
- **Motion:** follow Priya from arrival through guest context, room comparison,
  check-in review and an illustrative team handoff. Room choice persists when
  going back. Unready sample rooms cannot advance to review.

Everything about Priya, The Aster, room state, timings and team tasks is sample
data. Recommendations are written examples, not generated intelligence. The
handoff does not claim that a reservation or a financial record was changed.

## Deliverables and reproduction

Ready for founder review: `desktop-arrival.png`, `desktop-guest.png`,
`desktop-processing.png`, `desktop-rooms.png`, `desktop-id-review.png`,
`phone-rooms.png`, `phone-id-review.png` and `continuum-journey.gif` in the
**luminous** evidence subdirectory. Final capture:28 observations, zero runtime
errors; same-origin/font/visible navigation/heading/room containment checks passed.
Draft persistence, staff confirmation, stopped check replay and unready-room
gating passed. Full receipt and exact hashes are in Question214.
The17.717-second recording includes sample ID review, processing checks and an
intentional comparison with room610 and carries that
selection into the illustrative review/handoff. Still screenshots use room608.
The GIF is encoded for presentation, not evidence of a native frame-rate target.

Source: `index.html`, `continuum.css`, `continuum.js` in this directory. There are
no package dependencies, remote runtime scripts, stock images or browser-profile
copies. The existing pinned Urbanist v1.330 font is reused under its retained
SIL Open Font License; other geometry and illustration are original HTML/CSS.

From the active worktree, run with the installed Bun executable:

```text
bun scripts/capture-continuum-prototype.ts
```

Add `--stills` to omit GIF encoding. The script creates one temporary loopback
asset server and one owned headless browser, captures PNGs and an animation GIF
under `.yellow/evidence/continuum-prototype/luminous`, then stops both. It never opens or
modifies the actual hotel application. FFmpeg must already be installed; nothing
is downloaded. Capture profiles and raw frames are removable generated evidence,
not hotel data. Keep the final PNGs, GIF and `capture-proof.json` for review.

The capture checks horizontal containment, same-origin resources, font loading,
selected-room retention, an unready-room guard and a reduced-motion view. These
are prototype checks, not a production acceptance gate or measured performance
claim. User-triggered replay is interruptible; no decorative animation runs
continuously by default. Business integration and native platform behavior need
their own subsequent implementation and tests after approval.

## Design basis and attribution

Original proposal: GPT-5.6 Sol (`spatial_design_direction`); prototype integration,
motion and actual-render inspection: the primary Codex agent. The founder's
September7 one-design/prototype-first directive supersedes the previous three
layout choices. This is a proposal for approval, not a claim that Astra or the
founder has already approved this new appearance.

Research informs principles, not copied source or an endorsement:

- [Apple spatial layout](https://developer.apple.com/design/human-interface-guidelines/spatial-layout/):
  purposeful depth and legible information hierarchy.
- [Material Design](https://m3.material.io/?LanguageId=1): expressive motion and
  adapting the composition to the device.
- [AJ&Smart design sprint practice](https://go.ajsmart.com/remotedesignsprints):
  test a tangible prototype before investing in implementation.

The UI/UX design skill influenced target sizes, visible focus, motion reduction,
device-specific composition and checking actual renders before delivery. Its
generic palette/layout output was not adopted over the founder's art direction.

The same skill informs this refinement's readable contrast, larger input targets,
reduced-motion treatment and review-before-commit pattern. The material change
is task-specific composition and interaction, not adding another selectable skin.
