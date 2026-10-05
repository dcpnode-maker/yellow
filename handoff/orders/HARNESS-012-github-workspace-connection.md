# HARNESS-012 — Existing GitHub account in the T3 workspace

Status: SCOPED LOCAL CONNECTION COMPLETE. 28 September 2026. Phase 0, local development.
Actual host discovery and reviewer-executed proof:
`handoff/reviews/HARNESS-012-actual-github-connection.md`.

## Authority and scope

The founder asks to connect T3 to GitHub using dcpnode@gmail.com and resume the
unfinished harness. Read-only GitHub email settings identify dcpnode-maker as
that account; the existing official GitHub CLI is already authenticated in the
Windows keyring. No password entry or new permission is necessary.

Exact implementation scope: D:/Yellow/harness/t3code/scripts/yellow-workspace.mjs
and yellow-workspace.test.mjs; the bounded read-only yellow-harness-host-status
helper and paired test under HARNESS-011's existing script scope;
docs/user/universal-harness.md, the credential-free
D:/Yellow/harness/state-workspace/github-connection.json, and this order plus
HARNESS-012-* review/question files and append-only ledger/decisions in the
harness-app governance checkout. Runtime proof may use the existing owned T3
workspace lifecycle only after checking that no active T3 work is interrupted.

Expose only the existing official gh binary and its existing GitHub CLI config
directory to this isolated profile. Verify the exact account and Windows-keyring
authentication before activation. Do not copy/export credential values, inherit
ambient token variables, invoke login/refresh/logout, change GitHub scopes or
approval controls, publish code, alter remotes, or restart CompSet Studio.

## Proof and completion boundary

Focused tests must cover opt-in binding, wrong account, malformed binding,
credential-store mismatch, ambient-token exclusion and harmless failure. A
nonimplementing reviewer personally executes the relevant proof. Verify GitHub
discovery in the actual T3 host before reporting the account connected.

HARNESS-011 remains the separate unfinished free-worker/build/review workflow.
GitHub connection does not establish whole-harness acceptance or authorize the
deferred CompSet handover. state.sh still fails because WSL /bin/bash is absent;
no database referee, PR or merge is claimed.
