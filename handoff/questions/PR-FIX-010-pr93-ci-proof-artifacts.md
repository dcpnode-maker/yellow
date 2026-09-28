# PR-FIX-010 - Fresh CI identified a stale renamed test path

## Resolved

CI36497197841 quality step passed the real Leaflet test, then upload-artifact failed
with no files under the required research-map proof directory. The report-producing
MapLibre test is now `operator-overture-market-map.browser.test.ts`. Its old filename
is occupied by the preserved governed Leaflet proof. PR-FIX-010 admits the exact
workflow/test correction without weakening or relabeling artifact acceptance.
