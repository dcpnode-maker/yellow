# Order 619 — colleague demo readiness runtime contract

## Scope

- Add a small runtime readiness contract for the colleague-facing Yellow public demo.
- Expose the current demo requirement checklist through the app without claiming the demo is ready prematurely.
- Add a CSP-safe mobile-first root shell that points colleagues/operators to the readiness contract.

## Out of scope

- Claiming any unfinished operational workflow is complete.
- Adding mutable PMS actions, schema changes, migrations or public-demo data changes.
- Replacing the full React/mobile Yellow Next app; this order only gives the thin server checkout a truthful runtime contract.

## Acceptance

- `GET /` returns a CSP-safe HTML shell for Yellow PMS demo readiness.
- `GET /api/v1/demo/readiness` returns `status: "not_ready"` until all requirement gates have proof.
- The readiness payload includes the required areas from the active goal:
  - realistic synthetic configured property;
  - complete hotel-operating workflows;
  - mobile-first UX;
  - Yellow/Overwatch multilingual Gemini AI;
  - confirmation-gated operational actions.
- Tests prove the app does not emit a false ready/share notification.
