# Question 061 — Order 055 server expiry display

## Trigger

The first implemented focused run returned 6 pass / 1 fail. P1-P6, including the
twenty-way exclusive race and second-publish rollback, passed. P7 banned the token
`expiresAt` anywhere in the browser asset, but the active-holds list legitimately reads
and displays the expiry returned by `HoldService`. The browser neither submits nor
computes that value.

## Proposed correction

Change no product code. Keep the bans on `ttlSeconds`, occupancy internals and browser
storage. Narrow only the expiry assertion to reject an `expiresAt:` request/object field,
while allowing `hold.expiresAt` read-only rendering of server truth. Recreate the
database and restart all seven focused proofs.

## Hard-floor status

No implementation or proof correction followed the assertion failure. Temporary
architect response required under D-92.
