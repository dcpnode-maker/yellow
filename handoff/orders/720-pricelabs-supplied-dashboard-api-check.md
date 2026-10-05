# Order720 — supplied PriceLabs dashboard API and script review

25September2026 founder supplied an existing PriceLabs key, the exact official
GET https://api.pricelabs.co/v1/market_dashboard/data?report_id=49132 and five
historical script attachments. This is new authority beyond719's UI-only export
scope. Check this specific authorized report with at most one initial HTTP GET,
no redirects, bounded time/body, explicit official API header, and no automatic
retries or enumeration of report IDs. Do not enable billing, create keys, change
account permissions, send data elsewhere or activate a scheduled collector.

Scope: this order; docs/research/PRICELABS-EXPORT-SCHEMA-20260925.md;
handoff/receipts/720-pricelabs-api-check.md; docs/PROJECT-STATUS.md;
handoff/LEDGER.md; static read-only review of the five supplied attachments in
the exact c30b475c-8ee0-466d-b737-8ef805275fa2 attachment directory. Small private
observations may be kept under D:/Yellow/temp/pricelabs-authorized-exports-20260925/
only if they contain no credentials. No implementation code or hotel DB change.

Never execute the attached programs, install their dependencies, or reuse their
account mutations during this check. Redact credential literals before reporting
file content. No credential in source, log, artifact, command output or commit.
Use the supplied key only for the exact api.pricelabs.co HTTPS origin, in memory.
Record HTTP status, safe API error or response structure/date/market/row counts,
without asserting the 2024 key is valid or that49132 is the current AbuDhabi UI
report187188. Stop on401/403/429 or missing entitlement. Separately ask before
any paid activation or persistent OAuth grant. Existing716 review continues
independently; public tunnel stays OFF.
