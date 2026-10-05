/** @param {unknown} value @returns {value is Record<string, unknown>} */
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is import('../../contexts/financials/index').OwnerTrustAccountView} */
function account(value) {
  return record(value) && typeof value.accountReference === "string" && value.accountReference.length > 0
    && typeof value.accountLabel === "string" && typeof value.ownerLabel === "string"
    && typeof value.currency === "string" && /^[A-Z]{3}$/.test(value.currency)
    && typeof value.availableBalanceMinor === "string" && /^(?:0|-?[1-9][0-9]*)$/.test(value.availableBalanceMinor)
    && typeof value.canPost === "boolean";
}

/** @param {unknown} value @returns {value is import('./owner-trust-account-evidence.mjs').ReadyOwnerTrustAccountEvidenceProps} */
function ready(value) {
  return record(value) && value.state === "ready"
    && typeof value.propertyNode === "string" && value.propertyNode.length > 0
    && typeof value.propertyLabel === "string" && value.propertyLabel.length > 0
    && typeof value.readIdentity === "string" && value.readIdentity.length > 0
    && record(value.page) && Array.isArray(value.page.accounts) && Array.from(value.page.accounts).every(account)
    && (value.page.nextCursor === null || typeof value.page.nextCursor === "string");
}

/**
 * Render only supplied, admitted read evidence. This function does not mount the
 * result, fetch, store, attach handlers, infer authority, or perform money math.
 * A fresh detached tree gives even an equal read a fresh closed disclosure.
 * @param {Document} document
 * @param {import('./owner-trust-account-evidence.mjs').OwnerTrustAccountEvidenceProps} props
 * @returns {HTMLElement}
 */
export function renderOwnerTrustAccountEvidence(document, props) {
  /** @param {string} tag @param {string} [text] @param {string} [className] */
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className !== undefined) node.className = className;
    return node;
  };
  /** @param {HTMLElement} parent @param {string} label @param {string} value */
  const fact = (parent, label, value) => {
    const row = element("div", undefined, "owner-account-evidence__fact");
    row.appendChild(element("dt", label));
    row.appendChild(element("dd", value));
    parent.appendChild(row);
  };
  /** @type {import('./owner-trust-account-evidence.mjs').ReadyOwnerTrustAccountEvidenceProps | null} */
  let accepted = null;
  let state = "unavailable";
  try {
    if (record(props) && props.state === "loading") state = "loading";
    else if (ready(props)) { accepted = props; state = "ready"; }
  } catch {
    // Malformed read accessors fail closed before any account data is rendered.
  }
  const section = element("section", undefined, "owner-account-evidence card");
  section.setAttribute("aria-label", "Owner trust account evidence");
  section.setAttribute("data-evidence-state", state);
  section.appendChild(element("h3", "Owner trust accounts"));
  if (!accepted) {
    section.setAttribute("aria-busy", state === "loading" ? "true" : "false");
    const status = element("p", state === "loading" ? "Loading owner trust account evidence…"
      : "Owner trust account evidence is unavailable. Read the current property again.", "owner-account-evidence__notice");
    status.setAttribute("role", state === "loading" ? "status" : "alert");
    section.appendChild(status);
    return section;
  }
  section.setAttribute("data-read-identity", accepted.readIdentity);
  section.setAttribute("aria-busy", "false");
  section.appendChild(element("p", accepted.propertyLabel, "owner-account-evidence__context"));
  const accounts = accepted.page.accounts;
  section.appendChild(element("p", `${accounts.length} account rows in this returned page. ${accepted.page.nextCursor === null
    ? "No further page cursor returned." : "More rows are available."}`, "owner-account-evidence__coverage"));
  section.appendChild(element("p", "Available trust funds are separate from expense preview, approval and posting.", "owner-account-evidence__note"));
  if (accounts.length === 0) section.appendChild(element("p", "No account rows were returned in this page.", "owner-account-evidence__notice"));
  if (accepted.selectedAccountReference && !accounts.some(item => item.accountReference === accepted.selectedAccountReference)) {
    section.appendChild(element("p", "Selected account is not in this returned page.", "owner-account-evidence__note"));
  }
  const list = element("div", undefined, "owner-account-evidence__list");
  for (const item of accounts) {
    const row = element("article", undefined, "owner-account-evidence__account");
    row.setAttribute("data-account-reference", item.accountReference);
    const selected = item.accountReference === accepted.selectedAccountReference;
    row.setAttribute("data-selected", selected ? "true" : "false");
    row.appendChild(element("h4", item.accountLabel || "Account label not supplied"));
    row.appendChild(element("p", item.ownerLabel || "Owner label not supplied", "owner-account-evidence__owner"));
    if (selected) row.appendChild(element("p", "Selected account", "owner-account-evidence__selection"));
    const facts = element("dl", undefined, "owner-account-evidence__facts");
    let formatted;
    try {
      const values = accepted.formattedBalances;
      if (values && Object.hasOwn(values, item.accountReference)) {
        const supplied = values[item.accountReference];
        if (typeof supplied === "string" && supplied.trim().length > 0) formatted = supplied;
      }
    } catch {
      // Missing or malformed optional formatting never becomes a made-up amount.
    }
    fact(facts, "Available trust funds", formatted === undefined
      ? `${item.availableBalanceMinor} ${item.currency} minor units (raw)` : formatted);
    fact(facts, "Currency", item.currency);
    row.appendChild(facts);
    row.appendChild(element("p", item.canPost ? "Expense route available" : "Expense route unavailable", "owner-account-evidence__route"));
    const details = element("details", undefined, "owner-account-evidence__details");
    const summary = element("summary", "Details");
    summary.setAttribute("aria-label", `Details for ${item.accountLabel || "owner trust account"}`);
    details.appendChild(summary);
    const raw = element("dl", undefined, "owner-account-evidence__facts");
    fact(raw, "Account reference", item.accountReference);
    fact(raw, "Raw currency", item.currency);
    fact(raw, "Exact available minor units", item.availableBalanceMinor);
    details.appendChild(raw);
    row.appendChild(details);
    list.appendChild(row);
  }
  section.appendChild(list);
  const pageDetails = element("details", undefined, "owner-account-evidence__details owner-account-evidence__page-details");
  pageDetails.appendChild(element("summary", "Page details"));
  const pageFacts = element("dl", undefined, "owner-account-evidence__facts");
  fact(pageFacts, "Property reference", accepted.propertyNode);
  fact(pageFacts, "Accepted read reference", accepted.readIdentity);
  fact(pageFacts, "Next page cursor", accepted.page.nextCursor === null ? "None returned" : accepted.page.nextCursor);
  pageDetails.appendChild(pageFacts);
  section.appendChild(pageDetails);
  return section;
}
