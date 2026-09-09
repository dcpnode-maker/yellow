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

## Reproducible invocation and input

The command has no mock flag. It uses the existing protected provider manifest
loader and global `fetch`:

```sh
export YELLOW_INDIA_IRP_PROVIDERS_FILE=/absolute/protected/path/india-irp-providers.json
export YELLOW_IRP_SANDBOX_INPUT_FILE=/absolute/protected/path/authorized-synthetic-invoice.json
bun scripts/run-irp-sandbox-acceptance.ts --acknowledge-authorized-sandbox-taxpayer
```

On the retained native Windows host, use PowerShell with the installed native Bun
runtime; do not route this acceptance through WSL or bash:

```powershell
$env:YELLOW_INDIA_IRP_PROVIDERS_FILE = 'C:\protected\yellow\india-irp-providers.json'
$env:YELLOW_IRP_SANDBOX_INPUT_FILE = 'C:\protected\yellow\authorized-synthetic-invoice.json'
bun run scripts/run-irp-sandbox-acceptance.ts --acknowledge-authorized-sandbox-taxpayer
```

On POSIX, the input must be a regular, non-symlink file owned by the effective
runtime user with no group or other permission bits (for example, mode `0600`).
It is snapshotted through its open handle and limited to 2 MiB. The provider
manifest and credentials retain the separate protection rules implemented by
`india-irp-provider-configuration.ts`. Windows deployments must independently
protect all three files with appropriate ACLs because Node does not expose a
trustworthy DACL inspection API.

The input is exact JSON: duplicate or additional members are rejected, UUIDs and
hashes are lowercase, and `sourceContentJson` is the exact issued-source JSON
whose SHA-256 is `documentSha256`.

```json
{
  "version": 1,
  "authorizationAcknowledgement": "I confirm this is an authorized synthetic invoice for the configured sandbox taxpayer",
  "tenantId": "00000000-0000-4000-8000-000000000001",
  "attemptId": "00000000-0000-4000-8000-000000000002",
  "documentId": "00000000-0000-4000-8000-000000000003",
  "documentSha256": "64-lowercase-hex-characters",
  "providerKey": "the-single-configured-sandbox-provider-key",
  "sourceContentJson": "{\"Version\":\"1.1\",\"...\":\"exact issued source fields\"}"
}
```

This illustrative JSON is not executable external-provider data. The authorized
sandbox invoice must use taxpayer and master data approved for that provider
account. The exact manifest, protocol-configuration and five-field credential
schemas are recorded in
[Q207](../questions/207-signed-fiscal-receipt-integration.md#protected-deployment-composition-contract).
Before an external run, configure the authorized sandbox account/taxpayer and its
credentials, plus the actual provider values required by the existing adapter:
`apiBaseUrl`, `encryptionSpkiDerBase64`, `issuer`, `trustBundleJson`, `sekEncoding`,
`tokenExpiryUtcOffsetMinutes`, `definitiveRejectionCodes`, `duplicateCodes`, and
`notFoundCodes`. Obtain these values from the legitimate onboarding packet; the
synthetic test fixtures are not account configuration. The primary public protocol reference is the
[ClearIRP direct API specification](https://assets1.cleartax-cdn.com/finfo/wg-utils/retool/c734c4fb-f542-406a-8d93-ae80cbed534a.pdf);
its placeholders do not supply account-specific onboarding values.

The runner projects and pins the wire before transport, submits once, then uses
the same immutable adapter registration for a new authenticated lookup. Success
requires two matching verifier-accepted signed receipts and emits sanitized JSON
only. The receipt establishes this bounded external provider exchange; its fixed
claim fields expressly do not claim provider certification, database persistence,
or an operator journey. Offline proof uses an explicit injected transport and is
labelled `synthetic_injected_transport` with
`externalProviderRoundTripEstablished=false`.

Focused offline proof:

```sh
bun test tests/irp-sandbox-acceptance.test.ts
bun run typecheck
bun scripts/check-import-boundaries.ts
```
