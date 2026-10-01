# Independent schema-recovery proof review

The v5 schema comparator passed the retained v4 synthetic dump pair and rejected all seven hostile mutations. No Docker/database actions, credentials, or external networking were used.

The source dump’s normalized SHA-256 matches the pinned frontier hash `b924ed9532046a563df6332881716130deeb2e69dc88341d0123849d61c8edf9`. The two dumps have 20 differing normalized raw lines; each difference is limited to parentheses on one of the 20 named CHECK lines. The remaining raw lines match exactly. Both parse as 2449 ordered PostgreSQL statements with equal full ASTs after removing only scanner-coordinate fields (`location`, `stmt_location`, `stmt_len`). Parser: pglast v7.10.

Hostile CHECK-bound, RLS, owner, grant, function-body, unknown-DDL, and malformed-parser mutations all failed closed. The function-body mutation preserved line count and changed the parsed AST; the malformed CHECK mutation reached the parser and raised the generic schema-parse guard.

Validation: Python compile passed; 33 unit tests passed; independent actual-dump baseline and seven hostile mutations passed. This is a schema-proof review only; it does not establish that the v5 recovery run or app launch occurred.

JSON receipt SHA-256: `4a87de17fd38b7f489ac8e7c11e46274fc59d0ee389a2d7c1ad3a6a8130e0723`.
