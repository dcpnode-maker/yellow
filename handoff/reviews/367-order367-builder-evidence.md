# Order 367 builder evidence — pending fresh Tier 3

Candidate `505a6bd` on `phase-7/persisted-india-final-component-tax-evidence`.

- Fresh PostgreSQL 16.15 applied migrations 1–70 and produced exact catalogue
  `70/122/112/112/21/2`.
- Focused live proof: 18 passed, 0 failed, 694 assertions, including restricted
  runtime create, exact replay, correction, stale fork, absent/foreign persisted
  applicability, one current head and zero unrelated financial writes.
- Migration0070 SHA-256:
  `a9eefe19e7d31e71aba55bc88146cbdf1f0b75915c691bbc3dabbe50b627a4f2`.
- Canonical PostgreSQL 16.15 schema was captured twice byte-identically; 830,219
  bytes, SHA-256
  `dbe66a1797c39f80d160f14f78942822546ec99e9b658166de59922a4383c77a`.
- Non-database focused proof: 13 passed, 6 database skips, 0 failed, 661
  assertions. Schema/setup oracle: 5 passed, 0 failed, 25 assertions.
- Standing suite: 1,310 passed, 1,008 database skips, 0 failed, 19,518
  assertions. Typecheck, 145-file import boundary, 23-package licence policy and
  diff check passed.

This is builder evidence, not independent approval. A fresh non-implementing Tier-3
reviewer must personally execute the complete required proof. No local promotion,
Phase-7 completion, posting, document, IRP, deployment, merge or push is claimed.
