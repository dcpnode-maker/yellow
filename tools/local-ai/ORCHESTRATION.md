# ADR-595: One coordinator, three bounded local proposal workers

**Status:** Operating design for Order 595; transport acceptance is separate from
dispatcher acceptance. The policies below are not a claim that a scheduler exists.
**Date:** 2026-09-22
**Deciders:** Founder direction; Astra/Sol coordinator applies PROJECT.md and D-91.

## Context

Yellow has a CPU-only 15.35 GiB laptop and two independently connected phones.
The founder requires useful local work without granting local models autonomous
terminal/browser/credential access. PROJECT.md, the active order, one coordinator,
one integration writer, and independent personally executed high-risk review remain
authoritative. Local outputs are proposals, not executable instructions or proof.

The accepted transport evidence lives in Review 595: laptop/R1 onward, 10R/R4,
11R/R12-R13. A short authenticated reply establishes transport, not coding quality,
endurance, unattended reliability, or three-node throughput.

## Decision

```text
Founder / active scoped order
            |
    Astra mission coordinator <--- explicit handoff ---> Sol coordinator
            |                    (never two lease holders)
            +--- laptop qwen3.5:9b: deeper bounded proposal/audit
            +--- OnePlus 10R Qwen3-4B: small test/document proposal
            +--- OnePlus 11R Qwen3-4B: small test/document proposal
            |
    bounded capability_request -> proven native executor -> evidence -> worker
            |
    sole integration writer -> tests -> independent high-risk reviewer -> gates
```

Astra handles architecture, mission decomposition, difficult roadblocks and final
integration judgment. Sol handles routine coordination or explicitly takes over
when Astra usage is scarce. There is no automatic native model failover: record the
handoff and select/dispatch Sol through an available native Codex control. Both may
share account limits; changing models does not manufacture quota. If no authorized
coordinator is available, save the queue and stop dispatch. Do not imply that local
workers keep Astra alive after account capacity expires.

### Node map and admission

| Node | Model / loopback endpoint | Role and present limitation |
|---|---|---|
| Laptop | `qwen3.5:9b`, Ollama `127.0.0.1:11434` | One resident model, one request. 8,192-token context; do not run Docker concurrently. Previous machine-check history means supervised use only. |
| OnePlus 10R | Qwen3-4B, tunnel `127.0.0.1:11435` | R4 accepted supervised proposal transport; registry reconciled. Current calibration limits it to microtasks and requires an idle-slot check after timeout. |
| OnePlus 11R | `Qwen3-4B-Q4_K_M.gguf`, tunnel `127.0.0.1:11436` | R13 independently accepted; 8,192 context, four threads, one request. Dedicated SSH/key, ADB forward 18022. Reboot delivery and sustained workloads remain unproved. |

Nord5 is not admitted. RAM expansion is not physical RAM, and phones do not pool
RAM. Inference remains phone-loopback with authenticated laptop tunnels; no LAN
inference bind or hosted keys. Reconnect only after rediscovering the exact
authorized device, never by assuming an old ADB port or process PID is current.

Before each phone task, require authentic identity/health, reviewed guard source,
valid measured temperature strictly below 42 C and battery at least 20 percent.
The running guard stops at 45 C or above, or missing/invalid telemetry; resume only
below 42 C. This is sampled battery-temperature protection, not instantaneous CPU
thermal enforcement. Do not heat a device to prove the thresholds: use the reviewed
synthetic tests. Cool-down waits do not consume another inference attempt.

### Parallelism and resource modes

- Hard maximum: three external inference requests, one per admitted node. No nested
  local worker delegation, second resident model, or hidden same-node request queue.
- Start at two active inference lanes. Admit the third only after each has completed
  a representative bounded task with recorded tokens, latency, memory/temperature,
  and no timeout. This is a conservative policy, not a measured throughput claim.
- Inference mode: laptop 9B may run; Yellow Docker services remain stopped under the
  founder's existing bounded offline-build authorization. Phones may run separately.
- Proof/build mode: finish/cancel and confirm the laptop request stopped, unload 9B,
  then use the authorized proof environment. Serialize CPU/memory-heavy host proofs.
  Phones may continue proposal work if safe and their context is frozen.
- A single executor owns repository mutations. Independent read-only agents can
  operate concurrently; an independent reviewer owns an exclusive proof slot when
  personally executing resource-sensitive or high-risk tests.
- Native Desktop agent slots and external inference slots are different. This
  session exposes four total native agents including the coordinator; do not count
  the three HTTP workers as three more native Codex agents. Spark/cloud execution
  is not assumed available merely because an old review uses that label.

### Deterministic packet, task envelope and receipts

