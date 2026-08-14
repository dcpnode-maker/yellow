# REVIEW NNN — <slug>

**PR:** #NN · **Reviewed by:** Claude Fable 5 · **Date:**
**Verdict:** APPROVED | CHANGES-REQUIRED

## Battery
Reviewer ran `./setup.sh --db-only` on the branch: <paste result line>

## What's right
Name it specifically — this is how Codex learns the house style.

## Changes required
Numbered, each with file, line, and the *reason*. "Fix the query" is not a
direction; "line 88 filters tenant_id in the app instead of relying on RLS —
remove it and add the cross-tenant read test" is.

1. **`path/file.ts:NN`** — what's wrong → what to do instead → why it matters.
2. …

## Invariant check (reviewer asserts each)
- [ ] tenant_id leads every new index
- [ ] money is bigint minor units
- [ ] no UPDATE on insert-only tables
- [ ] occupancy writes go through the choke point only
- [ ] every cross-context effect emits an outbox event in the same transaction
- [ ] any new view carries `security_invoker = true`
- [ ] state transitions exist in STATE-MACHINES.md

## Decisions made during review
Copy each to `DECISIONS.log` (append, one line, with the rejected alternative).
