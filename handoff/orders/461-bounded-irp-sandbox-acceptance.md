# Order461 — Bounded real IRP sandbox acceptance

**Status: admitted source implementation, 2026-09-09.** The founder accepted the
four Phase7 closure priorities and directed Codex to finish them. Read-only review
of PR92 at `547cf3d335afdcec7ae4b7d05517a2153b342d0e` found the real ClearIRP
adapter and protected provider loader, but no one-invoice live acceptance command.
Existing proofs inject synthetic transport. Starting the application worker for
first acceptance would process every due submission in its configured database.

## Outcome

Provide one reproducible command that exercises the existing real adapter with
one explicitly authorized sandbox invoice, verifies the signed acceptance, and
independently looks up the same document. This closes the executable tooling gap;
it does not supply provider onboarding, credentials, certification, live acceptance,
retained Windows promotion or Phase7 completion.

## Scope

- `handoff/orders/461-bounded-irp-sandbox-acceptance.md`
- `scripts/run-irp-sandbox-acceptance.ts`
- `tests/irp-sandbox-acceptance.test.ts`
- `handoff/reviews/461-bounded-irp-sandbox-acceptance.md`

Work on the isolated `phase-7/sandbox-acceptance` branch from the exact PR92 head.
Preserve the desktop owner's current source freeze and retained runtime. No
production source, dependencies, migration, database, existing test or CI change
is admitted. If existing private APIs make this scope insufficient, record the
specific question before widening it.

## Requirements

- Reuse the existing protected provider loader, issued-source wire projection,
  direct adapter, signature verification and exact source-binding rules unchanged.
- Require explicit authorization acknowledgement, exactly one provider registration
  and `environment=sandbox`; refuse production or ambiguous selection before any
  network call. Read one explicit local synthetic-issued-source input with a byte
  ceiling and safe file handling. Never infer endpoints, trust keys, issuer, codes,
  tax identifiers or credentials from fixtures.
- Perform at most one submit followed by one independent authenticated lookup of
  that document. Bound time and attempts. No global worker, polling loop, automatic
  retry, database mutation, real guest input, plaintext secret output or raw signed
  artifact output. A failed/uncertain submit does not trigger another submit.
- Acceptance requires the existing verifier's matching accepted signed receipts
  and IRN/source/wire identity. Emit only a sanitized machine-readable receipt
  with the pinned source identity, sandbox environment, result and hashes needed
  to evaluate this bounded proof. Do not label synthetic tests as live acceptance.
- Importing the script is inert. The normal CLI uses real transport; tests may
  inject transport through an explicit internal test seam. No environment flag or
  CLI option silently switches a claimed real result to a mock.

## Proof and completion

Register focused tests for refusal before network, bounded single-submit behavior,
sanitized failures/output, matching accepted submit/lookup and rejection of identity
drift. Use synthetic data only. Run focused tests, typecheck and import-boundary
checks. A non-implementing reviewer must inspect and personally execute this proof.
No new broad suite or database recreation is warranted for this script-only work;
existing PR92 CI proof remains bound to its unchanged head. Any successor reviewable
PR still needs the repository's canonical database/referee gate on its own source.

Document the exact invocation and protected inputs here after implementation.
Real provider values, approved sandbox taxpayer/master data and actual external
execution remain explicitly unverified until a live sanitized receipt exists.
Publish the reviewed source as a bounded handoff; do not merge it into the retained
desktop source or claim the Windows/IRP closure gates passed from offline tests.