Use `yellow_context.py` as the single packet generator, not a second architecture
implementation. The coordinator reads full PROJECT.md, AGENTS.md, active order,
relevant decisions and selected skills before delegation. The worker packet contains
hash-linked bounded guardrail summaries plus only explicit task files or skill text
that passes the 6 KiB aggregate admission ceiling. Root owns generator and wrapper
integration. A summary never substitutes for the coordinator's full source reading;
if exact source does not fit, decompose or retain it in the native lane rather than
silently truncating worker input.

Attach this coordinator-owned envelope to each immutable packet:

```json
{
  "task_id": "595-node-purpose-001",
  "order": "handoff/orders/595-local-yellow-inference-orchestration.md",
  "coordinator": "Astra-or-Sol-task-id",
  "lease_epoch": 1,
  "node": "laptop-or-oneplus10r-or-oneplus11r",
  "role": "proposal-only",
  "base_commit": "exact-HEAD",
  "bundle_sha256": "exact-packet-hash",
  "input_hashes": {"explicit/path": "exact-working-bytes-hash"},
  "allowed_reads": ["explicit/path"],
  "allowed_writes": [],
  "expected_artifact": "test-matrix-or-scoped-proposal",
  "max_attempts": 2,
  "max_output_tokens": 768,
  "deadline_seconds": 180
}
```

HEAD alone cannot identify this dirty tree: retain exact input hashes and record
any changed inputs before integration. Outputs go to separate private task
directories under `.git/yellow-local-ai/`, never overlapping worker histories.
No credentials, customer data, broad directory dumps or arbitrary recursive reads
belong in a packet. Secret-pattern rejection is defense in depth, not proof that
all secrets have been detected; coordinator allowlisting is still mandatory.

Record node/model identity, packet/task hashes, lease owner/epoch, dispatch time,
attempt number **before** the call, deadline, actual prompt/completion tokens,
response/artifact hash, exit/status and failure reason afterward. This receipt
contract is a coordinator procedure until a tested durable dispatcher implements
it. Existing context manifests are not dispatch receipts or a coordinator lock.

### Budgets and no-stall contract

| Budget | Laptop | Each phone |
|---|---|---|
| Total model window | 8,192 tokens | 8,192 tokens |
| Aggregate rendered input, including templates/history/files/task | At most 6,144 tokens | At most 6,144 tokens; prefer smaller single-file tasks |
| Output | Default 768, hard cap 1,024 tokens | Default 512, hard cap 1,024 tokens |
| Wall-clock attempt deadline | 360 seconds including cold load | 180 seconds |
| Attempts | Two total: initial plus one justified repair | Two total: initial plus one justified repair |

The remaining window is reserved for template overhead/guard margin; do not rely on
automatic context truncation. The generator and wrappers now use a conservative
6 KiB aggregate UTF-8 ceiling for both laptop and phone microtasks, counting packet,
prompt and explicit Aider files before dispatch. This is deliberately smaller than
the token policy because no exact local tokenizer admission API is proven and
template overhead remains reserved. If admission cannot be established, return a
budget/capability blocker to the coordinator; narrow optional inputs or route the
task to a capable native lane. Never omit the constitution/order to force admission.
An oversized contract is an adapter acceptance failure, not a reason for endless
prompt retries. The limits above are initial safety policy, not measured speed.

Use stateless requests and `/no_think`/the tested no-thinking template option for
phone workers. No tool schemas, shell executors, automatic patch application,
browser, subprocess plugins or credential environment is handed to a local model.
Direct local inference is the preferred proposal transport. `local-implement`
and Aider's write-enabled harness are legacy experiments, not the default execution
path authorized by this policy. A prompt or worktree alone is not an OS sandbox.

On a missing capability, the worker returns only:

```json
{"capability_request":{"task":"595-node-purpose-001","command_or_tool":"exact bounded action","inputs":["explicit paths or artifact hashes"],"expected_artifact":"exact evidence needed","risk":"read-only / scoped mutation / high-risk; reason"}}
```

The coordinator validates current scope, target identity, required skill and risk;
it rejects arbitrary commands or invented access. A proven Astra/Sol/native Codex
executor performs only that action and returns a hashed artifact plus actual result.
No local worker self-escalates. Credentials/spending/missing authority return to
the founder, never to another model. One unresolved capability request per task;
release its inference slot immediately and mark `waiting-capability`, so other
independent tasks run. Revalidate packet inputs and lease before a bounded resume;
resume still counts against the two-call budget. If the native action cannot be
completed within the current turn, persist the exact blocker instead of spinning.

