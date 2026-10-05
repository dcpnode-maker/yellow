# PR-FIX-009 - Dependency proof outside the ancestry order

## Resolved implementation scope

PR-FIX-008 admits no new source changes. Its validation found that the worktree
still contains PR93's frozen dependencies, while PR97's pinned manifests contain
the React/Vite frontend dependency set. Auditing the previous PR's installed
packages is not valid evidence for PR97.

C: currently has under 100 MiB free. PR-FIX-009 creates an explicitly owned proof
directory on E and preserves the prior install through a verified literal move.
Neither package manifest, lockfile nor licence policy is changed. Any actual
licence rejection remains a separate founder decision, not an implementer waiver.

## Pending founder licence decision

The exact frozen install has 65 packages. A licence check executed from the
ordinary E-drive dependency root (not a junction-skipping zero-package scan) fails
only on `tslib@2.8.1: rejected license 0BSD`; `bun audit --json` returns `{}` and
exit 0. Types and 205 import-boundary files pass with this actual install.

Upstream pinned licence:
https://raw.githubusercontent.com/microsoft/tslib/v2.8.1/LICENSE.txt
SPDX identifier/text: https://spdx.org/licenses/0BSD.html

Requested decision: admit only this exact locked package/version with retained
licence and paired exact-version tests, or preserve the block and plan a separately
scoped replacement. No licence policy has been changed; no PR97 publication or
acceptance is claimed while this decision is pending.
