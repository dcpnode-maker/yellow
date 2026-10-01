# Invitation context successor

Base bdb94cad8ddccda628a6b3db7e69e4b63512f86f / PR100.
Adds authenticated POST /api/public/booking/context accepting exact{} to the
invitation HTTP action; laptop applies ONLY the separate app route hunk at
handoff/patches/BOOKING-20261002-context-route.patch. Actual app/server and frontend
are unchanged in this successor. Original invitation backend contract continues.

Contract docs/contracts/GUEST-BOOKING-INVITATION-20261002-CONTEXT.md.
Returns live authoritative property id/name/canonical IANA timezone and allowlisted
plan/type/unit display labels with current unsuperseded pricing evidence. No raw
config, Party/contact/actor/tenant/scopes or price/booking promise. Explicit UTC/GMT
aliases normalizeUTC; regional alias resolvesruntimecanonicalname. No invented
check-in/out times; unit metadata can be empty for pricing configurations with no
legacy rate_price evidence, while later offers remains authoritative full evidence.

New envelope-expiry guard also clamps quote deadline to application/DB clocks and
rejects quote/hold payload deadlines beyond verified envelope expiry. Migration0104
unchanged SHA4c41dc4765ecbfe705999c5d5980ea482579403bdc681e468669fd3021c6be4a.
No other migration, runtime privileges or writes added.

Independent reviewer personally executed owned PG18:13pass0fail101assertions;
focused29pass0fail125assertions; strict types/diffcheck green; canonical setup11/11.
Review handoff/reviews/BOOKING-20261002-invitation-context.md.
Receipts handoff/receipts/BOOKING-20261002-context/.
Only synthetic owned proof databases touched. Full exact-head CI and mounted
createApp route proof remain laptop receiving gates; this is not live guest UI.
Apply selected source/test/contract hunks onto current3039/its reviewed successor,
never overwrite app/server/auth/restoredfrontend or merge dirtysource wholesale.
