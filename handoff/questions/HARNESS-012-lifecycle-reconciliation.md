# HARNESS-012 — lifecycle boundary observed during activation

28 September 2026. GitHub source checks and independent review passed. Owned
desktop stop returned a verification error after the old launcher exited; the
subsequent known launch was retained as identity_unconfirmed. The old PID 21932
is absent; the new recorded launcher is 16876 and its owned server listens on
38883. No CompSet, shared coordinator or unrelated process was stopped.

HARNESS-012's exact source scope does not include the lifecycle implementation.
Continue that correction under the already active HARNESS-011 scope, which
explicitly includes yellow-harness* scripts and paired lifecycle tests. Add a
safe reconciliation of a known spawn against an absent predecessor, retaining
the old receipt. Do not delete receipts, adopt a guessed PID, bypass an identity
check, disable approval controls or retry an uncertain model dispatch.

The original census failure's diagnostic cause is not established. Recovery
must not silently weaken its validation. Read-only direct census of the new
known owner now succeeds. No full-harness readiness is claimed.
