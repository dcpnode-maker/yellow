# Review 588 — public guided-checkout ribbon release

**Reviewer:** `/root/order588_release_review` (independent; did not implement or deploy Order 588)  
**Date:** 2026-09-22  
**Local target:** `http://127.0.0.1:3010`  
**Public target:** `https://editing-alto-artists-quilt.trycloudflare.com`  
**Verdict:** **APPROVED for the bounded Order 588 app-only public release. No finding.** This is not approval of an actual folio opening, settlement, checkout, physical-room operation, database change, or whole-PMS completion.

## Independence and scope

I read `PROJECT.md`, `AGENTS.md`, Order 588 and Review 587 before testing. The
host's `bash` command resolves to a WSL relay without `/bin/bash`, so `state.sh`
could not execute; I performed the equivalent read-only branch, head, dirty-tree,
order, decision and service checks in PowerShell. The canonical tree was already
dirty on `phase-0/founder-context-demo-readiness` at `a043bb29`. I did not edit
implementation or serving source, build or deploy an image, change configuration,
check a confirmation, or submit an operational/financial action. The only repository
file I wrote is this review.

## Exact promoted source

I hashed the frozen Order 587 candidate and the sole serving source independently.
All five ordered files are byte-identical to each other and to Review 587:

| File | SHA-256 |
|---|---|
| `frontend/yellow/src/App.tsx` | `e1ec1ed6029cfd2390c09dc062f4159a2f103ce2ff9a3abe7427eea3ecf8157d` |
| `frontend/yellow/src/yellow-api.tsx` | `8b2ce9e44f669fe076a634c0473ec25a321896c6439b8f935a5e729546db2aad` |
| `frontend/yellow/src/workspaces/ReservationWorkspace.tsx` | `674338e6c0986528fd9a43902d5a3f1a3e1991543c0e3aa806ae540ffea17f8a` |
| `frontend/yellow/src/styles.css` | `7801611d096cdb70c59c998375ec41c9743f371bc6356c3980e4c1c835bd7f3c` |
| `tests/yellow-guided-checkout.test.ts` | `de24bce61e09e623f0d1b3272029fbde7b48807f3f85a70c626103e8db761caa` |

From the serving source I personally ran the focused test (`6 pass, 0 fail, 48
assertions`) and strict frontend TypeScript (`exit 0`).

## Runtime identity and rollback

| Surface | Independently observed identity |
|---|---|
| public app | `bf06576386483d3a0ff12a8b9605ed04348ba00e0081e6d9327fb82b7946a571` — running, healthy |
| app image | `sha256:8654e3b141d044c3d6ccbfe68ba965979e63b0f00ec3e5ee4490624df86df826` |
| rollback | `yellow-public-demo-app:pre-order588` = `sha256:46f4ff0b1ec0784f17f7f55dc196669437646d30499c5cab562feb1272928588` |
| PostgreSQL | `9f507e09cc387e7a96a436835a94d036338ed3acf87e70309031347c5ee48cb5` — preserved, healthy |
| Valkey | `781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b` — preserved, healthy |
| public tunnel | `e17219ecd7aa403a70d4f82a755c45aca51a6768a82d63a802bb6dadc1acc92a` — preserved, running |

PostgreSQL, Valkey and tunnel identities and start times match the independently
recorded Order 586 target. Only the app was recreated. I started the rollback image
with no network and hashed its `/app/public/yellow-next` files. Its prior
`index-BWmuxmPs.js`, `index-DSNtw9ll.css`, `ReservationWorkspace-qg_1XCNa.js`,
`FinanceWorkspace-DyGVscSv.js` and vendor hashes exactly match Review 586; the tag is
therefore a usable retention of the previously running app rather than a mutable-tag
assumption.

## Source, container, local and public asset identity

I hashed every one of the 13 generated files in the serving source, inside the
running container, over local HTTP, and over the designated public tunnel. All four
copies match for every file. Important changed assets are:

| Asset | Bytes | SHA-256 |
|---|---:|---|
| `index-DXfliSa3.js` | 190,951 | `3ad8c10e0174e021d704824b9219c3c9726c0d1a76d9eae0c2d790f8d2073bb7` |
| `index-DYJcEmQm.css` | 123,254 | `b73837b6e3d425048c670034e89e2a4b1388ca7203e2eb6074c830a2ae489a6a` |
| `ReservationWorkspace-CUsaIdaX.js` | 104,238 | `5277d634e4861a9861ea957ac160fe205fbcdf31a7dfc615b1423b9f138d4503` |
| `FinanceWorkspace-CAgIuQrC.js` | 57,144 | `0505adbfc6c18e835abc85f43f557dd12eaf178b513a5c742e5f25035b6636f0` |
| `index.html` | 672 | `559086ee6554897260bc4cc3ba0a5dc7b53b2a8fa0b171468d40aa786026b16e` |

