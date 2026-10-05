# Order 503 — independent ambient Yellow review

Reviewer: Astra (`/root/astra_review`), independent non-implementer. Date: 2026-09-20.

## Verdict: BLOCKED against the order as written

The focused regression suite, frontend/backend TypeScript checks, and production build pass. These are not proof of the required in-context visual design. No runtime source, public application, database, or deployed artifact was modified by this review. Build output was directed to a reviewer-owned temporary directory.

## Findings

1. **Required wake phrase is not local (P1).** `frontend/yellow/src/voice.ts:isAssistantWakeWord` accepts only bare `yellow|overwatch`. Personally executing it returns false for both `Hi Yellow` and `Hi Yellow!`, with no lane/workspace match. `App.tsx:ask` therefore reaches the existing `/api/v1/jarvis:ask` fallback instead of handling this required wake phrase locally. The existing test covers only bare Yellow/Overwatch. Add executable coverage for the order's phrases and prove they do not invoke the fallback.
2. **The separate assistant surface has been restyled, not removed (P1).** `App.tsx` around 2588–2674 still nests conversation turns, live result cards, and the governed journey inside `yellow-command-surface`. CSS around 1330–1382 places this in a fixed, right-side 510px panel, or a mobile bottom panel up to 70vh. `yellow-ai-mode` is a fixed z-index 40 overlay: its rays render above the normal PMS, not in a background layer behind its data. This conflicts with the explicit no-sidebot/in-context requirement and differs materially from the accepted reference's unobstructed PMS. Absence of `aria-modal`, the old class name, or an orb does not establish compliance.
3. **“Show arrivals” does not directly show/filter the active live table (P1).** Around 2335–2365 it creates a four-row snapshot card and a separate “Open arrivals” button. The active table changes only after another click. Named check-in work likewise stays inside the floating command panel. Move requested factual results/workflow context into the active PMS surface; retain separate, explicit operational consent for actual writes.
4. **Required desktop/mobile screenshot comparison remains unexecuted.** I inspected the supplied accepted reference image. This review session has no usable browser surface from the prior capability check; no screenshot, mobile geometry, focus/keyboard, or visual contrast proof is claimed. Even after source corrections, the order's browser comparison gate remains required.

## Positive bounded evidence

- Yellow/white sunlight gradients replace the old dark assistant shell/orb. Rays are aria-hidden and pointer-transparent; reduced-motion CSS disables their continuous animation. This is static evidence, not complete accessibility certification.
- Mode/language/turn persistence uses sessionStorage, not permanent application mode state.
- Existing server-backed lane reads and finite deterministic routing remain; no new backend contract, database write path, or financial semantics were observed in this bounded frontend review.
- Existing governed check-in/folio/room assignment remains component-specific. The reviewer-owned controlled room-assignment harness passed against current bytes, including current candidates, distinct consent, frozen evidence/body/key retry, denial refresh, and no auto-check-in/folio.

## Personally executed commands/results

Working directory for runtime commands: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

```powershell
bun test tests/yellow-ambient-ai-mode.test.ts tests/yellow-voice-routing.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-next-public-surface.test.ts tests/yellow-next-reservation-create.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx tsc --noEmit
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order503-build-review-20260920
bun D:/Yellow/temp/astra-order502-room-assignment-review-20260920/component-proof.ts
bun -e 'import {isAssistantWakeWord,requestedOperationalLane,requestedWorkspace} from "./frontend/yellow/src/voice.ts"; for (const s of ["Yellow", "Hi Yellow", "Hi Yellow!", "show arrivals"]) console.log(JSON.stringify({input:s,wake:isAssistantWakeWord(s),lane:requestedOperationalLane(s),workspace:requestedWorkspace(s)}));'
```

- Bun: **21 pass, 0 fail, 125 assertions, five discovered files**. The extra reservation-create path supplied to the command did not contribute a test file and is not claimed as executed.
- Both TypeScript commands: exit 0, no diagnostics.
- Vite: exit 0, 467 modules; temporary artifacts `index-DdXc_vPg.js` and `index-DxT0d4dU.css`.
- Controlled component harness: exit 0, four PASS summaries; not browser E2E or a new database/API proof.
- Direct helper probe: Yellow wake=true; Hi Yellow and Hi Yellow! wake=false/lane=null/workspace=null; show arrivals lane=due_in.
- Session ritual `state.sh` could not execute because the available WSL shell lacks `/bin/bash`; no referee/standing/full-roadmap gate is claimed.

