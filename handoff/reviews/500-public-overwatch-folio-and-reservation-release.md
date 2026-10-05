# Order500 independent public-release postflight

Date: 2026-09-20. Reviewer: **Codex Astra**, independent agent `/root/astra_review`; did not implement or deploy this release.

**Verdict: ACCEPT the bounded artifact/health/source-control postflight.** The retained build, running container and served public JS match, current focused tests/types pass, and Order496's separately reviewed controls remain present and execute correctly in the retained no-network component harness. This is not rendered-browser, public operational, full-database-preservation or broader-product acceptance.

## Current target and artifact identity

- Container `yellow-public-demo-app-1`: `0ecf587fcaa171c3d3bc82e556f4d35aef84b153a438d3b21f2bdef5769fdcfd`, **healthy**, started `2026-09-20T11:28:35.404488227Z`, bound `127.0.0.1:3010 -> 3000`.
- Image `sha256:0e71b467adce5e9a51b1676644769734416a18d284ca09f687c45c2cb6c0bda8`.
- Rollback tag `yellow-public-demo-app:pre-order500` exists, resolving to `sha256:a591f2ca1045b6af0f525ffa18a5ac3aebc4385c4f78e43b4100837944144e61` (Order494 target).
- Both images have 11 layers; 10 matching-index layers are identical, supporting a final-artifact-layer-only image change. No rollback was executed.
- All **245** packaged `/app/src` backend files were hashed inside the running container and match all **245** current build-context backend files, with **zero mismatches**.

Public base used: `https://apps-assessing-appreciated-malpractice.trycloudflare.com`.

Personally executed GETs with redirects disabled against **both** local and public bases: `/health`, `/p/c02453b5-8efb-5413-bbd0-5cbb02c85c53/today`, `/p/c02453b5-8efb-5413-bbd0-5cbb02c85c53/reservations`, `/yellow-next/assets/index-CUynMCE-.js`. All **eight requests returned 200**. Both pages reference the intended current bundle, not a legacy-route redirect.

| Artifact | SHA256 |
| --- | --- |
| Today/reservations HTML, local and external | `1BCB34903158DF97E1E19EA5614DAF3E7478F6C00CCE0FEE0CCD83059084F9DE` |
| index-CUynMCE-.js | `51B6560DB4688544FEA363D6B1D7701B7AAEFF77911E2B8299AE38BBA6D480AA` |
| index-pWeDzxNw.css | `40A07D3F945322ADB08E9426442F1195317B68D31A9C0FC8244E331E14DF9133` |
| SignalOrb-v-pZrBTM.js | `73A988F4F8EA307F0CA46741E83FE37A2AC43BC624A062739A3C23AB8EED4B59` |

Main JS hash is identical across retained local build, running container, local HTTP and public HTTP bytes. CSS/lazy asset hashes independently match retained files and running container. Served main JS contains `Open confirmed primary folio`, `All returned states`, and `LIVE ARRIVAL FLOW`.

The runtime image does not contain frontend TSX/tests; their hashes below are build-context source, not falsely attributed to packaged source. No reproducible Vite rebuild was performed in this read-only postflight. Source-to-artifact attribution therefore comprises the inspected current source/control tests, retained artifact, matching container/served bytes and image-layer evidence—not a signed/reproducible-build attestation.

## Source/control verification

Runtime root: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

| Source | SHA256 |
| --- | --- |
| frontend/yellow/src/App.tsx | `2C2BACDF42D75AF6B75545A5A3341170448BA451DEBFDF7F7D9E54CD7978682D` |
| frontend/yellow/src/styles.css | `CABA312B6604BA67233BC6EDB5530FC78A2344D40A3A0D1473BEC47B7F3DDD03` |
| frontend/yellow/src/voice.ts | `8FB789877734FF5918A692D15883FA408BD609E11E7767B59B120C155F4980BD` |
| tests/yellow-voice-routing.test.ts | `1764C1814038088B2B0AE0639E408DAB4F512E4E051B646C67FDC0F6A0AD0987` |
| tests/yellow-reservation-command-surface.test.ts | `40898F024AF6376CED7996E4AC11EFA4C13B7C04251616904DD0A05AA90B0F0B` |

Personally executed from that root:

```powershell
bun test tests/yellow-voice-routing.test.ts tests/yellow-reservation-command-surface.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-next-mobile-navigation.test.ts tests/yellow-next-public-surface.test.ts tests/yellow-next-runtime-packaging.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx tsc --noEmit
bun D:/Yellow/temp/astra-order496-primary-folio-review-20260920/component-proof.ts
```

Results: **24 passed / 0 failed / 135 assertions**, no skips; both typechecks exit **0**; independent retained component/helper harness exit **0** against the current source. That harness uses only mocked network/hook/query dependencies and executes no database or public action.

Verified Order496 boundaries remain intact: current due_in plus exactly the sole `primary_folio_not_open` blocker, null primary folio, clean/inspected room and identity readiness; separate folio consent; stable per-mount candidate key; exact empty-JSON canonical primary-folio POST with bearer; success and denial refetch detail/readiness and clear consent; no automatic check-in or optimistic financial state. Independent genuine PostgreSQL/API proof remains the separately recorded Order496 review; no new public write was needed or performed.

Reviewed Order497's board/row and helpers: search/filter modify only local state; expansion enables the existing authenticated reservation-detail GET; no mutation helper is called by search/filter/expand. Stored `in_house` is explicitly **In house / In house · occupied**, never mislabelled Stayover or Checked in today. Named reservation navigation uses URLSearchParams for query/focus into that same board. Empty/loading/error states and returned folio/guest/segment data are handled without constructing a second record. Source CSS has the phone-width layout rules; static assertions are not a rendered viewport test. Search is across the up-to-100 **returned** board records, not proved to be exhaustive server-wide search.

## Read-only boundaries and limitations

Database/Valkey container identities and start times remain the same as the prior review and precede app recreation; both are healthy. This check used Docker metadata only—**no database query or data fingerprint was taken for Order500**. Consequently this review does not assert current contact-free status or historical data preservation. Previous Q015/Order494 evidence recorded three contact points; the order's reference to a contact-free fixture must not be promoted into whole-target contact-free certification without its separate evidence.

No browser session or application JavaScript was opened/executed in this postflight. Prior tool discovery found no available CUA/browser-act browser, and this bounded request was completed with GET/source evidence. The order's rendered-browser postflight must be separately documented; it is not certified by this review. No folio-opening/check-in/charge action, automatic demo-entry POST, seed, migration, build, recreation, tunnel change, deployment or public mutation was performed.

Read PROJECT.md and Orders497/500, reused the prior independent Order496 review, and used code-review/deploy-checklist guidance to distinguish health, source, artifact and operational claims. `bash ./state.sh` failed because the WSL relay has no `/bin/bash`; no ritual/referee success is inferred. No whole-repository CI, 11-invariant referee, Gemini Live, full PMS catalogue, allowance/splitting, messaging/F&B or full Order492 completion is claimed.

Read-only command basis: `docker ps`, narrowly formatted `docker inspect`/`docker image inspect`, `docker exec ... sha256sum` and `find /app/src ... sha256sum`, `Get-FileHash`, direct `Invoke-WebRequest -MaximumRedirection 0`, the source tests/typechecks above. Only this review document was written.
