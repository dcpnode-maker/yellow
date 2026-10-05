# Order554 independent review

Reviewer: Codex `/root/astra_review`, non-implementing independent reviewer. Date: 2026-09-21.

Current verdict: **ACCEPT — bounded Order554 final frozen source and personally rendered loopback candidate**. Two failing out-of-scope legacy source oracles are explicitly carried as separate test-maintenance debt; no full adjacent-suite-green claim. See final disposition. Earlier failure evidence is preserved. No deployment/public promotion or whole-PMS/PMS03 completion is asserted.

## Initial review — REQUEST CHANGES (retained failure evidence)

Reviewed the governing PROJECT.md and Order554 and used the engineering code-review skill. No implementation edit, public promotion, API mutation or database access was performed.

Initial reviewed SHA256:

| File | SHA256 |
|---|---|
| App.tsx | AADD3854F4D43CE4BEE42D6385872125E6DE02A8E2BCE14886852777CA72E3FF |
| today-workspace.ts | 38F49B0924706B81D3066046F37B44FE7754EC06DFCE3CCEBC09060DFF2C143E |
| voice.ts | 5E0ED554F5A5EF0D0038AEEA4AF8E20D70822214B19EB3FF8A0047176C03FCF0 |
| styles.css (updated mobile freeze) | CBBD02796AD4D1AD14C599B0DFAA0A09940D82CCE84804C86700B097A16109A4 |
| yellow-today-workspace.test.ts | 9B2860E9580F4D5FCA0D428B38558206E1FC453459A52FF345F24586EBA5D915 |
| yellow-reservation-query.test.ts | 61BB32CBFD33B4169CF88B40BAA3AF89AA0BF0B50743920643FB3DFA5B3F9A38 |
| yellow-reservation-board-attribute-performance.test.ts (updated mobile freeze) | 02125A87534CC46D9E98006A196460C707D7F6337174CD1605B25484D7B8A31C |

### Blocking findings, personally reproduced against actual exports

1. `voice.ts` adult parsing selects the first numeric match rather than failing closed on the full ambiguous/invalid instruction. `Show arrivals with at least 2 adults or minimum 5 adults` applies 2. Adding `minimum 0 adults` after a valid count still applies 2; `at least two adults and minimum 3 adults` silently applies 3. Order554 requirement2 expressly forbids this broadening/partial interpretation.
2. `movementGuestAttributes` contradicts the shared filter's definition of recorded travel. A synthetic row with adults2 and only arrivalTravel.scheduledAt passes travel=recorded but renders `2 adults · travel not recorded`. Departure has the equivalent defect. Scheduled-time evidence must not be labelled absent.

### Personally executed initial commands/results

Runtime working directory: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

- `bun test tests/yellow-today-workspace.test.ts tests/yellow-reservation-query.test.ts tests/yellow-reservation-board-attribute-performance.test.ts tests/yellow-voice-routing.test.ts`: 53 pass, 0 fail, 285 assertions. The authored 10k test took 22.03ms including test work; not a rendered browser measurement.
- `bunx tsc --project frontend/yellow/tsconfig.json`: exit0.
- `bun run typecheck`: exit0.
- `bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order554-reviewed-build`: exit0,469 modules; initial JS index-D-jGc00k.js, CSS index-DqqfbYuF.css.
- `bun test tests/yellow-reservation-board-pages.test.ts`: 4 pass,0 fail,19 assertions.
- Actual-export Bun inline probes produced the findings above. First combined probe accidentally omitted required sorts argument after printing all three parser failures; corrected probe supplied query.sorts/movementTime/timezone and reproduced selected=1 plus the contradictory label. This harness mistake is not a product finding.
- `bash ./state.sh`: unavailable because WSL cannot execute `/bin/bash`. No referee11/11 claim.

### Interim repair observation (not acceptance)

While the reviewer-owned harness was being prepared the implementer repaired both initial examples. Current intermediary today-workspace SHA01707A170D96D56B8E73838CF64B7C7960C1B8DE9FAD90EC04BCA8409FA3303D and voice SHA6BCC11828A16FDF8B4FF7959A7C95B321F638377F632FD0AEF69775F4E0E8494 pass those exact probes. However actual-export follow-ups still fail the same adult parsing requirement: `at least 2 or 5 adults` and `minimum twenty one adults` apply an unfiltered query; `at least 2 adults or 5 adults` applies2. Entire malformed/ambiguous count clauses must be rejected. Updated final proof remains required.

