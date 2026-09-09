# Q246 — Correct complete-source local promotion contract

Order457's retained85 restart is not a release of the current frontier90 source.
It also mixes workers-on startup with a whole-database immutability requirement.
Both issues are technical release-contract defects, not missing founder intent.

Root resolution: Order460 prepares one complete-current-source release. Upgrade
only the retained serving database after exact-source gates, a verified private
recovery copy and fresh independent admission. Preserve the separate invariant
database, old source/control and terminal evidence. No reseeding or85 UI-only
backport. Apply86–90 forward; failure after a committed prefix leaves the app
stopped and needs forward recovery or separately verified restoration.

Separate pre-runtime preservation from post-start behavior. The former preserves
all business rows and sequences through migrations; the latter observes normal
worker convergence while proving allowed row transitions and protected fiscal
data unchanged. A table/operation allowlist alone does NOT prove row ownership,
legal state transitions, tenant scope or monetary integrity. The prepared pure
classifier is only one check on a later complete native observation receipt.

No runtime/database operation is admitted by this resolution. Exact source and
target paths, backup size/space, bounded execution and recovery remain Order460's
later execution handoff. No founder action is needed for this preparation.
