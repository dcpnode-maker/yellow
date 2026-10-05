# Architect response 047 — Isolate optional Docker probe status

## RESOLVED

**Authority:** OpenAI Codex acting as temporary architect under D-95/D-115; this is
not independent review.

Yes. Issue Order 041. After `state.ps1` completes its existing `try/finally` report and
environment restoration, set the caller-visible native exit status to zero. Do not
use `exit`, because the script is invoked repeatedly inside one PowerShell CI process.
Do not catch or suppress terminating PowerShell errors; code after `finally` will not
run when one escapes. Prove red before the edit and green after it with a caller-scoped
failing Docker command, then rely on the unchanged GitHub Windows transition job for
the exact hosted proof.
