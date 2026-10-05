/** @param {unknown} value @returns {value is Record<string, unknown>} */
const record = value => typeof value === "object" && value !== null && !Array.isArray(value);
/** Own data fields only; getter fields are never executed.
 * @param {object} value @param {string} key @returns {unknown}
 */
function data(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if (!("value" in descriptor)) throw new Error("Accessor evidence is unavailable");
  return descriptor.value;
}
/** @param {unknown} value @returns {value is string} */
const nonempty = value => typeof value === "string" && value.trim().length > 0;
/** @param {unknown} value @returns {value is string} */
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
/** @param {unknown} value @returns {value is string} */
const signed = value => typeof value === "string" && /^(?:0|-?[1-9][0-9]*)$/.test(value);
/** Validate native toISOString output without deriving status or changing its display.
 * @param {unknown} value @returns {value is string}
 */
function timestamp(value) {
  if (typeof value !== "string") return false;
  try { return new Date(value).toISOString() === value; } catch { return false; }
}

/** @param {unknown} value @returns {import('../../contexts/financials/index').OwnerTrustApprovalView | null} */
function approval(value) {
  if (!record(value)) return null;
  const approvalId = data(value, "approvalId"), accountReference = data(value, "accountReference");
  const accountLabel = data(value, "accountLabel"), ownerLabel = data(value, "ownerLabel"), currency = data(value, "currency");
  const amountMinor = data(value, "amountMinor"), availableBalanceMinor = data(value, "availableBalanceMinor");
  const projectedBalanceMinor = data(value, "projectedBalanceMinor"), reason = data(value, "reason"), requesterLabel = data(value, "requesterLabel");
  const status = data(value, "status"), requestedAt = data(value, "requestedAt"), decidedAt = data(value, "decidedAt");
  const canDecide = data(value, "canDecide"), canPost = data(value, "canPost");
  if (!uuid(approvalId) || !uuid(accountReference) || typeof accountLabel !== "string" || typeof ownerLabel !== "string"
    || typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency) || typeof amountMinor !== "string" || !/^[1-9][0-9]*$/.test(amountMinor)
    || !signed(availableBalanceMinor) || !signed(projectedBalanceMinor) || !nonempty(reason) || typeof requesterLabel !== "string"
    || (status !== "pending" && status !== "approved" && status !== "rejected" && status !== "expired")
    || !timestamp(requestedAt) || (decidedAt !== null && !timestamp(decidedAt))
    || typeof canDecide !== "boolean" || typeof canPost !== "boolean") return null;
  return { approvalId, accountReference, accountLabel, ownerLabel, currency, amountMinor, availableBalanceMinor,
    projectedBalanceMinor, reason, requesterLabel, status, requestedAt, decidedAt, canDecide, canPost };
}

/** @param {unknown} value @returns {import('./owner-trust-approval-evidence.mjs').ReadyOwnerTrustApprovalEvidenceProps | null} */
function snapshot(value) {
  if (!record(value) || data(value, "state") !== "ready") return null;
  const propertyNode = data(value, "propertyNode"), propertyLabel = data(value, "propertyLabel"), readIdentity = data(value, "readIdentity");
  const page = data(value, "page"), formats = data(value, "formattedAmounts");
  if (!nonempty(propertyNode) || !nonempty(propertyLabel) || !nonempty(readIdentity) || !record(page)
    || (formats !== undefined && !record(formats))) return null;
  const source = data(page, "approvals"), nextCursor = data(page, "nextCursor");
  if (!Array.isArray(source) || (nextCursor !== null && !nonempty(nextCursor))) return null;
  const length = data(source, "length");
  // The pinned native list exports a maximum of 100; never truncate an oversized page.
  if (typeof length !== "number" || length < 0 || length > 100) return null;
  /** @type {import('../../contexts/financials/index').OwnerTrustApprovalView[]} */
  const approvals = [];
  const ids = new Set();
  /** @type {Record<string, Readonly<{before?: string, expense?: string, projected?: string}>>} */
  const formattedAmounts = Object.create(null);
  for (let index = 0; index < length; index++) {
    const item = approval(data(source, String(index)));
    if (!item || ids.has(item.approvalId)) return null;
    ids.add(item.approvalId); approvals.push(item);
    const supplied = formats === undefined ? undefined : data(formats, item.approvalId);
    if (supplied !== undefined && !record(supplied)) return null;
    /** @param {string} key @returns {string | undefined} */
    const format = key => {
      const field = supplied === undefined ? undefined : data(supplied, key);
      return nonempty(field) ? field : undefined;
    };
    formattedAmounts[item.approvalId] = { before: format("before"), expense: format("expense"), projected: format("projected") };
  }
  return { state: "ready", propertyNode, propertyLabel, readIdentity, page: { approvals, nextCursor }, formattedAmounts };
}

/**
 * Render already-admitted request snapshots, without deriving current financial
 * truth, action authority or status. No mounting, requests, handlers or money math.
 * @param {Document} document
 * @param {import('./owner-trust-approval-evidence.mjs').OwnerTrustApprovalEvidenceProps} props
 * @returns {HTMLElement}
 */
