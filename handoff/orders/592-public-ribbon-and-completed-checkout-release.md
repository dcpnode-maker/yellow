# Order 592 — public ribbon and completed-checkout release

## Objective

Promote the exact independently approved Order 590 shared ribbon/card system and
Order 591 read-only completed-checkout retrieval into the public Yellow demo,
without changing hotel data, operational authority, finance behavior, workers,
database schema, or the existing public tunnel.

## Preconditions

- Order 590 has an independent `APPROVED` review against its frozen hashes.
- Order 591 must have an independent `APPROVED` review against its frozen hashes
  before any public source, image, or container changes.
- The release candidate begins from the exact current public serving source at
  `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

## Scope

- Exact frozen source files listed by Orders 590 and 591.
- Their two focused test files.
- App-only image build and recreation of only `yellow-public-demo-app-1`.
- Public browser proof at 240/375/1440 for ribbons and 375/1440 for completed
  checkout retrieval.
- `handoff/orders/592-public-ribbon-and-completed-checkout-release.md`
- `handoff/reviews/592-public-ribbon-and-completed-checkout-release.md`
- `handoff/LEDGER.md`

## Required proof

1. Every promoted source file matches its independently approved frozen hash before
   the release build.
2. Focused tests, strict frontend TypeScript, production build, licence policy and
   actual import-boundary CLI are run on the combined candidate.
3. `./setup.sh --db-only` (or the repository-documented Windows equivalent) passes
   the complete database gate before public recreation.
4. A repeatable-read/read-only aggregate across all 129 public tables is identical
   before and after deployment.
5. PostgreSQL, Valkey and tunnel container IDs remain unchanged. Only the app image
   and app container may change.
6. Public browser proof demonstrates the approved ribbon/cards and completed Rohan
   departure review with no operational/financial write beyond synthetic demo entry.
7. A non-implementing reviewer personally reruns the release proof.

## Exclusions

- No schema, migration, seed, fixture, role, grant, permission, backend/API,
  financial, occupancy, checkout-state, OTA/provider, worker or tunnel change.
- No activation of disabled ecosystem areas or public Market Lab.
- No re-checkout, rollback, reopening, mutation fallback, inferred room, or wider
  assistant authority.
+

## Release checkpoint — 2026-09-22

- Order 590 and 591 frozen hashes were promoted exactly into the current public
  serving source and verified byte-for-byte.
- Combined focused proof is 10 passed, 0 failed, 46 assertions; strict frontend
  TypeScript, the 484-module Vite build, licence policy and 203-file import boundary
  scan pass. The fresh isolated database referee reports
  `RESULT: 11 passed, 0 failed of 11`.
- Only `yellow-public-demo-app-1` was recreated. PostgreSQL
  `9f507e09cc38`, Valkey `781c68656c43` and tunnel `e17219ecd7aa` remain
  unchanged. The new app is `dbe35dabd624` and healthy.
- Local and public-tunnel health both return HTTP 200.
- Public browser proof passes at 240/375/1440 for Today, Operations and Ecosystem:
  exactly two pointer-inert cards, one selected tab, viewport containment, and full
  keyboard reveal. At 240 px Operations scrolls to 123 and Ecosystem to 174.
- Fresh public sessions at 375/1440 resolve `checkout Rohan Kapoor` to the
  completed `L3R-DO-0013` departure, initially select Release, show authoritative
  room 113, expose zero checkout controls/checkboxes, and show Bill as
  `SETTLED / SAR 0.00`. The guarded request list contains no operational or
  financial write.
- The exact independent 129-table repeatable-read/read-only algorithm is unchanged
  from immediately before promotion through the public proof:
  `1ee0e346b5653e717c931bdba664aa043fe4b33d5dcd0cc3cac72518637365a1`.
- Temporary candidate browser/referee containers and the disposable referee volume
  were removed. Independent `/root/order592_review` approved the bounded public
  release in `handoff/reviews/592-public-ribbon-and-completed-checkout-release.md`.
