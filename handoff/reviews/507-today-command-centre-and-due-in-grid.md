# Order 507 — independent Today and movement-grid review

## Final verdict

**ACCEPT — bounded Order 507 UI candidate**, following r3 and the final two accessibility corrections. Reviewer: Codex independent agent `/root/pms_delivery_audit`; the reviewer did not implement these changes. Personally executed tests, typecheck, isolated production builds and desktop/mobile browser interactions. No deployment, application implementation edit, database write, real guest-data import, or external communication was performed by this review.

Acceptance is for the specified Today/movement UI, not completion of the entire PMS, voice assistant, client website, real-data migration, or production deployment. The deploy owner must still run the order's hosted desktop/phone smoke against the deployed artifact and actual API.

## Candidate identity

Source: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

Final SHA256 values after the final corrections and successful verification:

| File | SHA256 |
| --- | --- |
| frontend/yellow/src/App.tsx | CB3BEF19D6FAD00B27BD8C5197078A4A219249FA88724B56577CCA81BF83F0FE |
| frontend/yellow/src/styles.css | B89109AF8E5A483A0187044D706B3BA1563158A8A96E5A9DA4799C38D13DEEFD |
| frontend/yellow/src/today-workspace.ts | 1F34F42CB8AF00A4D976BC00AB099A912AC8FE2910A52D46CD564D2C3A2A14FC |
| tests/yellow-today-workspace.test.ts | DE39D051E3FAE0928EB21B6CB9E2583C47CD8A3E458B2D6ABBD977B244C6285A |

## Executed commands and results

From the frozen runtime source:

```text
bun test tests/yellow-today-workspace.test.ts tests/yellow-reservation-board-pages.test.ts
6 pass, 0 fail, 23 expect() calls

bun run typecheck
tsc --noEmit — exit 0

bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/runtime/order507-independent-review-build-final --emptyOutDir false
469 modules transformed; build passed
index-CelpGe6M.js 485.00 kB / gzip 144.34 kB
index-DgDJvReq.css 43.10 kB / gzip 9.50 kB
```

The reviewer also built and tested the preceding r3 artifact at `D:/Yellow/runtime/order507-independent-review-build-r3`. Browser proof below used that artifact. Final subsequent changes were confined to `aria-rowcount` header accounting and two variance text colors; source and contrast were independently rechecked, and tests/typecheck/build rerun as above. The complete browser suite was not repeated after those two scalar corrections.

## Browser method and evidence

Used the bundled Playwright library with installed Chrome, an ephemeral loopback HTTP server serving the isolated Vite build, and intercepted API responses containing deliberately invented review records. No packages were installed. The browser-specific plugin referenced by the testing skill was unavailable, so regular Playwright was used. The server and browser were closed afterward; this was not a second published application.

Desktop viewport 1440×1000; phone viewport 390×844. Browser page errors: **none**. Identity was `Yellow · Hotel Operations`; the movement page visibly rendered rather than showing a framework overlay or blank page. The review fixture included 1,000 due-in reservations and a separate departure-order fixture. Tests used the existing Locanda property route identifier only as routing context; all browser API responses were isolated review fixtures, not live guest records.

| Requirement / scenario | Personally observed result |
| --- | --- |
| Complete bounded keyset load | Ten cursors: 0,100,200,300,400,500,600,700,800,900; heading `Arrivals · Due in (1000)` |
| Virtualized 1,000-row rendering | 21 rows mounted initially rather than 1,000; bounded viewport and overscan |
| Deep-scroll search reset | After scrollTop 10000, filtering to 500 Alpha records reset DOM scrollTop to 0; 13 visible rows, no blank viewport |
| Horizontal header/body alignment | At horizontal scroll 200, corresponding header and body x positions both 87 |
| Phone layout | Five configured mobile cells share the same row top (342 in fixture); no previous wrapped/clipped status cell; horizontal scrolling remains necessary for the full set at 390px |
| Keyboard row navigation | ArrowDown moved focus from row index 0 to 1; Enter opened `/res/test-2` via awaited URL transition |
| Departure sorting | Explicit departure mode orders by stayTo, producing B,A for earlier-departing B despite its later arrival |
| Today hierarchy | Three movement buttons; five KPI buttons; no full performance table before explicit opening |
| Scenario truthfulness | Scenario/forecast/budget projection disclosure visible in the collapsed default view |
| Detailed performance view | Explicit open displays 20 metric rows (four periods × five metrics) |
| Dialog keyboard behavior | Focus placed inside; Tab and Shift+Tab stay inside; Escape closes; focus returns to opening trigger |
| Property timezone | Focused helper fixtures prove Kolkata evening/21:34 and London morning from the supplied UTC instants |
| Variance | Sign and percentage are derived from actual versus baseline; zero baseline returns unavailable rather than invented growth |
| Failed in-house query | Source now fails closed to unavailable instead of representing an error as genuine zero |
| Read-only scope | UI uses existing board/report projections; no added mutation, contacts, invented reservation attributes or review scores identified in the reviewed change |

