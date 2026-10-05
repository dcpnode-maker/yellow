# Order464 — root implementation acceptance

2026-09-09. Implementer: /root/phase1_6_gap_map (GPT5.6 Terra).
Reviewer/integrator: /root. Ordinary read-model/UI scope, not a new authorization
boundary or database mutation.

Personally inspected reservationDetail: one existing write-scope/property query
drives the three status predicates; canManageAlerts still additionally requires
the alert service. Read grants, not-found concealment, folio eligibility, nine
statuses and command-side rechecks are preserved. Client change is one label.

Personally executed:

```
bun test tests/operator-reservation-action-disclosure.test.ts tests/operator-reservation-read-surface.integration.test.ts tests/operator-assets-security.test.ts tests/operator-founder-reservation-journey.integration.test.ts tests/operator-reservation-lifecycle.integration.test.ts tests/operator-reservation-alerts-ui.test.ts
34 pass / 6 existing DB-gated skips / 0 fail / 351 assertions
bun run typecheck — pass
bun run boundaries — 198 files, pass
```

The four new adapter tests execute all status/action combinations with an
authorised writer, read-only and other-property actors, read concealment,
no lifecycle commands from detail and direct modify denial. No new real-DB
claim is made. Full current mixed-file identities at acceptance:

- operator.ts:7b04661591e319c7781e76a6d240ed92f6e842ef552c0b5e9fbe18c50eaca10d
- operator.js:902efd17daa7e8298e022141c3d8609cf821d2f7ed6b9c54a8b623afe2830073
- action test:c59aaaad089ad10fa1dc69539468d12cb6c253cae92e365d31470deba3a55735

These are mixed working-file identities, not permission to publish paused445
or unrelated hunks. Source built; publication and live integration remain separate.
