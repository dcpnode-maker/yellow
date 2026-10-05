/** @param {unknown} value @returns {value is Record<string, unknown>} */
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read an own data field once; accessors are rejected without executing them.
 * @param {Record<string, unknown>} value @param {string} key @returns {unknown}
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
const signed = value => typeof value === "string" && /^(?:0|-?[1-9][0-9]*)$/.test(value);
/** @param {unknown} value @returns {value is string} */
const positive = value => typeof value === "string" && /^[1-9][0-9]*$/.test(value);

/** @param {unknown} value @returns {import('./owner-trust-expense-preview-evidence.mjs').ReadyOwnerTrustExpensePreviewEvidenceProps | null} */
function snapshot(value) {
  if (!record(value) || data(value, "state") !== "ready") return null;
  const propertyNode = data(value, "propertyNode"), propertyLabel = data(value, "propertyLabel");
  const readIdentity = data(value, "readIdentity"), draftIdentity = data(value, "draftIdentity");
  const source = data(value, "preview"), proposal = data(value, "draft");
  if (!nonempty(propertyNode) || !nonempty(propertyLabel) || !nonempty(readIdentity) || !nonempty(draftIdentity)
    || !record(source) || !record(proposal)) return null;
  const accountReference = data(source, "accountReference"), accountLabel = data(source, "accountLabel");
  const ownerLabel = data(source, "ownerLabel"), currency = data(source, "currency");
  const amountMinor = data(source, "amountMinor"), availableBalanceMinor = data(source, "availableBalanceMinor");
  const projectedBalanceMinor = data(source, "projectedBalanceMinor"), approvalRequired = data(source, "approvalRequired");
  const draftAccount = data(proposal, "accountReference"), draftAmount = data(proposal, "amountMinor"), reason = data(proposal, "reason");
  if (!nonempty(accountReference) || typeof accountLabel !== "string" || typeof ownerLabel !== "string"
    || typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency) || !positive(amountMinor)
    || !signed(availableBalanceMinor) || !signed(projectedBalanceMinor) || typeof approvalRequired !== "boolean"
    || draftAccount !== accountReference || draftAmount !== amountMinor || !nonempty(reason)) return null;
  const formats = data(value, "formattedAmounts");
  if (formats !== undefined && !record(formats)) return null;
  /** @param {string} key @returns {string | undefined} */
  const format = key => {
    const supplied = formats === undefined ? undefined : data(formats, key);
    return nonempty(supplied) ? supplied : undefined;
  };
  // This local snapshot uses the exported native DTO; it creates no business policy.
  return { state: "ready", propertyNode, propertyLabel, readIdentity, draftIdentity,
    preview: { accountReference, accountLabel, ownerLabel, currency, amountMinor,
      availableBalanceMinor, projectedBalanceMinor, approvalRequired },
    draft: { accountReference, amountMinor, reason },
    formattedAmounts: { before: format("before"), expense: format("expense"), projected: format("projected") } };
}

/**
 * Presents already-admitted native preview evidence. The parent binds property,
 * session and draft generation; only account and amount are echoed by native preview.
 * No mounting, callbacks, requests, storage, command authority or money arithmetic.
 * @param {Document} document
 * @param {import('./owner-trust-expense-preview-evidence.mjs').OwnerTrustExpensePreviewEvidenceProps} props
 * @returns {HTMLElement}
 */
