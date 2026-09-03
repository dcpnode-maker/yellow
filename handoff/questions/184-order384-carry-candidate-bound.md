# Question 184 — Order384 carry-candidate bound

The Order384 response cannot be genuinely bounded by limiting only open business days:
one selected day may contain an unlimited number of unresolved discrepancy carry
candidates. Silent truncation would hide financial close work and is forbidden.

## Recommended policy

Return at most **500 carry candidates** for one selected source business day. The
single composed query reads at most 501 candidate rows; 501 makes the complete
workbench unavailable with an operational escalation, never a partial list. This is
large enough for exceptional hotel recovery work while keeping browser rendering,
memory and executable proof bounded.

Candidates remain eligible only through one exact ordinary `discrepancy.reported`
lineage for the selected day. The already-approved readiness snapshot owns detection
of safely attributed versus unknown discrepancy work; no missing date is inferred from
timestamps or clocks.

Founder decision requested: approve the recommended 500-candidate fail-closed maximum,
or state another exact integer.

