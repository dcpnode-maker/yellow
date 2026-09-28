# PR93 Windows catalog-proof portability

Native execution reproduced a test setup failure: the fixture invokes `python3`,
which Bun cannot resolve on this Windows host, despite working `python.exe`.
Cleanup then masks that failure with chmod of a file that was never created.
Before edits, PR-FIX-004 admits only the paired test's interpreter selection and
failed-setup cleanup. The catalog builder/runtime, source trust and privacy policy
stay unchanged. Existing Unicode/domain/provenance/release hostile tests are kept.

The earlier license warning was an extraneous `tslib` package left in node_modules
from a different checkout state, not a locked MapLibre dependency. The whole old
dependency directory was moved into an ignored, recoverable backup; a clean frozen
install passes all48 package licenses and audit. No allowlist/lockfile exception.

Follow-on native failure: the completed SQLite file is chmod-readonly and hardlinked
into place, then Windows refuses unlink of the readonly temporary hardlink. POSIX
directory-open/fsync is also not portable to Windows. Before the next source edit,
the order explicitly admits the builder's platform-specific atomic publication,
its paired tests and an ignored native probe. Preserve fail-if-destination-exists,
complete-file fsync and readonly final output; do not use overwriting replace().
