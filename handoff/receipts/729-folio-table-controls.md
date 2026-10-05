# Order729 — folio columns and explicit cell copying

Root implemented the previously disabled Columns interaction in the existing guest
folio table. One canonical visible-column projection drives both headers and body.
Reset restores all fields and clears view queries; at least one column remains.
Copy controls use the same exact displayed text, including bigint currency display.
Numeric alignment is keyed to column identity, not position. No financial writes.

Independent app_next_slice727 review:15 passed,80 assertions, no source blocker;
exact hashes and wider stale-baseline findings are in reviews/729. Root combined
727/729/730 and adjacent suite:93 passed,0 failed,774 assertions. Full root typecheck,
208-file import boundary check and Vite564-module build passed. Existing map chunk
size warning remains; no warning threshold was weakened.

Browser hide/show/reset/copy and mobile proof remain pending at this checkpoint.
Candidate image ff25e836459123b47c6ec0c8eb7c0468d581320514248469784eaf8add93e2f2
contains generated frontend over existing723 backend; not a clean-source release.

## Root browser acceptance

Actual appff25e836: Columns checkboxes are enabled. Hiding Kind and Quantity leaves
exactly5 headers and5 body cells; Apply closes editor, Reset restores7. Explicit
Amount copy produces Copied and the Windows clipboard exactly matches displayed
`SAR` + nonbreaking space + `25.00` (9 characters). IAB virtual clipboard reads were
empty, so root verified the actual OS clipboard equality without printing unrelated
contents. Bigint display logic remains unchanged. Mobile document305/375px has no
page overflow; table owns its794px horizontal content inside301px at390viewport.
Local app-only promotion shares727 receipt; no financial data mutation.
