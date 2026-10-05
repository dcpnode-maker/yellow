# PR-FIX-014 - Repair two actual strict frontend errors

Founder authority: repair existing public PRs. With the frozen PR97 dependencies,
frontend-specific strict tsc reveals an undefined setAssistantOpen callback and a
possibly undefined statement inside a row loop. Root typecheck excludes TSX and
is not a substitute for this separate compiler.

## Scope

- `frontend/yellow/src/App.tsx`: bind the existing Overwatch entry button to the
  actual setAssistant state setter. Opening the existing assistant is not consent
  to microphone, speech output, charge or operational execution.
- `frontend/yellow/src/workspaces/ReservationWorkspace.tsx`: explicitly narrow a
  missing governed statement before its posting-row loop. Preserve the visible
  folio entry and unavailable label; never invent rows or currencies.
- `tests/yellow-frontend-strict-source.test.ts`: regress the exact callback and
  the explicit missing-statement guard in the active lazy workspace.
- This order, paired question and receipt; PR-FIX-012's scoped generated output
  is rebuilt from these exact changes. No other source edits admitted.

No changes to domain commands, authority, finance posting, microphone/speech
consent, scopes or tenant queries. Migrations and dependency pins stay unchanged.

## Acceptance

Root and frontend strict tsc; boundaries; paired assertions; real existing bounded
browser navigation/speech-consent proof; full native suite. Source remains pending
licence approval, actual referee and independent acceptance; no deployment.
