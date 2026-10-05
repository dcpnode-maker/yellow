# HARNESS-005 bounded preparation, native and lifecycle review

2026-09-28. Independent reviewer: `/root/harness_acceptance_luna`; requested
GPT-6 Luna medium, actual provider/model identity not independently reported by
the host. Parent implemented; reviewer made no source edits. This is not whole
product acceptance.

## Personally executed preparation and owned native proof

Adapter pin `4b23fb0e2e630182c090a77d47ad0bad03aab524`; T3 preparation pin
`aea2f6e0eb0ceed32c651a49f17ad2b5c744f217`.

- Adapter `node --test task-preparation.test.mjs`: 7 passed, 0 failed, including
  actual clean linked Git worktree, wrong base, retained-plan tampering, foreign
  ownership, explicit revocation and no coordinator mutation or model execution.
- T3 from `apps/server`: `../../node_modules/.bin/vp.cmd test
  src/auth/RpcAuthorization.test.ts src/mcp/HarnessToolkit.test.ts
  src/universalHarness/startJob.test.ts`: 3 files, 17 passed, 0 failed.
- With `YELLOW_NATIVE_ACCEPTANCE=owned-fixture-only`, the reviewer personally ran
  `../../node_modules/.bin/vp.cmd test src/nativeDesktop/windowsAcceptance.test.ts`:
  1 passed, 0 failed. One owned Electron fixture button incremented once;
  duplicate reconciliation did not increment again; revocation denied another
  action. It did not drive a user's existing window, model or account.

## P2 finding and independent closure

Reviewer found the websocket preparation handler checked access only at request
arrival. The host's optional callback defaulted to a no-op, unlike the MCP path.
Parent added a mandatory effect-time callback which rereads authoritative active
sessions and denies revoked, expired, changed-subject or missing write scope.

The first source fix commit `e0487919` had a typecheck error: expiry is a decoded
Effect DateTime, not a string. It is retained, not erased. Corrected final source
`c3ff9dad775bc85d7204ab96b6240820e6b29db7` passes server typecheck.

Reviewer personally reran at that final pin:

```text
../../node_modules/.bin/vp.cmd test
  src/universalHarness/preparationAuthorization.test.ts
  src/auth/RpcAuthorization.test.ts src/mcp/HarnessToolkit.test.ts
  src/universalHarness/startJob.test.ts
4 files, 19 passed, 0 failed. P2 CLOSED.
```

## Exact monitor process-identity seam

Parent source `66409d89` adds only the repository's inspected x64 monitor as an
owned desktop descendant. It requires desktop mode, exact name/path and SHA256
`8e92939e272a74483b2f08830dfaaefc5616af8ebfec036c7f67584b2b1bfb4b`.
No name-wide process allowance or cleanup is added. The monitor's console host
continues to require the existing exact Windows system path.

An initial Node-launched status failed because Windows PowerShell 5.1 inherited
PowerShell 7's module path and could not auto-load Get-FileHash. Parent replaced
that cmdlet with direct .NET SHA256/File.OpenRead, keeping the digest check.
Reviewer personally inspected the final code and ran the Node-launched status:

```json
{"state":"running","mode":"desktop","rootPid":19556,"processCount":8,"workingSetMiB":697}
```

Reviewer found no unsafe widening. Their 9/9 launcher/profile test run preceded
the .NET adjustment; the final Node status exercised the adjusted monitor guard.
Parent separately reran all 9 tests afterward: 9 passed, 0 failed. This bounded
review does not establish shutdown acceptance or new Paperclip lifecycle proof.

## Retained setup failures and boundaries

The owned synthetic profile lost explicit `approval-required` and the zero Git
poll override on disk. Startup correctly refused it. Parent restored only these
restrictive fields in the marked synthetic profile; no provider was enabled and
no real credential copied. `yellow-pilot.mjs check` then passed. The cause of
the earlier persisted-setting change has not been established.

New desktop observation: ready in 8.828 seconds, 760 MiB initially, later 697 MiB,
8 owned processes. Shared-page working sets and timing vary.

Still unaccepted: real model/worker connections, full assignment/reviewer workflow,
complete self-contained installer and overall project-build acceptance. Current
finite workers produce proposals; no automatic apply, merge or job closure.
