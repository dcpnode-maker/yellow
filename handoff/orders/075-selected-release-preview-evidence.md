# Order 075 — Selected-release policy evidence at the operator boundary

**Phase:** 3 · Rates and policies  
**Branch:** `phase-3/selected-release-preview-evidence`  
**Tier:** 3 — preview evidence is approval- and publication-bound configuration evidence  
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221/D-263

## Outcome

Make an existing immutable rate-release draft previewable even when the unsaved Guided/Expert form
currently shows different policy selections. Preview, approval request and publish must all derive
the four configurable policy references from the selected release on the authenticated server
boundary. The browser may choose the preview scenario, but it cannot assert which cancellation,
deposit, guarantee or no-show policies belong to the selected release.

## Natural-Solution Test

Order 069 already stores the exact normalized policy configuration inside each immutable release and
its publication service already refuses mismatched evidence. Order 071's HTTP adapter currently
reuses the browser's live form controls to manufacture that evidence. Selecting an older draft does
not hydrate those controls, so a valid release can fail with `RateCompositionError` and surface as a
generic 503. The natural boundary correction is to remove policy ownership from preview payloads and
bind canonical evidence from the exact release already loaded during authorization. Do not weaken or
duplicate the composition validator.

## Scope

- `src/http/operator.ts`
- `src/http/operator/operator.js`
- `tests/operator-rate-builder.integration.test.ts`
- `docs/CONTRACTS.md`
- `src/project-status.ts` only for exact completed-order and Gate-3 debt counters
- `tests/founder-status.integration.test.ts` only for exact current-order assertions
- `handoff/orders/075-selected-release-preview-evidence.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- further numbered D-92 question/response files only if a hard-floor condition occurs

## Required work

1. Extend the existing authenticated release authorization result to retain the exact immutable
   `RatePlanRelease` already proved to belong to the tenant, granted property and route rate plan.
   Do not add a query or trust a browser-supplied release body.
2. Add one private operator-boundary normalizer that accepts 1–500 browser preview cells, rejects a
   caller-supplied `policyEvidence` field, preserves all other preview inputs for the established
   Order 069 validator, and attaches a newly frozen policy-evidence array derived only from the
   selected release's normalized `compositionSpec.policy`.
3. Emit non-null policy references in the stable order `cancellation`, `deposit`, `guarantee`,
   `no_show`. Each evidence reference must name the selected immutable release and exact policy id;
   null release policy slots produce no evidence entry. Do not query, infer or invent a policy.
4. Apply the same boundary normalizer to simulate, approval request and publish before delegating to
   the unchanged `RatePublicationService`. Therefore the approval preview hash and publication
   re-simulation bind byte-equivalent server-derived policy evidence.
5. Remove the browser's `builderPolicyEvidence()` authority and omit `policyEvidence` from its
   preview-cell payload. Keep browser-owned dates, room/commercial scenario, guests, promotion,
   availability and channel inputs unchanged; their established server validators remain exact.
6. Document the operator contract: policy ids for a selected draft come from that immutable release,
   caller-supplied policy evidence is invalid, and current unsaved editor policy choices affect only
   a newly saved draft.
7. Update only the exact founder snapshot counters after every focused and standing proof is green.
   Record the completed row as `UNVERIFIED`; this order is not independent review of itself.

## Forbidden

- Any file under `migrations/`, schema snapshot or `tests/run_invariants.py`
- Changes to rate evaluator, composition, targeting, publication, quote, policy persistence,
  restriction, availability, occupancy, tax, fiscal, journal, RLS or tenant-context logic
- A new table, extension type, event, approval state, permission, endpoint, dependency, worker,
  cache, external adapter or browser storage
- Browser-supplied policy identity/evidence, client-computed price/conflict/hash, auto/self approval,
  direct activation, mutable release history or a second preview/publication path
- Treating saved release policy references as proof of statutory/tax truth; mandatory runtime
  evidence remains separate and non-disableable
- Rewording or hiding the observed error instead of correcting the evidence boundary
- Rebuilding or reseeding the persistent founder stack before focused proofs are green; if the app
  is replaced afterward, restore PostgreSQL, Valkey and app health and preserve the review login
- Approval, independent Gate-3 review or merge by Codex

## Pre-registered proof

- **P0 (red first, amended by Question 125):** assert the exact status vector `[400, 200, 400]` for
  the legacy live payload with `policyEvidence: []`, the corrected browser payload with the field
  omitted, and a caller payload with matching evidence. Before production edits the captured vector
  is `[503, 400, 200]`: live mismatch leaks as unavailable, omission is rejected, and caller evidence
  is still accepted. Preserve that exact red output in git.
- **P1:** a selected draft containing all four policy references simulates successfully while the
  browser payload contains no policy evidence; returned composition evidence names the stored
  release policies in stable order and not any current form selection.
- **P2:** caller-supplied empty, matching, mismatched or extra policy evidence is rejected at the
  operator boundary before simulation; malformed remaining cell fields still fail in the existing
  domain validator without a second transport schema.
- **P3:** preview, approval request and separately approved publication re-run the same browser cell
  set with identical server-bound evidence and exact preview hash; stale/different previews and
  self-approval remain rejected.
- **P4:** missing scope, ungranted property, wrong route plan, foreign tenant and unknown release fail
  before evidence is exposed; the authorization helper returns no unproved release.
- **P5:** from the authenticated founder workbench, selecting the existing draft and running server
  preview succeeds without saving or reseeding. Release history, Guided/Expert fields, targeting,
  approval explanation and theme behavior remain usable at wide and narrow viewports.
- **P6:** frozen install, typecheck, boundaries, complete default tests, licence audit, schema drift,
  protected hashes and fresh isolated app-never-started referee remain green.

## Captured P0

Fresh migrated disposable database `yellow_order075`, before production edits:

```text
expect([staleBrowser.status, serverBound.status, callerOwned.status]).toEqual([400, 200, 400]);
Received: [503, 400, 200]
6 pass
1 fail
37 expect() calls
Ran 7 tests across 1 file.
```

## Standing and handoff

Commit this order before the test. Preserve P0 before production edits. Use a disposable focused
database and restart the complete operator-rate-builder suite after every correction. Commit the
implementation before adding the manifest row and advancing exact founder-status counters. Run the
complete standing gate and fresh isolated `./setup.sh --db-only` with the app never created. Only
then replace the founder app container without reseeding, verify the live selected-draft preview and
all three service health checks, refresh Graphify as a derived map, push a stacked draft PR, and do
not approve or merge.

## Builder evidence

- Focused disposable PostgreSQL proof: `7 pass`, `0 fail`, `38 expect() calls`; simulation,
  four-eyes approval, separately approved publication and immutable undo all reran with browser
  policy evidence absent.
- Standing gate: frozen install unchanged; typecheck and 49-file import boundary scan green;
  `87 pass`, `0 fail`, `1,102 expect() calls`; licence policy green; `bun audit` found no
  vulnerabilities; schema snapshot exact.
- Fresh isolated `yellow-order-075-referee` project, app never created: `11 passed, 0 failed of 11`.
- Persistent founder stack was not reseeded. Live selected Release v1 returned exact status vector
  `[400, 200, 400]` and four server-derived release policy evidence items; `/health` and authenticated
  `/system-status` returned 200 with app/database operational and Order 075 / 31 UNVERIFIED debt.
- Browser limitation: the in-app browser rejected new localhost navigation with
  `ERR_BLOCKED_BY_CLIENT`, so the agent did not claim a rendered click proof. The exact browser asset
  proof is green and the deployed same-origin request was executed through the live HTTP boundary;
  founder visual confirmation remains useful review, not a hidden approval substitute.
- Protected hashes remained exact:
  `migrations/0001_init.sql` =
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`;
  `tests/run_invariants.py` =
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
- Graphify's disposable structural map refreshed to 4,608 nodes / 7,655 edges / 502 communities,
  with zero missing, dangling, duplicate or collapsed endpoints. Five known self-loops remain;
  three SQL files still lack \`tree_sitter_sql\`; 202 changed semantic documents remain deliberately
  unstamped for later LLM extraction rather than being falsely marked current.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
