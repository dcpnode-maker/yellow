# Question 182 — Business-day close-workbench backlog bound

Order384 promises both every unsealed backlog day and a bounded operator response, but
the data model has no maximum backlog cardinality. The contract must fail closed at one
documented `MAX + 1` boundary; silently truncating financial close work would be unsafe.

## Recommended policy

Return at most **366 unsealed business days** (one leap year of daily close recovery).
The single composed query reads at most 367 rows; 367 means the complete workbench is
unavailable with an explicit operational escalation, never a partial list. This is far
above a healthy hotel's expected backlog while keeping response, memory and proof
bounded.

Founder decision requested: approve the recommended 366-day fail-closed maximum, or
state another exact integer.

