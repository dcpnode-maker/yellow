# Order720 receipt — supplied PriceLabs route and attachment review

Status: one founder-authorized read-only API request was performed by root;
this receipt records that result and a separate static-only review of the five
attachments. No supplied attachment was executed, no response payload or credentials
were saved, and no automatic retry was made. No billing, permissions, dashboard configuration,
or hotel database was changed.

## Exact endpoint observation

Founder supplied:

```text
GET https://api.pricelabs.co/v1/market_dashboard/data?report_id=49132
```

Root performed one request with the supplied key in memory in the documented
`X-API-Key` header; redirects were disabled, deadline 25 seconds, response cap
4 MiB. Response: HTTP 404, 34-byte JSON with keys `status` and `error`, and
`error` equal to `Not Found`. No response file was written, no retry or report-ID
enumeration followed, and no key value is reproduced or persisted here.

The result does not establish whether the key is valid: HTTP 404 does not
distinguish an absent or stale report, an inaccessible report, or an undocumented
route. It returned no report schema, date range, market rows, or October data.
The supplied `report_id=49132` is not established as the visible UI dashboard
187188. I did not repeat or independently validate this request.

Public official PriceLabs docs reviewed:

- Customer API overview: <https://developers.pricelabs.co/customer-api/api-reference/overview>
- Neighborhood Data route/auth/response: <https://developers.pricelabs.co/customer-api/api-reference/customer-api/neighborhood-data/get-neighborhood-data-for-a-listing>
- Market Dashboard feature/export overview: <https://help.pricelabs.co/portal/en/kb/articles/introduction-to-market-dashboards>
- Market Dashboard billing: <https://help.pricelabs.co/portal/en/kb/articles/market-dashboard-billing-and-subscription>

I found no public official API reference for `/v1/market_dashboard/data`. The
published Customer API docs identify `X-API-Key` on documented Customer API
routes and describe listing-scoped market statistics; they do not provide this
route's auth/entitlement contract, `report_id` mapping, payload schema, or date
filters. The public Dashboard material describes subscribed dashboards and CSV
exports but is not an API contract. The 404 plus those docs do not justify further
guessing or trying another ID.

## Supplied attachments — static text review only

Exact directory:
`C:/Users/astha/Documents/Codex/2026-08-14/cl/outputs/yellow/.codex-remote-attachments/01a02df3-c84f-7773-a169-dec0e20c9da6/c30b475c-8ee0-466d-b737-8ef805275fa2/`

Files inspected: `1-demo.py`, `2-AirbnbLogin.py`, `3-script.txt`,
`4-quickbooks-1-.py`, and `5-dubai-beds-24-complete.py`. Review was read-only;
programs were not executed, dependencies were not installed, no account access was
attempted, and credential/guest values were not copied into this receipt.

- `1-demo.py`: Selenium/account UI automation with generic popup-closing and
  broad selector/click logic, date selection and CSV-download attempt. An error
  path prints part of `page_source`; this could disclose account page content if
  run and logged.
- `2-AirbnbLogin.py`: login/session automation with sensitive authentication
  material. Treat as private; do not execute or redistribute.
- `3-script.txt` and `4-quickbooks-1-.py`: account or financial automation with
  sensitive configuration and external side-effect patterns, including email/
  scheduling behavior. Not a PriceLabs market-export contract.
- `5-dubai-beds-24-complete.py`: Beds24 bookings/properties requests concern
  the operator's own host data, not a public competitor feed. It contains
  scheduled workflow and floating-point monetary calculation patterns and is
  not suitable as a Yellow financial/import implementation.

Overall disposition: these attachments are historical automation examples, not
an approved supported Market Dashboard API client. Do not reuse embedded
credentials; if any are still active, the account owner may separately decide to
rotate/revoke them through provider settings. No credential action was taken.

## Optional UI reference appendix (not claims about PriceLabs or the three flaws)

The official [Kole Jain resources catalog](https://www.kolejain.com/resources)
lists “Dashboard Flaws” dated 20 June 2026, with Preview/Download controls and
component thumbnails. It does not provide a transcript or text description that
matches the supplied [YouTube URL](https://youtu.be/EcbgbKtOELY). The YouTube page
was bot-throttled in public research; the video identity and its purported three
flaws therefore remain unverified. No transcript or flaw list is inferred here.

For UX inspiration only, Oracle's [OPERA Cloud Billing reference](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.2/ocsuh/c_manage_billing_manage_billing.htm)
and [charge-posting workflow](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.2/ocsuh/t_postings_adjustments_posting_charges_to_guest_folios.htm)
illustrate a contextual reservation-search → Billing flow; payee-linked billing
windows; searchable charge-code entry with price × quantity; and separate charge,
settlement, and checkout steps. This is reference UX only, not Yellow product
policy or backend authorization. A prudent Yellow field-mic pattern would limit
voice entry to optional free text and require direct confirmation of codes,
amounts, quantities, and payments; that is a design recommendation, not a claim
about Kole's video or Oracle behavior.
