# Yellow Control — design proposal

Status: preview for founder feedback; NOT a built universal harness or company OS.
26September2026. User asks for Paperclip-like management plus a main harness that
communicates with other harnesses and models. Backend work paused for this preview.

## What the program will do

Company management owns goals, projects, task dependency/assignment, budgets,
approvals and audit history. Execution dispatches bounded work through runtime
adapters, preserves run/checkpoint state, and collects artifacts and verification.
An agent's final message never independently proves completion.

Lifecycle: Draft → Queued → Running → Needs review → Verified.
Blocked, Failed, Paused and Cancelled remain separate observable states. A crashed
run is reconciled before retry; it must not silently duplicate commands or spending.

Proposed integration: company controller → coding runtime adapter → model provider.
Antigravity may remain a direct CLI lane; compatible model APIs can use a local
FreeLLMAPI gateway. Paperclip's supported extension model is preferred to merging
whole repositories. DSH/Goose/Antigravity, models, gateways and devices are distinct
entities. Nothing here claims universal drop-in compatibility.

## Primary screens

1. Work: one searchable queue, phase ribbon and in-place task inspector.
2. Goals: company → product → outcome → dependent tasks.
3. Agents: role, owner, runtime, permissions and independent reviewer assignment.
4. Models & harnesses: entitled endpoints, capabilities, quota, health, routing.
5. Approvals: proposed sensitive actions with exact scope and evidence.
6. Activity: durable execution/checkpoint/cost/verification history.
7. Settings: free-only policy, concurrency and trusted executor capabilities.

Visual concept: calm white/grey professional surfaces, neon-green action accent,
compact horizontal and vertical ribbons, collapsible left menu and docked icons,
mobile drill-in sheets. No mandatory full-screen navigation for task inspection.

## Initial implementation after design approval

One local controller, one included-quota worker, persistent bounded task queue,
explicit command/file scope, restart recovery and independent test-based review.
Provider adapters are enabled only after an actual smoke test and entitlement check.
No paid fallback, model-weight download, production deployment or always-admin
mode. Administrative/irreversible external actions need separate approval.
Source may use scoped OS tools; the model cannot authorize its own privileges.

## Architecture trade-off

Keep Company/Execution/Verification separate to avoid coupling business authority
to model output. Reuse upstream adapters where compatible; do not build every
framework simultaneously. Paperclip offers broader ready-made governance but adds
Node/PostgreSQL runtime overhead. A lean initial queue is cheaper to run but lacks
its full company dashboard. Choose the actual runtime after measured Windows/RAM
and free-only integration proof, not marketing throughput claims.

Future scope: remote devices and VPS workers, more independent agents, scheduling,
procedural memory, browser/desktop tools and richer portfolio control. These are
planned, not present in the HTML concept. Yellow hotel operational data remains
authoritative in its existing PostgreSQL domain services, never in this harness.

## Preview limitation and review criteria

Every item/status/model in HTML is SAMPLE DATA. Controls only change in-memory UI;
refresh resets them. No model/OS/file/network command is sent by the page.
Review main screen, ribbon hierarchy, detail inspector, mobile density and agent
control vocabulary before backend implementation. No visual design is approved yet.