Local and public `/health`, `/ready`, `/`, and the Locanda property Today route all
returned HTTP 200. The app entry remains under the 200 kB release boundary.

## Guarded actual-public browser proof

I personally executed the inspected Playwright/Chrome harness against the designated
public origin. A hard route guard allowed only `GET`, `HEAD`, `OPTIONS`, and the
existing automatic synthetic-session `POST /api/v1/auth/demo:enter`; it would abort
every other non-read request.

I explicitly entered `checkout Ella Clarke`, selected **Bill**, observed the full
itemized `Dessert` line, exact `SAR 1.00` balance and the `Resolve SAR 1.00 in Finance`
route. I then explicitly entered `checkout Rohan Kapoor`, selected **Bill**, and
observed the missing-primary-folio disclosure, its separate unchecked confirmation,
and disabled opening action. I never checked a confirmation or invoked folio,
settlement, checkout, luggage, minibar, damage, housekeeping, payment or other
operational action.

Observed non-read requests:

```text
POST /api/v1/auth/demo:enter
```

`blockedWrites`, console/page errors, failed requests and HTTP >=400 responses were
all empty.

| CSS width | document width | body width | tabs | selected | depth-card nodes | checked confirmations |
|---:|---:|---:|---:|---:|---:|---:|
| 1440 | 1440 | 1424 | 5 | 1 | 2 | 0 |
| 375 | 375 | 359 | 5 | 1 | 2 | 0 |
| 240 | 240 | 224 | 5 | 1 | 2 | 0 |

I personally viewed all four captures:

- `D:\Yellow\temp\order588-public-checkout-1440.png`
- `D:\Yellow\temp\order588-public-checkout-375.png`
- `D:\Yellow\temp\order588-public-checkout-240.png`
- `D:\Yellow\temp\order588-public-nonzero-375.png`

The selected tab is the single white pill with the exact thin yellow edge and a
restrained 18 px yellow glow, not an LED-bulb treatment. The ribbon remains gray;
the two low-contrast depth cards sit behind the work layer where space permits.
Both card nodes are `aria-hidden="true"` and `pointer-events: none`; at 240 px they
remain in the DOM but are intentionally visually suppressed. Controls remain
reachable, the selected Bill tab is visible, and no document overflows at any tested
width.

## Independent public-table preservation

Immediately before and after my own browser proof I captured all 129 public tables
inside independent `REPEATABLE READ READ ONLY` transactions. Every table's count and
ordered JSON-row MD5 stayed equal; the aggregate is unchanged:

```text
450726c50debfacbb2ab190be6adc20d41ec4fafc2e44b9d6ba5621064eb6268
```

Selected unchanged counts include `api_idempotency=117`, `folio=9`, `journal=2`,
`posting_line=4`, `reservation=654`, `space_occupancy=233`, `fact_log=1012`, and
`outbox=952`. The postflight comparison reports `changedTables=[]`, `equal=true`.

| Receipt | SHA-256 |
|---|---|
| `D:\Yellow\temp\order588-independent-prebrowser.json` | `36602ef04169dd065082510b0351589f60f10d3b5e7f5d3aa69e5560af36ba47` |
| `D:\Yellow\temp\order588-independent-postbrowser.json` | `46d18f57d62e8147d71ce5d31ae80947987dc55193a86b131c3d5d591a03ecf7` |

## Commands personally executed

```text
Get-FileHash <candidate and serving source files> -Algorithm SHA256
bun test tests/yellow-guided-checkout.test.ts
bunx tsc -p frontend/yellow/tsconfig.json --noEmit
docker inspect <app|postgres|valkey|tunnel>
docker image inspect yellow-public-demo-app:pre-order588
docker run --rm --network none --entrypoint sh yellow-public-demo-app:pre-order588 ... sha256sum
docker exec yellow-public-demo-app-1 ... sha256sum
in-memory .NET HTTP byte hashing against local and public origins
node D:\Yellow\temp\order588-public-qa.mjs
bun D:\Yellow\temp\astra586-db.ts preflight  D:\Yellow\temp\order588-independent-prebrowser.json
bun D:\Yellow\temp\astra586-db.ts postflight D:\Yellow\temp\order588-independent-postbrowser.json D:\Yellow\temp\order588-independent-prebrowser.json
```

## Finding and approval boundary

No Order 588 finding. The released app is the exact independently approved guided
checkout source, with target-bound asset identity, truthful itemized/missing-folio
states, responsive ribbon/card presentation, a clean no-write browser trace, retained
rollback, preserved supporting services, and all 129 public tables unchanged.

Approval is limited to this app-only UI/read release. Rendering the journey does not
mean that a guest was checked out or that any balance, room, minibar, damage,
luggage, housekeeping or cashier operation occurred.
