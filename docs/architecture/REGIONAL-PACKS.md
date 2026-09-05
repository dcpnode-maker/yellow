# Lightweight regional behavior

> **Development documentation snapshot — 2026-09-05.** Source:
> [`61dbeea`](https://github.com/dcpnode-maker/yellow/commit/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e).
> This updates the original project documentation on main; main's executable code
> is still an older integrated baseline. Implemented contracts, setup behavior and
> proof described below refer to that development revision, not a claim that main
> or the local app already runs them. Planned capabilities remain planned.


**Status:** specified, not implemented by Order433 · 2026-09-05 · YF-019.

One domain core serves hotels, hostels, apartments and STR. Region changes presentation,
configuration and approved provider/rule adapters, not copies of the application.
Reuse the existing [extension registry](../EXTENSIONS.md) and audited typed property
configuration; do not introduce a parallel tenant/configuration store.

## Resolution model

For preferences, resolve explicit values from:

`global defaults → country → admin1 → locality → operator/property`

`admin1` is a neutral identifier whose displayed label can be state, province or
region. Do not make names the join key. Staff language/accessibility preferences
may override presentation for that user; they cannot change legal identity, fiscal
currency, property timezone, data access or another user's preferences.

This precedence is for preferences only. Applicable legal obligations accumulate
according to verified jurisdiction/effective dates; a property override cannot
disable a mandatory rule. Conflicting mandatory rules fail closed and require
policy resolution, not a silent last-write-wins merge. Roles constrain visibility
and actions separately from regional choices.

## Small pack contract (proposed)

| Group | Contents and boundary |
|---|---|
| Identity | Stable key/version, jurisdiction identifiers, supported property types, compatibility, provenance and fallbacks |
| Language | Translation dictionaries, searchable aliases, text direction and local property/room/unit terminology |
| Display | Number/currency/date formatting, optional calendar presentation and address/telephone layouts |
| Workflow preferences | Configured field order, optional prompts, guest communication templates and service terminology; no invented demographic restrictions |
| Provider capabilities | Regional channel/payment/reporting adapter identifiers and explicit enabled operations, loaded only if configured |
| Legal rules | Separate versioned rules with authority URL, jurisdiction, effective period, last verification, reviewer and expiry/review state |

Store real instants and domain dates according to existing contracts. A Hijri or
other date-display preference must not rewrite stored booking/business dates.
Property timezone determines the business day. Currency formatting never changes
bigint minor-unit arithmetic or authorizes FX conversion.

## Arabic and mixed-direction acceptance

- Use logical layout properties and actual RTL testing, not just translated strings.
- Keep room IDs, booking references, phone numbers and currency codes readable in
  mixed-direction text; isolate identifiers where necessary.
- Support configured digit presentation and local date formatting without assuming
  every Arabic-speaking user chooses the same settings.
- Test navigation, table headers, filters, keyboard order, truncation, dialogs,
  voice transcripts, printed documents and locale fallback, not just the homepage.
- Guest language, staff language and legal-document language are distinct choices.
  Required document wording is not guessed or machine-translated without review.

## Saudi discovery example

Gathern is explicitly included as a Saudi STR/alternative-accommodation discovery
candidate. Public host material describes property and booking operations, but this
research did not establish a public supply API. [Gathern Business](https://business.gathern.co/).

Almosafer describes accommodation distribution/API services; those descriptions do
not establish a self-service property-supply integration for Yellow. Separate demand
inventory access from pushing a hotel's rates/availability and receiving its bookings.
[Almosafer corporate portfolio](https://corporate.almosafer.com/en).

Both remain partner-access discovery, not available integrations. The
[OTA capability matrix](../integrations/OTA-CONNECTIVITY.md) owns the detailed evidence.
Neither brand's popularity establishes a legal or cultural requirement. This design
does not claim to have researched Saudi licensing, identity, taxes or guest eligibility
rules; those need official, current, jurisdiction-specific evidence before activation.

## Keep cost and payload bounded

Use small declarative manifests and translation chunks. Resolve a property's
effective pack on configuration change, key read caches by tenant/property/version,
and invalidate explicitly. Only load the active locale and enabled adapter assets;
do not bundle every country's forms, maps, fonts, tax engine and speech model into
the first screen. Optional 3D is an enhancement with a standard 2D workflow.

Legal execution remains on trusted services. Publish pack versions atomically with
audit evidence and compatibility checks; pin the version used by a document or
decision so later updates cannot alter its historical meaning. A rollback selects
a previously valid configuration version; it does not rewrite financial history.

Acceptance requires two properties with different packs in one tenant plus an
unrelated tenant: no cache/translation/data leakage; version change and rollback;
unknown locale fallback; legal-rule conflict rejection; Arabic/English keyboard and
screen-reader behavior; no inactive pack requests on initial load. Record payload,
lookup latency and memory changes against the same baseline rather than promising
that regional support has literally zero cost.
