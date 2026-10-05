# Review — Order 529 reservation board guest and travel attributes

## Result

Accepted for the read-only reservation-board scope.

## Evidence

- Intentional red: the focused suite failed because no guest/travel formatter
  export existed.
- Final focused proof: 17 passed, 0 failed, 89 assertions across Today helpers,
  guest search, reservation paging, mobile navigation and ambient Yellow mode.
- Strict TypeScript and Vite production build passed; deployed assets are
  `index-CK5F6HfI.js` and `index-CZ--Ozxi.css`.
- Formatter proof distinguishes arrival from departure travel, renders exact
  adult/child grammar and pickup status, and returns an explicit unavailable
  state when neither guest nor travel detail exists.
- Public 375×812 proof showed 21 rendered mobile rows with factual party sizes;
  the first row displayed `1 adult · travel not recorded`. The full desktop
  Guests / travel column and reservation preview use the same formatter.
  Document width remained 360 within the 375 px viewport and the override was
  reset.

## Boundaries

The board already returned adult, child and travel facts. This change only
renders them and never infers absent transport. The current public Locanda rows
have no recorded travel, so they truthfully say `travel not recorded`. No
travel task, reservation/API/database/schema/fixture/financial/voice/provider
state changed.
