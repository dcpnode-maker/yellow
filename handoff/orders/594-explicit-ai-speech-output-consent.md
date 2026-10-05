# Order 594 — explicit AI speech-output consent

## Objective

Make Yellow's assistant silent by default. Typed input, microphone input, the wake
word, opening the assistant and selecting a language may produce text and visual
progress, but none of them authorizes audio output. Yellow may speak only one answer
after the colleague explicitly asks for that answer aloud or deliberately activates
the latest response's Speak control.

## Source authority and sequence

- Apply after Order 593 frontend integration in
  `D:\Yellow\temp\order593-departure-coordination-source`.
- Preserve all confirmation-gated operational behavior; this order changes only
  local browser speech output consent.
- No backend, API, migration, schema, fixture or deployment change.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/voice.ts`
- `frontend/yellow/src/styles.css`
- `tests/yellow-ai-speech-consent.test.ts` (new)
- Focused additions to `tests/yellow-voice-routing.test.ts` only when needed.
- `tests/yellow-departure-coordination.test.ts` only to replace its superseded broad
  speech-toggle assertion with the one-shot consent contract.
- `handoff/orders/594-explicit-ai-speech-output-consent.md`
- `handoff/reviews/594-explicit-ai-speech-output-consent.md`
- `handoff/LEDGER.md`

## Required behavior

1. Default state is silent and is not persisted as a broad permission.
2. Bare `Yellow`, `Overwatch`, assistant activation, microphone permission,
   listening, dictation, a typed query, and a language choice never call
   `speechSynthesis.speak()`.
3. Explicit phrases such as “answer aloud”, “read that aloud”, and “speak the answer”
   admit only the matching response. They do not arm future responses.
4. A visible, keyboard-accessible Speak button on a completed assistant response may
   speak only that response. It is never shown as an operational confirmation.
5. Stop cancels current speech. Starting a new request cancels stale speech but does
   not speak the new result unless separately requested.
6. Speech uses the existing local browser voice and selected language; no network,
   paid voice service, clone, avatar, biometric or recorded voice is introduced.
7. Text answers, proposals, confirmations, progress and errors remain available when
   speech synthesis is absent, denied or fails.
8. Operational confirmation words such as `yes`, `confirm`, or `go ahead` never also
   grant speech output.

## Required proof

- Focused intent tests cover admitted and rejected phrases across supported language
  hints without treating language choice as consent.
- A browser spy proves zero `speechSynthesis.speak()` calls for wake word,
  microphone query, typed query, operational confirmation and language selection.
- The spy proves exactly one call for one explicit one-shot request and for one Speak
  button activation; later replies remain silent.
- 240/375/1440 viewport and keyboard proof for the control.
- Strict frontend TypeScript, Vite build, licence policy and import-boundary CLI.
- Independent non-implementing review before integration or deployment.

## Exclusions

- No avatar, cloned face/voice, character generation, humour engine, always-listening
  mode, passive microphone, third-party voice API, backend preference, operational
  authority, provider credential, public deployment, merge or push.
