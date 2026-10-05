# RESOURCE-20261001 — actual Android RMS engine build and matrix receipt

Root personally reviewed the immutable source/harness/requests, compiled the same
canonical evaluator/economics modules on Windows, and validated every actual
authenticated Android result. This is a pure deterministic rate/economics slice
and synthetic validation workload, not live demand forecasting, OTA collection or
automatic price publication.

## Actual proof

- Windows Node24.19 x64/Bun engine and fixed oracle pass;16 chunks contain131072
  distinct inputs. Root reference bytes/proofs retained in root-reference-v3.
- Android/arm64 Node24.18 reused the exact existing native Rolldown1.2.9 toolchain;
  original TypeScript was stripped and bundled on the phone in319.091308ms.
- Fixed oracle:14 rate cases,9 invalid-input checks and11 economics checks. Rate
  oracle digest ed811e287e7ba4e420d382c5e01951a6867a4c2e5336e0eeb27fdee64039dd37.
- All16 phone chunks passed,8192 distinct cases per chunk, four real worker threads
  each,192 rule nodes per case. Every complete result-file digest, ordered input/
  result identity and projected exact economics matches the independent Windows
  reference. Timing fields are measured separately, not compared for equality.
- Phone chunk durations5597.439–6926.630ms, sum97051.704ms; diagnostic workload
  timing, not wall deployment time, production throughput or a pricing/booking SLA.
- Separate post-run command verifies all seven immutable inputs, native outputs,
  complete32-file result/proof set, per-case ranges/counts and exact result bytes.
  It completed exit0. Full result arrays remain on the phone; identical reference
  bytes are retained on the laptop and cryptographically matched, not described as
  downloaded device files.

Source manifest e1e9a0220c3b329a24d612f75d356ec98b107200f140fe2d5c82e6a71a8702ce.
Native engine000376e84148d4495360b69e7e795814188435f65c166f700caacc35a9c0de04.
Concatenated full results6a4002a64b6085add11b0107b53b454c501639ea85179490e0a4f5734eb7060f.
Post-run sanitized proof2536037230d2087cd536521013eafd5a6df5b3f6858aab4720e047829c5ed9a1.

## Recovery and retained RED evidence

Original rms-r2 source/build/oracle/matrix requests are immutable; job IDs and
target/payload are persisted before queue contact. Source-transfer chunks and
completed simulation chunks are checkpoints. No detached process/deadline bypass
or provider/model fallback was used. Fresh actual plan-only readings preceded each
batch; remaining plan usage was15–16%, emergency account balance unchanged in
observed readings. This is not an atomic account-wide billing guarantee.

Root reference-driver field-shape mistakes are retained under root-reference-v1/v2;
v3 completes the full reference. The first stage dispatch was rejected before
queueing when the quota receipt was stale; a fresh reading preceded actual dispatch.
One final matrix-result retrieval suffered WinError10054; the same original job was
queried again, with no simulation rerun. The first post-run script failed JavaScript
parsing from newline escaping, preserved as rms-r2-post-proof/exit1. A new immutable
post-proof-v2 request, syntax-checked locally before dispatch, passed. Original25
phone requests therefore include24 exit0 and this retained1 exit1; no failure erased.

Artifacts: E:/YellowWorkspace/Data/BuildArtifacts/yellow-phone-rms-20261001-v1/.
Private authenticated envelopes remain under the existing restricted coordinator;
sanitized proofs are in phone/. Task sources, fixtures and production rates were
not modified by this compute lane. Future forecasting/model selection, business
mix and explanation/equalizer work is documented separately in
docs/design/RMS-BOOKING-SETTINGS-20261001.md.
