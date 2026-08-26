# Order 184 — Materially distinct operator skins

**Status:** BUILT — revised product candidate `f55b606`; independent review pending
**Phase:** 5 · founder-visible operations
**Branch:** `phase-5/material-theme-skins`
**Base:** `144753b` (independently approved current local through Order182)
**Risk tier:** 2 — presentation-only system over unchanged governed workflows
**Owner:** Codex implementation; independent UI/accessibility reviewer

## Outcome

Replace the color-only appearance aliases with world-class, materially distinct visual
systems across the existing Yellow operator application. A skin changes surface
material, elevation, geometry, typography, control treatment, density accents and
interaction feedback while one semantic DOM, one workflow and one server authority
remain exact.

## Scope

- `src/http/operator/index.html`, `operator.js` and `operator.css`;
- focused static and browser-facing appearance tests;
- the two inherited operator gzip assertions only to replace their 90 KiB ceiling with
  this order's explicit 96 KiB ceiling; all dependency and same-origin assertions stay;
- this order, additive D-471, `handoff/LEDGER.md`, and independent review;
- after approval only, one app-image replacement on the existing sole loopback3000
  local while retaining the approved Order182 database and credentials.

No API, route, query, domain command, schema, migration, permission, seed/data,
credential, external font/asset/dependency, local storage authority, second local,
public bind, unfinished Order183 code, merge, push or production deployment is in
scope.

## Required skins

Keep Yellow Ops and implement original Yellow interpretations of: Apple iOS material,
macOS desktop, Windows 95/98 classic, Windows XP Luna, Windows 11 Fluent, Android
Material Expressive, Linux workstation, pure Glassmorphism, accessible Neumorphism,
premium Skeuomorphism, Claymorphism, Aurora, fintech precision, warm hospitality and
playful momentum. Platform/product names are descriptive inspiration only; no copied
asset, logo, source or pixel-identical interface is permitted.

## Material contract

1. Every named skin changes at least five observable dimensions among typography,
   radius/geometry, border construction, elevation/shadow, translucency/texture,
   control resting/pressed state, navigation material, spacing/density accent and
   meaningful motion. A palette-only variant fails.
2. Classic uses outset buttons and inset fields; XP uses glossy depth and rounded Luna
   controls; Fluent uses Mica/Acrylic-style layering; Glass uses layered translucent
   surfaces, backdrop blur, highlight edges and atmospheric depth with a legible
   no-backdrop-filter fallback.
3. Neumorphism uses contrasting dual light/dark elevation plus inset controls without
   sacrificing 4.5:1 text or visible focus. Skeuomorphism uses restrained tactile
   material/engraved depth without external textures. Clay uses thick soft borders,
   inner/outer shadows and tactile press feedback. Aurora motion is ambient only and
   completely disabled under reduced motion.
4. Apple glass is reserved for navigation/control layers while content remains legible;
   Material, fintech, hospitality and playful variants retain their own geometry,
   hierarchy and interaction language rather than brand-color mimicry.
5. Theme switching preserves property, route, active workflow, drafts, API results and
   focus. Themes never alter DOM order, visibility, request data, permissions or server
   behavior and are never persisted as business authority.
6. All skins preserve 44px targets, keyboard operation, visible focus, non-colour
   statuses, 4.5:1 body contrast, reduced motion, 200% zoom and zero root overflow at
   375/768/1024/1440. Unsupported CSS features degrade to solid accessible surfaces.
7. Combined operator HTML/CSS/JS remains dependency-free, same-origin and at or below
   96 KiB gzip. D-472 explicitly supersedes only the prior 90 KiB numeric ceiling to
   carry fifteen real material systems; it does not permit external assets or code.

## Proof

- exact static contract proving every allowed skin and multiple non-colour material
  properties per skin, safe fallback and no external assets;
- real browser computed-style and screenshot matrix at representative desktop/mobile
  widths proving materials differ beyond color and preserve layout/focus/state;
- contrast, forced-colors, reduced-motion, no-backdrop-filter fallback, 200% zoom,
  44px target and overflow checks;
- existing adaptive/reservation/folio/status suites, full standing tests, typecheck,
  boundaries, licences, audit, gzip and fresh referee 11/11;
- independent non-implementing reviewer personally executes the visual/accessibility
  matrix before the sole local is replaced.

## Revised founder-reference evidence

- The founder's 16 screenshots are visual references only. No artwork, asset, logo,
  source or pixel-identical layout was copied.
- The candidate now changes desktop composition as well as material: horizontal
  content-first shelves, framed desktop windows, classic/XP task panes, Fluent and
  glass rails, asymmetric bento grids, editorial Yellow hierarchy and tactile
  Neo/Skeuo/Clay spacing all remain one ordered semantic DOM.
- Root browser preflight rendered the working-tree stylesheet over the unchanged sole
  local page without starting another app. Glass, Windows95 and Yellow screenshots
  are visibly different; the 16-skin 375px matrix has zero root overflow and 44px
  minimum visible controls. This is builder evidence, not independent approval.
- Focused 35/0 with 1,033 assertions, standing 241/0 with 481 database-skipped,
  typecheck, 66-file boundaries, 23-package licence policy and audit pass. Combined
  operator gzip is 97,814/98,304 bytes.

## Definition of done

- [x] Every offered skin is materially and compositionally distinct, not a color alias.
- [ ] Existing hotel workflows remain exact in every skin.
- [ ] Accessibility, responsive, performance and fallback gates pass.
- [ ] Independent review approves the exact candidate.
- [ ] The approved candidate is the only app on loopback3000 with the Order182 data.
