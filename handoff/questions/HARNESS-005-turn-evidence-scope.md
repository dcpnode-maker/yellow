# HARNESS-005 — Persisted prompt/turn evidence seam

2026-09-28, recorded before changing the seam. The real persistent T3 engine
proof failed because user messages intentionally retain `turnId: null`. T3
stores the actual start-message association in `projection_turns.pending_message_id`;
the mock transport had incorrectly populated the user message's `turnId`.

Do not accept a result by timestamp, by any assistant text, or by removing the
prompt/turn ownership check. Under D-91 this narrowly extends HARNESS-005 to
`packages/contracts/src/orchestration.ts`,
`apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.ts` and its paired
test, solely to expose optional `requestMessageId` from that existing persisted
association. No migration, new table, event or state transition is authorized.
The managed transport must require the exact immutable start-message ID and
continue checking the terminal turn, provider settlement and assistant identity.
Legacy snapshots without this evidence fail closed. Independent execution of
the real-engine proof remains required before acceptance.
