import { qrcodegen } from "./vendor/qrcodegen-v1.8.0-es6.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const DOCUMENT_NUMBER = /^[A-Za-z0-9/-]{1,16}$/;
const MONEY = /^(?:0|[1-9][0-9]{0,13})\.[0-9]{2}$/;
const RATE = /^(?:0|[1-9][0-9]{0,2})\.[0-9]{2}$/;
const COMPACT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const PROVIDER_KEY = /^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
const MAX_SOURCE_BYTES = 1024 * 1024;
const MAX_ITEMS = 366;
const MAX_INT64 = 9_223_372_036_854_775_807n;
const QUIET_ZONE = 4;
const SCREEN_PIXELS_PER_MODULE = 3;
const PRINT_MILLIMETRES = 50;

export const INVOICE_PRINT_QR_LIMITS = Object.freeze({
  maxUtf8Bytes: 2953,
  quietZoneModules: QUIET_ZONE,
  screenPixelsPerModule: SCREEN_PIXELS_PER_MODULE,
  printMillimetres: PRINT_MILLIMETRES,
});

export const INVOICE_PRINT_STYLES = `
@page { size: A4; margin: 12mm; }
.invoice-print, .invoice-print * { box-sizing: border-box; }
.invoice-print {
  width: 100%; max-width: 186mm; margin: 0 auto; padding: 0; container-type: inline-size;
  color: #000; background: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  font-size: 10pt; line-height: 1.35;
}
.invoice-print h1, .invoice-print h2, .invoice-print p, .invoice-print dl { margin-top: 0; }
.invoice-print h1 { margin-bottom: 3mm; font-size: 20pt; line-height: 1.1; }
.invoice-print h2 { margin-bottom: 2mm; font-size: 11pt; text-transform: uppercase; letter-spacing: .04em; }
.invoice-print__header, .invoice-print__parties, .invoice-print__summary, .invoice-print__provider,
.invoice-print__source { border: .3mm solid #000; margin-bottom: 4mm; padding: 3mm; }
.invoice-print__legal-number { display: flex; align-items: baseline; justify-content: space-between; gap: 4mm; }
.invoice-print__legal-number strong { font-size: 14pt; overflow-wrap: anywhere; text-align: right; }
.invoice-print__parties { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
.invoice-print__party + .invoice-print__party { border-left: .3mm solid #000; padding-left: 5mm; }
.invoice-print dl { display: grid; grid-template-columns: minmax(34mm, auto) 1fr; gap: 1mm 3mm; margin-bottom: 0; }
.invoice-print dt { font-weight: 700; overflow-wrap: anywhere; }
.invoice-print dd { margin: 0; overflow-wrap: anywhere; }
.invoice-print__items { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 4mm; font-size: 7.5pt; }
.invoice-print__items caption { padding: 0 0 2mm; font-size: 11pt; font-weight: 700; text-align: left; text-transform: uppercase; }
.invoice-print__items thead { display: table-header-group; }
.invoice-print__items tr { break-inside: avoid; }
.invoice-print__items th, .invoice-print__items td {
  border: .3mm solid #000; padding: 1.5mm; vertical-align: top; overflow-wrap: anywhere;
}
.invoice-print__items th { background: #fff; color: #000; font-weight: 700; text-align: left; }
.invoice-print__amount { text-align: right; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.invoice-print__summary { margin-left: auto; width: min(100%, 92mm); }
.invoice-print__summary dd { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.invoice-print__total { border-top: .5mm solid #000; padding-top: 1mm; font-weight: 700; }
.invoice-print__provider-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 5mm; align-items: start; }
.invoice-print__status { border: .5mm solid #000; padding: 2mm; font-weight: 700; overflow-wrap: anywhere; }
.invoice-print__qr { max-width: 100%; margin: 0; text-align: center; break-inside: avoid; }
.invoice-print__qr-note { display: none; }
.invoice-print__qr svg { display: block; max-width: none; margin: 0 auto 2mm; background: #fff; }
.invoice-print__qr figcaption { font-size: 8.5pt; overflow-wrap: anywhere; }
.invoice-print__source { break-inside: avoid; }
.invoice-print-controls, [data-print-control] { display: none !important; }
@container (max-width: 599px) {
  .invoice-print__qr svg { display: none; }
  .invoice-print__qr-note { display: block; padding: 3mm; border: .3mm solid #000; }
}
@media (max-width: 680px) {
  .invoice-print__parties, .invoice-print__provider-grid { grid-template-columns: 1fr; }
  .invoice-print__party + .invoice-print__party { border-left: 0; border-top: .3mm solid #000; padding: 3mm 0 0; }
}
@media print {
  html, body { color: #000; background: #fff; }
  .invoice-print { max-width: none; }
  .invoice-print__qr { overflow: visible; }
  .invoice-print__qr svg { display: block !important; width: 50mm !important; height: 50mm !important; }
  .invoice-print__qr-note { display: none !important; }
  .invoice-print-controls, [data-print-control] { display: none !important; }
}
`;

