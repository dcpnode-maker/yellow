# Order 627 — Mobile browser smoke proof

## Scope

- Add a zero-new-package Chrome smoke proof for the current demo shell.
- Start the local Bun server, load `/` in real headless Chrome at mobile and desktop
  viewport sizes, and evaluate the page for basic render/overflow conditions.

## Out of scope

- Public deployment.
- Pixel-perfect visual approval.
- Installing Playwright or adding new browser dependencies.

## Acceptance

- Script proves `/` renders in Chrome at 375×812 and 1440×900.
- Script fails on non-200 response, missing operating-journey copy, or horizontal
  overflow.
- Focused tests and TypeScript gates remain green.
