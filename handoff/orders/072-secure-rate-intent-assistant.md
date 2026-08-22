# Order 072 — Secure AI-assisted rate intent

**Phase:** 3 · Rates and policies  
**Branch:** `phase-3/secure-rate-intent-assistant`  
**Tier:** 3 — untrusted natural-language/provider boundary adjacent to commercial publication  
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221

## Outcome

Make the third authoring mode real without giving an AI system a privileged write path. A hotel
operator can describe a rate intent in ordinary language, receive a bounded explanation, explicit
assumptions or questions, and a strict proposed Order-071 command. The operator must deliberately
apply the proposal, save it through the existing draft route, run the existing server preview and
complete the existing four-eyes publication flow.

The zero-cost local runtime uses a deterministic assistant for common exact instructions. A narrow
adapter port permits a future founder-configured model, but every adapter is untrusted: it receives
no token, actor, tenant, approval or publication authority and its output must pass the same strict
authoring compiler before the browser can review it.

## Natural-Solution Test

- Order 071 already defines the complete typed command and the only authenticated mutation route.
- Orders 065–070 already own catalogue, targeting, exact pricing, composition, simulation,
  approval, publication and live quote authority.
- Natural-language interpretation is transient proposal behavior, so it needs no table,
  extension, fact, event, idempotency record or new permission.
- Therefore this order adds one pure intent service/adapter seam, one read-only authenticated
  proposal endpoint and one review-first browser panel. It does not add another rate engine.

## Scope

- `src/contexts/rates/intent.ts`
- `src/contexts/rates/index.ts`
- `src/http/operator.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `src/app.ts`
- `src/server.ts`
- `docs/CONTRACTS.md`
- `tests/rate-intent.test.ts`
- `tests/operator-rate-intent.integration.test.ts`
- `tests/rate-authoring.test.ts`
- `tests/founder-status.integration.test.ts`
- `src/project-status.ts`
- `design-qa.md`
- `handoff/orders/072-secure-rate-intent-assistant.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- `handoff/questions/`

## Required work

1. Add a pure `RateIntentService` and untrusted `RateIntentProposalAdapter` port. The service:
   - accepts only a bounded normalized intent string plus one already-valid current command;
   - scans non-negotiable guardrail and prompt-injection requests before calling an adapter;
   - exposes only a minimized proposal context with no rate-plan id, authoring-mode authority,
     tenant, actor, token, audit, idempotency, approval, publish or calculated-result fields;
   - validates exact adapter response keys and bounded plain-text explanation arrays;
   - restores server-owned `ratePlanId` and `authoringMode: ai`, then runs
     `compileRateAuthoringCommand()` over the complete candidate;
   - returns `ready`, `needs_clarification` or `rejected` with no mutation and no prompt storage.
2. Add a zero-network deterministic adapter that can safely interpret common exact hotel intent:
   canonical minor-unit base/floor/ceiling amounts, fixed pricing, commercial codes/channel,
   guest bounds, non-refundable treatment and allow/deny distribution. Ambiguous major-unit money,
   unsupported complex model construction and restriction-owned CTA/CTD/min/max stay or advance
   requests must produce a specific question or routing explanation rather than a guess.
3. Add an authenticated read-only endpoint under the existing rate-builder route. It must reuse
   `rates.configuration:read`, exact property grants and the tenant transaction; prove the active
   rate plan through the existing model service before interpretation. Unknown body fields,
   route/body mismatch, missing scope, foreign property and invalid/oversized/control-character
   intent fail closed. It writes no database row, fact, event or idempotency claim.
4. Turn AI-assisted into a real third workbench mode:
   - plain-language textarea, safe examples and an explicit “Interpret securely” action;
   - separate Changes, Assumptions, Questions, Warnings and Guardrails regions using text only;
   - an Apply action only when the server returns a valid proposal;
   - after apply, the canonical review shows `authoringMode: ai`, while Save/Preview/Approval/
     Publish remain the unchanged Order-071 actions;
   - explain that the included assistant is local/deterministic and that a future configured model
     remains an untrusted proposal source, never rate or compliance authority;
   - loading, empty, clarification, rejection, ready, focus and narrow-viewport states work in both
     Apple and Pixel themes.
