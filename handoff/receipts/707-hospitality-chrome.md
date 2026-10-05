# Order707 — compact left navigation and hospitality chrome

Delivered2026-09-25 by root with compact_mobile_menu implementing only the mobile
CSS/test and movement_hover_review independently reviewing/executing proof.
Founder final clarification: sidebar left; only icon bar movable. No new expanded
sidebar docking capability, backend behavior, hotel-data write or dependency.

## Changes and checks

- Phone drawer300->240px; heading18->16px, labels15->14px, icons21->18px,
  targets46->44px. Smaller spacing, not CSS zoom; all10destinations retained.
- Original rounded-stroke SVG door-in/door-out/occupied-bed replaces small Today
  text glyphs;20px desktop and16px phone with visible labels.
- Full-width quiet column triggers,12px sort arrow/10px priority. Root fixed
  `.movement-grid-head span` to direct children so nested indicators no longer
  inherit cell padding. Existing filters/sorts/copy/keyboard contracts unchanged.
- Independent final26pass/0fail/247assertions across707/694/702/706/703; full
  typecheck and208boundaries passed. Root Vite536modules passed, inherited large
  map-chunk warning remains. Review707 records source identities and limitations.

## Actual public browser acceptance

Using the current public tunnel and owned QA tab, no hotel mutation:

1. Before:390px viewport, drawer300px, heading18px, ten labels15px/icons21px,
   targets46px. After:drawer240px, heading16px, labels14px/icons18px, targets44px.
   At320px viewport drawer remained240px with document width320px. Both nested
   groups expanded:15 parent/child buttons44px high, drawer scrolled935px content
   within740px viewport. Current property menu showed both existing properties.
   Escape closed drawer. No horizontal page overflow observed in these states.
2. Icon dock activation moved bottom->left; actual mouse drag of handle from
   left to bottom succeeded. Original bottom preference restored. No native
   Android touch injection available; physical phone gestures not claimed.
3. Today mobile icons all visible16px; focus moved capsule. Desktop1280px icons
   all20px; actual pointer hover on Departures produced matching pill/button x
   514.325px and transform translateX236.125px. Arrival click opened14-row table.
4. Guest header descending then ascending updated accessible sort direction;
   Enter opened menu. Contains Priya applied:Showing1of14. Clear restored14of14.
   Header trigger44px; nested status18px high,18.6px wide,padding0. Menu's empty
   filter clear control remained disabled. No reservation or financial write.

## Five-point design fidelity check

Compared supplied mobile-menu and table screenshots, rendered output and Kole's
public sidebar/dashboard previews from https://www.kolejain.com/resources.
Public references: /images/uploads/Base.webp and
/images/uploads/Frame%201411068005.webp on that domain. No gated assets imported.

1. **Geometry:** pass for requested slimmer left drawer,20% narrower, no invented
   right/floating panel. Same accepted app shell and disclosure arrangement.
2. **Density:** pass; smaller typography/icons and gaps while preserving44px
   controls. Long property name wraps rather than disappearing.
3. **Hierarchy:** pass; Operate/Business/System and nested reservation/housekeeping
   containers preserved, all entries available within scrollable drawer.
4. **Icon/table detail:** pass; consistent original outlines; quiet tiny sort
   indicators replace large nested badges. Existing neutral palette retained;
   public dark dashboard was density inspiration, not a theme replacement.
5. **Interaction:** pass for actual browser keyboard/click/mouse-drag/hover and
   header apply/clear; native phone touch remains unverified. No full-app fidelity
   or exact-copy claim. Other historical ecosystem requests remain open.

Screenshots personally viewed: D:/Yellow/temp/order707-before-menu.png,
order707-after-menu.png, order707-after-headers.png, order707-after-desktop.png;
public reference previews order707-kole-sidebar.webp/order707-kole-dashboard.webp.
IAB capture has host zoom/clip scaling, so CSS viewport/geometry measurements are
the responsive evidence, not a pixel-exact physical phone comparison.

## Release

Only generated frontend overlaid on706app image; no new app stack or DB change.
App-only compose recreation with --no-deps --no-build. Serving image
sha256:4e91a976d7a16f407fd03d912cda8451555c231fa3fb028450c95ca9d94d1ec3.
Rollback706image retained as yellow-public-demo-app:before-order707.
Container healthy; local/public /health200; read-only schema_migration count101.
Inherited readiness build_revision_unavailable remains unresolved; not a clean
Git/CI/PR release or full ecosystem completion claim.
Public https://faq-lift-iso-completely.trycloudflare.com/; local http://localhost:3010/.