function frozen(value) { return Object.freeze(value); }

function failure(code, message) {
  return frozen({ ok: false, error: frozen({ code, message }) });
}

function ownRecord(value, maximumKeys = 64) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length > maximumKeys || keys.some((key) => typeof key !== "string")) return null;
    const result = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function exact(value, required, optional = []) {
  const keys = Object.keys(value);
  const permitted = new Set([...required, ...optional]);
  return keys.length >= required.length && keys.length <= required.length + optional.length
    && required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => permitted.has(key));
}

function validText(value, maximum) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum * 2
    && value === value.trim() && !CONTROL.test(value) && Array.from(value).length <= maximum;
}

function validDate(value) {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}

function validTimestamp(value) {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)) return false;
  const millisecondInstant = new Date(`${value.slice(0, 23)}Z`);
  return Number.isFinite(millisecondInstant.getTime()) && millisecondInstant.toISOString() === `${value.slice(0, 23)}Z`;
}

function validAcknowledgementDate(value) {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return false;
  const utc = `${value.replace(" ", "T")}Z`;
  const instant = new Date(utc);
  return Number.isFinite(instant.getTime()) && `${instant.toISOString().slice(0, 19)}Z` === utc;
}

function decimal(value) {
  if (typeof value !== "string" || !MONEY.test(value)) return null;
  const minor = BigInt(value.replace(".", ""));
  return minor <= MAX_INT64 ? frozen({ text: value, minor }) : null;
}

function add(left, right) {
  const sum = left + right;
  if (sum > MAX_INT64) throw new RangeError("money exceeds signed 64-bit bounds");
  return sum;
}

function validParty(value, buyer) {
  const row = ownRecord(value, 8);
  const required = buyer
    ? ["Gstin", "LglNm", "Addr1", "Loc", "Pin", "Stcd", "Pos"]
    : ["Gstin", "LglNm", "Addr1", "Loc", "Pin", "Stcd"];
  if (!row || !exact(row, required, ["TrdNm"]) || typeof row.Gstin !== "string" || !GSTIN.test(row.Gstin)
    || !validText(row.LglNm, 100) || (Object.hasOwn(row, "TrdNm") && !validText(row.TrdNm, 100))
    || !validText(row.Addr1, 100) || !validText(row.Loc, 50)
    || typeof row.Pin !== "number" || !Number.isSafeInteger(row.Pin) || row.Pin < 100000 || row.Pin > 999999
    || typeof row.Stcd !== "string" || !/^(?:0[1-9]|1[0-9]|2[0-46-9]|3[0-8])$/.test(row.Stcd)
    || row.Gstin.slice(0, 2) !== row.Stcd
    || (buyer && (typeof row.Pos !== "string" || !/^(?:0[1-9]|1[0-9]|2[0-46-9]|3[0-8])$/.test(row.Pos)))) return null;
  return frozen({ gstin: row.Gstin, legalName: row.LglNm, tradeName: row.TrdNm ?? null,
    address: row.Addr1, locality: row.Loc, pin: String(row.Pin), stateCode: row.Stcd,
    placeOfSupply: buyer ? row.Pos : null });
}

