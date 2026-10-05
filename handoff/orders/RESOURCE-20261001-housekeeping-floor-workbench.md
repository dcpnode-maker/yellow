# RESOURCE-20261001 — physical room floor workbench

Codex laptop controller under the founder's floor/cube Housekeeping direction. Current Phase7 source remains authoritative. This is a bounded real UI slice over existing APIs; no new guest, voice, progress, occupancy or finance authority.

## Scope and lanes

- Initial implementer owns new frontend/yellow/src/housekeeping-floor-model.ts, workspaces/housekeeping-floor-client.ts, workspaces/HousekeepingFloorWorkbench.tsx, workspaces/housekeeping-floor.css, and meaningful tests/housekeeping-floor-model.test.ts and tests/housekeeping-floor-client.test.ts. After independently reproduced stale/scope/validation failures and the repair worker remaining pending_init, root takes ownership of those six files for repair as well as narrow App.tsx integration and canonical status/UI documentation. The initial worker is interrupted; no concurrent source writers. Do not edit accepted property-mode, portfolio, existing API/type definitions or other workspaces.
- Existing source discovery: E:/YellowWorkspace/Data/BuildArtifacts/yellow-housekeeping-floor-20261001-v1/discovery.md. Read actual current task/condition contracts, PROJECT.md, relevant decisions and source before implementation.
- Independent reviewer inspects and personally executes focused client/model proof and types after source freeze. Existing guarded task transition authority is reused, not replaced. No DB or migration change, no broad stage/reset/merge/deploy. Browser permission verification unavailable: do not bypass it or claim visual/touch/native acceptance.

## Required behavior

Group physical condition rows by their exact nullable text floor, without inferring floor from room number or sellable units. Floors are sections with accessible buttons for each room code/condition. Missing floor is Floor not recorded. Maintain floor selection and exact spaceId selection; room identity is not code alone. Show loaded rooms with recorded condition, never complete inventory/availability/check-in readiness. Null/non-numeric floors and multiple tasks per room remain valid.

Use the existing condition endpoint cursor contract, limit100 per page. Bound each read to supplied propertyId and current token, cache:no-store. Validate exact response and row identity, condition and timestamp without losing microseconds. Load more explicitly, validate and preserve nextCursor, reject cursor cycles/repeated room IDs/incoherent pages; late or changed property/token results must not enter the current scope. Declare loaded counts until exhaustion. Keep source failures explicit and retain prior evidence as stale rather than inventing empty or complete data.

Use existing current task reads up to200, validate detail shape and allowedActions from server. Task endpoint has no cursor; at200 show possible incompleteness, and absent room tasks say No task in loaded results. Do not hide a physical condition row due to no loaded task. Selected room drawer shows exact room condition/timestamp and matching task IDs/status, plus existing allowed Start/Complete/Verify labels; it emits a selected task/action to root's existing proposal/confirmation/transition flow. Root re-reads exact task before command. Do not add a generic room condition setter, synthesize tasks, infer work percentage, or auto-inspect.

The component accepts propertyId, getToken, disabled, refresh generation and onPrepare(task,action); owns only its new read model. No App globals or independent session authority. Disable navigation/actions during active operation as needed. Separate room selector and task action interaction. Refresh after accepted existing command; clear current selection/details on property/signout scope change; ignore delayed prior-scope reads. The condition board exposes no guests or reservation preferences: no broad reservation detail request under housekeeping authority.

Keep existing discrepancy workbench and its proposals/recovery. Integration replaces the flat room tile display with new floor view; preserve existing confirmed mutation flow. Progress/ETA/comments and purpose-authorized in-house room/preferences remain explicit subsequent backend contracts, as documented in RMS-BOOKING-SETTINGS-20261001.

## Proof

Functional tests for >100 rooms through cursor pages, exact room/task matching with duplicate room codes, nullable/text floors, microsecond timestamp retention, cycle/duplicate/malformed response rejection, max200 task uncertainty, read-only actions and delayed scope fencing. Test meaningful behavior, not source strings/implementation mirrors. Types/import boundaries and exact changed-source compilation are required. Source acceptance remains separate from browser interaction and native app delivery.
