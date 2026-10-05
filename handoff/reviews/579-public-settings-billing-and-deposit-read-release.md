# Order579 — independent public postflight

## ACCEPT — bounded read-only release verification,2026-09-21

Reviewer: independent Codex Astra `/root/astra_review`; did not implement or deploy this release. Read Order579 (including its explicit public-scope proof correction), accepted Review577 R3 and Review578 R3. Personally executed the checks below. No deployment, restart, migration, configuration/grant change, folio opening, preview, payment, posting or other operational mutation.

### Artifact and target identity

Commands: `Get-FileHash <accepted source/test/asset files> -Algorithm SHA256`; safe-field `docker inspect --format` and `docker image inspect --format`; `docker exec yellow-public-demo-app-1 printenv YELLOW_BUILD_SHA`; `docker exec yellow-public-demo-app-1 sha256sum <four accepted backend source paths and two assets>`; `bun D:/Yellow/temp/astra566-http.ts`.

- App container `33f5374db14bdb268896b3bd0efc725f9a128cc7792e67d086af74953830738c`, healthy; image `sha256:7bcfb9c2d705130ea72a41c6b827cd417e77f8f77bfdce8122e1cb4875f94e4d`.
- Build revision `a043bb29d64b5c3e555d46dc8263f85992e5dca2`, valid40-character revision. Content identity is established by the hashes below, not revision alone.
- Rollback `yellow-public-demo-app:pre-order579` resolves to `sha256:047dc57931d6e1acd89fed8687b80390d7ba19550f134f3cd8ee5dd6c7bdfc4d`, the retained Order576 image.
- PostgreSQL `9f507e09cc387e7a96a436835a94d036338ed3acf87e70309031347c5ee48cb5`, Valkey `781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b`, tunnel `e17219ecd7aa403a70d4f82a755c45aca51a6768a82d63a802bb6dadc1acc92a` match the retained pre-release identities. PG/Valkey healthy, tunnel running. The first shared health-template command could not format tunnel's absent Health field; a separate Status-only inspect confirmed it. No runtime action was needed.

Local3010 and designated public origin `https://editing-alto-artists-quilt.trycloudflare.com` returned health/page200 and all five current assets200. Source-build files, running container, local HTTP and public HTTP main-asset byte hashes agree:

| Asset | SHA-256 |
| --- | --- |
| index-BPW7uegm.js | 0562BAE18B3C07D4F289F738F4FE901B643D9CB91A6A6C3DF737778FA6579889 |
| index-CIPsAHTT.css | 0C792D75D6D85C65E6D4DB9FC7F7640BA3D5C59A62D7E1B03CE85727BCF1F3FB |

Local/public byte parity also holds for rolldown-runtime-CbXtAM7H.js, react-runtime-Dy-GIXkn.js and vendor-CfrfCcZd.js. Container backend source exactly matches accepted Review578:

| File | SHA-256 |
| --- | --- |
| src/app.ts | 2B86F28C1F2AA2BABC5928C9E36689A3BE51A6C18E4FFC1C884AF97BCA45F639 |
| src/http/operator.ts | 53E435CA4244A0BAA3D7AEC05875C49D28B4044E01F3B959CD7AB13DB82E2C32 |
| src/contexts/financials/hosted-deposits.ts | 7F852E1B140940290F634CE9FE31A257D9843EACF75B6A31D9CB37C2A14A1992 |
| src/contexts/financials/index.ts | 301489398E40553AC855F5505CBF167BE03C3720DEF1BF169E0936EFB7B5EC89 |

Serving frontend source App hashB759369CF9BFCAFF52C085262FE9224C9A03A55BFC517922B64908C0FFAB217A and CSS847AD24EE339CA38B84F9E8F329D5F43A8F35394205DA87CF510C7ADCDE1C4F1 match Review577 R3. All four Order577 scoped tests and both Order578 scoped tests also independently match their accepted final review hashes. Packaged image does not contain the frontend TS preimage; frontend binding is accepted serving-source hash plus exact compiled artifact parity, not a claimed container-TS comparison.

### Actual public browser journey

`node D:/Yellow/temp/astra579-public.cjs` — final exit0. Installed Playwright/Chrome; actual public routes and served assets, no response/asset substitution. A network guard permits only GET/HEAD/OPTIONS and automatic demo session entry; all other non-read methods are blocked. Final result `blocked:[], errors:[], operationalWrites:0`. No confirmation box was checked, no yes supplied, and no folio/financial command submitted.

