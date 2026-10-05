# PR-FIX-011 - Stale tests exposed by the real frozen install

## RESOLVED implementation scope

Four static/contract failures do not justify altering correct existing production
source: launchers already require migration100, board already returns market/source,
Windows state already counts markers case-insensitively, and active financial UI
already lives in its lazy module. The separate finance test selects a source end
boundary now appearing before its start boundary in App.tsx. PR-FIX-011 scopes
the exact oracles to actual source and retains all existing negative checks.
The sixth failure is the genuine 215300-byte emitted entry; it is not reclassified
as an oracle error or waived. It needs separate bundling proof.
