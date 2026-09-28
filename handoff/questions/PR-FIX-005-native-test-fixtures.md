# PR-FIX-005 native fixture scope

## RESOLVED

Founder-authorized routine repair: avoid Bun's recursive mkdir of an existing
readonly directory and stop the test from reassigning the shared parent's ACL.
Only a new random child and its archive receive the private ACL. Existing roots
are validated as directories without reparse links, never repaired or removed.

The canonical status test timed out after printing historical counts. The local
recovery backup and venv were untracked and scanned by Git status; exclude only
these owned transient paths before attributing that timeout to production code.
The slow-table cleanup failure remains a recorded red result, not a waiver.
