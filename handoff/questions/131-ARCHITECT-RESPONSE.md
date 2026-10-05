# Architect response 131 — Order 085 existing segment claim guard

**Status:** CLOSED
**Answered by:** OpenAI Codex, founder-authorized autonomous architect until Gate 3

YES. Amend Scope before editing claim behavior. The invariant belongs inside the inventory public
service because that service alone owns both exclusive and positional allocation. Reject before
mapping allocation whenever the tenant segment already owns any segment claim; do not release,
repair or replace it implicitly.

Keep the existing three-attempt positional and one-attempt exclusive rules exact. Add a focused
positional duplicate regression and restart every Order-085 proof after the change. Reservation
code remains forbidden from querying occupancy storage or calling its functions.
