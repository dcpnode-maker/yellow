# Order461 independent source acceptance — 2026-09-09

Reviewer: independent non-implementing `phase7_release_audit`. The reviewer did
not write the runner or its tests and did not use a provider, credentials, network,
database, retained runtime or production data.

## Exact reviewed source

The review used branch `phase-7/sandbox-acceptance` at admitted base
`f3f07174408d8376485ecda019011f4e764bd051`. Only the order append and the two
new implementation files differ from that base; `node_modules` is an untracked
local dependency link and is not reviewed source.

- `handoff/orders/461-bounded-irp-sandbox-acceptance.md` SHA-256
  `1727c170cd390bfc07d4b488cf2e9dade91b97fa3637c266230e7cdeeea3da50`;
- `scripts/run-irp-sandbox-acceptance.ts` SHA-256
  `d3b33800c7b95aa41ff9d699a968c6bef224c660b47c227c97435ac1648d8cf1`;
- `tests/irp-sandbox-acceptance.test.ts` SHA-256
  `38daa0eaca22656f07f1b219ab64c6ec6945099bad6c4c17a92974c4a39c9df0`.

The unchanged production seams used by the runner were also inspected and pinned:

- direct adapter `be7b4aeb05004c1b9172ff1de9994f782160b5131866bcf27fe1111e3515238d`;
- protected provider loader `ff96acd53b1bbd9b063193094c56dfef0a045d1171afb0b851360f6b0919f92b`;
- issued-source wire projector `d4b42f8be43ca228a40ede6ae75b4c6851d2d0a92b8f55d58c09fe5041a3da82`;
- signed-receipt binder `107b56557700b8728d250bb74d44b2031656bdc428f184caac6a1459061d066d`.

`git diff --check` is clean. No production source, dependency, migration, existing
test, CI or database file changed.

## Review findings

The runner requires both the exact CLI acknowledgement and the exact acknowledgement
inside one protected local input. On POSIX it opens with `O_NOFOLLOW`, checks the
opened handle against `lstat`, requires effective-user ownership and no group/other
permissions, detects mutation while reading, and enforces the 2 MiB ceiling before
exact JSON decoding. Windows ACL protection remains an explicit deployment
prerequisite because the runtime cannot attest DACLs.

The protected loader must return exactly one registration and one matching
presentation. Provider key, extension UUID and version must agree, the input must
name that provider, and the presentation must say `sandbox`; these checks complete
before the first adapter operation. Endpoint, protocol versions, encryption key,
issuer, trust bundle, response-code policy and credentials come only from that one
immutable loaded registration. The runner does not infer them from the synthetic
input or test fixture.

The first frozen test had one Windows portability defect: it expected POSIX mode
`0644` to be rejected on every platform. It also used a 25 ms injected deadline
while asserting that RSA authentication completed and the invoice POST began. The
builder made only scoped test repairs: the mode case now runs only on POSIX and
retains the documented Windows ACL prerequisite; the hanging-submit proof uses a
500 ms injected deadline inside its unchanged 5 second test bound. The reviewed
test hash above includes both repairs.

The runner loads once and retains one immutable adapter. This avoids a second-file
snapshot changing endpoint or trust policy between calls. Inspection of the pinned
direct adapter confirms that `operate()` calls `authenticate()` independently for
each operation. The focused peer proves two distinct authenticated sessions, one
invoice POST and one document lookup GET. Submit has no retry. Any throw, uncertain
or non-accepted submit stops before lookup. One absolute deadline and abort signal
bound both operations.

Success requires the existing adapter to return two `accepted_signed_v1` receipts.
The submit receipt is checked against sandbox, provider, document, source hash and
projected wire hash. Lookup must then match IRN, acknowledgement, document/source/
wire identity, both signed artifacts and their hashes, and all verifier issuer,
key and bundle identities. Output contains only the bounded summary and hashes; it
omits credentials, raw responses, decrypted data and signed artifacts. An injected
test transport is unambiguously labelled `synthetic_injected_transport` with
`externalProviderRoundTripEstablished=false`; the CLI exposes no mock option or
environment switch.

## Independent executable proof

Using Bun 1.3.14 (`0d9b296a`), the reviewer personally executed:

```text
bun test tests/irp-sandbox-acceptance.test.ts
5 pass, 0 fail, 32 assertions, 1 file, 1.317 s

bun run typecheck -- --pretty false
exit 0

bun scripts/check-import-boundaries.ts
Import boundaries OK: 194 TypeScript files scanned
```

The focused tests cover inert import; missing acknowledgement before file or
transport access; production and ambiguous-provider refusal; POSIX insecure input;
source-hash drift; matching signed submit/lookup; two fresh authentications; IRN
identity drift; sanitized lookup and thrown-transport failures; and timed abort with
no retry or lookup. All transport in this proof is an explicit synthetic seam.

An initial `bun run boundaries` wrapper invocation exited 127 because that package
script invokes `bun` by name and the isolated shell had no Bun on `PATH`. It ran no
project check. The reviewer then invoked the same boundary checker directly with the
pinned Bun executable and obtained the 194-file pass above.

Two additional black-box CLI refusals used an empty environment. No flag returned
exit 1, empty stdout and only sanitized `authorization_required` JSON on stderr.
The exact acknowledgement flag without an input path returned exit 1, empty stdout
and only sanitized `invalid_input_path` JSON. Neither invocation loaded configuration
or dispatched transport.

## Disposition and limits

The exact runner and test bytes above are independently **accepted for the bounded
Order461 handoff**. They close the executable one-shot tooling gap and provide a safe
command for a separately authorized sandbox acceptance.

No native Windows execution occurred in this review. No legitimate provider
onboarding packet, sandbox taxpayer/master data, credentials, external endpoint or
signed provider response was available or used. Therefore an actual external IRP
sandbox round trip remains unexecuted and unaccepted. This offline result does not
establish provider certification, database receipt persistence, the operator journey,
retained Windows promotion, Phase7 exit, ordinary merge readiness, or successor-source
CI/database/referee gates.
