const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^(?!0000)\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP = /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const MONEY_MINOR = /^(?:0|[1-9][0-9]{0,18})$/;
const DOCUMENT_NUMBER = /^[A-Za-z0-9/-]{1,16}$/;
const PAGE_SIZE = 50;
const MAX_RETAINED_INVOICES = 300;
const MAX_CURSOR_CHARS = 2048;
const MAX_RECIPIENTS = 500;
const MAX_PROVIDERS = 16;
const HASH = /^[0-9a-f]{64}$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PROVIDER_KEY = /^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function ownRecord(value, maximumKeys = 32) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length > maximumKeys || keys.some((key) => typeof key !== "string")) return null;
    const snapshot = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) return null;
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch {
    return null;
  }
}

function exactRecord(value, keys) {
  const row = ownRecord(value, keys.length);
  return row && Object.keys(row).length === keys.length && keys.every((key) => Object.hasOwn(row, key)) ? row : null;
}

function ownArray(value, maximum) {
  if (!Array.isArray(value)) return null;
  try {
    const length = Object.getOwnPropertyDescriptor(value, "length");
    if (!length || !("value" in length) || !Number.isInteger(length.value) || length.value < 0 || length.value > maximum) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).length !== length.value + 1) return null;
    const result = [];
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function validDate(value) {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function addDays(value, offset) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + offset);
  return parsed.toISOString().slice(0, 10);
}

