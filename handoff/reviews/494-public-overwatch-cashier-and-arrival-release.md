# Order 494 independent target-bound release review

Date: 2026-09-20. Reviewer: **Codex Astra**, independent agent `/root/astra_review`; did not implement or deploy this release.

**Verdict: ACCEPT the bounded current-target artifact/health/source-test/count postflight; WITHHOLD complete release-review closure pending rendered browser navigation proof.** No product defect was identified in the reviewed path. The requested browser check could not execute because neither browser-act nor CUA exposed an available browser. Source inspection/static regression is not represented as that browser proof.

## Personally verified target

- App `yellow-public-demo-app-1`, container `a97ee9cfa596198db535214d3ad3a62fbcb72c715a6bfff9e622d3c5e7b56a80`, healthy, started `2026-09-20T10:55:56.292854773Z`; loopback `3010 -> 3000`.
- Current image `sha256:a591f2ca1045b6af0f525ffa18a5ac3aebc4385c4f78e43b4100837944144e61`.
- Retained rollback `yellow-public-demo-app:pre-order494` resolves to `sha256:f56881ebe6cd0ab43822b57b07c6dceaa315537c13643b9c2794db83100a22d7` (the accepted Order493 image).
- Current/rollback images have 11 layers each, with 10 identical at matching indexes. Rollback availability is verified, not an executed rollback.
- Local and current external `/health`, `/p/c02453b5-8efb-5413-bbd0-5cbb02c85c53/today`, and `/yellow-next/assets/index-1SC2i66X.js` each returned **HTTP 200**, with redirects disabled.
- Local and external Today HTML reference that exact bundle and share SHA256 `550466A395B08B634C9EA2E8C5A17B90982546607499E2AC6AE79CD224D859C2`.
- Retained build-context bundle, running-container bundle, local HTTP bytes, and external HTTP bytes all share SHA256 **`9454208BBE3E3A8D078D6B81A016932D6B1034D22B84407806A8E41B0968D847`**. Both served copies contain **`Post confirmed charge`** and **`LIVE ARRIVAL FLOW`**.

## Personally executed source proof

Runtime source: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

| File | SHA256 |
| --- | --- |
| frontend/yellow/src/App.tsx | `837EB1BC398E4AB506BC0EC63C7F1A94D0EDF8AB5D84A490FFE8D1B73D0A3F4F` |
| frontend/yellow/src/styles.css | `1F4D00089A6C08679FCAB2F953458E1E4E18428BCBD3540D295D899F566856C3` |
| tests/yellow-next-finance-workspace.test.ts | `724C596CEDE7B451FA93DC5CE803B08B0CE0BDE465DC9DE91693735B89344C83` |
| tests/yellow-voice-routing.test.ts | `4F207FD8EF8C89C8A918D897E0657D01EE63498B51618FF41409405345FEAFBA` |

```powershell
bun test tests/yellow-next-finance-workspace.test.ts tests/yellow-voice-routing.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-next-public-surface.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx tsc --noEmit
bun D:/Yellow/temp/astra-order492-cashier-review-20260920/component-proof.ts
```

Results: **17 passed / 0 failed / 88 assertions**, no skips; both typechecks exit **0**; retained independent controlled-component harness exits **0**. The expected 16-test count was stale: the new dashboard-arrival routing regression makes 17. Harness re-executes current extracted cashier code and passes server-only options, explicit consent, same-candidate retry key/body, edit/folio reset, denied/unavailable statement, no false success, and exact canonical helper payload/headers. It is not browser/React DOM proof.

At App.tsx lines 1794–1805, the dashboard `review(stay)` sets the Overwatch dialog and a card with `checkInReservationId: stay.reservationId`, rather than navigating to the old `workbench=check-in` route. `LanePanel` calls it for due-in Prepare check-in. The dialog renders the existing keyed `OverwatchCheckInJourney`. The added static regression checks this route. Cashier styles/test hashes still match the accepted Order492 cashier review. These checks do not falsely claim the changed App.tsx is byte-identical to that earlier review.

## Read-only database and retained backup

The database and Valkey container identities/start times match the previous independent Order493 receipt and predate the app recreation:

- Postgres `eed5a07183d8c7bb28e172e947b0b83e38a0a27b78445e1db4d92a1205118405`, `2026-09-20T10:00:27.612026441Z`, healthy.
- Valkey `781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b`, `2026-09-20T10:00:27.608527805Z`, healthy.

Used target-bound `docker exec ... psql -X -At` with `PGOPTIONS=-c default_transaction_read_only=on`, independently confirming **on**. Connection identifiers were resolved in-process from container configuration, not printed. Selected only migration metadata and aggregate counts:

```text
migration=91; party=29; contact_point=3; payment_instrument=0;
journal=0; reservation=28; property=1
```

Property is bound to exact `c02453b5-8efb-5413-bbd0-5cbb02c85c53`. Counts match Q015 and the prior independent receipt. Independently checked **91 contiguous ledger rows, versions 1–91, zero source-checksum mismatches**. An initial SELECT used the incorrect column name `checksum` and failed read-only; the corrected `checksum_sha256` query passed with explicit row-count/contiguity/hash assertions. The failed query is not counted as successful proof.

Retained backup `D:/Yellow/backups/yellow-public-demo-pre-reconcile-20260920-155230.dump` independently rehashed to `D72F9662A2B14CE4332D2ABCF78A644536B1770C9BDD13D452B6E59FB9F9ED61`, matching the previously archive-listed receipt. No restore or archive-data extraction was performed here.

**Preservation limitation:** matching aggregate counts/container identities/current ledger hashes is not a full historical row-level no-delta proof. There is no persisted full protected-table preflight fingerprint; that stronger assertion remains withheld. Three existing contact points remain; this release does not waive Order491/Q015 contact-free sharing gates.

## Browser blocker and scope

Browser-act skill/CLI discovery returned no configured browsers and no active sessions. CUA `createBrowserTab("iab", <requested Today URL>, {visible:false})` returned **Browser is not available: iab**; `listBrowsers()` returned **[]**. Native computer UI is disabled in this tool environment. No browser session was successfully opened, no automatic login was executed, no confirmation was checked, and no check-in/charge was posted. An independent reviewer with an available browser must still open the Today Prepare check-in action, observe the embedded Overwatch journey and canonical blockers with unchecked confirmation/disabled commit, and record the result before claiming that specific rendered gate passed.

Read PROJECT.md, Order494, relevant accepted reviews and Q015; used review/deploy-checklist and Yellow Postgres patterns to separate source, artifact, current-state and preservation claims. Browser skill discovery caused the explicit browser-proof limitation above. `bash ./state.sh` could not run because the installed WSL relay has no `/bin/bash`; this was recorded rather than represented as a passed repository gate.

Reviewer issued only read-only Docker inspection/exec checks, HTTP GETs, source tests/typechecks and this review record. No source change, image build/recreation, tunnel/configuration change, migration, seed, direct DML, operational command or live financial action was executed. No whole-repository referee, browser/mobile E2E, full Order492 completion, restored-backup execution or historical full-data preservation claim is made.
