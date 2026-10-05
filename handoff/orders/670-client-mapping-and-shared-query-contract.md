# Order 670 - Client-owned business mappings and one query experience

2026-09-24. REQUIREMENTS RECORDED / IMPLEMENTATION PENDING.
Founder clarification: "Client must configure this."

This order records the next delivery contract, not a deployed feature. No runtime
code, policy, mapping data or database changes have been made under this order.

## Founder requirements

- One universal hotel search, available alongside advanced filtering and multilevel
  sorting in every tabular view. Table scope and all-hotel scope must be explicit;
  do not build independent competing guest/room/search products.
- Client owns business mapping configuration in property setup. No hardcoded hotel
  definitions or silent classification based on names, language-model guesses,
  an employee's identity or an unconfigured rate-code naming convention.
- MSG -> MS is the demand hierarchy. Sources, channels, rates, company/booker,
  sales ownership and room products are independent linked dimensions. Support
  valid one-to-one, one-to-many and many-to-one relationships, rather than forcing
  every relationship into a single tree.
- Client configures valid room class / room type combinations such as KING with
  Deluxe; labels alone must not infer physical inventory or availability.
- Client may configure rate/company/source rules to derive a market classification
  such as Leisure without requiring a second manually entered field on every stay.
  Derived classification must retain the rule and evidence; it is not a claim that
  the guest personally declared that purpose. Unmapped/conflicting evidence remains
  visible and correctable, never silently assigned to a default segment.
- Sales staff must be able to maintain authorized company profiles and their
  portfolios. Production can be queried by company and configured sales owner.
  Shared ownership does not duplicate the hotel's bookings, nights or revenue.
- All table controls consume the same configured dimension definitions. A filter
  such as Market = Leisure displays matching booking count with its date basis,
  plus clearly defined nights/revenue where the projection supports them.

## Audited existing foundation (D serving source)

`src/contexts/reporting/commercial-attribution.ts` provides the Order570 parser,
resolver and CommercialTaxonomyService. It uses property-keyed versioned extension
storage, validates relationships and emits explicit UNMAPPED reasons. Existing
configuration supports demand groups/segments, sources/channels, company Party
UUIDs and room classes mapped to unit-type UUIDs.

`commercial-contribution.ts` and the authorized commercial-contribution GET API
provide the Today MSG/MS/source/channel rollup. Company, sales-owner, rate-purpose
and room-class reporting intersections are not all wired into that projection.
The generic extension API is not itself a client-facing safe commercial editor.

MovementGrid already has advanced filters and two-level sorting. Other current
table families include group allotments, checkout bill lines, operating-performance
comparisons and assistant KPI results. Existing scoped filters are not proof of a
completed uniform cross-table query experience.

## Next implementation slices

1. Inspect and bind existing extension authorization/version mechanics; issue a
   concrete scoped implementation order for a real client editor, server validation,
   preview, versioned save and explicit activation. Do not substitute localStorage,
   a JSON textarea or an unsaved mock for working configuration.
2. Add missing rate/portfolio relations through existing primitives where possible;
   document cardinality, conflict resolution, permissions and effective periods.
   Technical invariants stay mandatory; client configurability does not disable them.
3. Carry configuration version/evidence into contribution intersections; report
   booking-date vs stay/business-date explicitly. Historical ownership/configuration
   changes must not silently restate prior production. Show weighted credit only
   when a client has explicitly configured attribution; never invent allocation.
4. Reuse one typed search/filter/sort contract and UI across table families. Filter
   complete authorized datasets before pagination; disclose bounded/incomplete reads.
   Preserve bigint money, currency and the source's authoritative bill totals.

## Acceptance boundaries

Client can configure and save supported mappings, see their effects on named
records and inspect an unmapped/conflict queue. Tenant/property isolation, role
checks, version/effective-date behavior and history must be independently tested
by a non-implementer against real PostgreSQL before activation. Many-to-many joins
must not inflate reservation/room-night/revenue facts. ADR/RevPAR/occupancy are
derived at the requested grain, not added across overlapping categories.

No database migration, new entity, commercial classification, activation or
whole-app table-completion claim is authorized merely by this requirements record.
No new app instance or paid dependency is needed for the requirements audit.
