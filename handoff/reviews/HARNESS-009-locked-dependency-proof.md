# HARNESS-009 — Locked local build-dependency proof

2026-09-28, routine local tooling restoration by implementation owner.

The official npm @oxlint/plugins 1.68.0 archive was obtained without lifecycle
scripts. Its SHA512 matches the existing lockfile exactly:
sha512-titLmukUt/h8ho7Svlf0xSBjoy2ccZKrXjpXpZCj+v6V4CJccC2KyP45BLSCMx8YIpifMyiDyUptM4+5sruKbQ==.
Six archive paths verified under package/ before extraction. New package and
junction only; no existing dependency overwritten, no cache purge or broad install.

After the next missing effect dependency, stopped and recorded question 009,
then revised scope openly. Added effect / @effect/platform-node 4.0.0-rc.112
links to their existing reviewed .pnpm targets resolved from web/server importers.
No source, lockfile or manifest changed. No newer 1.79.0 substitution.

Focused lint then surfaced the real namespace-import error and React purity
warning. HARNESS-008 source fixed the namespace and used an event useCallback.
Final focused lint exit 0, two nonfatal React memoization warnings retained.
No lint plugin, check or SDK boundary disabled. This restores local tooling;
no inference, provider activation, security permission or production change.
