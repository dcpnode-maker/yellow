# Order 069 — Atomic rate draft simulation, approval, publication and versioned undo

**Phase:** 3 · Universal rate plans
**Branch:** `phase-3/rate-draft-publish-versioning`
**Tier:** 3 — activates exact money/configuration through approval and outbox evidence
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221/D-230/D-250

## Outcome

Make one complete rate configuration the atomic unit of review and activation. A hotel can create an
immutable release draft from exact model, targeting, evaluator and composition choices; simulate a
bounded cell set; review every blocked/unpriced/conflict/quoted result; request four-eyes approval;
publish only the latest unchanged conflict-free draft; and undo only by copying a prior published
configuration into a new version that follows the same approval path. No partial bulk activation is
possible.

## Natural-Solution Test

The baseline `extension` lifecycle already provides tenant RLS, immutable versioned content and
`draft | active | retired` status; `fact_log`, `approval_request` and the catalogued
`extension.activated` event already provide audit, four-eyes and atomic notification. Add one
`rate_plan_release` extension type, not a table or migration. Its content is the complete release
snapshot: exact references to immutable Order 065/066 drafts plus the canonical Order 067/068 ASTs.
Every bigint is persisted as an explicit tagged decimal minor-unit object and is normalized again on
read. Extension content never changes; lifecycle status changes are reconstructed through facts.

## Scope