## Reviewed SHA256

| File | SHA256 |
| --- | --- |
| frontend/yellow/src/App.tsx | 133666D271659D16CE183E0A61853E510807EBD58C15832BFE1CB749524010A2 |
| frontend/yellow/src/styles.css | 86A4CB084D42A1F5D18292C85655F8AE580F668E023104D05F40140B7E55B391 |
| frontend/yellow/src/voice.ts | 8FB789877734FF5918A692D15883FA408BD609E11E7767B59B120C155F4980BD |
| tests/yellow-ambient-ai-mode.test.ts | AEEEA738D58E7F77680A7521DC0B2E95EC243D39FB59B16E36A374FF9AEBA8D0 |
| tests/yellow-voice-routing.test.ts | B469BDA8865A3660A830E7200238CE5CB84299FAD159B77A76C4F7E270F10B34 |

Acceptance requires correction of the three functional/design findings, non-trivial behavioral regression assertions (not merely class-name presence), and the specified desktop/mobile comparison. No public release or full visual acceptance is authorized by this result.

## Second independent review — revised source, still BLOCKED

Same independent reviewer and date. The previous bytes/results remain historical evidence, not the current candidate verdict.

### Fixed / improved

- `Hi/Hello/Hey Yellow` now matches the local wake helper; the Hi Yellow regression assertion executes and passes.
- On an unfiltered Today route, `setAiFocusedLane(askedLane)` now narrows the actual server-backed lane components, not only the result card.
- The narrow side panel chrome has been removed. Existing canonical action/consent regression checks still pass.

### Remaining blocking findings

1. **P1: transparent full-screen layer blocks the underlying PMS.** `.yellow-command-surface` has absolute `inset:0` inside the fixed z-index40 overlay and explicitly sets `pointer-events:auto`. It therefore hit-tests over the entire viewport, including transparent space. The parent's `pointer-events:none` does not negate this child's explicit `auto`. This makes the ambient mode an invisible interaction-blocking overlay. Keep the canvas non-interactive and enable hit testing only on actual controls/results, or use normal-flow context.
2. **P1: long workflow has no accessible scroll container.** The same full-height canvas uses `align-content:end`, `overflow:visible`, and no maximum result height, while `.yellow-ai-mode` is fixed with `overflow:hidden`. A large check-in/room-selection result plus turns/cue/form can extend above the viewport and be clipped, particularly on phones. Restore bounded accessible scrolling for live context or place workflows in the PMS document flow. This is a source-derived clipping risk; no rendered geometry claim is made.
3. **P1: URL lane prevents commands and reset from changing focus.** The render expression is `focusedLane ?? aiFocusedLane`, where `focusedLane` is the initial URL lane. With `?lane=due_out`, `show arrivals` sets due_in but continues rendering due_out. “Show full Today” merely sets AI state to null, leaving the URL lane active. Use one mutable effective focus initialized from the URL and a working clear/navigation path; test initial URL focus, switching lane, and clearing it. Commands invoked from non-Today workspaces also only set this Today-local state and leave the requested table absent from that workspace.
4. **Original visual placement/gate is not established.** Rays remain inside z-index40 above normal PMS content, not behind the data; normal animation overrides the new static `.44` opacity with `.68` to `1`. Requested workflow cards are still nested in the overlay. Required desktop/mobile browser comparison remains unexecuted and cannot be certified by the string-presence tests.

### Personally rerun proof

From the runtime working directory:

```powershell
bun test tests/yellow-ambient-ai-mode.test.ts tests/yellow-voice-routing.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-next-public-surface.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx tsc --noEmit
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order503-r2-build-review-20260920
bun D:/Yellow/temp/astra-order502-room-assignment-review-20260920/component-proof.ts
```

Results: **21 pass / 0 fail / 129 assertions** across five files; both typechecks exit0; Vite exit0/467 modules (`index-DwrzdVvF.js`, `index-DeD37Wxi.css` in reviewer temporary output); controlled action harness four PASS summaries. No source edits/public access/database work. `git diff` could not be used because this runtime directory is not a Git checkout; direct file inspection/hashes were used, not an invented Git delta.

