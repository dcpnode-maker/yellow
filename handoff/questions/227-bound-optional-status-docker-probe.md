# Q227 — Bound the optional Unix status Docker probe

**Status:** RESOLVED scoped technical repair under Order447; no founder policy needed.

Exact25d3b979 CI34163554694 fails quality subprocess proof23pass/1skip/1fail:
the unchanged canonical status test times out at4254.58ms under its4500ms owned
lifecycle bound. Captured output reaches state.sh historical records but not its
service section. The intervening optional docker info call is unbounded. Native
standing passes and Windows/local-review CI pass; the cause of daemon latency is
not asserted. Do not blindly rerun or relax the outer process deadline.

Admit only state.sh, tests/project-status.test.ts, this question, and Order447/
canonical status/decision/ledger evidence for a bounded optional availability probe.
Require a short hard deadline (target1second), nonzero/timeout means unavailable,
no Docker/WSL startup or broad process termination. If the timeout executable is
absent, fail closed to unavailable rather than falling back to an unbounded call.
Preserve existing report fields and assertions. Add deterministic temporary PATH
shims proving a slow optional Docker probe cannot prevent report completion and
is reported down. Prove no surviving owned shim process/pipe within the existing
owned runner contract. Do not install dependencies or invoke Bash/WSL on Windows.
Linux real CI supplies mandatory executable Unix proof; local Windows skips are
reported explicitly. Existing root review and exact-source publication follow.

Root review expands the same two-file repair to the ENTIRE optional availability
probe: a successful info check previously led to a second unbounded compose ps.
Prefer one bounded compose-ps call rather than redundant info, same service truth,
and ensure parent-shell signal diagnostics are contained. Preserve a hard1second
probe bound and existing outerdeadline. Validate success/down/fallback as well as
the slow shim, and do not pretend unexecuted Unix cleanup is proved on Windows.

No migration, fiscal/financial function, authority, UI, app or live database change
belongs to this repair. Its implementer may still independently review disjoint
Order448 because they did not implement its backend or tests.
