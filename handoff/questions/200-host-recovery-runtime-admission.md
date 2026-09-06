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
