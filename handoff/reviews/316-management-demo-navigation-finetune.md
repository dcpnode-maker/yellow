# Order 316 independent Tier 2 review

**Disposition: APPROVE**

**Reviewer:** Codex, fresh non-implementing Tier 2 reviewer

**Candidate:** `d81de9ce4abf820c4aa529fe7ba8407bb990cc2c` (product remediation `07b7297`)

**Approved base:** `721cbbc`

## Re-review disposition

The exact remediated governance candidate is approved. Product remediation `07b7297` fixes F1 by synchronously replacing authenticated bare root with `/p/<selected-property>/today` before `setView(activeView, false)` starts the guarded Today reads. Rejected candidate `997ae0521e33d8c5808051b3e6dc860d5a7370eb`, its finding, and D-876 remain in ancestry and audit history.

No open findings remain.

## Rejected-candidate finding (closed by `07b7297`)

### F1 — authenticated root renders Today but permanently discards its successful reads

Original severity: **P1 / approval-blocking**. Status: **closed and personally reverified**.

The candidate makes Today the visual default at `/`, but it does not canonicalize the authenticated root to `/p/<property>/today`. `showWorkbench()` calls `setView(activeView, false)` while the URL remains `/`. Every Today response is then rejected by `todayRequestIsCurrent()`, whose currentness predicate requires `location.pathname === /p/<property>/today`.

I reproduced this in an isolated disposable browser harness on loopback port 3316 with successful bounded JSON responses. After login at `/`, Today was active and Availability was hidden, but all three Today lanes remained `aria-busy="true"`, displayed “Loading this bounded page…” and “Not loaded.”, and never settled. The pathname remained `/`. This violates the order's root/default-Today requirement as an operational workflow, despite the navigation shell being visually correct.

Relevant source: `src/http/operator/operator.js` lines 1048-1054 and 1804-1807.

## Original independently executed evidence

### Revision and scope

- `git rev-parse HEAD` → `997ae0521e33d8c5808051b3e6dc860d5a7370eb`.
- `git merge-base --is-ancestor 721cbbc 997ae0521e33d8c5808051b3e6dc860d5a7370eb` → exit 0.
- `git status --short` before this review artifact showed only the pre-existing untracked `.yellow/` directory.
- I read `PROJECT.md`, `AGENTS.md`, `./state.sh`, Order 316, and decisions D-874/D-875 before review. The product diff is confined to the operator static UI and its tests; it adds no migration, domain capability, status, database authority, or post-310 workflow.

### Disposable browser proof

I served the exact candidate's operator HTML/CSS/JS from a separate Bun harness at `127.0.0.1:3316`, with bounded in-memory mock GET responses. I did not access, replace, restart, promote, or mutate the approved local on port 3000.

Observed green behavior before encountering F1:

- Root login selected Today; Availability was hidden.
- The journey index exposed exactly seven truthful controls: Today, Reservations, Folios, Cashiers, Housekeeping, Vehicles, and Operations.
- Successful Simple navigation to Housekeeping closed the overlay (`hidden=true`, disclosure `aria-expanded=false`) and focused `housekeeping-title`.
- Each of the seven Simple secondary destinations was exercised: Operations, Housekeeping, Vehicle register, Inventory setup, Restrictions, Rates, and Project status. Each produced its canonical path, closed the overlay, set the active control, and focused the destination heading.
- Today → Reservations → Folios followed by Back and Forward restored Reservations and Folios respectively with the correct URL and active view.

The browser finding was deterministic: at `/`, after successful Today API responses, due-in, due-out, and in-house all remained busy/loading because the response-currentness guard rejected the noncanonical root path.

### Automated proof

Focused/adjacent command:

`bun test tests/operator-management-demo-navigation-finetune.intentional-red.test.ts tests/operator-today-command-centre.integration.test.ts tests/operator-adaptive-experience.test.ts tests/operator-appearance-geometry.test.ts tests/operator-ui-foundation.test.ts tests/operator-folio-routing-http.intentional-red.test.ts tests/operator-reservation-workspace.integration.test.ts`

Result: **46 pass, 0 fail, 753 assertions** (including Chromium geometry).

Static gates:

- `bun run typecheck` → pass.
- `bun run boundaries` → 127 TypeScript files checked, pass.
- `bun run license-check` → 23 packages checked, pass.
- `bun audit` → no vulnerabilities.
- `git diff --check` → pass.

Standing suite:

`bun test` → **1130 pass, 890 skip, 1 fail, 17219 assertions**. The sole failure was the Chromium appearance-geometry case after approximately eight seconds. Immediate isolated rerun, `bun test tests/operator-appearance-geometry.test.ts`, produced **4 pass, 0 fail, 46 assertions**, including the same Chromium case in approximately six seconds, so this appears transient rather than a deterministic candidate regression. It does not cure F1.

