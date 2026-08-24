# Yellow Future Workbench — design and architecture handoff

Date: 2026-08-23  
Prepared by: Codex  
Artifact: `Yellow-Future-Workbench.html`

## Status boundary

This is a standalone, interactive target-state prototype. It is not a claim that
the represented functionality exists in the production Yellow application.

The repository was deliberately left untouched. At the time of the prototype
preflight, `state.ps1` reported:

- branch: `main`
- head: `61b0fd3`
- phase: Phase 0, cumulative review pending
- services: app, PostgreSQL and Valkey down
- unrelated existing worktree state: modified `AGENTS.md`; untracked `.agents/`
  and `.codex/hooks.json`

Any implementation must begin by rerunning `state.ps1`, reading the current order,
and working only inside its explicit scope. The prototype must never override the
canonical database, state-machine, compliance or tenant rules.

## What the artifact contains

### Founder and user experience mode

- A spatial/cinematic command centre driven by real process stages rather than
  decorative or fake progress.
- Simple, Standard and Expert detail levels demonstrating progressive disclosure.
- Apple Calm, Midnight Glass and Pixel Bright theme variants.
- Peek/drawer/workbench interaction direction without nested modal stacks.
- A staged multi-agent morning brief.
- Operational KPIs, arrivals, day-close readiness and management attention queue.
- Management intelligence sliced by rooms, revenue source, market segment, segment
  group, company and travel agent.
- Explicit financial routing of package value into rooms, F&B and other services.
- Universal rate-plan flow with Fixed, BAR-linked, Smart Dynamic and Contract models.
- A guest journey linking reservation, transfers, spa, dining, checkout and CRM.
- AI workforce, provider registry, isolated hotel memory and safe feedback loop.
- Responsive desktop/mobile layouts, reduced-motion support and keyboard command
  palette.

### Architect review mode

The `Architecture brief` navigation item contains:

1. System context and the PostgreSQL authority boundary.
2. Voice/text-to-action AI pipeline and model routing.
3. Shared Yellow inference fabric with isolated per-hotel retrieval and adapters.
4. Tenant, action, financial and training safety boundaries.
5. A preliminary 100-hotel capacity and cost model.
6. SLO hypotheses, rollout gates, unresolved decisions and executable evidence
   expected before production claims.

The architecture view is print styled. Its `Print / save PDF` button can be used to
create a PDF for reviewers.

## AI infrastructure hypothesis

Preferred operating model:

- Yellow-owned GPU servers in a professional colocation facility.
- Public cloud GPU capacity only for overflow and disaster recovery.
- Optional hotel-edge appliance for offline/privacy requirements.
- One shared base-model fleet with continuous batching; never one full model copy
  per hotel.
- Tenant-isolated encrypted RAG indexes and optional versioned adapters.
- Deterministic command handling first, compact model second, large reasoning model
  only when the task warrants it.

Pre-benchmark 100-hotel starting hypothesis:

- two independent inference nodes;
- two 96 GB RTX PRO 6000 Blackwell GPUs per node;
- 30% capacity reserve;
- approximate landed cluster cost: INR 70 lakh to INR 1.05 crore;
- approximate colocation/power/bandwidth/support: INR 2 to 4 lakh per month;
- approximate 36-month infrastructure allocation at 100 hotels: INR 5,000 to
  INR 8,000 per hotel per month.

These are planning ranges, not quotes. Hardware purchase must follow a rented
equivalent replaying a measured Yellow workload at twice expected peak.

## Learning boundary

The proposed design does not continuously train on raw hotel conversations or guest
data. The order is:

1. permission-filtered tenant RAG;
2. structured human feedback and outcome capture;
3. sanitised offline evaluation;
4. optional versioned tenant adapter;
5. human-approved rollout with rollback and deletion proof.

Provider knowledge must be versioned from official/licensed sources and backed by
deterministic certified connectors. The model must disclose stale or unsupported
knowledge rather than inventing integration behaviour.

## Verification performed

- Strict TypeScript build: passed.
- Vite production build: passed.
- Single-file inlining: passed; final HTML is approximately 328 KB.
- Desktop DOM and visual inspection: passed.
- Responsive check at a 375 px viewport: no horizontal document overflow.
- Mobile defect found and corrected: assistant now defaults closed below 760 px.
- Navigation to rates, guest, agents and architecture: passed.
- Simple-to-Expert progressive disclosure: passed.
- Rate-model selection: passed.
- Four-stage morning-brief animation: passed.
- Final packaged HTML browser console: no warnings or errors.

## Important limitations

- All numbers and hotel records are illustrative synthetic data.
- No prototype control calls a Yellow API or writes a database.
- Accessibility received structural treatment but has not had a full screen-reader
  or independent WCAG audit.
- Hardware throughput and 100-hotel concurrency remain unverified until benchmarked.
- Security, compliance, fiscal, occupancy and tenant guarantees remain governed by
  the repository constitution and executable referee, not this artifact.

## Recommended implementation sequence

1. Review the interaction system and architecture assumptions with founder, hotel
   operators, IT architect, AI architect, security architect and finance architect.
2. Record accepted decisions in the repository decision process.
3. Issue a scoped UI design-system order before touching production UI.
4. Implement shell, tokens, accessibility and progressive disclosure first.
5. Connect one end-to-end vertical slice to live APIs; do not mock every screen.
6. Build the AI evaluation and action-authority harness before agent autonomy.
7. Benchmark rented GPU capacity using real measured request shapes before buying.

## Primary hardware references

- NVIDIA RTX PRO 6000 Blackwell Server Edition:
  https://www.nvidia.com/en-us/data-center/rtx-pro-6000-blackwell-server-edition/
- NVIDIA RTX PRO 6000 reference marketplace price:
  https://marketplace.nvidia.com/en-us/enterprise/laptops-workstations/nvidia-rtx-pro-6000-blackwell-workstation-edition/
- NVIDIA DGX Spark reference:
  https://marketplace.nvidia.com/en-us/enterprise/personal-ai-supercomputers/dgx-spark/

