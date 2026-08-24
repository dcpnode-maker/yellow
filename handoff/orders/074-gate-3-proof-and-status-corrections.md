# Order 074 — Gate-3 browser-proof and founder-status corrections

**Phase:** 3 · Gate-3 correction
**Branch:** `phase-3/gate-3-corrections`
**Tier:** 2 — proof fidelity and derived founder reporting; no product-domain behavior
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221
**Findings:** F11 and F12 in `handoff/reviews/045-073-gate-3.md` at `d0a2f2a`

## Outcome

Close both findings from Claude's independently executed Gate-3 review without changing hotel
behavior. Browser-asset proofs must reject SQL syntax without mistaking ordinary English for SQL,
and the same shared proof must run in the default CI suite whenever `operator.js` changes. The
founder dashboard must derive its independently-reviewed boundary from approved architect review
documents instead of pinning Order 018 in application source.

Orders 045–073 remain changes-required and unverified after this builder correction until the
independent reviewer executes the corrected proofs. This order is also unverified and cannot turn
Claude's review into approval.

## Natural-Solution Test

- F11 reproduced one exact legacy-regex match: `select a` in user-facing copy; no browser SQL was
  present. Rewording the copy would only hide the over-broad instrument.
- Five database-gated suites duplicate that instrument and ordinary CI skips their bodies without
  suite-specific databases. One pure shared guard plus one always-on asset suite removes both
  failure modes while the five original suites retain the same security assertion.
- F12 exists because `src/project-status.ts` and its test both carry literal `18`. The approved
  review documents already carry the authoritative review ranges and verdicts. A deterministic
  generated TypeScript artifact, checked against those documents by the default suite, lets the
  runtime image consume the derived value without shipping `handoff/`.
- The derived boundary is 44. The Gate-3 review of 045–073 has verdict CHANGES REQUIRED and must
  not advance it.

## Scope

- `scripts/derive-review-coverage.ts`
- `src/generated/review-coverage.ts`
- `src/project-status.ts`
- `tests/helpers/browser-asset-security.ts`
- `tests/operator-assets-security.test.ts`
- `tests/operator-inventory.integration.test.ts`
- `tests/operator-rate-configuration.integration.test.ts`
- `tests/operator-rate-pricing.integration.test.ts`
- `tests/operator-rate-price-correction.integration.test.ts`
- `tests/operator-bulk-rooms.integration.test.ts`
- `tests/founder-status.integration.test.ts`
- `handoff/ARCHITECT-HANDOVER.md`
- `handoff/orders/074-gate-3-proof-and-status-corrections.md`
- `handoff/GATE-3-MANIFEST.md`
- `handoff/LEDGER.md`
- `DECISIONS.log`
- `handoff/questions/`

The architect-owned review file enters this branch unchanged through its own commit `d0a2f2a`.

## Required work

1. Add one shared, case-insensitive browser-asset SQL syntax guard. It must require each SQL verb
   to be paired with a clause keyword inside a short bounded window: SELECT/FROM, INSERT/INTO,
   UPDATE/SET-or-WHERE, or DELETE/FROM-or-WHERE. It must reject representative one-line SQL for
   all four verbs while not matching the exact `Save or select a draft before previewing.` copy.
2. Replace only the five duplicated legacy guards named by F11 with the shared guard. Add a
   database-independent default test over the real `operator.js` so shared-asset drift cannot hide
   behind missing operator-suite environment variables. Keep every browser-storage, PostgreSQL URL,
   exact-money and scope assertion unchanged.
3. Add a deterministic review-coverage generator that:
   - reads tracked Markdown under `handoff/reviews/`;
   - accepts only documents naming an architect-role reviewer and an explicit verdict beginning
     `APPROVED`;
   - extracts the numeric end of the document's `# REVIEW` range;
   - emits the maximum approved boundary plus the exact contributing file list into a generated
     TypeScript module;
   - supports a check mode that fails on any byte drift without writing.
