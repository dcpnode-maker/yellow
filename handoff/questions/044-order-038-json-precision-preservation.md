# Question 044 — Order 038 whole-config round-trip loses JSON numeric precision

**Status:** RESOLVED by `044-ARCHITECT-RESPONSE.md` under D-95/D-115
**Order:** 038

The strengthened P2 ran 6 tests and returned 5 pass / 1 fail. Setting the OOS policy
round-tripped the entire property config through JavaScript and changed the unrelated
JSON number `900719925474099312345` to `900719925474099300000`. May the command update
only `config.inventory.oos_sellability` with PostgreSQL JSONB operators so unrelated
config never crosses the JavaScript number boundary?
