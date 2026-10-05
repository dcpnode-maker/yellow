# HARNESS-022 — dispatch preflight correction

The complete owned-job source is 40,627 bytes; the actual start payload is
40,725 bytes. executeOwnedDiagnostic rejects anything over 40,000 before opening
the socket. The caller recorded an overly conservative unconfirmed receipt.
Do not widen the transport limit or erase/replay the original start claim.
Founder continuation authority permits a separately scoped successor attempt
after a compact read-only status proves no retained current job. See Order022.
