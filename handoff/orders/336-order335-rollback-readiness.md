# Order 336 — Order335 rollback readiness

**Status:** DRILL-PASSED-PENDING-DIFFERENT-FRESH-TIER3-D940
**Phase:** 7 — founder-local operational integrity
**Branch:** `phase-7/order335-rollback-readiness`
**Base:** `d3363bd` (Order335 review-withheld governance head)
**Live runtime:** `yellow-order335-app` / exact source `1551617`
**Rollback runtime:** `yellow-order333-app-rollback-d932` / exact source `86ec512`
**Risk tier:** 3 — one-at-a-time local runtime drill; fresh non-operating rereview mandatory

## Outcome

Resolve D938 by proving the retained Order333 rollback can start healthy and the
approved Order335 app can be restored healthy, with exactly one port3000 app at every
observable step.

## Exact scope

- capture exact live/rollback image,environment,network,bind,health and state;
- stop Order335, start the retained Order333 rollback and require healthy3000;
- stop Order333, restart Order335 and require healthy3000;
- record actual stopped exit semantics accurately: Bun reports polite SIGTERM even
  when Docker records139; rollback readiness is executable healthy restart,not exit0;
- verify environment,data,companions,ports unchanged and assign a different fresh Tier3 rereviewer.

## Forbidden

No simultaneous second local,no container/image/rollback deletion or recreation,no
schema/migration/seed/database/data/credential/status/permission/authority/post310
change,no merge,push or deployment.

## Definition of done

- [x] Retained Order333 starts healthy alone on3000.
- [x] Order335 returns healthy alone on3000 with exact preserved configuration.
- [x] Database/companions/ports remain unchanged.
- [ ] Different fresh non-operating Tier3 reviewer approves Order335 plus readiness.

## Operator evidence — D940

- Exactly one-at-a-time drill passed:Order335 stopped;retained Order333 started as
  sole port3000 owner and reached running/healthy/restart0/exit0 with exact health body.
- Order333 then stopped by polite SIGTERM and again records Docker exit139;its own log
  explicitly says `terminated by signal SIGTERM (Polite quit request)`. This is a
  repeatable stop-code mapping,not readiness failure.
- Order335 restarted as sole healthy3000/restart0/exit0. Live and rollback exact
  24-entry protected environment digests match;companions remained healthy. No
  container/image/config/data/credential/status/authority was deleted or recreated.
- D938's readiness uncertainty is executable-closed. A different fresh Tier3 reviewer
  must verify current truth and approve or withhold.
