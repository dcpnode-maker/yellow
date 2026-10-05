# Order 645 — Colleague workflow rehearsal contract

## Scope

- Add a deterministic, read-only/synthetic-only rehearsal contract for the colleague demo.
- Rehearse the complete PMS operating path:
  - arrival/check-in;
  - stay/service task;
  - cashier posting/payment prep;
  - housekeeping readiness;
  - group block pickup/rooming-list/wash;
  - checkout;
  - Overwatch-assisted routing.
- Show the exact confirmation phrase and prove every rehearsed step remains non-mutating in the public demo.

## Out of scope

- Real PMS database mutations.
- Journal/payment/document/occupancy writes.
- Gemini live smoke or public tunnel.
- Replacing governed command services.

## Acceptance

- `/api/v1/demo/workflow-rehearsal` returns a deterministic JSON rehearsal.
- Every workflow card in `/api/v1/demo/operating-journey` is covered by at least one rehearsal step.
- Every rehearsal step requires `CONFIRM YELLOW OPERATION`, records a synthetic-only result, and reports `realPmsExecuted:false`.
- The proof bundle includes the rehearsal as evidence while keeping readiness not share-ready.
- Tests prove route shape, workflow coverage, and safety posture.