| Revised file | SHA256 |
| --- | --- |
| App.tsx | 4B8577212FD091724E4526B8FBBF0699D208B7A6D0A1373BC0342AFC55C3AAE2 |
| styles.css | 7F710D6BC47F91017660842B0D378A08D4BAA2BC8B6ABD8E88890A3CB1B2EAE2 |
| voice.ts | D7142173F3BE4FF625F42025B47508F4ADF0A7793F5857BCA61DD3522B16EFC6 |
| yellow-ambient-ai-mode.test.ts | B51A239961D3762448B2E5C328ECDE4245D6D87FEABEC21DCA7F049514B2BE1C |
| yellow-voice-routing.test.ts | E41BC4B8E072CD63E8A0B13BB7447B8DA8A70CA02850DB21D167B5A59EE7BD95 |

## Fourth independent review — focused-table candidate: BLOCKED

Same reviewer/date; this narrow review is of the new table/focus bytes. Prior sections remain historical evidence.

Resolved: one mutable `activeLane` initialized from URL now controls filtering and clearing. The previous immutable URL-precedence defect is removed. Requested lane changes use actual server-backed reservations rather than the earlier four-row preview. No new write path appears in this change.

Current findings:

1. **Frontend typecheck fails.** `App.tsx(2111,63) TS2345`: `focusedLane` can be undefined, but `useState<Status | null>(focusedLane)` disallows undefined. Normalize absent focus to null and rerun the strict frontend command.
2. **Desktop table is not full width.** `.lane-grid` still defines three equal columns; `.lane.focused` only changes min-height. There is no span/all-columns or single-column override. The focused four-column row has minimum widths 92+170+190 plus gaps/action, but its section occupies one dashboard column. Add the intended full-width grid placement and verify rendered widths.
3. **Accessible table semantics are incomplete.** Focused section/rows get `table`/`row` roles, but header spans and row content have no `columnheader`/`cell` roles or native table elements; the table also lacks an explicit accessible label association. Mobile CSS removes headers with display:none. Do not claim an accessible full-width table based only on these role attributes; use coherent native/ARIA table semantics and check the accessibility tree.
4. **Non-Today lane command remains a no-op.** The reveal effect explicitly returns when workspacePart is not today; the command does not navigate/render the requested lane there, yet reports that it is displayed. Existing overlay/background/mobile-geometry blockers remain unchanged.
5. **Reduced-motion regression:** new `scrollIntoView({behavior:"smooth"})` always animates, without consulting the reduced-motion preference. The ray-animation media rule does not cover this JavaScript scrolling.

Personally executed the same five-file focused Bun command: **21 pass / 0 fail / 136 assertions**. Personally executed `bunx tsc --project frontend/yellow/tsconfig.json`: **fails with TS2345 above**. The surrounding shell continued to hash files; its final exit0 is not a TypeScript pass. No build/public/database/source mutation executed in this narrow follow-up.

| Current file | SHA256 |
| --- | --- |
| App.tsx | 7BA3050C7918893331D9B513F3B1C256FBFD16B27B18186BA855E70442BCB9F0 |
| styles.css | 0575673E7FD8C39600E27091070FFDE12C76D8286817428533966BFB726E538F |
| yellow-ambient-ai-mode.test.ts | F210A7F0F4F14C0C26C8CCD589265D9CECB542AA29788F547EE08D53F0897E8C |

## Third independent review — final requested candidate: BLOCKED

Same reviewer/date. Verified actual current files, not implementer results.

Resolved: canvas now uses `pointer-events:none` and direct children are interactive; the previous full-screen transparent hit-test blocker is fixed. “Show full Today” now navigates away from a URL lane, so its reset works. A vertical scroll container has been added.

Still blocking:

- **Lane switching remains incorrect:** `focusedLane ?? aiFocusedLane` is unchanged. Starting with `?lane=due_out`, asking “show arrivals” sets AI due_in but the table remains due_out. Reset repair does not repair switching. On other workspaces this command still sets unused Today-only state rather than showing the requested table. This is deterministic source evidence, not a screenshot inference.
- **Ambient layout requirement remains unmet/unverified:** the sunlight and governed cards are still in fixed z-index40 above the PMS. The accepted reference requires light behind an active in-context PMS. No desktop/mobile screenshot comparison exists. The bounded scroll change is not mobile reachability proof: `align-content:end` on the viewport-sized grid can place an oversized stack before its scroll origin. Use safe/start alignment or normal document flow and execute a long-workflow mobile scroll check. Do not treat an `overflow-y:auto` substring assertion as that proof.

