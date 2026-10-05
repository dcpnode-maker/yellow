# Order582 independent responsive operational-shell review

Reviewer: Codex Astra `/root/astra_review`, not the implementer. Date:2026-09-22.
Read PROJECT.md, ran `./state.ps1`, read Order582 and relevant decisions, and used
Yellow compliance plus code-review/frontend-testing guidance. No implementation
edit, deployment, database or operational write. Temporary proof files are outside
the repository. The conventional Browser plugin/`browser` skill was not available;
installed Playwright with headless Chrome was used for controlled candidate testing.

## R1 — CHANGES REQUIRED (preserved)

Initial App SHA256 `937F33C72FB7CF6D0F484BD72E81EF5D24A4B7034B9A497CC5C58C4B7A5000A8`;
CSS `9713B2C8A1FF7C695E9FD787FE8CCE2D25DB740AF66FA3230FE1746A904C9C14`;
OptionsDrawer `7D200A029C4DB72029447DBF608078533837D5EC69D96FBAEE8024217B5A5675`;
SegmentedRibbon `1A626D2906228A8AB43877BEC467D88B0218439FD08262C0143E760E119DC9AD`.

1. P2: actual Shift+Tab from the modal Close button moved focus to the background
   Yellow launcher while `aria-modal=true`. OptionsDrawer lacked focus containment.
2. P2: End selected Service but left keyboard focus on Rooms. Home/End needed the
   same focus movement as arrow navigation.
3. P2: ribbon `scrollIntoView` explicitly requested smooth scrolling regardless of
   reduced-motion preference; CSS cannot override that JavaScript option.
4. Gate failures: source test rejected the substring `led` in ordinary `disabled`
   text; performance test expected `manualChunks` although the existing Vite config
   uses Rolldown `codeSplitting.groups`. These were test defects, not reproduced
   product LED or code-splitting defects.

Personally executed focused five-file suite:14pass/2skip/2fail/202assertions.
Strict frontend TS passed; Vite474 passed and emitted separate
`OperationalHub-B7J-czP5.js`. Mounted375/1440 had document width375/1440, ribbon
44/46px and drawer controls44/64px. Portal attached to BODY; Escape closed and
restored Options focus. Settled drawer bounds were0..375 mobile and958..1428 desktop.
No page errors or operational requests. Source changed while review ran; this R1
result binds the initial built bytes rather than silently covering later changes.

## R2 — interim CHANGES REQUIRED, Sources unavailable-state finding

The coordinator supplied repaired focus containment, Home/End focus movement,
reduced-motion handling, corrected tests, and the founder-requested Sources preview.
Personally rebuilt and reran the mounted proof on that freeze. Prior accessibility
findings closed: reverse Tab stayed inside on Property setup, Escape restored
Options, End focused and selected Sources, arrows moved focus and selection together.
Under reduced motion all recorded scrollIntoView calls used `behavior: auto`.

Latest inspected R2 hashes:

| File | SHA-256 |
| --- | --- |
| App.tsx | `937F33C72FB7CF6D0F484BD72E81EF5D24A4B7034B9A497CC5C58C4B7A5000A8` |
| styles.css | `4E47EF9B4E5E6C3D0AD7FB9C2914A391DCC68E5844A07A205F0311CA07636339` |
| OptionsDrawer.tsx | `92E4509EE1D0786D3D61F33841AC2C9496F1CB6F6F063F7ED98BC7080D9602FC` |
| SegmentedRibbon.tsx | `3DC722E9785C5B0860CC06355EB27E4AC874CE64058B344963F55CB689863C53` |
| StatusBadge.tsx | `9BF65248F0CB6F1866D2A2E172D01ED47EB280FBADB6A2D603C9C5AA73FE9F7D` |
| operational-data.ts | `BC3EA3FE48D7C1BCDB49B68ADE83C06E3B4C8B603ACE5E1B82DA3183D726A1AC` |
| OperationalHub.tsx | `A1862EC10077BF6D112F9F7CC780C0B50A2D3864ECD4CFFB2C2BBAF5EF76BD8E` |
| yellow-responsive-operational-shell.test.ts | `FC953D13B9FE7D5D4EEFA71E1067F17E75728AD32441AC15FF90A6E70266ED25` |
| yellow-workspace-performance.test.ts | `A5EB2BFE0236908E73D43CB43C4B4A316C6291C1C18A5FFE3F8B943FEB92CC59` |

