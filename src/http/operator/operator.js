(() => {
  "use strict";

  let accessToken = "";
  let operator = null;
  let activeView = "availability";
  let inventoryData = { unitTypes: [], spaces: [], sellableUnits: [] };
  let propertiesData = [];
  let restrictionsData = [];
  let rateData = { policies: [], ratePlans: [] };
  let rateBuilderData = { catalogue: [], modelDrafts: [], targetDrafts: [], releases: [] };
  let builderStep = 1;
  let builderReleaseId = "";
  let builderPreviewCells = [];
  let builderSimulation = null;
  let builderSimulationReleaseId = "";
  let rateApprovalData = [];
  let rateApprovalNextCursor = null;
  let selectedRateApprovalId = "";
  let builderSelectedModel = "simple-fixed";
  let builderBookingInstant = "";
  let builderAiInterpretation = null;
  let builderAiAppliedProposal = null;
  let builderTargetRuleSequence = 0;
  let operationalBlocksData = [];
  let inventoryPolicyData = { oosSellability: "blocked" };
  let activeHoldsData = [];
  let offlineLeasesData = [];
  let currentRatePrice = null;
  let pricingRowSequence = 0;
  let bulkRoomDraft = [];
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
  const statusView = document.querySelector("#status-view");
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
  const bulkRoomForm = document.querySelector("#bulk-room-form");
  const bulkRoomUnitType = document.querySelector("#bulk-room-unit-type");
  const bulkRoomMode = document.querySelector("#bulk-room-mode");
  const bulkRoomRangeFields = document.querySelector("#bulk-room-range-fields");
  const bulkRoomPasteFields = document.querySelector("#bulk-room-paste-fields");
  const bulkRoomPreview = document.querySelector("#bulk-room-preview");
  const bulkRoomCount = document.querySelector("#bulk-room-count");
  const bulkRoomRefreshPreview = document.querySelector("#bulk-room-refresh-preview");
  const projectionForm = document.querySelector("#projection-rebuild-form");
  const projectionSummary = document.querySelector("#projection-summary");
  const refreshProjection = document.querySelector("#refresh-projection");
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
  const builderPlan = document.querySelector("#builder-plan");
  const builderModeSelect = document.querySelector("#builder-mode-select");
  const builderModeRadios = document.querySelectorAll('input[name="builder-mode"]');
  const builderAiPanel = document.querySelector("#builder-ai-panel");
  const builderAiIntent = document.querySelector("#builder-ai-intent");
  const builderAiInterpret = document.querySelector("#builder-ai-interpret");
  const builderAiApply = document.querySelector("#builder-ai-apply");
  const builderAiStatus = document.querySelector("#builder-ai-status");
  const builderAiResults = document.querySelector("#builder-ai-results");
  const builderAiAdapter = document.querySelector("#builder-ai-adapter");
  const builderAiChanges = document.querySelector("#builder-ai-changes");
  const builderAiAssumptions = document.querySelector("#builder-ai-assumptions");
  const builderAiQuestions = document.querySelector("#builder-ai-questions");
  const builderAiWarnings = document.querySelector("#builder-ai-warnings");
  const builderAiGuardrails = document.querySelector("#builder-ai-guardrails");
  const builderSteps = document.querySelectorAll(".builder-step");
  const builderPanels = document.querySelectorAll("[data-builder-panel]");
  const builderModelCatalogue = document.querySelector("#builder-model-catalogue");
  const builderBaseAmount = document.querySelector("#builder-base-amount");
  const builderFloor = document.querySelector("#builder-floor");
  const builderCeiling = document.querySelector("#builder-ceiling");
  const builderCalendarFields = document.querySelector("#builder-calendar-fields");
  const builderCalendarCells = document.querySelector("#builder-calendar-cells");
  const builderReferenceFields = document.querySelector("#builder-reference-fields");
  const builderReferenceId = document.querySelector("#builder-reference-id");
  const builderReferenceVersion = document.querySelector("#builder-reference-version");
  const builderRuleFields = document.querySelector("#builder-rule-fields");
  const builderAdjustmentKind = document.querySelector("#builder-adjustment-kind");
  const builderAdjustmentValue = document.querySelector("#builder-adjustment-value");
  const builderRuleStage = document.querySelector("#builder-rule-stage");
  const builderRulePriority = document.querySelector("#builder-rule-priority");
  const builderBarLevel = document.querySelector("#builder-bar-level");
  const builderBookingWindow = document.querySelector("#builder-booking-window");
  const builderLos = document.querySelector("#builder-los");
  const builderOccupancy = document.querySelector("#builder-occupancy");
  const builderRmsFields = document.querySelector("#builder-rms-fields");
  const builderRmsKey = document.querySelector("#builder-rms-key");
  const builderRmsVersion = document.querySelector("#builder-rms-version");
  const builderRmsAge = document.querySelector("#builder-rms-age");
  const builderExpertComponents = document.querySelector("#builder-expert-components");
  const builderComponentGrid = document.querySelector("#builder-component-grid");
  const builderTargetRuleList = document.querySelector("#builder-target-rule-list");
  const builderTargetRuleCount = document.querySelector("#builder-target-rule-count");
  const builderAddTargetRule = document.querySelector("#builder-add-target-rule");
  const builderStayStart = document.querySelector("#builder-stay-start");
  const builderStayEnd = document.querySelector("#builder-stay-end");
  const builderMinAdults = document.querySelector("#builder-min-adults");
  const builderMaxAdults = document.querySelector("#builder-max-adults");
  const builderMaxChildren = document.querySelector("#builder-max-children");
  const builderCancellationPolicy = document.querySelector("#builder-cancellation-policy");
  const builderDepositPolicy = document.querySelector("#builder-deposit-policy");
  const builderGuaranteePolicy = document.querySelector("#builder-guarantee-policy");
  const builderNoShowPolicy = document.querySelector("#builder-no-show-policy");
  const builderRefundTreatment = document.querySelector("#builder-refund-treatment");
  const builderPackageCode = document.querySelector("#builder-package-code");
  const builderPackageAmount = document.querySelector("#builder-package-amount");
  const builderPackageRhythm = document.querySelector("#builder-package-rhythm");
  const builderPromotionCode = document.querySelector("#builder-promotion-code");
  const builderPromotionBps = document.querySelector("#builder-promotion-bps");
  const builderDistributionMode = document.querySelector("#builder-distribution-mode");
  const builderDistributionChannels = document.querySelector("#builder-distribution-channels");
  const builderExpertJsonGroup = document.querySelector("#builder-expert-json-group");
  const builderExpertJson = document.querySelector("#builder-expert-json");
  const builderRefreshJson = document.querySelector("#builder-refresh-json");
  const builderCommandPreview = document.querySelector("#builder-command-preview");
  const builderSaveDraft = document.querySelector("#builder-save-draft");
  const builderPreviewDates = document.querySelector("#builder-preview-dates");
  const builderRunPreview = document.querySelector("#builder-run-preview");
  const builderRequestApproval = document.querySelector("#builder-request-approval");
  const builderApprovalInbox = document.querySelector("#builder-approval-inbox");
  const builderRefreshApprovals = document.querySelector("#builder-refresh-approvals");
  const builderLoadMoreApprovals = document.querySelector("#builder-load-more-approvals");
  const builderSelectedApproval = document.querySelector("#builder-selected-approval");
  const builderPublish = document.querySelector("#builder-publish");
  const builderSimulationOutput = document.querySelector("#builder-simulation");
  const builderSimulationCells = document.querySelector("#builder-simulation-cells");
  const builderRefreshHistory = document.querySelector("#builder-refresh-history");
  const builderReleaseHistory = document.querySelector("#builder-release-history");
  const builderQuoteSellable = document.querySelector("#builder-quote-sellable");
  const builderQuoteStart = document.querySelector("#builder-quote-start");
  const builderQuoteEnd = document.querySelector("#builder-quote-end");
  const builderLiveQuote = document.querySelector("#builder-live-quote");
  const builderQuoteResult = document.querySelector("#builder-quote-result");
  const builderMessage = document.querySelector("#builder-message");
  const builderPrevious = document.querySelector("#builder-previous");
  const builderNext = document.querySelector("#builder-next");
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
  const offlineLeaseForm = document.querySelector("#offline-lease-form");
  const offlineLeaseSellable = document.querySelector("#offline-lease-sellable");
  const offlineLeaseList = document.querySelector("#offline-lease-list");
  const offlineLeaseStatus = document.querySelector("#offline-lease-status");
  const refreshOfflineLeases = document.querySelector("#refresh-offline-leases");
  const refreshStatus = document.querySelector("#refresh-status");
  const roadmapProgress = document.querySelector("#roadmap-progress");
  const reviewProgress = document.querySelector("#review-progress");
  const statusOrder = document.querySelector("#status-order");
  const statusDebt = document.querySelector("#status-debt");
  const statusReferee = document.querySelector("#status-referee");
  const statusRecordedAt = document.querySelector("#status-recorded-at");
  const statusRoadmapCopy = document.querySelector("#status-roadmap-copy");
  const statusReviewCopy = document.querySelector("#status-review-copy");
  const statusPhaseList = document.querySelector("#status-phase-list");
  const statusHealthGrid = document.querySelector("#status-health-grid");
  const statusMessage = document.querySelector("#status-message");
  const SYSTEM_STATUS_SUFFIX = "/system-status";
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
    builderStayStart.value = localInputValue(from).slice(0, 10);
    builderStayEnd.value = localInputValue(to).slice(0, 10);
    builderPreviewDates.value = localInputValue(from).slice(0, 10);
    builderQuoteStart.value = localInputValue(from);
    builderQuoteEnd.value = localInputValue(to);
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
    propertiesData = [];
    restrictionsData = [];
    rateData = { policies: [], ratePlans: [] };
    rateBuilderData = { catalogue: [], modelDrafts: [], targetDrafts: [], releases: [] };
    builderStep = 1;
    builderReleaseId = "";
    builderPreviewCells = [];
    builderSimulation = null;
    builderSimulationReleaseId = "";
    rateApprovalData = [];
    rateApprovalNextCursor = null;
    selectedRateApprovalId = "";
    builderBookingInstant = "";
    builderAiInterpretation = null;
    builderAiAppliedProposal = null;
    operationalBlocksData = [];
    inventoryPolicyData = { oosSellability: "blocked" };
    activeHoldsData = [];
    offlineLeasesData = [];
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
    propertiesData = body.properties;
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
      const pathProperty = location.pathname.match(/^\/p\/([0-9a-f-]+)\/(?:availability|inventory|operations|restrictions|rates|status)$/)?.[1];
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
    populateSelect(bulkRoomUnitType, inventoryData.unitTypes.filter(({ profileKey }) => profileKey === "hotel"),
      "hotel room type", (item) => `${item.code} · ${item.name}`);
    updateBulkRoomPreview();
    populatePricingSelects();
  }

  function updateBulkRoomPreview() {
    const fields = new FormData(bulkRoomForm);
    const mode = String(fields.get("mode"));
    bulkRoomRangeFields.hidden = mode !== "range";
    bulkRoomPasteFields.hidden = mode !== "paste";
    const floor = String(fields.get("floor") || "");
    let codes = [];
    let problem = "";

    if (floor !== floor.trim() || floor.length > 64) {
      problem = "Floor must be a trimmed value of at most 64 characters.";
    } else if (mode === "range") {
      const prefix = String(fields.get("prefix") || "");
      const start = Number(fields.get("start"));
      const end = Number(fields.get("end"));
      const pad = Number(fields.get("pad"));
      if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(pad) ||
          start < 0 || end < start || end > 999999 || pad < 1 || pad > 6) {
        problem = "Use a valid ascending range and a zero-pad width from 1 to 6.";
      } else if (end - start + 1 > 200) {
        problem = "A single batch can contain at most 200 rooms.";
      } else {
        codes = Array.from({ length: end - start + 1 }, (_, index) =>
          `${prefix}${String(start + index).padStart(pad, "0")}`
        );
      }
    } else {
      codes = String(fields.get("codes") || "").split(/[\s,]+/u).filter(Boolean);
      if (codes.length > 200) problem = "A single batch can contain at most 200 rooms.";
    }

    const stableCode = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
    if (!problem && (codes.length < 1 || codes.some((code) => !stableCode.test(code)))) {
      problem = "Enter 1–200 room codes using letters, numbers, dots, underscores or hyphens.";
    }
    if (!problem && new Set(codes).size !== codes.length) problem = "Every room code must be unique in the preview.";

    bulkRoomDraft = problem ? [] : codes.map((code) => ({ code, ...(floor ? { floor } : {}) }));
    bulkRoomCount.textContent = String(bulkRoomDraft.length);
    bulkRoomPreview.classList.toggle("is-error", Boolean(problem));
    bulkRoomPreview.classList.toggle("is-valid", !problem && bulkRoomDraft.length > 0);
    bulkRoomPreview.textContent = problem || (bulkRoomDraft.length > 0
      ? `${bulkRoomDraft.length} explicit room${bulkRoomDraft.length === 1 ? "" : "s"}: ${codes.join(", ")}`
      : "Enter a valid range or pasted list to preview the exact rooms.");
    bulkRoomForm.querySelector("button[type=submit]").disabled =
      bulkRoomDraft.length < 1 || !bulkRoomUnitType.value;
  }

  async function loadInventory() {
    const property = propertySelect.value;
    if (!property) return;
    inventoryStatus.textContent = "Loading live inventory…";
    try {
      inventoryData = await request(`/api/v1/properties/${encodeURIComponent(property)}/inventory`);
      renderInventory();
      inventoryStatus.textContent = "Inventory is current from tenant-scoped PostgreSQL.";
      await loadProjectionStatus();
    } catch (error) {
      inventoryStatus.textContent = error instanceof Error ? error.message : "Inventory could not be loaded";
    }
  }

  function renderProjectionStatus(status) {
    projectionSummary.textContent = status.fromDate
      ? `${status.fromDate} → ${status.toDate} (end not included) · ${status.rows} rows · ${status.unitTypes} room types · updated ${new Date(status.updatedAt).toLocaleString()}`
      : "No projection horizon exists yet. Choose exact dates below when this hotel is ready.";
  }

  async function loadProjectionStatus() {
    const property = propertySelect.value;
    if (!property) return;
    projectionSummary.textContent = "Loading projection status…";
    try {
      renderProjectionStatus(await request(`/api/v1/properties/${encodeURIComponent(property)}/availability-projection`));
    } catch (error) {
      projectionSummary.textContent = error instanceof Error ? error.message : "Projection status could not be loaded";
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

  function setBuilderMessage(message, isError = false) {
    builderMessage.textContent = message;
    builderMessage.classList.toggle("error", isError);
  }

  function integerValue(input, fallback = 0) {
    const value = Number(input.value);
    return Number.isSafeInteger(value) ? value : fallback;
  }

  function trimmed(input) {
    return input.value.trim();
  }

  function selectedBuilderMode() {
    return ["guided", "expert", "ai"].includes(builderModeSelect.value) ? builderModeSelect.value : "guided";
  }

  function renderBuilderAiList(list, values, emptyMessage) {
    list.replaceChildren();
    const items = Array.isArray(values) ? values : [];
    if (items.length === 0) {
      const empty = document.createElement("li");
      empty.className = "ai-empty";
      empty.textContent = emptyMessage;
      list.append(empty);
      return;
    }
    for (const value of items) {
      const item = document.createElement("li");
      item.textContent = String(value);
      list.append(item);
    }
  }

  function resetBuilderAiProposal(message = "No intent has been interpreted. Nothing is saved automatically.") {
    builderAiInterpretation = null;
    builderAiAppliedProposal = null;
    builderAiApply.disabled = true;
    builderAiResults.hidden = true;
    builderAiStatus.textContent = message;
    builderAiStatus.classList.remove("error");
    builderAiAdapter.textContent = "Local · deterministic";
  }

  function renderBuilderAiInterpretation(interpretation) {
    builderAiInterpretation = interpretation;
    builderAiAppliedProposal = null;
    const rejected = interpretation.status === "rejected";
    const ready = interpretation.status === "ready" && interpretation.proposal;
    builderAiAdapter.textContent = `${interpretation.adapter.external ? "External" : "Local"} · ${interpretation.adapter.key}`;
    renderBuilderAiList(builderAiChanges, interpretation.changes, "No changes proposed.");
    renderBuilderAiList(builderAiAssumptions, interpretation.assumptions, "No assumptions made.");
    renderBuilderAiList(builderAiQuestions, interpretation.questions, "No questions remain.");
    renderBuilderAiList(
      builderAiWarnings,
      rejected ? interpretation.rejections : interpretation.warnings,
      rejected ? "The request was rejected without changing state." : "No additional warnings.",
    );
    renderBuilderAiList(builderAiGuardrails, interpretation.guardrails, "Server guardrails remain active.");
    builderAiResults.hidden = false;
    builderAiApply.disabled = !ready;
    builderAiStatus.classList.toggle("error", rejected);
    builderAiStatus.textContent = ready
      ? "Proposal ready. Review the details, then apply it deliberately. Nothing has been saved."
      : rejected
        ? "This request conflicts with Yellow's safety boundary and was rejected. Nothing has been saved."
        : "More exact information is required. Answer the questions and interpret again.";
  }

  async function interpretBuilderIntent() {
    if (!builderPlan.value) {
      builderAiStatus.textContent = "Choose a base rate plan before interpreting intent.";
      builderAiStatus.classList.add("error");
      return;
    }
    const intent = builderAiIntent.value.trim();
    if (!intent) {
      builderAiStatus.textContent = "Describe the rate-plan intent first.";
      builderAiStatus.classList.add("error");
      return;
    }
    try {
      builderAiInterpret.disabled = true;
      builderAiApply.disabled = true;
      builderAiStatus.classList.remove("error");
      builderAiStatus.textContent = "Interpreting against the current typed choices…";
      const currentCommand = buildGuidedCommand();
      const body = await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/rate-builder/${encodeURIComponent(builderPlan.value)}/intents:interpret`, {
        method: "POST",
        body: JSON.stringify({ intent, currentCommand }),
      });
      renderBuilderAiInterpretation(body.interpretation);
    } catch (error) {
      resetBuilderAiProposal(error instanceof Error ? error.message : "The rate intent could not be interpreted.");
      builderAiStatus.classList.add("error");
    } finally {
      builderAiInterpret.disabled = false;
    }
  }

  function applyBuilderAiProposal() {
    if (!builderAiInterpretation?.proposal || builderAiInterpretation.status !== "ready") {
      builderAiStatus.textContent = "Interpret a complete, safe proposal before applying it.";
      builderAiStatus.classList.add("error");
      return;
    }
    builderAiAppliedProposal = structuredClone(builderAiInterpretation.proposal);
    builderAiApply.disabled = true;
    builderAiStatus.classList.remove("error");
    builderAiStatus.textContent = "Applied for review only. Nothing is saved; Save draft, Preview, Approval and Publish remain separate.";
    setBuilderStep(5);
    setBuilderMessage("AI proposal applied to the review step. Nothing has been saved.");
  }

  function setBuilderMode(mode, refreshExpert = true) {
    const normalized = ["guided", "expert", "ai"].includes(mode) ? mode : "guided";
    builderModeSelect.value = normalized;
    for (const radio of builderModeRadios) radio.checked = radio.value === normalized;
    builderExpertJsonGroup.hidden = normalized !== "expert";
    builderAiPanel.hidden = normalized !== "ai";
    if (normalized === "expert" && refreshExpert && builderPlan.value) refreshExpertJson();
    renderBuilderCommand();
  }

  function setBuilderStep(step) {
    builderStep = Math.max(1, Math.min(5, step));
    for (const panel of builderPanels) panel.hidden = Number(panel.dataset.builderPanel) !== builderStep;
    for (const button of builderSteps) {
      const selected = Number(button.dataset.builderStep) === builderStep;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-current", selected ? "step" : "false");
    }
    builderPrevious.disabled = builderStep === 1;
    builderNext.hidden = builderStep === 5;
    if (builderStep === 5) renderBuilderCommand();
  }

  function renderModelCatalogue() {
    builderModelCatalogue.replaceChildren();
    builderComponentGrid.replaceChildren();
    for (const entry of rateBuilderData.catalogue) {
      const label = document.createElement("label");
      label.className = "model-choice";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "builder-model";
      radio.value = entry.key;
      radio.checked = entry.key === builderSelectedModel;
      const copy = document.createElement("span");
      copy.className = "model-choice-copy";
      const title = document.createElement("strong");
      title.textContent = entry.label;
      const description = document.createElement("small");
      description.textContent = entry.description;
      const capabilities = document.createElement("em");
      capabilities.textContent = entry.capabilities.join(" · ").replaceAll("-", " ");
      copy.append(title, description, capabilities);
      label.append(radio, copy);
      builderModelCatalogue.append(label);

      if (entry.key !== "expert-composition") {
        const component = document.createElement("label");
        const check = document.createElement("input");
        check.type = "checkbox";
        check.name = "builder-component";
        check.value = entry.key;
        check.checked = entry.key === "simple-fixed";
        component.append(check, document.createTextNode(entry.label));
        builderComponentGrid.append(component);
      }
    }
    if (rateBuilderData.catalogue.length === 0) {
      emptyList(builderModelCatalogue, "Choose a base rate plan to load the governed model catalogue.");
      return;
    }
    if (!rateBuilderData.catalogue.some(({ key }) => key === builderSelectedModel)) {
      builderSelectedModel = rateBuilderData.catalogue[0].key;
      builderModelCatalogue.querySelector('input[name="builder-model"]')?.click();
    }
    updateBuilderModelFields();
  }

  function updateBuilderModelFields() {
    const model = builderSelectedModel;
    builderCalendarFields.hidden = model !== "calendar";
    builderReferenceFields.hidden = model !== "bar-ladder" && model !== "derived";
    builderRuleFields.hidden = !["bar-ladder", "derived", "room-matrix", "occupancy-los", "contract-negotiated", "expert-composition"].includes(model);
    builderRmsFields.hidden = model !== "rms-api-managed";
    builderExpertComponents.hidden = model !== "expert-composition";
    if (model === "rms-api-managed") {
      if (!trimmed(builderFloor)) builderFloor.value = "10000";
      if (!trimmed(builderCeiling)) builderCeiling.value = "50000";
    }
    if (model === "package") {
      if (!trimmed(builderPackageCode)) builderPackageCode.value = "BREAKFAST";
      if (!trimmed(builderPackageAmount)) builderPackageAmount.value = "1500";
    }
    renderBuilderCommand();
  }

  function replaceSelectPreserving(select, items, label, formatter) {
    const current = select.value;
    populateSelect(select, items, label, formatter);
    if ([...select.options].some(({ value }) => value === current)) select.value = current;
  }

  function builderTargetCards() {
    return [...builderTargetRuleList.querySelectorAll(".target-rule-card")];
  }

  function targetField(card, name) {
    return card.querySelector(`[data-target-field="${name}"]`);
  }

  function targetInput(labelText, name, value = "", attributes = {}) {
    const label = document.createElement("label");
    label.append(document.createTextNode(labelText));
    const input = document.createElement("input");
    input.dataset.targetField = name;
    input.value = value;
    for (const [key, entry] of Object.entries(attributes)) input.setAttribute(key, String(entry));
    label.append(input);
    return label;
  }

  function targetSelect(labelText, name, options, value = "") {
    const label = document.createElement("label");
    label.append(document.createTextNode(labelText));
    const select = document.createElement("select");
    select.dataset.targetField = name;
    for (const [optionValue, optionLabel] of options) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionLabel;
      select.append(option);
    }
    select.value = value;
    label.append(select);
    return label;
  }

  function replaceTargetReferenceSelect(select, items, label, formatter) {
    const selected = new Set([...select.selectedOptions].map(({ value }) => value));
    select.replaceChildren();
    if (!select.multiple) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = `Choose ${label}`;
      select.append(placeholder);
    }
    for (const item of items) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = formatter(item);
      option.selected = selected.has(item.id);
      select.append(option);
    }
  }

  function populateBuilderTargetRuleSelects() {
    for (const card of builderTargetCards()) {
      replaceTargetReferenceSelect(targetField(card, "unitTypeIds"), inventoryData.unitTypes, "room types", (item) => `${item.code} · ${item.name}`);
      replaceTargetReferenceSelect(targetField(card, "unitTypeId"), inventoryData.unitTypes, "a room type", (item) => `${item.code} · ${item.name}`);
      replaceTargetReferenceSelect(targetField(card, "sellableUnitId"), inventoryData.sellableUnits, "a sellable room", (item) => `${item.unitTypeCode} · ${item.name}`);
    }
  }

  function updateBuilderTargetPhysicalFields(card) {
    const kind = targetField(card, "physicalKind").value;
    for (const field of card.querySelectorAll("[data-target-scope]")) {
      field.hidden = field.dataset.targetScope !== kind;
    }
  }

  function renderBuilderTargetRuleSummary(card) {
    const key = targetField(card, "key").value.trim() || "unnamed-rule";
    const effect = targetField(card, "effect").value;
    const physical = targetField(card, "physicalKind").value.replace("_", " ");
    const dimensions = [...card.querySelectorAll("[data-target-commercial]")]
      .filter((input) => input.value.trim()).length;
    card.querySelector("[data-target-summary-title]").textContent = key;
    card.querySelector("[data-target-summary-copy]").textContent = `${physical} · ${dimensions} commercial dimension${dimensions === 1 ? "" : "s"}`;
    const badge = card.querySelector("[data-target-summary-effect]");
    badge.textContent = effect;
    badge.dataset.effect = effect;
  }

  function renderBuilderTargetRules() {
    const cards = builderTargetCards();
    builderTargetRuleCount.textContent = `${cards.length} of 200`;
    builderAddTargetRule.disabled = cards.length >= 200;
    for (const card of cards) {
      renderBuilderTargetRuleSummary(card);
      card.querySelector('[data-target-action="remove"]').disabled = cards.length === 1;
    }
  }

  function createBuilderTargetRuleCard(initial = {}) {
    builderTargetRuleSequence += 1;
    const sequence = builderTargetRuleSequence;
    const physical = initial.physical || { kind: "property" };
    const commercial = initial.commercial || {};
    const details = document.createElement("details");
    details.className = "target-rule-card";
    details.open = builderTargetCards().length === 0;

    const summary = document.createElement("summary");
    const summaryCopy = document.createElement("span");
    const summaryTitle = document.createElement("strong");
    summaryTitle.dataset.targetSummaryTitle = "";
    const summaryDetail = document.createElement("small");
    summaryDetail.dataset.targetSummaryCopy = "";
    summaryCopy.append(summaryTitle, summaryDetail);
    const effectBadge = document.createElement("b");
    effectBadge.dataset.targetSummaryEffect = "";
    summary.append(summaryCopy, effectBadge);

    const body = document.createElement("div");
    body.className = "target-rule-body";
    const core = document.createElement("div");
    core.className = "builder-form-grid four-up target-rule-core";
    core.append(
      targetInput("Stable rule key", "key", initial.key || `property-rule-${sequence}`, { maxlength: 64, pattern: "[a-z0-9][a-z0-9._-]{0,63}" }),
      targetSelect("Effect", "effect", [["include", "Include"], ["exclude", "Exclude"]], initial.effect || "include"),
      targetInput("Priority", "priority", String(initial.priority ?? 0), { type: "number", min: 0, max: 1000 }),
      targetSelect("Physical scope", "physicalKind", [["property", "Whole property"], ["class", "Room class"], ["unit_type", "Room type"], ["sellable", "Exact sellable room"]], physical.kind || "property"),
    );

    const scope = document.createElement("div");
    scope.className = "builder-form-grid two-up target-scope-fields";
    const classCode = targetInput("Class code", "classCode", physical.kind === "class" ? physical.classCode || "" : "", { maxlength: 64, placeholder: "DELUXE" });
    classCode.dataset.targetScope = "class";
    const classMembership = document.createElement("label");
    classMembership.dataset.targetScope = "class";
    classMembership.append(document.createTextNode("Exact room-type membership"));
    const classSelect = document.createElement("select");
    classSelect.dataset.targetField = "unitTypeIds";
    classSelect.multiple = true;
    classSelect.size = 4;
    classMembership.append(classSelect);
    const unitType = targetSelect("Room type", "unitTypeId", [], physical.kind === "unit_type" ? physical.unitTypeId || "" : "");
    unitType.dataset.targetScope = "unit_type";
    const sellable = targetSelect("Sellable room", "sellableUnitId", [], physical.kind === "sellable" ? physical.sellableUnitId || "" : "");
    sellable.dataset.targetScope = "sellable";
    scope.append(classCode, classMembership, unitType, sellable);

    const commercialDetails = document.createElement("details");
    commercialDetails.className = "target-commercial-fields";
    const commercialSummary = document.createElement("summary");
    commercialSummary.textContent = "Commercial dimensions and exceptions";
    const commercialGrid = document.createElement("div");
    commercialGrid.className = "builder-form-grid three-up";
    const commercialFields = [
      ["Company party id", "companyPartyId", null, "UUID"],
      ["Market group", "marketGroupCode", "upper", "CORPORATE"],
      ["Market", "marketCode", "upper", "BUSINESS"],
      ["Source party id", "sourcePartyId", null, "UUID"],
      ["Source", "sourceCode", "upper", "DIRECT"],
      ["Channel", "channelCode", "lower", "booking-com"],
      ["Segment", "segmentCode", "upper", "TRANSIENT"],
      ["Agent party id", "agentPartyId", null, "UUID"],
      ["Campaign", "campaignCode", "upper", "SUMMER26"],
    ];
    for (const [label, name, transform, placeholder] of commercialFields) {
      const field = targetInput(label, name, commercial[name] || "", { maxlength: 64, placeholder });
      const input = targetField(field, name);
      input.dataset.targetCommercial = "";
      if (transform) input.dataset.targetTransform = transform;
      commercialGrid.append(field);
    }
    commercialDetails.append(commercialSummary, commercialGrid);

    const actions = document.createElement("div");
    actions.className = "target-rule-actions";
    const previewLabel = document.createElement("label");
    previewLabel.className = "preview-rule-choice";
    const previewRadio = document.createElement("input");
    previewRadio.type = "radio";
    previewRadio.name = "builder-preview-target";
    previewRadio.checked = builderTargetCards().length === 0;
    previewLabel.append(previewRadio, document.createTextNode("Use this rule's context in server preview"));
    const duplicate = document.createElement("button");
    duplicate.type = "button";
    duplicate.className = "quiet compact";
    duplicate.dataset.targetAction = "duplicate";
    duplicate.textContent = "Duplicate";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "quiet compact destructive";
    remove.dataset.targetAction = "remove";
    remove.textContent = "Remove";
    actions.append(previewLabel, duplicate, remove);
    body.append(core, scope, commercialDetails, actions);
    details.append(summary, body);
    builderTargetRuleList.append(details);
    populateBuilderTargetRuleSelects();
    if (physical.kind === "class") {
      const selectedIds = new Set(physical.unitTypeIds || []);
      for (const option of classSelect.options) option.selected = selectedIds.has(option.value);
    }
    if (physical.kind === "unit_type") targetField(details, "unitTypeId").value = physical.unitTypeId || "";
    if (physical.kind === "sellable") targetField(details, "sellableUnitId").value = physical.sellableUnitId || "";
    updateBuilderTargetPhysicalFields(details);
    renderBuilderTargetRules();
    return details;
  }

  function readBuilderTargetPhysical(card) {
    const kind = targetField(card, "physicalKind").value;
    if (kind === "class") {
      const classCode = targetField(card, "classCode").value.trim().toUpperCase();
      const unitTypeIds = [...targetField(card, "unitTypeIds").selectedOptions].map(({ value }) => value).sort();
      if (!classCode || unitTypeIds.length === 0) throw new Error("Each class rule needs a code and at least one exact room type.");
      if (unitTypeIds.length > 100) throw new Error("One class snapshot can contain at most 100 room types.");
      return { kind, classCode, unitTypeIds };
    }
    if (kind === "unit_type") {
      const unitTypeId = targetField(card, "unitTypeId").value;
      if (!unitTypeId) throw new Error("Each room-type rule needs a room type.");
      return { kind, unitTypeId };
    }
    if (kind === "sellable") {
      const sellableUnitId = targetField(card, "sellableUnitId").value;
      if (!sellableUnitId) throw new Error("Each exact-room rule needs a sellable room.");
      return { kind, sellableUnitId };
    }
    return { kind: "property" };
  }

  function readBuilderTargetCommercial(card) {
    return Object.fromEntries([...card.querySelectorAll("[data-target-commercial]")].flatMap((input) => {
      let value = input.value.trim();
      if (!value) return [];
      if (input.dataset.targetTransform === "upper") value = value.toUpperCase();
      if (input.dataset.targetTransform === "lower") value = value.toLowerCase();
      return [[input.dataset.targetField, value]];
    }));
  }

  function readBuilderTargetRule(card) {
    const key = targetField(card, "key").value.trim();
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(key)) throw new Error("Every target rule needs a stable unique lowercase key.");
    const priority = integerValue(targetField(card, "priority"), -1);
    if (priority < 0 || priority > 1000) throw new Error("Every target priority must be an integer from 0 to 1000.");
    return {
      key,
      effect: targetField(card, "effect").value,
      priority,
      physical: readBuilderTargetPhysical(card),
      commercial: readBuilderTargetCommercial(card),
    };
  }

  function readBuilderTargetRules() {
    const rules = builderTargetCards().map(readBuilderTargetRule);
    if (rules.length < 1 || rules.length > 200) throw new Error("Applicability requires 1 to 200 explicit rules.");
    if (new Set(rules.map(({ key }) => key)).size !== rules.length) throw new Error("Target rule keys must be unique.");
    return rules;
  }

  function previewBuilderTargetRule() {
    const selected = builderTargetRuleList.querySelector('input[name="builder-preview-target"]:checked')?.closest(".target-rule-card");
    return readBuilderTargetRule(selected || builderTargetCards()[0]);
  }

  function populateBuilderSelects() {
    replaceSelectPreserving(builderPlan, rateData.ratePlans, "base rate plan", (plan) => `${plan.code} · ${plan.name} · ${plan.currency}`);
    populateBuilderTargetRuleSelects();
    replaceSelectPreserving(builderQuoteSellable, inventoryData.sellableUnits, "sellable unit", (item) => `${item.unitTypeCode} · ${item.name}`);
    populatePolicySelect(builderCancellationPolicy, "cancellation", "Cancellation");
    populatePolicySelect(builderDepositPolicy, "deposit", "Deposit");
    populatePolicySelect(builderGuaranteePolicy, "guarantee", "Guarantee");
    populatePolicySelect(builderNoShowPolicy, "no_show", "No-show");
  }

  function builderGate() {
    const gate = {};
    const dowMask = [...document.querySelectorAll('input[name="builder-weekday"]:checked')]
      .reduce((total, input) => total + Number(input.value), 0);
    if (dowMask < 1) throw new Error("Choose at least one day of week.");
    gate.dowMask = dowMask;
    if (builderStayStart.value || builderStayEnd.value) {
      if (!builderStayStart.value || !builderStayEnd.value || builderStayStart.value > builderStayEnd.value) {
        throw new Error("Stay date range must have an increasing first and last date.");
      }
      gate.stayStart = builderStayStart.value;
      gate.stayEnd = builderStayEnd.value;
    }
    if (trimmed(builderBookingWindow)) {
      const days = integerValue(builderBookingWindow, -1);
      gate.bookingWindow = { minDays: days, maxDays: days };
    }
    if (trimmed(builderLos)) {
      const nights = integerValue(builderLos, -1);
      gate.los = { minNights: nights, maxNights: nights };
    }
    if (trimmed(builderOccupancy)) {
      const basisPoints = integerValue(builderOccupancy, -1) * 100;
      gate.occupancy = { minBasisPoints: basisPoints, maxBasisPoints: basisPoints };
    }
    return gate;
  }

  function builderAdjustment() {
    const kind = builderAdjustmentKind.value;
    if (kind === "basis_points") return { kind, basisPoints: integerValue(builderAdjustmentValue) };
    return { kind, amountMinor: trimmed(builderAdjustmentValue) || "0" };
  }

  function calendarCells() {
    const cells = trimmed(builderCalendarCells).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const match = line.match(/^(\d{4}-\d{2}-\d{2})\s*=\s*(closed|-?(?:0|[1-9][0-9]*))$/i);
      if (!match) throw new Error(`Calendar line is invalid: ${line}`);
      return match[2].toLowerCase() === "closed"
        ? { stayDate: match[1], state: "closed" }
        : { stayDate: match[1], state: "open", amountMinor: match[2] };
    });
    if (cells.length === 0) throw new Error("Calendar pricing requires at least one date cell.");
    return cells;
  }

  function builderRule(modelKey, targetKey) {
    const when = {};
    if (modelKey === "bar-ladder") when.barLevel = trimmed(builderBarLevel) || "BAR1";
    if (modelKey === "occupancy-los") {
      if (trimmed(builderBookingWindow)) {
        const days = integerValue(builderBookingWindow, 0);
        when.bookingWindow = { minDays: days, maxDays: days };
      }
      if (trimmed(builderLos)) {
        const nights = integerValue(builderLos, 1);
        when.los = { minNights: nights, maxNights: nights };
      }
      if (trimmed(builderOccupancy)) {
        const basisPoints = integerValue(builderOccupancy, 0) * 100;
        when.occupancy = { minBasisPoints: basisPoints, maxBasisPoints: basisPoints };
      }
      if (Object.keys(when).length === 0) when.los = { minNights: 1, maxNights: 1 };
    }
    const targetBound = modelKey === "room-matrix" || modelKey === "contract-negotiated";
    return {
      key: `${modelKey}-rule-1`,
      stage: modelKey === "expert-composition" ? integerValue(builderRuleStage, 1) : 1,
      priority: integerValue(builderRulePriority, 10),
      when,
      adjustment: builderAdjustment(),
      ...(targetBound ? { targetRuleKey: targetKey } : {}),
    };
  }

  function buildGuidedCommand() {
    const plan = rateData.ratePlans.find(({ id }) => id === builderPlan.value);
    if (!plan) throw new Error("Choose a base rate plan first.");
    const targetRules = readBuilderTargetRules();
    const includedTargetKeys = targetRules.filter(({ effect }) => effect === "include").map(({ key }) => key);
    const primaryTargetKey = includedTargetKeys[0] || targetRules[0].key;
    const modelKey = builderSelectedModel;
    const evaluatorKey = modelKey === "package" ? "simple-fixed" : modelKey;
    const ruleModels = new Set(["bar-ladder", "derived", "room-matrix", "occupancy-los", "contract-negotiated", "expert-composition"]);
    let base = { kind: "fixed", amountMinor: trimmed(builderBaseAmount) || "0" };
    if (modelKey === "calendar") base = { kind: "calendar", cells: calendarCells() };
    if (modelKey === "bar-ladder" || modelKey === "derived") {
      const sourceId = trimmed(builderReferenceId);
      if (!sourceId) throw new Error(`${modelKey === "bar-ladder" ? "BAR" : "Derived"} pricing requires a published reference release id.`);
      base = { kind: "reference", sourceKind: modelKey === "bar-ladder" ? "bar" : "parent", sourceId, sourceVersion: integerValue(builderReferenceVersion, 1) };
    }
    const componentModelKeys = modelKey === "expert-composition"
      ? [...builderComponentGrid.querySelectorAll('input[name="builder-component"]:checked')].map(({ value }) => value)
      : [];
    if (modelKey === "expert-composition" && componentModelKeys.length === 0) {
      throw new Error("Expert composition needs at least one registered component model.");
    }
    const packageCode = trimmed(builderPackageCode).toUpperCase();
    const promotionCode = trimmed(builderPromotionCode).toUpperCase();
    const distributionMode = builderDistributionMode.value;
    const distributionChannels = distributionMode === "all" ? [] : trimmed(builderDistributionChannels)
      .split(/[\s,]+/).map((value) => value.trim().toLowerCase()).filter(Boolean);
    const policies = {
      cancellationPolicyId: builderCancellationPolicy.value || null,
      depositPolicyId: builderDepositPolicy.value || null,
      guaranteePolicyId: builderGuaranteePolicy.value || null,
      noShowPolicyId: builderNoShowPolicy.value || null,
      refundTreatment: builderRefundTreatment.value,
    };
    const maxAdults = integerValue(builderMaxAdults, 4);
    const maxChildren = integerValue(builderMaxChildren, 3);
    return {
      authoringMode: "guided",
      ratePlanId: plan.id,
      model: { key: modelKey, version: 1, componentModelKeys },
      target: { rules: targetRules },
      evaluator: {
        modelKey: evaluatorKey,
        currency: plan.currency,
        base,
        gate: builderGate(),
        rules: ruleModels.has(modelKey) ? [builderRule(modelKey, primaryTargetKey)] : [],
        floorMinor: trimmed(builderFloor) || null,
        ceilingMinor: trimmed(builderCeiling) || null,
        eligibleTargetRuleKeys: modelKey === "contract-negotiated" || modelKey === "expert-composition" ? includedTargetKeys : [],
      },
      composition: {
        currency: plan.currency,
        guestEligibility: {
          minAdults: integerValue(builderMinAdults, 1), maxAdults,
          minChildren: 0, maxChildren,
          minTotalGuests: integerValue(builderMinAdults, 1), maxTotalGuests: maxAdults + maxChildren,
        },
        package: packageCode ? {
          key: `package-${packageCode.toLowerCase()}`, version: 1, includedInRate: true,
          elements: [{ key: `element-${packageCode.toLowerCase()}`, kind: "meal", code: packageCode,
            rhythm: builderPackageRhythm.value, amountMinor: trimmed(builderPackageAmount) || "0", currency: plan.currency }],
        } : null,
        promotions: promotionCode ? [{
          code: promotionCode, version: 1, stage: 1, priority: 10, scope: "room_and_extras",
          discount: { kind: "basis_points", basisPoints: integerValue(builderPromotionBps, 0) },
        }] : [],
        policy: policies,
        distribution: { mode: distributionMode, channelCodes: [...new Set(distributionChannels)].sort() },
      },
      rmsBinding: modelKey === "rms-api-managed" ? {
        adapterKey: trimmed(builderRmsKey), adapterVersion: integerValue(builderRmsVersion, 1),
        maximumAgeSeconds: integerValue(builderRmsAge, 900), outageFallback: "local_evaluator",
      } : null,
    };
  }

  function refreshExpertJson() {
    try {
      builderExpertJson.value = JSON.stringify({ ...buildGuidedCommand(), authoringMode: "expert" }, null, 2);
      setBuilderMessage("Expert JSON refreshed from the visual choices.");
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : "Expert command could not be prepared", true);
    }
  }

  function builderCommand() {
    if (selectedBuilderMode() === "guided") return buildGuidedCommand();
    if (selectedBuilderMode() === "ai") {
      if (!builderAiAppliedProposal) throw new Error("Interpret and deliberately apply an AI proposal before saving a draft.");
      if (!builderPlan.value) throw new Error("Choose a base rate plan first.");
      return { ...builderAiAppliedProposal, authoringMode: "ai", ratePlanId: builderPlan.value };
    }
    let parsed;
    try { parsed = JSON.parse(builderExpertJson.value); } catch { throw new Error("Expert command must be valid JSON."); }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Expert command must be a JSON object.");
    if (!builderPlan.value) throw new Error("Choose a base rate plan first.");
    return { ...parsed, authoringMode: "expert", ratePlanId: builderPlan.value };
  }

  function renderBuilderCommand() {
    try {
      builderCommandPreview.textContent = JSON.stringify(builderCommand(), null, 2);
    } catch (error) {
      builderCommandPreview.textContent = error instanceof Error ? error.message : "Complete the rate choices to preview the command.";
    }
  }

  function builderReleaseCommand(release) {
    const command = release?.authoringCommand;
    if (!command || typeof command !== "object" || Array.isArray(command) ||
        command.ratePlanId !== builderPlan.value) {
      throw new Error("The server could not reconstruct this immutable release for reuse.");
    }
    return structuredClone(command);
  }

  function builderReleaseSummary(command) {
    const model = rateBuilderData.catalogue.find(({ key, version }) =>
      key === command.model?.key && version === command.model?.version
    );
    const ruleCount = Array.isArray(command.target?.rules) ? command.target.rules.length : 0;
    const policy = command.composition?.policy || {};
    const policyCount = [
      policy.cancellationPolicyId,
      policy.depositPolicyId,
      policy.guaranteePolicyId,
      policy.noShowPolicyId,
    ].filter(Boolean).length;
    return `${model?.label || command.model?.key || "Unknown model"} · ${ruleCount} applicability rule${ruleCount === 1 ? "" : "s"} · ${policyCount} linked polic${policyCount === 1 ? "y" : "ies"}`;
  }

  function loadBuilderReleaseAsStartingPoint(release) {
    try {
      const command = builderReleaseCommand(release);
      resetBuilderAiProposal("A saved release was copied for deliberate editing. Interpret AI intent again if needed.");
      setBuilderMode("expert", false);
      builderExpertJson.value = JSON.stringify(command, null, 2);
      builderExpertJsonGroup.open = true;
      setBuilderStep(4);
      renderBuilderCommand();
      builderExpertJson.focus();
      setBuilderMessage(`Version ${release.extensionVersion} copied into Expert mode as an unsaved starting point. No release was changed or saved.`);
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : "This release could not be reused.", true);
    }
  }

  function renderRateReleaseHistory() {
    if (rateBuilderData.releases.length === 0) {
      emptyList(builderReleaseHistory, "No immutable releases exist for this plan yet.");
      return;
    }
    const cards = rateBuilderData.releases.map((release) => {
      const card = document.createElement("article");
      card.className = "release-row release-item";
      const state = document.createElement("span");
      state.className = "release-state";
      state.textContent = release.status;
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `Version ${release.extensionVersion} · ${release.status}`;
      const detail = document.createElement("small");
      detail.textContent = `${release.contentHash.slice(0, 12)}${release.undoOfVersion ? ` · undo of v${release.undoOfVersion}` : ""}`;
      const command = builderReleaseCommand(release);
      const commandSummary = document.createElement("small");
      commandSummary.textContent = builderReleaseSummary(command);
      copy.append(title, detail, commandSummary);
      const actions = document.createElement("div");
      actions.className = "release-actions";
      if (release.status === "draft") {
        const use = document.createElement("button");
        use.type = "button";
        use.className = "quiet compact";
        use.textContent = release.id === builderReleaseId ? "Selected" : "Use draft";
        use.disabled = release.id === builderReleaseId;
        use.addEventListener("click", () => selectBuilderRelease(release.id));
        actions.append(use);
      }
      const reuse = document.createElement("button");
      reuse.type = "button";
      reuse.className = "quiet compact";
      reuse.textContent = "Use as starting point";
      reuse.addEventListener("click", () => loadBuilderReleaseAsStartingPoint(release));
      actions.append(reuse);
      if (release.status === "active" || release.status === "retired") {
        const undo = document.createElement("button");
        undo.type = "button";
        undo.className = "quiet compact";
        undo.textContent = "Create undo draft";
        undo.addEventListener("click", () => void createBuilderUndo(release.id, undo));
        actions.append(undo);
      }
      const inspection = document.createElement("details");
      inspection.className = "release-inspection";
      const inspectionTitle = document.createElement("summary");
      inspectionTitle.textContent = "Inspect exact version";
      const commandView = document.createElement("pre");
      commandView.className = "release-command";
      commandView.textContent = JSON.stringify(command, null, 2);
      inspection.append(inspectionTitle, commandView);
      card.append(state, copy, actions, inspection);
      return card;
    });
    builderReleaseHistory.replaceChildren(...cards);
  }

  function selectedRateApproval() {
    return rateApprovalData.find(({ id }) => id === selectedRateApprovalId) || null;
  }

  function syncBuilderPublishState() {
    const approval = selectedRateApproval();
    const ready = approval?.canPublish === true && approval.releaseId === builderReleaseId &&
      builderSimulationReleaseId === builderReleaseId && builderSimulation?.conflictCount === 0 &&
      builderPreviewCells.length > 0;
    builderPublish.disabled = !ready;
    builderSelectedApproval.textContent = approval
      ? `Version ${approval.releaseVersion} · ${approval.status} · ${approval.decidedBy?.displayName || "Awaiting decision"}`
      : "No approved request selected";
  }

  function renderRateApprovalInbox() {
    if (rateApprovalData.length === 0) {
      emptyList(builderApprovalInbox, "No approval requests exist for this rate plan yet.");
      builderLoadMoreApprovals.hidden = true;
      syncBuilderPublishState();
      return;
    }
    const rows = rateApprovalData.map((approval) => {
      const row = document.createElement("article");
      row.className = "approval-inbox-row";
      row.dataset.status = approval.status;
      const status = document.createElement("span");
      status.className = "approval-state";
      status.textContent = approval.status;
      const copy = document.createElement("div");
      copy.className = "approval-inbox-copy";
      const title = document.createElement("strong");
      title.textContent = `Version ${approval.releaseVersion}${approval.releaseIsLatest ? " · latest" : ""}`;
      const requested = document.createElement("small");
      requested.textContent = `Requested by ${approval.requestedBy.displayName} · ${new Date(approval.createdAt).toLocaleString()}`;
      copy.append(title, requested);
      if (approval.decidedBy) {
        const decided = document.createElement("small");
        decided.textContent = `${approval.status === "approved" ? "Approved" : "Rejected"} by ${approval.decidedBy.displayName}${approval.decidedAt ? ` · ${new Date(approval.decidedAt).toLocaleString()}` : ""}`;
        copy.append(decided);
      }
      const actions = document.createElement("div");
      actions.className = "approval-inbox-actions";
      if (approval.canDecide) {
        for (const [decision, label, className] of [
          ["approved", "Approve", "secondary compact"],
          ["rejected", "Reject", "quiet compact"],
        ]) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = className;
          button.textContent = label;
          button.addEventListener("click", () => void decideBuilderApproval(approval.id, decision, button));
          actions.append(button);
        }
      }
      if (approval.canPublish) {
        const select = document.createElement("button");
        select.type = "button";
        select.className = "secondary compact";
        select.textContent = approval.id === selectedRateApprovalId ? "Selected for publish" : "Use approved request";
        select.disabled = approval.id === selectedRateApprovalId;
        select.addEventListener("click", () => {
          if (builderReleaseId !== approval.releaseId) selectBuilderRelease(approval.releaseId);
          selectedRateApprovalId = approval.id;
          renderRateApprovalInbox();
          setBuilderMessage("Approved request selected. Run a fresh server preview before publishing.");
        });
        actions.append(select);
      }
      if (actions.childElementCount === 0) {
        const note = document.createElement("small");
        note.className = "approval-inbox-note";
        note.textContent = approval.status === "pending"
          ? "Waiting for a different authorized operator"
          : approval.releaseStatus === "draft" && !approval.releaseIsLatest
            ? "A newer immutable draft exists"
            : "Decision recorded";
        actions.append(note);
      }
      row.append(status, copy, actions);
      return row;
    });
    builderApprovalInbox.replaceChildren(...rows);
    builderLoadMoreApprovals.hidden = !rateApprovalNextCursor;
    syncBuilderPublishState();
  }

  async function loadRateApprovals(append = false) {
    const property = propertySelect.value;
    const plan = builderPlan.value;
    if (!property || !plan) {
      rateApprovalData = [];
      rateApprovalNextCursor = null;
      selectedRateApprovalId = "";
      emptyList(builderApprovalInbox, "Choose a base rate plan to load its approval history.");
      builderLoadMoreApprovals.hidden = true;
      syncBuilderPublishState();
      return;
    }
    builderRefreshApprovals.disabled = true;
    builderLoadMoreApprovals.disabled = true;
    try {
      const after = append && rateApprovalNextCursor ? `&after=${encodeURIComponent(rateApprovalNextCursor)}` : "";
      const body = await request(`/api/v1/properties/${encodeURIComponent(property)}/rate-builder/${encodeURIComponent(plan)}/approvals?limit=50${after}`);
      const incoming = Array.isArray(body.approvals) ? body.approvals : [];
      rateApprovalData = append
        ? [...rateApprovalData, ...incoming.filter(({ id }) => !rateApprovalData.some((approval) => approval.id === id))]
        : incoming;
      rateApprovalNextCursor = body.nextCursor || null;
      if (!rateApprovalData.some(({ id }) => id === selectedRateApprovalId)) selectedRateApprovalId = "";
      renderRateApprovalInbox();
    } finally {
      builderRefreshApprovals.disabled = false;
      builderLoadMoreApprovals.disabled = false;
    }
  }

  async function decideBuilderApproval(approvalId, decision, button) {
    const payload = { decision };
    const pending = builderWriteKey(`rate-builder-approval-${decision}`, { approvalId, ...payload });
    button.disabled = true;
    setBuilderMessage(`${decision === "approved" ? "Approving" : "Rejecting"} the exact immutable release…`);
    try {
      const body = await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/rate-builder/${encodeURIComponent(builderPlan.value)}/approvals/${encodeURIComponent(approvalId)}/decision`, {
        method: "POST", headers: { "idempotency-key": pending.key }, body: JSON.stringify(payload),
      });
      pendingKeys.delete(pending.identity);
      selectedRateApprovalId = body.approval.canPublish ? body.approval.id : "";
      await loadRateApprovals();
      setBuilderMessage(decision === "approved"
        ? "Approval recorded. Run a fresh server preview before publishing this exact version."
        : "Rejection recorded. This request cannot publish.");
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : "Approval decision failed", true);
      renderRateApprovalInbox();
    }
  }

  function selectBuilderRelease(releaseId) {
    builderReleaseId = releaseId;
    builderPreviewCells = [];
    builderSimulation = null;
    builderSimulationReleaseId = "";
    if (selectedRateApproval()?.releaseId !== releaseId) selectedRateApprovalId = "";
    builderRunPreview.disabled = !releaseId;
    builderRequestApproval.disabled = true;
    builderSimulationOutput.textContent = releaseId
      ? "Draft selected. Run a fresh server preview before requesting approval."
      : "No draft selected. Save a governed draft to begin the review workflow.";
    builderSimulationCells.replaceChildren();
    emptyList(builderSimulationCells, "Run a server preview to inspect each bounded date cell.");
    renderRateReleaseHistory();
    renderRateApprovalInbox();
  }

  async function loadRateBuilder() {
    const property = propertySelect.value;
    const plan = builderPlan.value;
    if (!property || !plan) {
      rateBuilderData = { catalogue: [], modelDrafts: [], targetDrafts: [], releases: [] };
      rateApprovalData = [];
      rateApprovalNextCursor = null;
      selectedRateApprovalId = "";
      renderModelCatalogue();
      renderRateReleaseHistory();
      await loadRateApprovals();
      setBuilderMessage("Choose a base rate plan to begin.");
      return;
    }
    setBuilderMessage("Loading the governed model catalogue and immutable release history…");
    try {
      rateBuilderData = await request(`/api/v1/properties/${encodeURIComponent(property)}/rate-builder/${encodeURIComponent(plan)}`);
      renderModelCatalogue();
      if (!rateBuilderData.releases.some(({ id }) => id === builderReleaseId)) {
        builderReleaseId = rateBuilderData.releases.find(({ status }) => status === "draft")?.id || "";
      }
      selectBuilderRelease(builderReleaseId);
      await loadRateApprovals();
      setBuilderMessage(builderReleaseId ? "Draft ready for a fresh server preview." : "Choose a model and save an immutable draft.");
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : "Rate builder could not be loaded", true);
    }
  }

  function propertyTimeZone() {
    return propertiesData.find(({ id }) => id === propertySelect.value)?.timezone || "UTC";
  }

  function dateAfter(dateText, days = 1) {
    const date = new Date(`${dateText}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function zonedInstant(dateText, hour, minute, timeZone) {
    const [year, month, day] = dateText.split("-").map(Number);
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    let guess = wanted;
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(guess))
        .filter(({ type }) => type !== "literal").map(({ type, value }) => [type, Number(value)]));
      const observed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      guess += wanted - observed;
    }
    return new Date(guess).toISOString();
  }

  function builderPreviewCellDates() {
    const dates = trimmed(builderPreviewDates).split(/[\s,]+/).map((date) => date.trim()).filter(Boolean);
    const selected = dates.length > 0 ? dates : [builderStayStart.value];
    if (selected.length === 0 || selected.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
      throw new Error("Preview dates must use YYYY-MM-DD, separated by commas.");
    }
    if (selected.length > 500) throw new Error("A preview can contain at most 500 stay dates.");
    return [...new Set(selected)].sort();
  }

  function buildPreviewCells() {
    const previewRule = previewBuilderTargetRule();
    const physical = previewRule.physical;
    const physicalUnitTypeId = physical.kind === "unit_type" ? physical.unitTypeId
      : physical.kind === "class" ? physical.unitTypeIds[0]
        : null;
    const sellableId = physical.kind === "sellable" ? physical.sellableUnitId
      : physicalUnitTypeId ? inventoryData.sellableUnits.find(({ unitTypeId }) => unitTypeId === physicalUnitTypeId)?.id
        : builderQuoteSellable.value || inventoryData.sellableUnits[0]?.id;
    const sellable = inventoryData.sellableUnits.find(({ id }) => id === sellableId);
    if (!sellable) throw new Error("A sellable room is required for the server preview.");
    const unitTypeId = sellable.unitTypeId || physicalUnitTypeId || inventoryData.unitTypes[0]?.id;
    if (!unitTypeId) throw new Error("A room type is required for the server preview.");
    const timeZone = propertyTimeZone();
    if (!builderBookingInstant) builderBookingInstant = new Date().toISOString();
    const commercial = previewRule.commercial;
    const promotionCode = trimmed(builderPromotionCode).toUpperCase();
    const channelCode = commercial.channelCode || "direct";
    if (channelCode !== "direct") {
      throw new Error("Non-direct channel previews require governed channel-mapping evidence. Use a direct preview context until that evidence is configured.");
    }
    const occupancyPercent = trimmed(builderOccupancy) ? integerValue(builderOccupancy, 0) : null;
    return builderPreviewCellDates().map((nightDate, index) => ({
      key: `cell-${nightDate}-${index + 1}`,
      evaluationContext: {
        propertyTimeZone: timeZone,
        bookingInstant: builderBookingInstant,
        stayStartInstant: zonedInstant(nightDate, 15, 0, timeZone),
        stayEndInstant: zonedInstant(dateAfter(nightDate), 11, 0, timeZone),
        nightDate,
        ...(occupancyPercent === null ? {} : {
          occupancyBasisPoints: occupancyPercent * 100,
          occupancyEvidenceRef: "operator:review-occupancy",
        }),
        ...(trimmed(builderBarLevel) ? { barLevel: trimmed(builderBarLevel) } : {}),
      },
      targetContext: { unitTypeId, sellableUnitId: sellable.id, commercial },
      guests: { adults: integerValue(builderMinAdults, 1), childAges: [] },
      selectedPromotionCodes: promotionCode ? [promotionCode] : [],
      mandatoryPolicyEvidence: [],
      availabilityEvidence: {
        sellableUnitId: sellable.id,
        availableCount: 1,
        bookable: true,
        restrictionEvidence: [],
        operationalBlockEvidence: [],
        evidenceRef: "operator:rate-builder-preview",
      },
      channelCode,
      channelMappingEvidenceRef: null,
    }));
  }

  function builderWriteKey(operation, body) {
    const identity = `${operation}:${propertySelect.value}:${builderPlan.value}:${JSON.stringify(body)}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    return { identity, key };
  }

  async function saveBuilderDraft() {
    let command;
    try {
      command = builderCommand();
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : "Rate choices are incomplete.", true);
      return;
    }
    const route = `/api/v1/properties/${encodeURIComponent(propertySelect.value)}/rate-builder/${encodeURIComponent(builderPlan.value)}/releases`;
    const pending = builderWriteKey("rate-builder-draft", command);
    builderSaveDraft.disabled = true;
    setBuilderMessage("Saving one atomic model, target and release draft…");
    try {
      const body = await request(route, {
        method: "POST", headers: { "idempotency-key": pending.key }, body: JSON.stringify(command),
      });
      pendingKeys.delete(pending.identity);
      builderReleaseId = body.release.id;
      builderPreviewCells = [];
      builderSimulation = null;
      await loadRateBuilder();
      setBuilderMessage(`Immutable release v${body.release.extensionVersion} saved. Run the server preview next.`);
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : "Rate draft could not be saved", true);
    } finally {
      builderSaveDraft.disabled = false;
    }
  }

  function renderSimulationCells(cells) {
    if (!Array.isArray(cells) || cells.length === 0) {
      emptyList(builderSimulationCells, "The server returned no preview cells.");
      return;
    }
    const cards = cells.map((cell) => {
      const card = document.createElement("article");
      card.className = "simulation-cell-card";
      card.dataset.state = cell.result.state;
      const heading = document.createElement("div");
      heading.className = "simulation-cell-heading";
      const title = document.createElement("strong");
      title.textContent = `${cell.evaluationContext.nightDate} · ${cell.key}`;
      const badge = document.createElement("span");
      badge.className = "simulation-cell-state";
      badge.textContent = cell.result.state;
      heading.append(title, badge);

      const evidence = document.createElement("dl");
      evidence.className = "simulation-cell-evidence";
      const rows = [
        ["Target", cell.targetResolution.state],
        ["Winner", cell.targetResolution.winningRuleKey || "None"],
        ["Matched", cell.targetResolution.matchedRuleKeys.length ? cell.targetResolution.matchedRuleKeys.join(", ") : "None"],
        ["Conflicts", cell.targetResolution.conflictingRuleKeys.length ? cell.targetResolution.conflictingRuleKeys.join(", ") : "None"],
        ["Pre-tax subtotal", cell.result.preTaxSubtotalMinor === null ? "Not quoted" : `${cell.result.currency} ${cell.result.preTaxSubtotalMinor} minor units`],
        ["Evidence", cell.result.reason || `${cell.result.workUnits} server work units`],
      ];
      for (const [term, description] of rows) {
        const dt = document.createElement("dt");
        dt.textContent = term;
        const dd = document.createElement("dd");
        dd.textContent = String(description);
        evidence.append(dt, dd);
      }
      card.append(heading, evidence);
      return card;
    });
    builderSimulationCells.replaceChildren(...cards);
  }

  function renderSimulation(simulation) {
    const summary = document.createElement("div");
    summary.className = simulation.conflictCount > 0 ? "simulation-alert error" : "simulation-alert success";
    const title = document.createElement("strong");
    title.textContent = simulation.conflictCount > 0 ? "Conflict blocks publication" : "Server preview completed";
    const detail = document.createElement("span");
    detail.textContent = `${simulation.quotedCount} quoted · ${simulation.blockedCount} blocked · ${simulation.unpricedCount} unpriced · ${simulation.conflictCount} conflicts · ${simulation.workUnits} bounded work units`;
    const hashes = document.createElement("code");
    hashes.textContent = `content ${simulation.contentHash.slice(0, 12)} · preview ${simulation.previewHash.slice(0, 12)}`;
    const note = document.createElement("small");
    note.textContent = "Draft preview is pre-tax evidence. Published live quote below resolves current tax, policy, restriction and inventory truth.";
    summary.append(title, detail, hashes, note);
    builderSimulationOutput.replaceChildren(summary);
    renderSimulationCells(simulation.cells);
  }

  async function runBuilderPreview() {
    if (!builderReleaseId) return setBuilderMessage("Save or select a draft before previewing.", true);
    builderRunPreview.disabled = true;
    setBuilderMessage("Running the exact preview on the server…");
    try {
      builderPreviewCells = buildPreviewCells();
      const body = await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/rate-builder/${encodeURIComponent(builderPlan.value)}/releases/${encodeURIComponent(builderReleaseId)}/simulate`, {
        method: "POST", body: JSON.stringify({ previewCells: builderPreviewCells }),
      });
      builderSimulation = body.simulation;
      builderSimulationReleaseId = builderReleaseId;
      renderSimulation(body.simulation);
      builderRequestApproval.disabled = body.simulation.conflictCount !== 0;
      syncBuilderPublishState();
      setBuilderMessage(body.simulation.conflictCount === 0
        ? "Preview is conflict-free. Request independent approval when ready."
        : "Resolve the displayed conflict before approval.", body.simulation.conflictCount !== 0);
    } catch (error) {
      builderPreviewCells = [];
      builderSimulation = null;
      builderSimulationReleaseId = "";
      emptyList(builderSimulationCells, "Preview failed; no server-derived cells are available.");
      builderRequestApproval.disabled = true;
      syncBuilderPublishState();
      setBuilderMessage(error instanceof Error ? error.message : "Rate preview failed", true);
    } finally {
      builderRunPreview.disabled = !builderReleaseId;
    }
  }

  async function requestBuilderApproval() {
    if (!builderReleaseId || !builderSimulation || builderPreviewCells.length === 0) {
      return setBuilderMessage("Run a conflict-free server preview first.", true);
    }
    const payload = { previewCells: builderPreviewCells };
    const pending = builderWriteKey("rate-builder-approval", payload);
    builderRequestApproval.disabled = true;
    setBuilderMessage("Recording an approval request for the exact preview hashes…");
    try {
      const body = await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/rate-builder/${encodeURIComponent(builderPlan.value)}/releases/${encodeURIComponent(builderReleaseId)}/approval-request`, {
        method: "POST", headers: { "idempotency-key": pending.key }, body: JSON.stringify(payload),
      });
      pendingKeys.delete(pending.identity);
      selectedRateApprovalId = "";
      renderSimulation(body.simulation);
      await loadRateApprovals();
      setBuilderMessage("Approval requested. A different authorized operator must approve it before publication.");
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : "Approval request failed", true);
    } finally {
      builderRequestApproval.disabled = !builderSimulation || builderSimulation.conflictCount !== 0;
    }
  }

  async function publishBuilderRelease() {
    const approval = selectedRateApproval();
    if (!approval?.canPublish || approval.releaseId !== builderReleaseId ||
        builderSimulationReleaseId !== builderReleaseId || builderPreviewCells.length === 0) {
      return setBuilderMessage("Select an approval you decided, then run a fresh preview for that exact release.", true);
    }
    const payload = { approvalId: approval.id, previewCells: builderPreviewCells };
    const pending = builderWriteKey("rate-builder-publish", payload);
    builderPublish.disabled = true;
    setBuilderMessage("Re-running the approved preview and publishing atomically…");
    try {
      const body = await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/rate-builder/${encodeURIComponent(builderPlan.value)}/releases/${encodeURIComponent(builderReleaseId)}/publish`, {
        method: "POST", headers: { "idempotency-key": pending.key }, body: JSON.stringify(payload),
      });
      pendingKeys.delete(pending.identity);
      renderSimulation(body.simulation);
      builderReleaseId = "";
      builderSimulationReleaseId = "";
      selectedRateApprovalId = "";
      await loadRateBuilder();
      setBuilderMessage(`Version ${body.release.extensionVersion} is active. Live quotes now resolve through it.`);
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : "Publication failed", true);
    } finally {
      syncBuilderPublishState();
    }
  }

  async function createBuilderUndo(sourceReleaseId, button) {
    const pending = builderWriteKey("rate-builder-undo", { sourceReleaseId });
    button.disabled = true;
    setBuilderMessage("Creating a new immutable undo draft…");
    try {
      const release = await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/rate-builder/${encodeURIComponent(builderPlan.value)}/releases/${encodeURIComponent(sourceReleaseId)}/undo`, {
        method: "POST", headers: { "idempotency-key": pending.key }, body: "{}",
      });
      pendingKeys.delete(pending.identity);
      builderReleaseId = release.id;
      await loadRateBuilder();
      setBuilderMessage(`Undo draft v${release.extensionVersion} created. History was not rewritten.`);
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : "Undo draft could not be created", true);
    } finally {
      button.disabled = false;
    }
  }

  function localDateTimeInProperty(input) {
    const match = input.value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
    if (!match) throw new Error("Choose a complete stay date and time.");
    return zonedInstant(match[1], Number(match[2]), Number(match[3]), propertyTimeZone());
  }

  async function resolveBuilderQuote() {
    if (!builderPlan.value || !builderQuoteSellable.value) return setBuilderMessage("Choose a plan and sellable room for the live quote.", true);
    builderLiveQuote.disabled = true;
    builderQuoteResult.textContent = "Resolving the active release against live tax, policy, restriction and inventory truth…";
    try {
      const previewRule = previewBuilderTargetRule();
      const promotionCode = trimmed(builderPromotionCode).toUpperCase();
      const body = await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/rate-builder/${encodeURIComponent(builderPlan.value)}/quotes:resolve`, {
        method: "POST",
        body: JSON.stringify({
          sellableUnitId: builderQuoteSellable.value,
          stayStart: localDateTimeInProperty(builderQuoteStart),
          stayEnd: localDateTimeInProperty(builderQuoteEnd),
          guests: { adults: integerValue(builderMinAdults, 1), childAges: [] },
          selectedPromotionCodes: promotionCode ? [promotionCode] : [],
          commercial: previewRule.commercial,
          channelCode: previewRule.commercial.channelCode || "direct",
        }),
      });
      builderQuoteResult.textContent = JSON.stringify(body.quote, null, 2);
      setBuilderMessage("Live tenant-scoped quote resolved from the active release.");
    } catch (error) {
      builderQuoteResult.textContent = error instanceof Error ? error.message : "Live quote failed";
      setBuilderMessage(builderQuoteResult.textContent, true);
    } finally {
      builderLiveQuote.disabled = false;
    }
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
    populateBuilderSelects();
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
      await loadRateBuilder();
      ratesStatus.textContent = "Policies and plans are current from tenant-scoped PostgreSQL.";
    } catch (error) {
      ratesStatus.textContent = error instanceof Error ? error.message : "Rate configuration could not be loaded";
    }
  }

  function readableState(state) {
    return ({
      reviewed: "Independently reviewed",
      built_unverified: "Built · review pending",
      active: "Active build phase",
      planned: "Planned",
      operational: "Operational",
      configured: "Configured",
      disabled: "Disabled",
      not_connected: "Not connected",
    })[state] || "Unknown";
  }

  function healthCard(name, state, detail) {
    const card = document.createElement("article");
    card.className = "card status-health-card";
    const dot = document.createElement("span");
    dot.className = `status-dot ${state}`;
    dot.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${name} · ${readableState(state)}`;
    const explanation = document.createElement("p");
    explanation.textContent = detail;
    copy.append(title, explanation);
    card.append(dot, copy);
    return card;
  }

  function renderSystemStatus(body) {
    const { snapshot, live } = body;
    const reached = snapshot.roadmap.activePhase + 1;
    statusOrder.textContent = `Order ${snapshot.roadmap.latestBuiltOrder} built`;
    statusRoadmapCopy.textContent = `Phase ${snapshot.roadmap.activePhase} of ${snapshot.roadmap.phaseCount - 1} is active; ${reached} of ${snapshot.roadmap.phaseCount} named phases have been reached.`;
    roadmapProgress.max = snapshot.roadmap.phaseCount;
    roadmapProgress.value = reached;
    roadmapProgress.textContent = `${reached} of ${snapshot.roadmap.phaseCount} phases reached`;
    statusDebt.textContent = `${snapshot.review.gate3Debt} orders`;
    statusReviewCopy.textContent = `Orders 1–${snapshot.review.independentlyReviewedThroughOrder} are independently reviewed. Later builder evidence remains ${snapshot.review.state}.`;
    reviewProgress.max = snapshot.roadmap.latestBuiltOrder;
    reviewProgress.value = snapshot.review.independentlyReviewedThroughOrder;
    reviewProgress.textContent = `${snapshot.review.independentlyReviewedThroughOrder} of ${snapshot.roadmap.latestBuiltOrder} orders independently reviewed`;
    statusReferee.textContent = `${snapshot.referee.requiredPasses}/${snapshot.referee.requiredPasses} required`;
    statusRecordedAt.textContent = `Snapshot date ${snapshot.recordedAt} · current order ${snapshot.roadmap.currentOrder}`;

    const phases = snapshot.phases.map((phase) => {
      const item = document.createElement("li");
      item.className = "status-phase-item";
      item.dataset.state = phase.state;
      const number = document.createElement("b");
      number.textContent = String(phase.number);
      const copy = document.createElement("span");
      const name = document.createElement("span");
      name.textContent = phase.name;
      const state = document.createElement("small");
      state.textContent = readableState(phase.state);
      copy.append(name, state);
      item.append(number, copy);
      return item;
    });
    statusPhaseList.replaceChildren(...phases);

    const appChecked = new Date(live.app.checkedAt).toLocaleString();
    const databaseChecked = new Date(live.database.checkedAt).toLocaleString();
    statusHealthGrid.replaceChildren(
      healthCard("Application", live.app.state, `Responded at ${appChecked}; process started ${new Date(live.app.processStartedAt).toLocaleString()}.`),
      healthCard("PostgreSQL", live.database.state, `Tenant context confirmed: ${live.database.tenantContext ? "yes" : "no"}. Checked at ${databaseChecked}.`),
      healthCard("Hold-expiry worker", live.workers.holdExpiry, "Configured means the runtime flag is enabled; this card does not claim a successful poll."),
      healthCard("Projection worker", live.workers.availabilityProjection, "Configured means the runtime flag is enabled; projection remains disposable acceleration."),
      healthCard("Valkey", live.valkey.state, live.valkey.detail),
      healthCard("External CI", live.ci.state, live.ci.detail),
    );
    statusMessage.textContent = "Live checks refreshed through the authenticated tenant transaction.";
  }

  async function loadSystemStatus() {
    const property = propertySelect.value;
    if (!property) return;
    refreshStatus.disabled = true;
    statusMessage.textContent = "Checking the local process and tenant-scoped PostgreSQL…";
    try {
      renderSystemStatus(await request(`/api/v1/properties/${encodeURIComponent(property)}${SYSTEM_STATUS_SUFFIX}`));
    } catch (error) {
      statusMessage.textContent = error instanceof Error ? error.message : "System status could not be loaded";
    } finally {
      refreshStatus.disabled = false;
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
    activeView = ["availability", "inventory", "operations", "restrictions", "rates", "status"].includes(view) ? view : "availability";
    availabilityView.hidden = activeView !== "availability";
    inventoryView.hidden = activeView !== "inventory";
    restrictionsView.hidden = activeView !== "restrictions";
    ratesView.hidden = activeView !== "rates";
    operationsView.hidden = activeView !== "operations";
    statusView.hidden = activeView !== "status";
    workbenchTitle.textContent = activeView === "inventory" ? "Inventory setup" :
      activeView === "operations" ? "Operations" : activeView === "restrictions" ? "Restrictions" :
        activeView === "rates" ? "Rates" : activeView === "status" ? "Project status" : "Availability";
    for (const tab of navigation) {
      const selected = tab.dataset.view === activeView;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-current", selected ? "page" : "false");
    }
    if (propertySelect.value && updateHistory) {
      history.pushState(null, "", `/p/${propertySelect.value}/${activeView}`);
    }
    if (activeView === "inventory") void loadInventory();
    if (activeView === "availability") {
      void loadActiveHolds();
      void loadOfflineLeases();
    }
    if (activeView === "operations") void loadOperationalBlocks();
    if (activeView === "restrictions") void loadRestrictions();
    if (activeView === "rates") void loadRates();
    if (activeView === "status") void loadSystemStatus();
    if (activeView === "status") void loadSystemStatus();
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

  function renderOfflineLeases() {
    offlineLeaseList.replaceChildren(...offlineLeasesData.map((lease) => {
      const item = document.createElement("article");
      item.className = "restriction-item";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = typeof lease.holder?.device_label === "string"
        ? lease.holder.device_label
        : lease.holder?.device_id || "Offline device";
      const detail = document.createElement("span");
      detail.textContent = `${lease.holder?.device_id || "unknown device"} · ${new Date(lease.from).toLocaleString()} → ${new Date(lease.to).toLocaleString()} · lease expires ${new Date(lease.expiresAt).toLocaleString()}`;
      copy.append(title, detail);
      const release = document.createElement("button");
      release.type = "button";
      release.className = "quiet compact";
      release.textContent = "Release offline capacity";
      release.addEventListener("click", () => void releaseOfflineLease(lease, release));
      item.append(copy, release);
      return item;
    }));
    if (offlineLeasesData.length === 0) emptyList(offlineLeaseList, "No active offline capacity leases.");
  }

  async function loadOfflineLeases() {
    const property = propertySelect.value;
    if (!property) return;
    offlineLeaseStatus.textContent = "Loading offline capacity…";
    try {
      const body = await request(`/api/v1/properties/${encodeURIComponent(property)}/offline-leases`);
      offlineLeasesData = body.offlineLeases;
      renderOfflineLeases();
      offlineLeaseStatus.textContent = `${offlineLeasesData.length} active offline lease${offlineLeasesData.length === 1 ? "" : "s"} from tenant-scoped PostgreSQL.`;
    } catch (error) {
      offlineLeaseStatus.textContent = error instanceof Error ? error.message : "Offline capacity could not be loaded";
    }
  }

  async function releaseOfflineLease(lease, button) {
    const identity = `offline-lease-release:${lease.id}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    button.disabled = true;
    offlineLeaseStatus.textContent = "Releasing offline capacity…";
    try {
      await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/offline-leases/${encodeURIComponent(lease.id)}/release`, {
        method: "POST", headers: { "idempotency-key": key }, body: "{}",
      });
      pendingKeys.delete(identity);
      offlineLeaseStatus.textContent = "Offline capacity released. PostgreSQL truth is refreshing.";
      await loadOfflineLeases();
      availabilityForm.requestSubmit();
    } catch (error) {
      offlineLeaseStatus.textContent = error instanceof Error ? error.message : "Offline capacity could not be released";
      button.disabled = false;
    }
  }

  function populateOfflineSellables(options) {
    const previous = offlineLeaseSellable.value;
    const choices = options.filter((option) => option.bookable);
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = choices.length === 0 ? "No bookable option in this search" : "Choose exact searched capacity";
    offlineLeaseSellable.replaceChildren(placeholder);
    for (const option of choices) {
      const choice = document.createElement("option");
      choice.value = option.sellableUnitId;
      choice.textContent = `${option.sellableUnitName} · ${option.unitTypeCode} · ${option.availableCount} free`;
      offlineLeaseSellable.append(choice);
    }
    offlineLeaseSellable.disabled = choices.length === 0;
    if (choices.some(({ sellableUnitId }) => sellableUnitId === previous)) offlineLeaseSellable.value = previous;
  }

  function workbenchOption(offer) {
    return {
      optionRef: offer.option_ref,
      state: offer.state,
      reason: offer.reason,
      sellableUnitId: offer.sellable_unit.id,
      sellableUnitName: offer.sellable_unit.name,
      unitTypeId: offer.unit_type.id,
      unitTypeCode: offer.unit_type.code,
      unitTypeName: offer.unit_type.name,
      profileKey: offer.unit_type.profile_key,
      maxOccupancy: offer.unit_type.max_occupancy,
      ratePlanCode: offer.rate_plan.code,
      ratePlanName: offer.rate_plan.name,
      currency: offer.rate_plan.currency,
      perNight: offer.per_night,
      total: offer.total,
      policies: offer.policies,
      availableCount: offer.available_count,
      bookable: offer.bookable,
      restrictionsApplied: offer.restrictions_applied,
      operationalBlocksApplied: offer.operational_blocks_applied.map((block) => ({
        ...block,
        spaceId: block.space_id,
      })),
    };
  }

  function renderOptions(options, summary) {
    results.replaceChildren();
    populateOfflineSellables(options);
    if (options.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No active sellable configurations fit this search. Inventory setup may still be required.";
      results.append(empty);
      resultSummary.textContent = "No options returned.";
      return;
    }

    const bookable = options.filter((option) => option.bookable).length;
    resultSummary.textContent = `${options.length} published option${options.length === 1 ? "" : "s"} · ${bookable} bookable · ${summary?.publication_unavailable || 0} awaiting publication`;
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

      const rate = document.createElement("div");
      rate.className = "code";
      if (option.total) {
        rate.textContent = `${option.ratePlanCode} · ${option.currency} ${option.total.amount_minor} minor units pre-tax · exact published evidence, commit rechecks inventory`;
      } else {
        rate.textContent = `${option.ratePlanCode} · ${option.state}${option.reason ? ` · ${option.reason}` : ""} · no price offered`;
      }
      card.append(rate);

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
          stay: { from: from.toISOString(), to: to.toISOString() },
          party: { adults: Number(fields.get("partySize")), children: [] },
          channel: "direct",
        }),
      });
      history.pushState(null, "", `/p/${property}/availability`);
      renderOptions(body.options.map(workbenchOption), body.summary);
    } catch (error) {
      resultSummary.textContent = error instanceof Error ? error.message : "Search failed";
    } finally {
      button.disabled = false;
    }
  });

  propertySelect.addEventListener("change", () => {
    if (propertySelect.value) history.replaceState(null, "", `/p/${propertySelect.value}/${activeView}`);
    if (activeView === "inventory") void loadInventory();
    if (activeView === "availability") {
      void loadActiveHolds();
      void loadOfflineLeases();
    }
    if (activeView === "operations") void loadOperationalBlocks();
    if (activeView === "restrictions") void loadRestrictions();
    if (activeView === "rates") void loadRates();
  });
  for (const tab of navigation) tab.addEventListener("click", () => setView(tab.dataset.view));
  refreshInventory.addEventListener("click", () => void loadInventory());
  refreshProjection.addEventListener("click", () => void loadProjectionStatus());
  bulkRoomForm.addEventListener("input", updateBulkRoomPreview);
  bulkRoomForm.addEventListener("change", updateBulkRoomPreview);
  bulkRoomRefreshPreview.addEventListener("click", updateBulkRoomPreview);
  refreshRestrictions.addEventListener("click", () => void loadRestrictions());
  refreshRates.addEventListener("click", () => void loadRates());
  refreshOperationalBlocks.addEventListener("click", () => void loadOperationalBlocks());
  refreshHolds.addEventListener("click", () => void loadActiveHolds());
  refreshOfflineLeases.addEventListener("click", () => void loadOfflineLeases());
  refreshStatus.addEventListener("click", () => void loadSystemStatus());
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
  projectionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(projectionForm);
    const body = { fromDate: fields.get("fromDate"), toDate: fields.get("toDate") };
    const identity = `projection:${propertySelect.value}:${JSON.stringify(body)}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    const button = projectionForm.querySelector("button[type=submit]");
    button.disabled = true;
    formMessage(projectionForm, "Rebuilding the selected disposable read horizon…");
    try {
      const status = await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/availability-projection:rebuild`, {
        method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify(body),
      });
      pendingKeys.delete(identity);
      renderProjectionStatus(status);
      formMessage(projectionForm, "Projection rebuilt. PostgreSQL occupancy truth remains booking authority.");
    } catch (error) {
      formMessage(projectionForm, error instanceof Error ? error.message : "Projection could not be rebuilt", true);
    } finally {
      button.disabled = false;
    }
  });
  offlineLeaseForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!availabilityForm.reportValidity() || !offlineLeaseForm.reportValidity()) return;
    const leaseFields = new FormData(offlineLeaseForm);
    const availabilityFields = new FormData(availabilityForm);
    const deviceLabel = String(leaseFields.get("deviceLabel") || "").trim();
    const body = {
      sellableUnitId: leaseFields.get("sellableUnitId"),
      from: new Date(String(availabilityFields.get("from"))).toISOString(),
      to: new Date(String(availabilityFields.get("to"))).toISOString(),
      deviceId: String(leaseFields.get("deviceId")),
      ...(deviceLabel ? { deviceLabel } : {}),
      leaseHours: Number(leaseFields.get("leaseHours")),
    };
    const identity = `offline-lease-place:${propertySelect.value}:${JSON.stringify(body)}`;
    const key = pendingKeys.get(identity) || crypto.randomUUID();
    pendingKeys.set(identity, key);
    const button = offlineLeaseForm.querySelector("button[type=submit]");
    button.disabled = true;
    formMessage(offlineLeaseForm, "Prepare offline capacity through PostgreSQL truth…");
    try {
      await request(`/api/v1/properties/${encodeURIComponent(propertySelect.value)}/offline-leases`, {
        method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify(body),
      });
      pendingKeys.delete(identity);
      formMessage(offlineLeaseForm, "Offline capacity prepared for this device. This is not a reservation.");
      await loadOfflineLeases();
      availabilityForm.requestSubmit();
    } catch (error) {
      formMessage(offlineLeaseForm, error instanceof Error ? error.message : "Offline capacity could not be prepared", true);
    } finally {
      button.disabled = false;
    }
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
  bulkRoomForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    updateBulkRoomPreview();
    if (bulkRoomDraft.length < 1 || !bulkRoomUnitType.value) {
      formMessage(bulkRoomForm, "Create a valid explicit preview and choose a hotel room type first.", true);
      return;
    }
    const rooms = bulkRoomDraft.map((room) => ({ ...room }));
    const saved = await submitInventory(bulkRoomForm, "rooms:bulk", {
      unitTypeId: bulkRoomUnitType.value,
      rooms,
    });
    if (saved) formMessage(bulkRoomForm, `${rooms.length} room${rooms.length === 1 ? "" : "s"} committed atomically with audit facts and events.`);
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
  builderPlan.addEventListener("change", () => {
    builderReleaseId = "";
    builderPreviewCells = [];
    builderSimulation = null;
    builderSimulationReleaseId = "";
    rateApprovalData = [];
    rateApprovalNextCursor = null;
    selectedRateApprovalId = "";
    resetBuilderAiProposal("The base plan changed. Interpret the intent again before applying it.");
    void loadRateBuilder();
  });
  builderModeSelect.addEventListener("change", () => setBuilderMode(builderModeSelect.value));
  for (const radio of builderModeRadios) radio.addEventListener("change", () => {
    if (radio.checked) setBuilderMode(radio.value);
  });
  builderModelCatalogue.addEventListener("change", (event) => {
    const input = event.target.closest('input[name="builder-model"]');
    if (!input) return;
    resetBuilderAiProposal("The pricing model changed. Interpret the intent again before applying it.");
    builderSelectedModel = input.value;
    updateBuilderModelFields();
  });
  builderAddTargetRule.addEventListener("click", () => {
    if (builderTargetCards().length >= 200) return setBuilderMessage("A target draft can contain at most 200 rules.", true);
    const card = createBuilderTargetRuleCard();
    card.open = true;
    targetField(card, "key").focus();
    renderBuilderCommand();
  });
  builderTargetRuleList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-target-action]");
    if (!button) return;
    const card = button.closest(".target-rule-card");
    if (button.dataset.targetAction === "remove") {
      if (builderTargetCards().length === 1) return setBuilderMessage("At least one applicability rule is required.", true);
      const usedForPreview = card.querySelector('input[name="builder-preview-target"]').checked;
      card.remove();
      if (usedForPreview) builderTargetRuleList.querySelector('input[name="builder-preview-target"]')?.click();
      renderBuilderTargetRules();
      renderBuilderCommand();
      return;
    }
    if (button.dataset.targetAction === "duplicate") {
      try {
        const duplicate = readBuilderTargetRule(card);
        const suffix = `-copy-${builderTargetRuleSequence + 1}`;
        duplicate.key = `${duplicate.key.slice(0, 64 - suffix.length)}${suffix}`;
        const copy = createBuilderTargetRuleCard(duplicate);
        copy.open = true;
        targetField(copy, "key").focus();
        renderBuilderCommand();
      } catch (error) {
        setBuilderMessage(error instanceof Error ? error.message : "Complete this rule before duplicating it.", true);
      }
    }
  });
  builderTargetRuleList.addEventListener("change", (event) => {
    const card = event.target.closest(".target-rule-card");
    if (!card) return;
    if (event.target.dataset.targetField === "physicalKind") updateBuilderTargetPhysicalFields(card);
    renderBuilderTargetRules();
    renderBuilderCommand();
  });
  builderTargetRuleList.addEventListener("input", (event) => {
    const card = event.target.closest(".target-rule-card");
    if (card) renderBuilderTargetRuleSummary(card);
  });
  for (const button of builderSteps) button.addEventListener("click", () => setBuilderStep(Number(button.dataset.builderStep)));
  builderPrevious.addEventListener("click", () => setBuilderStep(builderStep - 1));
  builderNext.addEventListener("click", () => {
    if (builderStep === 1 && !builderPlan.value) return setBuilderMessage("Create or choose a base rate plan before pricing.", true);
    setBuilderStep(builderStep + 1);
  });
  builderRefreshJson.addEventListener("click", refreshExpertJson);
  builderAiInterpret.addEventListener("click", () => void interpretBuilderIntent());
  builderAiApply.addEventListener("click", applyBuilderAiProposal);
  builderAiIntent.addEventListener("input", () => resetBuilderAiProposal("Intent changed. Interpret again; nothing is saved automatically."));
  builderSaveDraft.addEventListener("click", () => void saveBuilderDraft());
  builderRunPreview.addEventListener("click", () => void runBuilderPreview());
  builderRequestApproval.addEventListener("click", () => void requestBuilderApproval());
  builderPublish.addEventListener("click", () => void publishBuilderRelease());
  builderRefreshHistory.addEventListener("click", () => void loadRateBuilder());
  builderRefreshApprovals.addEventListener("click", () => void loadRateApprovals().catch((error) => {
    setBuilderMessage(error instanceof Error ? error.message : "Approval inbox could not be refreshed", true);
  }));
  builderLoadMoreApprovals.addEventListener("click", () => void loadRateApprovals(true).catch((error) => {
    setBuilderMessage(error instanceof Error ? error.message : "Older approval requests could not be loaded", true);
  }));
  builderLiveQuote.addEventListener("click", () => void resolveBuilderQuote());
  document.querySelector("#rate-builder").addEventListener("input", (event) => {
    if (event.target !== builderAiIntent && event.target !== builderExpertJson && builderAiAppliedProposal) {
      resetBuilderAiProposal("A typed rate choice changed. Interpret and apply the proposal again.");
    }
    if (event.target !== builderExpertJson) renderBuilderCommand();
  });
  builderExpertJson.addEventListener("input", renderBuilderCommand);
  themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
  signOutButton.addEventListener("click", showLogin);
  applyTheme(themeSelect.value);
  initializeDates();
  addTier(createTierList, 1, "");
  addTier(createTierList, 2, "");
  updateRestrictionFields();
  updatePolicyFields();
  createBuilderTargetRuleCard({ key: "property-default", effect: "include", priority: 0, physical: { kind: "property" }, commercial: {} });
  setBuilderStep(1);
  setBuilderMode("guided", false);
  const initialView = location.pathname.endsWith("/inventory") ? "inventory" :
    location.pathname.endsWith("/operations") ? "operations" :
    location.pathname.endsWith("/restrictions") ? "restrictions" :
    location.pathname.endsWith("/rates") ? "rates" :
    location.pathname.endsWith("/status") ? "status" : "availability";
  setView(initialView, false);
})();
