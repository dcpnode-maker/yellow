# Order568 — independent source review

Date:2026-09-21. Reviewer: OpenAI Codex independent Astra agent `/root/astra_review`, not the implementer.

## Verdict: ACCEPT — presentation-only candidate

Read PROJECT.md, ran canonical `./state.ps1`, read Order568 and applied the Yellow compliance/entity/PostgreSQL boundaries. Inspected the exact scoped runtime App/CSS/test source. No implementation edit, migration, database connection, financial operation or deployment was performed. This accepts the candidate, not a public postflight or a new financial contract.

## Frozen reviewed bytes

Runtime root: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

| File | SHA256 |
| --- | --- |
| frontend/yellow/src/App.tsx | 95A1E2634FE4517D8E73D68F88C975368B48BB582F70693C63C7D81CE7BFD949 |
| frontend/yellow/src/styles.css | AE334F9E2FFD4403E2D6C85B83319745AB64BAF57EF7143DF2BE2644DF663E3F |
| tests/yellow-next-finance-workspace.test.ts | 9A139D144B2F2D2D14784CFE9C4F758045A7A29C4C5E26B098571B67BC88FB59 |

Adjacent voice.ts remains exact previously accepted SHA256 `4E943795D57C173A381200F525449C6F13A40EEE136E982DB8FB7CA46CB6A838`.

## Personally executed commands/results

Run from runtime root:

- `bun test tests/yellow-next-finance-workspace.test.ts tests/yellow-voice-routing.test.ts` — **41 passed,0 failed,344 assertions**,163ms on final repair. Includes finite cashier confirmation, current-stay resolution, Indian-English language preference and canonical cashier source controls.
- `bunx tsc --project frontend/yellow/tsconfig.json` — exit0, no diagnostics; separately rerun after final build.
- `bunx vite build --config frontend/yellow/vite.config.ts` — exit0,469 modules. Reviewer-produced assets `index-H3MwgIXN.js` and `index-BOgxiBmJ.css`; no serving container was changed.
- `node D:/Yellow/temp/astra568-css.cjs` — isolated Playwright/installed Chrome computed-style check with exact final stylesheet, viewport375×812 and1440×900, plus reduced-motion emulation. No application/server/database URL was opened. The Browser skill/runtime was not available; existing bundled Playwright was used without installing dependencies.
- `Get-FileHash` bound final App/CSS/test and unchanged voice bytes above.

## Findings and disposition

The initial source inspection found a real CSS cascade hazard: generic later `.cashier-charge-form button` could override the segmented background while the new data-group selectors supplied dark foregrounds. Reported to the implementer; the implementer added higher-specificity group/option transparent backgrounds, corresponding dark text and explicit active white/yellow-border state, plus source regression assertions. The original run was41/0/341; final run is41/0/344. The first rendered probe ran after the repair had landed, so **no pre-repair rendered contrast failure is claimed**. Final computed styles confirm the repair.

The corrected candidate has no remaining blocking finding in this bounded scope:

- Group buttons remain `type=button`, labelled, `aria-pressed`, with visible active check mark/border/background rather than colour alone. SVGs are decorative (`aria-hidden`, non-focusable); accessible names remain the text labels. Keyboard focus reaches Rooms. Current-status strings remain visible alongside positive/attention/neutral containers; data-status does not change domain status.
- Group/options derive only from server-returned `chargeOptions`. Group changes clear confirmation and candidate key; selecting a different code also resets the candidate. Grouping changes presentation, not transaction-code authority.
- The inspected `postFolioCharge` still invokes only canonical `POST /api/v1/properties/${propertyId}/folios/${folioId}/charges`, JSON body, Bearer session and supplied idempotency key. The existing manual handler requires authoritative chargeAvailability, selected server option, valid positive integer amount/quantity and checked visible confirmation; acquires/releases the shared lifecycle lock; uses its existing ref-backed key; refetches canonical statement on success and denial. No settlement, drawer/session operation, direct DML or fiscal endpoint is added by the inspected affordance code.
- Empty-drawer copy explicitly separates unavailable custody controls from governed folio charges. It does not enable the posting form: readiness remains server-owned. No cash-custody or settlement bypass is introduced.
- Final isolated computed-style evidence:375px document scrollWidth375;1440px scrollWidth1440; every group button height44px, widths≥83px; horizontal group scrolling remains. Active All has white background/dark text/check mark. Inactive groups compute transparent backgrounds over the light-grey rail, not black. Reduced-motion group transition duration0s; no new animated effect.

## Rendered evidence and limits

Artifacts: `D:/Yellow/temp/astra568-css.cjs`, `astra568-css-results.json`, `astra568-css-375.png`, `astra568-css-1440.png`. Reviewer visually inspected the mobile screenshot. This is an isolated stylesheet/representative markup geometry and cascade test, **not an authenticated rendered CashierWorkbench end-to-end journey**; no financial POST was attempted. The icon fixture uses a generic decorative SVG, so exact production icon-path aesthetics were inspected in source, not asserted from that screenshot.

Runtime is an exported source directory with no Git metadata. Retained pre568 hashes exist, but full preimage App/CSS/test bytes do not. Therefore this review verifies current endpoint/confirmation semantics and the implementer's bounded edit description; it does not claim an exact whole-file before/after diff. Existing accepted financial implementation proof remains separate (Orders565/566), and no new DB proof was necessary or performed for this presentation-only scope.

**ACCEPT** these exact corrected bytes. Any public promotion remains a separate deployment/postflight responsibility. No new financial, fiscal, settlement, complete-cashiering or whole-PMS acceptance follows.
