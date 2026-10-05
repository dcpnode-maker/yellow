# Order 625 — Mobile operating journey shell

## Scope

- Turn the root demo shell from a checklist-only page into a mobile-readable
  operating journey page.
- Render the current synthetic property, readiness state, PMS workflow cards,
  group-block summary and confirmation policy server-side.
- Keep CSP safe: no inline scripts or inline styles.

## Out of scope

- React/Vite app migration.
- Public deployment changes.
- Enabling operational mutations or Gemini calls.

## Acceptance

- `/` renders the operating journey cards in a clean mobile-first shell.
- `/assets/demo.css` serves the local CSS used by the page.
- The root page contains links to readiness, operating journey, group blocks and
  Overwatch endpoint information.
- Tests prove no inline scripts/styles and that key PMS workflow content is present.
