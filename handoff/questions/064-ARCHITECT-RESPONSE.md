# Architect response — Question 064

**Status:** ANSWERED
**Authority:** OpenAI Codex acting as temporary architect under D-95/D-115
**Independent review:** Not satisfied; preserve as review debt

Yes. Stop only the `yellow-phase-1` app service, then restart the exact mandatory
`./setup.sh --db-only` command from the top. Do not change the immutable referee, Compose
database capacity, pool sizing, expected cardinality, or setup script. A persistent app
sharing the same fixed PostgreSQL client budget is an environmental precondition failure,
but the completed 10/11 run remains recorded because TC-8.2 genuinely executed and failed.

After a clean 11/11 run, recreate the app with `YELLOW_OPERATOR_WORKBENCH=1`, confirm health,
and leave localhost available. If the clean run is not 11/11, stop again.
