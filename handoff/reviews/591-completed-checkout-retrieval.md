# Review 591 — completed checkout retrieval

**Reviewer:** `/root/order591_review` (independent; did not implement Order 591)  
**Date:** 2026-09-22  
**Candidate:** `D:\Yellow\temp\order591-checkout-history-source`  
**Verdict:** **APPROVED for the bounded Order 591 source/read-only retrieval scope.**

## Independence, source lock and scope

I read `PROJECT.md`, `AGENTS.md`, the Phase 0 section of `BUILD-PLAN.md`, the
canonical Order 591, and the candidate checkpoint. The Unix `state.sh` launcher is
not executable on this Windows host because no `/bin/bash` exists, so I personally
ran the repository's read-only `state.ps1` equivalent. I did not edit candidate
implementation, public serving source, application containers, configuration or
database data. My only repository write is this review record.

I personally re-hashed the frozen candidate. Every hash matches its implementation
checkpoint:

| File | SHA-256 |
|---|---|
| `frontend/yellow/src/voice.ts` | `6C0A76B818E32DC5C829D7978735A0469B72E7A0E612B839C0BA93665166FD47` |
| `frontend/yellow/src/App.tsx` | `C061C8900757BB3BD61247BF645D1C34CEDA253FE2AD4A226A8F40BDE1DD6056` |
| `frontend/yellow/src/workspaces/ReservationWorkspace.tsx` | `CFF36C5892447E0D20A6649411C94274A6BA986AE38DB1BA7D0FBABCD88DC78D` |
| `tests/yellow-completed-checkout-retrieval.test.ts` | `27ECA932B32B17FC81F98604386B09FCE43085FB099C86C41FFC766F4A1392FB` |

I inspected the complete no-index diff against the exact public serving source
specified by the order. No backend, API, migration, schema, seed, fixture, finance,
occupancy, worker, dependency or public-deployment file changed.

## Source findings

- Live `due_out`/`in_house` candidates are resolved first. One live match wins; an
  ambiguous live identity fails closed and prevents historical fallback.
- Historical fallback is entered only for an explicit checkout intent with no live
  identity match. It considers only `checked_out` rows and requires one exact
  confirmation or unique name match; multiple completed matches fail closed.
- The historical room label is carried only from the exact complete command-index
  row that resolved the reservation. For a completed detail, the journey never uses
  checkout-readiness room data as a substitute and displays `not resolved` when the
  authoritative command row has no label.
- Completed copy identifies a completed departure review, and the journey opens on
  Release. Its actual detail status is `checked_out`; the UI suppresses primary-folio
  opening, zero-balance settlement, Finance resolution and final-checkout controls.
  The existing mutation functions still retain their active-stay server preflights
  and were not widened.
- When the complete command-index request succeeds with an empty result, the app no
  longer falls back to partial Today lanes. Lane fallback remains only for index
  unavailability.

I found no Order 591 defect or authority expansion.

## Personally executed deterministic proof

```text
bun test tests/yellow-completed-checkout-retrieval.test.ts
  4 pass, 0 fail, 16 assertions

bunx tsc -p frontend/yellow/tsconfig.json --noEmit
  exit 0

bunx vite build --config frontend/yellow/vite.config.ts
  exit 0; 484 modules transformed

bun run license-check
  Dependency license policy passed for 0 installed package(s)

bun run boundaries
  Import boundaries OK: 203 TypeScript files scanned
```

I also ran the adjacent Order 587 checkout and voice-routing tests. All six guided
checkout tests and the Order 591-adjacent voice cases passed. The combined adjacent
run ended `45 pass, 1 fail`; the sole failure is the inherited unrelated KPI source
string assertion for `openMetric("Show inventory")`, which is already absent from
the exact public-source baseline and is outside this order.

## Actual-browser, network-write and database proof

I personally started fresh incognito Chromium contexts against the isolated
candidate at `http://127.0.0.1:3012`, at both 375 and 1440 CSS pixels. The route guard
allowed only `GET`, `HEAD`, `OPTIONS`, and the existing synthetic-session
`POST /api/v1/auth/demo:enter`; every other non-read request would be aborted and
recorded. In each fresh session I entered exactly `checkout Rohan Kapoor`.

| Width | Initial selected step | Canonical state | Room | Checkout controls | Bill proof | Operational writes |
|---:|---|---|---|---:|---|---:|
| 375 | Release | Departed | Two Bedroom Residence 113 | 0 | Window 1 · Primary · SETTLED · SAR 0.00 | 0 |
| 1440 | Release | Departed | Two Bedroom Residence 113 | 0 | Window 1 · Primary · SETTLED · SAR 0.00 | 0 |

Both widths had zero checkout checkboxes, zero checkout/final-confirm buttons, exact
document containment, zero console/page errors and zero HTTP error responses. After
clicking Bill, the settled zero-balance statement remained read-only. The captured
request-write list was empty at both widths (the permitted demo-entry request is
excluded from the operational-write list by construction).

Immediately before and after a second full guarded two-width browser run, I
personally fingerprinted every base table in `public` inside separate
`REPEATABLE READ READ ONLY` transactions. Each table fingerprint is its row count
plus an MD5 over deterministically ordered `to_jsonb(row)::text`; the aggregate is
SHA-256 over all 129 table fingerprints sorted by table name. Both snapshots were:

```text
tables=129
aggregate=1ee0e346b5653e717c931bdba664aa043fe4b33d5dcd0cc3cac72518637365a1
equal=true
```

This proves that the fresh-session retrieval and Bill review performed no database
state change.

## Approval boundary

This approval covers only the isolated Order 591 completed-checkout retrieval and
read-only review behavior. It does not approve public promotion, merge, schema/API
work, checkout replay, financial/occupancy mutation, or any wider PMS-completion
claim.
