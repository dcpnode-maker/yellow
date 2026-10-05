# Order 576 — independent public postflight

## Verdict: ACCEPT (2026-09-21)

Reviewer: Codex independent Astra review agent `/root/astra_review`; not the implementer. This accepts the bounded app release and read-only preparation journey, not a public transfer execution or whole-PMS readiness. No deployment, restart, database mutation, transfer confirmation, or transfer replay was performed by the reviewer.

## Source and deployed artifact binding

Personally verified the five accepted Order575 R2 source SHA-256 hashes in the sole serving source `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`:

| File | SHA-256 |
| --- | --- |
| App.tsx | 04AC13428858FA26C9FE7F488AD5E0B0E2FA63916E2FD9AB3952B98597D90761 |
| voice.ts | F993BC79655812C985123AD8761D364309852CDA50B606F528FCBAF97BBE1F8D |
| styles.css | 436C2B4FD537A48EBB001AD7FECF405021D4E3EF3D919117282EA72D2A0AC5EB |
| yellow-voice-bill-window-allocation.test.ts | 923C8EC235B09543E7C39D3DCF6C6F8ED94834A1F13AEAF826AA3A92F7F344B9 |
| yellow-voice-routing.test.ts | 3F72D99425797D7A78043C98045394F1D3C1EE68D95B787B307F2287EBBC991B |

Commands: `Get-FileHash <each scoped file> -Algorithm SHA256`; safe-field `docker inspect --format` and `docker image inspect --format`; `docker exec yellow-public-demo-app-1 sh -c 'printf "%s" "$YELLOW_BUILD_SHA"'`; `docker exec yellow-public-demo-app-1 sha256sum /app/public/yellow-next/assets/index-Ao_Ku-Rh.js /app/public/yellow-next/assets/index-NPwD1YbL.css`; `bun D:/Yellow/temp/astra566-http.ts`. All completed successfully.

- Current app container: `6bee8720e5cd928bbc1928e2dc6aa66f0b72a2e9425464a8db2708db12d02b31`, healthy.
- Current image: `sha256:047dc57931d6e1acd89fed8687b80390d7ba19550f134f3cd8ee5dd6c7bdfc4d`.
- Build revision: `a043bb29d64b5c3e555d46dc8263f85992e5dca2` (valid 40-character revision; not alone a content proof).
- Rollback tag `yellow-public-demo-app:pre-order576` resolves to `sha256:16038318b5494720736c4b8403f324a922470cb649e16a815dcc671ff0327d5a`, the retained Order574 image.
- PostgreSQL `9f507e09cc387e7a96a436835a94d036338ed3acf87e70309031347c5ee48cb5`, Valkey `781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b`, and tunnel `e17219ecd7aa403a70d4f82a755c45aca51a6768a82d63a802bb6dadc1acc92a` match the retained identities. PostgreSQL/Valkey healthy; tunnel running.

Local port3010 and the designated public origin both returned health/page HTTP200 and all five asset HTTP200 responses. Local build/container/local HTTP/public HTTP main asset hashes agree:

- `index-Ao_Ku-Rh.js`: `489AE831F593C7228155D6984F32030DF668A3DE77B138E61F9323B0C935FACE`.
- `index-NPwD1YbL.css`: `C28C99613A069CA370068D39F81B327E9171B708FA4346179821196BBA17C450`.
- Local/public hashes also agree for `rolldown-runtime-CbXtAM7H.js`, `react-runtime-Dy-GIXkn.js`, and `vendor-CfrfCcZd.js`.

The packaged container does not retain the frontend TypeScript preimage; the claim is source hashes plus compiled artifact byte parity, not a container TypeScript source comparison. The independent Order575 R2 test/build/API proofs remain in Review575; this postflight did not rerun financial integration or submit a financial action.

## Actual public preparation journey

Personally executed `node D:/Yellow/temp/astra576-public.cjs` (exit0), using installed Playwright and Chrome against the actual public Today route. No asset or API-response substitution was used. The network guard allowed GET/HEAD/OPTIONS, automatic demo entry and the expressly authorized canonical non-mutating `/transfers:preview` POST; it aborted every other non-read method, including transfer commit.

Typed only: `Move Laundry for Omar Siddiqui to a new bill called Personal`. Exactly one preview returned HTTP200; no blocked operational attempt, page error, or confirmation occurred. No token was retained in this review.

The card resolved fictional stay `L3R-DI-0015`, source `L3R-FOL-1`, complete Laundry group `6045b427-054c-42d4-841d-d9e312d406a0`, destination new window `Personal`. Source SAR25.00→SAR0.00; destination SAR0.00→SAR25.00; conserved stay total SAR25.00. Displayed audit reason exactly matched the submitted draft: `Yellow voice: move complete Laundry charge group`. Preview bound source folio `f728d2b3-eb9e-4e69-b433-6aa6ab88f649`, amount2500, quantity1.000, txCode `L3R_LAUNDRY`, generation and revision. The rendered conversation explicitly said nothing had been posted and required a separate yes to submit the preview. No yes was entered.

- Mobile375×812: document width/scrollWidth375/375; the two composer controls44×44; checked controls0.
- Desktop1440×900: width/scrollWidth1440/1440; controls44×44; checked controls0.
- Retained screenshots: `D:/Yellow/temp/astra576-public-375.png` and `D:/Yellow/temp/astra576-public-1440.png`. Personally inspected the mobile screenshot: proposal, amounts, reason and composer remain contained; the distinct confirmation instruction is visible.

## Independent data-preservation proof

Personally ran `bun D:/Yellow/temp/astra574-db.ts` immediately before and after the public browser preparation (both exit0). It loads the protected target credentials only in process memory, validates the designated loopback target, and opens `REPEATABLE READ READ ONLY` with tenant scope. The output independently confirmed `transaction_read_only=on`. It fingerprints all129 public base tables by count and ordered full-row JSON MD5, using the same `|` delimiter as the retained independent Order566 postflight baseline; it reports hashes/counts only, not row values or credentials.

Both snapshots exactly matched every retained table count/digest: changes `[]`. Aggregate SHA-256 before=after=baseline:

`9eb12c723a3e9b049a39e993ae16ba4349a784913bfcfe4544fbf99fd4c158b5`

Current counts: document0, folio8, journal1, payment0, payment_operation0, posting_line2, reservation654, schema_migration97, space_occupancy233. Thus the existing SAR25 financial effect was preserved, with no new window, journal, posting, idempotency row, fact, outbox event, consumer acknowledgement, reservation or occupancy mutation attributable to this preparation/release interval. All129-table preservation is observed, not inferred from selected counts.

## Boundaries

No remaining blocker for Order576's stated release/postflight scope. This review authorizes no financial operation. It proves preparation and separate confirmation remain visible on the deployed bytes; actual commit/replay hostility and isolated PostgreSQL transfer correctness are the previously executed Order575 R2 evidence, not a live transfer in this review.
