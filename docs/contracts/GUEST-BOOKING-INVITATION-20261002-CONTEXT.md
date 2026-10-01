# Invitation guest booking context

POST `/api/public/booking/context` uses the existing invitation bearer boundary.
It accepts exactly `{}` with `application/json`, rejects query strings, is subject
to the existing per-session budget, and returns a no-store JSON response. When the
request includes `Origin`, it must exactly equal the request URL's origin. The
route does not reflect origins or set CORS permission headers.

The response is derived from the authenticated opaque invitation session and its
current live authority in the current tenant transaction. It returns only the
canonical property `{id,name,timeZone}`, active allowlisted rate plans `{id,code,
name}`, and for each plan the unit types and active sellable-unit `{id,name}` labels
that have current unsuperseded pricing evidence for that plan. Unit metadata stays
nested under the plan that authorizes it. The response discloses no tenant, Party,
actor, scopes, token, contact details, rate amount, raw configuration or booking
promise. The invitation's plan allowlist and live tenant/property authority must
match; a missing or revoked plan denies the entire context.

Property timezone is validated as a runtime-supported IANA timezone before return.
The exact `UTC` identifier is accepted; the legacy `GMT` identifier is accepted
and normalized to `UTC`. Slash-separated IANA identifiers must use canonical
capitalization and are returned as `Intl.DateTimeFormat(...).resolvedOptions()`
reports them, so accepted links return their canonical runtime name. Fixed offsets
and case-folded forms such as `utc` are rejected.
There is no authoritative property check-in/out clock source in this bounded
schema surface, so the context omits check-in/out times and all stay instants/dates.
The guest constructs local stay choices using the returned property timezone; the
existing offer and quote commands remain authoritative for stay instants, local
nights, price and availability.

The query is explicitly tenant/property/plan scoped and returns no more than 4096
plan/type/sellable-unit rows. The service fails closed if that bound is exceeded;
it does not truncate labels. The HTTP layer retains the existing 1 MiB encoded
response ceiling, generic error mapping, authenticated bearer parsing and session
request budget. Expiry is rechecked after database reads before the context is
returned.
