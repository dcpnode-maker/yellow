# HARNESS-012 — actual T3 GitHub connection

28 September 2026. Parent implemented and exercised the connection. Independent
nonimplementing reviewer: founder-approved `/root/harness_acceptance_luna`.

The existing official GitHub CLI login in the Windows keyring was referenced in
place. The workspace launcher rejects another account, host, credential store or
ambient token override. No token/password export, login, refresh, scope expansion
or approval-setting change occurred.

Actual command, from `D:/Yellow/harness/t3code`:

```powershell
node --experimental-transform-types scripts/yellow-harness-host-status.mjs
```

Exit 0 in 7.5355 seconds. The actual T3 server RPC returned the approved connected
account `dcpnode-maker`, host `github.com`, gh version 2.97.0. Model generation
calls: zero. Permission changes: zero. The read-only owner session lasts at most
two minutes and is revoked on completion. Ticket/token/raw provider detail are
not printed. The helper has no retry or alternate-credential fallback.

An earlier probe timed out: Effect expects a WebSocket factory, not the native
class passed directly. The repaired factory calls `new Constructor` only after
checking the exact loopback origin and `/ws` path. Its actual caller constructs
that fixed URL and adds only the bounded, ephemeral ticket.

The reviewer personally executed the workspace binding suite (10 passing cases)
and subsequently the socket/discovery delta:

```powershell
node --experimental-transform-types --test scripts/yellow-harness-host-status.test.mjs
```

Delta: 3 passed, 0 failed, 0 skipped; GO. Parent reran those 3 tests after
formatting. Focused formatting passed; lint passed with one synthetic-test
constructor-only-class style warning. Helper SHA256:
`1ada562d54c9544c061bfbae9b3ff3aae8639cb66f1308da9c76341acc73aac5`.
Reviewer did not make a live model/API/credential call.

The connection order is locally complete. No PR/push/merge, whole-harness
acceptance, worker connection, CompSet activation or Yellow DB referee is
established. `state.sh` remains unavailable because WSL `/bin/bash` is absent.
