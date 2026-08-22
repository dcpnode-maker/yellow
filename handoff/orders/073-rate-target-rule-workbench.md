# Order 073 — Rate applicability rules and versioned bulk preview

**Phase:** 3 · Rates and policies  
**Branch:** `phase-3/rate-target-rule-workbench`  
**Tier:** 3 — hotel-configurable commercial applicability and publication evidence  
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221

## Outcome

Close the largest remaining gap between the founder's universal rate-plan flow and the running
workbench. A hotel can compose multiple include/exclude applicability rules in Guided mode across
property, class, room type and exact sellable scope plus every existing commercial dimension. The
same immutable release can then preview a bounded batch of stay-date cells and show the server's
per-cell winning rule, matched rules, conflicts and result before approval or publication.

This is a workbench over the existing Order-066 targeting resolver and Order-069 simulation and
publication boundary. It adds no new inheritance algorithm, pricing engine, persistence path or
client-side conflict authority.

## Natural-Solution Test

- Order 066 already accepts 1–200 strict target rules and resolves deterministic specificity,
  commercial-dimension count, explicit priority and equal-rank conflict refusal.
- Order 071 currently submits only one visual rule even though its canonical command supports the
  complete array.
- Order 069 already returns all server-evaluated preview cells, but the browser reduces them to
  aggregate counts.
- Therefore the natural solution is a dynamic rule editor plus a read-only cell evidence table in
  the existing browser. The authenticated mutation and publication routes remain byte-identical.

## Scope

- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `tests/rate-authoring.test.ts`
- `tests/operator-rate-builder.integration.test.ts`
- `docs/CONTRACTS.md`
- `design-qa.md`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- `handoff/orders/073-rate-target-rule-workbench.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- `handoff/questions/`

## Required work

1. Replace the single visual target with an accessible bounded rule collection:
   - one default property include rule exists initially;
   - Add, duplicate and remove are explicit operator actions; at least one rule always remains;
   - each rule has a stable lowercase key, include/exclude effect, 0–1000 priority, physical kind,
     exact class membership or unit/sellable reference, and all nine existing commercial fields;
   - the UI explains most-specific inheritance and exceptions without claiming a mutable tree;
   - the canonical Guided command contains every visual rule and still passes the unchanged strict
     authoring compiler on the server.
2. Preserve progressive usability. Rule cards summarize scope/effect/commercial filters when
   collapsed; invalid or duplicate keys are reported before save; a rule may be duplicated as the
   starting point for an exception but receives a new unique key. Expert and AI modes retain their
   exact existing canonical behavior.
3. Render the existing server simulation cells as text-only evidence rows. For each preview key show
   result state, winning rule, matched rules, conflicts and exact minor-unit pre-tax total when one
   exists. Aggregate counts/hashes/work units remain visible. The browser never decides a winner,
   computes a price, clears a conflict or alters a returned result.
4. Make the founder workflow visibly match the requested bulk sequence: choose scope/dates/fields,
   review cells/conflicts, request independent approval, publish and undo only as a new version.
   Empty, long, conflict and narrow states must work in Apple and Pixel themes.
5. Document the difference between rule-array authoring, deterministic server resolution and
   immutable release versioning. Update dashboard counters only after proof, refresh Graphify as a
   derived map, commit, push and open a draft PR stacked on Order 072.

## Forbidden

- Editing migrations, schema snapshots, `tests/run_invariants.py`, targeting resolution,
  availability/occupancy/restrictions, pricing/evaluator/composition, publication/approval/undo,
  journal, tax/fiscal/statutory, RLS or tenant context
- A table, extension type, event, fact, state transition, permission or endpoint
- Browser-computed specificity, winner, conflict, quote, hash, work units or amount
- Auto-save, auto-preview, auto-approval, self-approval, auto-publish or history rewrite
- An unbounded rule or preview collection; arbitrary HTML/code/formulas; browser persistence
- Treating class membership as a global mutable taxonomy; it remains an exact draft snapshot
- Hiding authoritative Restrictions or implying rate rules can override compliance/system truth
- Approval, Gate-3 review or merge by Codex

## Pre-registered proof

### P0 — intentional red

Add a static workbench proof requiring the absent rule-list/add-rule controls and absent rule/cell
renderers. Commit the exact failing assertions before changing production assets.

### P1 — visual rule compiler

Prove one default rule, add/duplicate/remove, all four physical ranks, include/exclude, nine
commercial dimensions, exact class membership, priority/key bounds, 1–200 limit and canonical
multi-rule command output. Prove duplicate/invalid keys fail before any request.

### P2 — unchanged authenticated write boundary

Extend the existing live operator proof with one include plus one more-specific exclude rule in a
single immutable draft. Server preview must return the exact exclusion/winner evidence while the
existing transaction, idempotency, fact/event and four-eyes boundaries remain unchanged.

### P3 — per-cell evidence renderer

Prove the browser consumes only server-returned `simulation.cells`; text-node rendering covers
quoted, blocked, unpriced and conflict states, exact string money and missing winner. No `innerHTML`,
client price/conflict/resolution function or browser storage exists.

### P4 — rendered founder review

In the persistent app create an include plus exclusion, save one immutable successor draft, run a
multi-date server preview and inspect every evidence row. Verify long/empty/conflict-safe states,
keyboard focus, both themes, responsive rules and an empty console. Do not approve or publish.

### P5 — standing gate

From the top: frozen install; state; typecheck; import boundaries; complete default tests; license;
audit; schema drift; protected hashes; fresh isolated app-never-started `./setup.sh --db-only`
11/11. Refresh Graphify code-only and cluster report, record limits, update status/manifest/ledger,
commit, push and open a draft PR. Do not merge.

## Definition of done

- [ ] P0 is preserved before production changes.
- [ ] P1–P5 pass without changing the Order-066 resolver or Order-069 publication boundary.
- [ ] Hotels can author broad inheritance plus explicit exceptions in one canonical release.
- [ ] Bulk preview evidence is server-derived and visible per cell.
- [ ] Compliance, occupancy, restriction, audit and four-eyes guards remain non-disableable.
- [ ] Persistent localhost is healthy and left on the rate builder.
- [ ] Order 073 is recorded UNVERIFIED for later independent Gate-3 execution.