Personally reran the same five-file Bun command and both TypeScript commands from r2: **21 pass, 0 fail, 132 assertions**, typechecks no diagnostics. Ran `bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order503-r3-build-review-20260920`: exit0, 467 modules, temporary `index-CbVyAruV.js` / `index-ByIt3pH8.css`. No public access, source edit, or database action. Full Order503 acceptance and release remain withheld; passing action-regression checks are not disputed.

Current SHA256:

| File | SHA256 |
| --- | --- |
| App.tsx | 7538018D8BA78DB3FE93C8FFC3551D1E5D332A5AB40E4666114EC5418CD56004 |
| styles.css | FA0D1A08B38E028F1C4742B92D39529E54B4C4A7AFA48EBF489E0748E67AF3EE |
| voice.ts | D7142173F3BE4FF625F42025B47508F4ADF0A7793F5857BCA61DD3522B16EFC6 |
| yellow-ambient-ai-mode.test.ts | 8689B09E965A92C7219DFA5DA1677F1B9A1C948934876A22AF4BDD7EEC0629A6 |
| yellow-voice-routing.test.ts | E41BC4B8E072CD63E8A0B13BB7447B8DA8A70CA02850DB21D167B5A59EE7BD95 |

## Fifth independent review — latest narrow verdict

Same reviewer/date. This final section is the latest result; numbered earlier sections retain their historical candidate evidence.

**VERIFIED FIXES; full Order503 acceptance remains withheld.** Personally verified `focusedLane ?? null`, `.lane.focused { grid-column: 1 / -1; }`, and reduced-motion-aware `auto` versus `smooth` scrolling. Both strict frontend and root TypeScript commands now exit0. The first three informational cells and all four column headers now carry appropriate ARIA roles. The previous typecheck/full-span/reduced-motion findings are resolved at source level.

Remaining bounded findings: the fourth action is still a button directly under role=row without a cell wrapper; no explicit table naming association exists, and mobile headers still use display:none. Thus full accessible-table acceptance is not established. Non-Today lane requests still report displayed data without navigating to/rendering Today. Original overlay placement and required desktop/mobile screenshot/reachability proof remain unverified/unresolved. Do not claim those prior findings fixed by this narrower patch.

### Personally executed

```powershell
bun test tests/yellow-ambient-ai-mode.test.ts tests/yellow-voice-routing.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-next-public-surface.test.ts tests/yellow-next-mobile-navigation.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx tsc --noEmit
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order503-r5-build-review-20260920
```

Six-file test result: **21 pass, 1 fail, 143 assertions**. Failure is `tests/yellow-next-mobile-navigation.test.ts:12`, old expected text `Open Overwatch` versus current `Activate Yellow`; this is a stale branding oracle, not evidence that navigation vanished. The five original focused files pass. Both typechecks exit0 without diagnostics. Vite exit0, 467 modules, temporary `index-CxZg9upd.js` / `index-CGhrYFyk.css`. No runtime source edit, public access, deployment, or database action.

| Current file | SHA256 |
| --- | --- |
| App.tsx | 7EC2FA1E84C0AB3973067C3850EDE9E24A35060CA7F4806432462B5E1927A2A9 |
| styles.css | A8EB3240F02EAF88DC3F5DEADAAF9A793B7E1CDC942CAC990ECA39AF9DF2D2F3 |
| voice.ts | D7142173F3BE4FF625F42025B47508F4ADF0A7793F5857BCA61DD3522B16EFC6 |
| yellow-ambient-ai-mode.test.ts | 69DE61BDDAB1C340AB3938AA3EE31DAA4796D0037E8E5D541EAA13792A4D3E8A |
| yellow-voice-routing.test.ts | 2C32B3E6753E35AC8D0279ABC3DB465019925982CF98251AA3178FF37A1BC68E |
| yellow-next-mobile-navigation.test.ts | 8947ACD3DD9E6F730EDBD6A2C3E98DE2F3B15BA9942CD5D56E6FB7FF7D0DBF76 |
