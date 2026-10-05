# Order707 — compact mobile menu, hospitality icons and quiet table headers

Founder25September screenshots request smaller phone Workspaces menu, recognizable
arrival/departure/in-house icons and cleaner column headers using Kole Jain cues.
This is a targeted refinement of the accepted neutral design, not another theme.
Public resource catalogue plus existing KOLE interaction/resource audit are the
reference. Preserve information, routes, data, all filters/sorts and accessibility.

Design inventory: existing Workspaces/property/Operate/Business/System labels and
order unchanged; white/neutral-gray surfaces, current Manrope font, 14px phone
navigation labels, 18px outline icons, at least44px touch targets. Reduce padding,
group gaps and wrapper width rather than CSS scale/zoom or hidden destinations.
Latest founder clarification: "scaled down and thinned to the left". Root reduces
the mobile drawer further from builder272px to240px, retaining14px labels/44px
targets. No new right/floating expanded-sidebar capability; existing icon dock
left/bottom drag and saved position must remain unchanged.
Shared hospitality SVGs: door with incoming arrow (arrival), outgoing arrow
(departure), occupied bed (in-house), consistent currentColor rounded strokes.
Column headers: unboxed label + compact direction/priority + filter indicator +
chevron, one full-height accessible trigger. No large nested badge/button blocks.
Keep existing sort precedence, filter rules, menu portals, loading/disabled states,
copy-cell controls, keyboard/focus, mobile drawer modality and reduced motion.

Scope / ownership:
- Menu builder only: frontend/yellow/src/ui/reference-theme.css (mobile navigation
  styles only), tests/order707-mobile-navigation.test.ts; receipt section via root.
- Root only: frontend/yellow/src/ui/HospitalityIcon.tsx (new);
  frontend/yellow/src/workspaces/TodayGlassDashboard.tsx (movement icon prop/render);
  frontend/yellow/src/App.tsx (three movement icon definitions only);
  frontend/yellow/src/styles.css (movement icon/header styles only);
  frontend/yellow/src/ui/TableColumnMenu.tsx (presentation only);
  frontend/yellow/src/ui/table-controls.css (column trigger presentation only);
  tests/order707-hospitality-chrome.test.tsx;
  tests/order694-navigation-table.test.ts (obsolete style assertions only).
- Governance/evidence: this order; handoff/receipts/707-hospitality-chrome.md;
  handoff/reviews/707-hospitality-chrome.md; docs/PROJECT-STATUS.md; handoff/LEDGER.md;
  public/yellow-next/** generated frontend only; D:/Yellow/temp/order707-*.

Root coordinates separate edits; independent non-implementer runs scoped proof.
Compare supplied screenshots and live rendered desktop/390px/320px, menu nested
navigation, icon legibility, pill hover preserved, header sort/filter open/apply/
clear and disabled/keyboard semantics. Actual phone hardware not claimed without
access. Root visual check before release acceptance, app-only cutover with7e00035d
rollback. No backend, reservation/finance mutation, migration, new dependency,
private resource acquisition, full-app redesign or ecosystem-complete claim.
