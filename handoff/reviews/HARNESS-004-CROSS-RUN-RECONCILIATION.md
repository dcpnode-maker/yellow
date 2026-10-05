# HARNESS-004 — cross-run reconciliation guard

28 September 2026. Status: **ACCEPTED, NONACTIVATED FOUNDATION ONLY**. The parent
implemented this slice. It is a nonactivated adapter foundation, not live
transport, worker activation or full harness acceptance.

## Exact source and scope

External adapter: `D:/Yellow/harness/adapters/t3`, local commit
`14329a1c5fe314747fdf361f241eefa534b7e643`, successor to
`8f8746e86fdaa3fc12a8fcc642a166a3fa099280`.
Only adapter/receipt sources, paired tests and its README changed. The T3 UI
and bundle remain at `aff473c14717aa4dccfe229000bd584c0bab2e61`; Paperclip core
remains unchanged at `d554c4789ed3930f8a53ac9fdf6503b3187097da`.

The original run receipt cannot alone stop a coordinator from allocating a new
run ID after an unknown outcome. New transactional company/issue bindings block
fresh run IDs while a previous task receipt is nonterminal. Changed agent,
prompt or immutable base does not evade that barrier. Independent issues and
companies remain separate; a verified terminal result permits a separately
authorized future run. No job scheduling, admission authority or second lease
is added.

Observation failure now returns `execution_unsettled` with reconciliation
evidence rather than a generic thrown adapter failure. A blocked fresh run
returns `execution_reconciliation_required`, identifies the original receipt,
and cannot dispatch or interrupt it. Neither result claims task completion.
This barrier does not depend on Paperclip honoring a retry hint.

Existing receipt rows are preserved. An unbound legacy nonterminal receipt
quarantines new runs for its company: its task is unknown. Only its exact
immutable original request may backfill the task binding. There is no guessed
migration, deletion, provider replay or inferred settlement.

## Parent-executed evidence

The new regression expectations were run before the implementation:
`node --test adapter.test.mjs receipt-store.test.mjs` returned **29 passed,
4 failed**, including two provider dispatches for different run IDs on one
unsettled task. These failures are retained as the reason for the guard.

After the repair, the same suites returned **33 passed, 0 failed**. Additional
edge cases cover all five nonterminal states, all three terminal states,
independent tasks/companies, durable reopen, legacy preservation/backfill,
two concurrent worker-thread SQLite connections and blocked-run cancellation.

Final command, with the existing host-owned Git executable in `YELLOW_TEST_GIT`:

```powershell
node --test adapter.test.mjs receipt-store.test.mjs workspace-binding.test.mjs plugin-compatibility.test.mjs
```

Parent result: **51 passed, 0 failed, 0 skipped**, 12.11 seconds. This is
18 adapter + 22 receipt + 10 workspace + 1 actual pinned-loader cases. Earlier
unchanged T3 bridge24 and launcher8 evidence is not relabeled as a fresh run.
Current distinct focused foundations total **83**; not all were rerun here.
`git diff --check` passed. A first local commit failed for missing author
identity; the successful retry used the previous local commit's Codex identity
through command-local Git options, without changing global configuration.

Working-file SHA256:

- adapter.mjs: `5BA2D4D5DEC38EB6444F97D4431C4553B65709CCCC8782C0BB21CC9B02E02BEE`
- receipt-store.mjs: `E0E6D1F215400A56A7E738B97A672FD5E07A021EE87D298808052B9C6444D962`
- adapter.test.mjs: `E8EB57CA9AA20EB9900CFB98BA4460C78720B4E921C9D8E31C71623CE9C49C17`
- receipt-store.test.mjs: `2E3B6745A2CC2AAF54B78C73F9D45200C03A6A85E9BF244C87D4AD6B7823F30A`

## Independent proof and limits

Nonimplementing `/root/harness_luna_review`, GPT-6 Luna, continued the narrow
bridge review. It verified the clean frozen commit and personally executed the
exact four-suite command with `YELLOW_TEST_GIT` set: **51 passed, 0 failed,
0 skipped, exit0**, 11.892 seconds. Its four source/test SHA256 hashes matched
the values above. This is its personally executed proof, not the parent's run.

The reviewer also personally exercised abort while a second run's admission
was blocked, after the original run lost its observation. Its observed result:

```json
{"first":"execution_unsettled","blocked":"execution_reconciliation_required","oldReceipt":"accepted","newReceipt":null,"dispatches":1,"interrupts":0}
```

It found no accepted/uncertain same-company task replay through a fresh run ID.
Same-run changed issue input is rejected by the immutable request digest;
distinct tasks and companies are intentionally independent. The journal does
not prove issue-company ownership: that still requires the server-owned
resolver and fresh authorization at activation. Review accepts only this
nonactivated cross-run foundation, not live workers or authority boundaries.

The default loader remains inert. Authenticated live transport, fresh
lease/budget/entitlement authorization, effect-time worktree mutation/ownership
fencing, atomic remote cancellation/start, finite outcome observation,
accepted-artifact integration, free-only admission, Kaggle transport and native
Windows control remain open. Per-task guards rely on a reviewed server resolver
binding the real Paperclip issue; arbitrary input must not become authority.

No resident service was restarted or reconfigured. Current read-only host
inspection found T3 PID1544 on loopback38873, Paperclip15152 on38874 and
PostgreSQL23344 on38875; coordinator health is200/ok/ready. Fresh loopback API
reads returned five unassigned backlog jobs, three paused agents and zero runs.
The browser still shows its prior 07:14 snapshot, not a newly refreshed
execution proof. No model generation, provider request,
Kaggle start/stop, tunnel, production Yellow mutation, public PR or merge.

## Market-lane handoff

Founder explicitly requested that the compset/nightly-calendar/proxy lane move
to the shared conversation at
`https://chatgpt.com/s/cx_6ab9ce10fe948191a5f89d2da98fc6c0`. The browser verified
the title and matching conversation content: **Choose model for CompSet
pipeline**, existing local thread `01a0e51a-4eb4-7f53-adba-42ca00c5c5fb`.
The app message receipt confirmed delivery, and a compact status snapshot
showed an active turn acknowledging one-adult/30-day Dubai-time collection and
fresh coverage checks. That is handoff/acknowledgment evidence, not completed
market data. No duplicate pipeline or market code was added here.