Reviewer harness `D:/Yellow/temp/astra-order554-proof.ts` independently checks legacy persistence defaults, invalid persisted values, immutable query sorts, four-filter count, compound-context precise clearing, and exact10k filtering plus genuine equal-key stable sorting. Those checks passed: 10,000 input rows,666 independently expected matches,28.5745ms measured function call. The authored scale test alone asserts only nonempty/frozen result and a500ms bound, so its title must not be treated as independent evidence of exact IDs/tie stability; the reviewer harness supplies those checks.

### Bounds

Shared query/manual controls and the immutable catalogue do not introduce writes or authority. Missing children are not explicit zero; pickup-not-recorded does not assert a confirmed negative request. Mobile source uses a fixed inset sheet with internal scroll and44px scoped controls. Root-reported rendered375px measurements are implementer evidence only, not personally reproduced here. This initial review neither approves promotion nor claims PMS03 complete; a final reviewed source freeze and required rendered gate remain necessary.

## R2 — source fixes verified; rendered dismissal blocker (REQUEST CHANGES)

Final-R2 voice SHA3A86B15B845EB7B7C2ABC6A5B561300829CED317D8769D94A4F7EFDAB11A1068 consumes exact minimum/supported sort/clear clauses and rejects leftover adult mentions. Today helper SHA01707A170D96D56B8E73838CF64B7C7960C1B8DE9FAD90EC04BCA8409FA3303D uses the same travel-evidence predicate for display and filters. These resolve both original findings, including decimal/signed/multiword alternatives and clear-adult context retention. Authored scale test SHAB84EDE62E1B9677EEACFF56E59BE703898EB5C6320D86A3DB97F105B2A902B77 now checks exact IDs and genuine equal-key ties.

Reviewer personally ran the five-file suite above including board-pages:57 pass,0 fail,586 assertions; reviewer harness16/16 groups passed (666 exact10k matches,25.2037ms). One temporary reviewer assertion used unsupported `and children` instead of supported `with children`; corrected the fixture phrase and reran all16. Frontend strict TS/root typecheck exit0; Vite469 into `D:/Yellow/temp/astra-order554-final-reviewed-build`, JS index-C1bPpg3c.js. All seven hashes were rechecked after execution. Harness SHA12699F44F68A6C34AECCBE93F38469418F819649CC8FF0D26B6A8C6AAE360A05.

### Personally executed rendered proof

CUA reported no browsers and iab unavailable. BrowserAct skill/CLI likewise reported no configured browsers. Used the existing local Selenium4.39/Chrome153 fallback, own headless session only, with true CDP mobile375x812 emulation. Command: `python D:/Yellow/temp/astra-order554-browser-proof.py`. Actual candidate: loopback3011, reservations view for the designated synthetic property, served exact index-C1bPpg3c.js. No PMS commands were invoked. Driver was quit in finally.

- inner/client/document scroll widths375/375/375.
-134 records,21 rendered rows (aria-rowcount135 including header).
-Advanced filter sheet left12/right363/top72/bottom730;658px height with720px scroll content; every contained input/select/button at least44px high.
-Native minimum-adults2 and explicit children0 controls produce Advanced filter(2),90 results (aria-rowcount91),21 rendered rows. Native Clear filters is reachable, passes elementFromPoint and resets the count.
-**Blocking:** the fixed sheet overlays its only toggle. After Clear filters, native toggle click fails `ElementClickInterceptedException` at(64,326), intercepted by `.movement-popover`. Neither filter nor sort sheet has a visible Done/Close or Escape/outside dismissal handler. Clearing filters does not close it. Users cannot return to results without navigation/reload. Add accessible44px dismissal for both sheets and personally rerun mobile flow.
-Screenshot inspected: `D:/Yellow/temp/astra-order554-mobile-filters.png`.

Verdict remains REQUEST CHANGES solely for the mobile dismissal blocker; source parser/travel/performance findings are resolved. No public promotion or PMS03 completion approval.

## R3 — sheet dismissal fixed; adjacent Yellow exit overlap found

