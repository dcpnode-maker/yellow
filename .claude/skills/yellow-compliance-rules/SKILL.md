---
name: yellow-compliance-rules
description: MANDATORY for ANY code touching invoices, fiscal documents, tax calculation, guest registration, government reporting, trust accounting, owner funds, GDPR/erasure, document numbering, or payments in the PMS. Use when implementing ZATCA, India IRP/GST, UAE e-invoicing, Alloggiati/SIBA/Form-C/eVisitor, when sealing business days, and when anyone asks to delete data. Getting these wrong is not a bug — it is a legal violation for the customer.
---

# PMS Compliance Rules

## 1. Fiscal documents — the chain is sacred

- Every legally numbered document comes from `document_series` (gapless per series,
  allocated inside the issuing transaction). `document` stores `prev_hash` → hash chain.
- SHA-256 over the canonical document body; ZATCA additionally requires PIH
  (Previous Invoice Hash) in the XML itself — series-level, enforced at issue time.
- Issued documents are IMMUTABLE. Corrections = credit note referencing the original.
  There is no "edit invoice". Ever.

## 2. Jurisdiction modes (FiscalDocumentProvider port — 5 patterns)

| mode | meaning | launch examples |
|---|---|---|
| none | tax engine only, no mandate | most countries |
| in_house_reporting | we report post-issue | India IRP (JSON 1.1, IRN+signed QR back) |
| in_house_clearance | clear BEFORE valid | KSA ZATCA Phase 2 (UBL 2.1, XAdES, TLV QR) |
| provider_routed | law requires accredited 3rd party | UAE PINT AE via ASP |
| peppol | network delivery | EU B2B later |

- ZATCA: UBL 2.1 + XAdES signature, SHA-256, PIH chain, TLV-encoded base64 QR.
  Sandbox certification before any production onboarding.
- India IRP: e-invoice for B2B where mandated; B2C hotel folios follow GST invoice
  rules without IRN. GST slabs are per-night on transaction value
  (CBIC 15/2025): ≤₹1,000 exempt · ₹1,001–7,500 @5% NO ITC · >₹7,500 @18% with ITC.
  Slab evaluation happens per room-night line, not on the folio total.
- UAE: in-house clearance is NOT permitted — ASP accreditation requires a 2-year
  operational solution. Route PINT AE XML through the configured `ae-asp:<vendor>`.
  Deadlines in-force: large taxpayers appoint ASP by 30 Oct 2026, mandatory
  1 Jan 2027 (AED 50M+), SMEs 1 Jul 2027. The adapter must be selectable per tenant.
- `fiscal_submission` records every attempt (payload hash, response, status). Retries
  are idempotent on document id; a cleared document is never re-sent.

## 3. Statutory guest registration (13th bounded context — not a feature flag)

- Config-driven per country via `statutory_adapter` extension rows; scheduler consumes
  reservation/check-in events.
- Italy Alloggiati: within 24 h of arrival, 168-char fixed-width records.
  Portugal SIBA: daily batch. India Form C: foreign nationals, on check-in, e-FRRO.
  Croatia eVisitor: on check-in.
- Identity fields required per country are declared in the extension row; check-in UI
  must block completion if a required field is missing for that property's country.
- `statutory_submission` stores what was sent, when, and the receipt. Failures alert;
  silence is non-compliance.

## 4. Trust accounting (owner/agent money is NOT revenue)

- Owner funds live in accounts with role `trust`. Postings route there via automation
  (`owner_statement_accrual`), never by hand-picking a revenue account.
- Trust accounts can never go negative against the owner without an approval_request.
- Owner statements are generated FROM postings (derivable, auditable), not maintained
  as separate balances. Commingling trust and operating funds in one account role is
  forbidden — it is the definition of the crime in most jurisdictions.

## 5. USALI mapping

- Every `tx_code` carries `usali_line`. Revenue reports group by USALI 12th edition
  lines. New charge codes without a USALI line don't ship.

## 6. GDPR / erasure

- Erasure = `erasure_request` → Party ANONYMISATION (name/contacts/identity docs
  replaced with tombstone values). Postings, journals, documents, statutory
  submissions are NEVER deleted — legal retention beats erasure for financial records
  (this is the GDPR Art. 17(3)(b) carve-out).
- Registration-card identity data follows the country's retention period from the
  statutory adapter config, then anonymises on schedule.

## 7. Payments

- `payment_instrument` stores TOKENS only. PAN/CVV never touch the database, logs, or
  events — keeps SAQ-A scope. UPI flows post through the `upi_clearing` account role
  and reconcile like any settlement.
- Refunds/voids follow the payment state machine; a captured payment is reversed by a
  new refund payment, never mutated.

## 8. Day close

- Continuous close: `seal_business_day()` seals; `assert_day_open` blocks postings to
  sealed days. Late charges go to the CURRENT open day referencing the stay — never
  reopen a sealed day. Reopening requires approval_request + compensating journal,
  and the seal event remains in the log.
