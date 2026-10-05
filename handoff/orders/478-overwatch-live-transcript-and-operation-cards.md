# Order 478 — Overwatch live transcript and operational result cards

## Objective

Make Overwatch retain a natural voice turn across ordinary browser recognition
boundaries, visibly render interim and final transcription locally, and present
safe operational result cards in the assistant before it opens an existing
Yellow workflow.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/voice.ts`
- `frontend/yellow/src/styles.css`
- `tests/yellow-voice-routing.test.ts`

## Required behaviour

- Interim microphone text is visible only in the current browser session and is
  never sent to a model or persisted as conversation history.
- Finalized text is shown as the user's message before local intent routing or
  a protected guided-assistant request.
- A browser recognition `onend` after a phrase fragment resumes capture without
  losing that fragment until the turn is finalized; errors remain explicit.
- Local arrivals, departures and in-house requests render a compact read-only
  result card using only the already loaded, tenant-scoped lane data.
- Named reservation requests render a compact read-only reservation card and
  link only to the existing reservation or governed check-in review.
- No voice path creates, edits, checks in, assigns rooms, changes a rate plan,
  changes a party, or writes a company profile. Those requests may only guide
  to an existing confirmation-gated workflow.

## Exclusions

- No provider, Gemini key, transport, API contract, database, migration,
  persistence, recording, external transcription, guest export, or production
  data change.
- No copying Gemini UI, source code, branding, or trade dress. The experience
  is an original Yellow/Overwatch interface.

## Verification

- Strict typecheck.
- `bun test tests/yellow-voice-routing.test.ts`.
- Existing focused Yellow public-surface and mobile-navigation tests.
- Production interaction still requires explicit server-authorized confirmation
  for a mutation.
