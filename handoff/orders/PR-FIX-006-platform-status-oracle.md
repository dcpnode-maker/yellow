# PR-FIX-006 - Match the established platform status-marker contract

## Scope

- tests/project-status.test.ts: historical-count oracle and paired case proof.
- This order, questions/PR-FIX-006-platform-status-oracle.md and paired receipt.

Founder-authorized routine test repair. The existing native batch proof explicitly
requires PowerShell's case-insensitive markers; Bash remains case-sensitive.
The shared test oracle accidentally used Bash matching on both platforms. Preserve
both established runtime contracts rather than editing historical governance text
or changing state.ps1. Add a fixture that proves both case conventions explicitly.

No deadline increase, assertion deletion, runtime-probe modification, authorization
change, source-policy change, live action or automatic generated-code application.
