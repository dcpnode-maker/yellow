# Order 090 — Portable AI intent provider contract

**Phase:** 4 · Cross-cutting AI foundation while reservation hard-floor work is blocked  
**Branch:** `phase-4/portable-ai-provider-contract`  
**Tier:** 3 — untrusted external-model and secret-bearing network boundary adjacent to commercial proposals  
**Written by:** OpenAI Codex, founder-authorized temporary architect/builder under D-95/D-115/D-221

## Outcome

Make the existing Order-072 proposal-only rate assistant deployably provider-independent without
creating a second AI system or a second rate mutation path. Yellow keeps the zero-network local
deterministic assistant as its default. A deployment administrator may instead select one bounded
OpenAI-compatible HTTPS endpoint, covering compatible cloud deployments (including Azure-hosted
models) or an on-premises inference gateway without a provider SDK or code fork.

The configured model remains an untrusted text-to-JSON proposal source. It receives only the
already-minimized Order-072 input and cannot see tenant, actor, token, approval, guest, database or
publication authority. Its output still passes the existing exact response parser and complete
typed authoring compiler before an operator may deliberately Apply, Save, Preview, request
independent Approval and Publish.

This order also records the founder's broader adaptive RMS destination as future scope. It does not
implement RMS forecasting, net/contribution ARR, channel-campaign economics, bid-price controls,
causal measurement, group displacement, model training, retrieval or agent autonomy.

## Natural-Solution Test

- Order 072 already owns the rate-intent firewall, minimized adapter input, strict output validation
  and review-first UI. Reuse that port; do not add a provider-specific route or mutation.
- Provider selection belongs in the deployment composition root, not a browser field or hotel rate
  command. The current default must start and work with no AI environment variables or network.
- A single OpenAI-compatible chat JSON transport is the smallest reversible seam for cloud and
  on-prem inference. The complete endpoint is deployment-configured, so Yellow does not guess a
  vendor URL or embed a vendor SDK.
- Fine-tuned deployments can later be selected by model/deployment id through the same transport.
  Training data, consent, retention, evaluation and cross-property learning require later orders.

## Scope

- `handoff/orders/090-portable-ai-intent-provider.md`
- `src/contexts/rates/intent-provider.ts`
- `src/contexts/rates/index.ts`
- `src/server.ts`
- `src/http/operator/index.html`
- `tests/rate-intent-provider.test.ts`
- `tests/rate-authoring.test.ts`
- `docs/AI-ARCHITECTURE.md`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- `handoff/GATE-3-MANIFEST.md` only after every proof is green
- `handoff/LEDGER.md`
- `DECISIONS.log` only after every proof is green

## Required work

1. Commit this order and a focused intentional-red proof that imports the absent provider factory
   before adding production code.
2. Add a pure environment-to-adapter factory. Omitted/`local` selection returns the existing
   deterministic adapter without reading a key or making a request. `openai-compatible` requires:
   - one absolute endpoint with no embedded credentials or fragment;
   - HTTPS, except exact loopback HTTP for local development;
   - one bounded model/deployment id and one safe deployment label;
   - an explicit `bearer`, `api-key` or `none` authentication mode;
   - a bounded timeout; and a secret only when the selected auth mode requires one.
   Invalid selected configuration fails application startup rather than silently falling back.
3. Add the external adapter with no dependency:
   - use injected/global `fetch`, one non-streaming JSON request and an abort timeout;
   - send only one fixed system instruction plus the serialized minimized adapter input;
   - request no tools, URLs, files, memory, database access or autonomous action;
   - cap the response while streaming bytes, reject non-JSON/non-2xx/oversized/malformed envelopes,
     and never expose a response body, endpoint or secret in a returned error;
   - parse only the assistant content as JSON and return it to `RateIntentService`, whose existing
     exact-key and typed-command validation remains final authority.
4. Select the adapter once in `src/server.ts` from deployment environment. Do not add tenant or
   browser provider selection. Preserve the zero-network local default exactly.
5. Update the rate workbench copy so it truthfully describes the active provider badge as
   deployment-selected while retaining the no-PII warning and all separate human actions.
6. Add `docs/AI-ARCHITECTURE.md` documenting:
   - provider-independent inference, cloud/on-prem routing and graceful deterministic fallback;
   - the difference between inference, retrieval, feedback/evaluation and training;
   - data minimization, consent/residency, no cross-property learning without opt-in, cost budgets,
     model/version evidence and later agent governance;
   - the deferred adaptive RMS boundary, precise gross/net/contribution/displacement terminology,
     channel/campaign economics and online-versus-offline governance supplied by the founder;
   - why those RMS capabilities conflict with the current Phase-4 plan and remain planned rather
     than being silently approximated here.
