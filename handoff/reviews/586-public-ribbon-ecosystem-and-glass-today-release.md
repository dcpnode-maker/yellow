# Review 586 — public ribbon, ecosystem and glass Today release

## Verdict

**APPROVED — with the Order586 scheduled-boundary exception independently proven.**

The final public image is the reviewed app-only build, the repaired public navigation
and stylesheet are live, the actual public origin passes the required responsive,
progressive-disclosure, disabled-boundary and lazy-loading checks, and no
operator/browser-owned hotel or financial record changed.

The first 129-table preflight and the last browser postflight straddled the configured
UTC-midnight business-day worker. Five fingerprints therefore changed. I personally
row-attributed the entire delta to two `business_day.opened` events emitted by that
preconfigured worker at the boundary and to the two existing consumers processing
those events. The amended order permits this specific independently proven case. A
new post-boundary baseline and a second snapshot are exactly equal across all 129
tables.

## Reviewer and independence

- Reviewer: `/root/order586_independent_review`
- Role: independent non-implementing release reviewer
- I did not edit implementation source, build or deploy the image, mutate target
  configuration, or submit an operational/financial action.
- The only repository file I wrote is this review.
- I read `PROJECT.md`, `AGENTS.md`, Order586 and the accepted prerequisite reviews
  583, 584 and 585 before proof. The Windows host had only the WSL launcher and no
  installed WSL distribution, so `./state.sh` could not execute; I read the script
  and reproduced its read-only branch/head/worktree observations in PowerShell.

## Accepted prerequisite chain

- Review583: approved the isolated ecosystem shell, disabled future capabilities
  and internal synthetic market boundary.
- Review584: approved Finance/Reservation route extraction and bundle budgets.
- Review585: approved the five-signal liquid-glass Today composition, sliding white
  ribbon, restrained selected edge and the two pointer-inert depth layers.

## Final target identity and rollback

| Surface | Independently observed final identity |
|---|---|
| app | `a26447bbf94881cecb72f626cd9e2f30c0e7c50b5f6038a44859c2b66cbf8c58` — healthy |
| app image | `sha256:bb9b07ef379c4791860a86fb0cc053cf66f72c79e7e35a3a289dd2c335bb3f61` |
| rollback tag | `yellow-public-demo-app:pre-order586` = `sha256:7bcfb9c2d705130ea72a41c6b827cd417e77f8f77bfdce8122e1cb4875f94e4d` |
| PostgreSQL | `9f507e09cc387e7a96a436835a94d036338ed3acf87e70309031347c5ee48cb5` — preserved, healthy |
| Valkey | `781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b` — preserved, healthy |
| tunnel | `e17219ecd7aa403a70d4f82a755c45aca51a6768a82d63a802bb6dadc1acc92a` — preserved, running |

Only the app identity changed. Local and designated public `/health`, `/ready`, `/`
and the canonical property Today route returned HTTP 200; both app pages carried the
expected `Yellow · Hotel Operations` title.

## Findings repaired before approval

The initial guarded public pass found two deterministic release blockers:

1. The visible Ecosystem control navigated to the unserved `/p/<property>/ecosystem`
   path and returned 404. The admitted repair maps it to the established lazy route
   `/p/<property>/today?workspace=ecosystem`. I retested the actual public click, not
   merely a direct URL; it now lands on that canonical URL and renders the hub.
2. The inherited Google Fonts import violated the correct self-only stylesheet CSP
   and produced a deterministic console error. The admitted repair removes the
   external import and keeps local/system fallbacks. Final source and public bundle
   contain zero `fonts.googleapis.com` hits, and the clean public run has no CSP,
   console or page error.

Both repairs are recorded in the amended order and were independently retested on
the final image above.

## Exact source proof

I compared each final accepted candidate file byte-for-byte with the sole D: serving
source. All pairs were equal. SHA-256:

