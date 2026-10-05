# Order717 — host calendar local delivery, 25 September2026

Default calendar replaced by room/listing picker and List/Month/Year host views.
Neon-green current/active accents, grey departed segments, actual reservation
navigation, bounded lazy month reads, real state labels, retry/partial disclosures.
Room plan remains a secondary option with vertical scroll chaining restored.
Shared HostCalendarMonth accepts separate externally supplied day content; pricing,
availability and policy edits are NOT delivered or represented by inert controls.

## Proof

- Independent review709 personally18/0/103,frontendtypes and208boundaries; source
  findings and corrections retained in review717. Root subsequent added rendered
  departed-state assertions: focused717+adjacent18/0/106,fulltypes/208boundaries.
- Root current combined717/714/715 proof37pass0fail270assertions across7files.
  Vite558modules passed; existing >500kB map-chunk warning remains.
- Actual authenticated loopback browser:22 room/type picker cards, selected102,
 91 date cells across3months; bars wrap and open actual reservationL3R-IH-0002.
  List and Year switching, Year-month drill-in, date sheet open/close, Today jump
  and full-page up/down scroll verified. No reservation/cash/room mutation for QA.
- At390px, no horizontal page overflow; today scrolled to viewport center and
  compact DUE labels remained visible. At320px, DOM geometry showed305px document
  width,97px-high date cells and normal document scroller. Desktop1280px document
 1265px, calendar approximately1003px. Final weekday sticky top62px desktop and
 56px mobile after root scroll-owner correction. Browser screenshots on the later
 narrow test were scaled by the IAB capture surface; DOM measurements distinguish
 actual layout from that capture artifact. This is not native-phone proof.
- Tab-scoped request blocking verified picker unavailable/Retry, Year unavailable
 cards and month error panels; clearing block and retry restored real results.
 Blocks and responsive/CDP overrides were reset. Not all mounted network races are
 covered by unit tests; the receipt does not claim full frontend E2E automation.

## Defects found during work (fixed, not concealed)

Departed room-move segments initially inherited active parent tone; corrected.
Year was initially decorative, now lazy real month reads. Mobile global aside rule
hid date sheet; scoped display corrected. Sticky sheet initially below all months;
fixed position with bounded scroll area. Root overflow-x:hidden created a phantom
scroll owner; host-specific overflow-x:clip/overflow-y:visible corrected. Static
CSS test initially rejected harmless text-overflow rules, narrowed to scroll roots.

## Runtime boundary

Loopback-only QA image f00d4fc01938de988c0c5b463b73b7a7c95f770693b04541d6ab60541628e1f4
includes current717/714/715 candidates; bundle index-gkGbxlst.js. Only app recreated.
Public tunnel remains OFF at founder request. Retained713rollback image, DB/cache
and source preserved; inherited ready503/build_revision_unavailable is not fixed.
No commit/PR/merge, native mobile test, RMS pricing write or ecosystem completion.

Host source SHA25617103dd7a168c36556a1683d7f2556eac0c0f961f0845d7574416933cca5c401;
host CSS769cda8270255bcd64f46343fe535305af0bc31728d2b690dcd6ac3b99283342.