At App SHA5B5E76727B05B153ECADAB917D4146E6D88349A375527591C4EE57D0444BDF60, CSS SHAF098EDDAF16087CA7D8ECB022D1098940877DB4AC1B56653E168C765B059E2C5 and performance test SHA9F8148596D6B4C0C45703FF84B45F66567E4BD92C89D08A8EBFE4D6B590344FF, the reviewer personally reran16/16 controlled groups;57/0/590 five-file suite; both strict typechecks;469-module build index-BWX0kxBk.js/index-B-17bNB-.css. Authored scale test28.89ms; independent exact666-match call34.8038ms. Other four hashes unchanged from R2 final freeze.

Native mobile proof resolves the sheet blocker: both filter/sort Close controls are44px and clickable; both Escape paths work; filter Done works. Manual2-adult/zero-child filtering and the typed deterministic Yellow command both yield90 records/21 rendered rows/filter-count2. Width stays375. Neon field and both pseudo-elements have background-image:none; img/canvas count0. Both inline Yellow sheets can open/close natively. The first corrected browser run exited0 before expanding the exit check.

Expanded browser proof then exposed an adjacent existing CSS defect: native `Exit Yellow mode` click at(342,27) is intercepted by `h1#yellow-inline-movement-heading`. Broad `.yellow-command-surface header` selectors also style the nested MovementGrid header, covering the exit control (mobile exit also only30px by source). This is not a parser or domain defect, but the ordinary mobile exit is blocked. Requested bounded direct-child header scoping and44px exit control; no broader visual redesign. The failing expanded run is retained as evidence, not counted as green. Screenshot `D:/Yellow/temp/astra-order554-mobile-yellow.png` was personally inspected.

## R4 final frozen review — ACCEPT

### Final independently recomputed SHA256

| Runtime file | SHA256 |
|---|---|
| frontend/yellow/src/App.tsx | 5B5E76727B05B153ECADAB917D4146E6D88349A375527591C4EE57D0444BDF60 |
| frontend/yellow/src/today-workspace.ts | 01707A170D96D56B8E73838CF64B7C7960C1B8DE9FAD90EC04BCA8409FA3303D |
| frontend/yellow/src/voice.ts | 3A86B15B845EB7B7C2ABC6A5B561300829CED317D8769D94A4F7EFDAB11A1068 |
| frontend/yellow/src/styles.css | A7F5EA13ABD89A4E213F4BBD7B35B736D6EA536231235DCEAC6A1DDE872E44DC |
| tests/yellow-today-workspace.test.ts | CF6DABCA38C0BEE7B592A11A4E4FB2DC2F46D7E360B9B336E73B05BB895F98AE |
| tests/yellow-reservation-query.test.ts | D5749A097464EA47B0623B6C6E69161B4D5D4415923F6C8C61DBBA7FB0570179 |
| tests/yellow-reservation-board-attribute-performance.test.ts | 76758DC5592F1F602940E62767879BD01D62F2F3A1D66AFF155F193446828468 |

All final hashes personally checked after proof. The code-review process drove hostile actual-export probes beyond authored tests and the independent browser interaction exposed the two mobile dismissal/exit failures; all identified blockers are now resolved.

### Final commands and personally observed results

Runtime cwd remains the exact D-source directory above.

```text
bun D:/Yellow/temp/astra-order554-proof.ts
bun test tests/yellow-today-workspace.test.ts tests/yellow-reservation-query.test.ts tests/yellow-reservation-board-attribute-performance.test.ts tests/yellow-reservation-board-pages.test.ts tests/yellow-voice-routing.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order554-final-mobile-reviewed-build
python D:/Yellow/temp/astra-order554-browser-proof.py
```

