# Question 155 — Order-127 relay handler context

**Status:** RESOLVED BY D-399, D-401, D-402 AND D-403 — CORRECTION READY
**Order:** 127 · runtime database authority
**Branch:** `phase-5/runtime-database-authority-final`
**D398 rerun head:** `5255ac2`
**Related decisions:** D-392, D-395, D-398, D-399, D-401, D-402, D-403

## RESOLVED

## P5 affected-proof stop

The fresh D-398 relay rerun passed the static query-branch and set-wise-mark canaries,
plus all crash, polling and concurrent-dedupe cases, but the unchanged 10,000-row
backlog again timed out at 60 seconds. Each newly marked event still incurred separate
tenant setter, role-entry and role-reset round trips even when consecutive events had
the same tenant. The timeout left work active until teardown, which observed a closed
connection. The disposable project and volume were removed and Docker was stopped;
the run is not proof.

## D-399 exact correction contract

Within one existing bounded ordered/unpublished consumer transaction, already-marked
events and their handlers remain sequential in original order. The adapter may retain
`app_role` and the exact transaction-local tenant UUID only for immediately consecutive
events with the same tenant. Before the first handler and on every tenant change it
must enter an exact context: `RESET ROLE` when transitioning from an active context,
set the new transaction-local tenant UUID, then `SET LOCAL ROLE app_role`.

After every handler, before processing another event or advancing the cursor, one
exact verification must prove `current_user = 'app_role'` and the transaction-local
`app.tenant_id` equals that event's tenant UUID. Any handler exception, role/tenant
tamper, verification mismatch, RESET/set/role-entry failure or final RESET failure
rolls back the entire marks, handler effects and cursor movement. A final `RESET ROLE`
is mandatory on the success path before cursor advance/commit. Existing catch/rollback
containment remains fail closed.

Fresh permanent canaries must prove hostile handler role/tenant tamper rolls back every
mark/effect/cursor change and that mixed tenant order A/B/A never reuses A across B,
while preserving original handler order. The unchanged relay P6 must still prove
10,000 examined, largest batch 250, exactly 40 batches, RSS growth below 128 MiB and
completion below 60 seconds with normal exit.

## Exclusions

No handler batching, parallelism, reordering, skipped handler, cross-tenant context
reuse, context verification omission, new SQL capability/grant/table/interface, batch
limit change, timeout/RSS/assertion weakening, reuse of timed-out evidence,
self-review, merge, push, deployment or Cyber closure is authorized.

## D-401 independent-review correction

The first D-399 implementation and canaries stopped at independent static review.
Checking only the current tenant value cannot distinguish a hostile handler that
rewrites the same value session-scoped; that value can survive commit. The hostile
canaries also threw inside the handler, so they proved handler-exception rollback
rather than adapter detection. Finally, the actual server event pool retained Bun
prepared statements while exposing its reserved connection to handlers. A handler can
issue `DEALLOCATE ALL`, desynchronize Bun's prepared-name cache and make safe release
or single-backend eviction impossible, matching D-395's measured SQLSTATE `26000` and
pool-poisoning evidence. No database rerun is admitted from that stopped head.

The already in-scope `src/server.ts` event pool and every affected relay proof pool
must therefore use `prepare: false`. Ordered and unpublished consumption must share
the same sequential context/settlement boundary. After every non-throwing handler, the
adapter itself must detect wrong role, wrong tenant and same-value session-scoped GUC
tamper. Before a backend returns to its pool after commit or rollback, exact settlement
must prove `current_user = session_user = yellow_runtime`, null tenant context and no
prepared statements on the exact reserved backend; failed settlement follows D-395's
unprepared discard/recheck or pool fail-close contract. Hostile `DEALLOCATE ALL`, role,
wrong-tenant and same-value session-GUC canaries must exercise both ordered and
unpublished consumers, prove marks/effects/cursor rollback and a clean ordered retry,
and prove settlement on the exact backend rather than an arbitrary pool checkout.

This correction changes no role, grant, capability, migration, interface, batch size,
handler ordering, timeout, RSS threshold or allowed path. D-400 belongs exclusively to
Order 147; D-401 is the unique correction decision for this stopped review.

## D-402 implementable containment correction

Implementation inspection proved two D-401 proof demands impossible through the
admitted PostgreSQL/Bun interfaces. Inside one transaction, PostgreSQL exposes only a
custom GUC's effective value; the adapter cannot distinguish its own transaction-local
tenant UUID from a hostile same-value session-scoped write until commit, when rollback
of marks/effects/cursor is no longer possible. Bun's pool exposes no safe single-backend
eviction or replacement primitive; D-395 already proves closing a reservation poisons
the owning pool. Pretending otherwise, intercepting SQL text or adding an ungoverned
backend-termination capability is forbidden.

The exact security outcome is prevention and settlement. A non-throwing handler that
changes role or the effective tenant to a different value remains detectable before
cursor advance and rolls the transaction back. A same-value session-scoped tenant
write must be neutralized before commit by restoring the session tenant baseline to
null after final role reset; failure to scrub rolls the transaction back. After commit
or rollback, the adapter verifies runtime role, null tenant and no prepared statements
on the exact still-reserved unprepared backend before release. `DEALLOCATE ALL` must be
harmless on these `prepare:false` pools and the same clean backend remains reusable.

If rollback, commit, scrub, discard or exact settlement cannot complete, the entire
owning pool fails/closes and is not reused. Proof must not demand imaginary in-place
backend replacement: it creates a new explicit pool only to demonstrate durable state
rollback and clean retry after the failed pool is closed. Ordered and unpublished
consumers receive parity. The unchanged P6 thresholds and every D-399 ordering,
transition and atomicity rule remain binding. D-401 is preserved as stopped review
evidence; D-402 replaces only its impossible detection/eviction proof shape.

## D-403 bounded Bun fail-close correction

Fresh self-termination proof isolated an additional Bun 1.3.14 limitation. With a
physically dead `ReservedSQL`, releasing the reservation raises an asynchronous
`ERR_POSTGRES_CONNECTION_CLOSED` outside JavaScript `try/catch`; retaining it while
awaiting `SQL.close({ timeout: 0 })` leaves that close promise unsettled. Neither path
can be represented as a cleanly awaited backend disposal. Repeated focused runs proved
both failures before any cumulative evidence was accepted.

The event adapter must enter an irreversible failed state before initiating best-effort
whole-pool close. It attaches rejection handling immediately, never releases the dead
reservation, and does not await the known-unsettled physical close promise on the
consumer error path. Every later adapter operation that would reserve that owning pool
must reject synchronously from the failed state, so production cannot reuse the pool.
Publishing through an already supplied caller transaction remains independent.

Proof asserts transaction rollback, same-adapter rejection without raw-pool probing or
closing, and clean retry through a newly constructed pool. Process replacement is the
final resource-reclamation boundary for this terminal pool failure. Ordinary clean
settlement/reuse, ordered/unpublished parity and every P6 threshold remain unchanged.
