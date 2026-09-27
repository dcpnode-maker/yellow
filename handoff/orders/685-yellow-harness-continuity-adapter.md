# Order 685 — Yellow harness to bounded model-router adapter

Status: IMPLEMENTATION IN PROGRESS. Branch: `phase-0/yellow-harness-controller`.

## Intent

Connect the offline Yellow harness task/lease/proposal contract to the existing
`tools/build-continuity/` free-model proposal router without duplicating its
provider code. This is a development-tool integration, not a Yellow app release.
The owner remains the human-facing coordinator; a model's output is only a
proposal and cannot apply source edits or execute commands.

## Scope

- This order.
- New files under `tools/yellow-harness/continuity-bridge/**`.
- `tools/yellow-harness/README.md` for exact operating instructions/status.
- Independent review receipt at
  `handoff/reviews/685-yellow-harness-continuity-adapter.md`.
- Read, but do not modify, `tools/build-continuity/**` and the existing harness
  controller implementation.

## Requirements

1. Provide a non-resident local bridge that claims only approved `public_source`
   tasks, maps the exact manifest to the existing continuity task format, and
   converts a successful continuity proposal to the controller's exact
   `{files, summary}` result. Preserve `base_sha`, order and output scope.
2. Default CLI behavior is an offline preparation/validation preview; a live
   provider request must require an explicit opt-in flag, a configured official
   route and account key, and the existing continuity zero-price check. Do not
   add a paid fallback, bypass quota, rotate accounts, run a public listener,
   or launch a Kaggle session.
3. On failure, keep the lease/proposal state auditable; never mark a failed or
   truncated provider response complete. Avoid displaying lease tokens,
   account keys, prompts, credentials or full source in ordinary CLI output.
4. Reuse the continuity worker by a narrow adapter. Do not vendor its code or
   combine arbitrary upstream harness code into this order.
5. Prove with mocked provider output and hostile-input tests that a valid
   proposal can complete, out-of-scope files cannot, and default operation
   makes no network call. No external model calls are part of acceptance.

## Acceptance

- Local tests exercise claim, conversion, completion, failure and no-network
  defaults; existing harness and continuity suites remain green.
- Exact implementation diff remains within scope, contains no secrets, and
  records what is still unverified (real account, live model quality and cost).
- Independent non-implementing review precedes any provider activation.
