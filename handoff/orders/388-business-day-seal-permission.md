# Order 388 — Business-day seal permission prerequisite

**Status:** ACTIVE-D1147
**Phase:** 5 — Financials operator delivery prerequisite
**Risk tier:** 3 — audited close authority

The approved audited seal capability checks `business_day.seal`, but that permission
currently exists only in tests/fixtures and is absent from the production permission
catalogue and review provisioning. After Order384, add only the exact permission through
migration0067 and provision it to the founder-approved ordinary same-property sealing
actor. Order386's still-unapproved trust prepare capability moves to prospective
migration0068.

Migration must add only the permission catalogue row and grant no role. Review seed
must grant exactly the authorized ordinary review/operator role, not infer approval or
other permissions. Intentional red, replay, exact grant/non-grant, catalogue/schema/
migration/acceptance/standing/static/referee11/11 and fresh independent Tier3 proof are
mandatory. No service, HTTP/UI, seal action, local promotion, deploy or merge authority.
