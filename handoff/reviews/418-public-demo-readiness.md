# Yellow public demo readiness

Last checked: 2026-09-20

## Proven in the public synthetic runtime

- Public Cloudflare URL and local health endpoint return HTTP 200.
- Automatic synthetic-demo entry loads the authenticated Yellow Review Operator
  workspace without a tester password.
- Today presents live due-in, due-out and in-house lanes backed by PostgreSQL.
- Guest/stay navigation and the governed check-in preparation path are visible.
- Cashiers can search an in-house guest and open the authoritative billing desk.
- `PARKING-REVIEW` has one primary guest, one exact Room 203 occupancy and one
  zero-balance open primary folio; the cashier folio screen loads successfully.
- Add-charge is confirmation-gated, server-code-governed, and visibly warns that
  postings are immutable. No charge was posted for the public smoke proof.
- Overwatch opens with English (India), Hindi, Marathi, Kannada and Telugu choices;
  its live-arrivals command returns the current PMS due-in lane and holds context.
- On 2026-09-20 the deployed public bundle was browser-smoked end to end: selecting
  English (India), asking for today's arrivals, and preparing Aarav Mehta's check-in
  returned the live three-arrival card and opened the named check-in preparation.
  The UI explicitly reported that no check-in had been performed and that named
  confirmation remains required.
- The public HTTPS response emits `Permissions-Policy: microphone=(self)` and the
  deployed client retains speech fragments for a 3,000 ms natural-pause window.
  Its focused localisation/voice regression passed 1/0 (21 assertions).
- On 2026-09-20, Overwatch conversation context was made memory-only for the live
  page: no local/session/browser storage is written. The public bundle was rebuilt,
  returned HTTP 200, and its delivered operator asset contains neither browser
  storage APIs nor the old short pause window.
- The deployed voice entry copy now accurately states the browser requirement:
  tap once to grant microphone access, then use the Overwatch wake phrase throughout
  the active continuous voice session. It does not falsely promise passive
  microphone capture before browser consent.
- The deployed Gemini route was exercised once on 2026-09-20 using a harmless
  workflow question (no guest identity, payment, document or booking data). It
  returned HTTP 200 with an Overwatch response that correctly stated its live-data
  limits and visible-confirmation requirement. The route retains its 12-per-five-
  minute public demo budget and provider retry/fallback behaviour.
- A separate live negative prompt containing contact-like data returned HTTP 400
  before provider use. The focused Gemini boundary suite passed 24/0 (29 assertions),
  covering regional navigation, sensitive-content rejection, rate limiting and
  retry-only API-key fallback.
- The public-entry and local-prefill security suite passed 10/0 (70 assertions),
  proving that automatic shared-demo entry hides credential fields, relies only on
  process-scoped credentials, and does not expose or persist those credentials in
  the browser.
- The attached Locanda Homes client-site preview returns HTTP 200 and is linked from
  the property workspace.
- A read-only public browser check of Rates on 2026-09-20 showed the guided hotel
  setup in its intended order: property/market, rooms/inventory, guest experience
  (including meals and amenities), distribution scope, rate strategy, then review
  and publication. Advanced direct configuration stays disclosed, rather than being
  the default operating surface.

## Independent checks completed

- Cashier fixture fresh isolated seed: 27 passed, 0 failed, 117 assertions.
- Independent PostgreSQL invariant battery: 11 passed, 0 failed.
- Focused responsive browser contracts at 375px and 640px plus operator visual
  geometry passed 8/0 (60 assertions) on 2026-09-20.
- Cashier/billing and folio operator contracts passed 25/0 (242 assertions) on
  2026-09-20; six database-dependent inherited HTTP proofs were explicitly skipped
  because this focused command was not attached to an isolated proof database.
- Arrival preparation, room assignment, check-in-to-housekeeping continuity and
  phone-zoom containment passed 18/0 (281 assertions) on 2026-09-20.
- The targeted Party-profile, guest-history, Overwatch localisation and operator
  asset-security suite passed 17/0 (243 assertions); seven database-dependent
  Party HTTP cases were explicitly skipped without a proof database.
- See `461-cashier-fixture-repair-unreviewed.md` for hashes and independent proof.

## Not yet sufficient to call the whole PMS production-ready

- The current deterministic public fixture contains two room types and six rooms,
  plus the FLEX plan, governed policy set, one company receivable and one travel
  agent. It proves configuration behaviour, but it is not yet the broader multi-room-
  class, multi-rate-plan synthetic catalogue requested for a full hotel walkthrough.
- The inherited full `bun test` process is still active and has no attached output;
  it is not counted as a pass until it exits with an inspectable result.
- Voice microphone/browser permission and live speech recognition require an actual
  browser-device permission test; text command and language UI are proven, but that
  is not a substitute for microphone acceptance.
- Broader PMS, RMS, OTA and market-dashboard scope remains outside this focused
  public-demo verification and must be independently audited before a full-product
  production claim.
