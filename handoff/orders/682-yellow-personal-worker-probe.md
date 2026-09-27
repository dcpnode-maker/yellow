# Order 682 — Personal worker capability probe

Status: IN PROGRESS. Branch: `phase-0/yellow-harness-controller`.

## Founder scope

On 27 September 2026 the founder stated that the current Kaggle notebook work is
personal and non-commercial testing. Use only synthetic/public fixtures, no real
guest or hotel data, no Yellow production credentials, no customer service, and
no commercial serving from Kaggle. Each collaborator uses their own account.
Do not describe the eventual product as already hosted or complete. A future
commercial deployment requires separate infrastructure and review.

## Final build context for an independent reviewer

The intended Yellow harness is a local-first development control plane for this
hospitality ERP: one visible task ledger and founder approval surface, a bounded
agent loop, a model/provider router, and replaceable local/GPU/TPU workers. The
high-capability model coordinates and reviews; cheaper models handle scoped
implementation. Workers receive exact commit and order references plus minimum
necessary public/synthetic inputs, return immutable proposals, and never gain
unreviewed write, credential, or administrator authority. Independent reviewers
must test state transitions and isolation before a remote transport, automatic
patch integration, or OS-level adapter is enabled. This order probes hardware;
it does not approve that final architecture or give reviewers a passing result.

## Scope

- This order file and new `tools/yellow-harness/probes/**` source/tests/docs.
- Inspect the founder's signed-in Kaggle notebook account(s), current quota and
  available accelerator. Run at most one short, synthetic hardware probe per
  accessible account, then stop the session. Do not attach Yellow source or keys.
- Record observed CPU/GPU/TPU name, memory, runtime limits, and failures. Compare
  model candidates later in a separate order with a fixed Yellow task rubric.

## Out of scope

- Always-on Kaggle workers, multi-account credential sharing, tunnels/listeners,
  hosted inference, model downloads, Yellow application deployments, paid compute,
  account sign-out or creation, and production data.
- Changing Order 681's queue protocol or claiming its pending independent review
  has passed.

## Acceptance

1. Probe source is deterministic, bounded, and cannot access private files or
   credentials; its local tests pass.
2. At least one actually accessible notebook runs the probe and visibly reports
   its accelerator, or the exact UI/account blocker is recorded.
3. Any started free session is stopped after the probe; no background worker is
   claimed to be running afterward.
