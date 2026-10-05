# Order 503 — Yellow ambient AI mode design

## Objective

Replace the separate-looking Overwatch assistant dock with an ambient, in-context
Yellow AI mode. A spoken/text wake phrase (“Hi Yellow” / “Yellow”) should make the
existing PMS screen visibly awake through a restrained neon-yellow sunlight/ray state
behind the UI; requested live tables and workflows must render in the active PMS
surface, not in a chatbot tab.

## Accepted visual reference

`C:/Users/astha/.codex/generated_images/01a02df3-c84f-7773-a169-dec0e20c9da6/exec-ed0a3066-73a8-4866-82a2-39a07a102a45.png`

## Scope

- `frontend/yellow/src/App.tsx`, `frontend/yellow/src/styles.css`, `voice.ts`, and
  focused frontend tests
- Existing deterministic local intents and already governed action components only

## Required behaviour

1. Normal mode is a white/yellow PMS. Yellow mode is an explicit, session-scoped UI
   state, visually expressed by accessible/reduced-motion-safe light/ray layers behind
   data—not a new application, sidebot, or modal-only replacement.
2. Wake phrases activate Yellow mode without a paid-model call. A textual command
   such as “show arrivals” renders/filters the actual live arrival table in the active
   surface; named reservation requests show the actual record/workflow in context.
3. Existing operational writes remain component-specific, visibly explained and
   confirmation-gated. Yellow mode never silently acts, calculates availability in the
   browser, or replaces server preflight.
4. The design works at phone widths without hiding critical context. It uses no blue,
   no planet/orb, no faux Gemini/third-party trade dress and no dark chat shell.

## Exclusions

- No provider/live-audio protocol, new backend action/domain contract, real data,
  external messaging, database/schema change, or public release in this order.

## Review protocol

Use the accepted reference plus Browser screenshot comparison at desktop and mobile
width. Verify command/action regression behavior separately from visual fidelity.
