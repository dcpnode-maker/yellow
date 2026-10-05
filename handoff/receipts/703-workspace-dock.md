# Order703 — repositionable collapsed workspace ribbon

25September2026. Implementer reservation_workspace_research; root completed the
visible tooltip portal after freezing the builder's files. Independent reviewer
order679_independent_review did not implement. Single existing app only.

Collapsed navigation keeps all10top-level destinations in either a vertical left
ribbon or horizontal bottom dock. Long strips scroll; full-menu and property
selection remain. Default desktop left/mobile bottom unless a valid saved choice
exists. Dedicated44px grip supports pointer capture, thresholded drag, left/bottom
snap, Escape/cancel, best-effort preference save and click/keyboard alternative.
Locked callbacks remain guarded; no business route or authorization is added.

Review found obsolete extracted-component tests, redundant drag state notification,
post-cancel click risk and clipped labels. Handler/tests fixed; root rendered
visible explanations through document.body outside scrolling strips, with bounded
viewport positions, hover/focus, resize/scroll clearing and accessible descriptions.
Left main inset prevents content under the bar. Motion respects reduced preference.

Root combined702/703+694/696/700:24pass/0fail,199assertions; full typecheck and Vite
535module build passed. Boundary208 and licence120 passed earlier this turn.
Image ba4633c0fca6d70462fecc9393c22fdb2879e738f1d98862b57cbd6c2554513f
contains only generated frontend overlay on previous7c28921d. Independent source
review is approved in handoff/reviews/703-workspace-dock.md. No DB/backend change.

## Root live verification and release

- Recreated only the existing app service; database, cache and tunnel were not
  restarted. Previous image retained as yellow-public-demo-app:before-orders702-703.
- Desktop1280px: collapsed left ribbon contains all10 destinations, main content
  inset64px. Actual hover displayed the Reservations explanation outside the
  scroll strip without clipping. Physical grip drag moved left to bottom.
- Escape during a reverse drag kept bottom placement and did not navigate.
  Keyboard Enter toggled back to left; reload retained the saved preference.
- Responsive390px: grip click alternative moved bar to bottom. All10 destinations
  remained in the horizontally scrollable strip; keyboard focus reached the last
  destination without navigating. Drawer opening hid the dock and closing restored
  it. Reservations navigation and draft open/close worked. No reservation submitted.
- DOM measurements confirmed no document-width overflow. Root inspected desktop
  and responsive screenshots at D:/Yellow/temp/order703-live-left-desktop.png and
  order703-live-bottom-phone.png. The browser screenshot helper initially scaled
  the phone-width capture incorrectly; a clipped CDP capture was used for visual
  inspection. Temporary viewport/emulation overrides were cleared; QA tab closed.
- Browser error log empty. App container healthy, local/public health200, read-only
  database query returned101migration entries. Inherited readiness503/missing build
  revision is not resolved by this frontend release.
- Native touch injection is unsupported by the current browser backend. Source
  pointer/cancel tests and real mouse/keyboard/click checks pass; physical Android
  drag is not verified. No full ecosystem, calendar or mobile-app completion claim.
