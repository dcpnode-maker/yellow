# Order 332 — Arrivals and departures lane focus

**Status:** BUILT-PENDING-FRESH-TIER2-REVIEW-D927
**Phase:** 7 — founder-visible presentation of already-built journeys
**Branch:** `phase-7/arrivals-departures-lane-focus`
**Base:** `8b5a7bc` (freshly approved Order331 governance head)
**Runtime source base:** `75f335933975dab11666fe1cc7d6172a3b57b4b9`
**Risk tier:** 2 — presentation/navigation only; fresh independent browser review mandatory

## Outcome

Make the existing Today management index's **Arrivals & departures** control take
management to the already-built due-in, due-out and in-house lanes instead of
reloading the same Today route and focusing the page title.

## Exact scope

- add one stable semantic focus target for the existing Today operational lanes;
- special-case only the existing `data-journey-view="today"` management-index
  control so it scrolls/focuses that target without a request, route push or Today
  reload;
- preserve the canonical Today route, current loaded lane truth and every existing
  lane action;
- add intentional-red and focused browser/navigation proof.

## Forbidden

No new control, route, request, API, domain, database, data, credential, permission,
status, authority, post310 statutory or local-runtime change; no rearrangement of
the Today catalogue/lanes; no merge, push or deployment.

## Definition of done

- [x] Intentional red proves the existing control reloads/self-navigates rather than
      focusing the operational lanes.
- [x] The exact control focuses the semantic lane target with no request or history
      change while all other seven journey identities preserve existing routing.
- [x] Focused, standing and static gates pass.
- [ ] Fresh non-implementing Tier2 browser reviewer approves the exact candidate.

## Builder evidence — D927

- Intentional red was1 pass/1 fail/25 assertions and failed only on the absent
  semantic operational-lane target/Today-specific no-navigation branch.
- Exact candidate `86ec512` gives the existing lane grid one programmatic focus
  target. Only the existing Today journey control focuses and scrolls it, then
  returns before generic routing. It calls no request, Today reload or history API.
- Focused proof passes14/0(193). Standing proof passes1147/0 plus890 expected
  database skips(17442) across2037 tests/375 files. Typecheck,127 import boundaries,
  23 dependency licences, audit0, JavaScript syntax and diff hygiene pass.
- No API/domain/database/data/permission/status/authority/post310/local behavior was
  changed. Fresh independent Tier2 browser review remains mandatory.