## Approval boundary

The original candidate was correctly withheld pending an authenticated-root settlement proof.

## Remediated-candidate independent re-review

### Exact revision, ancestry, and scope

- `git rev-parse HEAD` → `d81de9ce4abf820c4aa529fe7ba8407bb990cc2c`.
- `git merge-base --is-ancestor 997ae0521e33d8c5808051b3e6dc860d5a7370eb d81de9ce4abf820c4aa529fe7ba8407bb990cc2c` → exit 0; rejected history is preserved.
- `git show --stat --oneline 07b7297` → only `src/http/operator/operator.js` and the Order 316 intentional-red test changed, seven inserted lines total.
- The remediation adds no API, migration, database capability, status, business mutation, financial/statutory authority, aspirational promise, or post-310 workflow. Before this review-file update, status again showed only the pre-existing `.yellow/` directory.

### Personally executed disposable-browser proof

I reused the isolated Bun harness at `127.0.0.1:3316`, which serves the exact current candidate assets and bounded in-memory API responses. The approved local on port 3000 was not accessed, restarted, altered, or promoted.

- Authenticated bare `/` synchronously became `/p/00000000-0000-0000-0000-000000000316/today` before guarded reads settled. Today was active. Due-in, due-out, and in-house each reached `aria-busy="false"`, hid loading, exposed its truthful empty state, and announced `0 records shown.`
- The journey index contained exactly seven controls and labels: Today lanes (`today`), Reservations, Folios, Cashiers, Housekeeping, Vehicle register, and Operations. Copy remained bounded to existing connected workspaces.
- Simple Housekeeping navigation closed the secondary overlay (`hidden=true`, `aria-expanded=false`), selected Housekeeping, produced the canonical route, and focused `housekeeping-title`.
- All seven secondary controls were independently exercised. Operations, Housekeeping, Vehicle register, Inventory setup, Restrictions, Rates, and Project status each produced the correct canonical path, closed Simple disclosure, selected the correct view, and focused the exact destination heading.
- Today → Reservations → Folios followed by Back restored Reservations and Forward restored Folios, with matching canonical URLs and active controls.
- Dirty cancellation was personally exercised from reservation creation after entering child ages `7`. Dismissing the confirm retained the exact origin `/reservations?new=1&step=stay`, retained active Reservations and the entered value, and did not navigate to Operations.
- A direct authenticated `/p/<property>/operations` restoration showed Operations unobscured with its view and heading visible and Simple secondary disclosure closed.
- Advanced and Expert hid the Simple preview and exposed all exact seven secondary controls directly; returning to Simple restored the preview and collapsed the secondary grid. The disclosure retains `aria-describedby="secondary-workspaces-preview"`.
- All six appearances were selected at 1280, 760, and 390 CSS-pixel widths. The active content and Simple preview remained present. The focused Chromium geometry proof below independently validates its contract widths. Reduced-motion emulation matched and reduced animation/transition durations to `0.00001s`; forced-colors emulation matched, retained a solid disclosure boundary, and kept the active heading present. Temporary viewport/media overrides were reset.
- Browser console warnings/errors after the workflow: **0**.
- Source inspection and permanent tests confirm Today remains GET-only and the Order 316 delta introduces no API request or business mutation.

### Re-executed commands and results

Focused/adjacent command:

`bun test tests/operator-management-demo-navigation-finetune.intentional-red.test.ts tests/operator-today-command-centre.integration.test.ts tests/operator-adaptive-experience.test.ts tests/operator-appearance-geometry.test.ts tests/operator-ui-foundation.test.ts tests/operator-folio-routing-http.intentional-red.test.ts tests/operator-reservation-workspace.integration.test.ts`

Final isolated result: **46 pass, 0 fail, 756 assertions**, including Chromium disclosure/Win95/ERP geometry. An immediately preceding run had one `EBUSY` on Chromium's temporary `DevToolsActivePort`; the clean sequential rerun passed the identical case and suite.

Standing suite:

`bun test` → **1131 pass, 890 skip, 0 fail, 17222 assertions** across 367 files.

Static gates:

- `bun run typecheck` → pass.
- `bun run boundaries` → 127 TypeScript files scanned, pass.
- `bun run license-check` → 23 packages, pass.
- `bun audit` → no vulnerabilities.
- `git diff --check` → pass.

### Final approval boundary

**APPROVE** exact candidate `d81de9ce4abf820c4aa529fe7ba8407bb990cc2c`. The original F1 is closed by executable browser evidence and permanent regression proof. This approval grants no downstream product, statutory, financial, database, status, or runtime authority.
