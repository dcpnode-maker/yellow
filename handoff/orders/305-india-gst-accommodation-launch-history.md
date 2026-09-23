# Order 305 — India GST accommodation launch-history seed

**Status:** APPROVED-D841
**Phase:** 7 — Tax and India IRP
**Branch:** `phase-7/india-gst-accommodation-launch-history`
**Base:** `b7a5b50` (independently approved Order 304 governance head)
**Risk tier:** 3 — statutory bootstrap history and deterministic data authority;
fresh independent executable review mandatory

## Outcome

Make every fresh Yellow bootstrap and invariant fixture contain the exact governed
India hotel-accommodation rate history approved by Order304: a retired version 1 over
the predecessor period and an active version 2 from Notification15/2025's Kolkata-
midnight cutover. Seed replay is deterministic and collision-fail-closed. Existing
installed databases are not rewritten; their conversion is a separate high-risk
order because referenced fiscal evidence must not be silently changed.

## Exact contract

- Global `tax_jurisdiction` / `in-gst-lodging` version 1 has its deterministic v1 id,
  status `retired`, exact effective period
  `[2022-07-17T18:30:00.000000Z,2025-09-21T18:30:00.000000Z)`, and exact 12%-with-
  ITC through INR7500 plus unbounded 18%-with-ITC `GST_ROOM` content.
- Version 2 has the deterministic v2 id, status `active`, exact effective period
  `[2025-09-21T18:30:00.000000Z,infinity)`, and exact 5%-without-ITC through INR7500
  plus unbounded 18%-with-ITC `GST_ROOM` content.
- Both retain canonical India/tax-exclusive/document-rounded/transaction-value/
  room-revenue semantics and the unchanged launch `GST_FNB` example.
- The generic launch catalogue exposes both entries and validates both against the
  existing registered schema. The seed transaction inserts both or neither, writes
  deterministic audit evidence, returns `already exact` on replay, and rejects any
  id/owner/type/key/version/effective/content/status collision without repair.
- The invariant SQL fixture carries the same two exact rows. Existing active-only
  resolution continues to return only version 2.

## Scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, and bounded Phase-7 plan/roadmap;
- bounded launch catalogue/seed logic in `scripts/seed.ts`;
- exact India rows in `tests/seed_fixture.sql`;
- intentional-red and permanent seed-history proof, plus bounded existing seed/
  extension integration expectations where required;
- bounded `docs/EXTENSIONS.md`, contract/domain/security/QA documentation;
- fresh independent Tier-3 review evidence.

## Forbidden boundary

No migration/schema/grant/RLS change; no mutation or conversion of an existing
installed database; no generic extension writer/lifecycle or active-only resolver
change; no property/stay historical selection, section14/calendar, tax computation,
posting, fiscal document, IRP, API/UI, local promotion, merge/deploy or Phase/
application-complete claim.

## Pre-registered proof

- **P0 red:** fresh launch catalogue/fixture do not yet contain the exact two-version
  history.
- **P1 exact history:** deterministic ids, versions, statuses, periods, contents,
  thresholds, rates and ITC flags are equality-bound in catalogue and fixture.
- **P2 replay/collision:** first seed inserts exact history, second is byte-equivalent
  `already exact`; independent id/version/status/period/content collisions roll the
  complete seed transaction back without repair.
- **P3 resolver preservation:** active-only resolution returns only v2; visible
  history contains exactly retired v1 and active v2.
- **P4 source sensitivity:** predecessor/successor rate, threshold, ITC, status,
  version and microsecond-bound mutants make permanent proof red.
- **P5 preservation:** schema is unchanged; fresh setup, seed, referee, standing and
  static gates remain green.

## Definition of done

- [x] Intentional red precedes production (`4920b3d`: 0 pass / 1 fail before the
  launch-history implementation).
- [x] Fresh seed, exact replay, collision rollback and active-only proof are green
  (live 2/0 with 72 assertions; existing seed integration 10/0 with 63 assertions).
- [x] Standing/static/setup/schema/referee preservation gates are green (standing
  1,079 pass / 887 skip / 0 fail / 16,446 assertions; typecheck; 122-file boundary;
  23-package licence; audit 0; schema match; 59 migrations / 110 tables and referee
  11/11).
- [x] Fresh non-implementing Tier-3 reviewer personally executes proof and approves (D841; exact schema comparison was precondition-blocked by the Docker daemon after all other gates passed; D840 recorded schema match).

## Build evidence — D840

Fresh catalogue and invariant-fixture truth now carry deterministic global retired v1
and active v2 rows with exact adjacent Kolkata-midnight periods, complete predecessor/
successor room-rate content and unchanged F&B content. The seed preserves generic
launch behavior, inserts exact ranges only for the governed history, audits both ids,
returns byte-equivalent `already exact` on replay, and fails the complete transaction
closed for content, predecessor/successor status, microsecond bound, range-inclusivity,
version and deterministic-id collisions. Runtime/app-role proof preserves the current
active-only resolver and selects v2. Focused/adjacent, full seed integration, standing,
static, schema and fresh database/referee results are recorded above. The inherited
`setup.ps1` 89-table oracle stopped only after successful migrations, seeds and fixture
load showed the actual committed 110 tables; it was not edited or weakened. The exact
`yellow-order305-proof` containers, network and volume were verified and removed;
the founder local was untouched. No installed-database conversion or approval is
claimed.