function validItem(value, index) {
  const row = ownRecord(value, 13);
  const common = ["SlNo", "IsServc", "HsnCd", "Qty", "Unit", "UnitPrice", "TotAmt", "AssAmt", "GstRt", "TotItemVal"];
  const family = row && Object.hasOwn(row, "IgstAmt") ? "igst" : "split";
  const keys = family === "igst" ? [...common, "IgstAmt"] : [...common, "CgstAmt", "SgstAmt"];
  if (!row || !exact(row, keys) || row.SlNo !== String(index + 1) || row.IsServc !== "Y"
    || typeof row.HsnCd !== "string" || !/^\d{6}$/.test(row.HsnCd)
    || row.Qty !== "1.000" || row.Unit !== "OTH" || typeof row.GstRt !== "string" || !RATE.test(row.GstRt)) return null;
  const unitPrice = decimal(row.UnitPrice);
  const totalAmount = decimal(row.TotAmt);
  const assessable = decimal(row.AssAmt);
  const total = decimal(row.TotItemVal);
  if (!unitPrice || !totalAmount || !assessable || !total
    || unitPrice.minor !== totalAmount.minor || totalAmount.minor !== assessable.minor) return null;
  if (family === "igst") {
    const igst = decimal(row.IgstAmt);
    if (!igst || add(assessable.minor, igst.minor) !== total.minor) return null;
    return frozen({ line: row.SlNo, sac: row.HsnCd, quantity: row.Qty, unit: row.Unit,
      unitPrice: unitPrice.text, assessable: assessable.text, rate: row.GstRt, family,
      igst: igst.text, cgst: null, sgst: null, taxMinor: igst.minor, total: total.text,
      totalMinor: total.minor, assessableMinor: assessable.minor });
  }
  const cgst = decimal(row.CgstAmt);
  const sgst = decimal(row.SgstAmt);
  if (!cgst || !sgst || add(add(assessable.minor, cgst.minor), sgst.minor) !== total.minor) return null;
  return frozen({ line: row.SlNo, sac: row.HsnCd, quantity: row.Qty, unit: row.Unit,
    unitPrice: unitPrice.text, assessable: assessable.text, rate: row.GstRt, family,
    igst: null, cgst: cgst.text, sgst: sgst.text, taxMinor: add(cgst.minor, sgst.minor),
    total: total.text, totalMinor: total.minor, assessableMinor: assessable.minor });
}

