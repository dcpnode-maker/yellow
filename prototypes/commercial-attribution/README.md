# Commercial attribution prototype

This is the executable, fictional and disposable proof required by Orders 564/567. It is deliberately **not a migration** and creates no production authority. The test drops and recreates `commercial_proto` in a fresh database after canonical migrations.

The prototype preserves three independent grains:

1. one inventory row per property/date/counting basis;
2. one conserved hotel-night per reservation/property/date, with product allocation legs whose weights total exactly one;
3. one immutable source-ledger posting line plus one classification row. Reports derive the exact signed revenue contribution from the source amount (`-amount_minor` for the prototype's debit-positive ledger convention); reversals therefore remain negative without copying money into the classification relation.

MSG→MS is the only parent-child demand hierarchy. Channel/source, company/booker, group kind, class/type and organization are independent intersections. Capacity is never repeated onto those leaves. Ratios are recomputed after summing compatible numerators and denominators; currencies and incompatible physical counting bases never mix.

Run the retained proof against an isolated PostgreSQL 16 database:

```powershell
$env:YELLOW_COMMERCIAL_PROTO_URL='postgres://yellow:yellow@127.0.0.1:5467/yellow_proto'
$env:YELLOW_REQUIRE_COMMERCIAL_PROTO='1'
bun test tests/commercial-attribution-prototype.integration.test.ts
```

`schema.sql` is disposable prototype structure, `fixture.sql` is deterministic fictional evidence, `report.sql` contains read-only security-invoker reporting views, and `expected.json` is the independent result manifest.

The executable prototype includes a deliberately local actor/property grant solely to prove same-tenant property isolation. It is not a production grant design. Still intentionally unavailable at this gate: production taxonomy activation/override commands, effective-period CAS and writer-race authority, organization reparenting/restatement semantics, signed cursor/filter tokens, production user/property grants, public API endpoints, projection persistence and live KPI publication. These are named prerequisites for later orders, not simulated capabilities of this prototype. The unlogged `benchmark_night` source and source-rebuilt daily `benchmark_rollup` candidate prove bounded query shapes under application-role scope. The earlier direct-leaf performance miss is retained in Review 567; this disposable result is Natural-Solution evidence for a separately reviewed projection/rebuild design, not authority for a durable production projection.
