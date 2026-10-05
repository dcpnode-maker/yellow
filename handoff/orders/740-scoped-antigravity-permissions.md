# Order740 — enable founder-approved bounded Gemini tools

26 September2026. Scope expansion recorded in questions/740.md before changes.
Purpose: remove the all-tools block for the approved Order738 worker, while
retaining normal sandbox/approval controls and the free/included-quota limit.

Root may edit this order, questions/740.md, receipts/740-scoped-antigravity-permissions.md,
Order738 dispatch receipt, docs/PROJECT-STATUS.md, handoff/LEDGER.md and exactly
E:/YellowAI/Antigravity/config/settings.json, after copying its original to
E:/YellowAI/Antigravity/config/settings.json.before-yellow740.bak.
Temporary prompts/results and permission canary may exist under D:/Yellow/temp/order738/.

Preserve toolPermission=strict, trustedWorkspaces, network/MCP/unsandboxed denies.
Replace global read/write/command denies only with exact allowlisted instruction
reads, Order738 builder/reviewer paths and exact local verification commands.
Run the worker from an existing empty trusted workspace, not the real repository,
so workspace defaults do not grant broad edits. Other non-workspace access remains
subject to normal approval, and fails closed in headless mode. No config/credential
read allowance, paid key/provider, skip-permissions flag, install or live mutation.

Canary must prove actual allowed read and bounded write, then a separate Gemini
review session must personally inspect the resulting harness and run mocked tests.
Do not infer task success from CLI SUCCESS. Keep direct tool evidence where possible.
Restore original config if the experiment fails, or keep only verified narrow rules.
No change to production release blockers or ecosystem-completion claims.