| File | SHA-256 |
|---|---|
| `frontend/yellow/src/App.tsx` | `8D58F4ACF2B704BD058C69B5E4FD278BC27318A5CBE8B586D1A805926CEE039E` |
| `frontend/yellow/src/styles.css` | `7DB61743A55C89E1EE1E12E6AA409F500E519F1ABADA6CF8D53447481B9A1C3C` |
| `frontend/yellow/src/yellow-api.tsx` | `7DDCF7456C53456388A1AF1BA28101A61B7B0A382773A286F39A863F10A1FD10` |
| `frontend/yellow/src/ecosystem/capability-registry.ts` | `B267C03AE5D1F724D326C9FCF706A84C9A9AB54C60C6DF8EBE9CF70391C60FC0` |
| `frontend/yellow/src/market-intelligence/contracts.ts` | `2CDF8AA73D9A66B88D528AD4316D64CEAFC89234EA2E53EC0768691BB220A3E3` |
| `frontend/yellow/src/market-intelligence/scheduler.ts` | `A2997B9056BAE177793FF5F15B291AC1D4ED412926A1972A7CC96A0ECBFDEF5C` |
| `frontend/yellow/src/market-intelligence/synthetic-adapter.ts` | `D4DCFD83868008CF5395ADD07D1D328F434F762F91045E8E695281856D652F3B` |
| `frontend/yellow/src/workspaces/EcosystemHub.tsx` | `1D081C1ABD468E37DF126BBEA5D7D6D2FE528D206B6C04F9C7BBD88846178F5F` |
| `frontend/yellow/src/workspaces/FinanceWorkspace.tsx` | `275CE70D7BF820E7CE1EC8E3AA88DDAA355F87DA01B8002969CA4AD510B307F9` |
| `frontend/yellow/src/workspaces/MarketIntelligenceLab.tsx` | `EDFEABE7ACEE55E05470092E98A0BE03671031ACEBD52E8888C5B2E79A3F5138` |
| `frontend/yellow/src/workspaces/ReservationWorkspace.tsx` | `29929379A7BCDD5C2B939F97BC29F15F44DB9BB1253C9BBC3551E96F2A5768B6` |
| `frontend/yellow/src/workspaces/TodayGlassDashboard.tsx` | `A48DA4191578DFCD1D95933FD25B622446B36FC53EFC2CE019A363AA07287738` |

## Build, container, local and public artifact identity

I hashed the final serving-source assets, every corresponding file inside the final
container, and every byte returned over both local and designated public HTTP. All
four copies matched. Important sizes and hashes:

| Asset | Bytes | SHA-256 |
|---|---:|---|
| `index-BWmuxmPs.js` | 189,433 | `D2CC748C5312ECFFBF18C8E1D27853A585939067C14502DFEBB2E0F2A3B69DC2` |
| `index-DSNtw9ll.css` | 115,832 | `703A13488BA35534FDD6860C9A6A8BD8C469458F53164E3821BAF8EA891F31B1` |
| `react-runtime-CR5VJ85Q.js` | 218,840 | `B19A9FCDB691B2158D837EF44B93412F755C06EC395363AF87850A92252826B4` |
| `vendor-5jQm_Y8l.js` | 160,053 | `9B087CF4A18A50B29557ABE4B1C8AD2D358D67CF13D9A82314BD79FCA7EFCD36` |
| `EcosystemHub-C8WgpCbO.js` | 43,030 | `B93DE9901BFD2331A7C14B927D3E93F087E2DD6237A0765A8E616FF0AE121A0E` |
| `FinanceWorkspace-DyGVscSv.js` | 57,149 | `BF3F33011341979CDAC095D9BA850781BBBDCF0DD91ED4F17E12B3D42AC1F699` |
| `ReservationWorkspace-qg_1XCNa.js` | 89,883 | `EC2A19CE9A52B4A49A2AEB792EC62C51B01066E2D0F9CB70F95F7406B3AF5C8E` |
| `MarketIntelligenceLab-DcrXA4-N.js` | 9,883 | `8BF2B1062693F167D15FFA69B5C1C58B46CCB82700AB69A6713350FB7A80B82C` |

The measured application entry remains below the required 200 kB limit, and the
largest JavaScript asset remains below 500 kB. The other four generated JavaScript
assets were likewise container/local/public identical.

## Actual public-browser proof

I used a fresh Playwright/Chromium context against the designated public origin with
a request guard that allowed only GET/HEAD/OPTIONS plus the existing automatic
`POST .../auth/demo:enter`. Every other non-read method would have been aborted.

Final guarded run:

