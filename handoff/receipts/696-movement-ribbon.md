# Order696 — Guest movements selector

25 September 2026. Root implementation; independent review at
handoff/reviews/696-movement-ribbon.md. Public cutover proof completed below.

Before changing code, root used CUA against the existing public Today page:
Arrivals and In house selections changed both pressed state and rows. The phone
ribbon clipped its third choice; the selected capsule used screen coordinates
that included rail borders and transient pressed transforms. This was a proven
presentation defect, not proof that the underlying movement queries failed.

SegmentedRibbon now measures offsetLeft/Top/Width/Height relative to the rail.
Scoped movement-ribbon.css fits all three choices at phone width with >=44px
targets. Existing roving keyboard arrows/Home/End, reveal, selection callbacks,
URL behavior and reduced-motion handling remain intact. No API or hotel writes.

Independent reviewer personally executed tests/order673-ribbon.test.ts and
tests/order696-movement-ribbon.test.ts: 6 pass, 0 fail, 45 assertions; frontend
typecheck and import boundaries (208 files) passed. Final built/public visual
alignment and phone acceptance will be recorded in the combined release receipt.

## Actual public acceptance after reboot

25 September: single app image79844d57884a8fc334a43a9dc666602646397ec2053bdbb187e93bbf8fa61989
serves https://faq-lift-iso-completely.trycloudflare.com/; local/public health200,
ledger101 preserved. Image licence47 and repeated scoped32tests/246assertions pass.
Root CUA on real Today -> arrivals:390px viewport, three44px tabs, right edges
129.66/242.54/355.40. Inhouse click changes selected tab and visible count to3;
indicator x245.80 width110 vs selected x245.54 width109.86 (rounding <0.3px).
Home selects Arrivals again. Nested Housekeeping Room status/Cleaning & inspection
and collapse-to-bottom-dock checked. Screenshot D:/Yellow/temp/order696-live-phone.png.
Root view_image compared founder F&B reference and final screenshot: gray track,
white capsule, three aligned labels/counts, compact typography, full-width phone
fit/44px targets and preserved table/dock all agree with the established pattern.
No new concept or copy was invented; hotel-specific labels intentionally differ
from F&B. No mutation QA on public records. Existing Today overdue row semantics
are not changed by this presentation order. Inherited ready503 remains recorded.