Screenshots captured and personally inspected:

- `D:/Yellow/runtime/order507-review-mobile-r3.png`
- `D:/Yellow/runtime/order507-review-desktop-r3.png`

They are synthetic test evidence, not proof of the published site's data or release identity. The desktop capture includes deliberately unavailable/empty movement values in the fixture and must not be read as live hotel occupancy.

## Findings resolved during review

Initial candidate was not accepted. Review found deep-scroll filtering could leave a blank viewport; the header did not track body horizontal scrolling; phone rows wrapped five cells into four columns; arrow-key navigation did not move focus; and departure time sorting used arrival time. These were corrected and independently exercised as recorded above.

The next candidate lacked dialog initial focus/trapping/Escape behavior and default-view scenario disclosure. r3 corrected these; the browser suite independently confirmed them.

Two final accessibility issues were then corrected:

1. Virtual table now declares `aria-rowcount={visibleRows.length + 1}`, consistent with data `aria-rowindex={rowIndex + 2}` and the header row.
2. Small variance text changed from #00a641 / #ec2142 to #007a32 / #bd1230. Reviewer-calculated WCAG relative-luminance contrast against white is **5.48:1** green and **6.38:1** red (previously 3.22:1 and 4.32:1). Direction arrows/text remain, so meaning is not conveyed by color alone. This specific contrast check is not a blanket WCAG certification.

## Limits and follow-on checks

- The actual published URL, real API response paths, deployed bundle identity and physical phone/browser must be smoked by the deployment owner. This review deliberately did not deploy.
- Mocked browser fixtures validate rendering, paging integration and interaction, not new database authorization or reservation-state semantics. Those belong to the separate Order506 PostgreSQL review; no replacement RLS proof is claimed here.
- No microphone, Gemini session, speech quality, voice action flow or real guest mutation was part of Order507 proof.
- No formal screen-reader/NVDA pass, 200% zoom matrix, full contrast audit, or formal 1,000-row latency SLA was executed. Mounted row count and successful interactions are not a performance benchmark.
- The search control should receive a descriptive accessible name rather than relying on its glyph label/placeholder in a future accessibility cleanup. Header sort glyphs are present, while sorting is performed through the explicit Advanced sort controls.
- The greeting derives from the selected property's timezone at render; continuous clock ticking without rerender was not certified.
- Existing reporting values remain projections. Visible disclosure is mandatory until client forecasts/budgets replace scenario inputs; these figures must not be represented as imported real client financial plans.
- Existing money-to-display Number conversion is not proof of exact arithmetic for arbitrary values beyond JavaScript's safe-integer range; this UI review does not extend the prior bounded scenario reconciliation proof.

No remaining release blocker was identified for the bounded reviewed UI candidate after the final corrections. Preserve the source hashes and run the hosted smoke before declaring this change published.

## Release-owner hosted smoke — 2026-09-20

After the independent acceptance, the release owner rebuilt the production image
and recreated only `yellow-public-demo-app-1`; PostgreSQL, Valkey and the tunnel
were preserved. The container reported healthy, the public Locanda route returned
HTTP 200, and the served bundle identity was the independently reviewed
`index-CelpGe6M.js`.

An authenticated read-only smoke against the local production container returned
12 Locanda in-house rows, all classified `stayover`; the token was not printed.
The public Today route was visually inspected after data load: property-local
`Good evening`, the three movement counts, five centered KPI values and collapsed
Today/MTD/YTD performance summary rendered without clipping. The public
`?lane=due_in` route rendered only `Arrivals · Due in (2)` with the search,
advanced filter/sort controls and reservation grid. The exact hosted bundle is
the same artifact independently exercised at 390px; no second phone-only bundle
exists.