7. Run the focused proof, default tests, typecheck and import boundaries. Then run the isolated
   Phase-3 gate, schema drift, protected hashes and a fresh app-never-started
   `./setup.sh --db-only` at 11/11. Record Order 090 as UNVERIFIED Gate-3 debt, refresh the
   disposable Graphify map, rebuild only the founder app and push a stacked draft PR. Do not merge.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, Compose, Dockerfile,
  CI, package/lock files, RLS, tenant context, authentication/token behavior, grants, occupancy,
  reservations, journals, payments, tax/fiscal/statutory logic, facts, outbox or idempotency
- A dependency, SDK, database table/column, extension schema, event, state, transition, permission,
  route, worker, cache, queue, vector database, memory store or provider credential in source
- Provider selection from an HTTP body, browser, hotel rate command or model response
- Sending tenant/actor ids, bearer tokens, audit or approval data, guest/person data, raw database
  rows, prompt history, hidden system data, payment data or calculated publication authority
- Logging or persisting prompts, proposals, provider bodies, endpoints or credentials
- Provider tool calls, web/file retrieval, executable output, auto-apply, auto-save, auto-preview,
  auto-approval, auto-publication or AI-derived database authority
- Model training, fine-tuning jobs, feedback persistence, RAG, cross-property learning, agent
  autonomy or claims that a configured endpoint is free/private/compliant merely because it exists
- Implementing the founder's future RMS optimizer, campaign registry, bid price, net ARR,
  contribution, causal uplift, distribution publication or group-displacement calculations
- Weakening Order-072 validation, changing the local deterministic result, fabricating independent
  review, approval, merge or exposing the external provider by default

## Pre-registered proof

### P0 — provider factory is intentionally absent

Before production code, import `createRateIntentProposalAdapterFromEnvironment` from the public
rates surface. The focused test must fail because that export/module does not exist.

### P1 — local default and configuration fail closed

Prove omitted/`local` configuration returns `local-deterministic-v1` and invokes no fetch. Reject
unknown providers, missing endpoint/model/auth/required secret, embedded URL credentials/fragments,
non-loopback HTTP, unsafe labels/models and timeout values outside the exact bound.

### P2 — bounded untrusted external transport

Against an injected fake fetch, prove the exact configured URL, authentication header and model;
`stream=false`, no tools and one bounded JSON response request; and an outbound body containing none
of the Order-072 forbidden authority keys. A valid provider candidate becomes a ready typed proposal
only through `RateIntentService`. Non-2xx, wrong content type, invalid envelopes/content, oversized
bytes and timeout all become the existing generic clarification result without secret/body leakage.

### P3 — existing safety and manual operation are unchanged

Run the complete Order-072 pure and authenticated proofs. Local exact intent still produces the
same proposal, guardrails run before the adapter, hostile output fails closed, interpretation writes
nothing and Apply/Save/Preview/Approval/Publish remain separate. The browser uses text-only output
and identifies the provider as deployment-selected, not hotel-controlled or authoritative.

### P4 — honest architecture and founder status

Documentation classifies current local and compatible-endpoint inference as implemented, while
training, retrieval, feedback learning, multi-agent operation and adaptive RMS remain explicitly
planned/research-required. The founder snapshot derives Order 090 and 44 UNVERIFIED rows only after
the manifest row exists; review remains through Order 044.

### P5 — standing evidence

Frozen install, typecheck, boundaries, default suite, licence, dependency audit, exact schema,
isolated Phase-3 gate, protected hashes and fresh referee all remain green. Graphify remains a
derived/disposable map and no generated map becomes product authority.

## Builder evidence

- Intentional red is commit `5155003`: the focused file returned 0 pass / 1 fail / 1 error because
  the provider factory and configuration error export did not exist.
- The implementation is commit `718503d`: provider-focused proof 7/7 with 59 assertions; complete
  native-Linux standing suite 113/0 with 1,454 assertions; typecheck, boundaries, licence policy
  and dependency audit green without an external credential or provider request.
- Fresh isolated database evidence: Phase-3 gate 13/13 suites, database acceptance 4/4, exact schema
  match and app-never-started referee result `11 passed, 0 failed of 11`.
- The inherited cold publication ceiling first returned 22.6s and 20.3s. The unchanged Order-089
  base and Order-090 tip then passed the same proof at 9.38s and 8.67s, followed by a full unchanged
  top-of-gate restart passing at 7.81s. No ceiling or structural assertion changed.
- Protected SHA-256 values remain `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
  and `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
- Disposable code-only Graphify map: 2,229 nodes, 6,403 directed edges and 113 communities, with
  zero missing/dangling endpoints, self-loops, duplicate edges or directed collapses. The map
  explicitly skipped 409 semantic files and warns that eight SQL files need `tree_sitter_sql`;
  it is local reading assistance, not committed evidence or architecture authority.

## Definition of done

- [x] P0 is committed red before production code.
- [x] P1–P3 are green without external credentials or internet access.
- [x] P4 states current versus planned scope without claiming training or RMS completion.
- [x] P5 and both protected hashes remain exact.
- [x] Order 090 is recorded as UNVERIFIED review debt; no approval or merge is claimed.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