- Reviewer actual-source harness:16 groups pass,0 fail. It runs nine malformed/ambiguous count cases, valid adult sorting, precise adult clearing, both direction scheduled-only travel labels, extracted actual App restoration/filter-count logic, follow-up clearing and10k exact-ID/equal-key stability. Final666 matches in24.9673ms. This is one local function measurement, not a browser latency or p99 claim.
- Focused/adjacent five-file suite:57 pass,0 fail,593 assertions. Authored10k test29.12ms including its exact-ID/tie assertions; its500ms bound passes. Capability catalogue freezes both inventories; legacy persisted queries restore defaults while invalid new values reject.
- Strict frontend TS and root `tsc --noEmit`: exit0, no diagnostics.
- Production Vite: exit0,469 modules, JS index-D4gkmEEZ.js and CSS index-HgZI0zi4.css. Reviewer output is separate from runtime build output; no deployment was performed.
- Browser proof: exit0; reviewer-owned Chrome session quit in finally. Exact candidate served index-D4gkmEEZ.js. True375x812 mobile emulation: inner/client/scroll375/375/375;134 records/21 DOM rows; filter sheet bounds12..363 horizontally and72..730 vertically;658px viewport with788px internal scroll; scoped controls minimum44px height. Native minimum-adults2 and explicit children0 select90 records/filter-count2. Clear filters is reachable and resets; native Done, Close for both filter/sort, and Escape for both work. Yellow's typed read-only command independently yields the same90/21/count2 result. Both inline sheets open/close natively.
- Exit Yellow, microphone and send each measure44x44. Native exit succeeds after results (prior intercepted-click failure resolved). Neon field/pseudo backgrounds are all `none`, and img/canvas count0. At1440x1000 desktop, document scrollWidth1425, filter bounds870.125..1155.125 and297..977; min controls44px. No observed document overflow.
- Final browser screenshot artifacts personally inspected: `D:/Yellow/temp/astra-order554-mobile-filters.png` and `D:/Yellow/temp/astra-order554-mobile-yellow.png`. These filenames hold final rerun screenshots; earlier failure facts remain above.

Proof artifacts: `D:/Yellow/temp/astra-order554-proof.ts` SHA12699F44F68A6C34AECCBE93F38469418F819649CC8FF0D26B6A8C6AAE360A05; `D:/Yellow/temp/astra-order554-browser-proof.py` SHA1E5DAE0FA24C0D8D26CD9702ECA7436EF97EFB8557F136D46E573168158D6C92. Selenium uses existing local Chrome/driver only; no external browser service, profile import or credential exposure.

### Decision and limits

ACCEPT this bounded read-only attribute parity/scale slice at the listed bytes. No unresolved finding from this review. Missing adults/children do not become positive evidence; explicit-zero children remains distinct from unknown; travel/pickup are direction-specific and labelled as recorded/not recorded rather than invented operational facts. Manual and deterministic Yellow share query/sort/filter semantics and canonical board rows, with no new mutation endpoint, domain state transition, authority, financial or database behavior.

This acceptance is source plus designated loopback candidate, not a public target-bound postflight. No public promotion, reservation/occupancy/financial write, provider call or DB command was performed. The unavailable `state.sh`/referee gate is not reported green; this migration-free/read-only UI review does not claim a fresh database invariant battery. No whole-PMS or complete PMS03 acceptance claim is authorized.

### Post-R4 broader adjacent test gate — acceptance withheld pending disposition

The reviewer additionally ran `bun test tests/yellow-reservation-command-surface.test.ts tests/yellow-rich-reservation-record.test.ts` immediately before final handoff. Result:4 pass,2 fail,28 assertions. Both failures are in the older command-surface static oracle (first expects obsolete placeholder `Guest, confirmation, room or rate`; second expects an old named-routing assignment at line31). Rich-record tests both pass. The underlying final product/mobile proof above remains green, but the broader relevant adjacent gate cannot be called green. This result arrived while the R4 acceptance section was being written; current verdict was immediately corrected to REQUEST CHANGES and the implementer notified. Test file is outside current Scope: no reviewer edit was made; govern its disposition explicitly rather than silently widening scope or hiding failure.

### Final disposition of legacy oracle debt

Coordinator explicitly declined to widen Order554 and committed a separate narrow oracle-reconciliation order. The reviewer inspected the full failing oracle: it expects removed legacy `statusFilter`, `All returned states`, `visibleStays = stays.filter`, `showOnReservationBoard`, and `focus` query-string routing, whereas this slice exposes the shared MovementGrid query and current canonical reservation routing. These are stale exact-source expectations, not reproduced product failures. Current named-resolution/authority tests, actual manual/Yellow filtering and rendered navigation/dismissal proof pass. The reviewer agrees this debt does not invalidate bounded Order554 requirements; no test was deleted, weakened, marked skipped or edited by the reviewer.

Final verdict restored to **ACCEPT for the explicitly listed Order554 candidate** with the two legacy static-oracle failures openly carried. A separate maintenance order must reconcile those tests before claiming the wider adjacent suite or whole application green. This disposition does not change any recorded result, expand acceptance to the obsolete board path, or authorize public promotion by this reviewer.
