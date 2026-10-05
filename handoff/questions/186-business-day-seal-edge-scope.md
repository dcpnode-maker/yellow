# Question 186 — Business-day seal edge scope

The approved PostgreSQL seal capability authorizes the internal permission
`business_day.seal`. Yellow access tokens deliberately admit only canonical scopes
with exactly one colon, so local login filters that internal permission out. Draft
Order389 nevertheless requires the HTTP route to check the impossible token scope
`business_day.seal`. Completing Order388 exactly as first drafted would therefore
create database authority that the operator route can never present.

## Recommended policy

Approve two-layer least-privilege authorization:

- retain `business_day.seal` as the existing internal PostgreSQL capability permission;
- add canonical edge scope `financials.business-days:seal` for HTTP/JWT authorization;
- grant both only to the ordinary same-property sealing role;
- grant neither to the specialized carry checker;
- Order389 checks the canonical edge scope and exact property grant before calling the
  existing service, whose migration0064 capability independently rechecks the internal
  permission, actor, tenant and exact property.

Migration0067 would catalogue only these two permission rows and grant no role itself;
review provisioning remains the sole role-grant surface. The alternative—broadening
the global token grammar to admit noncanonical dot-only permissions—is not recommended
because it expands identity semantics for the entire application.

## Resolution

D1150 classifies this as a routine technical boundary mapping already determined by
Yellow's approved identity grammar and PostgreSQL authority model, not missing business
policy. Codex adopts the recommended two-layer authorization under its implementation
authority; no founder decision remains required.
