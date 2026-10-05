# Order 499 — Founder journey capability ledger

## Objective

Consolidate the founder’s existing PMS, Overwatch, mobile, cashier, guest-service,
RMS and client-website journey requirements from Yellow-controlled records into one
testable delivery ledger. This prevents requirements being lost across agents,
handoffs and chats.

## Scope

- `handoff/chat-archive/`, `handoff/orders/`, `handoff/reviews/`,
  `handoff/ROADMAP.md`, `docs/`, `BUILD-PLAN.md`, `DECISIONS.log`, and local Git
  branch metadata
- Founder-authorized, authenticated ChatGPT and Gemini conversations whose title and
  content are visibly Yellow-related; record source URL/identifier and a requirement
  summary only, never raw transcript, credentials, personal data or unrelated chats
- A single new traceability document under `handoff/`

## Required behaviour

1. Every journey records its source record, actor, trigger, authoritative data,
   required action/result, confirmation requirement, current delivery state and
   verification evidence.
2. It explicitly covers arrival/check-in, departure/check-out, reservations/search,
   guest/stay/folio/room history, housekeeping, cashiering, guest service/F&B,
   Overwatch text/voice/live action, property configuration, dashboards, RMS/market
   intelligence and the Locanda customer website boundary.
3. It distinguishes implemented, source-only, published, partially implemented,
   blocked by missing credentials/policy, and not started. It never calls a feature
   complete without proof.
4. It extracts requirements only from Yellow-controlled records and founder-authorized
   visibly authenticated Yellow chats. It must not infer unseen content from an account
   identity or fabricate missing content.

## Exclusions

- No product code, database, runtime, deployment, customer-data or credential changes.