5. Document the adapter/data-minimization contract and the exact distinction between proposal,
   apply, draft, preview, approval and publish. Never describe builder-green output as AI-reviewed.
6. Update dashboard counters only after all proofs pass. Refresh Graphify as a derived code map,
   record parser/semantic limits, commit, push and open a draft PR stacked on Order 071.

## Forbidden

- Editing migrations, schema snapshots, `tests/run_invariants.py`, occupancy, restrictions,
  journals, tax/fiscal/statutory logic, RLS or tenant-context rules
- A table, extension type, event, fact, approval state, permission or idempotency operation
- An AI/provider-specific mutation, save, preview, approval, publish, undo or live-quote path
- Sending credentials, bearer tokens, tenant/actor ids, audit envelopes, approval ids, hashes,
  calculated prices/conflicts, guest PII or raw database rows to an adapter
- Persisting or logging prompts/proposals; browser storage; prompt-derived HTML
- JavaScript/SQL/formula execution, tool execution, URL fetching or client-computed price/conflict
- Guessing currency scale or silently converting ambiguous major-unit money
- Auto-apply, auto-save, auto-preview, auto-approval, self-approval or auto-publish
- Claiming the deterministic local assistant is an LLM or that future provider output is trusted
- External provider calls, provider credentials or dependency additions in this order
- Approval, Gate-3 review or merge by Codex

## Pre-registered proof

### P0 — intentional red

Before implementation, add a pure focused test importing the absent `RateIntentService` and prove
one exact fixed-rate interpretation plus one guardrail rejection. Commit the missing-export failure
before production code exists.

### P1 — pure intent firewall

Prove normalization/bounds, prompt-injection and mandatory-guardrail rejection before adapter
invocation; exact safe adapter input minimization; strict adapter-output keys/text bounds; candidate
revalidation; locked plan/mode authority; adapter throw/invalid candidate failure; no mutation.

### P2 — local assistant behavior

Prove exact minor-unit price/floor/ceiling, segment/channel/guest/refund/distribution edits. Prove
ambiguous money asks a question, restriction-owned intent routes to Restrictions, unsupported model
construction asks rather than invents, and prohibited compliance/approval intent is rejected.

### P3 — authenticated HTTP boundary

On live PostgreSQL prove an authorized request returns the canonical AI proposal while extension,
fact, outbox and idempotency counts remain byte-identical. Missing scope, foreign property,
route/body mismatch, unknown fields and hostile prompt fail without existence or error leaks.

### P4 — rendered browser review

Exercise all three modes; interpret, clarification, rejection, ready, apply and canonical review;
then save through the existing immutable draft action. Verify no auto-save/preview/publish, both
themes, keyboard focus, 390px layout and an empty console. Update `design-qa.md` with a rendered
comparison and leave no P0–P2 design/accessibility defect.

### P5 — standing gate

From the top: frozen install; state; typecheck; import boundaries; complete default tests; license;
audit; schema drift; protected hashes; fresh isolated app-never-started `./setup.sh --db-only`
11/11. Refresh Graphify code-only and cluster report, record limits, update status/manifest/ledger,
commit, push and open a draft PR. Do not merge.

## Definition of done

- [ ] P0 is preserved before production code.
- [ ] P1–P5 pass without weakening Order 071, the referee or protected files.
- [ ] AI-assisted produces only a strict reviewable proposal and cannot mutate by itself.
- [ ] Local founder review works without a provider key or paid service.
- [ ] Ambiguous/impossible/forbidden requests explain the boundary instead of guessing.
- [ ] The persistent localhost stack is restored healthy and left on the rate builder.
- [ ] Order 072 is recorded UNVERIFIED for later independent Gate-3 execution.
