# Order 642 — Colleague demo proof bundle

## Scope

- Add a read-only machine-readable proof bundle for the current Yellow PMS colleague demo.
- Prove the implemented demo surfaces are connected to the same synthetic property and safety policy:
  - mobile shell/readiness;
  - simple server-owned hotel math;
  - front desk board;
  - group reservation block manager;
  - colleague operating scenario;
  - Overwatch confirmation-gated routing;
  - synthetic sandbox execution warnings.
- Keep the bundle truthful: it may summarize current evidence, but it must not mark the public demo share-ready while Gemini/public URL/governed real workflow execution remain unproved.

## Out of scope

- Editing migrations or production schema.
- Enabling real PMS mutations.
- Calling Gemini or external services.
- Cleaning unrelated local model, Docker, or continuity files.

## Acceptance

- `/api/v1/demo/proof-bundle` returns a deterministic JSON contract.
- The proof bundle reports `readyToShare:false` while the readiness contract remains `not_ready`.
- The bundle includes positive evidence for the current implemented PMS demo surfaces.
- The bundle includes explicit remaining gates for Gemini/public URL/governed real workflow execution.
- Bun tests prove the endpoint and the internal proof builder stay aligned with current demo contracts.
