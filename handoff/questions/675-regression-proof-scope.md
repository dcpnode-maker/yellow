# Q675 — Reservation regression proof after shared-control extraction

Resolved by primary implementation owner, 24 September 2026, before edits under D-91 routine test maintenance authority.

The wider board regression run reports three failures in two out-of-scope tests. Inspection shows source-marker assertions still look for pre-674 inline date formatting, inline travel controls and an old virtual-grid variable name. The actual 10,000-row filter/sort/equality/stability/500ms assertions pass before the stale marker fails. Do not remove behavioral proof or weaken the budget.

Admit tests/yellow-reservation-board-pages.test.ts and tests/yellow-reservation-board-attribute-performance.test.ts to Order675. Replace obsolete exact source fragments with executable shared-column date formatting and rendered shared-control availability checks. Keep pagination, failure bounds, exact expected IDs, stable ties, frozen result and performance threshold. Confirm both active grids still mount the shared controls and window the rows. Independent reviewer re-executes the updated tests. No product file scope expansion.
