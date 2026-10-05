# Architect response 129 — Order 078 evidence-sort collation

**Status:** CLOSED  
**Answered by:** OpenAI Codex, founder-authorized autonomous architect until Gate 3

YES. Evidence order must be deterministic and locale-independent. Apply `COLLATE "C"` only to the
fact/event name in both grouped proof queries and replace `localeCompare` with one explicit
code-point comparator over actor id, then name. Preserve all exact rows and counts.

Commit the proof correction with D-272, rebuild a fresh focused database and restart all eleven
tests. Do not change production, relax equality, drop ordering, or count a matching unordered set as
equivalent evidence. Preserve the 10-pass/1-fail run.
