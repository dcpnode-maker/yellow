# Housekeeping selected-room progressive disclosure

Founder asks to complete researched hotel/STR screens using the approved simpler Yellow theme and flows. This is a presentation successor to the independently accepted e8f85bba housekeeping source, which remains undeployed. Astra's read-only recommendation of3 October finds an all-room duplicate progress panel above the existing floor cubes; remove that duplication before release.

## Exclusive scope

- frontend/yellow/src/workspaces/HousekeepingFloorWorkbench.tsx
- frontend/yellow/src/workspaces/HousekeepingProgressPanel.mjs and its .d.mts/.tsx adapters only if required
- frontend/yellow/src/workspaces/housekeeping-progress.css
- tests/housekeeping-progress.test.mjs and tests/housekeeping-progress-integration.test.tsx
- this order, scoped independent review, status/acceptance documentation and external candidate/phone packaging artifacts

No core model, scoped floor client, App routing/timezone, backend, database, dependency, grant, financial, occupancy, network/provider or live runtime changes. Preserve the source candidate and phone v3 plan as immutable historical evidence. The queued old staging chunk is not a compilation or release and must not trigger remaining predecessor jobs.

## Required behavior

Use the existing floor cubes and single selected-room drawer. Loaded conditions alone render no progress dump. Room selection reveals only that room's recorded task progress; choosing another room replaces it, Back/floor switch removes it, and reopening starts technical Details collapsed. Preserve selected-room context, multiple tasks and their exact identity internally, with one task row per task and existing canonical selection/detail/action controls. Avoid a duplicate task list and repeated room/condition headings. Use readable task labels; references, raw status/priority and exact supporting timestamps may be in native collapsed Details. Keep stale, unavailable, contradictory, timezone and partial-coverage blockers visible without expanding Details.

Only hasSnapshot-gated displayRooms/displayTasks are evidence. Carry global200-task completeness and condition cursor flags from the full snapshot before room filtering; selecting one task does not make the property's coverage complete. No percentages, staff names or predicted room ETA are inferred. No task in loaded results never implies readiness. Recorded deadline is property-local. Inspection does not authorize occupancy, sale or check-in.

Preserve existing fresh detail reads, changed-evidence refusal, server allowedActions, busy/idempotency preparation and client/property/token/401/403 fences. A fresh conflicting task detail must not appear beside an authoritative old list stage. Opening Details must generate no request or write. Use existing design tokens and44px target size; preserve keyboard focus through selected room, Back and floor controls.

## Acceptance and ownership

10R chat is the sole isolated candidate writer; laptop integrates/dispatches; Astra independently reviews. No nested workers or physical dispatch from child chats. Test actual mounted component with at least two rooms on two floors: no initial progress; correct selection/replacement; deselection/floor switch; collapsed reopen; foreign/orphan absence; immediate property/client/token clear and late-response rejection;401/403; pending/failed refresh and room disappearance; detail conflict and unchanged canonical prepare arguments; full200-task/selected-one partial coverage; clock/timezone teardown; keyboard interaction and Details no-network behavior. Retain meaningful original core/client/action/session assertions. Root/frontend strict types,211 boundaries and isolated Vite build remain required; no weakening scenario/deadline/assertion budgets. Source acceptance, physical compile, served-byte/runtime checks and actual desktop/narrow visual acceptance remain distinct.

Next financial-journey mapping continues as read-only evidence; this small layout correction takes precedence over monetary UI changes. Full18-part hotel/STR destination stays in the research document and execution plan.