Timeout/disconnect: stop dispatch to that node, request bounded cancellation and
verify server idle before reusing it. A client timeout does not prove generation
stopped. Never kill broad processes or retry a possibly active generation. Preserve
the failed attempt and escalate after the second failure. Bad credentials/401 or
authorization/403 quarantine the node until inspected; no key cycling. Busy/429
means drain/backoff, not concurrent retries. Thermal refusal is a waiting state.
Unknown outcomes remain unknown; never relabel them success or silently discard.

### Lease, writing and independent acceptance

For today's coordinator-driven workflow, retain one visible ownership record and
explicit handoff message with outstanding tasks, receipts and writer/proof owner.
Astra stops dispatch/writes before Sol acknowledges takeover; time passage alone
never authorizes a second coordinator. Automated multi-process failover requires
a tested exclusive lock/fencing implementation and is **not present today**.

Proposal workers have no repository writer lease. The native integrator verifies
base/input hashes and the entire diff, then applies only order-scoped changes.
If a harness is ever separately admitted for execution, use one registered worktree
per task and a distinct branch/output directory, no shared .git/index manipulation,
no auto-commit/merge, and enforce the filesystem/tool boundary independently of
the model. Current Aider's explicit-file checks do not establish that boundary.
Do not add dirty parent changes wholesale to a worktree or overwrite user edits.

The non-implementing reviewer personally runs high-risk proofs; another model's
opinion and pasted implementer output are insufficient. Tooling acceptance does not
waive `setup.sh --db-only` and `11 passed, 0 failed` before a reviewable PR. Never
merge your own PR or claim a product phase is complete from worker transport tests.

## Options considered and consequences

| Option | Result |
|---|---|
| Native coordinator + three proposal-only local endpoints | Selected: uses accepted transport, retains tool authority and independent gates; needs explicit packets/receipts and coordination. |
| Every local model runs Aider/Codex tools autonomously | Rejected: conflicts with founder proposal-only direction; tool reliability/sandbox claims are not established. |
| Always-on automatic Astra/Sol/free-provider cascade | Not currently implemented or proven; risks split ownership and quota/credential confusion. Hosted credentials remain out of this local design. |

More local analysis can run in parallel, but integration/proof remains serialized.
Small models can draft tests and spot inconsistencies; they do not replace
architecture, security, fiscal/RLS/finance judgment or independent executable proof.

## Exact next queues (after already-dispatched parent audits finish)

These are queue recommendations, not dispatched or completed work. Freeze the
listed inputs after root finishes the packet implementation; send only the narrow
relevant excerpts/files that pass aggregate admission. Each task returns a proposal,
not edits or invented test results.

1. **Laptop `595-laptop-packet-audit-001`:** inspect frozen `yellow_context.py`
   and its tests against the packet contract. Return at most five concrete
   counterexamples with exact affected functions: determinism, path/symlink escape,
   secret inputs, dirty-input hashes and oversized aggregate context. First useful
   output is a prioritized negative-test matrix, not another implementation.
2. **10R `595-10r-handoff-cases-001`:** after registry/guard admission is reconciled,
   receive only the capability-request/envelope contract and synthetic examples.
   Produce six cases: permitted read, out-of-scope write, credential request,
   missing skill, stale artifact and malformed request. For each return required
   coordinator disposition and one expected receipt field. Do not repeat the
   parent's currently running Order595 audit.
3. **11R `595-11r-resume-cases-001`:** receive budget/failure/lease contract and
   synthetic task states. Draft six transition cases: warm success, unavailable
   tunnel, hot guard, timeout with unknown server state, resumed stale packet and
   coordinator handoff. Return state/slot/attempt disposition. This is its first
   representative useful workload; record measured latency/tokens/temperature.
4. **Native integrator:** deduplicate the three artifacts; implement only accepted
   scoped gaps, personally execute focused tests, and freeze exact source hashes.
   Fix the fake Android test's fixed-port collision before running it unchanged
   against a live 10R tunnel. Reconcile registry only from fresh identified evidence.
5. **Independent native reviewer:** inspect final packet/adapter authority boundary
   and personally execute negative tests plus a one-request-per-node bounded
   proposal/capability/resume proof. Only then label dispatcher operation accepted.

## Acceptance still outstanding

- Complete aggregate-token/byte admission and proposal-only adapter enforcement;
  packet/wrapper source changes by root are not accepted merely by existing here.
- Actual deterministic task dispatch, capability handoff/resume, timeout settlement
  and cross-node bounded workload receipts; no three-node throughput claim yet.
- Fresh 10R guard identity/acceptance and registry reconciliation.
- Independently tested durable queue/lease only if automation is implemented; today
  the native coordinator performs those duties explicitly.
- 11R reboot delivery and unattended endurance remain deliberately unclaimed.
