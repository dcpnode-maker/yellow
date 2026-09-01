# Order 316 independent Tier 2 review

**Disposition: WITHHOLD**

**Reviewer:** Codex, fresh non-implementing Tier 2 reviewer

**Candidate:** `997ae0521e33d8c5808051b3e6dc860d5a7370eb`

**Approved base:** `721cbbc`

## Finding

### F1 — authenticated root renders Today but permanently discards its successful reads

Severity: **P1 / approval-blocking**.

The candidate makes Today the visual default at `/`, but it does not canonicalize the authenticated root to `/p/<property>/today`. `showWorkbench()` calls `setView(activeView, false)` while the URL remains `/`. Every Today response is then rejected by `todayRequestIsCurrent()`, whose currentness predicate requires `location.pathname === /p/<property>/today`.

I reproduced this in an isolated disposable browser harness on loopback port 3316 with successful bounded JSON responses. After login at `/`, Today was active and Availability was hidden, but all three Today lanes remained `aria-busy="true"`, displayed “Loading this bounded page…” and “Not loaded.”, and never settled. The pathname remained `/`. This violates the order's root/default-Today requirement as an operational workflow, despite the navigation shell being visually correct.

Relevant source: `src/http/operator/operator.js` lines 1048-1054 and 1804-1807.

## Independently executed evidence

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

Approval is withheld. The permanent proof needs an authenticated-root case that returns successful Today payloads and asserts all lanes settle, so the visual default cannot pass while its guarded reads are silently discarded. After the root is made canonical or the currentness predicate deliberately supports `/`, rerun the full navigation, dirty-cancellation, direct restoration, appearance/accessibility, console/network, and standing proof under a fresh independent review.
