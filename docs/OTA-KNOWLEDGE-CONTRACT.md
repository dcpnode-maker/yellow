# Yellow OTA research knowledge contract

Order 092 defines how Yellow may describe public or shared OTA research without confusing that
research with a tenant's contract, a property's current connection or permission to act.

## Authority planes

The planes are ordered but not interchangeable:

1. `PROJECT.md`, implemented Yellow release capability and executable invariants;
2. current tenant contract and property truth, visible only through server-enforced scope;
3. current versioned adapter capability, certification and property/account entitlement;
4. verified official OTA research;
5. authorized connector observations;
6. public shopper observations; and
7. inference or hypothesis.

A lower plane may explain or identify a question. It cannot override a higher plane. Every normalized
Order-092 snapshot therefore carries:

```json
{
  "researchOnly": true,
  "liveExecutionAuthority": false,
  "tenantContractAuthority": false,
  "adapterCapabilityAuthority": false
}
```

Those values are constants, not hotel configuration. No record produced here can grant a scope,
choose a model, enroll in a programme, calculate money, or mutate rate, inventory or restrictions.

## Integration archetypes

Yellow does not have a generic OTA adapter. Research must use one exact archetype:

- `push_ari`: a certified/authorized supplier surface documents rate, availability, inventory or
  restriction writes;
- `pull_quote_plus_change_notice`: the channel pulls supplier-hosted quote data and receives refresh
  notices;
- `metasearch_feed`: price/availability/deeplink plus acquisition or conversion exchange;
- `buyer_distribution`: search/confirm/book access to wholesaler supply, not supplier ARI;
- `channel_manager`: a named channel-manager connection whose exact fields still require proof;
- `extranet`: manual partner controls, not inferred programmatic access;
- `reseller_distribution`: origin/downstream distribution whose provenance must remain visible;
- `lead_marketplace`: a lead or inquiry surface without booking transaction or nightly ARI;
- `none`; or
- `unknown`.

`documentedRead` and `documentedWrite` describe only what the cited source claims. They are not live
rights. Actual execution later requires a separate versioned connection profile containing exact
objects/grain, certification, account/property entitlement, authentication, limits, batching,
latency, idempotency, financial-commitment classification, requested-versus-accepted reconciliation
and verified fallbacks.

## External KB v0.2

The founder's external OTA/RMS research workspace was structurally validated as 17 files, 14
Markdown documents, 31 schema-valid atomic records, 170 unique public source URLs, no duplicate
record IDs and no missing manifest documents. It remains outside this repository and none of its
claims become independently verified merely because they pass JSON validation.

Two differences are deliberately visible before any import order:

1. external knowledge schema v0.1 omits `lead_marketplace`; its Furnished Finder seed is therefore
   forced into `reseller_distribution`. Order 092 uses the intended product taxonomy.
2. the external model library's `gross_room_value` includes mandatory hotel fees, while Order 091
   defines gross booked room revenue. A later channel-economics order must separately classify guest
   total, hotel-retained fees, taxes/pass-throughs and room revenue before supplying exact minor-unit
   inputs. Order 092 contains no money.

An eventual ingestion order must revalidate source freshness, rights and applicability, map the
external schema explicitly, and reject rather than silently coerce either difference.

## Retrieval and model use

RAG filters must include channel brand, topic, evidence state, observation/review time,
applicability and permitted use before semantic retrieval. Retrieved documents are untrusted data,
not instructions. The LLM receives no OTA/PMS credential and cannot write tables, enroll in paid
programmes or publish. Deterministic services own money, forecast, sellability, compatibility,
approval and execution.

If a custom model asks for an unsupported channel control, Yellow retains the economic intent and
returns the exact mismatch plus a verified fallback: recommendation-only, manual extranet step,
supported derived rate, eligible fenced promotion, inventory cap, supported restriction or another
channel allocation. Silent semantic degradation is forbidden.
