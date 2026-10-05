# Q237 — Order449 bounded test-file isolation validation

## RESOLVED — exact focused diagnosis and one isolated standing admission

Order449's exact seven-path candidate tree
`f2ada4bb904216198a3d3c735cad7b94515776bf` remains unpublished. Its first
standing attempt is retained at `.yellow/evidence/order449/validation/standing.json`
(SHA-256 `53d8a7457566e869153864ac0508a0cc11bfae5e8dad7b2c5b399b4aaea734ed`),
and its successful focused diagnosis is retained at
`.yellow/evidence/order449/focused-diagnosis/receipt.json` (SHA-256
`41df53876ce56dd953f5f078911d5d25c4adbacef674603980097411b4b00e80`).
The admitted unchanged rerun is retained, RED, at
`.yellow/evidence/order449/unchanged-validation/standing.json` (SHA-256
`45e46479b671f36aa7ac128664ece884a3ed69869879b3ff5a5944b4a8e5da3f`).
It again reported 1,929 passed, 1,407 explicit skips and two failed across all
537 files, but the original two browser files passed. The new failures were:

- `tests/project-status.test.ts`: the valid-metadata case reached its existing
  4,500 ms owned-process lifecycle deadline after 4,293 ms;
- `tests/rate-quote-tax-preview.integration.test.ts`: P4 reached Bun's unchanged
  default 5,000 ms timeout after 5,322 ms.

These are different order-sensitive deadlines. They are not Order449 assertion
failures and are not accepted as passing. No application, UI, test, helper or
deadline change is admitted.

One new private helper under `.yellow/evidence/order449` may expose two separately
invoked modes after root reads it completely:

1. `DiagnoseFocused` runs only the two newly implicated test files, sequentially,
   from the exact retained artifact and private candidate index. Each process/log
   is bounded, has database/provider/runtime authority removed, and must exit zero
   with no retained owned child. It preserves and revalidates both RED standing
   receipts, the earlier focused receipt, native proof, artifact, source, real
   index, flags, HEAD and tracked worktree.
2. `ValidateIsolated` is admitted exactly once only after root reviews and supplies
   the new successful focused receipt hash. It runs the full 537-file suite once
   with Bun's documented `--isolate` flag, followed by unchanged typecheck,
   boundary and licence gates. It does not alter test selection, timeouts or
   assertions. The receipt must record exactly 1,931 passed, 1,407 skipped, zero
   failed and 537 files; assertion count is recorded from actual output. All owned
   processes and logs remain bounded.

The second RED receipt and every earlier evidence directory remain immutable. A
failed focused or isolated run is retained and requires a new written admission;
there is no retry authority. No database, provider, application, Docker, WSL,
browser service, Git index/ref, candidate, dependency or tracked-source mutation is
authorized. Source publication remains forbidden until root independently reviews
the exact green isolated standing receipt. Exact-source CI remains mandatory after
publication; merge, deployment and Phase 7 completion remain out of scope.
