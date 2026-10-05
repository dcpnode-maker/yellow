# RELEASE-20261001 — local release gates and integration checkpoint

Phase7; founder-authorized continued Yellow build. Basis51d3f47bb706f641bd68027b445c060bdcf91d69,
derived from accepted6b0be81/e06. Branch phase-7/release-local-gates-20261001.
Laptop CompSet stays separate. No full PMS/CRM, all-phase or live-release claim.

## Exact initial source scope

- setup.sh
- setup.ps1
- tests/setup-current-catalogue-oracle.test.ts
- tests/migrate.integration.test.ts
- tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts
- handoff/questions/PROOF-20260930-current100-catalogue.md
- handoff/orders/PROOF-20260930-current100-catalogue.md
- handoff/reviews/PROOF-20260930-current100-catalogue.md
- .codex/config.toml
- frontend/yellow/vite.config.ts
- tests/yellow-frontend-bundle-splitting.test.ts
- tests/helpers/chromium-path.ts
- tests/chromium-path.test.ts
- tests/order609-reservation-create-edit.browser.test.ts
- tests/order610-reservation-transitions.browser.test.ts
- tests/yellow-ai-speech-consent.test.ts
- tests/yellow-departure-coordination.browser.test.ts
- handoff/questions/RELEASE-20261001-local-gates.md
- handoff/orders/RELEASE-20261001-local-gates.md
- handoff/reviews/RELEASE-20261001-local-gates.md
- DECISIONS.log
- handoff/LEDGER.md

## Bounded changes

Root composes the eight reviewed catalogue paths by frozen627905f bytes and appends
only its accepted decision/ledger records. All migration/schema/referee bytes and
historical fixtures remain unchanged. No new domain, authority or database logic.

A bounded worker restores .codex/config.toml to the accepted valid empty
[mcp_servers] template. Unchanged project-mcp-config tests must reproduce baseline
RED and pass after; all malformed/duplicate/control-character/parent assertions
remain. Do not inspect/print credential values or launch any removed server.

A separate bounded worker adds one higher-priority Rolldown group matching exactly
frontend/yellow/src/App.tsx and strengthens the existing config assertion. Preserve
strict budgets and React/vendor groups. App/main/workspace/authorization bytes are
protected. Build only to a temporary directory first, report every output hash and
entry/per-chunk/initial-gzip size. No initial-load performance improvement claim.
Root admits exact generated public/yellow-next paths before copying built files.

The browser worker adds a shared Windows/PATH Chromium resolver and meaningful
pure discovery checks, then replaces only four Windows-only path arrays. Retain
every existing browser scenario, assertion, request boundary, deadline and cleanup
budget. Root diagnoses/provisions a working task-owned browser runtime separately.
No fake Windows installation paths, new skips or weakened browser checks.

## Proof and review

Run independent baseline/candidate MCP and discovery proof, fresh build strict
budgets, actual reservation create/lifecycle, departure and consent browser tests,
and inherited invoice/seal/carry/geometry browser cases in their existing budgets.
Full default standing must complete; skips remain explicit environment skips.
Types/import boundaries, actual67-package licence audit, vulnerability audit,
unchanged canonical setup11/11 and applicable schema/source checks must pass.
Independent non-implementer personally executes tenant/auth proof and browser
acceptance before source release acceptance; no reviewer implements reviewed code.

Use finite disjoint workers and safe receipts outside the repository. Root owns
this order/governance, scope amendments and exact composition. Workers do not edit
shared governance, launch children, push, commit or touch unrelated source.

Laptop integration means a reviewable exact-basis source/asset checkpoint and
protected-file patch separation until the current dirty laptop subset is supplied.
Fetch ordinary GitHub refs; never overwrite/bulk-commit that dirty checkout. Record
source/live revision and readiness gaps. Do not claim local integration or runtime
deployment from a cloud source proof. Before commit/push show finite scope/result;
PR only after applicable green proof, no self-merge or deployment.

Quota: latest direct founder permits build under laptop monitor; last reported20%
remaining. Cloud has no direct usage reader or hardcap. At<=1%notification safely
checkpoint/stop own agents/jobs and new dispatch. No emergency-credit fallback,
purchase/reset/automatic resume. All external services remain free/task-owned.

## Exact generated artifact scope amendment — before import

Static entry1130B; everyrootJS<500000B. SourceApp is unchanged. Existingrootasset replacements/deletions and newrootassets below are admitted; never copy nested yellow-next or .vite metadata.

