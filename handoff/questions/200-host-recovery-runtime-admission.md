# Question200 — Native Windows merged-main founder preview

**Status:** ADMITTED technical local-preview implementation under Order442.
**Date:** 2026-09-06. **Source:** merged main
`b5ef70842b658183f7b5b4c650c8e78c7a0b513d` (remote verified).

The Docker executable is absent at the installed default path and the prior WSL
Bun process generated repeated signal11 dumps. Do not reinstall/start WSL or invoke
Linux Bun to satisfy a preview request. Use the already tested native Windows
Bun1.3.14 and PostgreSQL16.15. This is a native local preview, not a claim that the
Docker launcher was executed on this host or that production reliability is proven.

## Exact additional scope

```text
scripts/start-merged-native-review.ps1
D:\Yellow\runtime\main-b5ef708 (immutable source extraction and dependency junction)
D:\Yellow\runtime\order442-review (protected credentials, logs, PID and receipt)
127.0.0.1:55503 / yellow_order442_review (new synthetic review database only)
127.0.0.1:55503 / yellow_order442_invariants (new disposable referee database only)
```

Reuse the existing native PostgreSQL cluster without modifying its global roles,
template, settings, credentials or other databases. Before cloning, verify server16.15,
template77migrations/127tables, no tenant rows and no active template backends. Refuse
pre-existing target databases for first provisioning; never overwrite/drop them.
Mark this cluster as retained while preview databases depend on it. No Docker,
Valkey, new dependency installation, service registration or new Git worktree/clone.

Extract exact Git archive bytes and record its SHA256; use an explicit junction
to the existing dependency directory only after confirming package/lock identity.
No code in the extracted source may be edited. Unmergedcdfca0b fiscal code remains
separate and must not be labelled part of this main preview.

Verify all canonical migration checksums through77 with the native runner, seed
the new review database with the canonical and synthetic review seed, and run the
exact Python11-invariant referee on the separately seeded clone before starting
the app. Generate unique operator/approver/JWT secrets, stored outside Git with a
current-user-only Windows ACL. Password values must not appear in tool output.

Start native Bun in a hidden background process, loopback127.0.0.1:3000 only, with
the implemented worker flags from local-review.sh. Keep hosted financial providers
disabled. Prefill yellow-demo/operator@yellow.local and its generated review
password on the loopback login page. Require /ready to return the exact mainSHA,
77frontier and yellow_runtime_database; verify real sign-in and inspect the browser.
No restarting unrelated processes or stopping other native PostgreSQL servers.

Read-only status is allowed on repeat invocation. An existing app on3000 must be
identified and verified, never killed or replaced silently. If any gate fails,
report it without rewriting the source, weakening checks or inventing readiness.
The initial Google Drive source backup excludes these newly created runtime files;
record that boundary and make a consistent logical backup before claiming database
recovery. A cloud upload must be confirmed separately from mounted-file readback.

## Reboot recovery admission — 2026-09-06

The laptop rebooted at11:34:17 IST. Coordinator personally confirms no listener
on3000/55503/55513 and no Bun process. The existing source archive, receipt and
protected app.env/seed.env remain. A separate installed PostgreSQL service is
running (parent6396 at inspection); it is unrelated and must not be stopped.
The earlier full-test handle disappeared; its incomplete run is not a pass.

Additional exact scope under Order442:

```text
scripts/resume-merged-native-review.ps1
tests/native-review-resume.test.ts
D:\Yellow\temp\order434-production-cluster-20260906 (existing cluster startup only)
D:\Yellow\runtime\order442-review (new bounded resume logs/receipt only)
```

Resume existing state only: no initdb, CREATE/DROP database, migrations, seed,
role/credential change, source extraction, dependency install or service registration.
Verify the explicit absolute cluster target, PG_VERSION16, recorded startup options,
PostgreSQL16.15 binary and absence/identity of its actual process/listener before
pg_ctl start. Never remove a PID file or kill a conflicting process. Reuse existing
loopback55503 configuration and write a new log in the admitted control directory.
Starting this retained cluster for the already admitted disposable Q203 proof is
allowed before app recovery; do not start the stopped55513 test cluster.

The standalone resume helper must validate the protected environment files, exact
mainb5ef708 source archive/hash and extracted source, dependency junction and locked
Bun version. Existing listeners must be verified or refused, never replaced. Check
the existing review database identity, server160015 and actual77 migration hashes
read-only; the historical runner must not run. Start only the existing app with its
existing credentials, loopback address and unchanged worker configuration, in a
hidden process with new logs and a small bounded startup wait. Verify exact source77
readiness, prefilled synthetic login and real authentication without printing a
password/token. Preserve the initial receipt and write a distinct resume receipt.
Tests must pin non-destructive resumption and identity checks; actual laptop execution
must additionally verify readiness/login. Native Windows crash repair, provider
activation, new UI, cloud hosting and phase completion are not implied.