- `blockedWrites=[]`
- 14 permitted automatic demo-session entries
- `pageErrors=[]`
- `consoleProblems=[]`
- `badResponses=[]`
- no operational or financial confirmation was opened or submitted

Repeated fresh contexts during early reviewer iteration briefly exhausted the
documented source login bucket and produced only HTTP 429 responses from
`/api/v1/auth/demo:enter`. This was reviewer-generated rate-test noise, not an app
resource failure. Pacing full reloads to the configured one-token-per-three-seconds
refill produced the clean final result above without bypassing or changing the
limiter.

### Today reflow, five signals and depth treatment

At 240, 375 and 1440 CSS px:

- `documentElement.scrollWidth === clientWidth` at every width;
- source-backed values rendered as Occupancy 70%, room revenue SAR 10,847,
  Arrivals 5, Departures 6 and In house 9 — none remained Loading or Unavailable;
- complete accessible labels were present for all five controls;
- each intended metric/ribbon layer had exactly two restrained depth cards; their
  parent layers were `pointer-events:none` and behind content (`z-index:-1`);
- border measurements were 1 px; the ribbon was fully rounded and the selected pill
  was white with the required restrained yellow edge;
- the 240 px bottom launcher was intentionally absent and the bottom Yellow
  navigation remained present, so there was no launcher collision;
- pointer hit-testing through the ribbon depth layer reached the Departures button.

The selected pill moved from translation 0 to approximately 98.33 px when the second
segment was selected. Both operating-performance controls opened a real
`role=dialog`, `aria-modal=true` dialog named **Actuals, pace and plan**, exposing six
column headers; close behavior worked.

All three movement destinations were exercised on the public origin and reached
their canonical detailed screens:

- Arrivals — `Arrivals · Due in (5)`
- Departures — `Departures · Due out (6)`
- In house — `In house · Occupied (9)`

Visual evidence, inspected at original resolution:

- `D:\Yellow\temp\astra586-public-today-240.png` — SHA-256
  `25D70AA4A8C057C4BF4213E3C737FC92505C0C25D5349AE26DA294C89960CE92`
- `D:\Yellow\temp\astra586-public-today-375.png` — SHA-256
  `5C677DF3A3D0246A41BC6E06499EA4B359FDE38303BF4F2C245834A908E2FEF5`
- `D:\Yellow\temp\astra586-public-today-1440.png` — SHA-256
  `5C141AF86CF98C7ADDCB2F7A2A8C4BF1F632BEDDAAAC418CEC326132CC9FEA4B`

### Lazy resources and ecosystem boundary

The initial Today document fetched only the application entry, CSS, rolldown
runtime, React runtime and vendor bundle. Finance, Reservations, Ecosystem and
Market-Lab chunks were absent.

- The Finance chunk appeared only after entering Finance.
- The Reservation chunk appeared only after entering Reservations.
- Clicking the actual Ecosystem control fetched the Ecosystem chunk and landed on
  `/p/<property>/today?workspace=ecosystem`.
- At 375 px the Ecosystem page had no document overflow, exposed all 68 registered
  capabilities, retained 51 disabled actions and 51 explicit boundary actions, and
  did not expose the internal lab.
- A disabled future capability performed no action. A boundary capability opened a
  real modal progressive-disclosure drawer containing operational purpose,
  prerequisite, audience, device and presentation-route information.
- The selected Ecosystem segment measured a 1 px border and the specified white fill
  plus restrained neon-yellow glow.
- Directly requesting `?workspace=market-lab` without the device flag fell back to
  Today; the Market-Lab chunk was never requested.

Ecosystem visual evidence:
`D:\Yellow\temp\astra586-public-ecosystem-375.png`, SHA-256
`E3BFEFB9C4E839C76F06ADCDBA50688FDB1F54D9232878643FDEC8C61E108BA8`.

## Target-bound 129-table preservation proof

The fingerprint harness is `D:\Yellow\temp\astra586-db.ts`, SHA-256
`9FCE25E535E48A8DCBE32846981576BE3190E9905DF3E50189E437049FF4CA9B`.
It validates the exact loopback target/database, starts `REPEATABLE READ READ ONLY`,
sets the tenant transaction-locally, and computes a count plus deterministic ordered
full-row JSON MD5 for each of the exact 129 public tables. The receipt aggregate is a
SHA-256 over those table results; no secret is retained.

