# Question 185 — Owner-trust expense prepare capability — APPROVED D1158

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

## Resolution

The founder's explicit **“I authorise all pending approvals”** instruction approves
this then-pending recommended policy. Under D1158, the database-owned read-only
prepare capability is binding with the exact limits above; it grants no posting,
approval, payout or mutation authority.