- `src/contexts/rates/publication.ts`
- `src/contexts/rates/index.ts`
- `scripts/seed.ts` only to register the `rate_plan_release` extension schema
- `docs/EXTENSIONS.md`
- `docs/CONTRACTS.md`
- `tests/rate-publication.integration.test.ts`
- `tests/extension.integration.test.ts` only for the exact launch-type count/description
- `tests/rate-targeting.integration.test.ts` only for the exact launch-type count
- `src/project-status.ts` only for exact completed-order and Gate-3 debt counters
- `tests/founder-status.integration.test.ts` only for the exact current-order assertion
- `handoff/orders/069-rate-draft-publish-versioning.md`
- `handoff/questions/115-order-069-release-persistence.md`
- `handoff/questions/115-ARCHITECT-RESPONSE.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- further numbered D-92 question/response files only if a hard-floor condition occurs

## Required implementation

1. Register one launch extension type `rate_plan_release`. Its strict top-level content contains
   property/rate-plan ids; exact Order 065 model-draft id/version; exact Order 066 target-draft
   id/version; canonical Order 067 evaluator and Order 068 composition specs; and nullable
   `undo_of_version`; and required nullable `rms_binding`. The reserved object shape is only adapter
   key/version, maximum recommendation age and explicit local-evaluator outage fallback. Order 069
   always persists `null` and does not enable RMS behavior (Question 118 / D-253). No global release
   instance is seeded.
2. Persist bigint fields only as exact `{"$minor":"<canonical signed decimal>"}` tagged values,
   excluding `-0` and bounded to signed-bigint range. Readback must decode, run the existing strict
   normalizers, re-encode and byte-compare the canonical JSON shape. Those normalizers retain domain
   authority: only Order 067's explicit signed adjustment delta may be negative; prices, package
   amounts and discounts remain non-negative. Unsafe numbers, unknown fields,
   overflow/noncanonical strings and storage tampering fail closed (Question 116 / D-251).
3. Draft creation derives `rate-plan:<id>`, transaction-locks gapless extension versions through the
   existing registry, requires an active tenant/property plan, and binds existing draft model/target
   versions for that exact plan. Direct models must match the selected model; package is a typed
   wrapper with a real package composition; RMS/API is deferred to Order 070. One draft fact and no
   activation event are written.
4. Simulate 1–500 uniquely keyed preview cells. The server resolves the stored Order 066 target
   version from each cell's physical/commercial context, derives Order 067 property-local context,
   evaluates the stored price spec, then composes Order 068 guest/package/policy/distribution and
   availability evidence. Return cells sorted by key with exact counts, total work, content hash and
   preview hash. Do not accept caller-computed price or target results.
5. An approval request is allowed only for a conflict-free simulation. Its exact kind/subject bind
   the release extension id; payload binds rate-plan id, extension version, content hash, preview
   hash and preview-cell count. Use the existing `ApprovalService`; no alternate approval state.
6. Publish re-locks the plan release key, reloads and re-simulates the same preview input, requires an
   approved exact matching request, requires the draft to be the latest release version, and rejects
   every conflict or stale hash/version. Retire at most one prior active release and activate exactly
   the approved draft in one transaction. Record explicit retired/published facts and publish the
   existing `extension.activated` event atomically.
7. Content is immutable. Undo accepts a previously active or retired release version, copies its
   canonical model/target/evaluator/composition snapshot into a new draft, sets only
   `undo_of_version`, then requires a new simulation, approval and publication. It never reactivates
   or edits history.
8. Expose exact list/current queries for one active property plan. Tenant/property/plan boundaries,
   cross-tenant draft or approval ids, inactive plans, missing reference versions, duplicate preview
   keys, malformed evidence, publisher failure and concurrent publication fail without partial
   status, fact, event or approval artifacts.

## Forbidden

- Any file under `migrations/`, especially `migrations/0001_init.sql`; schema snapshots or
  `tests/run_invariants.py`
- A new table, constraint, event type, approval state, HTTP route, UI, idempotency claim, dependency,
  worker, cache or external adapter
- Mutating extension content, model/target draft content, evaluator/composition history, rate prices,
  policies, packages, promotions, restrictions, occupancy, availability or the protected referee
- JavaScript-number/float money, untagged numeric minor units, generic executable formulas, hidden
  promotion stacking, tax/fiscal/journal/refund/cancellation execution or RMS/API behavior
- Publishing a non-latest, changed, conflicted, unapproved or differently previewed draft; self
  approval; direct reactivation for undo; partial bulk publication
- Treating builder assertions as independent review; approval or merge by Codex

## Pre-registered proof

- **P0 (red first):** focused database test fails before production edits because publication exports
  do not exist. Preserve exact red output.
- **P1:** launch registration is exact/replayable; a full draft stores tagged exact money, binds the
  exact model/target versions, writes one fact/no event and leaves all prior bytes unchanged.
- **P2:** 1–500 preview cells resolve stored targeting then evaluate/compose deterministically;
  input order cannot change hashes/results; equal target, evaluator or promotion winners are exposed
  as sorted conflicts and approval is refused.
- **P3:** approval payload binds exact subject/version/content/preview hashes; inherited four-eyes
  applies; a newer draft makes an older approval stale and persists no publish artifact.
- **P4:** a valid publish retires one prior active and activates one exact latest draft with facts and
  one `extension.activated` event; twenty concurrent attempts have one winner and one activation.
- **P5:** a later event failure rolls every status/fact change back; a multi-cell bulk release is
  either fully active as one version or absent, never partly published.
- **P6:** undo copies a historical published content snapshot into a strictly newer draft, changes
  only `undo_of_version`, requires a new approval, and reproduces historical simulation while all
  earlier content bytes remain exact.
- **P7:** tenant/property/plan/reference/approval/storage/evidence/shape boundaries fail closed; RMS,
  floats, untagged money, caller-computed target/price and history mutation have no path.
- **P8:** 250 versus 500 preview cells expose work below 2.2× growth and remain under a generous
  catastrophic ceiling without asserting planner shape.
- **P9:** frozen install, typecheck, boundaries, all default tests, licence, audit, schema drift,
  protected hashes and fresh app-never-started referee remain green.

## Standing and handoff

Commit this order before the database test. Preserve P0 before production edits. Use a disposable
focused database and restart the entire focused suite after every correction. Commit implementation
before adding the manifest row, then advance only exact founder-status counters. Run the complete
standing gate and fresh isolated `./setup.sh --db-only` with app never created. Do not rebuild or
reseed the founder stack. Refresh Graphify structurally, push a draft PR stacked on Order 068 and do
not approve or merge.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