### Deployment comparison before the scheduled boundary

- Fresh current-target preflight at 2026-09-21 23:37:45Z:
  `D:\Yellow\temp\astra586-public-preflight.json`
  - receipt SHA-256 `E299653DB52591D28157663662AF419D6077704A0FD4AEFCCF6DB39A58070AED`
  - aggregate `e805ea708c963a6f94ed99945cdba68d9960c96efe7fb815944792923cccc981`
- Final-image postdeploy at 2026-09-21 23:57:13Z:
  `D:\Yellow\temp\astra586-public-final-postdeploy.json`
  - receipt SHA-256 `EE10F4AFA4B80F5BEA59696CDD19252AFBE0C4E7285A93D269F73662FB663FAE`
  - same aggregate, `changedTables=[]`, `equal=true`

Thus the app replacement itself preserved all 129 fingerprints exactly.

### Independently attributed UTC-midnight worker delta

The final browser postflight at 00:14:45Z had aggregate
`450726c50debfacbb2ab190be6adc20d41ec4fafc2e44b9d6ba5621064eb6268`
and changed only:

| Table | Before | After | Attribution |
|---|---:|---:|---|
| `business_day` | 27 | 29 | two configured `business_day.opened` rows |
| `fact_log` | 1,010 | 1,012 | same two events |
| `outbox` | 950 | 952 | same two events, seq 997/998 |
| `consumer_processed` | 1,900 | 1,904 | two events × two existing consumers |
| `consumer_cursor` | 2 | 2 | both cursors advanced to seq 998 |

The two rows/events were recorded at exactly
`2026-09-22 00:00:00.393958Z` and `2026-09-22 00:00:00.478251Z`; the configured
`arrival-pickup-task` and `availability-projection` consumers processed them at
00:00:01Z. No browser/operator-owned record was involved. The other 124 table
fingerprints stayed exact, including reservation 654, space occupancy 233, folio 9,
journal 2, posting line 4, payment 0, payment operation 0 and document 0.

Final browser receipt:
`D:\Yellow\temp\astra586-public-final-postbrowser.json`, SHA-256
`3CD0B45AC115AA3178222A7035DAA899594EAD302618A61181DC81CAD38BCA03`.

### Required second post-boundary comparison

- Baseline: `D:\Yellow\temp\astra586-public-postroll-baseline.json`, receipt
  SHA-256 `436C36EAD7A5D0DF420763D117843B683F1FE9CF09F22F12033B0F6FD0BDD976`
- Final: `D:\Yellow\temp\astra586-public-postroll-final.json`, receipt SHA-256
  `800F45CA40EB2F4145BA3BD036D4935DFF1E644E5D1E44252985736C9ADA607D`
- Both aggregate to
  `450726c50debfacbb2ab190be6adc20d41ec4fafc2e44b9d6ba5621064eb6268`
- `changedTables=[]`, `equal=true`, all 129 tables stable

This satisfies the amended scheduled-boundary condition without suppressing or
normalizing any row from the fingerprint comparison.

## Representative commands personally executed

```text
docker ps --no-trunc --format ...
docker inspect ... yellow-public-demo-app-1
docker image inspect ... yellow-public-demo-app:pre-order586
Get-FileHash <candidate and serving source files>
docker exec yellow-public-demo-app-1 sh -lc '... sha256sum ...'
HttpClient GET <every local/public generated asset> + SHA-256 comparison
node D:\Yellow\temp\astra586-public.cjs
bun D:\Yellow\temp\astra586-db.ts preflight ...
bun D:\Yellow\temp\astra586-db.ts postflight ... <baseline>
docker exec yellow-public-demo-postgres-1 ... psql ...
```

All SQL investigations were in explicit `REPEATABLE READ READ ONLY` transactions.

## Boundaries retained

- This approval covers the released UI shell and read behavior only. It is not a
  claim that all PMS/ecosystem areas are implemented.
- Preview ecosystem capabilities remain disabled unless their current operational
  prerequisite exists.
- Market intelligence remains unavailable to public users without the internal
  Yellow-Devices flag; no provider, OTA, scraper or synthetic public feed was
  activated.
- No migration, seed, grant, backend, API, database, worker, provider or target
  configuration change was part of this release.

