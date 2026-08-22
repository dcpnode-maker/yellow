# Order 078 — Reproducible local-review published rate and live quote

**Phase:** 3 · Rates and policies  
**Branch:** `phase-3/local-review-published-rate`  
**Tier:** 3 — local seeding crosses immutable rate publication, four-eyes approval and audit/outbox authority  
**Written by:** OpenAI Codex, autonomous temporary architect under D-92/D-115/D-221/D-270

## Outcome

Make a fresh founder-review installation useful without a manual rate-authoring ceremony. The
explicit local-review seed must create or exactly verify four canonical policies, one active FLEX
rate plan and one immutable USD 125.00 nightly release. That release must travel through the existing
requester-to-approver decision and publication services, and a real tenant-scoped quote over seeded
inventory must work immediately. Identical reruns write nothing; divergent hotel data fails closed.

This is reproducible review data, not a product default. Hotels retain the complete configurable
Guided, Expert and AI-assisted rate paths from Orders 063–077.

## Natural-Solution Test

Orders 032, 065, 066, 069, 070 and 077 already provide the only policy, plan, model, target,
publication, quote and four-eyes authorities. Order 046 already owns the explicit local-review seed.
The missing capability is composition: a fresh seed stops after users and inventory, so Availability
has rooms but the rate builder has no active release to quote. Extend that one local-only seeder and
call the existing services inside one tenant transaction. Do not add an endpoint, seed-only product
service, state, event, schema object, tax assumption or alternative rate engine.

## Scope

- `scripts/seed-review.ts`
- `tests/review-seed.integration.test.ts`
- `docs/LOCAL-REVIEW.md`
- `src/project-status.ts` only for exact completed-order and Gate-3 debt counters
- `tests/founder-status.integration.test.ts` only for exact current-order assertions
- `handoff/orders/078-local-review-published-rate.md`
- `handoff/GATE-3-MANIFEST.md`
- `handoff/LEDGER.md`
- `DECISIONS.log`
- further numbered D-92 question/response files only if a hard-floor condition occurs

## Required work

1. In the explicit review seeder, create or exactly verify these tenant policies by kind, name and
   canonical content. Zero matches creates through `RateConfigurationService`; more than one match
   or one non-canonical match fails without repair:
   - cancellation · `Flexible 48 hour cancellation` · one rule at 48 hours, one-night penalty;
   - deposit · `First night deposit` · first night due at booking;
   - guarantee · `Card guarantee` · card on file;
   - no-show · `First night no-show` · first-night charge.
2. Create or exactly verify one active property rate plan: code `FLEX`, name
   `Flexible public rate`, currency `USD`, tax-inclusive true, linked to the exact cancellation,
   deposit and guarantee policies, market `LEISURE`, source `DIRECT`, no parent or derivation. Other
   hotel policies, plans and drafts remain untouched.
3. Under the existing `yellow.local.review.seed` advisory lock and one
   `Database.withTenantTransaction`, inspect FLEX release history. If there is already one active
   release, verify its complete canonical model, targeting, evaluator, composition, policy and
   approved four-eyes evidence, then return with no write. More than one active release or any
   non-canonical active release hard-fails; the seeder must never retire or overwrite hotel-created
   active configuration.
4. If FLEX has no active release, compile one canonical authoring command with the existing strict
   compiler and create it only through `RateModelService`, `RateTargetService` and
   `RatePublicationService`:
   - Guided `simple-fixed` model version 1 with no components;
   - one `property-default` include rule, priority 0, property-wide, no commercial filter;
   - fixed USD `12500` minor units, half-open stay gate `2020-01-01` to `2100-01-01`, all weekdays,
     no rules, floor, ceiling or occupancy input;
   - adults 1–4, children 0–3 and total guests 1–7; no package or promotion;
   - all four exact policy ids with policy-based refund treatment;
   - all direct distribution and no RMS binding.
5. Bind one deterministic 2030 preview cell to a real seeded sellable/unit type and the four exact
   policy references. Request as `operator@yellow.local`, approve through
   `RatePublicationService.decidePublicationApproval` as the distinct
   `approver@yellow.local`, and publish through `RatePublicationService.publishDraft` as that same
   approver. The exact existing `approval.requested`, `approval.decided` and
   `extension.activated` evidence remains authoritative; no direct status update is permitted.