### Executed commands

From designated D serving-source checkout:

```powershell
$env:YELLOW_ORDER580_MOUNTED_HARNESS='D:/Yellow/temp/astra582-deposit-browser.cjs'
bun test tests/yellow-responsive-operational-shell.test.ts tests/yellow-workspace-performance.test.ts tests/yellow-reservation-finance-entry.test.ts tests/yellow-advance-deposit-workbench.test.ts tests/yellow-next-finance-workspace.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx vite build --config frontend/yellow/vite.config.ts
node D:/Yellow/temp/astra582-browser.cjs
node D:/Yellow/temp/astra582-reduced-browser.cjs
$env:SOURCE_MODE='error'; node D:/Yellow/temp/astra582-sources-browser.cjs
$env:SOURCE_MODE='empty'; node D:/Yellow/temp/astra582-sources-browser.cjs
```

Result:17pass/1skip/0fail/216assertions, strictfrontendTS exit0, Vite474 exit0.
The reviewer-owned mounted deposit test ran both same-task create overlap cases on
current candidate assets, preserving one intercepted POST and the panel/handoff.
One optional direct-Playwright test remained skipped; it was not counted as evidence.
Build emitted `index-CyQB5R4h.js`, `index-rfCSPuU1.css`, and separate
`OperationalHub-BShcCxd8.js`13.50kB/3.99kB gzip. This proves chunk emission and query
reuse by inspection, not a measured end-to-end latency or universal performance SLA.

### Remaining finding

P2 — Sources converts absent failed data into a fabricated zero. With both
reservation-board GETs intercepted as503, actual mounted Sources displayed tab0 and
`SOURCES / 0 / current records` above `Current sources unavailable / No source count
has been inferred.` Both successful empty GETs correctly displayed0 and `No current
movements`. Use unknown/null count during loading/error and suppress or explicitly
label incomplete/cached observations. Keep planned connector cards visible without
claiming live data. This violates the order's honest missing/unavailable requirement.

### Environment and bounded visual evidence

Route: loopback3010 `/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today?workspace=operations`.
Candidate built assets are supplied by browser interception, not deployed. Only
automatic session entry and read requests can reach the server. Financial regression
POSTs are fulfilled in memory; every other operational method is aborted.
Page identity/title correct, meaningful content, no framework overlay/pageerror,
44px minimum relevant controls, document containment at375/1440, body-mounted
drawer and interaction/focus proof observed. No microphone/assistant activation.

Five-point bounded fidelity ledger (not a pixel-match claim against an unavailable
reference-board artifact): (1) segmented selected pill/keyboard focus observed;
(2) concise live room cards with honest unavailable occupancy observed;
(3) secondary controls in contained Options observed; (4) compact verified green
seal versus flat warning/urgent styling observed; (5) mobile ribbon scroll and drawer
containment observed. Founder-reference comparison and subjective aesthetic approval
remain outside what this evidence establishes.

Screenshots: `D:/Yellow/temp/astra582-375.png`, `astra582-1440.png`,
`astra582-drawer-375.png`, `astra582-drawer-1440.png`. Temporary harness files under
the same directory retain exact browser interactions. Further current-byte review
is required for the Sources finding before final acceptance.

## R2 final addendum — ACCEPT, 2026-09-22

