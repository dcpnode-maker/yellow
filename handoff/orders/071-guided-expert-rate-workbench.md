# Order 071 — Guided and expert universal rate-plan workbench

**Phase:** 3 · Rates and policies  
**Branch:** `phase-3/guided-expert-rate-workbench`  
**Tier:** 2 — operator orchestration and browser experience over existing Tier-3 primitives  
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221

## Outcome

Replace the current fragmented rate setup screen with one founder-reviewable five-step builder:
Create rate, Pricing, Who gets it, Where/when, and Review/publish. A hotel can choose any of the
ten registered models, start in Guided mode, open the complete Expert controls, preview up to 500
cells, request four-eyes approval, publish an exact approved release and create an undo draft.

Guided and Expert are presentations over one canonical command. The browser never becomes rate,
availability, conflict, approval or compliance authority.

## Natural-Solution Test

- `rate_plan` remains the sellable identity; existing policy references remain authoritative.
- `rate_plan_model`, `rate_plan_target` and `rate_plan_release` extension versions already store
  the immutable draft/release meanings required by this UI.
- Orders 067/068 already normalize and evaluate exact pricing/composition ASTs.
- Order 069 already owns simulation, four-eyes approval binding, activation and versioned undo.
- Order 070 already owns live quote/RMS evidence and keeps projection separate from availability.
- Therefore this order adds a strict authoring compiler, authenticated orchestration routes and
  the browser experience only. It adds no persistence primitive, pricing engine or truth source.

## Scope