- `public/yellow-next/index.html` — 763B SHA256`9e9c8face33452cbff3ea38599007f86735f696944956dcdb726cbe25f877379`
- `public/yellow-next/assets/EcosystemHub-m19y8MIL.js` — 43038B SHA256`e600f5da53b6ef4bb3622a27ef4ed001efeb55aad630147181dc23e273d87950`
- `public/yellow-next/assets/FinanceWorkspace-D6SetHPv.js` — 58301B SHA256`ea3bf1c181c987feffba14add6eddc2211c46de11b0fb3303b9ddc2385f4eab3`
- `public/yellow-next/assets/MarketIntelligenceLab-D8xXfplT.js` — 9891B SHA256`fc71b5c71b86d2f5198eb57b82a7746c9404517c4be2914d5c96e3c3eafa54b9`
- `public/yellow-next/assets/OperationalHub-C4PLubB-.js` — 16317B SHA256`c824a128a1b7735ce6e7f1d3a076efd98fa96294f01a9a02c150a3e0822fef57`
- `public/yellow-next/assets/OptionsDrawer-dMchDoxL.js` — 1659B SHA256`30ff61fe2b41bde7f02329b813bfab4ddfcd4612fad6a1573147734d662caf97`
- `public/yellow-next/assets/ReservationWorkspace-CcS-4wK2.js` — 139612B SHA256`f712bc404db4a455644efbd8b1a29a4bb6d8e140f85c80ebe2d9b1e031ace695`
- `public/yellow-next/assets/StatusBadge-xxCcJK5f.js` — 2046B SHA256`c167ddb283232f45281e59cf46a8582a06be42ad94fb30dd7e7394e2736f7500`
- `public/yellow-next/assets/index-BouTXLBQ.js` — 1130B SHA256`6f65622d61d5a58e7fbc46b0b7169d9341300161e182c022b4867117d4d60e9e`
- `public/yellow-next/assets/index-D1zeL5we.css` — 145295B SHA256`8c7a72baba49403e8f137d979b23eef3e9f698dae5c6ed21474a31665ba806ca`
- `public/yellow-next/assets/react-runtime-Djwaxmnb.js` — 210628B SHA256`77458de6aef68807fbab2f386b52ca263a09dbb0552f12e819126c45b9ee3841`
- `public/yellow-next/assets/rolldown-runtime-hePW80VL.js` — 716B SHA256`580ad8c58061a4dde99bde0a56905e382f0568516ee2f5b84dbfb52085709021`
- `public/yellow-next/assets/vendor-OIZ7_LZo.js` — 13641B SHA256`c39041455e216d10459397af3bcd5d7ea3f317acd5cc7bf35bd10232d4d233c2`
- `public/yellow-next/assets/yellow-app-BxTr3_3J.js` — 372849B SHA256`4c6f1611e34624b0fec851016f32dba8c57d04953282bca5bb6d3ed3d1aac0f5`
- `public/yellow-next/assets/EcosystemHub-EDFkSayR.js` — remove superseded tracked build file
- `public/yellow-next/assets/FinanceWorkspace-CXh0JO34.js` — remove superseded tracked build file
- `public/yellow-next/assets/MarketIntelligenceLab-BCj8VG4l.js` — remove superseded tracked build file
- `public/yellow-next/assets/OperationalHub-DyYEhd6J.js` — remove superseded tracked build file
- `public/yellow-next/assets/OptionsDrawer-BJ5GciDZ.js` — remove superseded tracked build file
- `public/yellow-next/assets/ReservationWorkspace-CuqJRPi9.js` — remove superseded tracked build file
- `public/yellow-next/assets/StatusBadge-Dav-a6et.js` — remove superseded tracked build file
- `public/yellow-next/assets/index-BZRdwTST.js` — remove superseded tracked build file
- `public/yellow-next/assets/react-runtime-CR5VJ85Q.js` — remove superseded tracked build file
- `public/yellow-next/assets/vendor-CNqRKreC.js` — remove superseded tracked build file

## Published d708 source reconciliation — scope admitted before copy

Twelve exact paths reuse the published e06 descendant d708ff29. React hook order, CDP-data invocation, current100 readiness/acceptance and associated proofs/records are preserved. No weaker auth or new grant/migration.

- `frontend/yellow/src/workspaces/ReservationWorkspace.tsx`
- `handoff/orders/PR-FIX-001-open-pull-request-repairs.md`
- `handoff/reviews/PR-FIX-001.md`
- `scripts/local-review.sh`
- `src/kernel/build-info.ts`
- `tests/build-readiness.integration.test.ts`
- `tests/build-readiness.test.ts`
- `tests/cdp-invoke.test.ts`
- `tests/helpers/cdp-invoke.ts`
- `tests/database-acceptance.integration.test.ts`
- `tests/operator-folio-separate-charges-label.intentional-red.test.ts`
- `tests/order611-operational-timeline.test.ts`

Three already-scoped browser tests reuse published CDP/action-fixture hunks while retaining new platform resolver. Current100 migration tests/oracles retain stronger approved627905f bytes. Rebuild affected generated artifacts to an isolated temporary directory, then admit exact paths before import. A zero-tree-change local ancestry join to d708 may be recorded after source review; no PR merge, history rewrite, laptop overwrite or deployment.

