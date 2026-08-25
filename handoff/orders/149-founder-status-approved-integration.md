# Order 149 — Show approved post-127 integration status

**Status:** READY — D-413
**Phase:** 5 · founder visibility
**Branch:** `phase-5/founder-status-approved-integration`
**Base:** `4748ded0868a35434bbf9bbfd10b87294dc73301` — closed Order 148; PR #78 open and unmerged
**Risk tier:** 2 — authenticated read-only founder presentation and evidence wording
**Owner:** Codex implementation; independent non-implementing review required before local stack replacement or PR

## Outcome

Replace the obsolete local status snapshot that still calls Order 127 incomplete with
one exact snapshot of committed evidence: Order 127 independently approved by D-407,
Order 148 independently approved by D-412, and PR #78 open but unmerged. Preserve the
separate contiguous review boundary at Order 91 and every live-health semantic.

## Admission facts

- D-407 approves Order 127 without claiming broader Cyber closure.
- D-412 approves Order 148 at exact candidate `e6080ca6...`; closure commit `4748ded`
  records PR #78 open against unchanged target `952478d1...`, with no merge/deploy.
- D-408 approved the four-file Order-147 presentation at exact executable `cafb5d3`.
  Those four blobs are presentation provenance, not ancestry: this order may reproduce
  their reviewed current-work UI before updating only the now-obsolete evidence text.
- `INDEPENDENTLY_REVIEWED_THROUGH_ORDER` remains 91. D-407 and D-412 are explicit
  non-contiguous approvals and must never inflate that generated boundary.

## Scope

- `src/project-status.ts`;
- `src/http/operator/index.html`;
- `src/http/operator/operator.js`;
- `tests/founder-status.integration.test.ts`;
- this order;
- additive D-413 and Order-149 ledger records; and
- `handoff/reviews/149-founder-status-approved-integration.md` plus additive approval
  metadata only when written by the independent reviewer.

The HTML and operator script must be byte-identical to approved Order-147 executable
`cafb5d3`. Product snapshot and test may differ only for Order-149 identity and exact
D-407/D-412/PR-78 evidence.

## Required behavior

1. `latestBuiltOrder` and `currentOrder` are exactly 149; phase count remains 13,
   active phase remains 5 and snapshot review-through remains derived and exactly 91.
2. Recorded work states Order 126 approved by D-391, Order 127 approved by D-407, and
   Order 148 approved by D-412 with PR #78 open/unmerged.
3. The authenticated API and same-origin UI render that same recorded snapshot.
4. No wording claims merge, deployment, live completion, finance activation, broad
   runtime-DML closure, wider Cyber closure or contiguous review beyond Order 91.
5. Existing health/auth/scope/property/error behavior and secret redaction remain exact.

## Proof

- exact four-path scope and Base hygiene;
- byte identity of HTML/JS with `cafb5d3`;
- focused founder-status suite, standing tests, typecheck and 64-file boundaries;
- authenticated database-backed status proof and HTTP-served asset/status proof;
- frozen install, licence policy, dependency audit and image pins;
- fresh `./setup.sh --db-only` with `11 passed, 0 failed of 11`;
- independent non-implementing review of the exact candidate before replacing the
  local workbench stack or opening a PR.

## Forbidden

- Migration, schema, seed, referee, auth, operator command, worker or product behavior change.
- Editing generated review coverage or claiming D-407/D-412 are contiguous coverage.
- Importing Order-147 governance/ancestry, finance drafts or any file beyond Scope.
- Credential disclosure, deployment, production mutation, self-review or self-merge.

## Definition of done

- [ ] Exact approved Order-147 presentation blobs are reproduced for HTML/JS only.
- [ ] Snapshot/test encode D-407, D-412 and open/unmerged PR #78 conservatively.
- [ ] Focused, standing, static, security and fresh referee proof pass.
- [ ] Independent reviewer approves the exact candidate.
- [ ] Local workbench is replaced only after approval and returns HTTP 200 with the
      approved snapshot; disposable proof resources are removed.
