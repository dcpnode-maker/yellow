# Order 644 — Mobile property configuration surface

## Scope

- Surface the synthetic property configuration inside the mobile-first demo shell.
- Keep the existing glass/neon visual system and add compact cards for:
  - room inventory;
  - rate/package setup;
  - MSG/MS/source setup;
  - cashier/safety setup.
- Link the visible shell to `/api/v1/demo/property-config` and `/api/v1/demo/proof-bundle`.

## Out of scope

- New visual redesign or image generation.
- React/frontend rewrite.
- Migrations or real PMS mutations.
- Public tunnel/Gemini live smoke.

## Acceptance

- Root `/` renders a visible “Configured property” section.
- The section uses the property-config read model rather than hard-coded duplicate values.
- Existing CSP constraints remain: no inline scripts or inline styles.
- Tests prove the root shell links to the config/proof endpoints and renders key property configuration facts.
