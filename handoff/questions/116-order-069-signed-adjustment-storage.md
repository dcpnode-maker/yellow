# Question 116 — Order 069 signed adjustment storage

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 069

Order 067 deliberately supports signed bigint `delta.amountMinor`, and the founder's universal-rate
requirement explicitly includes BAR `+/− amount`. Order 069 currently says every tagged minor-unit
decimal is non-negative, which would make a canonical negative evaluator delta impossible to persist.
May the release codec use the full signed-bigint canonical grammar for the tag while the existing
Order 067/068 normalizers continue to require non-negative values for prices, package elements and
discount amounts?

## Answer

Yes. The tag is a lossless transport for an already typed bigint leaf, not the domain validator for
that leaf. Accept canonical `0`, positive decimal, or negative decimal excluding `-0`, bounded to the
signed bigint range. Then decode and run the existing normalizers: only the evaluator's signed delta
position may remain negative. Add a database round-trip proof for a negative delta and keep float,
unsafe-number, overflow and noncanonical-string rejection unchanged.