The coordinator repaired the remaining Sources unknown-count defect and supplied a
final stable freeze, also gating global read queries to their consuming workspaces
or explicit assistant activity. I personally inspected these changes, rebuilt,
reran the exact five-file command above with the mounted deposit harness enabled,
and repeated normal/reduced-motion/success/error/empty browser proof. All earlier
negative evidence remains intact.

Final changed hashes (all other hashes equal the R2 table):

| File | Final SHA-256 |
| --- | --- |
| App.tsx | `48C25EA202D653ACB14A88AB833F6623585797313C7C899832A252BC0E45EED4` |
| styles.css | `4E47EF9B4E5E6C3D0AD7FB9C2914A391DCC68E5844A07A205F0311CA07636339` |
| OperationalHub.tsx | `093A579C0A91437484009B0358586B320093BFF08D973515E37E12709903C27A` |
| yellow-responsive-operational-shell.test.ts | `D716B866961B902D62E73C88DB4CEC4E76E0B9FACBD8809C7A4EF523721222D7` |
| yellow-workspace-performance.test.ts | `2179D8150311C99647BCC986D255B9991EA3AC954D45954FC4466E9A87AF771B` |

End hashes matched the final freeze. Final gates: **17pass,1skip,0fail,221assertions**;
strict frontend TypeScript exit0; Vite474 exit0. Artifacts:
`index-CDSR1toz.js`, `index-rfCSPuU1.css`, separate
`OperationalHub-LYGgqEzj.js`13.57kB/4.01kB gzip. The browser uses those exact rebuilt
assets without deploying them. The optional direct-Playwright source test remains
skipped; its reviewer-owned equivalent actually ran on the current build and proved
one intercepted create request and retained panel/handoff in both synchronous cases.

Additional final commands:

```powershell
node D:/Yellow/temp/astra582-final-browser.cjs
node D:/Yellow/temp/astra582-reduced-browser.cjs
$env:SOURCE_MODE='error'; node D:/Yellow/temp/astra582-sources-browser.cjs
$env:SOURCE_MODE='empty'; node D:/Yellow/temp/astra582-sources-browser.cjs
```

Observed final results:

- Both failed live reads: Sources count omitted in ribbon, summary `—`, explicit
  unavailable/no-inferred-count message, no live observed cards, four disabled
  connector-preview cards retained. Successful empty reads: factual0 with `No current
  movements`. Successful live reads: two observed source categories containing2+1
  arrival/departure records, separately labelled from the four planned connectors.
  These are record observations, not commercial-attribution KPIs or active provider
  integrations.
- At375/1440 the shell and settled portal drawer remained within viewport/document
  bounds; 44px mobile/46px desktop tabs,44px Close and64px drawer actions. Shift+Tab
  wrapped within the modal; Escape restored Options focus; End/arrow focus and
  selection agreed. Reduced-motion calls were all `auto`. No framework overlay,
  page errors or unintended operational requests; assistant remained unopened.
- Actual Operations reads were only reservation-board, housekeeping conditions,
  housekeeping tasks, operational blocks, and property identity list. No commercial
  snapshot/performance read occurred on this route. Existing specialized workspaces
  retain their own queries; assistant flows retain explicit enable/refetch paths.
  Code-splitting and off-screen CSS containment were inspected, but no device-wide
  latency or Android-native certification is claimed.
- The financial helpers/confirmation path received no new business semantics. The
  scoped reservation/finance/deposit regressions and mounted synchronous deposit
  lock proof pass. No live financial or provider operation was executed.

**Final verdict: ACCEPT for the bounded Order582 source/UI slice.** The reproduced
R1 accessibility/test issues and R2 Sources honesty issue are closed. No remaining
reproduced blocker was found. Visual evidence and five-point limitations above still
apply: this is not a founder aesthetic sign-off, full-app benchmark, native-shell
certification, public postflight or deployment authorization. No implementation,
order or ledger was changed by this reviewer; only this review and external proof
artifacts were written.