function dateInTimezone(timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function validText(value, maximum) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum * 2
    && Array.from(value).length <= maximum && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

function matches(value, pattern) {
  return typeof value === "string" && pattern.test(value);
}

function summary(value) {
  const row = ownRecord(value, 13);
  if (!row || typeof row.documentId !== "string" || !UUID.test(row.documentId)
    || typeof row.documentNumber !== "string" || !DOCUMENT_NUMBER.test(row.documentNumber)
    || !validDate(row.businessDate) || typeof row.issuedAt !== "string" || !TIMESTAMP.test(row.issuedAt)
    || !UUID.test(row.reservationId) || !UUID.test(row.folioId) || !UUID.test(row.recipientRegistrationId)
    || !validText(row.buyerName, 256) || typeof row.buyerGstin !== "string" || row.buyerGstin.length !== 15
    || row.currency !== "INR" || !MONEY_MINOR.test(row.taxableMinor)
    || !MONEY_MINOR.test(row.taxMinor) || !MONEY_MINOR.test(row.totalMinor)) return null;
  return Object.freeze({ documentId: row.documentId, documentNumber: row.documentNumber,
    businessDate: row.businessDate, issuedAt: row.issuedAt, reservationId: row.reservationId,
    folioId: row.folioId, recipientRegistrationId: row.recipientRegistrationId,
    buyerName: row.buyerName, buyerGstin: row.buyerGstin, currency: "INR",
    taxableMinor: row.taxableMinor, taxMinor: row.taxMinor, totalMinor: row.totalMinor });
}

function listEnvelope(value) {
  const wrapper = ownRecord(value, 1);
  const invoices = wrapper && ownRecord(wrapper.invoices, 3);
  if (!invoices || !Array.isArray(invoices.items) || invoices.items.length > PAGE_SIZE
    || typeof invoices.matchingCount !== "string" || !MONEY_MINOR.test(invoices.matchingCount)
    || (invoices.nextCursor !== null && (typeof invoices.nextCursor !== "string"
      || invoices.nextCursor.length < 1 || invoices.nextCursor.length > MAX_CURSOR_CHARS
      || !/^[A-Za-z0-9_-]+$/.test(invoices.nextCursor)))) return null;
  const items = invoices.items.map(summary);
  if (items.some((item) => item === null)) return null;
  return Object.freeze({ items: Object.freeze(items), matchingCount: invoices.matchingCount,
    nextCursor: invoices.nextCursor });
}

function issueRoute(value) {
  const row = exactRecord(value, ["reservationId", "folioId"]);
  if (!row || !matches(row.reservationId, UUID) || !matches(row.folioId, UUID)) return null;
  return Object.freeze({ reservationId: row.reservationId, folioId: row.folioId });
}

function readinessParty(value, buyer) {
  const keys = buyer
    ? ["legalName", "gstin", "stateCode", "addressLine", "locality", "postalCode", "recipientRegistrationId"]
    : ["legalName", "gstin", "stateCode", "addressLine", "locality", "postalCode"];
  const row = exactRecord(value, keys);
  if (!row || !validText(row.legalName, 100) || !matches(row.gstin, GSTIN)
    || typeof row.stateCode !== "string" || !/^[0-9]{2}$/.test(row.stateCode) || !row.gstin.startsWith(row.stateCode)
    || !validText(row.addressLine, 100) || !validText(row.locality, 50)
    || typeof row.postalCode !== "string" || !/^[1-9][0-9]{5}$/.test(row.postalCode)
    || (buyer && !matches(row.recipientRegistrationId, UUID))) return null;
  return Object.freeze({ legalName: row.legalName, gstin: row.gstin, stateCode: row.stateCode,
    addressLine: row.addressLine, locality: row.locality, postalCode: row.postalCode,
    ...(buyer ? { recipientRegistrationId: row.recipientRegistrationId } : {}) });
}

function selectionRecipient(value) {
  const row = exactRecord(value, ["recipientRegistrationId", "legalName", "gstin", "stateCode"]);
  if (!row || !matches(row.recipientRegistrationId, UUID) || !validText(row.legalName, 100)
    || !matches(row.gstin, GSTIN)
    || typeof row.stateCode !== "string" || !/^[0-9]{2}$/.test(row.stateCode)
    || !row.gstin.startsWith(row.stateCode)) return null;
  return Object.freeze({ recipientRegistrationId: row.recipientRegistrationId, legalName: row.legalName,
    gstin: row.gstin, stateCode: row.stateCode });
}

function readinessEnvelope(value, selectedRecipientId) {
  const wrapper = exactRecord(value, ["readiness"]);
  const row = wrapper && ownRecord(wrapper.readiness, 4);
  if (!row || typeof row.kind !== "string") return null;
  if (row.kind === "issued") {
    return Object.keys(row).length === 2 && Object.hasOwn(row, "documentId") && matches(row.documentId, UUID)
      ? Object.freeze({ kind: "issued", documentId: row.documentId }) : null;
  }
  if (row.kind === "blocked") {
    return Object.keys(row).length === 2 && Object.hasOwn(row, "blocker") && BLOCKER_TEXT.has(row.blocker)
      ? Object.freeze({ kind: "blocked", blocker: row.blocker }) : null;
  }
  if (row.kind === "selection_required" && selectedRecipientId === null
    && Object.keys(row).length === 2 && Object.hasOwn(row, "recipients")) {
    const values = ownArray(row.recipients, MAX_RECIPIENTS);
    if (!values || values.length === 0) return null;
    const recipients = values.map(selectionRecipient);
    if (recipients.some((recipient) => recipient === null)
      || new Set(recipients.map((recipient) => recipient.recipientRegistrationId)).size !== recipients.length) return null;
    return Object.freeze({ kind: "selection_required", recipients: Object.freeze(recipients) });
  }
  if (row.kind !== "ready" || selectedRecipientId === null || Object.keys(row).length !== 4
    || !Object.hasOwn(row, "selectorHash") || !Object.hasOwn(row, "evidenceHash") || !Object.hasOwn(row, "confirmation")
    || !matches(row.selectorHash, HASH) || !matches(row.evidenceHash, HASH)) return null;
  const confirmation = exactRecord(row.confirmation, ["buyer", "seller", "placeOfSupplyStateCode", "issueDate",
    "timeOfSupplyDate", "serviceProvisionDate", "paymentReceiptDate", "seriesPrefix", "financialYearStart",
    "currency", "taxableMinor", "taxMinor", "totalMinor", "configuration", "roomNights"]);
  if (!confirmation) return null;
  const buyer = readinessParty(confirmation.buyer, true), seller = readinessParty(confirmation.seller, false);
  const configuration = exactRecord(confirmation.configuration, ["extensionId", "version", "contentHash"]);
  const nights = ownArray(confirmation.roomNights, 366);
  if (!buyer || buyer.recipientRegistrationId !== selectedRecipientId || !seller || !configuration
    || !matches(configuration.extensionId, UUID) || !Number.isSafeInteger(configuration.version)
    || configuration.version < 1 || configuration.version > 2147483647
    || !matches(configuration.contentHash, HASH)
    || typeof confirmation.placeOfSupplyStateCode !== "string" || !/^[0-9]{2}$/.test(confirmation.placeOfSupplyStateCode)
    || ![confirmation.issueDate, confirmation.timeOfSupplyDate, confirmation.serviceProvisionDate,
      confirmation.paymentReceiptDate, confirmation.financialYearStart].every(validDate)
    || typeof confirmation.seriesPrefix !== "string" || !/^[A-Za-z0-9/-]{1,12}$/.test(confirmation.seriesPrefix)
    || confirmation.currency !== "INR" || !matches(confirmation.taxableMinor, MONEY_MINOR)
    || !matches(confirmation.taxMinor, MONEY_MINOR) || !matches(confirmation.totalMinor, MONEY_MINOR)
    || BigInt(confirmation.taxableMinor) + BigInt(confirmation.taxMinor) !== BigInt(confirmation.totalMinor)
    || !nights || nights.length === 0) return null;
  let taxable = 0n; let tax = 0n;
  const roomNights = nights.map((value, index) => {
    const night = exactRecord(value, ["ordinal", "businessDate", "taxableMinor", "taxMinor", "aggregateRateBasisPoints", "components"]);
    const components = night && ownArray(night.components, 4);
    if (!night || night.ordinal !== index || !validDate(night.businessDate) || !matches(night.taxableMinor, MONEY_MINOR)
      || !matches(night.taxMinor, MONEY_MINOR) || !Number.isSafeInteger(night.aggregateRateBasisPoints)
      || night.aggregateRateBasisPoints < 0 || night.aggregateRateBasisPoints > 10000 || !components || components.length === 0) return null;
    const projected = components.map((componentValue) => {
      const component = exactRecord(componentValue, ["identity", "rateBasisPoints", "taxMinor"]);
      if (!component || !matches(component.identity, /^(igst|cgst|sgst|utgst)$/)
        || !Number.isSafeInteger(component.rateBasisPoints) || component.rateBasisPoints < 0 || component.rateBasisPoints > 10000
        || !matches(component.taxMinor, MONEY_MINOR)) return null;
      return Object.freeze({ identity: component.identity, rateBasisPoints: component.rateBasisPoints, taxMinor: component.taxMinor });
    });
    if (projected.some((component) => component === null)
      || new Set(projected.map((component) => component.identity)).size !== projected.length
      || projected.reduce((sum, component) => sum + component.rateBasisPoints, 0) !== night.aggregateRateBasisPoints
      || projected.reduce((sum, component) => sum + BigInt(component.taxMinor), 0n) !== BigInt(night.taxMinor)) return null;
    taxable += BigInt(night.taxableMinor); tax += BigInt(night.taxMinor);
    return Object.freeze({ ordinal: night.ordinal, businessDate: night.businessDate, taxableMinor: night.taxableMinor,
      taxMinor: night.taxMinor, aggregateRateBasisPoints: night.aggregateRateBasisPoints, components: Object.freeze(projected) });
  });
  if (roomNights.some((night) => night === null) || taxable !== BigInt(confirmation.taxableMinor)
    || tax !== BigInt(confirmation.taxMinor)) return null;
  return Object.freeze({ kind: "ready", selectorHash: row.selectorHash, evidenceHash: row.evidenceHash,
    confirmation: Object.freeze({ buyer, seller, placeOfSupplyStateCode: confirmation.placeOfSupplyStateCode,
      issueDate: confirmation.issueDate, timeOfSupplyDate: confirmation.timeOfSupplyDate,
      serviceProvisionDate: confirmation.serviceProvisionDate, paymentReceiptDate: confirmation.paymentReceiptDate,
      seriesPrefix: confirmation.seriesPrefix, financialYearStart: confirmation.financialYearStart, currency: "INR",
      taxableMinor: confirmation.taxableMinor, taxMinor: confirmation.taxMinor, totalMinor: confirmation.totalMinor,
      configuration: Object.freeze({ extensionId: configuration.extensionId, version: configuration.version,
        contentHash: configuration.contentHash }), roomNights: Object.freeze(roomNights) }) });
}

function issuedInvoiceEnvelope(value, property, route, recipientRegistrationId) {
  const wrapper = exactRecord(value, ["invoice"]);
  const row = wrapper && exactRecord(wrapper.invoice, ["documentId", "documentKind", "seriesId", "docNo", "propertyNode",
    "reservationId", "folioId", "supplierRegistrationId", "recipientRegistrationId", "financialYearStart", "currency",
    "status", "businessDate", "issuedAt", "prevHash", "sha256", "sourceEvidenceHash", "preDocumentEvidenceHash",
    "readinessEvidenceHash", "replayed"]);
  if (!row || ![row.documentId, row.seriesId, row.supplierRegistrationId, row.recipientRegistrationId].every((id) => matches(id, UUID))
    || row.documentKind !== "invoice" || !matches(row.docNo, DOCUMENT_NUMBER) || row.propertyNode !== property
    || row.reservationId !== route.reservationId || row.folioId !== route.folioId
    || row.recipientRegistrationId !== recipientRegistrationId || row.currency !== "INR" || row.status !== "issued"
    || !validDate(row.financialYearStart) || !validDate(row.businessDate) || typeof row.issuedAt !== "string" || !TIMESTAMP.test(row.issuedAt)
    || (row.prevHash !== null && !matches(row.prevHash, HASH))
    || ![row.sha256, row.sourceEvidenceHash, row.preDocumentEvidenceHash, row.readinessEvidenceHash]
      .every((hash) => typeof hash === "string" && HASH.test(hash)) || typeof row.replayed !== "boolean") return null;
  return Object.freeze({ documentId: row.documentId, replayed: row.replayed });
}

const BLOCKER_TEXT = new Map([
  ["valuation_unavailable", "The folio has no sole current invoice valuation. Review its financial source."],
  ["intake_unavailable", "The retained invoice source is incomplete. Review the folio evidence."],
  ["recipient_registration_unavailable", "No eligible legal buyer registration is available for this folio."],
  ["working_day_calendar_required", "A governed working-day calendar is required. Ask an authorized administrator to provide it."],
  ["supplier_registration_unavailable", "The property's supplier registration is unavailable for this issue date."],
  ["supplier_location_unavailable", "The property's registered supplier location is unavailable."],
  ["supplier_status_unavailable", "The supplier status evidence is unavailable for the time of supply."],
  ["recipient_status_unavailable", "The selected buyer status evidence is unavailable for the time of supply."],
  ["classification_unavailable", "The accommodation classification is unavailable for this invoice."],
  ["business_day_unavailable", "The property business day is unavailable for invoice issuance."],
  ["supplier_issue_status_unavailable", "The supplier registration is not active on the issue date."],
  ["recipient_selection_too_broad", "Too many legal buyer registrations match. Narrow the governed buyer records before retrying."],
]);

function rateText(basisPoints) {
  return `${Math.floor(basisPoints / 100)}.${String(basisPoints % 100).padStart(2, "0")}%`;
}

function documentEnvelope(value, documentId, propertyNode) {
  const wrapper = ownRecord(value, 1);
  const row = wrapper && ownRecord(wrapper.invoice, 16);
  if (!row || row.kind !== "india_native_invoice_v1" || row.documentId !== documentId
    || row.propertyNode !== propertyNode || typeof row.documentNumber !== "string" || !DOCUMENT_NUMBER.test(row.documentNumber)
    || !validDate(row.businessDate) || typeof row.issuedAt !== "string" || !TIMESTAMP.test(row.issuedAt)
    || ![row.reservationId, row.folioId, row.seriesId, row.recipientRegistrationId].every((id) => typeof id === "string" && UUID.test(id))
    || typeof row.sourceEvidenceHash !== "string" || !/^[0-9a-f]{64}$/.test(row.sourceEvidenceHash)
    || typeof row.documentSha256 !== "string" || !/^[0-9a-f]{64}$/.test(row.documentSha256)
    || (row.previousHash !== null && (typeof row.previousHash !== "string" || !/^[0-9a-f]{64}$/.test(row.previousHash)))
    || typeof row.contentJson !== "string" || row.contentJson.length < 1 || row.contentJson.length > 1024 * 1024) return null;
  return Object.freeze({ ...row });
}

function deliveryEnvelope(value, documentId) {
  const wrapper = ownRecord(value, 1);
  const delivery = wrapper && ownRecord(wrapper.delivery, 4);
  if (!delivery || delivery.documentId !== documentId
    || !["not_requested", "ambiguous", "legacy_unsupported", "receipt"].includes(delivery.kind)) return null;
  if (delivery.kind === "legacy_unsupported" && (typeof delivery.submissionId !== "string" || !UUID.test(delivery.submissionId))) return null;
  if (delivery.kind === "receipt" && (typeof delivery.receipt !== "object" || delivery.receipt === null)) return null;
  return Object.freeze({ ...delivery });
}

function providerOptionsEnvelope(value) {
  const wrapper = exactRecord(value, ["providers"]);
  const values = wrapper && ownArray(wrapper.providers, MAX_PROVIDERS);
  if (!values) return null;
  const seen = new Set();
  const providers = values.map((value) => {
    const row = exactRecord(value, ["providerExtensionId", "providerExtensionVersion", "providerKey", "label", "environment"]);
    if (!row || !matches(row.providerExtensionId, UUID) || !Number.isSafeInteger(row.providerExtensionVersion)
      || row.providerExtensionVersion < 1 || row.providerExtensionVersion > 2147483647
      || !matches(row.providerKey, PROVIDER_KEY) || !validText(row.label, 160)
      || (row.environment !== "sandbox" && row.environment !== "production")
      || seen.has(row.providerExtensionId)) return null;
    seen.add(row.providerExtensionId);
    return Object.freeze({ providerExtensionId: row.providerExtensionId,
      providerExtensionVersion: row.providerExtensionVersion, providerKey: row.providerKey,
      label: row.label, environment: row.environment });
  });
  return providers.some((provider) => provider === null) ? null : Object.freeze(providers);
}

function fiscalSubmissionEnvelope(value, documentId, provider) {
  const wrapper = exactRecord(value, ["fiscalSubmission"]);
  const row = wrapper && exactRecord(wrapper.fiscalSubmission, ["submissionId", "documentId", "attemptId",
    "attemptNumber", "retryCount", "status", "disposition", "transitionSeq", "provider", "replayed"]);
  const identity = row && exactRecord(row.provider, ["key", "extensionId", "extensionVersion"]);
  if (!row || !identity || !matches(row.submissionId, UUID) || row.documentId !== documentId
    || !matches(row.attemptId, UUID) || !Number.isSafeInteger(row.attemptNumber) || row.attemptNumber < 1
    || !Number.isSafeInteger(row.retryCount) || row.retryCount < 0 || row.retryCount > 3
    || row.attemptNumber !== row.retryCount + 1 || !Number.isSafeInteger(row.transitionSeq) || row.transitionSeq < 1
    || !["pending", "submitted", "accepted", "rejected", "error"].includes(row.status)
    || !["send", "lookup", "retry", "none"].includes(row.disposition)
    || (row.status === "pending" && row.disposition !== "send")
    || (row.status === "submitted" && row.disposition !== "lookup")
    || (["accepted", "rejected"].includes(row.status) && row.disposition !== "none")
    || (row.status === "error" && !["retry", "none"].includes(row.disposition))
    || typeof row.replayed !== "boolean" || identity.key !== provider.providerKey
    || identity.extensionId !== provider.providerExtensionId
    || identity.extensionVersion !== provider.providerExtensionVersion) return null;
  return Object.freeze({ submissionId: row.submissionId, documentId: row.documentId,
    attemptId: row.attemptId, attemptNumber: row.attemptNumber, retryCount: row.retryCount,
    status: row.status, disposition: row.disposition, transitionSeq: row.transitionSeq,
    provider: Object.freeze({ key: identity.key, extensionId: identity.extensionId,
      extensionVersion: identity.extensionVersion }), replayed: row.replayed });
}

function retryCapability(delivery, documentValue) {
  if (delivery.kind !== "receipt") return null;
  const receipt = exactRecord(delivery.receipt, ["kind", "submissionId", "tenantId", "propertyNode", "documentId",
    "documentSha256", "wireSha256", "providerKey", "attemptId", "attemptNumber", "status", "disposition",
    "transitionSeq", "retryBinding"]);
  if (!receipt || receipt.kind !== "pending" || receipt.status !== "error" || receipt.disposition !== "retry"
    || receipt.documentId !== documentValue.documentId || receipt.propertyNode !== documentValue.propertyNode
    || receipt.documentSha256 !== documentValue.documentSha256
    || ![receipt.submissionId, receipt.tenantId, receipt.attemptId].every((value) => matches(value, UUID))
    || !matches(receipt.wireSha256, HASH) || !matches(receipt.providerKey, PROVIDER_KEY)
    || !Number.isSafeInteger(receipt.attemptNumber) || receipt.attemptNumber < 1 || receipt.attemptNumber > 4
    || !Number.isSafeInteger(receipt.transitionSeq) || receipt.transitionSeq < 1) return null;
  const binding = exactRecord(receipt.retryBinding, ["providerExtensionId", "providerExtensionVersion"]);
  if (!binding || !matches(binding.providerExtensionId, UUID)
    || !Number.isSafeInteger(binding.providerExtensionVersion) || binding.providerExtensionVersion < 1
    || binding.providerExtensionVersion > 2147483647) return null;
  return Object.freeze({ submissionId: receipt.submissionId, attemptId: receipt.attemptId,
    attemptNumber: receipt.attemptNumber, transitionSeq: receipt.transitionSeq, provider: Object.freeze({
    providerKey: receipt.providerKey, providerExtensionId: binding.providerExtensionId,
    providerExtensionVersion: binding.providerExtensionVersion,
  }) });
}

const DELIVERY_RECEIPT_BASE_KEYS = ["kind", "submissionId", "tenantId", "propertyNode", "documentId",
  "documentSha256", "wireSha256", "providerKey", "attemptId", "attemptNumber", "status", "disposition",
  "transitionSeq"];

function coherentRetryProgress(delivery, documentValue, retained) {
  if (delivery.kind !== "receipt") return false;
  const nextRetry = retryCapability(delivery, documentValue);
  if (nextRetry) {
    return nextRetry.submissionId === retained.submissionId
      && nextRetry.provider.providerKey === retained.provider.providerKey
      && nextRetry.provider.providerExtensionId === retained.provider.providerExtensionId
      && nextRetry.provider.providerExtensionVersion === retained.provider.providerExtensionVersion
      && nextRetry.attemptId !== retained.attemptId
      && nextRetry.attemptNumber === retained.attemptNumber + 1
      && nextRetry.attemptNumber <= 4 && nextRetry.transitionSeq > retained.transitionSeq;
  }
  const candidate = ownRecord(delivery.receipt, 32);
  if (!candidate) return false;
  const extras = candidate.kind === "pending" ? []
    : candidate.kind === "legacy_hash_only" ? ["authorityRef", "responseSha256"]
      : candidate.kind === "rejected" ? ["environment", "responseSha256", "errorCodes"]
        : candidate.kind === "provider_cancelled" ? ["environment", "responseSha256", "providerStatus"]
          : candidate.kind === "accepted_signed_v1" ? ["environment", "responseSha256", "irn", "ackNo", "ackDt",
            "signedInvoice", "signedQRCode", "signedInvoiceSha256", "signedQrSha256", "verification"] : null;
  if (!extras || Object.keys(candidate).length !== DELIVERY_RECEIPT_BASE_KEYS.length + extras.length
    || ![...DELIVERY_RECEIPT_BASE_KEYS, ...extras].every((key) => Object.hasOwn(candidate, key))
    || candidate.documentId !== documentValue.documentId || candidate.propertyNode !== documentValue.propertyNode
    || candidate.documentSha256 !== documentValue.documentSha256
    || candidate.submissionId !== retained.submissionId || candidate.providerKey !== retained.provider.providerKey
    || !matches(candidate.tenantId, UUID) || !matches(candidate.attemptId, UUID)
    || candidate.attemptId === retained.attemptId || !Number.isSafeInteger(candidate.attemptNumber)
    || candidate.attemptNumber < 1 || candidate.attemptNumber > 4
    || candidate.attemptNumber !== retained.attemptNumber + 1
    || !matches(candidate.wireSha256, HASH) || !Number.isSafeInteger(candidate.transitionSeq)
    || candidate.transitionSeq <= retained.transitionSeq) return false;
  if (candidate.kind === "pending") {
    return (candidate.status === "pending" && candidate.disposition === "send")
      || (candidate.status === "submitted" && candidate.disposition === "lookup");
  }
  if (candidate.disposition !== "none") return false;
  if (candidate.kind === "legacy_hash_only") {
    return (candidate.status === "accepted" || candidate.status === "rejected")
      && (candidate.authorityRef === null || validText(candidate.authorityRef, 256))
      && (candidate.responseSha256 === null || matches(candidate.responseSha256, HASH));
  }
  if ((candidate.environment !== "sandbox" && candidate.environment !== "production")
    || !matches(candidate.responseSha256, HASH)) return false;
  if (candidate.kind === "rejected") {
    const codes = ownArray(candidate.errorCodes, 32);
    return candidate.status === "rejected" && !!codes && codes.length > 0
      && codes.every((code, index) => validText(code, 64) && codes.indexOf(code) === index);
  }
  if (candidate.kind === "provider_cancelled") {
    return candidate.status === "error" && candidate.providerStatus === "CNL";
  }
  const verification = exactRecord(candidate.verification, ["profileVersion", "issuer", "verificationUnixMs",
    "invoiceKeyId", "invoiceKeySpkiSha256", "invoiceBundleVersion", "qrKeyId", "qrKeySpkiSha256", "qrBundleVersion"]);
  return candidate.status === "accepted" && matches(candidate.irn, HASH)
    && typeof candidate.ackNo === "string" && /^[1-9][0-9]{0,63}$/.test(candidate.ackNo)
    && typeof candidate.ackDt === "string" && /^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(candidate.ackDt)
    && typeof candidate.signedInvoice === "string" && candidate.signedInvoice.length > 0
    && typeof candidate.signedQRCode === "string" && candidate.signedQRCode.length > 0
    && matches(candidate.signedInvoiceSha256, HASH) && matches(candidate.signedQrSha256, HASH)
    && !!verification && verification.profileVersion === "yellow_native_india_1_1_v1"
    && validText(verification.issuer, 128) && Number.isSafeInteger(verification.verificationUnixMs)
    && verification.verificationUnixMs >= 0 && validText(verification.invoiceKeyId, 256)
    && matches(verification.invoiceKeySpkiSha256, HASH) && validText(verification.invoiceBundleVersion, 128)
    && validText(verification.qrKeyId, 256) && matches(verification.qrKeySpkiSha256, HASH)
    && validText(verification.qrBundleVersion, 128);
}

function minorText(value) {
  const padded = value.padStart(3, "0");
  const integer = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `₹${integer}.${padded.slice(-2)}`;
}

function errorField(error, key) {
  if (typeof error !== "object" || error === null) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function errorState(error) {
  const status = errorField(error, "status");
  if (status === 401 || status === 403) return "permission";
  if (status === 422) return "unsupported";
  return "offline";
}

function receiptText(delivery, documentValue) {
  if (delivery.kind === "unavailable") return "Registration details unavailable for this role";
  if (delivery.kind === "not_requested") return "Provider registration not requested";
  if (delivery.kind === "ambiguous") return "Provider registration status is ambiguous";
  if (delivery.kind === "legacy_unsupported") return "Legacy provider evidence cannot be displayed here";
  const receipt = ownRecord(delivery.receipt, 32);
  if (!receipt || receipt.documentId !== documentValue.documentId || receipt.propertyNode !== documentValue.propertyNode
    || receipt.documentSha256 !== documentValue.documentSha256) return "Provider receipt is invalid";
  if (receipt.kind === "accepted_signed_v1") return receipt.environment === "sandbox"
    ? "Accepted by sandbox provider — not a production registration" : "Accepted by provider";
  if (receipt.kind === "rejected") return "Registration rejected by provider";
  if (receipt.kind === "provider_cancelled") return "Registration cancelled by provider";
  if (receipt.kind === "pending") {
    if (receipt.status === "error" && receipt.disposition === "retry") {
      return retryCapability(delivery, documentValue) ? "Known not sent; retry required"
        : "Known not sent; original provider binding unavailable";
    }
    return "Registration pending";
  }
  return "Legacy provider response retained";
}

/**
 * Mounts the production invoice queue/detail/issue surface. The root owns only
 * scoped invoice-workbench descendants; caller navigation owns history and calls
 * show(documentId|null) or showIssue({reservationId,folioId}). returnToFolio is an
 * optional history/focus owner and receives only the opaque folio UUID.
 */
export function createInvoiceWorkbench({ root, request, propertyNode, timezone, navigate, returnToFolio }) {
  if (!root || typeof root.replaceChildren !== "function" || typeof request !== "function"
    || typeof navigate !== "function" || typeof propertyNode !== "string" || !UUID.test(propertyNode)
    || typeof timezone !== "string" || (returnToFolio !== undefined && typeof returnToFolio !== "function")) {
    throw new TypeError("Invalid invoice workbench configuration");
  }
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); } catch { throw new TypeError("Invalid invoice workbench configuration"); }

  let disposed = false;
  let active = false;
  let scopeGeneration = 0;
  let searchGeneration = 0;
  let detailGeneration = 0;
  let issueGeneration = 0;
  let selectedDocumentId = null;
  let returnFocusDocumentId = null;
  let currentIssueRoute = null;
  let rows = [];
  let matchingCount = "0";
  let nextCursor = null;
  let loaded = false;
  let printModulePromise = null;
  let previewStyleSheet = null;
  const registrationRequests = new Map();
  const deliveryRetries = new Map();
  const controllers = new Set();
  const searchControllers = new Set();
  const detailControllers = new Set();
  const issueControllers = new Set();

  const toolbar = element("header", "invoice-workbench__toolbar");
  const titleBlock = element("div", "invoice-workbench__title");
  titleBlock.append(element("p", "invoice-workbench__eyebrow", "Issued fiscal documents"),
    element("p", "invoice-workbench__timezone", `Property time zone · ${timezone}`));
  const form = element("form", "invoice-workbench__search");
  form.setAttribute("role", "search");
  const queryLabel = element("label", "invoice-workbench__field", "Search invoices");
  const query = element("input", "invoice-workbench__query");
  query.type = "search"; query.maxLength = 120; query.autocomplete = "off";
  query.placeholder = "Invoice number, buyer or GSTIN";
  queryLabel.append(query);
  const today = dateInTimezone(timezone);
  const fromLabel = element("label", "invoice-workbench__field", "Issued from");
  const from = element("input", "invoice-workbench__date");
  from.type = "date"; from.required = true; from.value = addDays(today, -30); fromLabel.append(from);
  const beforeLabel = element("label", "invoice-workbench__field", "Issued before");
  const before = element("input", "invoice-workbench__date");
  before.type = "date"; before.required = true; before.value = addDays(today, 1); beforeLabel.append(before);
  const searchButton = element("button", "invoice-workbench__submit", "Search");
  searchButton.type = "submit";
  form.append(queryLabel, fromLabel, beforeLabel, searchButton);
  toolbar.append(titleBlock, form);

  const live = element("p", "invoice-workbench__status", "Invoices have not been loaded.");
  live.setAttribute("role", "status"); live.setAttribute("aria-live", "polite");
  const layout = element("div", "invoice-workbench__layout");
  const queue = element("section", "invoice-workbench__queue");
  queue.setAttribute("aria-label", "Issued invoice queue");
  const queueSummary = element("p", "invoice-workbench__queue-summary", "No invoices loaded.");
  const queueList = element("div", "invoice-workbench__queue-list");
  const empty = element("p", "invoice-workbench__empty", "No issued invoices match this search.");
  empty.hidden = true;
  const more = element("button", "invoice-workbench__load-more", "Load more invoices");
  more.type = "button"; more.hidden = true;
  queue.append(queueSummary, queueList, empty, more);
  const detail = element("section", "invoice-workbench__detail");
  detail.setAttribute("aria-label", "Invoice detail");
  layout.append(queue, detail);
  root.replaceChildren(toolbar, live, layout);
  root.dataset.invoiceView = "queue";
  root.dataset.invoiceState = "idle";

  function setState(state, message) {
    if (disposed) return;
    root.dataset.invoiceState = state;
    root.setAttribute("aria-busy", state === "loading" ? "true" : "false");
    live.textContent = message;
  }

  function current(scope, generation, kind) {
    const expected = kind === "search" ? searchGeneration : kind === "detail" ? detailGeneration : issueGeneration;
    return !disposed && active && scope === scopeGeneration && generation === expected;
  }

  function abortAll() {
    for (const controller of controllers) controller.abort();
    controllers.clear();
    searchControllers.clear();
    detailControllers.clear();
    issueControllers.clear();
  }

  function abortKind(kind) {
    const selected = kind === "search" ? searchControllers : kind === "detail" ? detailControllers : issueControllers;
    for (const controller of selected) {
      controller.abort(); controllers.delete(controller);
    }
    selected.clear();
  }

  function controlled(kind) {
    const controller = new AbortController();
    controllers.add(controller);
    (kind === "search" ? searchControllers : kind === "detail" ? detailControllers : issueControllers).add(controller);
    return controller;
  }

  function release(controller) {
    controllers.delete(controller); searchControllers.delete(controller); detailControllers.delete(controller);
    issueControllers.delete(controller);
  }

  function renderQueue() {
    queueList.replaceChildren();
    const retained = new Set();
    for (const row of rows) {
      if (retained.has(row.documentId)) continue;
      retained.add(row.documentId);
      const button = element("button", "invoice-workbench__queue-item");
      button.type = "button"; button.dataset.documentId = row.documentId;
      if (row.documentId === selectedDocumentId) {
        button.classList.add("invoice-workbench__queue-item--selected");
        button.setAttribute("aria-current", "true");
      }
      const primary = element("strong", "invoice-workbench__queue-primary", row.documentNumber);
      const buyer = element("span", "invoice-workbench__queue-buyer", row.buyerName);
      const facts = element("span", "invoice-workbench__queue-facts", `${row.businessDate} · ${minorText(row.totalMinor)} · ${row.buyerGstin}`);
      button.append(primary, buyer, facts);
      button.addEventListener("click", () => {
        returnFocusDocumentId = row.documentId;
        selectedDocumentId = row.documentId;
        try { void Promise.resolve(navigate(row.documentId)).catch(() => undefined); } catch { /* navigation owner reports its own failure */ }
      });
      queueList.append(button);
    }
    queueSummary.textContent = `${matchingCount} matching invoice${matchingCount === "1" ? "" : "s"} · ${rows.length} shown`;
    empty.hidden = rows.length !== 0;
    more.hidden = nextCursor === null || rows.length >= MAX_RETAINED_INVOICES;
  }

  function searchBody(after) {
    return { issuedFrom: from.value, issuedBefore: before.value, query: query.value.trim(), limit: PAGE_SIZE,
      ...(after ? { after } : {}) };
  }

  async function loadSearch(append) {
    if (disposed || !active) return;
    abortKind("search");
    const requestGeneration = ++searchGeneration;
    const scope = scopeGeneration;
    const cursor = append ? nextCursor : null;
    if (!validDate(from.value) || !validDate(before.value) || from.value >= before.value
      || (Date.parse(`${before.value}T00:00:00Z`) - Date.parse(`${from.value}T00:00:00Z`)) / 86_400_000 > 366) {
      setState("ready", "Choose a valid date range of no more than 366 days.");
      return;
    }
    const controller = controlled("search");
    setState("loading", append ? "Loading more invoices…" : "Loading invoices…");
    try {
      const response = await request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/invoices/search`, {
        method: "POST", body: JSON.stringify(searchBody(cursor)), signal: controller.signal,
      });
      if (!current(scope, requestGeneration, "search")) return;
      const page = listEnvelope(response);
      if (!page) throw new Error("invalid invoice response");
      const combined = append ? [...rows, ...page.items] : [...page.items];
      const unique = [];
      const ids = new Set();
      for (const item of combined) if (!ids.has(item.documentId) && unique.length < MAX_RETAINED_INVOICES) {
        ids.add(item.documentId); unique.push(item);
      }
      rows = unique; matchingCount = page.matchingCount;
      nextCursor = unique.length >= MAX_RETAINED_INVOICES ? null : page.nextCursor;
      loaded = true; renderQueue();
      if (root.dataset.invoiceView === "queue") {
        setState(rows.length ? "ready" : "empty", rows.length ? `${rows.length} invoices shown.` : "No issued invoices match this search.");
      }
    } catch (error) {
      if (!current(scope, requestGeneration, "search") || controller.signal.aborted) return;
      const state = errorState(error);
      if (root.dataset.invoiceView === "queue") {
        setState(state, state === "permission" ? "You do not have permission to read issued invoices."
          : state === "unsupported" ? "Native fiscal invoices are not supported for this property."
            : "Invoices are unavailable while the service is offline.");
      }
    } finally {
      release(controller);
    }
  }

  async function readDelivery(documentId, scope, generation) {
    const controller = controlled("detail");
    try {
      const value = await request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/invoices/${encodeURIComponent(documentId)}/receipt`, { signal: controller.signal });
      if (!current(scope, generation, "detail")) return null;
      const delivery = deliveryEnvelope(value, documentId);
      return delivery ?? Object.freeze({ kind: "unavailable", documentId });
    } catch {
      if (!current(scope, generation, "detail") || controller.signal.aborted) return null;
      return Object.freeze({ kind: "unavailable", documentId });
    } finally {
      release(controller);
    }
  }

  function detailRow(term, description) {
    const fragment = document.createDocumentFragment();
    fragment.append(element("dt", "invoice-workbench__term", term), element("dd", "invoice-workbench__value", description));
    return fragment;
  }

  function newRegistrationKey() {
    if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== "function") {
      throw new Error("secure command identity is unavailable");
    }
    return `fiscal-registration-${globalThis.crypto.randomUUID()}`;
  }

  function newRetryKey() {
    if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== "function") {
      throw new Error("secure command identity is unavailable");
    }
    return `fiscal-retry-${globalThis.crypto.randomUUID()}`;
  }

  function retainRegistration(documentId, value) {
    if (!registrationRequests.has(documentId) && registrationRequests.size >= MAX_RETAINED_INVOICES) {
      for (const [candidate, retained] of registrationRequests) {
        if (retained.status === "succeeded") { registrationRequests.delete(candidate); break; }
      }
    }
    if (!registrationRequests.has(documentId) && registrationRequests.size >= MAX_RETAINED_INVOICES) return false;
    registrationRequests.set(documentId, value); return true;
  }

  function providerMessage(slot, text, alert = false) {
    let message = slot.querySelector(".invoice-workbench__provider-message");
    if (!message) {
      message = element("p", "invoice-workbench__provider-message");
      message.setAttribute("aria-live", "polite"); slot.append(message);
    }
    if (alert) message.setAttribute("role", "alert"); else message.removeAttribute("role");
    message.textContent = text; return message;
  }

  function retainDeliveryRetry(documentId, value) {
    if (!deliveryRetries.has(documentId) && deliveryRetries.size >= MAX_RETAINED_INVOICES) return false;
    deliveryRetries.set(documentId, value); return true;
  }

  async function submitDeliveryRetry(documentValue, slot, retained, scope, generation) {
    if (retained.inFlight || !current(scope, generation, "detail")) return;
    retained.inFlight = true;
    const submit = slot.querySelector(".invoice-workbench__provider-submit");
    if (submit) submit.disabled = true;
    providerMessage(slot, "Retrying the original provider delivery…");
    setState("loading", "Retrying original provider delivery…");
    const controller = controlled("detail");
    try {
      const response = await request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/fiscal-submissions/${encodeURIComponent(retained.submissionId)}/retry`, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": retained.idempotencyKey },
        body: JSON.stringify({ providerExtensionId: retained.provider.providerExtensionId }), signal: controller.signal,
      });
      if (!current(scope, generation, "detail")) return;
      if (!fiscalSubmissionEnvelope(response, documentValue.documentId, retained.provider)) {
        throw new Error("invalid fiscal submission response");
      }
      deliveryRetries.delete(documentValue.documentId);
      const delivery = await readDelivery(documentValue.documentId, scope, generation);
      if (!delivery || !current(scope, generation, "detail")) return;
      renderDetail(documentValue, delivery, scope, generation);
      setState("ready", "Original provider delivery retried; authorized receipt refreshed.");
    } catch (error) {
      if (!current(scope, generation, "detail") || controller.signal.aborted) return;
      const status = errorField(error, "status");
      if (status === 401 || status === 403 || status === 422) {
        deliveryRetries.delete(documentValue.documentId);
        const message = status === 422 ? "This provider delivery can no longer be retried."
          : "You do not have permission to retry provider delivery.";
        providerMessage(slot, message, true);
        setState(status === 422 ? "unsupported" : "permission", message);
        return;
      }
      retained.status = "unknown";
      providerMessage(slot, "The retry outcome is unknown. Retry only with the same request identity and original provider.", true);
      if (submit) { submit.textContent = "Retry same delivery request"; submit.disabled = false; }
      setState("unknown", "The provider retry outcome is unknown; retain the same request identity.");
    } finally {
      retained.inFlight = false; release(controller);
      if (current(scope, generation, "detail") && retained.status === "unknown" && submit) submit.disabled = false;
    }
  }

  function renderDeliveryRetry(documentValue, slot, capability, scope, generation) {
    let retained = deliveryRetries.get(documentValue.documentId);
    if (retained && (retained.submissionId !== capability.submissionId
      || retained.attemptId !== capability.attemptId || retained.attemptNumber !== capability.attemptNumber
      || retained.provider.providerExtensionId !== capability.provider.providerExtensionId
      || retained.provider.providerExtensionVersion !== capability.provider.providerExtensionVersion
      || retained.provider.providerKey !== capability.provider.providerKey)) {
      if (retained.status === "unknown") {
        providerMessage(slot, "The retry outcome is unknown. Retry only with the same request identity and original provider.", true);
        return;
      }
      deliveryRetries.delete(documentValue.documentId); retained = null;
    }
    if (!retained) {
      let idempotencyKey;
      try { idempotencyKey = newRetryKey(); } catch {
        providerMessage(slot, "A secure retry identity is unavailable. No provider request was sent.", true);
        return;
      }
      retained = { ...capability, idempotencyKey, status: "ready", inFlight: false };
      if (!retainDeliveryRetry(documentValue.documentId, retained)) {
        providerMessage(slot, "Too many unresolved provider retries are retained. Resolve them before retrying another invoice.", true);
        return;
      }
    }
    const submit = element("button", "invoice-workbench__provider-submit",
      retained.status === "unknown" ? "Retry same delivery request" : "Retry original provider delivery");
    submit.type = "button";
    submit.addEventListener("click", () => { void submitDeliveryRetry(documentValue, slot, retained, scope, generation); });
    if (retained.status === "unknown") {
      providerMessage(slot, "The retry outcome is unknown. Retry only with the same request identity and original provider.", true);
    }
    slot.append(submit);
  }

  function renderRetainedRegistration(documentValue, slot, retained, scope, generation) {
    const environment = retained.provider.environment === "sandbox" ? "sandbox" : "production";
    slot.append(element("p", "invoice-workbench__provider-binding",
      `${retained.provider.label} · ${retained.provider.providerKey} · ${environment}`));
    if (retained.status === "succeeded") {
      providerMessage(slot, "The registration request was accepted. Its authorized receipt is not available yet.");
      return;
    }
    providerMessage(slot, "The registration outcome is unknown. Retry only with the same request identity and provider.", true);
    const retry = element("button", "invoice-workbench__provider-submit", "Retry same registration request");
    retry.type = "button";
    retry.addEventListener("click", () => { void submitProviderRegistration(documentValue, slot, retained, scope, generation); });
    slot.append(retry);
  }

  async function submitProviderRegistration(documentValue, slot, retained, scope, generation, controls = null) {
    if (retained.inFlight || !current(scope, generation, "detail")) return;
    retained.inFlight = true; retained.status = "unknown";
    const select = controls?.select ?? null, confirmation = controls?.confirmation ?? null;
    const submit = controls?.submit ?? slot.querySelector(".invoice-workbench__provider-submit");
    if (select) select.disabled = true;
    if (confirmation) confirmation.disabled = true;
    if (submit) submit.disabled = true;
    providerMessage(slot, "Requesting registration with the explicitly selected provider…");
    setState("loading", "Requesting provider registration…");
    const controller = controlled("detail");
    try {
      const response = await request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/fiscal-submissions`, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": retained.idempotencyKey },
        body: JSON.stringify({ documentId: documentValue.documentId,
          providerExtensionId: retained.provider.providerExtensionId }), signal: controller.signal,
      });
      if (!current(scope, generation, "detail")) return;
      if (!fiscalSubmissionEnvelope(response, documentValue.documentId, retained.provider)) {
        throw new Error("invalid fiscal submission response");
      }
      retained.status = "succeeded";
      const delivery = await readDelivery(documentValue.documentId, scope, generation);
      if (!delivery || !current(scope, generation, "detail")) return;
      renderDetail(documentValue, delivery, scope, generation);
      setState("ready", "Provider registration requested; authorized receipt refreshed.");
    } catch (error) {
      if (!current(scope, generation, "detail") || controller.signal.aborted) return;
      const status = errorField(error, "status");
      if (status === 401 || status === 403 || status === 422) {
        registrationRequests.delete(documentValue.documentId);
        const state = status === 422 ? "unsupported" : "permission";
        providerMessage(slot, state === "permission" ? "You do not have permission to request provider registration."
          : "Provider registration is not supported for this property.", true);
        setState(state, slot.querySelector(".invoice-workbench__provider-message").textContent);
        return;
      }
      retained.status = "unknown";
      providerMessage(slot, "The registration outcome is unknown. Retry only with the same request identity; do not choose another provider.", true);
      if (submit) { submit.textContent = "Retry same registration request"; submit.disabled = false; }
      setState("unknown", "The provider registration outcome is unknown; retain the same request identity.");
    } finally {
      retained.inFlight = false; release(controller);
      if (current(scope, generation, "detail") && retained.status === "unknown" && submit) submit.disabled = false;
    }
  }

  function renderProviderChoices(documentValue, slot, providers, scope, generation) {
    slot.replaceChildren(element("h4", "invoice-workbench__provider-heading", "Register with provider"),
      element("p", "invoice-workbench__provider-guidance", "Select the provider registration explicitly. No provider is selected automatically."));
    const label = element("label", "invoice-workbench__provider-field", "Configured provider");
    const select = element("select", "invoice-workbench__provider-select");
    const prompt = element("option", "invoice-workbench__provider-option", "Choose a provider");
    prompt.value = ""; select.append(prompt);
    for (const provider of providers) {
      const option = element("option", "invoice-workbench__provider-option",
        `${provider.label} · ${provider.providerKey} · ${provider.environment}`);
      option.value = provider.providerExtensionId; select.append(option);
    }
    label.append(select);
    const confirmLabel = element("label", "invoice-workbench__provider-confirm-field");
    const confirmation = element("input", "invoice-workbench__provider-confirm");
    confirmation.type = "checkbox"; confirmation.disabled = true;
    const confirmationText = document.createTextNode(" Select a provider to confirm its environment.");
    confirmLabel.append(confirmation, confirmationText);
    const submit = element("button", "invoice-workbench__provider-submit", "Request provider registration");
    submit.type = "button"; submit.disabled = true;
    let selected = null;
    select.addEventListener("change", () => {
      selected = providers.find((provider) => provider.providerExtensionId === select.value) ?? null;
      confirmation.checked = false; confirmation.disabled = selected === null; submit.disabled = true;
      confirmationText.textContent = selected
        ? ` I confirm this request will use the ${selected.environment} environment.`
        : " Select a provider to confirm its environment.";
    });
    confirmation.addEventListener("change", () => { submit.disabled = !selected || !confirmation.checked; });
    submit.addEventListener("click", () => {
      if (!selected || !confirmation.checked) return;
      const existing = registrationRequests.get(documentValue.documentId);
      if (existing) {
        void submitProviderRegistration(documentValue, slot, existing, scope, generation,
          { select, confirmation, submit });
        return;
      }
      let idempotencyKey;
      try { idempotencyKey = newRegistrationKey(); } catch {
        providerMessage(slot, "A secure request identity is unavailable. No provider request was sent.", true);
        setState("offline", "A secure provider request identity is unavailable."); return;
      }
      const retained = { provider: selected, idempotencyKey, status: "unknown", inFlight: false };
      if (!retainRegistration(documentValue.documentId, retained)) {
        providerMessage(slot, "Too many unresolved provider requests are retained. Resolve them before starting another.", true);
        setState("offline", "Provider registration cannot start while prior outcomes remain unresolved."); return;
      }
      void submitProviderRegistration(documentValue, slot, retained, scope, generation, { select, confirmation, submit });
    });
    slot.append(label, confirmLabel, submit);
  }

  async function loadProviderOptions(documentValue, slot, intent, scope, generation) {
    if (!current(scope, generation, "detail")) return;
    intent.disabled = true; providerMessage(slot, "Loading configured provider registrations…");
    setState("loading", "Loading configured fiscal providers…");
    const controller = controlled("detail");
    try {
      const response = await request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/fiscal-provider-options`, {
        signal: controller.signal,
      });
      if (!current(scope, generation, "detail")) return;
      const providers = providerOptionsEnvelope(response);
      if (!providers) throw new Error("invalid fiscal provider options response");
      if (providers.length === 0) {
        providerMessage(slot, "No configured fiscal providers are available for this property.");
        setState("empty", "No configured fiscal providers are available for this property."); return;
      }
      renderProviderChoices(documentValue, slot, providers, scope, generation);
      setState("ready", "Choose and confirm a configured provider environment.");
    } catch (error) {
      if (!current(scope, generation, "detail") || controller.signal.aborted) return;
      const state = errorState(error);
      const message = state === "permission" ? "You do not have permission to request provider registration."
        : state === "unsupported" ? "Provider registration is not supported for this property."
          : "Configured provider registrations are unavailable while the service is offline.";
      providerMessage(slot, message, true); setState(state, message);
    } finally {
      release(controller);
    }
  }

  function renderDetail(documentValue, delivery, scope, generation) {
    detail.replaceChildren();
    const back = element("button", "invoice-workbench__back", "Back to invoices");
    back.type = "button";
    back.addEventListener("click", () => {
      try { void Promise.resolve(navigate(null)).catch(() => undefined); } catch { /* navigation owner reports its own failure */ }
    });
    const heading = element("h3", "invoice-workbench__detail-heading", documentValue.documentNumber);
    heading.tabIndex = -1;
    const identity = element("header", "invoice-workbench__identity");
    const title = element("div", "invoice-workbench__identity-title");
    title.append(element("p", "invoice-workbench__identity-label", "Issued invoice"), heading);
    const date = element("time", "invoice-workbench__identity-date", documentValue.businessDate);
    date.dateTime = documentValue.businessDate;
    identity.append(title, date);
    const audit = element("details", "invoice-workbench__audit");
    const auditSummary = element("summary", "invoice-workbench__audit-summary", "Document history & verification");
    const metadata = element("dl", "invoice-workbench__metadata");
    metadata.append(detailRow("Invoice date", documentValue.businessDate), detailRow("Issued at (UTC)", documentValue.issuedAt),
      detailRow("Reservation ID", documentValue.reservationId), detailRow("Folio ID", documentValue.folioId),
      detailRow("Document SHA-256", documentValue.documentSha256), detailRow("Source evidence SHA-256", documentValue.sourceEvidenceHash));
    audit.append(auditSummary, element("p", "invoice-workbench__audit-guidance",
      "Original identifiers and source fingerprints retained for reconciliation and audit."), metadata);
    const registration = element("p", "invoice-workbench__registration", receiptText(delivery, documentValue));
    const actions = element("div", "invoice-workbench__actions");
    const preview = element("button", "invoice-workbench__preview-action", "Preview invoice for print");
    preview.type = "button";
    const print = element("button", "invoice-workbench__print", "Print invoice");
    print.type = "button";
    const issueSlot = element("div", "invoice-workbench__issue-slot");
    issueSlot.setAttribute("data-invoice-issue-slot", "");
    const previewSurface = element("section", "invoice-workbench__print-preview");
    previewSurface.hidden = true; previewSurface.setAttribute("aria-live", "polite");
    preview.addEventListener("click", () => { void preparePrint(documentValue.documentId, false, previewSurface, preview, print); });
    print.addEventListener("click", () => { void preparePrint(documentValue.documentId, true, previewSurface, preview, print); });
    actions.append(preview, print);
    detail.append(back, identity, registration, actions, issueSlot, audit, previewSurface);
    if (delivery.kind === "not_requested") {
      const retained = registrationRequests.get(documentValue.documentId);
      if (retained) renderRetainedRegistration(documentValue, issueSlot, retained, scope, generation);
      else {
        const intent = element("button", "invoice-workbench__provider-intent", "Register with provider");
        intent.type = "button";
        intent.addEventListener("click", () => { void loadProviderOptions(documentValue, issueSlot, intent, scope, generation); });
        issueSlot.append(intent);
      }
    } else {
      const capability = retryCapability(delivery, documentValue);
      if (capability) renderDeliveryRetry(documentValue, issueSlot, capability, scope, generation);
    }
  }

  function issueBack(route) {
    abortKind("issue"); issueGeneration += 1; currentIssueRoute = null;
    try {
      const result = returnToFolio ? returnToFolio(route.folioId) : navigate(null);
      void Promise.resolve(result).catch(() => undefined);
    } catch { /* navigation owner reports its own failure */ }
  }

  function issueSurface(route, headingText) {
    detail.replaceChildren();
    const article = element("section", "invoice-workbench__issue");
    const back = element("button", "invoice-workbench__issue-back", "Back to folio");
    back.type = "button"; back.addEventListener("click", () => issueBack(route));
    const heading = element("h3", "invoice-workbench__issue-heading", headingText);
    heading.tabIndex = -1;
    const context = element("p", "invoice-workbench__issue-context", `Reservation ${route.reservationId} · Folio ${route.folioId}`);
    article.append(back, heading, context); detail.append(article);
    queueMicrotask(() => {
      if (!disposed && active && root.dataset.invoiceView === "issue" && currentIssueRoute === route) heading.focus();
    });
    return article;
  }

  function renderIssueFailure(route, state, message, retry, selectedRecipient) {
    const surface = issueSurface(route, "Review invoice");
    if (selectedRecipient) surface.append(element("p", "invoice-workbench__issue-retained",
      `Selected legal buyer retained · ${selectedRecipient.legalName} · ${selectedRecipient.gstin}`));
    const problem = element("p", "invoice-workbench__issue-message", message);
    problem.setAttribute("role", "alert"); surface.append(problem);
    if (retry) {
      const button = element("button", "invoice-workbench__issue-retry", "Try readiness again");
      button.type = "button"; button.addEventListener("click", retry); surface.append(button);
    }
    setState(state, message);
  }

  function renderSelection(route, recipients) {
    const surface = issueSurface(route, "Choose the legal buyer");
    surface.append(element("p", "invoice-workbench__issue-guidance",
      "Select the GST registration that must appear on this invoice. Yellow will not choose it automatically."));
    const label = element("label", "invoice-workbench__recipient-field", "Legal buyer registration");
    const select = element("select", "invoice-workbench__recipient-select");
    const prompt = element("option", "invoice-workbench__recipient-option", "Choose a legal buyer");
    prompt.value = ""; select.append(prompt);
    for (const recipient of recipients) {
      const option = element("option", "invoice-workbench__recipient-option",
        `${recipient.legalName} · ${recipient.gstin} · State ${recipient.stateCode}`);
      option.value = recipient.recipientRegistrationId; select.append(option);
    }
    label.append(select);
    const review = element("button", "invoice-workbench__readiness-submit", "Review server confirmation");
    review.type = "button"; review.disabled = true;
    select.addEventListener("change", () => { review.disabled = !UUID.test(select.value); });
    review.addEventListener("click", () => {
      if (!UUID.test(select.value)) return;
      const selected = recipients.find((recipient) => recipient.recipientRegistrationId === select.value);
      if (selected) void loadIssueReadiness(route, select.value, selected);
    });
    surface.append(label, review); setState("selection", "Choose a legal buyer registration to continue.");
  }

  function renderBlockedIssue(route, blocker) {
    const message = BLOCKER_TEXT.get(blocker);
    const surface = issueSurface(route, "Invoice cannot be issued yet");
    surface.append(element("p", "invoice-workbench__issue-blocker", message));
    setState("blocked", message);
  }

  function newIssueKey() {
    if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== "function") {
      throw new Error("secure command identity is unavailable");
    }
    return `invoice-${globalThis.crypto.randomUUID()}`;
  }

  async function openIssuedDocument(documentId, scope, generation) {
    if (!current(scope, generation, "issue")) return;
    try {
      await Promise.resolve(navigate(documentId));
    } catch {
      if (current(scope, generation, "issue")) {
        renderIssueFailure(currentIssueRoute, "offline", "The issued invoice could not be opened. Return to the invoice list and retry opening it.", null, null);
      }
    }
  }

  function renderConfirmation(route, readiness, scope, generation) {
    const confirmation = readiness.confirmation;
    const surface = issueSurface(route, "Confirm and issue invoice");
    const parties = element("div", "invoice-workbench__confirmation-parties");
    const buyer = element("section", "invoice-workbench__confirmation-party");
    buyer.append(element("h4", "invoice-workbench__confirmation-title", "Legal buyer"));
    const buyerFacts = element("dl", "invoice-workbench__confirmation-facts");
    buyerFacts.append(detailRow("Name", confirmation.buyer.legalName), detailRow("GSTIN", confirmation.buyer.gstin),
      detailRow("Registered address", `${confirmation.buyer.addressLine}, ${confirmation.buyer.locality} ${confirmation.buyer.postalCode}`),
      detailRow("State", confirmation.buyer.stateCode)); buyer.append(buyerFacts);
    const seller = element("section", "invoice-workbench__confirmation-party");
    seller.append(element("h4", "invoice-workbench__confirmation-title", "Supplier"));
    const sellerFacts = element("dl", "invoice-workbench__confirmation-facts");
    sellerFacts.append(detailRow("Name", confirmation.seller.legalName), detailRow("GSTIN", confirmation.seller.gstin),
      detailRow("Registered address", `${confirmation.seller.addressLine}, ${confirmation.seller.locality} ${confirmation.seller.postalCode}`),
      detailRow("Place of supply state", confirmation.placeOfSupplyStateCode)); seller.append(sellerFacts);
    parties.append(buyer, seller); surface.append(parties);

    const evidence = element("dl", "invoice-workbench__confirmation-evidence");
    evidence.append(detailRow("Issue date", confirmation.issueDate), detailRow("Time of supply", confirmation.timeOfSupplyDate),
      detailRow("Service provision", confirmation.serviceProvisionDate), detailRow("Payment receipt", confirmation.paymentReceiptDate),
      detailRow("Series", `${confirmation.seriesPrefix} · FY ${confirmation.financialYearStart}`),
      detailRow("Configuration", `Version ${confirmation.configuration.version} · ${confirmation.configuration.contentHash}`),
      detailRow("Taxable value", minorText(confirmation.taxableMinor)), detailRow("Tax", minorText(confirmation.taxMinor)),
      detailRow("Invoice total", minorText(confirmation.totalMinor)));
    surface.append(evidence);
    const nights = element("section", "invoice-workbench__confirmation-nights");
    nights.append(element("h4", "invoice-workbench__confirmation-title", "Room-night tax detail"));
    for (const night of confirmation.roomNights) {
      const item = element("article", "invoice-workbench__confirmation-night");
      item.append(element("strong", "invoice-workbench__confirmation-night-date", `Night ${night.ordinal + 1} · ${night.businessDate}`),
        element("span", "invoice-workbench__confirmation-night-total",
          `${minorText(night.taxableMinor)} taxable · ${minorText(night.taxMinor)} tax`));
      for (const component of night.components) item.append(element("span", "invoice-workbench__confirmation-component",
        `${component.identity.toUpperCase()} · ${rateText(component.rateBasisPoints)} · ${minorText(component.taxMinor)}`));
      nights.append(item);
    }
    surface.append(nights);

    const confirmLabel = element("label", "invoice-workbench__confirm-field");
    const checkbox = element("input", "invoice-workbench__confirm-check");
    checkbox.type = "checkbox";
    confirmLabel.append(checkbox, document.createTextNode(" I reviewed the legal buyer, dates, tax and total shown above."));
    const message = element("p", "invoice-workbench__issue-message", "Review the confirmation before issuing.");
    message.setAttribute("role", "status"); message.setAttribute("aria-live", "polite");
    const issueButton = element("button", "invoice-workbench__issue-submit", "Issue legal invoice");
    issueButton.type = "button"; issueButton.disabled = true;
    checkbox.addEventListener("change", () => { issueButton.disabled = !checkbox.checked; });
    let issuing = false; let retainedKey = null;
    issueButton.addEventListener("click", async () => {
      if (issuing || !checkbox.checked || !current(scope, generation, "issue")) return;
      issuing = true; issueButton.disabled = true; message.textContent = "Issuing through the governed financial command…";
      setState("loading", "Issuing the reviewed invoice…");
      try {
        if (!retainedKey) retainedKey = newIssueKey();
        const controller = controlled("issue");
        let response;
        try {
          response = await request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/reservations/${encodeURIComponent(route.reservationId)}/folios/${encodeURIComponent(route.folioId)}/invoice-issue`, {
            method: "POST", headers: { "Idempotency-Key": retainedKey }, signal: controller.signal,
            body: JSON.stringify({ recipientRegistrationId: confirmation.buyer.recipientRegistrationId,
              calendarEvidence: null, expectedSelectorHash: readiness.selectorHash,
              expectedConfirmationHash: readiness.evidenceHash }),
          });
        } finally {
          release(controller);
        }
        if (!current(scope, generation, "issue")) return;
        const invoice = issuedInvoiceEnvelope(response, propertyNode, route, confirmation.buyer.recipientRegistrationId);
        if (!invoice) throw new Error("invalid issued invoice response");
        message.textContent = invoice.replayed ? "The existing issued invoice was recovered." : "Invoice issued. Opening the immutable document…";
        setState("ready", message.textContent);
        await openIssuedDocument(invoice.documentId, scope, generation);
      } catch (error) {
        if (!current(scope, generation, "issue")) return;
        if (!retainedKey) {
          message.textContent = "A secure request identity is unavailable. No invoice request was sent.";
          checkbox.checked = false; issueButton.textContent = "Issue legal invoice";
          setState("offline", message.textContent);
          return;
        }
        const status = errorField(error, "status");
        if (status === 409) {
          retainedKey = null;
          renderIssueFailure(route, "stale", "The displayed evidence changed. Refresh and review a new server confirmation before issuing.",
            () => { void loadIssueReadiness(route, confirmation.buyer.recipientRegistrationId, confirmation.buyer); }, confirmation.buyer);
          return;
        }
        if (status === 401 || status === 403 || status === 422) {
          retainedKey = null;
          renderIssueFailure(route, status === 422 ? "unsupported" : "permission",
            status === 422 ? "Native fiscal invoice issuance is not supported for this property."
              : "You do not have permission to issue this invoice.", null, confirmation.buyer);
          return;
        }
        message.textContent = "The issue outcome is unknown. Retry with the same request identity; do not start another invoice.";
        issueButton.textContent = "Retry same issue request"; issueButton.disabled = false;
        setState("unknown", message.textContent);
      } finally {
        issuing = false;
        if (current(scope, generation, "issue") && root.dataset.invoiceState === "unknown") issueButton.disabled = false;
      }
    });
    surface.append(confirmLabel, message, issueButton); setState("ready", "Authoritative invoice confirmation loaded.");
  }

  async function loadIssueReadiness(route, recipientRegistrationId, retainedRecipient = null) {
    abortKind("issue"); const generation = ++issueGeneration; const scope = scopeGeneration;
    const surface = issueSurface(route, recipientRegistrationId === null ? "Find legal buyer" : "Refreshing invoice confirmation");
    surface.append(element("p", "invoice-workbench__issue-loading", "Checking current folio and statutory evidence…"));
    setState("loading", "Checking authoritative invoice readiness…");
    const controller = controlled("issue");
    try {
      const response = await request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/reservations/${encodeURIComponent(route.reservationId)}/folios/${encodeURIComponent(route.folioId)}/invoice-readiness`, {
        method: "POST", signal: controller.signal,
        body: JSON.stringify({ recipientRegistrationId, calendarEvidence: null }),
      });
      if (!current(scope, generation, "issue")) return;
      const readiness = readinessEnvelope(response, recipientRegistrationId);
      if (!readiness) throw new Error("invalid invoice readiness response");
      if (readiness.kind === "issued") { await openIssuedDocument(readiness.documentId, scope, generation); return; }
      if (readiness.kind === "blocked") { renderBlockedIssue(route, readiness.blocker); return; }
      if (readiness.kind === "selection_required") { renderSelection(route, readiness.recipients); return; }
      renderConfirmation(route, readiness, scope, generation);
    } catch (error) {
      if (!current(scope, generation, "issue") || controller.signal.aborted) return;
      const state = errorState(error);
      renderIssueFailure(route, state, state === "permission" ? "You do not have permission to review or issue this invoice."
        : state === "unsupported" ? "Native fiscal invoice issuance is not supported for this property."
          : "Invoice readiness is unavailable. The selected legal buyer has not been changed.",
      () => { void loadIssueReadiness(route, recipientRegistrationId, retainedRecipient); }, retainedRecipient);
    } finally {
      release(controller);
    }
  }

  function keyboard(event) {
    if (!active || disposed || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    const editing = target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
    if (event.key === "/" && !editing) {
      event.preventDefault(); query.focus();
    } else if (event.key === "Escape" && ["detail", "issue"].includes(root.dataset.invoiceView)
      && matchMedia("(max-width: 900px)").matches) {
      event.preventDefault();
      if (root.dataset.invoiceView === "issue" && currentIssueRoute) issueBack(currentIssueRoute);
      else try { void Promise.resolve(navigate(null)).catch(() => undefined); } catch { /* navigation owner reports its own failure */ }
    }
  }

  async function freshPrintArtifact(documentId, scope, generation) {
    const documentController = controlled("detail");
    let documentValue;
    try {
      const raw = await request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/invoices/${encodeURIComponent(documentId)}`, { signal: documentController.signal });
      if (!current(scope, generation, "detail")) return null;
      documentValue = documentEnvelope(raw, documentId, propertyNode);
      if (!documentValue) throw new Error("invalid invoice response");
    } finally {
      release(documentController);
    }
    const delivery = await readDelivery(documentId, scope, generation);
    if (!delivery || !current(scope, generation, "detail")) return null;
    if (!printModulePromise) printModulePromise = import("/assets/operator-invoice-print.js");
    const module = await printModulePromise;
    if (!current(scope, generation, "detail") || typeof module.buildInvoicePrintArtifact !== "function") return null;
    const result = module.buildInvoicePrintArtifact(documentValue, delivery);
    if (!result || result.ok !== true) throw new Error("invoice print artifact could not be built");
    return result.value;
  }

  function installPrintStyles(target, stylesheet) {
    try {
      const Sheet = target.defaultView?.CSSStyleSheet;
      if (Sheet && "adoptedStyleSheets" in target) {
        const sheet = new Sheet();
        sheet.replaceSync(stylesheet);
        target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
        return sheet;
      }
    } catch { /* use the compatibility fallback below */ }
    const style = target.createElement("style");
    style.textContent = stylesheet; target.head.append(style);
    return style;
  }

  function renderPrintPreview(surface, artifact) {
    surface.replaceChildren();
    if (matchMedia("(max-width: 680px)").matches) {
      surface.classList.add("invoice-workbench__print-preview--summary");
      const summary = element("article", "invoice-workbench__print-summary");
      summary.append(element("h4", "invoice-workbench__print-summary-title", "Print preview"),
        element("strong", "invoice-workbench__print-summary-status", artifact.status.label),
        element("p", "invoice-workbench__print-summary-copy",
          "The complete refreshed A4 invoice will open from Print invoice; it is not compressed into this phone view."));
      surface.append(summary);
      surface.hidden = false;
      return;
    }
    surface.classList.remove("invoice-workbench__print-preview--summary");
    if (!previewStyleSheet) previewStyleSheet = installPrintStyles(document, artifact.stylesheet);
    const parsed = new DOMParser().parseFromString(artifact.markup, "text/html");
    const printable = parsed.body.firstElementChild;
    if (!printable || printable.tagName !== "ARTICLE") throw new Error("invoice print artifact is invalid");
    surface.append(document.importNode(printable, true));
    surface.hidden = false;
  }

  async function printInFrame(artifact) {
    const frame = element("iframe", "invoice-workbench__print-frame");
    frame.title = "Invoice print document"; frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed"; frame.style.width = "1px"; frame.style.height = "1px";
    frame.style.right = "0"; frame.style.bottom = "0"; frame.style.border = "0";
    detail.append(frame);
    const target = frame.contentDocument;
    if (!target || !frame.contentWindow) { frame.remove(); throw new Error("print document could not be opened"); }
    target.documentElement.lang = "en";
    installPrintStyles(target, artifact.stylesheet);
    const parsed = new DOMParser().parseFromString(artifact.markup, "text/html");
    const printable = parsed.body.firstElementChild;
    if (!printable) { frame.remove(); throw new Error("invoice print artifact is invalid"); }
    target.body.append(target.importNode(printable, true));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    frame.contentWindow.focus(); frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1_000);
  }

  async function preparePrint(documentId, shouldPrint, surface, previewButton, printButton) {
    const scope = scopeGeneration; const generation = detailGeneration;
    previewButton.disabled = true; printButton.disabled = true;
    setState("loading", shouldPrint ? "Refreshing invoice before print…" : "Refreshing invoice preview…");
    try {
      const artifact = await freshPrintArtifact(documentId, scope, generation);
      if (!artifact || !current(scope, generation, "detail")) return;
      renderPrintPreview(surface, artifact);
      if (shouldPrint) await printInFrame(artifact);
      if (current(scope, generation, "detail")) setState("ready", shouldPrint ? "Print dialog opened with refreshed invoice data." : "Print preview refreshed.");
    } catch {
      if (current(scope, generation, "detail")) setState("offline", "The invoice could not be refreshed for printing.");
    } finally {
      if (current(scope, generation, "detail")) { previewButton.disabled = false; printButton.disabled = false; }
    }
  }

  async function loadDetail(documentId) {
    abortKind("detail");
    const generation = ++detailGeneration;
    const scope = scopeGeneration;
    const controller = controlled("detail");
    detail.replaceChildren(element("p", "invoice-workbench__detail-loading", "Loading invoice…"));
    setState("loading", "Loading invoice detail…");
    try {
      const raw = await request(`/api/v1/properties/${encodeURIComponent(propertyNode)}/invoices/${encodeURIComponent(documentId)}`, { signal: controller.signal });
      if (!current(scope, generation, "detail")) return;
      const documentValue = documentEnvelope(raw, documentId, propertyNode);
      if (!documentValue) throw new Error("invalid invoice response");
      const delivery = await readDelivery(documentId, scope, generation);
      if (!delivery || !current(scope, generation, "detail")) return;
      const retainedRetry = deliveryRetries.get(documentValue.documentId);
      if (retainedRetry?.status === "unknown" && coherentRetryProgress(delivery, documentValue, retainedRetry)) {
        deliveryRetries.delete(documentValue.documentId);
      }
      renderDetail(documentValue, delivery, scope, generation);
      const retained = delivery.kind === "not_requested" ? registrationRequests.get(documentValue.documentId) : null;
      if (retained?.status === "unknown") {
        setState("unknown", "The provider registration outcome is unknown; retain the same request identity.");
      } else if (deliveryRetries.get(documentValue.documentId)?.status === "unknown") {
        setState("unknown", "The provider retry outcome is unknown; retain the same request identity.");
      } else {
        setState("ready", "Invoice detail loaded from immutable issued source.");
      }
      queueMicrotask(() => { if (current(scope, generation, "detail")) detail.querySelector(".invoice-workbench__detail-heading")?.focus(); });
    } catch (error) {
      if (!current(scope, generation, "detail") || controller.signal.aborted) return;
      const state = errorState(error);
      detail.replaceChildren(element("p", "invoice-workbench__detail-error", state === "permission"
        ? "You do not have permission to read this invoice."
        : state === "unsupported" ? "Native fiscal invoices are not supported for this property."
          : "This invoice is unavailable while the service is offline."));
      setState(state, detail.textContent);
    } finally {
      release(controller);
    }
  }

  form.addEventListener("submit", (event) => { event.preventDefault(); void loadSearch(false); });
  more.addEventListener("click", () => { if (nextCursor) void loadSearch(true); });
  root.addEventListener("keydown", keyboard);

  return Object.freeze({
    async show(documentId) {
      if (disposed) return;
      if (documentId !== null && (typeof documentId !== "string" || !UUID.test(documentId))) throw new TypeError("Invalid invoice document ID");
      abortKind("issue"); issueGeneration += 1; currentIssueRoute = null;
      active = true; root.hidden = false;
      form.hidden = false; queue.hidden = false;
      if (documentId === null) {
        abortKind("detail");
        detailGeneration += 1;
        selectedDocumentId = returnFocusDocumentId;
        root.dataset.invoiceView = "queue";
        renderQueue();
        if (!loaded) await loadSearch(false);
        else setState(rows.length ? "ready" : "empty", rows.length ? `${rows.length} invoices shown.` : "No issued invoices match this search.");
        const focusId = returnFocusDocumentId;
        queueMicrotask(() => {
          if (!active || disposed || !focusId) return;
          queueList.querySelector(`[data-document-id="${focusId}"]`)?.focus();
        });
        return;
      }
      returnFocusDocumentId = documentId;
      selectedDocumentId = documentId;
      root.dataset.invoiceView = "detail";
      renderQueue();
      if (!loaded) void loadSearch(false);
      await loadDetail(documentId);
    },
    async showIssue(value) {
      if (disposed) return;
      const route = issueRoute(value);
      if (!route) throw new TypeError("Invalid invoice issue route");
      abortKind("search"); searchGeneration += 1;
      abortKind("detail"); detailGeneration += 1;
      abortKind("issue"); issueGeneration += 1;
      active = true; root.hidden = false; currentIssueRoute = route;
      selectedDocumentId = null; root.dataset.invoiceView = "issue";
      form.hidden = true; queue.hidden = true;
      await loadIssueReadiness(route, null);
    },
    suspend() {
      if (disposed) return;
      active = false; scopeGeneration += 1; searchGeneration += 1; detailGeneration += 1; issueGeneration += 1;
      currentIssueRoute = null;
      abortAll(); root.hidden = true; root.dataset.invoiceState = "suspended"; root.setAttribute("aria-busy", "false");
    },
    dispose() {
      if (disposed) return;
      active = false; disposed = true; scopeGeneration += 1; searchGeneration += 1; detailGeneration += 1; issueGeneration += 1;
      currentIssueRoute = null;
      abortAll(); rows = []; nextCursor = null; printModulePromise = null; registrationRequests.clear(); deliveryRetries.clear();
      if (previewStyleSheet instanceof CSSStyleSheet && "adoptedStyleSheets" in document) {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => sheet !== previewStyleSheet);
      } else if (previewStyleSheet && typeof previewStyleSheet.remove === "function") previewStyleSheet.remove();
      previewStyleSheet = null; root.removeEventListener("keydown", keyboard); root.replaceChildren(); root.hidden = true;
      root.dataset.invoiceState = "disposed";
    },
  });
}
