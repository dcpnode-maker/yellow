# Order 185 — Founder five-skin curation

**Status:** IN PROGRESS
**Phase:** 5 · founder-visible operations
**Branch:** `phase-5/folio-charge-correction-resumed`
**Base:** independently approved and locally promoted Order184 plus resumed Order183 checkpoint
**Risk tier:** 2 — presentation-only curation over unchanged governed workflows
**Owner:** Codex implementation; independent UI/accessibility reviewer

## Outcome

Replace the sixteen-skin catalogue with the founder's exact five-skin product set:
Apple iOS, latest Android, Windows 95/98, Neumorphism and Glassmorphism. Each remains
one original Yellow interpretation of the supplied visual references, changing layout,
surface, depth, controls, typography, spacing and interaction material—not only color.

## Scope

- `src/http/operator/index.html`, `operator.css` and `operator.js` appearance catalogue;
- Order176/184 material, accessibility, responsive and asset tests;
- this order, Question170 resolution, additive decision/ledger and independent review.

No workflow, API, route, data, permission, schema, migration, financial authority,
dependency, external asset/font, copied logo/artwork, second local, public bind, merge,
push, production deployment or active-local replacement is in scope.

## Design contract

1. The selector exposes exactly `apple`, `android`, `win95`, `neo`, `glass`; Apple is
   the safe default. Removed names fail closed to Apple and are absent from source.
2. Apple uses an airy content-first bento/shelf grammar, system typography, controlled
   translucency, large continuous radii and restrained iOS-like elevation.
3. Android uses current Material 3/Material You tonal surfaces, 48px controls, pill
   actions/chips, 28px containers, state layers and emphasized easing without external
   fonts/assets.
4. Windows 95/98 uses exact classic grey chrome, navy title/navigation, outset buttons,
   inset fields/panels, square geometry and dotted/yellow focus without sacrificing AA.
5. Neumorphism uses one cool-clay canvas, accessible dark text, dual light/dark convex
   surfaces and inset controls with explicit focus. Glassmorphism uses atmospheric
   depth, genuinely translucent layered surfaces, highlight borders and native blur
   plus an opaque readable fallback.
6. All five preserve one DOM/order/workflow, 44px minimum targets (48px Android),
   keyboard/focus/state, reduced motion, forced colours, 200% reflow, no root overflow
   at 375/768/1024/1440 and combined assets at or below 96 KiB gzip.
7. References are visual direction only. Yellow does not copy Dribbble chrome, logos,
   people, artwork, brand identity or pixel-identical third-party layouts.

## Proof

- exact five-value catalogue/allowlist and absence of every retired value;
- five complete non-colour material vectors and five unique computed layout signatures;
- representative authenticated real-browser screenshots and computed proof at all
  widths, 200% reflow, keyboard/focus/state, motion, forced colours and Glass fallback;
- existing operator/Order183 workflows, standing tests, typecheck, boundaries,
  licences, audit and unchanged 96 KiB ceiling.

## Definition of done

- [ ] Exactly five founder-selected skins are offered.
- [ ] Each visibly matches its named material/layout language rather than a palette.
- [ ] Accessibility, responsive, state and asset gates pass.
- [ ] Independent UI/browser reviewer approves the exact candidate.

