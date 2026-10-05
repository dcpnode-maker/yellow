# Order 418 — Operator workflows, mobile surface, and demo AI entry

## Objective

Turn the synthetic public demonstration from a configuration-heavy operator workbench
into a focused hotel workflow: Today, reservations, guest history, housekeeping and
rates. Provide a responsive mobile experience with a voice/text AI entry point.

## Scope

- Reorganize existing operator routes and navigation into role-oriented workflows.
- Make a guest name open the existing Party-backed guest profile and stay history.
- Extend the deterministic **synthetic-only** review fixture with realistic fictional
  names, stays, preferences, notes and operational history.
- Add a mobile-first AI assistant shell that can answer from approved demo data and
  deep-link users to relevant operator routes.
- Add a Gemini adapter only after a founder-configured local environment credential;
  no key is committed, printed, or accepted through the public browser UI.
- Add responsive visual and workflow tests; preserve all tenant, financial, occupancy
  and statutory rules.

## Explicit exclusions

- No real guest identity, contact, payment, loyalty, travel-document or booking data.
- No migration, table, payment, occupancy, fiscal, RLS or state-machine change.
- No live OTA, PMS, channel, CRM, calendar or Gemini call until credentials and an
  explicit provider boundary are configured locally.

## Acceptance

1. Primary navigation does not expose configuration as the default operating surface.
2. A reservation's guest link reaches a useful Party-backed profile with factual
   synthetic stay history.
3. The critical Today, reservation, guest and AI flows work on a phone viewport.
4. AI replies identify their demo-data basis and provide navigation actions, not
   fabricated operational facts.
5. The shared public demo remains synthetic-only and passwordless by its temporary
   demo boundary.

## Verification

- Existing invariant battery remains green.
- Browser workflow checks at desktop and phone widths.
- Direct test of tenant-bound guest navigation and synthetic fixture determinism.
- Independent review before any auth/provider boundary or persisted-data change is
  considered complete.