## Final generated artifact frontier — admitted before reimport

Build includes the preserved published d708 hook-order repair. Static entry and every JS retain strict budgets; root App remains unchanged. Earlier generated frontier is historical.

- `public/yellow-next/index.html` — 763B SHA256`5d75d16ea5e8c444e9904529251b25c9a8f93d45af9d0092d709e41f408b580c`
- `public/yellow-next/assets/EcosystemHub-CQ8V9z1H.js` — 43038B SHA256`e17d49040da380a35edb1e1a1029676a6a48cc88b55814cfeece78b074fb0573`
- `public/yellow-next/assets/FinanceWorkspace-CDi8-L7A.js` — 58301B SHA256`c6a42e9d46c9460e9a76c8c47063f259bf8adc252910c177b1b700fdd911c64d`
- `public/yellow-next/assets/MarketIntelligenceLab-D37DcWhA.js` — 9891B SHA256`03d06361f1d8da8ff8072449fb10987bf21506100315d53cc2994c2e3c0883ee`
- `public/yellow-next/assets/OperationalHub-D_iEuzyX.js` — 16317B SHA256`c81d6def4ad0bb58859d3f8978f34df6d8b2a9f944e6cf71ea8ade50931e1bac`
- `public/yellow-next/assets/OptionsDrawer-D-YbGgGk.js` — 1659B SHA256`df618f3213cac3264fe8eb1bc7b5d0f67cd0834620a44cd930109d61f25bd7c6`
- `public/yellow-next/assets/ReservationWorkspace-wSlqY8Me.js` — 139571B SHA256`266e19dde4556f2c13ec03036a3505985fd765931aee2ce3fafadd17111fb973`
- `public/yellow-next/assets/StatusBadge-BVqcWEJO.js` — 2046B SHA256`b80c595c870f46fdb52e15fbba7cf919c050ce08259dfcbcb9f0456d390891a0`
- `public/yellow-next/assets/index-BSevgplG.js` — 1130B SHA256`5bc0b3e0bf02408529841f37583194f5ce95b8303cf1bfe96c92a4b9618adbf1`
- `public/yellow-next/assets/index-D1zeL5we.css` — 145295B SHA256`8c7a72baba49403e8f137d979b23eef3e9f698dae5c6ed21474a31665ba806ca`
- `public/yellow-next/assets/react-runtime-DRp6H2Fp.js` — 210628B SHA256`6cd6bc57a1afef739af1764e4fcf32972a6968c1f27944e15f544c1dab9ba6f9`
- `public/yellow-next/assets/rolldown-runtime-hePW80VL.js` — 716B SHA256`580ad8c58061a4dde99bde0a56905e382f0568516ee2f5b84dbfb52085709021`
- `public/yellow-next/assets/vendor-DD35e0mo.js` — 13641B SHA256`9b34c914149bca9d77db245b18674d6a074dcc5716f0bb5ed18065c7edd9e2aa`
- `public/yellow-next/assets/yellow-app-C73-485U.js` — 372851B SHA256`f48aa24ccadc21fc674332a64f658ecead82df77d02dad9718927c59af9f3a04`
- `public/yellow-next/assets/EcosystemHub-m19y8MIL.js` — remove prior admitted temporary generated file
- `public/yellow-next/assets/FinanceWorkspace-D6SetHPv.js` — remove prior admitted temporary generated file
- `public/yellow-next/assets/MarketIntelligenceLab-D8xXfplT.js` — remove prior admitted temporary generated file
- `public/yellow-next/assets/OperationalHub-C4PLubB-.js` — remove prior admitted temporary generated file
- `public/yellow-next/assets/OptionsDrawer-dMchDoxL.js` — remove prior admitted temporary generated file
- `public/yellow-next/assets/ReservationWorkspace-CcS-4wK2.js` — remove prior admitted temporary generated file
- `public/yellow-next/assets/StatusBadge-xxCcJK5f.js` — remove prior admitted temporary generated file
- `public/yellow-next/assets/index-BouTXLBQ.js` — remove prior admitted temporary generated file
- `public/yellow-next/assets/react-runtime-Djwaxmnb.js` — remove prior admitted temporary generated file
- `public/yellow-next/assets/vendor-OIZ7_LZo.js` — remove prior admitted temporary generated file
- `public/yellow-next/assets/yellow-app-BxTr3_3J.js` — remove prior admitted temporary generated file

## Scoped Order610 wait clarification

Real browser exposed null document.body during drift reload. In the already-scoped test, wait for complete DOM, exact requested query/scenario and body text before action. Preserve all zero-write/replay/state/geometry assertions and60s deadline. Stronger current-page guards prevent acceptance of a previous document; no skip/retry/budget change.

