# Order574 independent public postflight — ACCEPT

Reviewer `/root/astra_review`,2026-09-21. Read Order574 and independently accepted Review573 R2. Read-only target-bound review; no deployment, restart, migration, preview, transfer, charge, approval or other public financial operation performed.

## Exact artifact and identity

Personally executed `Get-FileHash` on the four serving-source files. They still equal Review573 R2: App `96129B47CAD39839765588DC30ED67B9C94921643483A66C7608C438C489CFE0`, CSS `436C2B4FD537A48EBB001AD7FECF405021D4E3EF3D919117282EA72D2A0AC5EB`, allocation test `F90490FA978201AE1DB7AFD30FEBD6FA3379DD43FAE4F969822B142D18E96CB8`, finance test `184B18542D779C8F60424ECD59C3231E4B43F97E93B7C71E4B4F328341A717BA`.

`docker inspect --format` and bounded `docker exec` reads verify:

- Healthy app container `659235d14e2339e3798454c14c23efa189bbb1906ea539cff4e928761b659e81`, image `sha256:16038318b5494720736c4b8403f324a922470cb649e16a815dcc671ff0327d5a`.
- Build revision `a043bb29d64b5c3e555d46dc8263f85992e5dca2`: valid40-character revision. This governance revision alone is not a content digest; source/build/served artifact hashes below establish content identity.
- PostgreSQL `9f507e09cc387e7a96a436835a94d036338ed3acf87e70309031347c5ee48cb5`, healthy.
- Valkey `781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b`, healthy.
- Tunnel `e17219ecd7aa403a70d4f82a755c45aca51a6768a82d63a802bb6dadc1acc92a`, running.

All three non-app IDs exactly match the prior recorded baseline. Container frontend source paths are absent, as expected for the packaged app; an attempted source hash read reported missing files. No claim of container TS-source parity is made. Instead, `docker exec yellow-public-demo-app-1 sha256sum /app/public/yellow-next/assets/index-C8aUx2B_.js /app/public/yellow-next/assets/index-NPwD1YbL.css` matches the independently built local artifacts and both served origins:

- index-C8aUx2B_.js: `FEC80191FD294D7EE83333D3492326A7814D74D97EBF4BDE2844F661F57460F1`.
- index-NPwD1YbL.css: `C28C99613A069CA370068D39F81B327E9171B708FA4346179821196BBA17C450`.

`bun D:/Yellow/temp/astra566-http.ts` reused read-only: local3010 and public origin health/page both200; JS/CSS plus rolldown/react/vendor assets all200 with exact byte-hash parity. Actual public origin: https://editing-alto-artists-quilt.trycloudflare.com .

Optional rollback-tag observation: `docker image inspect yellow-public-demo-app:pre-order574` reports no such image. Order574 did not specify a new rollback tag, so this is disclosed, not represented as verified rollback coverage or a new acceptance condition.

## Actual published browser

`node D:/Yellow/temp/astra574-public.cjs`: exit0. No candidate substitution or financial fixtures. Installed Chrome/Playwright opens public Today, activates Yellow and submits only the read command **Open cashier for Omar Siddiqui**. Network guard allows GET/HEAD/OPTIONS and automatic demo-session entry only; any other method would be aborted. **Zero operational requests attempted, zero page errors.** No selection, confirmation, amount, reason, preview or transfer entered.

- Actual current L3R-DI-0015 in-house cashier; immutable L3R_LAUNDRY row shows SAR25, quantity1.000, business-date2026-09-21 and running balanceSAR25.
- Exactly1 eligible complete group,1 immutable member, all checkbox/radio controls unchecked. New named-window, bounded name/reason inputs and complete-group preview/commit controls present. Preview and Confirm both disabled before selection/consent.
-375×812: document width/scrollWidth375/375.1440×900:1440/1440. Label/button targets measured minimum44px, within their containing panel at both sizes. Desktop and phone workbench remains internally scrollable rather than overflowing horizontally.
- Public DOM loads the exact accepted index-C8aUx2B_.js/index-NPwD1YbL.css assets.

Screenshots: `D:/Yellow/temp/astra574-public-375.png` (personally viewed) and `D:/Yellow/temp/astra574-public-1440.png`. New-window creation and existing-window transfer were not exercised publicly; their independent intercepted/isolated proof remains Review573, not duplicated as a live action.

## Independent no-mutation proof

`bun D:/Yellow/temp/astra574-db.ts` personally run before and after browser verification. Privately loads designated public deploy authority in process memory; asserts expected loopback target; enters **REPEATABLE READ READ ONLY** and tenant-local scope. No credentials/raw guest data logged.

Reads all129 public base tables using the same retained Review566 postflight formula: count plus MD5 of full row JSON text sorted lexically and joined with `|`. Both runs match **every count and every per-table fingerprint**, with no changed tables against the retained independent post-charge baseline `D:/Yellow/temp/astra566-postflight-receipt.json`. Aggregate SHA256 before/after/baseline all:

`9eb12c723a3e9b049a39e993ae16ba4349a784913bfcfe4544fbf99fd4c158b5`.

Safe counts: schema_migration97,folio8,journal1,posting_line2,payment0,payment_operation0,document0,reservation654,space_occupancy233. Thus unchanged non-app containers are supplemented by actual full-table read-only preservation evidence, not mistaken for it. Scope is committed state at these snapshots; no claim about unobservable transient rolled-back work.

**ACCEPT Order574's exact public app-only release and read-only bill-window affordance.** No public financial action is authorized by this verdict. No whole-PMS, complete settlement/fiscal flow or new rollback-retention claim. Reviewer changed only this review and external read-only proof artifacts.
