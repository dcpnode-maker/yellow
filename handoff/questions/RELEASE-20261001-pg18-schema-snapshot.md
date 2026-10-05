# Resolved technical scope: PostgreSQL 18 snapshot

The founder authorized completing the release CI lane. The actual canonical image
is already pinned to PostgreSQL18.6, while f610 retains a PG16.15 schema snapshot.
Official CI proves migration100 and acceptance24/0/75 before the strict comparison
fails. PROJECT.md specifies PostgreSQL18 and exact schema-drift verification.

This routine repair updates only the derived full snapshot after proven complete
diff provenance and independent fresh capture; no business/legal policy or new
migration is chosen. No founder question or assertion waiver is needed.
The unchanged checker preserves headers, settings, constraints, ACLs, RLS, object
order and function bodies. Unexpected semantic drift would block publication.

All differences were accounted for and two independently created canonical100
captures match the candidate digest. The original failed CI remains historical
evidence. Laptop is the receiving source/controller; no local merge is asserted.
