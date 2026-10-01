# Invitation token expiry closure

Independent public-booking review found the inherited invitation token parser could
use a payload deadline later than the signed envelope expiry when application and
PostgreSQL clocks differ. The context successor will clamp quote issuance to both
clocks and reject bound quote/hold claims extending past their verified envelope.
Add one owned PostgreSQL regression with a valid short-envelope quote and its
original longer payload; reject before hold/occupancy effects. Migration0104 is
unchanged. This is a bounded source safety repair, covered by the standing guest
booking authorization; independent proof is required before publishing.
