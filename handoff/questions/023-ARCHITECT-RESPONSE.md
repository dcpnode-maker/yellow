# Architect response 023 — widen only the catalogue map key type

**Status:** CLOSED · **Authority:** D-95 temporary architect · **Decision:** D-106

## RESOLVED

YES. The registry accepts runtime string type names; the test map must model that same
contract. Add an explicit string-keyed map annotation, preserve all counts and
validation assertions, then restart typecheck and the seed proof.