## Independent platform-proof correction

The already-scoped chromium-path tests explicitly select the host's Windows/POSIX rules without probing real macOS applications. Windows accepts regular candidates; POSIX requires execute permission. The empty-candidates assertion uses empty Windows paths/environment. This addresses the independent review finding without changing resolver behavior or skipping tests.

## Executed full-standing findings: exact fixture admission before edits

Full standing completed2506pass/1578skip/5fail/44913assertions. Current100 launcher/setup is correct; two stale source assertions still require99. Two Order609/610 module fixtures assign window over an existing configurable read-only fixture. Admit only the following four test paths to update current-frontier expectations and declare/restore their own configurable browser stub. Preserve all domain/host/runtime assertions and every test scenario. The unchanged detached-process test is executed through an external Linux child-subreaper to reap task-owned orphans because this container's PID1 is tail; no process-test/helper changes or relaxed deadline.

- `tests/free-host-arm64.test.ts`
- `tests/release-workflow.test.ts`
- `tests/order609-reservation-create-edit.test.ts`
- `tests/order610-reservation-transitions.test.ts`

## Executed canonical acceptance/readiness and API isolation findings

Additional real owned PG18 proof found12 acceptance failures: pinned0099 expected checksum stale versus immutable e06 bytes, and eleven full constraint censuses include new PG18 NOT NULL rows already separately checked by exact attnotnull vectors. Correct only the already admitted database-acceptance test: frozen0099 checksum, exclude contype='n' from these full structural counts while preserving named constraints and exact nullability. Required-readiness first upgrade assertion expects90–91 but actually applies90–100; list every exact immutable filename, retain all historical prefix gates/body/ACL/tenant hostile proof. No runtime guard, schema, migration, grant or body hash change.

Default full standing under the owned subreaper now2517pass/1578skip/1fail: Order610 reuses cached yellow-api demo session from neighbouring tests. Give only that test fixture a fixed module query identity so its existing fresh-authentication assertion stays intact; do not remove auth checks or serialize the standing command.

## Executed permission-catalogue fixture correction

Real current100 acceptance now23pass/1fail: current permissions are24, not inherited21; the three additional canonical97/98 folio-series/property-profile entries explain the difference. Preserve zero role grants and add an exact sorted24-code vector so unexpected substitutions fail, rather than updating only a count. All entries are traced to immutable applied migrations; no permission/grant writes are introduced.

## Inspected CI launcher frontier: one exact path admission before edits

Existing CI boots the complete current deployment and still expects ready.frontier91 while canonical source/readiness prove100. Admit `.github/workflows/ci.yml` only for that one numeric readiness assertion; update the already-scoped free-host contract's workflow expectation. Preserve job conditions, permissions, runner identities, image/provider settings, secret handling, all native prefix/sandbox/hostile proof and deadlines. No CI job dispatch, publishing or deployment is performed by this edit.

- `.github/workflows/ci.yml` — sole inspected full-current readiness frontier91→100 assertion.

## Executed source outcomes and final review boundary

MCP guard, strict build sizes and real browser lifecycle now pass. Root defaultstanding2518pass/1578explicitDBskips/0fail/44975; required current100 acceptance24/0/75, direct-runtime hostile readiness35/0/329 and unchanged canonical11/11. The source-specific final standing/static receipts and independent nonimplementer review bind publication. Browser/runtime binaries and private authority stay outside Git. The external Linux task-owned subreaper is required on this PID1-tail container to reap orphaned fixture grandchildren; no process test/helper, deadline, concurrency or skip changes.

Imported14rootassets match exact final admission. Independent fresh builds pass strict budgets but may minify the generated Vite preload helper differently; receipt records hash variation, not reproducible byte identity or an initial-transfer benefit.

No local app is labelled with a dirty-source GitSHA. A clean reviewed commit may be joined to d708 by a recorded zero-tree ancestry commit after all its published changes are preserved/refined. A stacked draft PR against that canonical committed branch is permitted when green; no self-merge, deployment or dirty-laptop overwrite. Laptop receives protected wiring and generated assets separately with overlap hashes and exact proof, then applies reviewed hunks through its own receiving-tree order. Current physical laptop and live serving status remain unavailable here.

## Browser execution protocol and retained limitation

Every required browser file is independently executed in a fresh serial default Bun process with its original cases/assertions/deadlines. The default full standing suite also executes all files together. An additional bespoke mixed browser battery twice exposed an inherited Q208 virtual-time folio focus wait; both RED receipts remain. The unchanged invoice file passed isolated6/0/133 and full defaultstanding, but this is not a claim the mixed battery became green or the legacy timing instability was repaired. No invoice source, scenario, timeout, retry/concurrency flag or skip is changed. Independent final source acceptance records the exact serial per-file receipts and this limitation.