4. Import the generated boundary into `PROJECT_BUILD_SNAPSHOT`; remove the literal 18. Derive the
   reviewed states for Phase 0 through Order 018, Phase 1 through Order 026 and the reviewed Phase-2
   gate through Order 044 from that boundary. Phase 3 remains active. Gate-3 debt remains the count
   of UNVERIFIED manifest rows and advances for this correction only after proofs pass.
5. Change the founder-status proof to recompute coverage from the review documents and compare the
   generated/runtime result, contributing files and phase states. Do not replace one literal with
   another literal-only assertion. Prove the CHANGES REQUIRED 045–073 review does not advance the
   boundary.
6. Update the architect handover's stale summary to distinguish independently reviewed Orders
   001–044 from changes-required/unverified Orders 045 onward. Record D-263 and the Order-074 ledger
   events, refresh Graphify as a derived map, rebuild the persistent app and leave it healthy.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, Compose, Dockerfile,
  dependencies, application routes, operator HTML/CSS/JS, pricing/rate product logic, occupancy,
  availability, restrictions, journal/fiscal/statutory behavior, RLS, tenant context, audit/outbox,
  permissions, state transitions, tables or events
- Rewording `Save or select a draft before previewing.` to evade the legacy regex
- Removing the no-browser-SQL property, using an unbounded dot-star guard, accepting bare SQL verbs
  as proof, or leaving the new shared guard database-gated
- Counting CHANGES REQUIRED, unreviewed, builder-authored or non-architect documents as approval
- Shipping `handoff/` in the runtime image, reading Git/GitHub at runtime, or exposing review text
  through the status API
- Marking Orders 045–074 approved/merged, changing Claude's review artifact, self-approval or merge

## Pre-registered proof

### P0 — inherited and newly pinned red

- Preserve Claude's F11 red evidence: each of the five legacy guards matches the exact English copy.
- Before production status changes, change the founder proof to require document-derived Order 044
  plus reviewed Phase 1/2 cards; it must fail against the literal-18 snapshot.
- Commit the failing proof state before implementing either correction.

### P1 — syntax-aware security proof

The default, database-independent suite proves the exact English sentence matches the legacy guard
but not the new guard; representative SELECT/FROM, INSERT/INTO, UPDATE/SET, UPDATE/WHERE,
DELETE/FROM and DELETE/WHERE strings all match the new guard; the real `operator.js` does not.

### P2 — inherited proof restart

Run all five named operator suites against dedicated freshly migrated databases with their required
paired password variables. All must pass with the shared guard and all unrelated assertions intact.

### P3 — derived review boundary

Run the generator in check mode and the founder-status suite. The proof independently reads every
review document, derives exact coverage through 44 from approved architect documents, confirms
045–073 CHANGES REQUIRED is excluded, and shows Phase 0/1/2 reviewed with Phase 3 active.

### P4 — deployed founder evidence

Rebuild only the persistent application service, authenticate at localhost, and inspect the status
view. It must say Orders 1–44 independently reviewed, show Phase 1 and Phase 2 REVIEWED, retain an
honest UNVERIFIED correction-debt count, and leave the console empty. Do not approve or publish.

### P5 — standing gate

From the top: frozen install; state; typecheck; import boundaries; complete default tests; licence;
audit; schema drift; protected hashes; fresh isolated app-never-started `./setup.sh --db-only`
11/11. Refresh Graphify code-only and cluster report, record parser/semantic limits, commit, push and
open a draft PR stacked on Order 073. Do not merge.

## Definition of done

- [x] P0 red evidence is preserved before correction implementation.
- [x] P1–P3 pass without changing product/runtime behavior.
- [x] P4 shows the correct derived review boundary in the running founder dashboard.
- [x] P5 is fully green; persistent localhost remains healthy.
- [x] F11 and F12 are corrected and recorded for independent re-execution.
- [x] Orders 045–074 remain unmerged; corrections are not represented as self-approved.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
