const CONTACT_KINDS = Object.freeze(["email", "phone", "whatsapp"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const E164 = /^\+[1-9][0-9]{6,14}$/;
let pickerSequence = 0;

function element(tag, className = "", text = "") {
 const target = document.createElement(tag);
 if (className) target.className = className;
 if (text) target.textContent = text;
 return target;
}

function button(className, text) {
 const target = element("button", className, text);
 target.type = "button";
 return target;
}

function labelledInput(id, className, labelText, type = "text", autocomplete = "off") {
 const wrapper = element("label", "party-profile-picker-field");
 const label = element("span", "party-profile-picker-field-label", labelText);
 const input = element("input", className);
 input.id = id;
 input.type = type;
 input.autocomplete = autocomplete;
 wrapper.htmlFor = id;
 wrapper.append(label, input);
 return { wrapper, input };
}

function maskedContactSummary(contacts) {
 return (Array.isArray(contacts) ? contacts : [])
  .flatMap((contact) => typeof contact?.kind === "string" && typeof contact?.hint === "string" && contact.hint.trim()
   ? [`${contact.kind}: ${contact.hint}`]
   : [])
  .join(" · ");
}

function displayName(profile) {
 if (typeof profile?.displayName === "string" && profile.displayName.trim()) return profile.displayName;
 if (typeof profile?.displayNameHint === "string" && profile.displayNameHint.trim()) return profile.displayNameHint;
 return "Selected guest";
}

function errorType(error) {
 return typeof error?.problem?.type === "string" ? error.problem.type : "";
}

function errorStatus(error) {
 return Number.isInteger(error?.status) ? error.status : Number(error?.problem?.status || 0);
}

function requestErrorMessage(error, operation) {
 if (errorStatus(error) === 403 || errorType(error) === "forbidden") {
  return `You do not have permission to ${operation} guest profiles for this property.`;
 }
 if (error instanceof TypeError) return `The ${operation} result is uncertain. Check your connection, then retry without changing the details.`;
 if (error instanceof Error && error.message.trim()) return `${error.message}. Review the details, then retry.`;
 return `The guest ${operation} failed. Review the details, then retry.`;
}

function newRequestKey() {
 if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
 throw new Error("This browser cannot create a safe request key. Refresh in a supported browser.");
}

/**
 * Mounts an isolated Party search/create picker. It never changes reservation membership.
 * The caller owns authenticated transport, current-context guards and the allocation draft.
 */
export function createPartyProfilePicker({
 host,
 request,
 propertyId,
 isCurrent = () => true,
 onSelect,
 onClear,
 isExcluded = () => false,
 initialProfile = null,
}) {
 if (!host || typeof host.replaceChildren !== "function") throw new TypeError("Guest picker host is required");
 if (typeof request !== "function") throw new TypeError("Guest picker request function is required");
 if (typeof propertyId !== "string" || propertyId.trim() === "") throw new TypeError("Guest picker propertyId is required");
 if (typeof isCurrent !== "function" || typeof onSelect !== "function" || typeof onClear !== "function" || typeof isExcluded !== "function") {
  throw new TypeError("Guest picker callbacks are required");
 }

 pickerSequence += 1;
 const prefix = `party-profile-picker-${pickerSequence}`;
 const root = element("section", "party-profile-picker");
 root.setAttribute("aria-label", "Guest profile selection");

 const selected = element("section", "party-profile-picker-selected");
 selected.tabIndex = -1;
 const selectedName = element("strong", "party-profile-picker-selected-name");
 const selectedHints = element("small", "party-profile-picker-selected-hints");
 const change = button("party-profile-picker-change", "Change guest");
 selected.append(selectedName, selectedHints, change);

 const editor = element("section", "party-profile-picker-editor");
 const heading = element("h4", "party-profile-picker-heading", "Choose guest profile");
 const help = element("p", "party-profile-picker-help", "Creating a profile saves it to the guest directory. The reservation changes only when you save guests and shares.");

 const searchFieldset = element("fieldset", "party-profile-picker-search");
 const searchLegend = element("legend", "party-profile-picker-search-legend", "Find an existing guest");
 const searchControl = labelledInput(`${prefix}-search`, "party-profile-picker-search-input", "Name, email or phone", "search", "off");
 const searchAction = button("party-profile-picker-search-action", "Search guests");
 const searchRow = element("div", "party-profile-picker-search-row");
 searchRow.append(searchControl.wrapper, searchAction);
 searchFieldset.append(searchLegend, searchRow);

 const message = element("p", "party-profile-picker-message");
 message.setAttribute("role", "status");
 message.setAttribute("aria-live", "polite");
 message.setAttribute("aria-atomic", "true");
 const results = element("div", "party-profile-picker-results");
 results.setAttribute("aria-label", "Guest profile results");

 const createDetails = element("details", "party-profile-picker-create");
 const createSummary = element("summary", "party-profile-picker-create-summary", "Create a new guest");
 const createFieldset = element("fieldset", "party-profile-picker-create-fields");
 const createLegend = element("legend", "party-profile-picker-create-legend", "New person profile");
 const createDisplay = labelledInput(`${prefix}-display-name`, "party-profile-picker-create-display-name", "Display name", "text", "name");
 const createLegal = labelledInput(`${prefix}-legal-name`, "party-profile-picker-create-legal-name", "Legal name (optional)", "text", "name");
 const createEmail = labelledInput(`${prefix}-email`, "party-profile-picker-create-email", "Email (optional)", "email", "email");
 const createPhone = labelledInput(`${prefix}-phone`, "party-profile-picker-create-phone", "Phone (optional)", "tel", "tel");
 const createWhatsapp = labelledInput(`${prefix}-whatsapp`, "party-profile-picker-create-whatsapp", "WhatsApp (optional)", "tel", "tel");
 const createInputs = Object.freeze([createDisplay.input, createLegal.input, createEmail.input, createPhone.input, createWhatsapp.input]);
 const createAction = button("party-profile-picker-create-action", "Create guest");
 createFieldset.append(createLegend, createDisplay.wrapper, createLegal.wrapper, createEmail.wrapper, createPhone.wrapper, createWhatsapp.wrapper, createAction);
 createDetails.append(createSummary, createFieldset);

 const duplicateReview = element("section", "party-profile-picker-duplicate-review");
 duplicateReview.hidden = true;
 duplicateReview.tabIndex = -1;
 const duplicateHeading = element("h5", "party-profile-picker-duplicate-heading", "Review possible duplicates");
 const duplicateHelp = element("p", "party-profile-picker-duplicate-help", "Choose an existing masked candidate, or review every candidate and confirm this person is distinct.");
 const duplicateCandidates = element("div", "party-profile-picker-duplicate-candidates");
 const confirmLabel = element("label", "party-profile-picker-duplicate-confirm-label");
 const duplicateConfirm = element("input", "party-profile-picker-duplicate-confirm");
 duplicateConfirm.id = `${prefix}-duplicate-confirm`;
 duplicateConfirm.type = "checkbox";
 confirmLabel.htmlFor = duplicateConfirm.id;
 confirmLabel.append(duplicateConfirm, element("span", "", "I reviewed every current masked candidate and this is a distinct person."));
 const createDistinct = button("party-profile-picker-create-distinct", "Create distinct guest");
 createDistinct.disabled = true;
 duplicateReview.append(duplicateHeading, duplicateHelp, duplicateCandidates, confirmLabel, createDistinct);

 const cancel = button("party-profile-picker-cancel", "Clear guest search");
 editor.append(heading, help, searchFieldset, message, results, createDetails, duplicateReview, cancel);
 root.append(selected, editor);
 const detachedFormId = `${prefix}-detached-form`;
 for (const input of [searchControl.input, ...createInputs, duplicateConfirm]) input.setAttribute("form", detachedFormId);
 host.replaceChildren(root);

 let destroyed = false;
 let selectedProfile = initialProfile && typeof initialProfile.partyId === "string" ? initialProfile : null;
 let searchGeneration = 0;
 let createGeneration = 0;
 let searchController = null;
 let createController = null;
 let createAttemptKey = "";
 let createAttemptFingerprint = "";
 let duplicateIds = [];
 let duplicateFingerprint = "";

 function contextIsCurrent() {
  if (destroyed) return false;
  try {
   return isCurrent() === true;
  } catch {
   return false;
  }
 }

 function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("party-profile-picker-message-error", isError);
  message.setAttribute("role", isError ? "alert" : "status");
 }

 function resetSearch() {
  searchGeneration += 1;
  searchController?.abort();
  searchController = null;
  searchFieldset.disabled = false;
  searchControl.input.value = "";
  searchAction.textContent = "Search guests";
  results.replaceChildren();
 }

 function currentCreatePayload() {
  const display = createDisplay.input.value.trim();
  const legalName = createLegal.input.value.trim();
  const values = [createEmail.input.value.trim(), createPhone.input.value.trim(), createWhatsapp.input.value.trim()];
  const contacts = CONTACT_KINDS.flatMap((kind, index) => values[index] ? [{ kind, value: values[index], isPrimary: true }] : []);
  return {
   kind: "person",
   roles: ["guest"],
   displayName: display,
   ...(legalName ? { legalName } : {}),
   contacts,
  };
 }

 function payloadFingerprint(payload = currentCreatePayload()) {
  return JSON.stringify(payload);
 }

 function clearDuplicateReview() {
  duplicateIds = [];
  duplicateFingerprint = "";
  duplicateCandidates.replaceChildren();
  duplicateConfirm.checked = false;
  createDistinct.disabled = true;
  duplicateReview.hidden = true;
 }

 function resetCreate() {
  createGeneration += 1;
  createController?.abort();
  createController = null;
  createAttemptKey = "";
  createAttemptFingerprint = "";
  clearDuplicateReview();
  createFieldset.disabled = false;
  for (const input of createInputs) {
   input.value = "";
   input.removeAttribute("aria-invalid");
  }
  createAction.textContent = "Create guest";
 }

 function renderSelected(profile, moveFocus = true) {
  selectedProfile = profile;
  selectedName.textContent = displayName(profile);
  selectedHints.textContent = maskedContactSummary(profile.contacts) || "No masked contact hint returned";
  selected.hidden = false;
  editor.hidden = true;
  searchFieldset.disabled = true;
  createFieldset.disabled = true;
  if (moveFocus) selected.focus();
 }

 function renderEditor(moveFocus = true) {
  selected.hidden = true;
  editor.hidden = false;
  searchFieldset.disabled = false;
  createFieldset.disabled = false;
  if (moveFocus) searchControl.input.focus();
 }

 function successfulSelection(profile) {
  if (!contextIsCurrent()) return;
  const partyId = typeof profile?.partyId === "string" ? profile.partyId : "";
  if (!partyId) {
   setMessage("The server did not return a selectable guest profile. Retry the search.", true);
   return;
  }
  if (isExcluded(partyId)) {
   setMessage("That guest is already the primary guest or selected in another row. Choose a different profile.", true);
   return;
  }
  searchGeneration += 1;
  createGeneration += 1;
  searchController?.abort();
  createController?.abort();
  searchController = null;
  createController = null;
  try {
   onSelect(profile);
  } catch (error) {
   setMessage(error instanceof Error ? error.message : "This guest could not be selected.", true);
   return;
  }
  resetSearch();
  resetCreate();
  setMessage("");
  renderSelected(profile);
 }

 function profileCard(profile, masked = false) {
  const card = element("article", "party-profile-picker-result");
  const copy = element("div", "party-profile-picker-result-copy");
  const name = element("strong", "party-profile-picker-result-name", displayName(profile));
  const descriptors = masked
   ? ["Possible match", ...(Array.isArray(profile?.reasons) ? profile.reasons.filter((reason) => typeof reason === "string") : [])]
   : [typeof profile?.kind === "string" ? profile.kind : "person", ...(Array.isArray(profile?.roles) ? profile.roles.filter((role) => typeof role === "string") : [])];
  const details = element("span", "party-profile-picker-result-details", descriptors.join(" · "));
  const hints = element("small", "party-profile-picker-result-hints", maskedContactSummary(profile?.contacts) || "No masked contact hint returned");
  const choose = button("party-profile-picker-result-action", masked ? "Choose existing guest" : "Choose guest");
  const partyId = typeof profile?.partyId === "string" ? profile.partyId : "";
  choose.dataset.partyId = partyId;
  choose.setAttribute("aria-label", `Choose ${displayName(profile)} as this guest`);
  if (!partyId || isExcluded(partyId)) {
   choose.disabled = true;
   choose.textContent = "Already selected";
   choose.setAttribute("aria-label", `${displayName(profile)} is already selected`);
  }
  choose.addEventListener("click", () => successfulSelection(profile));
  copy.append(name, details, hints);
  card.append(copy, choose);
  return card;
 }

 function renderProfiles(profiles) {
  results.replaceChildren();
  for (const profile of profiles) results.append(profileCard(profile));
  if (profiles.length === 0) results.append(element("p", "party-profile-picker-empty", "No guest profiles matched. Refine the search or create a new guest."));
  results.tabIndex = -1;
  results.focus();
 }

 async function searchProfiles() {
  if (!contextIsCurrent()) return;
  const query = searchControl.input.value.trim();
  if (!query) {
   setMessage("Enter a name, email, or phone before searching.", true);
   searchControl.input.setAttribute("aria-invalid", "true");
   searchControl.input.focus();
   return;
  }
  searchControl.input.removeAttribute("aria-invalid");
  searchGeneration += 1;
  const generation = searchGeneration;
  searchController?.abort();
  const controller = new AbortController();
  searchController = controller;
  searchFieldset.disabled = true;
  searchAction.textContent = "Searching…";
  results.replaceChildren();
  setMessage("Searching canonical guest profiles…");
  try {
   const response = await request(`/api/v1/properties/${encodeURIComponent(propertyId)}/parties:search`, {
    method: "POST",
    body: JSON.stringify({ query, limit: 20 }),
    signal: controller.signal,
   });
   if (!contextIsCurrent() || generation !== searchGeneration) return;
   const profiles = Array.isArray(response?.profiles) ? response.profiles : [];
   renderProfiles(profiles);
   setMessage(`${profiles.length} guest profile result${profiles.length === 1 ? "" : "s"}. Choose a profile explicitly.`);
  } catch (error) {
   if (!contextIsCurrent() || generation !== searchGeneration) return;
   searchAction.textContent = "Retry search";
   setMessage(requestErrorMessage(error, "search"), true);
  } finally {
   if (contextIsCurrent() && generation === searchGeneration) {
    searchFieldset.disabled = false;
    if (searchAction.textContent === "Searching…") searchAction.textContent = "Search guests";
   }
  }
 }

 function renderDuplicateReview(candidates, fingerprint) {
  const usable = candidates
   .filter((candidate) => typeof candidate?.partyId === "string" && candidate.partyId)
   .sort((left, right) => left.partyId.localeCompare(right.partyId));
  duplicateIds = [...new Set(usable.map((candidate) => candidate.partyId))].sort();
  duplicateFingerprint = fingerprint;
  duplicateCandidates.replaceChildren(...usable.map((candidate) => profileCard(candidate, true)));
  duplicateConfirm.checked = false;
  createDistinct.disabled = true;
  duplicateReview.hidden = false;
  duplicateReview.focus();
 }

 function createInputChanged(event) {
  createDisplay.input.removeAttribute("aria-invalid");
  if (event?.currentTarget instanceof Element) event.currentTarget.removeAttribute("aria-invalid");
  if (createAttemptFingerprint && createAttemptFingerprint !== payloadFingerprint()) {
   createGeneration += 1;
   createController?.abort();
   createController = null;
   createAttemptKey = "";
   createAttemptFingerprint = "";
   clearDuplicateReview();
   createAction.textContent = "Create guest";
   setMessage("Guest details changed. The next create will use a new request key.");
  }
 }

 async function createProfile(acknowledgeDuplicates = false) {
  if (!contextIsCurrent()) return;
  const payload = currentCreatePayload();
  if (!payload.displayName) {
   createDetails.open = true;
   createDisplay.input.setAttribute("aria-invalid", "true");
   setMessage("Enter a display name before creating a guest.", true);
   createDisplay.input.focus();
   return;
  }
  const invalidContact = [
   [createEmail.input, (value) => {
    const normalized = value.normalize("NFKC").trim().toLowerCase();
    return normalized.length <= 254 && EMAIL.test(normalized);
   }],
   [createPhone.input, (value) => E164.test(value.trim())],
   [createWhatsapp.input, (value) => E164.test(value.trim())],
  ].find(([input, valid]) => input.value.trim() && !valid(input.value))?.[0];
  if (invalidContact) {
   createDetails.open = true;
   invalidContact.setAttribute("aria-invalid", "true");
   const kind = invalidContact === createEmail.input ? "email address" : invalidContact === createPhone.input ? "phone number" : "WhatsApp number";
   setMessage(`Enter a valid ${kind} before creating a guest.`, true);
   invalidContact.focus();
   return;
  }
  const fingerprint = payloadFingerprint(payload);
  if (acknowledgeDuplicates && (duplicateIds.length === 0 || !duplicateConfirm.checked || duplicateFingerprint !== fingerprint)) {
   clearDuplicateReview();
   createAttemptKey = "";
   createAttemptFingerprint = "";
   setMessage("Guest details changed. Check current duplicate evidence again before creating a distinct person.");
   await createProfile(false);
   return;
  }
  if (!createAttemptKey || createAttemptFingerprint !== fingerprint) {
   createAttemptKey = newRequestKey();
   createAttemptFingerprint = fingerprint;
   if (duplicateFingerprint !== fingerprint) clearDuplicateReview();
  }
  const requestKey = createAttemptKey;
  const acknowledgement = acknowledgeDuplicates ? [...duplicateIds] : [];
  createGeneration += 1;
  const generation = createGeneration;
  createController?.abort();
  const controller = new AbortController();
  createController = controller;
  createFieldset.disabled = true;
  searchFieldset.disabled = true;
  createDistinct.disabled = true;
  const activeButton = acknowledgeDuplicates ? createDistinct : createAction;
  activeButton.textContent = acknowledgeDuplicates ? "Creating distinct guest…" : "Creating guest…";
  setMessage(acknowledgeDuplicates ? "Creating a distinct person after explicit duplicate review…" : "Checking current duplicate evidence…");
  try {
   const response = await request(`/api/v1/properties/${encodeURIComponent(propertyId)}/parties`, {
    method: "POST",
    headers: { "idempotency-key": requestKey },
    body: JSON.stringify({ ...payload, acknowledgedDuplicatePartyIds: acknowledgement }),
    signal: controller.signal,
   });
   if (!contextIsCurrent() || generation !== createGeneration) return;
   successfulSelection(response?.party);
  } catch (error) {
   if (!contextIsCurrent() || generation !== createGeneration) return;
   const candidates = errorType(error) === "profiles/duplicate_review_required" && Array.isArray(error?.problem?.candidates)
    ? error.problem.candidates
    : null;
   if (candidates) {
    renderDuplicateReview(candidates, fingerprint);
    setMessage("Possible duplicates found. No guest was created. Review every masked candidate below.", true);
   } else {
    activeButton.textContent = acknowledgeDuplicates ? "Retry distinct create" : "Retry create";
    setMessage(requestErrorMessage(error, "create"), true);
   }
  } finally {
   if (contextIsCurrent() && generation === createGeneration) {
    createFieldset.disabled = false;
    searchFieldset.disabled = false;
    if (createAction.textContent === "Creating guest…") createAction.textContent = "Create guest";
    if (createDistinct.textContent === "Creating distinct guest…") createDistinct.textContent = "Create distinct guest";
    createDistinct.disabled = duplicateIds.length === 0 || !duplicateConfirm.checked;
   }
  }
 }

 function clearPicker({ notify = true, focus = true } = {}) {
  if (destroyed) return;
  const hadSelection = selectedProfile !== null;
  selectedProfile = null;
  resetSearch();
  resetCreate();
  setMessage("Guest picker cleared. Any profile already created remains in the guest directory; reservation changes still require Save guests and shares.");
  renderEditor(focus);
  if (notify && hadSelection) onClear();
 }

 function onRootKeydown(event) {
  if (event.key !== "Enter" || event.isComposing) return;
  if (event.target === searchControl.input) {
   event.preventDefault();
   event.stopPropagation();
   void searchProfiles();
   return;
  }
  if (createInputs.includes(event.target)) {
   event.preventDefault();
   event.stopPropagation();
   void createProfile(false);
  }
 }

 function onSearchInput() {
  searchControl.input.removeAttribute("aria-invalid");
  if (searchAction.textContent === "Retry search") searchAction.textContent = "Search guests";
 }

 function destroy() {
  if (destroyed) return;
  destroyed = true;
  searchGeneration += 1;
  createGeneration += 1;
  searchController?.abort();
  createController?.abort();
  searchController = null;
  createController = null;
  selectedProfile = null;
  createAttemptKey = "";
  createAttemptFingerprint = "";
  duplicateIds = [];
  duplicateFingerprint = "";
  root.removeEventListener("keydown", onRootKeydown);
  searchAction.removeEventListener("click", searchProfiles);
  searchControl.input.removeEventListener("input", onSearchInput);
  change.removeEventListener("click", onChange);
  cancel.removeEventListener("click", onCancel);
  createAction.removeEventListener("click", onCreate);
  createDistinct.removeEventListener("click", onCreateDistinct);
  duplicateConfirm.removeEventListener("change", onDuplicateConfirm);
  for (const input of createInputs) input.removeEventListener("input", createInputChanged);
  searchControl.input.value = "";
  for (const input of createInputs) input.value = "";
  results.replaceChildren();
  duplicateCandidates.replaceChildren();
  selectedName.textContent = "";
  selectedHints.textContent = "";
  message.textContent = "";
  if (root.parentNode === host) host.replaceChildren();
  else root.remove();
 }

 function onChange() {
  clearPicker({ notify: true, focus: true });
 }
 function onCancel() {
  clearPicker({ notify: true, focus: true });
 }
 function onCreate() {
  void createProfile(false);
 }
 function onCreateDistinct() {
  void createProfile(true);
 }
 function onDuplicateConfirm() {
  createDistinct.disabled = duplicateIds.length === 0 || !duplicateConfirm.checked;
 }

 root.addEventListener("keydown", onRootKeydown);
 searchAction.addEventListener("click", searchProfiles);
 searchControl.input.addEventListener("input", onSearchInput);
 change.addEventListener("click", onChange);
 cancel.addEventListener("click", onCancel);
 createAction.addEventListener("click", onCreate);
 createDistinct.addEventListener("click", onCreateDistinct);
 duplicateConfirm.addEventListener("change", onDuplicateConfirm);
 for (const input of createInputs) input.addEventListener("input", createInputChanged);

 if (selectedProfile) renderSelected(selectedProfile, false);
 else renderEditor(false);

 return Object.freeze({
  destroy,
  focus() {
   if (!destroyed) (selectedProfile ? change : searchControl.input).focus();
  },
  clear() {
   clearPicker({ notify: true, focus: true });
  },
 });
}
