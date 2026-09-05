# Order437 — Reconcile updated main into the development branch

**Status:** ACTIVE — branch integration only; no main product merge
**Date:** 2026-09-05
**Phase:** Delivery infrastructure; no phase advancement
**Authority:** D1334, D1335, founder's current GitHub and continuous-build requests
**Risk:** Documentation/test merge resolution; production source must remain byte-identical

## Evidence and outcome

After PR81 merged as main `2e55b88488300b1d4efb551f8ec79698dbb52dad`, PR80 at
`0c8d467b8ec5a44badea7490c4706e41dab8c37d` reports CONFLICTING and has no
status-check run for that head. The original documents intentionally have different
main snapshot notices and development source-relative links. Merge main ancestry
into the development branch, resolve that representation difference, and restore
PR80's executable CI without moving unapproved product code to main.

## Exact scope

- This order, DECISIONS.log and handoff/LEDGER.md: root-owned append-only receipts.
- Git merge ancestry for main `2e55b884` into the admitted development base.
- Only these 20 documents may be resolved against development:
  README.md, START-HERE.md, START-HERE-WINDOWS.md, USAGE.md, BUILD-PLAN.md,
  handoff/ROADMAP.md, docs/AI-ARCHITECTURE.md, docs/CONTRACTS.md, docs/DESIGN.md,
  docs/DOMAIN-MODEL-V1.md, docs/EXTENSIONS.md, docs/FEATURE-REGISTER.md,
  docs/PROJECT-MAP.md, docs/UI-SPEC.md, docs/architecture/REGIONAL-PACKS.md,
  docs/architecture/VOICE-RMS-PLAN.md, docs/design/STAFF-JOURNEYS.md,
  docs/integrations/OTA-CONNECTIVITY.md, docs/research/README.md,
  docs/research/STAFF-STR-ECOSYSTEM-2026-09.md.
- tests/rate-quote.integration.test.ts: retain the current development fixture's
  clock-relative dates, runtime-role resolution and exact assertions. Main's
  Order436 fixture is a repair for its older source baseline, not a replacement
  for development's independently evolved test.

Any other content difference requires an explicit scope amendment first. No
product, migrations, schema, seed, dependencies, permissions or workflow edits.

## Execution and acceptance

1. Reuse the existing clean Order432 secondary checkout under a new integration
   branch; preserve both existing branches. No new clone/worktree or dirty-main edit.
2. Root commits admission; integration starts from that exact development SHA.
   Confirm no active CI handle before normal publication; do not cancel a run.
3. Preserve current development content for the 21 allowlisted files. Main's
   snapshot notices must not falsely describe development code as older main code.
   Main itself remains unchanged and keeps its honest disclosure notices.
4. Prefer an ordinary merge with a precise recorded parent pair. Verify the result
   has identical tracked content to the admitted development parent; ancestry is
   the intended change. No blanket destructive reset or working-tree overwrite.
5. Run typecheck, focused quote/provider tests and diff checks. Expected local DB
   skips are not database proof; the complete new GitHub run remains mandatory.
6. Root inspects and fast-forwards the active development branch to the integration
   result only after checking its worktree for overlapping edits, then pushes the
   development branch normally. Do not merge PR80 into main or force push.
7. Verify PR80 mergeability and the exact new CI handle. This does not approve
   native issuance, Order434, local runtime refresh or any product phase.

All commands use native Windows tooling while WSL crash dumps recur. No database
or local app restart, dependency install, cleanup deletion or retained-data change.