6. Return and log only safe review identifiers and created/existing state. Never log passwords,
   tokens, raw approval payloads or audit data. Preserve the existing idempotent identity and
   inventory behavior and close every pool on success or failure.
7. Prove a live two-night direct quote, 30 days in the future, over one real seeded sellable. It must
   use the active release, quote two USD 12500 nights and a USD 25000 pre-tax subtotal, carry all
   four policies, remain bookable, honestly report `taxAssignmentState: none`, and create no fact or
   event. Tax absence is evidence, not permission to fabricate tax or call the result tax-inclusive
   payable money.
8. Document the seeded review rate and its limitation, then advance the exact founder snapshot and
   Gate-3 manifest only after focused and standing proofs are green. Record Order 078 as
   `UNVERIFIED`; builder execution is not independent review.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, Compose, Dockerfile,
  dependencies, application routes, operator HTML/CSS/JavaScript or production service logic
- Direct INSERT/UPDATE/DELETE of policy, rate-plan, extension or approval rows from the seeder; a
  seed-only mutation path; a new endpoint, table, extension type, permission, state, event or worker
- Editing or retiring an existing active release, mutating immutable history, publishing a
  non-latest draft, self/automatic approval, shared reviewer identities or bypassing `decided_by`
  publication authority
- A relative persisted stay gate, a rate derived from the current date, random money, browser-owned
  evidence, caller-computed quote authority or using the approval preview as proof of live inventory
- Creating a tax assignment, calculating tax, claiming a final payable total, or making tax,
  tenancy, RLS, audit/history, exact money, occupancy, journal/fiscal or statutory safeguards
  hotel-disableable
- Adding this active rate to the production launch seed; it belongs only to the explicit local
  review surface
- Approval, independent Gate-3 review, merge or relabelling builder evidence as reviewed by Codex

## Pre-registered proof

- **P0 — intentional red:** on a freshly migrated database, run the current review seed and require
  exactly four named canonical policies, exact FLEX, one active canonical release, one exact
  requester/approver approval and one live two-night quote. Before implementation the seed creates
  zero policies, zero plans and zero releases. Commit the failing test and exact red output before
  changing production.
- **P1 — canonical and atomic evidence:** fresh run creates the exact four policies, plan, three
  immutable draft records, approval request, decision and activation through existing services.
  Facts/events are attributable to the requester or approver with the existing operation and event
  names; no invented event or direct table mutation exists.
- **P2 — four-eyes release truth:** exactly one active FLEX release joins its exact model/target
  versions and exactly one approved request where requester and decider are the two deterministic
  distinct users. Release bytes equal the compiled canonical command and no other plan/history is
  changed.
- **P3 — rerun and collision:** snapshot relevant domain rows, facts and events; an identical rerun
  reports existing state and is byte-equivalent. A non-canonical active FLEX or divergent canonical
  policy/plan identity fails with no mutation and no attempted repair.
- **P4 — real quote:** `RateQuoteService` resolves a two-night future stay from real
  `AvailabilityService` evidence at 12500 per night / 25000 subtotal, four policies and honest no-tax
  evidence. Row, fact and event snapshots remain unchanged by the quote.
- **P5 — preserved localhost:** apply the idempotent seed to the existing founder database without
  deleting its four historical drafts or approval history. Rebuild only the app if required, sign
  in as the requester, confirm FLEX has one active release and a real quote, and leave the founder
  stack operational.
- **P6 — standing gate:** frozen install, state, typecheck, import boundaries, complete default
  tests, licence and dependency audits, schema drift, protected hashes, all review-seed proofs on a
  fresh database, and fresh isolated app-never-started referee 11/11. Refresh Graphify as a derived
  map, record parser/semantic limits, commit, push a stacked draft PR and do not merge.

## Standing and handoff

Commit this order, D-270 and its ORDER-WRITTEN ledger row before P0. Commit the failing proof without
production changes. Implement only the review-seed composition, then restart the focused file from a
fresh database after any assertion failure. Do not touch the persistent founder stack until P1–P4
are green. Preserve independent review through Order 044 and append one UNVERIFIED Gate-3 row only
after every builder proof passes.

## Definition of done

- [ ] The P0 failure is committed before implementation.
- [ ] P1–P4 pass on a fresh migrated database.
- [ ] P5 leaves localhost healthy with one quote-capable canonical FLEX release.
- [ ] P6 is fully green and Graphify is refreshed.
- [ ] Order 078 is pushed as UNVERIFIED and nothing is merged.
