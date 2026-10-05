# Order700 — compact Today, adjacent creation and collapsed dock

Delivered to the existing single public application on 25 September 2026.
This receipt covers the three reported UI defects, not completion of the entire
Yellow ecosystem or a new reservation/financial state transition.

## What changed

- Removed the duplicate six-metric Today ribbon. The two retained drilldowns
  still show occupancy/sold rooms/capacity and revenue/ADR/RevPAR, including
  loading and unavailable states.
- New reservation sits directly after Individual/Groups/Calendar in the same
  container; it wraps within that container on phones. The five journey phases
  plus All remain available. No draft, submission or navigation guard changed.
- Collapsing the sidebar exposes a centered bottom icon dock: rounded-square
  buttons, current indicator, hover/focus labels, 44px targets, safe-area spacing,
  reduced-motion handling and pointer-only bounded magnification. Opening the
  mobile navigation hides the dock; closing navigation restores it.
- Captured founder requirements in docs/product/FOUNDER-REQUIREMENTS-20260925.md.

## Executed proof

Independent non-implementer order679_independent_review personally ran the
Order700/611/694/696 suites: 14 pass, 0 fail, 118 assertions. See
handoff/reviews/700-compact-shell.md. Root combined Order611/620/684/685/692/694/
696/697/699/700/security-headers run: 47 pass, 1 expected historical native-build
skip, 0 fail, 364 assertions. Whole typecheck, 208-file boundaries and production
frontend build passed. No fresh full-DB referee or clean Git/CI release is claimed
for this UI-only change; no migrations or hotel test writes were performed.

Root used the actual public application in the browser, not only source tests:

- Today has no .today-glass-stat-grid; exactly two performance drilldowns remain.
- Desktop: family ribbon right329.2px, creation control left337.2px, gap8px.
  Dock center632.4px matches the1265px usable document width in1280px viewport.
- Phone390x844: document375px wide, create button x20.8/right153.6 and44px high;
  all six phase controls44px high. Dock x60.8/right314.4/bottom832, within viewport.
- Open phone menu: dialog1/dock0; close: dock1. Dock Reservations navigation works.
- Universal search remains present. No reservation was created merely for QA.

Screenshots personally inspected by root:
D:/Yellow/temp/order700-live-desktop.png and
D:/Yellow/temp/order700-live-phone.png.

Reference fidelity checks: (1) neutral gray shared container; (2) white selected
capsule; (3) creation visually grouped with reservation family; (4) consistent
compact spacing; (5) responsive vertical menu/bottom dock without horizontal
overflow. This adapts the founder's supplied ribbon reference, not a claim that
all creator resources or every page of Yellow have been implemented.

## Release and remaining boundaries

Combined Orders699/700 serving image:
7c28921d9d97359b3c9f7db9a2aa86a68e049bc96c272a03260205b2c85a269f.
Previous79844d57884a8fc334a43a9dc666602646397ec2053bdbb187e93bbf8fa61989
retained as rollback. Recreated only yellow-public-demo app; existing PostgreSQL,
cache and tunnel retained. DB ledger101 and business date2026-09-24 unchanged.
Public/local health200; inherited readiness503/build_revision_unavailable remains.

Live: https://faq-lift-iso-completely.trycloudflare.com/
Local: http://localhost:3010/
Temporary tunnel; not a permanent endpoint or fifty-millisecond guarantee.
No bulk staging/commit/push/PR or complete-ecosystem certification. Broader
functional gaps remain tracked in receipt695 and the requirements register.
