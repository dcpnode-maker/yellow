# Current Yellow release and live-link handoff

The release is green; the public app route remains absent. Laptop is the controller and final source integrator.

| Evidence | Exact value |
|---|---|
| Reviewed cloud source | `9ff27ad8765dc75ebae9e083d4635c7a9b89fa62` |
| Source tree | `4311a79c0c9ffc33877809162b1b38ae1b3c944a` |
| Parent | `58cd09ad13987bafb6068ab72a753746a555bfa5` |
| PR / CI | Draft PR 98; run 36842043047, all six gates successful |
| Local image ID | `sha256:103cafd6ad6ca67c8ba4b41098c09cd325d3ac705e4867707b9f9ec49f9dc1f0` |
| Registry digest | None; image has not been published to a registry |
| Runtime image proof | linux/amd64, bun user/Bun 1.3.14; all 272 source files match Git |
| Build job | `HOSTING-20261001-managed-image-9ff27ad-v1`, exit 0; 09:39:05–09:39:07 UTC |
| Source/proof/build-script artifact | `eb68e4f5d88a4b140f1420156fec8ee1d8e9e03f`, branch `phase-7/source-checkpoint-9ff27ad-20261001` |
| Source ZIP | 744,720 bytes; SHA-256 `642e11aa69f107252da14796710a8b58733792b2deb213c019ce991764ac49f0` |
| Migration | Frontier 100, all files equal e06; no cloud 0101 |

The latest successor changes exactly eight paths: `tests/operator-workspace-layout.browser.test.ts`, `tests/helpers/owned-cdp-proof-lifecycle.ts`, `tests/owned-cdp-proof-lifecycle.test.ts`, `handoff/orders/RELEASE-20261001-owned-cdp-lifecycle.md`, matching question/review files, and append-only `DECISIONS.log`/`handoff/LEDGER.md`. The full cloud stack changes 145 paths versus e06 and 133 versus PR base d708. The source ZIP includes separate protected-wiring, governance, generated-asset and remaining-module patches, plus the eight-path successor patch and guarded empty MCP replacement.

Independent cloud proof: default suite 2,523 passed, 1,580 explicit DB-environment skips, 0 failed, 44,992 assertions. Required database coverage ran separately. Unchanged `setup.sh --db-only` passed 11/11; focused actual browser/lifecycle proof passed 13/0/1,148; type and 207-file boundary checks passed. Both parent CI failures and the original PG16/PG18 schema failure remain retained. All original UI assertions and the 120-second deadline remain unchanged.

The currently running VM app is revision 937912 on loopback 53007, not the new image. Health/readiness are 200 and frontier 100. Anonymous property access is 401; checked Git/env/private-config/server-source paths are 404. PostgreSQL/cache are also loopback-bound. Those checks prove only this older synthetic process. Current signed-login and worker execution were not re-proved on the unlaunched 9ff image. The prior isolated f610 login/worker proof remains separately dated.

For the requested fastest restricted live release, send the controller-accepted integrated commit/tree (or exact reviewed source archive/manifest) and the nonsecret secure origin/Access binding fields in `RESTRICTED_LIVE_ROUTE_CONTRACT_9ff.md`. An isolated reviewed testing commit is sufficient; a main merge is not required. Cloud will build that exact integrated source and verify its serving revision. Do not overwrite the laptop's dirty work or relabel this 9ff image as the latest integrated app.

Cloudflare Access supports protection of a separate production `workers.dev` URL; no custom domain is required for that front door. A secure origin connection and Access administrative configuration are still missing. No phone coordinator reuse, unapproved direct-network workaround, paid fallback, credential copying or source self-merge.

The home network lane is separately documented: confirmed Jio 100 Mbps and laptop behind Tenda, with no measurements or router changes yet. Wi-Fi 6/plan upgrade decisions await direct-Jio/Tenda-wired/Tenda-Wi-Fi and loaded-latency results. Daybreak Blue is unavailable here; no formal Daybreak scan is claimed. GitHub private-change attempt returned 403 and readback remains public. CompSet Studio stays outside cloud work.
