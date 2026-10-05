# BUILD-CONTINUITY-002 independent review

Date: 2026-09-13. Author of launcher and provider guide: `/root/omniroute_setup`.
Reviewer: root coordinator, who did not implement those files.
Base source: `75a2eba1cd34d0512d010bf3f91230ebed4720e7`.

Accepted for the bounded local gateway preparation described by Order 002.
Provider accounts, inference, durable hosting, and Yellow application release are
not accepted or activated by this review.

## Findings and repairs

Root found that an existing private environment could override bind/auth settings
and selected ports, that launcher/private-log paths lacked link checks, and that
smoke failure reporting could echo sensitive upstream logs. The author repaired
these before acceptance: runtime settings are applied last, common provider API
key/token environment variables are stripped, existing path components are
checked for symlinks/reparse points, and failure output names only the private log.
Both foreground paths disable recovery. The guide now includes the exact pinned
archive acquisition command and preserves NVIDIA's unresolved displayed date.

These checks do not constitute a complete audit of the third-party package or a
defence against a privileged process concurrently replacing private files.

## Proof personally executed by root

- Read the complete final launcher, provider guide and pool JSON; inspected the
  packaged serve command and documented bind/auth/background configuration paths.
- Ran `python tools/build-continuity/omniroute.py --install --smoke --port 20139`.
  Archive byte count, pinned SHA-512, package identity and MIT licence checks
  passed. Existing installed version was 3.8.50; no reinstall was performed.
  Health returned HTTP 200 and unauthenticated `GET /v1/models` returned HTTP 401.
  The process exited successfully and a separate socket check found port 20139
  closed afterward. No authenticated gateway or provider endpoint was requested.
- Executed eight independent temporary-fixture checks: hostile saved bind/auth/
  port values remain locked; a synthetic inherited OpenRouter key is removed;
  dangling links at npm, manifest, launcher, data, environment and log locations
  are rejected; a deliberately failing fake process cannot echo a log canary.
  The runtime lock/key assertions form one combined check; six link locations
  and the log-canary check make eight. All passed. No real private files were
  replaced by these fixtures. Windows reparse handling was inspected, not run on
  a Windows host.
- Separately ran the continuity controller suite: 16 passed, 0 failed. Its
  independent review and exact source hashes remain in Review 001.

The installer author also executed its isolated checks and local smoke proof.
Root's acceptance above relies on the root executions, not solely those reports.

## Installation limitation retained

The initial cloud installation used a targeted esbuild install without
`--omit=optional`; npm materialized additional optional packages in that private
prefix. Lifecycle scripts remained disabled and the optional features were not
used. The final launcher includes `--omit=optional` for both npm calls. Root did
not delete the existing prefix or claim that it is an independently reproduced
fresh installation without those extra packages. A new host must execute its
own installation and smoke proof.

All provider pools remain disabled/pending. Kilo email sign-in/Terms submission
was rejected by automatic approval review pending explicit founder approval;
OpenRouter Google sign-in did not reach verified target-account access. Only a
cloud Chrome browser was discoverable; no laptop browser or host is connected.
No private credential is included in Git. No model balance, VM, application CI,
PostgreSQL gate, live deployment, or continuing Astra process is claimed.

## Frozen files

| File | SHA-256 |
| --- | --- |
| `tools/build-continuity/omniroute.py` | `7cf95bf9eae45641b67b26d8c04f8e9901937d3ae35c495230b98baf03976f1d` |
| `tools/build-continuity/OMNIROUTE.md` | `e3016b180be7754fd4622f5744e4ef9bf8db5e11f8e3de7ccb586b38f9a3c4aa` |
| `tools/build-continuity/provider-pool.json` | `9883d0d0af32f18d3742260ef0215c68cdac1eafa095026199c77335e4f98621` |
