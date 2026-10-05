# Order 603 — Local-worker context budget repair

## Objective

Turn the already approved proposal-only local inference foundation into a useful
microtask lane by fixing decision selection and reserving meaningful task-input space
inside the conservative 6 KiB phone packet.

## Scope

- `tools/local-ai/yellow_context.py`
- `tools/local-ai/test_yellow_context.py`

No model, phone, tunnel, credential, provider, product source, database, operating
system, Docker, public runtime, or dispatcher file is in scope.

## Required behavior

1. Context construction invokes the existing topic-matched decision-excerpt path and
   includes at most the already bounded matching decisions when present.
2. The phone contract retains the Ten Invariants, order scope, founder/authority
   boundaries, capability-request protocol, content hashes and secret rejection.
3. A phone packet with no optional file reserves at least 2 KiB of the 6 KiB limit for
   the explicit task and selected task inputs; boilerplate may not consume the whole
   budget.
4. Laptop and phone packets remain deterministic and content-addressed.
5. Oversized, binary, escaping, junction/symlink and credential-bearing inputs remain
   fail-closed. No limit is increased.
6. Tests prove decision inclusion, topic mismatch exclusion, retained guardrails,
   the reserved budget and 6,144/6,145-byte admission boundary.

## Acceptance evidence

- `python -m unittest tools/local-ai/test_yellow_context.py` passes.
- Existing local-AI focused tests pass.
- A real bounded packet for a current routine order is below 6 KiB with at least
  2 KiB measured remaining before optional task input.
- No model inference success or autonomous coding throughput is claimed until a
  separately timed worker run returns a useful proposal.

## Exclusions

- No autonomous terminal/browser/desktop access, direct model edits, API-key
  rotation, paid route, model download, sustained thermal load, or production use.
