# RELEASE-20261001 — independent PostgreSQL image-index review

Verdict: **accepted for bounded source publication** under the finalized order and
question. Official index identity, unchanged native AMD64 bytes, scoped checks and
the canonical referee pass. **Genuine native ARM64 CI acceptance remains pending.**

## Independence and exact source

This reviewer implemented none of the four source/test changes, orders or
governance. Actual shell/file access was verified before proof. Only this admitted
review and outside-Git evidence were written.

Basis `937912cc0546bfe7b7cd8b3c082f8ef798c20e5b`, branch
`phase-7/release-local-gates-20261001`, draft PR98. All four worker freeze hashes
were independently verified. Their sorted hash-map SHA256 is
`7dd0d3b186bf57e5238f7ef13f6e4c1dc239ba5c14e3f4f96cac9e4fed3d5e10`, recorded in
`independent-arm64-index-source-freeze.json`.

The diff contains exactly three digest substitutions in Compose, the validator and
the storage expectation, plus one added regression rejecting the old AMD64 child.
Removing that regression reconstructs the complete original pin test. Every prior
assertion remains. Other tracked bytes match the basis, including all **102
migration/schema/referee files**, setup, forty readiness attempts, CI, authority,
domain code, Dockerfile, storage/exposure/restart/log/core limits, other image pins,
package versions and generated assets. The finalized order/question and new
DECISIONS.log/LEDGER entry accurately retain the pending ARM64 gate; both records
are append-only. The exhaustive admitted union contains nine paths.

## Personally executed registry and local proof

Safe receipts are under `/workspace/yellow-coordination/release-20261001/`, using
`independent-arm64-index-*` names. Docker operations used the normalized local
`unix:///var/run/docker.sock` endpoint. The official reference was
`docker.io/library/postgres:18.6-alpine3.24`; no mutable tag is admitted as the
runtime pin.

| Official OCI object | Independently verified raw SHA256 |
|---|---|
| Index, 10,293 bytes | `77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873` |
| Native linux/amd64 child, 2,678 bytes | `d8703cd7fba306b9fec9268ecedfa8a966846c053036a60e3635791957eb2f66` |
| Native linux/arm64/v8 child, 2,680 bytes | `89f747171c4b0af0eacf5984550060be79786dbe286eb60cfa691d79d1e8b23f` |

The exact index bytes contain one native descriptor for each required platform.
Both child manifests were separately fetched from the official repository and
their raw hashes checked. The AMD64 descriptor is identical to the basis pin;
its config and all layer digests remain unchanged.

- Focused pin/containment tests: **9 passed, 0 failed, 37 assertions**.
- Actual committed-file pin CLI, types and import boundaries: **passed**, with
  **207 TypeScript files** scanned.
- Unchanged `./setup.sh --db-only`: **11 passed, 0 failed**, **130 tables**,
  **5.31 seconds**; the disposable `yellow_test` database was removed.

Canonical proof used only the owned `yellow-catalogue-referee` synthetic stack on
loopback port 55442 and its existing private authority wrapper. A task-local copy
of the outside-Git mirror override changes only the PostgreSQL digest to the
verified index; the original override and prior receipts are preserved. Effective
Compose and actual container inspection both report that index. Docker selected
native linux/amd64, config/image ID
`sha256:c293117fcecda7344b5480222e813b9f673d7abd69b1dd95eff239b768b04f59`, exactly
the verified existing AMD64 child config, running PostgreSQL 18.6. This is an
AMD64 execution receipt, with no ARM64 emulation or ARM64 execution claim.

The first canonical attempt was **RED** at the unchanged migration0012 guard:
`yellow_runtime has an active session` (SQLSTATE 55000). Its original log and
receipt remain preserved. Root explicitly authorized pausing only the exact owned
synthetic app. After that verified fixture precondition changed, the same unchanged
setup passed; no guard, migration or deadline was bypassed. The same app container
and image were restored, then health and runtime readiness both returned HTTP200,
with its original serving revision `937912` and frontier100. Database/app proof
slots were returned free.

## Acceptance limits

The prior ARM64 job established a native ARM64 runner and ARM64 Yellow images,
then failed PostgreSQL's original forty-attempt readiness check while pinned to an
AMD64 child. Missing container logs leave the server-side startup cause unknown.
This review verifies the finite native-image selection correction; it does not
claim to have observed or repaired a particular crash or emulation failure.

Publication remains on the existing isolated PR branch after the previous required
CI run finishes, preserving its evidence. Native ARM64 readiness, migrations,
canonical referee, exact-source /ready and synthetic login must pass in genuine
CI under the original bounds before ARM64 closure. Other required CI jobs also
remain source-bound. GitHub merge-checkout serving identity must be reported
separately and tied to the reviewed branch by exact Git-tree equality.

No laptop/live integration, whole-release, PMS/CRM or phase completion is claimed.
No merge, deployment, provider activation, paid fallback or laptop overwrite was
performed. Quota remains laptop-monitored; stop/checkpoint at a <=1% notification
without credit/reset/automatic resume. No such notification arrived during proof.
