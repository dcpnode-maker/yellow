# Question 185 — Owner-trust expense prepare capability

The approved posting capability safely derives and locks owner, property, currency,
payable route and available balance. A browser-facing approval request must bind that
same evidence before posting. Letting the browser supply it, or deriving it through
unlocked application SELECTs, creates a race and violates PostgreSQL authority.

## Recommended policy

Approve one new PostgreSQL owner-mediated, app-executable
`prepare_owner_trust_expense(...)` capability in migration0067. It uses the exact
posting lock order, accepts only tenant/actor/trust account/amount/reason, derives the
complete minimized approval evidence, and writes nothing. The later request command
persists only that server-derived evidence; final posting locks and rederives it again.

The function grants no new role permission, exposes no payable/owner/private evidence
to the browser, and does not post, approve, pay out or mutate a journal.

Founder decision requested: approve the recommended database-owned prepare capability.

