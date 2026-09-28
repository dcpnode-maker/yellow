# Question 084 — Optional result callback short-circuits the poll itself

**Status:** CLOSED — temporary architect response recorded
**Order:** 059
**Evidence:** a disposable exact-server diagnostic reproduced both runtime workers and
created the projection cursor as soon as it supplied `onResult`. The production launch
supplies only `onError`. In `AvailabilityProjectionConsumer.run`, the expression
`options.onResult?.(await this.drainOnce())` does not evaluate its argument when
`onResult` is absent, so `drainOnce()` is skipped. This fully explains zero connection,
zero cursor and zero error. It also disproves D-212/D-213's promise-observation hypothesis.

May `run` always await `drainOnce()` into a local result and then optionally notify
`onResult`, with P6 gaining an exact behavioral regression that supplies no result callback
but still observes one bounded drain and abort? Keep terminal `.catch(...)` handlers as
unexpected-rejection reporting, preserve cadence/double opt-in, and restart focused,
standing and deployed proofs.
