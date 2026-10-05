# Order694 — vertical ribbon and collapsed dock

25 September2026. Source/build and mounted synthetic checks pass; public pending.

The vertical sidebar nests Reservations and Housekeeping with neutral container
tracks and current child capsules. Housekeeping links only backed Room status
and Cleaning & inspection views, not an invented general CRM. Collapse hides and
inerts the desktop rail and reclaims its width. Five bottom dock actions retain
guarded existing navigation, accessible names and hover/keyboard-focus tooltips.
The full menu toggle stays available. Mobile drawer retains focus/escape logic.

Independent final source proof:13/0/115; full typecheck and boundaries208 passed.
Root CUA measured collapsed rail visibility:hidden/inert and main margin0;
desktop nested label scrollWidth equals clientWidth. At390px dock is247.6px wide,
left12, bottom832 in844px viewport; Ask Yellow ends at766, leaving10.4px vertical
clearance. At320px dock fits and first Today tooltip is within viewport. Focus
on Reservations exposes its prompt. Menu children work with46px phone targets.

Root caught and corrected two cascade defects beyond source-only tests: mobile
header style hid the dock, and nested header badges inherited grid cell padding.
Final scoped header trigger is44px inside48px row (top588/bottom632 within
586–634 in measured phone viewport). Source regression assertions cover fixes.
Screenshots: D:/Yellow/temp/order694-menu-desktop.png,
order694-menu-mobile.png, order694-dock-mobile.png.

Header filter applied to the synthetic Guest column reduces Arrival2->1 and is
retained across In house->Arrival. Copy button click did not navigate/open row.
The hidden IAB clipboard operation did not provide a completed browser receipt;
actual clipboard-success is NOT claimed. Utility tests personally executed by
reviewer cover exact displayed text, unavailable and denied clipboard outcomes.
General hover help across every legacy workspace is not certified by this slice.

Incidental deployment safety: C: became full. Root moved the exact ordinary
installer archive C:/Users/astha/AppData/Local/Temp/ollama-windows-amd64-v0.34.2.zip
to D:/Yellow/temp/ollama-windows-amd64-v0.34.2.zip after validated paths/no overwrite;
verified1460928014-byte destination. Recoverable archive retained; models,
databases and backups untouched. Docker subsequently stopped answering and
public health returned530 before any new image cutover. Runtime recovery and
public acceptance are recorded separately; do not infer release from this file.

Normal Docker restart timed out with processes still running; root cancelled its
hung build/version clients and requested restart consent. No image completed or
cutover occurred. Recovery checkpoint is questions/696-runtime-recovery.md.
