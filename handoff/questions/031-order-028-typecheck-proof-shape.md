# Question 031 — Order 028 P5 proof shape does not typecheck

Order 028's strengthened P5 runtime proof passed, but `bun run typecheck` failed at
`tests/inventory.integration.test.ts` because `evidenceBefore[0]` is correctly typed as
possibly undefined under `noUncheckedIndexedAccess`. May the proof bind the before and
after aggregate rows, throw if either is absent, and compare their complete fact/event
counts?

No production file or assertion meaning needs to change.

## RESOLVED

Answered by D-117 and `031-ARCHITECT-RESPONSE.md`.
