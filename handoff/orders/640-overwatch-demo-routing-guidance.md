# Order 640 — Overwatch demo routing guidance

## Scope

- Make Overwatch responses operationally useful for the colleague demo by returning a read-only route/action suggestion.
- Cover arrival, checkout, cashier, room move, housekeeping, cancellation/no-show and readiness prompts.
- Preserve the hard rule that operational PMS actions require confirmation and still do not execute.

## Out of scope

- Calling live Gemini for operational prompts.
- Writing reservations, occupancy, folios, journals, payments, documents, statutory records or outbox rows.
- Enabling real PMS mutations.

## Acceptance

- `/api/v1/overwatch/message` includes `suggestedWorkbench`, `suggestedActionId` and `safetyNotes`.
- Operational prompts point to the appropriate demo route/action while remaining `executed:false`.
- Tests prove multilingual prompts still route locally and Gemini is not called for operational PMS actions.