function snapshotInvoice(value) {
  const row = ownRecord(value, 16);
  const keys = ["kind", "documentId", "propertyNode", "reservationId", "folioId", "seriesId", "documentNumber",
    "businessDate", "issuedAt", "recipientRegistrationId", "sourceEvidenceHash", "documentSha256", "previousHash", "contentJson"];
  if (!row || !exact(row, keys) || row.kind !== "india_native_invoice_v1"
    || ![row.documentId, row.propertyNode, row.reservationId, row.folioId, row.seriesId, row.recipientRegistrationId]
      .every((candidate) => typeof candidate === "string" && UUID.test(candidate))
    || typeof row.documentNumber !== "string" || !DOCUMENT_NUMBER.test(row.documentNumber)
    || !validDate(row.businessDate) || !validTimestamp(row.issuedAt)
    || typeof row.sourceEvidenceHash !== "string" || !SHA256.test(row.sourceEvidenceHash)
    || typeof row.documentSha256 !== "string" || !SHA256.test(row.documentSha256)
    || (row.previousHash !== null && (typeof row.previousHash !== "string" || !SHA256.test(row.previousHash)))
    || typeof row.contentJson !== "string" || row.contentJson.length === 0 || row.contentJson.length > MAX_SOURCE_BYTES
    || new TextEncoder().encode(row.contentJson).byteLength > MAX_SOURCE_BYTES) return null;
  let source;
  try { source = ownRecord(JSON.parse(row.contentJson), 7); } catch { return null; }
  if (!source || !exact(source, ["Version", "TranDtls", "DocDtls", "SellerDtls", "BuyerDtls", "ItemList", "ValDtls"])
    || source.Version !== "1.1") return null;
  const transaction = ownRecord(source.TranDtls, 2);
  const identity = ownRecord(source.DocDtls, 3);
  const expectedDate = `${row.businessDate.slice(8, 10)}/${row.businessDate.slice(5, 7)}/${row.businessDate.slice(0, 4)}`;
  if (!transaction || !exact(transaction, ["TaxSch", "SupTyp"]) || transaction.TaxSch !== "GST" || transaction.SupTyp !== "B2B"
    || !identity || !exact(identity, ["Typ", "No", "Dt"]) || identity.Typ !== "INV"
    || identity.No !== row.documentNumber || identity.Dt !== expectedDate) return null;
  const seller = validParty(source.SellerDtls, false);
  const buyer = validParty(source.BuyerDtls, true);
  if (!seller || !buyer || !Array.isArray(source.ItemList) || Object.getPrototypeOf(source.ItemList) !== Array.prototype
    || source.ItemList.length < 1 || source.ItemList.length > MAX_ITEMS) return null;
  const items = source.ItemList.map((candidate, index) => validItem(candidate, index));
  if (items.some((candidate) => candidate === null)) return null;
  const projected = items;
  const family = projected[0].family;
  if (projected.some((candidate) => candidate.family !== family)) return null;
  const totals = ownRecord(source.ValDtls, 4);
  const totalKeys = family === "igst" ? ["AssVal", "IgstVal", "TotInvVal"] : ["AssVal", "CgstVal", "SgstVal", "TotInvVal"];
  if (!totals || !exact(totals, totalKeys)) return null;
  const assessable = decimal(totals.AssVal);
  const total = decimal(totals.TotInvVal);
  if (!assessable || !total) return null;
  const itemAssessable = projected.reduce((sum, item) => add(sum, item.assessableMinor), 0n);
  const itemTax = projected.reduce((sum, item) => add(sum, item.taxMinor), 0n);
  const itemTotal = projected.reduce((sum, item) => add(sum, item.totalMinor), 0n);
  let taxParts;
  if (family === "igst") {
    const igst = decimal(totals.IgstVal);
    if (!igst || igst.minor !== itemTax || add(assessable.minor, igst.minor) !== total.minor) return null;
    taxParts = frozen({ igst: igst.text, cgst: null, sgst: null });
  } else {
    const cgst = decimal(totals.CgstVal);
    const sgst = decimal(totals.SgstVal);
    if (!cgst || !sgst || add(cgst.minor, sgst.minor) !== itemTax
      || add(add(assessable.minor, cgst.minor), sgst.minor) !== total.minor) return null;
    taxParts = frozen({ igst: null, cgst: cgst.text, sgst: sgst.text });
  }
  if (assessable.minor !== itemAssessable || total.minor !== itemTotal) return null;
  return frozen({ ...row, documentDate: identity.Dt, seller, buyer, items: frozen(projected), family,
    totals: frozen({ assessable: assessable.text, total: total.text, ...taxParts }) });
}

function validCodes(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (!length || !("value" in length) || !Number.isInteger(length.value) || length.value < 1 || length.value > 32
    || Reflect.ownKeys(value).length !== length.value + 1) return null;
  const result = [];
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) return null;
    const candidate = descriptor.value;
    if (!validText(candidate, 64) || result.includes(candidate)) return null;
    result.push(candidate);
  }
  return frozen(result);
}

function validCompact(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1_404_249 && COMPACT.test(value);
}

