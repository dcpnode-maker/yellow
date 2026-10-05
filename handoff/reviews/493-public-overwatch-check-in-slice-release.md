# Order 493 independent target-bound release review

Date: 2026-09-20. Reviewer: **Codex Astra**, independent agent `/root/astra_review`; did not implement or deploy the release.

**Verdict: ACCEPT the bounded UI release's current-target postflight.** Running health, reviewed-source hashes, packaged/served artifact identity, rollback-image retention and the recorded database count fingerprint pass. This does **not** assert complete historical row-level preservation, contact-free share readiness, broader Order 492 completion or a tested rollback execution.

## Target and artifact evidence

Read Order 493 and accepted bounded review 492. Used deployment-checklist and Yellow Postgres skills for target identity, rollback, health and read-only database checks. No operational command, migration, seed, app recreation, tunnel change or data mutation was executed by this reviewer.

- App container: `76f1a2f9469d7744ee3e4aa5f7a3ac3686ea67de20102dfd45745674ac5ae30b`, `yellow-public-demo-app-1`, **healthy**, started `2026-09-20T10:32:14.441183716Z`; local binding `127.0.0.1:3010 -> 3000`.
- Current image: `sha256:f56881ebe6cd0ab43822b57b07c6dceaa315537c13643b9c2794db83100a22d7`.
- Rollback tag `yellow-public-demo-app:pre-order493` exists and resolves to `sha256:4d35a07207e9697491b2a1a1867e8bc7471e70d1e00d5a4e5acd12785a0a9165`.
- Current and rollback images each have 11 filesystem layers with the first **10 identical**; only the final layer differs. The inspected Dockerfile places the prebuilt `public/yellow-next` artifact in that final layer. This supports the UI-only filesystem delta; it is not an executed rollback test.
- All **245 packaged backend source files** in `/app/src` were hashed inside the running container and independently matched the current local build context. The runtime image intentionally does not carry frontend TSX or test source; frontend source hashes were checked in the build context, not falsely claimed as files inside the image.

The following local source SHA256 values remain exactly equal to review 492:

| File | SHA256 |
| --- | --- |
| App.tsx | `2BC65EFF3A7FC8B62451D26BBB56FC61AC3AD0B7ADC1BC2AC3CBA3270EF334D1` |
| styles.css | `A83BEC56EE4207847960151C0B24620B92381EF23F0AD4B992BADCBAC9115ECC` |
| yellow-voice-routing.test.ts | `D9987E40229C13935568A17FE8F6994257F1FF1A2CC898ECA766D720191D7039` |
| yellow-next-checkout-confirmation.test.ts | `A43A04EB71F1F52650C2F7E0D63D69F54E439D92DAA82CD96C39E71E0C673FFD` |

## Personally executed HTTP checks

GET only; no browser application JavaScript, automatic demo-entry POST or operational action was executed.

- `http://127.0.0.1:3010/health`: **200**.
- External `/health` at `https://apps-assessing-appreciated-malpractice.trycloudflare.com`: **200**.
- Local and external `/p/c02453b5-8efb-5413-bbd0-5cbb02c85c53/today`: **200**, redirect handling disabled, no Location header. Both returned the intended Yellow Next HTML, not an old-route redirect.
- Both HTML responses reference `/yellow-next/assets/index-pI9ua7_8.js`; both asset GETs return **200** and contain **LIVE ARRIVAL FLOW**.
- JS SHA256 is identical in the retained local build artifact, running container, local HTTP and external HTTP: `4e369bb5ddf4f8aa154ecc4870281bec83120b32d4a6f440e8b1d18879e110c4`.
- Packaged CSS `index-B2eBPfSF.css` SHA256: `cfe761f2017421d6c4b9f754960338de20d2fe18e1727086b74dca56bf62c4c1`.
- Packaged lazy asset `SignalOrb-B607p8zn.js` SHA256: `858288f83536bb10ab77f87d5dd233e479ee7e20f686e45ef2bcc1fcf6c76af4`.

External verification through the web extraction tool was unavailable; direct HTTP fetch from the review host succeeded and byte hashes were asserted there. No reproducible rebuild was performed during this read-only review; the binding is reviewed source hashes plus matching retained/container/served build artifacts and the observed UI-only image layer delta.

## Read-only database and backup proof

The database/Valkey containers are currently healthy and retain start times preceding the app recreation:

- Postgres container `eed5a07183d8c7bb28e172e947b0b83e38a0a27b78445e1db4d92a1205118405`, started `2026-09-20T10:00:27.612026441Z`.
- Valkey container `781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b`, started `2026-09-20T10:00:27.608527805Z`.

Executed target-bound psql with `PGOPTIONS=-c default_transaction_read_only=on`; independently confirmed the setting was **on**. Selected only migration metadata and aggregate counts, never contact values.

```text
migration=91; party=29; contact_point=3; payment_instrument=0;
journal=0; reservation=28; property=1
```

The property count is bound to exact ID `c02453b5-8efb-5413-bbd0-5cbb02c85c53`. These values match the preserved preflight in `handoff/questions/015-live-public-demo-contact-free-preflight.md` and the deployer's reported same-query preflight. Independently verified **91 ledger rows, contiguous versions 1–91, and all 91 source migration checksums equal live ledger values**. Nothing here implies migration 0095 is deployed; current target is explicitly **91**.

Backup receipt independently checked:

- `D:/Yellow/backups/yellow-public-demo-pre-reconcile-20260920-155230.dump` exists, 2,220,754 bytes.
- SHA256 `D72F9662A2B14CE4332D2ABCF78A644536B1770C9BDD13D452B6E59FB9F9ED61` matches Q015.
- PostgreSQL 16.15 `pg_restore -l` succeeds. Archive header reports **2,072 TOC entries**; listing has 2,068 selected numeric-entry lines. The differing totals reflect header versus selected listing, not a failed archive read.
- No restore, archive data extraction, upload or contact inspection was performed. Listing validates archive readability/metadata, not an independently executed full restore.

**Preservation limit:** the stored preflight is a count fingerprint, not full table/row hashes. Matching counts and current ledger checksums do not prove that every field or protected row remained unchanged historically. That stronger no-delta claim is explicitly withheld. Existing **three contact points remain**; Q015/Order 491's contact-free reconciliation gate remains unresolved and is not waived by this UI release.

## Command basis and disposition

Read-only commands personally executed included:

```text
docker ps --format <names/image/status/ports only>
docker inspect <app/postgres/valkey> --format <identity/start/health only>
docker image inspect yellow-public-demo-app yellow-public-demo-app:pre-order493
docker exec yellow-public-demo-app-1 sha256sum <static artifact files>
docker exec yellow-public-demo-app-1 sh -c "find src -type f -exec sha256sum '{}' ';'"
Get-FileHash <reviewed source files and retained backup>
pg_restore.exe -l D:/Yellow/backups/yellow-public-demo-pre-reconcile-20260920-155230.dump
docker exec -e PGOPTIONS="-c default_transaction_read_only=on" <postgres> psql ... -X -At -c <SELECT-only migration/count queries>
```

HTTP probes used direct fetch with `redirect:'manual'` and compared SHA256 bytes in memory. Docker environment credentials were not printed or used for external requests. The review confirms current availability and the bounded release artifact, not runtime operational success, mobile/browser behavior, whole-repository referee/CI, a completed check-in or the broader Overwatch/cashier roadmap. All release and database mutation authority remains separate.
