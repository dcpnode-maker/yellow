# Question 080 — Order 059 proof did not immediately await worker promise

**Status:** CLOSED — temporary architect response recorded
**Order:** 059

Comparison with Order 056 found the established passing pattern immediately awaits the
worker through `Promise.race` and aborts from `onResult`. Order 059 instead stored the
worker promise, awaited `Bun.sleep(130)`, then awaited the worker; the exact-class
diagnostics showed zero consume attempts during that unawaited interval on pinned Bun.

May P6 use the established immediate `Promise.race([run, one-second failure timeout])`
pattern and abort after the first successful poll (therefore after the injected first
failure)? Keep exact one error, at least two attempts and `maxActive === 1`. Also revert
the disproven production loop changes to Order 056's proven `while (!signal?.aborted)`.