export function renderOwnerTrustExpensePreviewEvidence(document, props) {
  /** @param {string} tag @param {string} [text] @param {string} [className] */
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className !== undefined) node.className = className;
    return node;
  };
  /** @param {HTMLElement} parent @param {string} label @param {string} value */
  const fact = (parent, label, value) => {
    const row = element("div", undefined, "owner-preview-evidence__fact");
    row.appendChild(element("dt", label)); row.appendChild(element("dd", value)); parent.appendChild(row);
  };
  /** @type {import('./owner-trust-expense-preview-evidence.mjs').ReadyOwnerTrustExpensePreviewEvidenceProps | null} */
  let accepted = null;
  let state = "unavailable";
  try {
    if (record(props) && data(props, "state") === "loading") state = "loading";
    else { accepted = snapshot(props); if (accepted) state = "ready"; }
  } catch {
    // Reject malformed/accessor evidence atomically before rendering any values.
  }
  const section = element("section", undefined, "owner-preview-evidence card");
  section.setAttribute("aria-label", "Owner trust expense preview evidence");
  section.setAttribute("data-evidence-state", state);
  section.setAttribute("aria-busy", state === "loading" ? "true" : "false");
  section.appendChild(element("h3", "Owner trust expense preview"));
  if (!accepted) {
    const status = element("p", state === "loading" ? "Loading owner trust expense preview…"
      : "Owner trust expense preview is unavailable. Read the current draft again.", "owner-preview-evidence__notice");
    status.setAttribute("role", state === "loading" ? "status" : "alert"); section.appendChild(status); return section;
  }
  const preview = accepted.preview;
  section.setAttribute("data-read-identity", accepted.readIdentity);
  section.setAttribute("data-draft-identity", accepted.draftIdentity);
  section.appendChild(element("p", accepted.propertyLabel, "owner-preview-evidence__context"));
  section.appendChild(element("h4", preview.accountLabel || "Account label not supplied"));
  section.appendChild(element("p", preview.ownerLabel || "Owner label not supplied", "owner-preview-evidence__owner"));
  const facts = element("dl", undefined, "owner-preview-evidence__facts");
  /** @param {string | undefined} supplied @param {string} amount */
  const money = (supplied, amount) => supplied === undefined ? `${amount} ${preview.currency} minor units (raw)` : supplied;
  fact(facts, "Available trust funds before", money(accepted.formattedAmounts?.before, preview.availableBalanceMinor));
  fact(facts, "Expense", money(accepted.formattedAmounts?.expense, preview.amountMinor));
  fact(facts, "Projected trust funds", money(accepted.formattedAmounts?.projected, preview.projectedBalanceMinor));
  fact(facts, "Currency", preview.currency);
  fact(facts, "Approval requirement", preview.approvalRequired ? "Approval required" : "Approval not required");
  section.appendChild(facts);
  section.appendChild(element("p", "Actions require the current governed workbench.", "owner-preview-evidence__note"));
  const details = element("details", undefined, "owner-preview-evidence__details");
  details.appendChild(element("summary", "Preview details"));
  const raw = element("dl", undefined, "owner-preview-evidence__facts");
  fact(raw, "Account reference", preview.accountReference); fact(raw, "Raw currency", preview.currency);
  fact(raw, "Exact available minor units", preview.availableBalanceMinor); fact(raw, "Exact expense minor units", preview.amountMinor);
  fact(raw, "Exact projected minor units", preview.projectedBalanceMinor); fact(raw, "Exact approvalRequired", String(preview.approvalRequired));
  details.appendChild(raw); section.appendChild(details);
  const callerDetails = element("details", undefined, "owner-preview-evidence__details");
  callerDetails.appendChild(element("summary", "Proposed draft details"));
  const draft = element("dl", undefined, "owner-preview-evidence__facts");
  fact(draft, "Caller-proposed reason", accepted.draft.reason); fact(draft, "Caller property reference", accepted.propertyNode);
  fact(draft, "Accepted read reference", accepted.readIdentity); fact(draft, "Caller draft reference", accepted.draftIdentity);
  fact(draft, "Draft account reference", accepted.draft.accountReference); fact(draft, "Draft exact expense minor units", accepted.draft.amountMinor);
  callerDetails.appendChild(element("p", "Reason and property context are supplied by the caller.", "owner-preview-evidence__note"));
  callerDetails.appendChild(draft); section.appendChild(callerDetails); return section;
}
