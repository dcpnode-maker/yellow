# Question 064 — Order 055 referee connection budget

**Status:** ANSWERED
**Order:** 055
**Raised by:** OpenAI Codex, builder

The final post-UI `./setup.sh --db-only` run reached the immutable referee and returned
10/11. TC-8.2 issued exactly 90 of 100 invoice numbers while ten worker threads reported
PostgreSQL `FATAL: sorry, too many clients already`. The persistent local-review app was
running against the same PostgreSQL container with its ten-connection pool fully occupied.
The earlier pre-browser setup run on the same final database/schema baseline returned
11/11 before that pool had filled.

May the persistent app be stopped as an execution precondition, the complete setup command
restarted from the top without editing `setup.sh` or `tests/run_invariants.py`, and the app
restarted only after 11/11? This preserves the 100-client assertion and isolates its fixed
connection budget from the founder-review process.
