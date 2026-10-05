# Order 531 — Yellow inline named guest history

## Objective

Resolve a uniquely named guest from the governed reservation index and display
their canonical Party profile and stay history inside Yellow mode without
navigation or a model request.

## Scope

- `frontend/yellow/src/voice.ts`
- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `tests/yellow-voice-routing.test.ts`
- focused frontend verification and public phone proof
- `handoff/reviews/531-yellow-inline-named-guest-history.md`

## Required behaviour

1. Guest-profile/history wording resolves only one canonical Party ID.
2. Repeat stays for the same Party are de-duplicated; ambiguous people fail
   closed into the existing general guest workspace/model path.
3. Yellow displays profile roles, masked contact hints and Party-ID-scoped stay
   history inline with property-timezone context.
4. No navigation, profile edit or Gemini call is required for a resolved read.

## Exclusions

- No Party merge/edit, communication, reservation mutation, API, database or
  schema change.

## Verification

- Intentional failing focused routing/surface tests before implementation.
- Focused frontend tests, strict TypeScript and production build.
- Public phone named-history proof.
