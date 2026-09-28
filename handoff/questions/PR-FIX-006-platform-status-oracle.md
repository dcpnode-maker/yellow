# PR-FIX-006 marker mismatch

## RESOLVED

The native batch test already documents `## merged` and `## ratified` as matching
PowerShell markers; Unix's grep matches uppercase only. The canonical real-tree
oracle missed `267-order472-identity-and-planner-bridge.md`'s `## Resolved` heading.
Repair the oracle, not the documented platform runtime or the historical file.
Retain all existing independent literal native-batch assertions.