function snapshotReceipt(value, document) {
  const row = ownRecord(value, 32);
  const base = ["kind", "submissionId", "tenantId", "propertyNode", "documentId", "documentSha256", "wireSha256",
    "providerKey", "attemptId", "attemptNumber", "status", "disposition", "transitionSeq"];
  if (!row || ![row.submissionId, row.tenantId, row.propertyNode, row.documentId, row.attemptId]
    .every((candidate) => typeof candidate === "string" && UUID.test(candidate))
    || row.documentId !== document.documentId || row.propertyNode !== document.propertyNode
    || row.documentSha256 !== document.documentSha256 || typeof row.wireSha256 !== "string" || !SHA256.test(row.wireSha256)
    || typeof row.providerKey !== "string" || !PROVIDER_KEY.test(row.providerKey)
    || !Number.isSafeInteger(row.attemptNumber) || row.attemptNumber < 1 || row.attemptNumber > 4
    || !Number.isSafeInteger(row.transitionSeq) || row.transitionSeq < 1) return null;
  if (row.kind === "pending") {
    if (!exact(row, base) || !((row.status === "pending" && row.disposition === "send")
      || (row.status === "submitted" && row.disposition === "lookup")
      || (row.status === "error" && row.disposition === "retry"))) return null;
    return frozen({ kind: row.kind, row });
  }
  if (row.kind === "legacy_hash_only") {
    if (!exact(row, [...base, "authorityRef", "responseSha256"]) || row.disposition !== "none"
      || (row.status !== "accepted" && row.status !== "rejected")
      || (row.authorityRef !== null && !validText(row.authorityRef, 256))
      || (row.responseSha256 !== null && (typeof row.responseSha256 !== "string" || !SHA256.test(row.responseSha256)))) return null;
    return frozen({ kind: row.kind, row });
  }
  const shared = [...base, "environment", "responseSha256"];
  if ((row.environment !== "sandbox" && row.environment !== "production")
    || typeof row.responseSha256 !== "string" || !SHA256.test(row.responseSha256) || row.disposition !== "none") return null;
  if (row.kind === "rejected") {
    const codes = validCodes(row.errorCodes);
    if (!exact(row, [...shared, "errorCodes"]) || row.status !== "rejected" || !codes) return null;
    return frozen({ kind: row.kind, row, codes });
  }
  if (row.kind === "provider_cancelled") {
    if (!exact(row, [...shared, "providerStatus"]) || row.status !== "error" || row.providerStatus !== "CNL") return null;
    return frozen({ kind: row.kind, row });
  }
  if (row.kind !== "accepted_signed_v1" || row.status !== "accepted") return null;
  const verification = ownRecord(row.verification, 9);
  const verificationKeys = ["profileVersion", "issuer", "verificationUnixMs", "invoiceKeyId", "invoiceKeySpkiSha256",
    "invoiceBundleVersion", "qrKeyId", "qrKeySpkiSha256", "qrBundleVersion"];
  if (!exact(row, [...shared, "irn", "ackNo", "ackDt", "signedInvoice", "signedQRCode", "signedInvoiceSha256",
    "signedQrSha256", "verification"]) || typeof row.irn !== "string" || !SHA256.test(row.irn)
    || typeof row.ackNo !== "string" || !/^[1-9][0-9]{0,63}$/.test(row.ackNo)
    || !validAcknowledgementDate(row.ackDt)
    || typeof row.signedQRCode !== "string" || row.signedQRCode.length < 1 || row.signedQRCode.length > 1_404_249
    || !validCompact(row.signedInvoice)
    || typeof row.signedInvoiceSha256 !== "string" || !SHA256.test(row.signedInvoiceSha256)
    || typeof row.signedQrSha256 !== "string" || !SHA256.test(row.signedQrSha256)
    || !verification || !exact(verification, verificationKeys)
    || verification.profileVersion !== "yellow_native_india_1_1_v1" || !validText(verification.issuer, 128)
    || !Number.isSafeInteger(verification.verificationUnixMs) || verification.verificationUnixMs < 0
    || !validText(verification.invoiceKeyId, 256) || !validText(verification.invoiceBundleVersion, 128)
    || !validText(verification.qrKeyId, 256) || !validText(verification.qrBundleVersion, 128)
    || typeof verification.invoiceKeySpkiSha256 !== "string" || !SHA256.test(verification.invoiceKeySpkiSha256)
    || typeof verification.qrKeySpkiSha256 !== "string" || !SHA256.test(verification.qrKeySpkiSha256)) return null;
  return frozen({ kind: row.kind, row, verification: frozen(verification) });
}

