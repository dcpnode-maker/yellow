# Order742 root review — NOT APPROVED (initial draft)

26September2026; Codex root is not the implementation author. Static inspection
only so far, no system mutation and no test pass claimed.

Blocking initial findings:
- No actual chooser UI: missing ChoicePrompter silently selects Normal.
- IsForce is unused; install/uninstall never confirm.
- WhatIf is ignored by Choose and can launch real programs.
- Process environment variable is not a cross-process/session launch lock.
- Existing chooser can be overwritten at install or removed without ownership.
- Unknown StartupApproved values are treated enabled via even/odd heuristic.
- No manifest schema/allowlist/path validation, ACL or durable exact recovery;
  nonterminating registry errors and partial rollback can lose backup evidence.
- Command parser mishandles Windows quoting; executable lacks absolute EXE checks.
- Fixed scratch paths in tests can delete an unrelated existing file; do not run
  initial tests. Tests omit advertised failure modes and all remain unexecuted.

Correction requested from the same included-quota Gemini builder; no GPT code.
Current host candidates Claude/utweb/Acrobat/Edge already have disabled startup
records. Managing them cannot deliver new RAM savings. Measured42Node processes
belong to Codex ancestry (~2281MiB working set), one to Zed (~48MiB). Actual app
startup and future Codex/MCP resource strategy need separate decisions, not false
claims that a startup chooser alone will free these running resources.

Revision2 static review remained NOT APPROVED: ExpectedChooserCommand recorded
but never compared before uninstall; Choose consumes unvalidated manifest;
Get-CimInstance Win32_LogonSession|Select-First1 is not current-user logon identity;
mock chooser tests still write USERPROFILE markers; custom ConfigPath omitted from
registered chooser; no private ACL proof. No unsafe test was executed. Root revised
delivery gate to remove mutation code entirely pending founder product choice;
Gemini now prepares only read-only Audit/Plan and non-operative preview chooser.
This is a partial preparatory deliverable, not completed requested optimization.

Revision3 independently checked by root: all mutation implementations removed;
Install/Uninstall/Choose refuse. Root personally executed
`C:/Users/astha/.bun/bin/bun.exe test tests/order742-windows-startup-profiles.test.ts`:
6pass/0fail/27assertions,4.01s, including real PowerShell parsing and mocked preview.
Root also ran `./scripts/yellow-startup-profile.ps1 -Plan` read-only: zero eligible
enabled optional candidates; Edge/utweb/Claude/Acrobat already disabled. Real
WinForms visual interaction not exercised. Source SHA256
7D9504697DF825FE8A021A97156778E7E44D1AFE4EBAF32B4BA4A9723FA4BA86;
test A230C31EA13F59705DDE92BDB8E5A645AC2237DAF4EB1E9AD86A0E4409EDED89.
Accepted ONLY as read-only preparatory utility/preview; NOT an optimized boot mode.
No active742worker: Gemini3turns completed, no paid fallback. Founder choice pending.