export function renderOwnerTrustApprovalEvidence(document, props) {
  /** @param {string} tag @param {string} [text] @param {string} [className] */
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className !== undefined) node.className = className;
    return node;
  };
  /** @param {HTMLElement} parent @param {string} label @param {string} value */
  const fact = (parent, label, value) => {
    const row = element("div", undefined, "owner-approval-evidence__fact");
    row.appendChild(element("dt", label)); row.appendChild(element("dd", value)); parent.appendChild(row);
  };
  /** @type {import('./owner-trust-approval-evidence.mjs').ReadyOwnerTrustApprovalEvidenceProps | null} */
  let accepted = null;
  let state = "unavailable";
  try {
    if (record(props) && data(props, "state") === "loading") state = "loading";
    else { accepted = snapshot(props); if (accepted) state = "ready"; }
  } catch { /* Reject malformed/getter evidence before any historical rows render. */ }
  const section = element("section", undefined, "owner-approval-evidence card");
  section.setAttribute("aria-label", "Owner trust approval request evidence");
  section.setAttribute("data-evidence-state", state); section.setAttribute("aria-busy", state === "loading" ? "true" : "false");
  section.appendChild(element("h3", "Owner trust approval requests"));
  if (!accepted) {
    const status = element("p", state === "loading" ? "Loading owner trust approval evidence…"
      : "Owner trust approval evidence is unavailable. Read the current property again.", "owner-approval-evidence__notice");
    status.setAttribute("role", state === "loading" ? "status" : "alert"); section.appendChild(status); return section;
  }
  section.setAttribute("data-read-identity", accepted.readIdentity);
  section.appendChild(element("p", accepted.propertyLabel, "owner-approval-evidence__context"));
  section.appendChild(element("p", `${accepted.page.approvals.length} requests in this returned page. ${accepted.page.nextCursor === null
    ? "No further page cursor returned." : "More rows are available."}`, "owner-approval-evidence__coverage"));
  section.appendChild(element("p", "Balances are request snapshots. Route hints reflect this read; actions require current governed checks.", "owner-approval-evidence__note"));
  if (accepted.page.approvals.length === 0) section.appendChild(element("p", "No approval requests were returned in this page.", "owner-approval-evidence__notice"));
  const list = element("div", undefined, "owner-approval-evidence__list");
  for (const item of accepted.page.approvals) {
    const row = element("article", undefined, "owner-approval-evidence__request");
    row.setAttribute("data-approval-id", item.approvalId); row.setAttribute("data-status", item.status);
    row.appendChild(element("h4", item.accountLabel || "Account label not supplied"));
    row.appendChild(element("p", item.ownerLabel || "Owner label not supplied", "owner-approval-evidence__owner"));
    const formatted = accepted.formattedAmounts?.[item.approvalId];
    /** @param {string | undefined} supplied @param {string} amount */
    const money = (supplied, amount) => supplied === undefined ? `${amount} ${item.currency} minor units (raw)` : supplied;
    const facts = element("dl", undefined, "owner-approval-evidence__facts");
    fact(facts, "Request status", item.status); fact(facts, "Requested expense", money(formatted?.expense, item.amountMinor));
    fact(facts, "Requested by", item.requesterLabel || "Requester label not supplied");
    row.appendChild(facts); row.appendChild(element("p", item.reason, "owner-approval-evidence__reason"));
    row.appendChild(element("p", item.canDecide ? "Decision route hint: available" : "Decision route hint: unavailable", "owner-approval-evidence__route"));
    row.appendChild(element("p", item.canPost ? "Expense route hint: available" : "Expense route hint: unavailable", "owner-approval-evidence__route"));
    const details = element("details", undefined, "owner-approval-evidence__details");
    const summary = element("summary", "Request details"); summary.setAttribute("aria-label", `Request details for ${item.accountLabel || "owner trust account"}`);
    details.appendChild(summary);
    const history = element("dl", undefined, "owner-approval-evidence__facts");
    fact(history, "Trust funds before (request snapshot)", money(formatted?.before, item.availableBalanceMinor));
    fact(history, "Projected trust funds (request snapshot)", money(formatted?.projected, item.projectedBalanceMinor));
    fact(history, "Requested at (native UTC)", item.requestedAt);
    fact(history, "Decided at (native UTC)", item.decidedAt === null ? "Not supplied" : item.decidedAt);
    fact(history, "Approval reference", item.approvalId); fact(history, "Account reference", item.accountReference);
    fact(history, "Raw currency", item.currency); fact(history, "Exact requested expense minor units", item.amountMinor);
    fact(history, "Exact available minor units at request", item.availableBalanceMinor); fact(history, "Exact projected minor units at request", item.projectedBalanceMinor);
    fact(history, "Exact canDecide", String(item.canDecide)); fact(history, "Exact canPost", String(item.canPost));
    details.appendChild(history); row.appendChild(details); list.appendChild(row);
  }
  section.appendChild(list);
  const pageDetails = element("details", undefined, "owner-approval-evidence__details"); pageDetails.appendChild(element("summary", "Page details"));
  const context = element("dl", undefined, "owner-approval-evidence__facts");
  fact(context, "Caller property reference", accepted.propertyNode); fact(context, "Accepted read reference", accepted.readIdentity);
  fact(context, "Next page cursor", accepted.page.nextCursor === null ? "None returned" : accepted.page.nextCursor);
  pageDetails.appendChild(context); section.appendChild(pageDetails); return section;
}
