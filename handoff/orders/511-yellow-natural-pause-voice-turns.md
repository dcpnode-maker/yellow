# Order 511 — Yellow natural-pause voice turns

## Objective

Stop browser phrase boundaries from truncating or prematurely submitting a
spoken Yellow command. Accumulate finalized speech fragments across natural
pauses and execute only after a genuine silence window.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/voice.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-voice-routing.test.ts`
- `handoff/reviews/511-yellow-natural-pause-voice-turns.md`

## Required behaviour

1. Final fragments from consecutive recognition events are accumulated into one
   turn rather than replacing the earlier words.
2. Interim text is visible but never becomes an executable command or
   confirmation.
3. Any new result resets the silence timer; a command is submitted only after
   2.2 seconds without another result and only from finalized words.
4. Chromium phrase-boundary endings restart the same turn with its accumulated
   transcript. Allow enough bounded restarts for normal hotel instructions.
5. Microphone audio remains browser-owned and is not recorded or persisted by
   Yellow.
6. Existing confirmation-gate behaviour remains unchanged.

## Exclusions

- No claim that browser Web Speech is Gemini Live streaming.
- No raw-audio upload, recording, storage or background wake-word service.

## Verification

- Pure sequential-fragment tests, existing voice routing tests, typecheck and
  production build.
- Hosted microphone capability check where browser/device access permits.
