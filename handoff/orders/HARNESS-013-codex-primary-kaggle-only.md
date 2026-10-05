# HARNESS-013 — Codex primary; T3 for Kaggle orchestration

Status: DIRECTION RECORDED; native task-home migration not verified.

## Founder directive — 28 September 2026

"move back all codex to codex please we will use t3 only for codex orchestration of kaggle workers"

Codex is the primary workspace for general development, planning, implementation
and review. T3 is reserved for Codex orchestration of Kaggle workers. This
supersedes earlier T3-sole-UI directives in HARNESS-010/011 for general work.
Paperclip may retain its coordinator role within the Kaggle workflow.

## Scope

This order, AGENTS.md, append-only DECISIONS.log and handoff/LEDGER.md,
and handoff/CODEX-RETURN.md. Inspect existing Codex/T3 task metadata read-only.
Preserve original repositories, chats, credentials, worktrees and task receipts.
No direct SQLite edits, session fabrication, job dispatch, deletion or broad
process shutdown. Supported native task import, if needed, remains separate work.

## Observed restoration state

Codex's local project registry still contains Yellow at its original source root.
The original .codex sessions and session index remain present. The T3 workspace
launcher references the original CODEX_HOME and attaches repositories in place.
HARNESS-011's receipt records three unassigned backlog task homes with no turns
at receipt time; their current live state has not been verified.

General work can continue in Codex using the existing source roots and handoff.
No claim is made that native T3 chats were imported into Codex or that the T3
runtime enforces the new scope. Kaggle connectivity remains unverified.
