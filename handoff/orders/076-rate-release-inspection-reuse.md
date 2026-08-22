# Order 076 — Immutable rate-release inspection and safe reuse

**Phase:** 3 · Rates and policies  
**Branch:** `phase-3/rate-release-reuse-workbench`  
**Tier:** 2 — read-only release reconstruction and founder-workbench reuse over unchanged publication authority  
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221/D-265

## Outcome

Make every immutable rate release understandable and reusable from the authenticated founder
workbench. The server must reconstruct one complete canonical authoring command from the exact
stored model, target and release versions. The operator may inspect that command or copy it into
Expert mode as an unsaved starting point, but must still deliberately save a new immutable draft,
preview it, obtain separate approval and publish through the existing governed path.

## Natural-Solution Test

Orders 065–069 already persist the complete versioned model selection, targeting rules, evaluator,
composition and RMS binding. Order 071 already returns those histories and compiles Expert JSON
through the same strict command as Guided mode. The missing capability is a safe join and presentation,
not a new rate entity, editor schema or publication path. Reconstruct from the stored version tuple,
re-run the existing compiler on the server, expose the result as read-only response data, and reuse the
existing Expert editor for changes. No migration, extension, event or mutable history is needed.

## Scope

- `src/http/operator.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.js`
- `src/http/operator/operator.css`
- `tests/operator-rate-builder.integration.test.ts`
- `tests/operator-assets-security.test.ts`
- `docs/CONTRACTS.md`
- `src/project-status.ts` only for exact completed-order and Gate-3 debt counters
- `tests/founder-status.integration.test.ts` only for exact current-order assertions
- `handoff/orders/076-rate-release-inspection-reuse.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- further numbered D-92 question/response files only if a hard-floor condition occurs

## Required work

1. On the existing authenticated rate-builder read route, match every release to its exact
   `modelDraftId` + version and `targetDraftId` + version from the same tenant, property and rate plan.
   Missing, duplicate or mismatched stored references fail closed; never guess by array position or
   latest version.
2. Reconstruct the complete authoring transport from server-owned fields only: authoring mode, plan,
   registered model and components, all target rules, evaluator, composition and RMS binding. Round it
   through the existing strict `compileRateAuthoringCommand` before returning it, so stored bytes do not
   create a second or weaker authoring schema. HTTP bigint values remain canonical decimal strings.
3. Attach the reconstructed command to that release in the existing rate-builder response. Do not add
   a write route or accept a release body from the browser. Do not expose tenant, property, actor,
   audit envelope, approval, result, content/preview authority or database metadata inside the command.
4. Expand each immutable history card with a keyboard-accessible “Inspect exact version” disclosure
   showing the full server-reconstructed command and a concise model/target/policy summary. Use text
   nodes and `textContent` only; do not interpret stored content as HTML.
5. Add “Use as starting point” for draft, active and retired releases. It deep-copies only the returned
   canonical command into the existing Expert JSON editor, switches to Expert presentation, moves the
   operator to the editable step, clears stale AI proposal state, and states that nothing was saved or
   changed. It must not select, mutate, undo, preview, approve or publish a release automatically.
6. Preserve “Use draft” as the explicit preview/approval selection for draft releases and “Create undo
   draft” as the exact historical-copy command for active/retired releases. The three actions must remain
   visibly distinct: inspect, start a modified new version, and create an exact undo version.
7. Prove an API round trip: copy the server command, change one permitted exact-money field, create a
   new immutable release through the existing endpoint, and show that the source release and its command
   remain byte-equivalent while the successor contains only the deliberate change.
8. Update the operator contract and exact founder snapshot counters only after every focused and standing
   proof is green. Record the completed row as `UNVERIFIED`; this order is not independent review.

## Forbidden

- Any file under `migrations/`, schema snapshot or `tests/run_invariants.py`
- Changes to model/evaluator/targeting/composition/RMS normalization, pricing, quote, publication,
  approval, idempotency, restriction, availability, occupancy, tax, fiscal, journal, RLS or tenant context
- A new table, extension type, event, state, permission, dependency, endpoint, worker, cache, browser
  storage, AI/provider call or second rate-authoring/publication path
- Browser reconstruction of release authority, guessing referenced versions, partial Guided hydration,
  JavaScript-number money, arbitrary code/SQL/formula execution or client-computed prices/conflicts/hashes
- Editing an existing release, autosave, direct activation, self/auto approval, automatic preview/publish,
  or relabelling “Use as starting point” as undo
- Hiding mandatory compliance, tax, policy, restriction or availability evidence; hotel configuration
  remains bounded by constitutional safeguards
- Rebuilding or reseeding the persistent founder stack before focused proofs are green; if the app is
  replaced afterward, restore PostgreSQL, Valkey and app health and preserve the review login
- Approval, independent Gate-3 review or merge by Codex

## Pre-registered proof

- **P0 — intentional red:** on a fresh migrated disposable database, create one release containing a
  non-default exact amount, all four policy references and multiple target rules. Read the authenticated
  rate-builder response and require `release.authoringCommand` to equal the complete canonical transport.
  Before production edits the field is absent, so the exact focused run must report one failed equality,
  preserve that output in git, and stop before implementation.
- **P1 — exact server reconstruction:** the returned command names the exact stored model and target ids'
  versions indirectly through their content, preserves canonical string money, policies, rules, package,
  distribution and RMS null/value, and contains none of tenant/property/actor/audit/approval/result/hash
  authority. Missing or mismatched referenced versions fail closed without cross-plan or cross-tenant data.
- **P2 — immutable reuse round trip:** posting a deliberately modified deep copy through the existing draft
  endpoint creates one new atomic model/target/release trio. Reading history shows source command unchanged,
  successor command with only the intended field changed, and distinct immutable ids/versions.
- **P3 — browser contract:** always-on asset proof requires the inspect disclosure, safe `textContent`,
  “Use as starting point”, explicit unsaved copy, preserved “Use draft” and “Create undo draft”, and no SQL,
  browser authority, storage or auto-publication escape hatch.
- **P4 — live founder workflow:** without reseeding, inspect the existing Release v1, copy it into Expert
  mode, change a harmless unsaved amount, and confirm the command preview changes while release history and
  selected server preview remain unchanged. Do not save the founder's exploratory edit.
- **P5 — standing gate:** frozen install, state, typecheck, boundaries, complete default tests, licence
  audit, dependency audit, schema drift, protected hashes and fresh isolated app-never-started referee all
  remain green. Refresh Graphify as a derived map and record parser/semantic limitations honestly.

## Captured P0

Fresh migrated disposable Compose project `yellow-order-076-red`, before production edits:

```text
expect(source?.authoringCommand).toEqual(sourceCommand);
Expected: the complete 72-line canonical guided command
Received: undefined
7 pass
1 fail
41 expect() calls
Ran 8 tests across 1 file.
```

## Standing and handoff

Commit this order before adding P0. Preserve the exact red result before production edits. Run the entire
operator-rate-builder file after every correction and keep the new reuse fixture isolated from Order 071's
publication sequence. Commit implementation before manifest/status bookkeeping. Then run the complete
standing gate and a fresh isolated `./setup.sh --db-only` with the app never created. Only afterward replace
the founder app container without reseeding, verify all three services, refresh Graphify, push a stacked
draft PR based on Order 075's branch, and do not approve or merge.