- Mobile Setup navigation opens populated Settings; desktop Settings navigation independently opens the same workspace. Actual API summaries show canonical property/timezone/SAR,3 room types/20 rooms/20 sellable units,1 BAR plan,0 restrictions and0 OOO/OOS. Existing governed inventory/rates/restrictions/room-operation links are honestly described. Missing settings APIs are explicitly disclosed, not replaced with invented records. Four workflow controls44px; width/scrollWidth375/375 and1440/1440.
- Performance has six scope=col headers, Period scope=rowgroup and Measure scope=row. Header and first-row x positions exactly equal at both widths; subsequent row structure preserves alignment. At375 the321px wrapper scrolls its760px table internally; at1440 table/wrapper1048px. No document overflow.
- Actual rendered reservation board search for fictional `L3R-DI-0015`, then its real Cashier button, navigates to Finance with exact reservation `fbe1dc20-456e-5345-8d7d-420b41685955`. Button83×44 at375/1440. Finance shows authoritative in-house context and server-posting-authority disclaimer. Both widths have equal document/viewport width and0 checked checkboxes. No folio opening was needed or attempted.
- Screenshots `D:/Yellow/temp/astra579-public-375.png` and `D:/Yellow/temp/astra579-public-1440.png` retained. Mobile image personally viewed; the workbench is contained and manual bottom navigation remains visible.

Harness corrections are not concealed: initial mobile selector incorrectly asked for desktop `Settings` rather than visible `Setup` and timed out. Correcting that reviewer selector allowed actual navigation. An initial later assertion expected503, but the public session correctly returned403 as detailed below. No product error, write or bypass resulted from either run.

### Disabled hosted-deposit boundary

Authenticated actual public GET `/api/v1/properties/6081b544-22a1-534f-a86d-bb1ae0519e14/folios/f728d2b3-eb9e-4e69-b433-6aa6ab88f649/hosted-deposits` returns **403 `auth/scope_missing`**, `Payment access is not granted`. Its JSON contains only the ordinary problem fields/correlation, no deposits, instrument metadata, tokens or fabricated data. Authorization stayed only in reviewer process memory and was not printed or persisted.

The demo session lacks `financials.payments:read`, so authorization correctly precedes service resolution. Reported this distinction before accepting; Order579 was explicitly amended to prohibit manufacturing a grant/session just to force503. Personally queried only a safe boolean from the running app: `hostedDepositWorkbenchEnabled:false` (`Bun.env.YELLOW_HOSTED_DEPOSIT_WORKBENCH === "1"`). Accepted Review578's independently executed absent-service503 proof establishes the later disabled-service boundary. **No claim of a live public503 is made.** Neither payment activation nor new authority is implied by this release.

### All-table preservation

Personally ran `bun D:/Yellow/temp/astra574-db.ts` before the browser and after both completed runs. It validates the designated protected loopback target, loads credentials only in process memory, uses tenant-scoped `REPEATABLE READ READ ONLY`, and confirms `transaction_read_only=on`. Every one of129 public tables is compared by count and ordered full-row JSON MD5 (same `|` delimiter) to retained independent Order566 postflight evidence; no row values or credentials are emitted.

Before/after changes `[]`; all129 table fingerprints equal retained baseline. Aggregate SHA-256:

`9eb12c723a3e9b049a39e993ae16ba4349a784913bfcfe4544fbf99fd4c158b5`

Counts preserved: schema_migration97, reservation654, space_occupancy233, folio8, journal1, posting_line2, payment0, payment_operation0, document0. Existing SAR25 effect remains unchanged. This is full-table evidence including idempotency, facts/outbox/consumers and instruments, not an inference from selected financial counts.

### Verdict and limits

**ACCEPT for amended Order579 public release/postflight.** Accepted source and artifact chain, preserved non-app infrastructure, read-only Settings/performance/exact billing navigation, correct payment-scope denial with disabled runtime service, and all129-table preservation are independently verified. No remaining blocker found in this bounded scope. Prior Review577 mounted uncertainty proofs and Review578 freshPG/read-model proofs remain their own evidence; no new public operation or isolated DB integration was executed here. This does not waive unrelated repository-wide gate debt or assert payment/deposit/whole-PMS readiness.
