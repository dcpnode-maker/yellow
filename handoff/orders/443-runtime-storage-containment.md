# Order443 — Runtime diagnostic storage containment

**Status:** ACTIVE. **Date:** 2026-09-06. **Owner:** Codex coordinator.

The founder asks why repeated crashes consume storage and requests prevention for
server/on-premise use. Order442's read-only audit finds uncapped native application
stdout/stderr and absent per-container log bounds. D1374 separately records native
Windows Bun lifecycle crashes: avoiding WSL is not proof of a repaired runtime.

## Exact scope

```text
handoff/orders/443-runtime-storage-containment.md
handoff/reviews/443-runtime-storage-containment.md
scripts/run-native-review-bounded.ps1
tests/run-native-review-bounded.test.ps1
tests/runtime-storage-containment.test.ts
scripts/start-merged-native-review.ps1
docker-compose.yml
docs/RECOVERY.md
docs/PROJECT-STATUS.md
handoff/LEDGER.md
DECISIONS.log
D:\Yellow\runtime\order442-review (bounded diagnostic files and supervisor receipt)
D:\Yellow\temp (new uniquely named synthetic supervisor test fixtures only)
```

Keep the exact merged-main application source b5ef708 unchanged. A Windows-native
supervisor may start only that app with its existing protected environment and
working directory, and may stop only the child it started. Root may replace the
already verified Order442 PID only after reconfirming PID, start time, executable,
command and source receipt. Announce a brief local restart before replacing it.
Never stop PostgreSQL, unrelated Bun processes, WSL, Docker or Drive. No database,
role, credential, provider, migration, live hotel record or .yellow mutation.

Use streaming bounded diagnostic files, not whole-output buffering. New supervisor
logs must have a hard per-file and count bound; rotate only its own exact files.
No automatic restart is allowed while the runtime fault remains unknown. Require
free-space preflight and periodic critical-space fail-stop for this local preview;
record the reason in a bounded receipt. Do not suggest fail-stopping a production
hotel database. Injected synthetic child processes and temporary test roots must
be unmistakably distinct from the actual app and cannot target arbitrary services.

For Compose, configure explicit no automatic restart, bounded per-service local
logging, and a core-file limit; preserve images, ports, volumes, credentials,
healthchecks, dependencies and application flags. Host crash collectors may ignore
process core limits and remain a separate deployment requirement. Docker is not
available here: syntax/static proof is not actual daemon enforcement.

Tests must personally exercise oversized output, exact retained byte/file limits,
child exit without retry, and low-disk refusal/fail-stop with synthetic thresholds.
No intentional Bun/WSL crash, filling a physical disk or deleting existing dumps.
Record independent proof, actual local restart identity, limits and remaining
root-cause/soak/cloud/host quota gaps. This order contains diagnostic growth; it
does not certify production availability or fix an unidentified runtime defect.
