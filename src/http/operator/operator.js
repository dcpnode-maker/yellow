(() => {
  "use strict";

  let accessToken = "";
  let operator = null;
  let activeView = "availability";
  let inventoryData = { unitTypes: [], spaces: [], sellableUnits: [] };
  let restrictionsData = [];
  let rateData = { policies: [], ratePlans: [] };
  let operationalBlocksData = [];
  let inventoryPolicyData = { oosSellability: "blocked" };
  let activeHoldsData = [];
  let currentRatePrice = null;
  let pricingRowSequence = 0;
  const pendingKeys = new Map();

  const loginView = document.querySelector("#login-view");
  const workbenchView = document.querySelector("#workbench-view");
  const loginForm = document.querySelector("#login-form");
  const loginMessage = document.querySelector("#login-message");
  const availabilityForm = document.querySelector("#availability-form");
  const propertySelect = document.querySelector("#property-select");
  const results = document.querySelector("#results");
  const resultSummary = document.querySelector("#result-summary");
  const sessionState = document.querySelector("#session-state");
  const operatorName = document.querySelector("#operator-name");
  const signOutButton = document.querySelector("#sign-out");
  const themeSelect = document.querySelector("#theme-select");
  const workbenchTitle = document.querySelector("#workbench-title");
  const availabilityView = document.querySelector("#availability-view");
  const inventoryView = document.querySelector("#inventory-view");
  const restrictionsView = document.querySelector("#restrictions-view");
  const ratesView = document.querySelector("#rates-view");
  const operationsView = document.querySelector("#operations-view");
  const navigation = document.querySelectorAll(".domain-tab");
  const refreshInventory = document.querySelector("#refresh-inventory");
  const inventoryStatus = document.querySelector("#inventory-status");
  const unitTypeList = document.querySelector("#unit-type-list");
  const spaceList = document.querySelector("#space-list");
  const sellableList = document.querySelector("#sellable-list");
  const unitTypeCount = document.querySelector("#unit-type-count");
  const spaceCount = document.querySelector("#space-count");
  const sellableCount = document.querySelector("#sellable-count");
  const unitTypeForm = document.querySelector("#unit-type-form");
  const spaceForm = document.querySelector("#space-form");
  const sellableForm = document.querySelector("#sellable-unit-form");
  const sellableUnitType = document.querySelector("#sellable-unit-type");
  const sellableSpace = document.querySelector("#sellable-space");
  const refreshRestrictions = document.querySelector("#refresh-restrictions");
  const restrictionStatus = document.querySelector("#restriction-status");
  const restrictionList = document.querySelector("#restriction-list");
  const restrictionCount = document.querySelector("#restriction-count");
  const restrictionForm = document.querySelector("#restriction-form");
  const restrictionKind = document.querySelector("#restriction-kind");
  const restrictionValueField = document.querySelector("#restriction-value-field");
  const restrictionValueLabel = document.querySelector("#restriction-value-label");
  const restrictionUnitType = document.querySelector("#restriction-unit-type");
  const restrictionSemantics = document.querySelector("#restriction-semantics");
  const refreshRates = document.querySelector("#refresh-rates");
  const ratesStatus = document.querySelector("#rates-status");
  const policyCount = document.querySelector("#policy-count");
  const ratePlanCount = document.querySelector("#rate-plan-count");
  const policyList = document.querySelector("#policy-list");
  const ratePlanList = document.querySelector("#rate-plan-list");
  const policyForm = document.querySelector("#policy-form");
  const ratePlanForm = document.querySelector("#rate-plan-form");
  const policyKind = document.querySelector("#policy-kind");
  const cancellationPolicyFields = document.querySelector("#cancellation-policy-fields");
  const depositPolicyFields = document.querySelector("#deposit-policy-fields");
  const guaranteePolicyFields = document.querySelector("#guarantee-policy-fields");
  const noShowPolicyFields = document.querySelector("#no-show-policy-fields");
  const depositBasis = document.querySelector("#deposit-basis");
  const depositDue = document.querySelector("#deposit-due");
  const depositValueField = document.querySelector("#deposit-value-field");
  const depositDaysField = document.querySelector("#deposit-days-field");
  const planCancellationPolicy = document.querySelector("#plan-cancellation-policy");
  const planGuaranteePolicy = document.querySelector("#plan-guarantee-policy");
  const planDepositPolicy = document.querySelector("#plan-deposit-policy");
  const ratePriceForm = document.querySelector("#rate-price-form");
  const currentPriceForm = document.querySelector("#current-price-form");
  const priceRatePlan = document.querySelector("#price-rate-plan");
  const priceUnitType = document.querySelector("#price-unit-type");
  const currentPricePlan = document.querySelector("#current-price-plan");
  const currentPriceUnitType = document.querySelector("#current-price-unit-type");
  const createTierList = document.querySelector("#create-tier-list");
  const addCreateTier = document.querySelector("#add-create-tier");
  const createExtraAdult = document.querySelector("#create-extra-adult");
  const createChildList = document.querySelector("#create-child-list");
  const addCreateChild = document.querySelector("#add-create-child");
  const currentPriceResult = document.querySelector("#current-price-result");
  const loadPriceCorrectionButton = document.querySelector("#load-price-correction");
  const rateCorrectionForm = document.querySelector("#rate-correction-form");
  const correctionKeySummary = document.querySelector("#correction-key-summary");
  const correctionTierList = document.querySelector("#correction-tier-list");
  const addCorrectionTier = document.querySelector("#add-correction-tier");
  const correctionExtraAdult = document.querySelector("#correction-extra-adult");
  const correctionChildList = document.querySelector("#correction-child-list");
  const addCorrectionChild = document.querySelector("#add-correction-child");
  const refreshOperationalBlocks = document.querySelector("#refresh-operational-blocks");
  const operationalBlockStatus = document.querySelector("#operational-block-status");
  const operationalBlockCount = document.querySelector("#operational-block-count");
  const activeBlockList = document.querySelector("#active-block-list");
  const operationalBlockForm = document.querySelector("#operational-block-form");
  const operationalBlockSpace = document.querySelector("#operational-block-space");
  const operationalBlockKind = document.querySelector("#operational-block-kind");
  const oosPolicyForm = document.querySelector("#oos-policy-form");
  const oosSellability = document.querySelector("#oos-sellability");
  const refreshHolds = document.querySelector("#refresh-holds");
  const activeHoldList = document.querySelector("#active-hold-list");
  const holdStatus = document.querySelector("#hold-status");
  const MAX_MINOR = BigInt("9223372036854775807");

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme === "pixel" ? "pixel" : "apple";
  }

  function localInputValue(date) {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function initializeDates() {
    const from = new Date();
    from.setDate(from.getDate() + 1);
    from.setHours(15, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 2);
    availabilityForm.elements.from.value = localInputValue(from);
    availabilityForm.elements.to.value = localInputValue(to);
    restrictionForm.elements.stayStart.value = localInputValue(from).slice(0, 10);
    restrictionForm.elements.stayEnd.value = localInputValue(to).slice(0, 10);
    ratePriceForm.elements.stayStart.value = localInputValue(from).slice(0, 10);
    ratePriceForm.elements.stayEnd.value = localInputValue(to).slice(0, 10);
    currentPriceForm.elements.stayDate.value = localInputValue(from).slice(0, 10);
    operationalBlockForm.elements.from.value = localInputValue(from);
    operationalBlockForm.elements.to.value = localInputValue(to);
  }

  async function request(path, options = {}) {
    const headers = new Headers(options.headers);
    headers.set("content-type", "application/json");
    if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
    const response = await fetch(path, { ...options, headers });
    let body;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) {
      const message = body && typeof body.detail === "string" ? body.detail : "The request could not be completed";
      throw new Error(message);
    }
    return body;
  }

  function setLoginMessage(message, isError = false) {
    loginMessage.textContent = message;
    loginMessage.classList.toggle("error", isError);
  }

  function showLogin() {
    accessToken = "";
    operator = null;
    loginView.hidden = false;
    workbenchView.hidden = true;
    sessionState.textContent = "Local review · signed out";
    results.replaceChildren();
    inventoryData = { unitTypes: [], spaces: [], sellableUnits: [] };
    restrictionsData = [];
    rateData = { policies: [], ratePlans: [] };
    operationalBlocksData = [];
    inventoryPolicyData = { oosSellability: "blocked" };
    activeHoldsData = [];
    currentRatePrice = null;
    loadPriceCorrectionButton.hidden = true;
    rateCorrectionForm.hidden = true;
    pendingKeys.clear();
    history.replaceState(null, "", "/");
    loginForm.elements.password.value = "";
    loginForm.elements.email.focus();
  }

  async function loadProperties() {
    const body = await request("/api/v1/me/properties");
    propertySelect.replaceChildren();
    for (const property of body.properties) {
      const option = document.createElement("option");
      option.value = property.id;
      option.textContent = `${property.name} · ${property.timezone}`;
      propertySelect.append(option);
    }
    if (body.properties.length === 0) {
      const option = document.createElement("option");
      option.textContent = "No granted properties";
      option.value = "";
      propertySelect.append(option);
      propertySelect.disabled = true;
    } else {
      propertySelect.disabled = false;
      const pathProperty = location.pathname.match(/^\/p\/([0-9a-f-]+)\/(?:availability|inventory|operations|restrictions|rates)$/)?.[1];
      if (pathProperty && body.properties.some(({ id }) => id === pathProperty)) propertySelect.value = pathProperty;
    }
  }

  function showWorkbench() {
    loginView.hidden = true;
    workbenchView.hidden = false;
    sessionState.textContent = `${operator.displayName} · authenticated`;
    operatorName.textContent = `Signed in as ${operator.displayName}. Results come from live tenant-scoped PostgreSQL truth.`;
    propertySelect.focus();
    setView(activeView, false);
  }

  function emptyList(container, message) {
    const item = document.createElement("p");
    item.className = "list-empty";
    item.textContent = message;
    container.replaceChildren(item);
  }

  function inventoryItem(titleText, detailText, badgeText) {
    const item = document.createElement("article");
    item.className = "inventory-item";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = titleText;
    const detail = document.createElement("span");
    detail.textContent = detailText;
    copy.append(title, detail);
    const badge = document.createElement("span");
    badge.className = "mini-badge";
    badge.textContent = badgeText;
    item.append(copy, badge);
    return item;
  }

  function populateSelect(select, items, label, value) {
    select.replaceChildren();
    if (items.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = `Create a ${label} first`;
      select.append(option);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    for (const item of items) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = value(item);
      select.append(option);
    }
  }

  function renderInventory() {
    unitTypeCount.textContent = String(inventoryData.unitTypes.length);
    spaceCount.textContent = String(inventoryData.spaces.length);
    sellableCount.textContent = String(inventoryData.sellableUnits.length);

    unitTypeList.replaceChildren(...inventoryData.unitTypes.map((item) =>
      inventoryItem(item.name, `${item.baseOccupancy} base · ${item.maxOccupancy} max`, item.code)
    ));
    spaceList.replaceChildren(...inventoryData.spaces.map((item) =>
      inventoryItem(`Space ${item.code}`, item.floor ? `Floor ${item.floor}` : "Floor not set", item.status)
    ));
    sellableList.replaceChildren(...inventoryData.sellableUnits.map((item) =>
      inventoryItem(item.name, item.spaces.map((space) => space.code).join(", "), item.unitTypeCode)
    ));
    if (inventoryData.unitTypes.length === 0) emptyList(unitTypeList, "No room types yet.");
    if (inventoryData.spaces.length === 0) emptyList(spaceList, "No physical spaces yet.");
    if (inventoryData.sellableUnits.length === 0) emptyList(sellableList, "No sellable units yet.");
    populateSelect(sellableUnitType, inventoryData.unitTypes, "room type", (item) => `${item.code} · ${item.name}`);
    populateSelect(sellableSpace, inventoryData.spaces, "physical space", (item) => item.code);
    populatePricingSelects();
  }

  async function loadInventory() {
    const property = propertySelect.value;
    if (!property) return;
    inventoryStatus.textContent = "Loading live inventory…";
    try {
      inventoryData = await request(`/api/v1/properties/${encodeURIComponent(property)}/inventory`);
      renderInventory();
      inventoryStatus.textContent = "Inventory is current from tenant-scoped PostgreSQL.";
    } catch (error) {
      inventoryStatus.textContent = error instanceof Error ? error.message : "Inventory could not be loaded";
    }
  }

  function renderOperationalBlocks() {
    operationalBlockCount.textContent = String(operationalBlocksData.length);
    activeBlockList.replaceChildren(...operationalBlocksData.map((block) => {
      const item = document.createElement("article");
      item.className = "restriction-item";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      const space = inventoryData.spaces.find(({ id }) => id === block.spaceId);
      title.textContent = `${block.kind === "ooo" ? "Out of order" : "Out of service"} · ${space?.code || block.spaceId}`;
      const detail = document.createElement("span");
      detail.textContent = `${new Date(block.from).toLocaleString()} → ${new Date(block.to).toLocaleString()} · ${block.reason}`;
      copy.append(title, detail);
      const actions = document.createElement("div");
      actions.className = "block-actions";
      const badge = document.createElement("span");
      badge.className = `mini-badge block-badge-${block.kind}`;
      badge.textContent = block.kind.toUpperCase();
      const close = document.createElement("button");
      close.type = "button";
      close.className = "quiet";
      close.textContent = "Close cause";
      close.setAttribute("aria-label", `Close ${block.kind.toUpperCase()} cause for space ${space?.code || block.spaceId}`);
      close.addEventListener("click", () => void closeOperationalBlock(block, close));
      actions.append(badge, close);
      item.append(copy, actions);
      return item;
    }));
    if (operationalBlocksData.length === 0) emptyList(activeBlockList, "No active operational causes.");
    populateSelect(operationalBlockSpace, inventoryData.spaces, "active physical space", (item) => `Space ${item.code}`);
  }

  async function loadOperationalBlocks() {
    const property = propertySelect.value;
    if (!property) return;
    operationalBlockStatus.textContent = "Loading active operational causes…";
    try {
      const [blocks, inventory] = await Promise.all([
        request(`/api/v1/properties/${encodeURIComponent(property)}/operational-blocks`),
        request(`/api/v1/properties/${encodeURIComponent(property)}/inventory`),
        loadInventoryPolicy(),
      ]);
      operationalBlocksData = blocks.operationalBlocks;
      inventoryData = inventory;
      renderOperationalBlocks();
      operationalBlockStatus.textContent = "Operational causes are current from tenant-scoped PostgreSQL.";
    } catch (error) {
      operationalBlockStatus.textContent = error instanceof Error ? error.message : "Operational causes could not be loaded";
    }
  }

  async function loadInventoryPolicy() {
    const property = propertySelect.value;
    if (!property) return;
    const body = await request(`/api/v1/properties/${encodeURIComponent(property)}/inventory-policy`);
    inventoryPolicyData = body.inventoryPolicy;
    oosSellability.value = inventoryPolicyData.oosSellability;
    formMessage(oosPolicyForm, `Current PostgreSQL policy: ${inventoryPolicyData.oosSellability === "allowed" ? "allowed with warning" : "blocked from sale"}.`);
  }

  async function closeOperationalBlock(block, button) {
    const identity = `operational-block-close:${block.id}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    button.disabled = true;
    operationalBlockStatus.textContent = `Closing ${block.kind.toUpperCase()} cause…`;
    try {
      await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/operational-blocks/${encodeURIComponent(block.id)}/close`, {
        method: "POST", headers: { "idempotency-key": key }, body: "{}",
      });
      pendingKeys.delete(identity);
      operationalBlockStatus.textContent = "Cause closed with exact audit and event evidence.";
      await loadOperationalBlocks();
    } catch (error) {
      operationalBlockStatus.textContent = error instanceof Error ? error.message : "Cause could not be closed";
      button.disabled = false;
    }
  }

  function restrictionKindLabel(kind) {
    return ({
      closed: "Closed to sale", cta: "Closed to arrival", ctd: "Closed to departure",
      min_los: "Minimum stay", max_los: "Maximum stay",
      min_adv: "Minimum advance", max_adv: "Maximum advance",
    })[kind] || kind;
  }

  function renderRestrictions() {
    restrictionCount.textContent = String(restrictionsData.length);
    restrictionList.replaceChildren(...restrictionsData.map((item) => {
      const card = document.createElement("article");
      card.className = "restriction-item";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = restrictionKindLabel(item.kind);
      const detail = document.createElement("span");
      const roomType = inventoryData.unitTypes.find(({ id }) => id === item.unitTypeId);
      const scope = roomType ? `${roomType.code} · ${roomType.name}` : "All room types";
      detail.textContent = `${item.stayStart} → ${item.stayEnd} (end exclusive) · ${scope}${item.channelCode ? ` · ${item.channelCode}` : ""}`;
      copy.append(title, detail);
      const badge = document.createElement("span");
      badge.className = "mini-badge restriction-badge";
      badge.textContent = item.value === null ? "Active" : String(item.value);
      card.append(copy, badge);
      return card;
    }));
    if (restrictionsData.length === 0) emptyList(restrictionList, "No manual restrictions yet.");
  }

  function populateRestrictionUnitTypes() {
    const current = restrictionUnitType.value;
    restrictionUnitType.replaceChildren(new Option("All room types", ""));
    for (const item of inventoryData.unitTypes) {
      restrictionUnitType.append(new Option(`${item.code} · ${item.name}`, item.id));
    }
    if ([...restrictionUnitType.options].some(({ value }) => value === current)) restrictionUnitType.value = current;
  }

  async function loadRestrictions() {
    const property = propertySelect.value;
    if (!property) return;
    restrictionStatus.textContent = "Loading live restrictions…";
    try {
      const [restrictionBody, inventoryBody] = await Promise.all([
        request(`/api/v1/properties/${encodeURIComponent(property)}/restrictions`),
        request(`/api/v1/properties/${encodeURIComponent(property)}/inventory`),
      ]);
      restrictionsData = restrictionBody.restrictions;
      inventoryData = inventoryBody;
      populateRestrictionUnitTypes();
      renderRestrictions();
      restrictionStatus.textContent = "Restrictions are current from tenant-scoped PostgreSQL.";
    } catch (error) {
      restrictionStatus.textContent = error instanceof Error ? error.message : "Restrictions could not be loaded";
    }
  }

  function updateRestrictionFields() {
    const kind = restrictionKind.value;
    const valued = ["min_los", "max_los", "min_adv", "max_adv"].includes(kind);
    restrictionValueField.hidden = !valued;
    restrictionForm.elements.value.required = valued;
    if (!valued) restrictionForm.elements.value.value = "";
    const advance = kind === "min_adv" || kind === "max_adv";
    restrictionValueLabel.textContent = advance ? "Days before arrival" : "Nights";
    restrictionSemantics.textContent = ({
      closed: "Closed to sale blocks overlapping stays for the chosen scope.",
      cta: "Closed to arrival blocks check-in on dates inside this range.",
      ctd: "Closed to departure blocks check-out on dates inside this range.",
      min_los: "Minimum length of stay requires at least this many nights.",
      max_los: "Maximum length of stay permits no more than this many nights.",
      min_adv: "Minimum advance requires booking at least this many days before arrival.",
      max_adv: "Maximum advance prevents booking more than this many days before arrival.",
    })[kind];
  }

  function policyKindLabel(kind) {
    return ({ cancellation: "Cancellation", deposit: "Deposit", guarantee: "Guarantee", no_show: "No show" })[kind] || kind;
  }

  function policySummary(policy) {
    if (policy.kind === "cancellation") {
      return `${policy.content.rules.length} rule${policy.content.rules.length === 1 ? "" : "s"}`;
    }
    if (policy.kind === "deposit") return `${policy.content.deposit.basis.replaceAll("_", " ")} · ${policy.content.deposit.due.replaceAll("_", " ")}`;
    if (policy.kind === "guarantee") return policy.content.guarantee.replaceAll("_", " ");
    return policy.content.no_show_charge.basis.replaceAll("_", " ");
  }

  function populatePolicySelect(select, kind, label) {
    const current = select.value;
    select.replaceChildren(new Option(`No ${label.toLowerCase()} policy`, ""));
    for (const policy of rateData.policies.filter((item) => item.kind === kind)) {
      select.append(new Option(policy.name, policy.id));
    }
    if ([...select.options].some(({ value }) => value === current)) select.value = current;
  }

  function renderRates() {
    policyCount.textContent = String(rateData.policies.length);
    ratePlanCount.textContent = String(rateData.ratePlans.length);
    policyList.replaceChildren(...rateData.policies.map((policy) =>
      inventoryItem(policy.name, policySummary(policy), policyKindLabel(policy.kind))
    ));
    ratePlanList.replaceChildren(...rateData.ratePlans.map((plan) =>
      inventoryItem(plan.name, `${plan.currency} · ${plan.taxInclusive ? "tax inclusive" : "tax exclusive"}${plan.marketCode ? ` · ${plan.marketCode}` : ""}`, plan.code)
    ));
    if (rateData.policies.length === 0) emptyList(policyList, "No reusable policies yet.");
    if (rateData.ratePlans.length === 0) emptyList(ratePlanList, "No base rate plans yet.");
    populatePolicySelect(planCancellationPolicy, "cancellation", "Cancellation");
    populatePolicySelect(planGuaranteePolicy, "guarantee", "Guarantee");
    populatePolicySelect(planDepositPolicy, "deposit", "Deposit");
    populatePricingSelects();
  }

  function populatePricingSelects() {
    populateSelect(priceRatePlan, rateData.ratePlans, "base rate plan", (item) => `${item.code} · ${item.name} · ${item.currency}`);
    populateSelect(currentPricePlan, rateData.ratePlans, "base rate plan", (item) => `${item.code} · ${item.name} · ${item.currency}`);
    populateSelect(priceUnitType, inventoryData.unitTypes, "room type", (item) => `${item.code} · ${item.name}`);
    populateSelect(currentPriceUnitType, inventoryData.unitTypes, "room type", (item) => `${item.code} · ${item.name}`);
  }

  async function loadRates() {
    const property = propertySelect.value;
    if (!property) return;
    ratesStatus.textContent = "Loading live rate configuration…";
    try {
      const [rates, inventory] = await Promise.all([
        request(`/api/v1/properties/${encodeURIComponent(property)}/rate-configuration`),
        request(`/api/v1/properties/${encodeURIComponent(property)}/inventory`),
      ]);
      rateData = rates;
      inventoryData = inventory;
      renderInventory();
      renderRates();
      ratesStatus.textContent = "Policies and plans are current from tenant-scoped PostgreSQL.";
    } catch (error) {
      ratesStatus.textContent = error instanceof Error ? error.message : "Rate configuration could not be loaded";
    }
  }

  function updatePolicyFields() {
    const kind = policyKind.value;
    cancellationPolicyFields.hidden = kind !== "cancellation";
    depositPolicyFields.hidden = kind !== "deposit";
    guaranteePolicyFields.hidden = kind !== "guarantee";
    noShowPolicyFields.hidden = kind !== "no_show";
    updateDepositFields();
  }

  function updateDepositFields() {
    depositValueField.hidden = depositBasis.value !== "percent";
    depositPolicyFields.querySelector('input[name="depositValue"]').required = depositBasis.value === "percent";
    depositDaysField.hidden = depositDue.value !== "days_before_arrival";
    depositPolicyFields.querySelector('input[name="depositDays"]').required = depositDue.value === "days_before_arrival";
  }

  function setView(view, updateHistory = true) {
    activeView = ["availability", "inventory", "operations", "restrictions", "rates"].includes(view) ? view : "availability";
    availabilityView.hidden = activeView !== "availability";
    inventoryView.hidden = activeView !== "inventory";
    restrictionsView.hidden = activeView !== "restrictions";
    ratesView.hidden = activeView !== "rates";
    operationsView.hidden = activeView !== "operations";
    workbenchTitle.textContent = activeView === "inventory" ? "Inventory setup" :
      activeView === "operations" ? "Operations" : activeView === "restrictions" ? "Restrictions" :
        activeView === "rates" ? "Rates" : "Availability";
    for (const tab of navigation) {
      const selected = tab.dataset.view === activeView;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-current", selected ? "page" : "false");
    }
    if (propertySelect.value && updateHistory) {
      history.pushState(null, "", `/p/${propertySelect.value}/${activeView}`);
    }
    if (activeView === "inventory") void loadInventory();
    if (activeView === "availability") void loadActiveHolds();
    if (activeView === "operations") void loadOperationalBlocks();
    if (activeView === "restrictions") void loadRestrictions();
    if (activeView === "rates") void loadRates();
  }

  function formMessage(form, message, isError = false) {
    const target = form.querySelector(".form-message");
    target.textContent = message;
    target.classList.toggle("error", isError);
  }

  async function submitInventory(form, route, body) {
    const button = form.querySelector("button[type=submit]");
    const identity = `${route}:${JSON.stringify(body)}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    button.disabled = true;
    formMessage(form, "Saving through the audited inventory service…");
    try {
      await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/inventory/${route}`, {
        method: "POST",
        headers: { "idempotency-key": key },
        body: JSON.stringify(body),
      });
      pendingKeys.delete(identity);
      formMessage(form, "Saved. Audit fact and event committed.");
      await loadInventory();
      return true;
    } catch (error) {
      formMessage(form, error instanceof Error ? error.message : "Save failed", true);
      return false;
    } finally {
      button.disabled = false;
    }
  }

  async function submitRestriction(body) {
    const button = restrictionForm.querySelector("button[type=submit]");
    const identity = `restrictions:${JSON.stringify(body)}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    button.disabled = true;
    formMessage(restrictionForm, "Saving through the audited restriction service…");
    try {
      await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/restrictions`, {
        method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify(body),
      });
      pendingKeys.delete(identity);
      formMessage(restrictionForm, "Saved. Audit fact and event committed.");
      await loadRestrictions();
      return true;
    } catch (error) {
      formMessage(restrictionForm, error instanceof Error ? error.message : "Save failed", true);
      return false;
    } finally {
      button.disabled = false;
    }
  }

  async function submitRate(form, route, body) {
    const button = form.querySelector("button[type=submit]");
    const identity = `rate-configuration:${route}:${JSON.stringify(body)}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    button.disabled = true;
    formMessage(form, "Saving through the audited rate configuration service…");
    try {
      await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/rate-configuration/${route}`, {
        method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify(body),
      });
      pendingKeys.delete(identity);
      formMessage(form, "Saved. Audit fact and event committed.");
      await loadRates();
      return true;
    } catch (error) {
      formMessage(form, error instanceof Error ? error.message : "Save failed", true);
      return false;
    } finally {
      button.disabled = false;
    }
  }

  function canonicalMinor(value, label, optional = false) {
    const text = String(value ?? "");
    if (optional && text === "") return undefined;
    if (!/^(?:0|[1-9]\d*)$/.test(text) || BigInt(text) > MAX_MINOR) {
      throw new Error(`${label} must be exact non-negative minor units without signs, decimals or leading zeros`);
    }
    return text;
  }

  function pricingEditorRow(kind, firstValue = "", amountValue = "") {
    pricingRowSequence += 1;
    const row = document.createElement("div");
    row.className = "pricing-editor-row";
    row.dataset.kind = kind;

    const firstLabel = document.createElement("label");
    const firstText = kind === "tier" ? "Adults" : "Maximum child age";
    firstLabel.textContent = firstText;
    const first = document.createElement("input");
    first.type = "number";
    first.required = true;
    first.min = kind === "tier" ? "1" : "0";
    first.max = kind === "tier" ? "100" : "17";
    first.step = "1";
    first.value = String(firstValue);
    first.dataset.field = kind === "tier" ? "adults" : "maxAge";
    first.setAttribute("aria-label", `${firstText} row ${pricingRowSequence}`);
    firstLabel.append(first);

    const amountLabel = document.createElement("label");
    amountLabel.textContent = "Exact minor units";
    const amount = document.createElement("input");
    amount.required = true;
    amount.inputMode = "numeric";
    amount.pattern = "0|[1-9][0-9]*";
    amount.value = String(amountValue);
    amount.dataset.field = "amountMinor";
    amount.setAttribute("aria-label", `Exact minor units row ${pricingRowSequence}`);
    amountLabel.append(amount);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "quiet remove-pricing-row";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${kind === "tier" ? "occupancy tier" : "child band"} row ${pricingRowSequence}`);
    remove.addEventListener("click", () => row.remove());
    row.append(firstLabel, amountLabel, remove);
    return row;
  }

  function addTier(container, adults = "", amountMinor = "") {
    if (container.children.length >= 100) throw new Error("At most 100 occupancy tiers are allowed");
    container.append(pricingEditorRow("tier", adults, amountMinor));
  }

  function addChildBand(container, maxAge = "", amountMinor = "") {
    if (container.children.length >= 20) throw new Error("At most 20 child age bands are allowed");
    container.append(pricingEditorRow("child", maxAge, amountMinor));
  }

  function readPricingEditor(tierList, extraAdultInput, childList) {
    const tierRows = [...tierList.querySelectorAll('[data-kind="tier"]')];
    if (tierRows.length < 1 || tierRows.length > 100) throw new Error("Provide between 1 and 100 occupancy tiers");
    const seenAdults = new Set();
    const occupancy = tierRows.map((row) => {
      const adults = Number(row.querySelector('[data-field="adults"]').value);
      if (!Number.isInteger(adults) || adults < 1 || adults > 100 || seenAdults.has(adults)) {
        throw new Error("Occupancy adults must be unique whole numbers from 1 to 100");
      }
      seenAdults.add(adults);
      return { adults, amountMinor: canonicalMinor(row.querySelector('[data-field="amountMinor"]').value, `Price for ${adults} adults`) };
    });

    const childRows = [...childList.querySelectorAll('[data-kind="child"]')];
    if (childRows.length > 20) throw new Error("At most 20 child age bands are allowed");
    let previousAge = -1;
    const extraChildren = childRows.map((row) => {
      const maxAge = Number(row.querySelector('[data-field="maxAge"]').value);
      if (!Number.isInteger(maxAge) || maxAge < 0 || maxAge > 17 || maxAge <= previousAge) {
        throw new Error("Child maximum ages must be whole numbers from 0 to 17 in strictly increasing order");
      }
      previousAge = maxAge;
      return { maxAge, amountMinor: canonicalMinor(row.querySelector('[data-field="amountMinor"]').value, `Child price through age ${maxAge}`) };
    });
    const extraAdultMinor = canonicalMinor(extraAdultInput.value, "Extra-adult price", true);
    return {
      occupancy,
      ...(extraAdultMinor === undefined ? {} : { extraAdultMinor }),
      ...(extraChildren.length === 0 ? {} : { extraChildren }),
    };
  }

  function setPricingEditor(tierList, extraAdultInput, childList, pricing) {
    tierList.replaceChildren();
    for (const [adults, amountMinor] of Object.entries(pricing.occupancy)) addTier(tierList, adults, amountMinor);
    extraAdultInput.value = pricing.extraAdultMinor ?? "";
    childList.replaceChildren();
    for (const child of pricing.extraChildren || []) addChildBand(childList, child.maxAge, child.amountMinor);
  }

  async function submitPrice(body) {
    const button = ratePriceForm.querySelector("button[type=submit]");
    const identity = `rate-price:${JSON.stringify(body)}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    button.disabled = true;
    formMessage(ratePriceForm, "Saving exact money through the audited pricing service…");
    try {
      const result = await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/rate-prices`, {
        method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify(body),
      });
      pendingKeys.delete(identity);
      formMessage(ratePriceForm, `Saved ${result.ratePrice.currency} price. Audit fact and event committed.`);
      currentPriceForm.elements.ratePlanId.value = body.ratePlanId;
      currentPriceForm.elements.unitTypeId.value = body.unitTypeId;
      currentPriceForm.elements.stayDate.value = body.stayStart;
      return true;
    } catch (error) {
      formMessage(ratePriceForm, error instanceof Error ? error.message : "Price save failed", true);
      return false;
    } finally {
      button.disabled = false;
    }
  }

  function renderCurrentPrice(price) {
    currentRatePrice = price;
    const plan = rateData.ratePlans.find(({ id }) => id === price.ratePlanId);
    const unit = inventoryData.unitTypes.find(({ id }) => id === price.unitTypeId);
    const tiers = Object.entries(price.pricing.occupancy).map(([adults, amount]) => `${adults} adult${adults === "1" ? "" : "s"}: ${amount} minor units`);
    if (price.pricing.extraAdultMinor !== null) tiers.push(`Extra adult: ${price.pricing.extraAdultMinor} minor units`);
    for (const child of price.pricing.extraChildren) tiers.push(`Child through age ${child.maxAge}: ${child.amountMinor} minor units`);
    currentPriceResult.textContent = `${plan?.code || "Plan"} · ${unit?.code || "Room type"} · ${price.currency}\n${price.stayStart} → ${price.stayEnd} (end exclusive)\n${tiers.join("\n")}`;
    loadPriceCorrectionButton.hidden = false;
  }

  function loadPriceCorrection(price) {
    currentRatePrice = price;
    const plan = rateData.ratePlans.find(({ id }) => id === price.ratePlanId);
    const unit = inventoryData.unitTypes.find(({ id }) => id === price.unitTypeId);
    correctionKeySummary.textContent = `${plan?.code || price.ratePlanId} · ${unit?.code || price.unitTypeId} · ${price.stayStart} → ${price.stayEnd} · weekday mask ${price.dowMask} · ${price.currency}`;
    setPricingEditor(correctionTierList, correctionExtraAdult, correctionChildList, price.pricing);
    rateCorrectionForm.hidden = false;
    rateCorrectionForm.querySelector("h3").focus?.();
  }

  function causeNode(cause, type) {
    const item = document.createElement("li");
    item.className = `cause ${cause.blocks ? "blocking" : "warning"}`;
    const title = document.createElement("strong");
    title.textContent = type === "restriction" ? `Restriction · ${cause.kind}` : `${cause.kind.toUpperCase()} · ${cause.blocks ? "blocks sale" : "warning only"}`;
    const detail = document.createElement("span");
    detail.textContent = type === "restriction"
      ? (cause.value === null ? "Rule is active" : `Rule value: ${cause.value}`)
      : (cause.reason || "No reason recorded");
    item.append(title, detail);
    return item;
  }

  function renderActiveHolds() {
    activeHoldList.replaceChildren(...activeHoldsData.map((hold) => {
      const item = document.createElement("article");
      item.className = "restriction-item";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = typeof hold.holder?.reference === "string"
        ? hold.holder.reference
        : "Temporary hold";
      const detail = document.createElement("span");
      detail.textContent = `${new Date(hold.from).toLocaleString()} → ${new Date(hold.to).toLocaleString()} · expires ${new Date(hold.expiresAt).toLocaleTimeString()}`;
      copy.append(title, detail);
      const release = document.createElement("button");
      release.type = "button";
      release.className = "quiet compact";
      release.textContent = "Release hold";
      release.addEventListener("click", () => void releaseHold(hold, release));
      item.append(copy, release);
      return item;
    }));
    if (activeHoldsData.length === 0) emptyList(activeHoldList, "No active cart holds.");
  }

  async function loadActiveHolds() {
    const property = propertySelect.value;
    if (!property) return;
    holdStatus.textContent = "Loading active holds…";
    try {
      const body = await request(`/api/v1/properties/${encodeURIComponent(property)}/holds`);
      activeHoldsData = body.holds;
      renderActiveHolds();
      holdStatus.textContent = `${activeHoldsData.length} active hold${activeHoldsData.length === 1 ? "" : "s"} from tenant-scoped PostgreSQL.`;
    } catch (error) {
      holdStatus.textContent = error instanceof Error ? error.message : "Active holds could not be loaded";
    }
  }

  async function placeHold(option, button) {
    if (!availabilityForm.reportValidity()) return;
    const holderInput = availabilityForm.elements.namedItem("holderReference");
    if (!(holderInput instanceof HTMLInputElement) || holderInput.value.trim().length === 0) {
      holdStatus.textContent = "Add a holder or cart reference before placing a hold.";
      holderInput?.focus();
      return;
    }
    const fields = new FormData(availabilityForm);
    const body = {
      sellableUnitId: option.sellableUnitId,
      from: new Date(String(fields.get("from"))).toISOString(),
      to: new Date(String(fields.get("to"))).toISOString(),
      holderReference: holderInput.value.trim(),
    };
    const identity = `hold-place:${propertySelect.value}:${JSON.stringify(body)}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    button.disabled = true;
    holdStatus.textContent = "Protecting this room for ten minutes…";
    try {
      await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/holds`, {
        method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify(body),
      });
      pendingKeys.delete(identity);
      holdStatus.textContent = "Hold placed. This is temporary inventory protection, not a reservation.";
      await loadActiveHolds();
      availabilityForm.requestSubmit();
    } catch (error) {
      holdStatus.textContent = error instanceof Error ? error.message : "Hold could not be placed";
      button.disabled = false;
    }
  }

  async function releaseHold(hold, button) {
    const identity = `hold-release:${hold.id}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    button.disabled = true;
    holdStatus.textContent = "Releasing temporary inventory protection…";
    try {
      await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/holds/${encodeURIComponent(hold.id)}/release`, {
        method: "POST", headers: { "idempotency-key": key }, body: "{}",
      });
      pendingKeys.delete(identity);
      holdStatus.textContent = "Hold released. Availability is being refreshed.";
      await loadActiveHolds();
      availabilityForm.requestSubmit();
    } catch (error) {
      holdStatus.textContent = error instanceof Error ? error.message : "Hold could not be released";
      button.disabled = false;
    }
  }

  function renderOptions(options) {
    results.replaceChildren();
    if (options.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No active sellable configurations fit this search. Inventory setup may still be required.";
      results.append(empty);
      resultSummary.textContent = "No options returned.";
      return;
    }

    const bookable = options.filter((option) => option.bookable).length;
    resultSummary.textContent = `${options.length} option${options.length === 1 ? "" : "s"} · ${bookable} bookable`;
    for (const option of options) {
      const card = document.createElement("article");
      card.className = `option-card ${option.bookable ? "" : "is-blocked"}`;
      const head = document.createElement("div");
      head.className = "option-head";
      const identity = document.createElement("div");
      const name = document.createElement("h2");
      name.textContent = option.sellableUnitName;
      const code = document.createElement("div");
      code.className = "code";
      code.textContent = `${option.unitTypeCode} · max ${option.maxOccupancy}`;
      identity.append(name, code);
      const count = document.createElement("div");
      count.className = "count";
      const number = document.createElement("strong");
      number.textContent = String(option.availableCount);
      const countLabel = document.createElement("span");
      countLabel.textContent = "physically free";
      count.append(number, countLabel);
      head.append(identity, count);

      const badge = document.createElement("span");
      badge.className = `badge ${option.bookable ? "available" : "blocked"}`;
      badge.textContent = option.bookable ? "Bookable" : "Not bookable";
      card.append(head, badge);

      const causes = document.createElement("ul");
      causes.className = "cause-list";
      for (const restriction of option.restrictionsApplied) causes.append(causeNode(restriction, "restriction"));
      for (const block of option.operationalBlocksApplied) causes.append(causeNode(block, "operational"));
      if (causes.childElementCount > 0) card.append(causes);
      if (option.bookable) {
        const actions = document.createElement("div");
        actions.className = "option-actions";
        const hold = document.createElement("button");
        hold.type = "button";
        hold.className = "secondary";
        hold.textContent = "Hold for 10 minutes";
        hold.addEventListener("click", () => void placeHold(option, hold));
        actions.append(hold);
        card.append(actions);
      }
      results.append(card);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector("button[type=submit]");
    button.disabled = true;
    setLoginMessage("Checking credentials…");
    try {
      const fields = new FormData(loginForm);
      const body = await request("/api/v1/auth/local:login", {
        method: "POST",
        body: JSON.stringify({
          tenant: fields.get("tenant"),
          email: fields.get("email"),
          password: fields.get("password"),
        }),
      });
      accessToken = body.accessToken;
      operator = body.user;
      loginForm.elements.password.value = "";
      await loadProperties();
      showWorkbench();
      setLoginMessage("");
    } catch (error) {
      accessToken = "";
      setLoginMessage(error instanceof Error ? error.message : "Sign-in failed", true);
    } finally {
      button.disabled = false;
    }
  });

  availabilityForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = availabilityForm.querySelector("button[type=submit]");
    button.disabled = true;
    resultSummary.textContent = "Searching PostgreSQL truth…";
    results.replaceChildren();
    try {
      const fields = new FormData(availabilityForm);
      const property = propertySelect.value;
      const from = new Date(String(fields.get("from")));
      const to = new Date(String(fields.get("to")));
      const body = await request(`/api/v1/properties/${encodeURIComponent(property)}/availability:search`, {
        method: "POST",
        body: JSON.stringify({
          from: from.toISOString(),
          to: to.toISOString(),
          partySize: Number(fields.get("partySize")),
        }),
      });
      history.pushState(null, "", `/p/${property}/availability`);
      renderOptions(body.options);
    } catch (error) {
      resultSummary.textContent = error instanceof Error ? error.message : "Search failed";
    } finally {
      button.disabled = false;
    }
  });

  propertySelect.addEventListener("change", () => {
    if (propertySelect.value) history.replaceState(null, "", `/p/${propertySelect.value}/${activeView}`);
    if (activeView === "inventory") void loadInventory();
    if (activeView === "availability") void loadActiveHolds();
    if (activeView === "operations") void loadOperationalBlocks();
    if (activeView === "restrictions") void loadRestrictions();
    if (activeView === "rates") void loadRates();
  });
  for (const tab of navigation) tab.addEventListener("click", () => setView(tab.dataset.view));
  refreshInventory.addEventListener("click", () => void loadInventory());
  refreshRestrictions.addEventListener("click", () => void loadRestrictions());
  refreshRates.addEventListener("click", () => void loadRates());
  refreshOperationalBlocks.addEventListener("click", () => void loadOperationalBlocks());
  refreshHolds.addEventListener("click", () => void loadActiveHolds());
  restrictionKind.addEventListener("change", updateRestrictionFields);
  policyKind.addEventListener("change", updatePolicyFields);
  depositBasis.addEventListener("change", updateDepositFields);
  depositDue.addEventListener("change", updateDepositFields);
  addCreateTier.addEventListener("click", () => addTier(createTierList));
  addCreateChild.addEventListener("click", () => addChildBand(createChildList));
  addCorrectionTier.addEventListener("click", () => addTier(correctionTierList));
  addCorrectionChild.addEventListener("click", () => addChildBand(correctionChildList));
  loadPriceCorrectionButton.addEventListener("click", () => {
    if (currentRatePrice) loadPriceCorrection(currentRatePrice);
  });
  unitTypeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(unitTypeForm);
    const saved = await submitInventory(unitTypeForm, "unit-types", {
      code: fields.get("code"), name: fields.get("name"), profileKey: "hotel",
      baseOccupancy: Number(fields.get("baseOccupancy")),
      maxOccupancy: Number(fields.get("maxOccupancy")),
    });
    if (saved) unitTypeForm.elements.code.value = unitTypeForm.elements.name.value = "";
  });
  spaceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(spaceForm);
    const floor = String(fields.get("floor") || "");
    const body = {
      code: fields.get("code"), profileKey: "hotel", capacity: Number(fields.get("capacity")),
      ...(floor ? { floor } : {}),
    };
    const saved = await submitInventory(spaceForm, "spaces", body);
    if (saved) spaceForm.elements.code.value = spaceForm.elements.floor.value = "";
  });
  sellableForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(sellableForm);
    const saved = await submitInventory(sellableForm, "sellable-units", {
      unitTypeId: fields.get("unitTypeId"), name: fields.get("name"),
      spaces: [{ spaceId: fields.get("spaceId"), claimMode: "exclusive" }],
    });
    if (saved) sellableForm.elements.name.value = "";
  });
  restrictionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(restrictionForm);
    const kind = String(fields.get("kind"));
    const valued = ["min_los", "max_los", "min_adv", "max_adv"].includes(kind);
    const unitTypeId = String(fields.get("unitTypeId") || "");
    const channelCode = String(fields.get("channelCode") || "");
    const restriction = {
      kind, stayStart: fields.get("stayStart"), stayEnd: fields.get("stayEnd"),
      ...(valued ? { value: Number(fields.get("value")) } : {}),
      ...(unitTypeId ? { unitTypeId } : {}),
      ...(channelCode ? { channelCode } : {}),
    };
    const saved = await submitRestriction({ restrictions: [restriction] });
    if (saved) restrictionForm.elements.channelCode.value = "";
  });
  operationalBlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(operationalBlockForm);
    const body = {
      spaceId: fields.get("spaceId"), kind: fields.get("kind"),
      from: new Date(String(fields.get("from"))).toISOString(),
      to: new Date(String(fields.get("to"))).toISOString(), reason: fields.get("reason"),
    };
    const identity = `operational-block-open:${JSON.stringify(body)}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    const button = operationalBlockForm.querySelector("button[type=submit]");
    button.disabled = true;
    formMessage(operationalBlockForm, "Opening an audited operational cause…");
    try {
      await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/operational-blocks`, {
        method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify(body),
      });
      pendingKeys.delete(identity);
      operationalBlockForm.elements.reason.value = "";
      formMessage(operationalBlockForm, "Cause opened with exact audit and event evidence.");
      await loadOperationalBlocks();
    } catch (error) {
      formMessage(operationalBlockForm, error instanceof Error ? error.message : "Cause could not be opened", true);
    } finally {
      button.disabled = false;
    }
  });
  oosPolicyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = { oosSellability: oosSellability.value };
    const identity = `oos-policy:${propertySelect.value}:${JSON.stringify(body)}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    const button = oosPolicyForm.querySelector("button[type=submit]");
    button.disabled = true;
    formMessage(oosPolicyForm, "Saving audited hotel policy…");
    try {
      const result = await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/inventory-policy/oos-sellability`, {
        method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify(body),
      });
      pendingKeys.delete(identity);
      inventoryPolicyData = result.inventoryPolicy;
      oosSellability.value = inventoryPolicyData.oosSellability;
      formMessage(oosPolicyForm, `Saved: OOS is ${inventoryPolicyData.oosSellability === "allowed" ? "allowed with warning" : "blocked from sale"}. OOO physical removal is unchanged.`);
    } catch (error) {
      formMessage(oosPolicyForm, error instanceof Error ? error.message : "OOS policy could not be saved", true);
    } finally {
      button.disabled = false;
    }
  });
  policyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(policyForm);
    const kind = String(fields.get("kind"));
    let content;
    if (kind === "cancellation") {
      content = { kind, rules: [{
        before_hours: Number(fields.get("beforeHours")),
        penalty: { basis: fields.get("cancellationBasis"), value: Number(fields.get("cancellationValue")) },
      }] };
    } else if (kind === "deposit") {
      const basis = String(fields.get("depositBasis"));
      const due = String(fields.get("depositDue"));
      content = { kind, deposit: {
        basis,
        ...(basis === "percent" ? { value: Number(fields.get("depositValue")) } : {}),
        due,
        ...(due === "days_before_arrival" ? { days_before: Number(fields.get("depositDays")) } : {}),
      } };
    } else if (kind === "guarantee") {
      content = { kind, guarantee: fields.get("guarantee") };
    } else {
      const basis = String(fields.get("noShowBasis"));
      content = { kind, no_show_charge: { basis, ...(basis === "first_night" ? { value: 1 } : {}) } };
    }
    const saved = await submitRate(policyForm, "policies", { kind, name: fields.get("name"), content });
    if (saved) policyForm.elements.name.value = "";
  });
  ratePlanForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(ratePlanForm);
    const cancellationPolicyId = String(fields.get("cancellationPolicyId") || "");
    const guaranteePolicyId = String(fields.get("guaranteePolicyId") || "");
    const depositPolicyId = String(fields.get("depositPolicyId") || "");
    const marketCode = String(fields.get("marketCode") || "");
    const sourceCode = String(fields.get("sourceCode") || "");
    const body = {
      code: fields.get("code"), name: fields.get("name"), currency: fields.get("currency"),
      taxInclusive: ratePlanForm.elements.taxInclusive.checked,
      ...(cancellationPolicyId ? { cancellationPolicyId } : {}),
      ...(guaranteePolicyId ? { guaranteePolicyId } : {}),
      ...(depositPolicyId ? { depositPolicyId } : {}),
      ...(marketCode ? { marketCode } : {}),
      ...(sourceCode ? { sourceCode } : {}),
    };
    const saved = await submitRate(ratePlanForm, "rate-plans", body);
    if (saved) {
      ratePlanForm.elements.code.value = ratePlanForm.elements.name.value = "";
      ratePlanForm.elements.marketCode.value = ratePlanForm.elements.sourceCode.value = "";
    }
  });
  ratePriceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const fields = new FormData(ratePriceForm);
      const dowMask = fields.getAll("weekday").reduce((mask, value) => mask + Number(value), 0);
      await submitPrice({
        ratePlanId: fields.get("ratePlanId"), unitTypeId: fields.get("unitTypeId"),
        stayStart: fields.get("stayStart"), stayEnd: fields.get("stayEnd"), dowMask,
        pricing: readPricingEditor(createTierList, createExtraAdult, createChildList),
      });
    } catch (error) {
      formMessage(ratePriceForm, error instanceof Error ? error.message : "Price input is invalid", true);
    }
  });
  currentPriceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = currentPriceForm.querySelector("button[type=submit]");
    button.disabled = true;
    formMessage(currentPriceForm, "Reading current PostgreSQL truth…");
    try {
      const fields = new FormData(currentPriceForm);
      const query = new URLSearchParams({
        ratePlanId: String(fields.get("ratePlanId")), unitTypeId: String(fields.get("unitTypeId")), stayDate: String(fields.get("stayDate")),
      });
      const body = await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/rate-prices/current?${query}`);
      renderCurrentPrice(body.ratePrice);
      formMessage(currentPriceForm, "Current applicable row returned.");
    } catch (error) {
      currentRatePrice = null;
      loadPriceCorrectionButton.hidden = true;
      rateCorrectionForm.hidden = true;
      currentPriceResult.textContent = "No current price returned.";
      formMessage(currentPriceForm, error instanceof Error ? error.message : "Current price lookup failed", true);
    } finally {
      button.disabled = false;
    }
  });
  rateCorrectionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = rateCorrectionForm.querySelector("button[type=submit]");
    if (!currentRatePrice) {
      formMessage(rateCorrectionForm, "Load a current price before creating a correction", true);
      return;
    }
    try {
      const pricing = readPricingEditor(correctionTierList, correctionExtraAdult, correctionChildList);
      const identity = `rate-price-correction:${currentRatePrice.id}:${JSON.stringify({ pricing })}`;
      const key = pendingKeys.get(identity) || crypto.randomUUID();
      pendingKeys.set(identity, key);
      button.disabled = true;
      formMessage(rateCorrectionForm, "Creating an immutable audited successor…");
      const body = await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/rate-prices/${encodeURIComponent(currentRatePrice.id)}/supersede`, {
        method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify({ pricing }),
      });
      pendingKeys.delete(identity);
      renderCurrentPrice(body.ratePrice);
      loadPriceCorrection(body.ratePrice);
      formMessage(rateCorrectionForm, "Corrected successor created. The prior price remains immutable history.");
    } catch (error) {
      formMessage(rateCorrectionForm, error instanceof Error ? error.message : "Price correction failed", true);
    } finally {
      button.disabled = false;
    }
  });
  themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
  signOutButton.addEventListener("click", showLogin);
  applyTheme(themeSelect.value);
  initializeDates();
  addTier(createTierList, 1, "");
  addTier(createTierList, 2, "");
  updateRestrictionFields();
  updatePolicyFields();
  const initialView = location.pathname.endsWith("/inventory") ? "inventory" :
    location.pathname.endsWith("/operations") ? "operations" :
    location.pathname.endsWith("/restrictions") ? "restrictions" :
    location.pathname.endsWith("/rates") ? "rates" : "availability";
  setView(initialView, false);
})();
