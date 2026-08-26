# Order 178 — India and Canada scenario foundations

**Status:** CHANGES REQUIRED — D-457
**Phase:** 5 · human UAT foundations
**Branch:** `phase-5/india-canada-scenario-foundations`
**Base:** `f90165d` (independently approved Order177)
**Risk tier:** 1 — deterministic offline fixtures only
**Owner:** Codex implementation; independent fixture review

## Outcome

Prepare compact, deterministic hotel-scenario sources for one Indian property and one
Canadian property, plus a pure compiler that can materialise two to three years of
synthetic UAT inputs on demand. The sources must cover room setup, board plans,
packages, booking sources, party shapes, cancellation/refundability choices,
corporate and group patterns, and operational edge cases without inventing legal tax
authority or writing to Yellow's database.

## Scope

- `fixtures/scenario-foundations/v1/india.json`;
- `fixtures/scenario-foundations/v1/canada.json`;
- `scripts/generate-scenario-foundations.ts`;
- `tests/scenario-foundations.test.ts`;
- `package.json` only to expose the generator command;
- this order, additive D-456, `handoff/LEDGER.md`, and one independent review.

No migration, schema, database provisioning, seed mutation, runtime route, API,
permission, credential, real guest data, legal tax rate, fiscal assertion, payment,
external upload, dependency, timer, service, local stack, merge, push, promotion or
deployment is in scope.

## Required foundation

1. Two versioned source manifests use fictional properties and synthetic identities
   only. India uses INR and `Asia/Kolkata`; Canada uses CAD and an IANA Canadian
   timezone.
2. Each manifest describes room classes/types, accessible and connecting inventory,
   AP/CP/MAP/EP-style or jurisdiction-neutral equivalents, refundable and
   non-refundable policies, inclusions, sources, adult/child party shapes, corporate,
   group/block and long-stay patterns, seasonal demand and explicit edge cases.
3. Tax/fiscal fields are marked `pending_policy` and contain no percentages, account
   postings, statutory claims or jurisdictional calculations. Group/block rows are
   labelled future scenario intent until their authoritative phase lands.
4. A pure deterministic compiler accepts manifest, start date, day count and seed;
   validates bounded input; emits stable canonical JSON; and derives no wall-clock,
   random, credential, PII or database authority.
5. Default generation covers 1,096 days and writes only beneath
   `D:\Yellow\generated\scenario-foundations\v1\<scenarioKey>\<sha256>.json`.
   An explicit output root override is allowed for isolated tests. Existing files
   with identical bytes are a no-op; mismatched bytes at the same content-addressed
   path hard-fail.
6. Generated payloads carry source version/hash, compiler version, seed, date window,
   bounded daily demand inputs and truthful pending-capability markers. They are
   future UAT inputs, not imported reservations or claimed production data.

## Proof

- source-schema validation and rejection of unknown/missing fields;
- identical inputs produce byte-identical JSON and SHA-256 paths;
- India and Canada default windows each contain exactly 1,096 local dates, including
  leap-day and Canadian DST-transition coverage without UTC-day inference;
- all identities are synthetic and all tax/fiscal/group capability markers remain
  non-authoritative;
- traversal, absolute override misuse, excessive day counts, invalid IANA timezones,
  malformed dates and overwrite drift fail closed;
- standing tests, typecheck, boundaries, licences and audit remain green;
- independent reviewer re-executes focused generation into a disposable directory
  and confirms cleanup. No local app stack is required.

## Definition of done

- [ ] Both compact manifests are complete and versioned.
- [ ] Deterministic 1,096-day compilation is bounded and content addressed.
- [ ] Output defaults to the single approved D-drive generated-data tree.
- [ ] No legal, fiscal, database or real-person authority is implied.
- [ ] Focused and standing gates pass.
- [ ] Independent review approves the immutable candidate.
