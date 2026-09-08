# Q238 — Retain failed standing; continue scoped backend implementation

Resolved by root, 2026-09-08. No UI or runtime promotion is authorized.

Q237's root-executed full `bun test --isolate` failed: 1,944 passed,
1,421 explicit skips, two failures, 36,259 assertions, 537 files, 308.61s.
The failures were existing Order195 Chromium geometry (30,007.33ms) and
Order239 P4 long-stay pricing (5,562.31ms against the unchanged 5,000ms limit).
Isolation registered additional tests, so its totals cannot be assumed to equal
the non-isolated suite. No passing standing receipt was produced.
The exact full log SHA256 is
`c25dc8c640e4ebd2f065ce020ced5fcc2ae330aba35806ca6f2fbd4489d17fbb`.
Earlier Q234/Q235 failures and both successful focused diagnoses remain retained.
This admission authorizes no unchanged full-suite retry or deadline relaxation.

The post-run preservation guard also correctly rejected an accidental agent-owned
823-byte literal patch suffix appended to `docs/CONTRACTS.md` during private patch
preparation. Root read the exact suffix, removed only that suffix using apply_patch,
and recomputed the entire 2,081-path working fingerprint. It is restored exactly to
`670c415cdbad2d22b9e1ddff523ee0bc1ee4ac6cf3d4983aea24cc6a8a4c1ce7`.
All seven Order449 source hashes remained unchanged. No failed evidence is rewritten.

The seven-path candidate `f2ada4bb904216198a3d3c735cad7b94515776bf` remains
UNPUBLISHED. Its guarded publisher is held. Parent `ffb03441` remains the latest
published source checkpoint with six successful CI jobs. No main merge, phase
completion, or change to the running local app is claimed.

Root now releases the working-source freeze only for the already bounded Order450
implementation and Order451's two-file pricing performance repair. This is not
permission to publish the failed candidate: a subsequent explicit combined candidate
must identify every included order/path, preserve all paused work/index flags,
and pass its relevant independent proofs and standing checks. Existing candidate,
failure, native-proof and publication evidence remains immutable.

Order450's reviewed four-path integration patch SHA256
`fcfc46b6ae23e13fe1fad84c3c012c3d5dbf601bd0e0a51d586949a21362aeba`
may be applied to its scoped context exports, command HTTP wiring, app route and
existing fresh-database CI block. Root's separately reviewed Q236 controls any
actual PostgreSQL proof; no new database/server is authorized here.

Order451 is activated for its exact two production files, new pure test and
append-only preview proofs. D-244/Q109 hostile frozen-context denial remains
binding. Its old-source artifact is the retained exact `f2ada` artifact, not a new
worktree or dependency copy. Root must read and admit the compact baseline driver
before execution and capture unchanged outputs before implementation. Independent
root execution must prove complete output parity and the proposed 30% long-stay
median improvement; no claimed speedup without measurements. No database or price
policy change is authorized. Benchmark and other heavy test processes run sequentially.

The browser timeout may be diagnosed read-only. Fixing a demonstrated test-lifecycle
defect needs a separate scoped admission; changing visual design, test assertions,
test selection or timeouts is not a workaround. Root owns a truthful current-status,
contracts, decision and ledger checkpoint for this continuation.