- `src/contexts/rates/authoring.ts`
- `src/contexts/rates/index.ts`
- `src/http/operator.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `src/app.ts`
- `src/server.ts`
- `docs/CONTRACTS.md`
- `tests/rate-authoring.test.ts`
- `tests/operator-rate-builder.integration.test.ts`
- `tests/founder-status.test.ts`
- `src/project-status.ts`
- `design-qa.md`
- `handoff/orders/071-guided-expert-rate-workbench.md`
- `handoff/questions/120-order-071-rate-workbench-command-boundary.md`
- `handoff/questions/120-ARCHITECT-RESPONSE.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`

## Required work

1. Add a pure strict authoring compiler that:
   - accepts all ten registered catalogue models and all three authoring-mode labels;
   - accepts HTTP money only as canonical signed decimal strings and converts to `bigint` before
     the existing domain normalizers;
   - canonicalizes model selection, target rules, evaluator, composition and optional RMS binding;
   - rejects unknown keys, unsafe numbers, unsupported model combinations and browser-supplied
     hashes/results/actor/tenant/property authority;
   - produces byte-equivalent canonical output for semantically equal Guided and Expert input.
2. Add authenticated operator routes, reusing exact `rates.configuration:read|write` scopes and
   property grants, to:
   - return the server catalogue plus exact model/target/release version history for one plan;
   - atomically and idempotently create model + target + release draft versions;
   - simulate 1–500 server-evaluated preview cells;
   - request four-eyes approval;
   - publish only with an exact independently approved request id;
   - create an immutable undo draft from an active/retired release.
3. Construct every audit envelope on the server from authenticated actor, tenant, granted
   property, correlation id and fixed operation. Never accept those fields in a body.
4. Wire the already-seeded extension registry, approval service and publication services into
   the workbench runtime. Do not register types or alter schemas at request time.
5. Build the five-step responsive desktop/web workbench using the existing theme tokens:
   - Create rate: choose an existing plan identity and Guided or Expert authoring.
   - Pricing: show all ten server-catalogued model cards; progressive forms cover fixed/calendar,
     BAR/derived references, room matrix, occupancy/LOS/booking-window/DOW rules, contract,
     package, RMS/API bounds/fallback and bounded expert composition.
   - Who gets it: company, market group, market, source, channel, segment, agent and campaign.
   - Where/when: property/class/type/exact sellable, inheritance/exclusions, dates, DOW, LOS,
     booking window, occupancy, guest mix, policies, promotion/package/meal and distribution.
   - Review/publish: canonical summary, bulk cell preview, conflicts/tax/restriction evidence,
     approval request, separately approved publication id, release history and versioned undo.
6. The UI must state deterministic specificity (`sellable > type > class > property`), block
   unresolved equal-rank conflicts, expose loading/empty/error/success/focus states, work by
   keyboard, and remain usable on a narrow viewport.
7. Keep the existing append-only price/correction and policy tools available as an “existing
   configuration tools” disclosure; do not silently delete working operator capability.
8. Update the internal contract and project dashboard only after proofs pass. Refresh Graphify as
   a derived code map and record any parser/semantic limitations; never hand-edit graph output.

## Forbidden

- Editing any migration, schema snapshot or `tests/run_invariants.py`
- A new table, extension type, event, approval state, permission code or audit primitive
- Modifying occupancy, restriction, tax calculation, fiscal, journal or RLS behavior
- Browser-computed prices/conflicts/hashes/tenant/property/actor/approval authority
- JavaScript-number money, float arithmetic, arbitrary JavaScript/SQL/formula execution
- Auto-approval, self-approval, direct activation, mutable published history or silent undo
- External AI/RMS calls, provider credentials or an AI-only mutation path (Order 072)
- A second evaluator, quote, availability, tax, policy, approval or publication path
- Rebuilding/reseeding the persistent founder stack before the implementation and focused proofs
  are green; if the app is replaced afterward, restore all three services and say so first
- Approval, Gate-3 review or merge by Codex

## Pre-registered proof

### P0 — intentional red

Before implementation, add the focused test importing the missing canonical authoring compiler
and asserting server catalogue coverage plus Guided/Expert command equality. Preserve the exact
missing-export failure in git before production code exists.

### P1 — canonical compiler

Prove all ten catalogue model keys compile through their valid minimum command; strict decimal
money becomes exact `bigint`; differently ordered semantically equal Guided/Expert inputs produce
the same canonical serialization; unknown fields, number money, unsafe amounts, arbitrary code,
unsupported combinations and authority fields fail.

### P2 — authenticated orchestration

On live PostgreSQL, prove one idempotent command creates exactly one model, target and release
version atomically; replay returns the same trio; injected failure leaves none; other tenant,
ungranted property, missing read/write scope and malformed property fail without existence leaks.

### P3 — preview and conflict authority

Prove a 1–500-cell preview is re-evaluated by Order 069, carries exact content/preview hashes,
prices/calendar/matrix evidence, tax/policy/restriction fields and sorted conflict evidence. A
browser-supplied result/hash is rejected and an equal-specificity conflict cannot request approval.

### P4 — four-eyes publication and immutable undo

Prove the authenticated requester can request approval but cannot self-approve or publish without
the exact separately approved id; stale/different preview fails; a valid approver publishes one
active version; undo creates a new draft and never mutates historical releases.

### P5 — browser contract

From a rendered authenticated workbench, exercise model selection, Guided↔Expert parity, every
five-step navigation control, physical/commercial targeting, advanced toggles, bulk preview,
approval explanation, history/undo visibility, both existing themes and a narrow viewport. Check
the browser console. Save source/implementation comparison evidence in `design-qa.md`; no P0–P2
design or accessibility finding may remain.

### P6 — standing gate

From the top: frozen install; state; typecheck; import boundaries; complete default tests;
license check; audit; exact schema drift; protected hashes; fresh isolated app-never-started
`./setup.sh --db-only` with 11/11. Refresh Graphify code-only/cluster report, record limitations,
then update the manifest/ledger/status counters, commit and push a draft PR. Do not merge.

## Definition of done

- [ ] P0 is preserved before production implementation.
- [ ] P1–P6 pass without weakening existing tests or the referee.
- [ ] The browser exposes every founder-named model and applicability/commercial dimension.
- [ ] Guided/Expert parity is executable evidence, not copy.
- [ ] Preview/publication/undo use only existing server authority and immutable history.
- [ ] Mandatory compliance/invariant controls are visible and cannot be disabled.
- [ ] The persistent `yellow-phase-1` app is restored healthy and the founder can inspect it at
  `http://localhost:3200/p/4518a22f-b455-54c6-a50a-4584383749b9/rates`.
- [ ] Order 071 is recorded `UNVERIFIED` for later Gate-3 execution.

