# Order693 — implementation and mounted acceptance

25 September2026. Root implemented compact reservation detail using the existing
approved neutral ribbon, not a new identity. Public cutover pending692/694 gates.

Six sections remain mounted: Overview, Guests & shares, Stay & billing, Travel,
History, Actions. Overview uses available desktop columns and readable phone
labels. Blank operational-editor card is not displayed when inactive. Existing
guest allocation, departure change, billing, pickup, timeline, lifecycle and
readiness controls remain present. Read-only guest history has its own content.
Same-reservation lifecycle deep link selects Actions; recovered travel/departure
lock takes precedence and cannot be hidden. No domain or authority changes.

Root personally executed `bun test tests/order693-reservation-detail.test.ts`
(2/0; later guards22 assertions), frontend typecheck, native-enabled Vite build.
CUA mounted built UI against existing synthetic loopback Order690 fixture4175:
all sections opened; phone guest editor retained fields; travel Carrier draft
survived History -> Travel. Synthetic unknown-response travel save locked all
section controls, Back, global search. Reload retained Travel and exact retry
controls. Retry succeeded, refreshed truth unlocked all controls. Fixture receipts
showed two attempts with identical key and body. No live hotel writes.

## Fidelity comparison

`view_image` inspected founder F&B ribbon reference
`C:/Users/astha/Documents/Codex/2026-08-14/cl/outputs/yellow/.codex-remote-attachments/01a02df3-c84f-7773-a169-dec0e20c9da6/4d8bcb04-13b8-4f04-8971-5fdbef0311df/3-1000510280.jpg`
and rendered D:/Yellow/temp/order693-detail-desktop.png and detail-mobile.png.
Browser viewport1265x712 and390x844 (reference1280x573 contains photographed art,
not a functional viewport). Final public screenshots supersede intermediate ones.

1. Palette: retained gray track / white selected capsule; removed warm card border.
2. Hierarchy: identity -> connected detail ribbon -> selected content; history no
   longer pushes the primary task down the page.
3. Density: collapsed original vertical stack; added desktop context/readiness
   columns rather than making smaller unreadable fields.
4. Typography: controls explicitly13px, body13–14px; fixed unstyled native-looking
   room-assignment button found during visual QA.
5. Mobile: two-row readable ribbon,44px targets,375px document within390px viewport;
   no horizontal overflow. Corrected inherited centered hero to left alignment.
6. Interaction: selected state, focus rings, motion respects reduced preference;
   hidden contents retain DOM/state and critical recovery remains visible.

Intentional adaptation: staff section labels replace F&B categories; exact original
icons/content are not duplicated. No new decorative assets or marketing labels.
Above-fold copy remains booking identity/status and specified workflow section
labels; summary headings retained. No claim of full-app redesign completion.

Final Astra-review correction keeps active alerts visibly above the ribbon and
renames Travel to Alerts & travel. Detail Back uses a validated same-property
returnStage token; unknown/duplicate/external values fall back to Today. Final
tests693:3/0/37; independent combined amended692/693:15/0/98. Final390px screenshot
order693-detail-mobile.png was recaptured in a fresh phone-sized tab, document
width375 within390; Back to Arrival and six sections visibly present. No public
cutover: Docker recovery blocker is recorded in current project status.