function snapshotDelivery(value, document) {
  const row = ownRecord(value, 4);
  if (!row || typeof row.kind !== "string" || row.documentId !== document.documentId) return null;
  if (["unavailable", "not_requested", "ambiguous"].includes(row.kind)) {
    return exact(row, ["kind", "documentId"]) ? frozen({ kind: row.kind }) : null;
  }
  if (row.kind === "legacy_unsupported") {
    return exact(row, ["kind", "documentId", "submissionId"]) && typeof row.submissionId === "string" && UUID.test(row.submissionId)
      ? frozen({ kind: row.kind }) : null;
  }
  if (row.kind !== "receipt" || !exact(row, ["kind", "documentId", "receipt"])) return null;
  const receipt = snapshotReceipt(row.receipt, document);
  return receipt ? frozen({ kind: row.kind, receipt }) : null;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

function detailRows(rows) {
  return `<dl>${rows.map(([label, value, className = ""]) =>
    `<dt>${escapeHtml(label)}</dt><dd${className ? ` class="${className}"` : ""}>${escapeHtml(value)}</dd>`).join("")}</dl>`;
}

function registrationStatus(delivery) {
  if (delivery.kind === "unavailable") return frozen({ code: "unavailable", label: "Registration not checked",
    detail: "Receipt access was unavailable. This print does not state provider registration." });
  if (delivery.kind === "not_requested") return frozen({ code: "not_requested", label: "Not registered — registration not requested",
    detail: "No provider submission is recorded for this invoice." });
  if (delivery.kind === "ambiguous") return frozen({ code: "ambiguous", label: "Registration status is ambiguous",
    detail: "More than one submission is linked. Provider registration is not stated." });
  if (delivery.kind === "legacy_unsupported") return frozen({ code: "legacy_unsupported", label: "Legacy provider evidence",
    detail: "A legacy submission exists, but a signed delivery receipt is unavailable." });
  const receipt = delivery.receipt;
  if (receipt.kind === "pending") {
    const detail = receipt.row.status === "pending" ? "Provider submission is queued and is not yet registered."
      : receipt.row.status === "submitted" ? "Provider acknowledgement lookup is pending; registration is not yet confirmed."
        : "Provider retry is required; registration is not confirmed.";
    return frozen({ code: "pending", label: "Registration pending", detail });
  }
  if (receipt.kind === "legacy_hash_only") return frozen({ code: "legacy_hash_only", label: "Legacy provider evidence",
    detail: "Only legacy hash evidence is retained; no signed QR is available." });
  if (receipt.kind === "rejected") return frozen({ code: "rejected", label: "Registration rejected — not registered",
    detail: `${receipt.row.environment === "sandbox" ? "Sandbox" : "Production"} provider rejected this submission.` });
  if (receipt.kind === "provider_cancelled") return frozen({ code: "provider_cancelled", label: "Registration cancelled by provider — not registered",
    detail: `${receipt.row.environment === "sandbox" ? "Sandbox" : "Production"} provider reports status CNL.` });
  if (receipt.row.environment === "sandbox") return frozen({ code: "accepted_sandbox", label: "SANDBOX — not a production registration",
    detail: "A server-verified signed sandbox receipt is retained for this exact issued document." });
  return frozen({ code: "accepted_production", label: "IRP registered",
    detail: "A server-verified signed production receipt is retained for this exact issued document." });
}

/**
 * Builds a QR matrix from the exact compact signed token. The preflight bound is
 * checked before calling the encoder. This generates a matrix; it does not verify
 * the signature or independently decode the rendered symbol.
 */
export function createSignedQrArtifact(token) {
  if (typeof token !== "string") return failure("invalid_delivery", "Signed QR data is invalid");
  if (token.length > INVOICE_PRINT_QR_LIMITS.maxUtf8Bytes) {
    return failure("qr_capacity_exceeded", "Signed QR data is too large to print safely");
  }
  const bytes = new TextEncoder().encode(token);
  if (bytes.byteLength > INVOICE_PRINT_QR_LIMITS.maxUtf8Bytes) {
    return failure("qr_capacity_exceeded", "Signed QR data is too large to print safely");
  }
  if (!COMPACT.test(token)) return failure("invalid_delivery", "Signed QR data is invalid");
  try {
    const code = qrcodegen.QrCode.encodeBinary(Array.from(bytes), qrcodegen.QrCode.Ecc.LOW);
    const size = code.size + QUIET_ZONE * 2;
    const modules = [];
    const path = [];
    for (let y = 0; y < size; y += 1) {
      const row = [];
      for (let x = 0; x < size; x += 1) {
        const dark = code.getModule(x - QUIET_ZONE, y - QUIET_ZONE);
        row.push(dark);
        if (dark) path.push(`M${x} ${y}h1v1h-1z`);
      }
      modules.push(frozen(row));
    }
    const screenPixels = size * SCREEN_PIXELS_PER_MODULE;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${screenPixels}" height="${screenPixels}" data-qr-modules="${size}" data-qr-screen-pixels="${screenPixels}" role="img" aria-label="Provider-signed invoice QR code" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path.join("")}" fill="#000"/></svg>`;
    return frozen({ ok: true, value: frozen({ quietZone: QUIET_ZONE, size,
      screenPixels, printMillimetres: PRINT_MILLIMETRES, modules: frozen(modules), svg }) });
  } catch {
    return failure("qr_capacity_exceeded", "Signed QR data is too large to print safely");
  }
}

function partyMarkup(label, party) {
  const rows = [["Legal name", party.legalName]];
  if (party.tradeName !== null) rows.push(["Trade name", party.tradeName]);
  rows.push(["GSTIN", party.gstin], ["Address", party.address], ["Locality", party.locality],
    ["PIN", party.pin], ["State code", party.stateCode]);
  if (party.placeOfSupply !== null) rows.push(["Place of supply", party.placeOfSupply]);
  return `<section class="invoice-print__party"><h2>${escapeHtml(label)}</h2>${detailRows(rows)}</section>`;
}

function itemsMarkup(document) {
  const taxHeadings = document.family === "igst" ? "<th>IGST</th>" : "<th>CGST</th><th>SGST</th>";
  const columns = document.family === "igst"
    ? ["5%", "9%", "6%", "7%", "15%", "15%", "8%", "15%", "20%"]
    : ["5%", "9%", "6%", "7%", "13%", "13%", "7%", "12%", "12%", "16%"];
  const columnMarkup = `<colgroup>${columns.map((width) => `<col style="width:${width}">`).join("")}</colgroup>`;
  const rows = document.items.map((item) => {
    const taxCells = item.family === "igst"
      ? `<td class="invoice-print__amount">${escapeHtml(item.igst)}</td>`
      : `<td class="invoice-print__amount">${escapeHtml(item.cgst)}</td><td class="invoice-print__amount">${escapeHtml(item.sgst)}</td>`;
    return `<tr><td>${escapeHtml(item.line)}</td><td>${escapeHtml(item.sac)}</td><td>${escapeHtml(item.quantity)}</td>`
      + `<td>${escapeHtml(item.unit)}</td><td class="invoice-print__amount">${escapeHtml(item.unitPrice)}</td>`
      + `<td class="invoice-print__amount">${escapeHtml(item.assessable)}</td><td class="invoice-print__amount">${escapeHtml(item.rate)}%</td>`
      + `${taxCells}<td class="invoice-print__amount">${escapeHtml(item.total)}</td></tr>`;
  }).join("");
  return `<table class="invoice-print__items"><caption>Invoice line items</caption>${columnMarkup}<thead><tr><th>Line</th><th>HSN/SAC</th><th>Qty</th><th>Unit</th>`
    + `<th>Unit price</th><th>Taxable</th><th>GST rate</th>${taxHeadings}<th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function totalsMarkup(document) {
  const rows = [["Taxable value", document.totals.assessable, "invoice-print__amount"]];
  if (document.family === "igst") rows.push(["IGST", document.totals.igst, "invoice-print__amount"]);
  else rows.push(["CGST", document.totals.cgst, "invoice-print__amount"], ["SGST", document.totals.sgst, "invoice-print__amount"]);
  rows.push(["Invoice total (INR)", document.totals.total, "invoice-print__amount invoice-print__total"]);
  return `<section class="invoice-print__summary" aria-label="Invoice totals">${detailRows(rows)}</section>`;
}

function providerMarkup(delivery, status, qr) {
  let details = "";
  if (delivery.kind === "receipt") {
    const receipt = delivery.receipt;
    if (receipt.kind === "accepted_signed_v1") {
      details = `<h2>IRP acknowledgement</h2>${detailRows([["IRN", receipt.row.irn], ["Acknowledgement number", receipt.row.ackNo],
        ["Acknowledgement date", receipt.row.ackDt], ["Provider", receipt.row.providerKey], ["Environment", receipt.row.environment],
        ["Verification issuer", receipt.verification.issuer], ["QR key ID", receipt.verification.qrKeyId],
        ["Signed invoice SHA-256", receipt.row.signedInvoiceSha256], ["Signed QR SHA-256", receipt.row.signedQrSha256]])}`;
    } else if (receipt.kind === "rejected") {
      details = `<h2>Provider response</h2>${detailRows([["Provider", receipt.row.providerKey],
        ["Error codes", receipt.codes.join(", ")]])}`;
    } else if (receipt.kind === "provider_cancelled" || receipt.kind === "pending" || receipt.kind === "legacy_hash_only") {
      details = `<h2>Provider submission</h2>${detailRows([["Provider", receipt.row.providerKey]])}`;
    }
  }
  const qrMarkup = qr ? `<figure class="invoice-print__qr">${qr.svg}<p class="invoice-print__qr-note">Use Print for the full-size, scannable QR. This narrow preview does not shrink or crop the signed code.</p><figcaption>Provider-signed QR retained with this issued invoice.</figcaption></figure>` : "";
  return `<section class="invoice-print__provider" data-registration-state="${escapeHtml(status.code)}"><h2>Provider registration</h2>`
    + `<div class="invoice-print__status"><strong>${escapeHtml(status.label)}</strong><p>${escapeHtml(status.detail)}</p></div>`
    + `<div class="invoice-print__provider-grid"><div>${details}</div>${qrMarkup}</div></section>`;
}

/**
 * Creates theme-independent, escaped invoice markup from the server-validated
 * IndiaNativeFiscalInvoiceDocument and the explicit by-document delivery union.
 * The server owns content hash/signature authentication; this client module
 * revalidates printable structure and exact identity without claiming new proof.
 * It retains no cache and performs no I/O.
 */
export function buildInvoicePrintArtifact(documentValue, deliveryValue) {
  let document;
  try { document = snapshotInvoice(documentValue); } catch { document = null; }
  if (!document) return failure("invalid_document", "Issued invoice data is invalid");
  const delivery = snapshotDelivery(deliveryValue, document);
  if (!delivery) return failure("invalid_delivery", "Invoice registration data is invalid");
  const status = registrationStatus(delivery);
  let qr = null;
  if (delivery.kind === "receipt" && delivery.receipt.kind === "accepted_signed_v1") {
    const encoded = createSignedQrArtifact(delivery.receipt.row.signedQRCode);
    if (!encoded.ok) return encoded;
    qr = encoded.value;
  }
  const markup = `<article class="invoice-print" aria-labelledby="invoice-print-title">`
    + `<header class="invoice-print__header"><h1 id="invoice-print-title">Tax invoice</h1>`
    + `<p class="invoice-print__legal-number"><span>Invoice number</span><strong>${escapeHtml(document.documentNumber)}</strong></p>`
    + `${detailRows([["Invoice date", document.documentDate], ["Document type", "INV"], ["Currency", "INR"]])}</header>`
    + `<div class="invoice-print__parties">${partyMarkup("Seller", document.seller)}${partyMarkup("Buyer", document.buyer)}</div>`
    + `${itemsMarkup(document)}${totalsMarkup(document)}${providerMarkup(delivery, status, qr)}`
    + `<section class="invoice-print__source"><h2>Immutable source identity</h2>${detailRows([
      ["Document ID", document.documentId], ["Series ID", document.seriesId], ["Reservation ID", document.reservationId],
      ["Folio ID", document.folioId], ["Recipient registration ID", document.recipientRegistrationId],
      ["Issued at (UTC)", document.issuedAt], ["Source evidence SHA-256", document.sourceEvidenceHash],
      ["Document SHA-256", document.documentSha256],
      ["Previous document hash", document.previousHash ?? "Genesis — no previous document hash"],
    ])}</section></article>`;
  return frozen({ ok: true, value: frozen({ title: "Tax invoice", markup,
    stylesheet: INVOICE_PRINT_STYLES, status, qr }) });
}
