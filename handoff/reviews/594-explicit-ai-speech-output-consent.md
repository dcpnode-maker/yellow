# Order 594 independent review — explicit AI speech-output consent

## Verdict

**ACCEPTED after one retained rejection/repair round.**

Reviewer: Codex independent review agent `/root/order594_independent_review`
(non-implementer).  Reviewed on 2026-09-22 from
`D:\Yellow\temp\order593-departure-coordination-source`.

This verdict covers Order 594 only.  It grants no integration, deployment,
operational authority, provider, backend, schema, migration, fixture or phase claim.

## Implementation inspection

I compared the scoped source with the retained Order 592 release source and inspected
the resulting Order 593/594 delta.  The implementation correctly:

- replaces unconditional `say()` calls with a generation-bound one-shot permit;
- clears the permit and cancels stale speech at the start of each request;
- keeps wake words, language selection, microphone input and operational confirmation
  separate from speech-output consent;
- exposes a native button with a specific accessible name on each completed assistant
  response;
- consumes one-shot consent before attempting local browser speech;
- catches construction/voice-selection/`speak()` failures in `say()` and retains the
  completed text; and
- adds 44px minimum control geometry, visible keyboard focus and contained flex text.

The parser is intentionally narrow: `yes`, `confirm`, `go ahead`, bare wake words and
language preferences are rejected; explicit latest-response and one-answer phrases
are admitted.  No network voice, persisted broad toggle, avatar, clone or biometric
surface was added.

## First-pass finding (resolved)

### R594-1 — speech cancellation failure could abort the authoritative text request

`App.ask()` executes `window.speechSynthesis.cancel()` outside a `try` block before it
parses the request or records the user turn.  A browser exposing `speechSynthesis` but
throwing from `cancel()` therefore rejects the async request before the text answer,
proposal, progress, error, or stop acknowledgement is produced.  This violates
Required behavior 7: speech is optional presentation and text must remain available
when speech synthesis fails.

The mounted browser proof makes only `speak()` throw.  It does not exercise a throwing
`cancel()`, so the required failure fallback is incomplete despite that proof passing.

The implementer repaired this in scope with a fail-soft `cancelSpeech()` used by both
new-request cancellation and `say()`.  The mounted browser proof now makes `cancel()`
throw, submits `stop speaking`, and verifies the exact text acknowledgement remains
visible with no runtime or unhandled-rejection error.  I inspected that repair and
personally reran every required gate below.  R594-1 is closed.

## Personally executed proof

### Focused intent and mounted-browser proof

Command:

```text
bun test tests/yellow-ai-speech-consent.test.ts
```

Final re-review result: **4 pass / 0 fail / 38 expectations** in 8.22s.  The mounted Chrome proof
showed zero `speak()` calls after assistant activation, wake word, language choice,
operational confirmation, typed query and microphone query; exactly one call for an
explicit one-shot response; no speech on the later response; and exactly one additional
call from keyboard activation of the response Speak button.  At 240, 375 and 1440px the
control remained at least 44x44px, inside the viewport, with zero command-surface
horizontal overflow.  Enter-key focus/activation passed.  A throwing `speak()` left
the response text unchanged.  A subsequent throwing `cancel()` still produced the
exact stop acknowledgement in text and produced no unhandled browser error.

### Departure and voice regressions

Command:

```text
bun test tests/yellow-departure-coordination.test.ts tests/yellow-voice-routing.test.ts
```

Result: **44 pass / 0 fail / 340 expectations**.

### Strict frontend TypeScript

Command:

```text
bun x tsc --noEmit -p frontend/yellow/tsconfig.json
```

Result: **pass**.

For disclosure, repository-wide `bun run typecheck` is red on three unrelated current
source test errors: readonly `actorId` assignment in
`india-native-fiscal-credit-note-list.test.ts`, plus two root-config JSX errors for
tests importing `App.tsx`.  The Order 594 requirement is strict frontend TypeScript,
which passed; the unrelated root failures are not waived or relabelled green.

### Production frontend build

Command:

```text
bun x vite build --config frontend/yellow/vite.config.ts
```

Result: **pass**, 484 modules transformed; production assets written successfully.

### Licence policy

Command:

```text
bun run license-check
```

Result: **pass** (`Dependency license policy passed`).

### Import boundaries

Command:

```text
bun run boundaries
```

Result: **pass**, 204 TypeScript files scanned.

## Final acceptance boundary

Order 594's explicit speech-output-consent scope is independently accepted.  Speech is
silent by default, one-shot only, locally rendered, failure-soft, keyboard accessible,
and contained at 240/375/1440px.  Operational `yes`/`confirm`/`go ahead` remains speech-
inert.  This acceptance does not approve Order 593, public integration/deployment, any
backend/schema/fixture change, always-listening behavior, or broader AI authority.  No
implementation file was modified by this review.
