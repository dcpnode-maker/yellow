# HARNESS-005 product-completion seams

## RESOLVED

2026-09-28, Codex implementation owner under D-91. Founder approves the bounded
Luna acceptance review and requests continued completion, not a new architecture.
Record these exact seams before implementation:

- Add preparation/assignment and review UI/contracts/host helpers inside the
  existing HARNESS-005 adapter, universalHarness, RPC, client and MCP scope.
  Paperclip remains sole owner of assignments, workspaces and job state. Prepare
  only an existing company-owned isolated linked worktree and T3 project, with
  exact base/prompt/model identity and current zero-cost admission. Keep assigned
  drafts in backlog; preparing never wakes an agent. No renderer paths, shell,
  workspace fallback, generated-code execution or automatic artifact acceptance.
- For the Windows artifact, use upstream's supported cached-resource-monitor
  staging option, only after acquiring the official v0.0.42 x64 Windows installer by
  its GitHub release SHA256 and checking local native/resource-monitor source
  equals the upstream pin. New yellow-harness scripts and generated cache under
  native/resource-monitor/target/** are in scope. Retain upstream packaging,
  license, native-load and self-containment validation. No global Rust/MSVC
  installation, gate removal, code-signing claim or public publication.

Independent acceptance remains required before activation of new authority.
No live model generation, Kaggle compute start, credential migration or paid API
authority is added by this note.

Inspection found the official x64 ZIP is a macOS payload despite its generic
name; it is retained as rejected evidence. The actual hash-pinned Windows NSIS
installer is inspectable by electron-builder's checksum-pinned 7zip toolset.
Extract only the bounded x64 monitor executable, never execute the installer.

Preparation must preserve the existing Paperclip assignment. The current PATCH
API has no exact expected-revision assignment condition; do not emulate atomic
assignment with read-then-PATCH. Complete a native atomic assignment seam in a
separate scoped successor rather than silently weakening ownership protection.
