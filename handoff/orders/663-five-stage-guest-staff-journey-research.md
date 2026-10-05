# Order 663 - Five-stage guest and staff journey research

Date: 2026-09-23
Owner: Codex
Phase: 0 cumulative review; product research only
Branch: existing `phase-0/founder-context-demo-readiness` (documentation only)
Status: COMPLETE - research deliverable only

## Goal

Research and map the founder's pre-arrival, arrival, stay, departure and
post-departure journey across guest actions, staff responsibilities, shared
records, operational handoffs, exceptions and purpose-built screens.

## Scope

- `handoff/orders/663-five-stage-guest-staff-journey-research.md`
- `docs/GUEST-STAFF-JOURNEY.md`

## Method and constraints

- Use primary PMS/operator documentation with direct source links.
- Read relevant existing Yellow journey and service code before describing reuse.
- Distinguish observed source code from verified integrated/live functionality.
- Preserve PROJECT.md, existing decisions, domain boundaries and approved scope.
- Proposed journey labels are not new database states or schema changes.
- No runtime, database, infrastructure, deployment or credential changes.
- Research assistants may return findings; only the root writes the final map.

## Acceptance

- [x] All five stages pair guest actions with staff ownership and completion.
- [x] Shared tasks, guest-visible progress, approvals and escalation are mapped.
- [x] Groups/sharers, split billing, exceptions, STR and shift handover included.
- [x] Existing source anchors and gaps are labelled without completion claims.
- [x] Primary pages retrieved; local Markdown links resolve; synthesis distinguished from sources.

Result: `docs/GUEST-STAFF-JOURNEY.md`. Root inspected current source and Oracle/Mews
documentation. One bounded GPT-6 Luna research assistant returned Cloudbeds sources;
root retrieved those pages before integrating. No local-model or live-runtime
execution is claimed. No application/database change or test was performed.

Documentation-only work: no application tests, database referee, PR or deployment
is required for this research deliverable.
