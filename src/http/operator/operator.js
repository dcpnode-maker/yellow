(() => {
 "use strict";
 let accessToken = "";
 let operator = null;
 let activeView = "today";
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
 let reservationGuestData = null;
 let reservationGuestRequestGeneration = 0;
 let reservationLifecycleData = null;
 let reservationSegmentData = null;
 let reservationSegmentRequestGeneration = 0;
 let reservationTravelData = null;
 let reservationTravelRequestGeneration = 0;
 let reservationBookingOffers = [];
 let reservationBookingSelection = null;
 let reservationBookingHold = null;
 let reservationBookingDraft = null;
 let reservationBookingSearchGeneration = 0;
 let reservationBoardRows = [];
 let reservationBoardNextCursor = null;
 let reservationBoardGeneration = 0;
 let reservationDetailData = null;
 let reservationDetailGeneration = 0;
 let reservationPickupTaskData = null;
 let reservationPickupTaskRequestGeneration = 0;
 let reservationPickupTaskReturnFocus = null;
 let reservationPickupTaskStaffSearchGeneration = 0;
 let reservationPickupTaskStaffSelection = null;
 const reservationPickupTaskAttempts = new Map();
 let checkInReadinessData = null;
 let checkInReadinessGeneration = 0;
 let checkInHousekeepingReturn = null;
 let checkInHousekeepingActionOrigin = null;
 let dueInRoomAssignmentData = null;
 let dueInRoomAssignmentRequestGeneration = 0;
 let dueInRoomAssignmentOrigin = null;
 let dueInRoomAssignmentAttempt = null;
 let dueInRoomAssignmentSuccessFocus = null;
 let checkInAttemptKey = "";
 let checkInAttemptDraft = "";
 let checkoutReadinessData = null;
 let checkoutReadinessGeneration = 0;
 let checkoutAttemptKey = "";
 let checkoutAttemptDraft = "";
 let checkoutPending = false;
 let checkoutCompletionNotice = null;
 let checkoutHousekeepingCompletion = null;
 let checkoutHousekeepingActionOrigin = null;
 let checkoutHousekeepingReturn = null;
 let checkoutHousekeepingBrowserGeneration = 0;
 let housekeepingCheckoutReturnAction = null;
 let reservationDrawerReturnFocus = null;
 let reservationDrawerReturnView = "";
 let reservationDrawerReturnReservationId = "";
 let todayReturnFocus = { reservationId: "", cycle: 0 };
 let todayGeneration = 0;
 let todayWindowState = null;
 let housekeepingGeneration = 0;
 let housekeepingRequestGeneration = 0;
 let housekeepingData = [];
 let housekeepingReturnFocus = "";
 let housekeepingTaskDetailData = null;
 let housekeepingTaskDetailRequestGeneration = 0;
 let housekeepingRouteTaskId = "";
 let housekeepingTaskDetailReturnFocus = null;
 let housekeepingTaskDetailPanel = null;
 let housekeepingConditionGeneration = 0;
 let housekeepingConditionRequestGeneration = 0;
 let housekeepingConditionRows = [];
 let housekeepingConditionNextCursor = null;
 let housekeepingConditionInitialization = null;
 let housekeepingConditionInitializationRequestGeneration = 0;
 const housekeepingConditionInitializationAttempts = new Map();
 let housekeepingDiscrepancyGeneration = 0;
 let housekeepingDiscrepancyRequestGeneration = 0;
 let housekeepingDiscrepancyRows = Object.freeze([]);
 const housekeepingDiscrepancyAttempts = new Map();
 let arrivalRoomCleaningTaskRequest = null;
 let arrivalRoomCleaningTaskRequestGeneration = 0;
 let arrivalRoomCleaningTaskAttempt = null;
 const housekeepingAttempts = new Map();
 const housekeepingTaskDetailAttempts = new Map();
 let housekeepingSheetGeneration = 0;
 let housekeepingSheetRequestGeneration = 0;
 let housekeepingSheetAttendant = null;
 let housekeepingSheetPreview = [];
 let housekeepingSheetCanGenerate = false;
 let housekeepingSheetAttemptKey = "";
 let housekeepingSheetAttemptDraft = "";
 let housekeepingGenerationReceipt = null;
 let housekeepingGenerationReceiptGeneration = 0;
 let housekeepingGenerationReceiptPanel = null;
 let vehicleRegisterGeneration = 0;
 let vehicleRegisterNextCursor = null;
 let vehicleRegisterCursor = "";
 let vehicleRegisterFilter = "";
 let vehicleRegisterRenderedPath = "";
 let vehicleRegisterRows = Object.freeze([]);
 let vehicleRegisterDeferSync = false;
 let vehicleDetailData = null;
 let vehicleDetailRequestGeneration = 0;
 let vehicleRouteVehicleId = "";
 let vehicleDetailReturnFocus = null;
 let vehicleDetailReturnPath = "";
 let vehicleDetailPanel = null;
 let vehicleLinkedReservationReturn = null;
 let vehicleRegisterLinkedReservationReturn = null;
 const todayLaneState = {
 due_in: { rows: [], nextCursor: null, requestGeneration: 0 },
 due_out: { rows: [], nextCursor: null, requestGeneration: 0 },
 in_house: { rows: [], nextCursor: null, requestGeneration: 0 },
 };
 let reservationCreateStep = 1;
 let reservationCreateDirty = false;
 let reservationCreateProperty = "";
 let reservationRouteReservationId = "";
 let reservationRoutePickupTaskId = "";
 let currentReservationWorkbench = null;
 let reservationOperationalPreparationReturn = null;
 const RESERVATION_WORKBENCH_QUERY = Object.freeze({
  "check-in": "workbench=check-in",
  checkout: "workbench=checkout",
 });
 let partyProfileGeneration = 0;
 let partyCreateAttemptKey = "";
 let partyCreateDraft = null;
 let partyDuplicateIds = [];
 let folioStatementData = null;
 let folioNextCursor = null;
 let folioGeneration = 0;
 let folioIdentity = "";
 let folioChargeAttemptKey = "";
 let folioChargeDraft = "";
 let d,p
 let folioCorrectionAttemptKey = "";
 let folioCorrectionDraft = "";
 let folioCorrectionSelection = null;
 let folioCorrectionReturnFocus = null;
 let folioWindowAttemptKey = "";
 let folioWindowDraft = "";
 let folioTransferAttemptKey = "";
 let folioTransferDraft = "";
 let folioTransferPreview = null;
 let folioStatusAttemptKey = "";
 let folioStatusAttemptDraft = "";
 let folioStatusPending = false;
 let folioActiveTab = "postings";
 let folioRouteCursor = "";
 let folioWorkspaceProperty = "";
 let folioReturnFocus = null;
 let departureFolioReturn = null;
 let departureFolioExitConfirmed = false;
 let reservationFolioReturn = null;
 let reservationFolioExitConfirmed = false;
 let receivableTargets = [];
 let receivablePreview = null;
 let receivableApproval = null;
 let receivablePreviewGeneration = 0;
 let receivableApprovalAttemptKey = "";
 let receivableApprovalDraft = "";
 let receivableDecisionAttemptKey = "";
 let receivableDecisionDraft = "";
 let receivableTransferAttemptKey = "";
 let receivableTransferDraft = "";
 let cashierData = null;
 let cashierGeneration = 0;
 let cashierDrawerId = "";
 let cashierOpenAttemptKey = "";
 let cashierOpenDraft = "";
 let cashierCountAttemptKey = "";
 let cashierCountDraft = "";
 let cashierCloseAttemptKey = "";
 let cashierCloseDraft = "";
 let cashierLatestEvidence = null;
 let cashierApprovalRequestKey = "";
 let cashierApprovalRequestDraft = "";
 let cashierApprovalDecisionKey = "";
 let cashierApprovalDecisionDraft = "";
 let reservationPrimaryFolioAttemptKey = "";
 let reservationPrimaryFolioReservationId = "";
 const pendingKeys = new Map();
 const $ = document.querySelector.bind(document);
 const el = document.createElement.bind(document);
 const enc = encodeURIComponent;
 const canonicalUuid = (value) => /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/.test(value);
  function node(tag, className, text) {
 const created = el(tag);
 if (className) created.className = className;
 if (text !== undefined) created.textContent = text;
 return created;
 }
 const loginView = $("#login-view");
 const workbenchView = $("#workbench-view");
 const loginForm = $("#login-form");
 const loginMessage = $("#login-message");
 const availabilityForm = $("#availability-form");
 const propertySelect = $("#property-select");
 const results = $("#results");
 const resultSummary = $("#result-summary");
 const sessionState = $("#session-state");
 const operatorName = $("#operator-name");
 const signOutButton = $("#sign-out");
 const themeSelect = $("#theme-select");
 const workspaceSkinSelect = $("#workspace-skin-select");
 const experienceSelect = $("#experience-select");
 const secondaryWorkspaces = $("#secondary-workspaces");
 const secondaryWorkspacesToggle = $("#secondary-workspaces-toggle");
 const workbenchTitle = $("#workbench-title");
 const availabilityReservationShortcut = $("#availability-reservation-shortcut");
 const availabilityView = $("#availability-view");
 const todayView = $("#today-view");
 const todayWindowLabel = $("#today-window");
 const todayRefresh = $("#today-refresh");
 const todayLanes = [...document.querySelectorAll("[data-today-lane]")];
 const housekeepingView = $("#housekeeping-view");
 const housekeepingRefresh = $("#housekeeping-refresh");
 const housekeepingArrivalReturnAction = $("#housekeeping-arrival-return");
 const housekeepingHeadingActions = $(".housekeeping-heading-actions");
 const housekeepingLoading = $("#housekeeping-loading");
 const housekeepingError = $("#housekeeping-error");
 const housekeepingErrorCopy = $("#housekeeping-error-copy");
 const housekeepingRetry = $("#housekeeping-retry");
 const housekeepingEmpty = $("#housekeeping-empty");
 const housekeepingTaskList = $("#housekeeping-task-list");
 const housekeepingStatus = $("#housekeeping-status");
 const housekeepingConditionBoard = $("#housekeeping-condition-board");
 const housekeepingConditionTitle = $("#housekeeping-condition-title");
 const housekeepingConditionRefresh = $("#housekeeping-condition-refresh");
 const housekeepingConditionFilter = $("#housekeeping-condition-filter");
 const housekeepingConditionCount = $("#housekeeping-condition-count");
 const housekeepingConditionLoading = $("#housekeeping-condition-loading");
 const housekeepingConditionError = $("#housekeeping-condition-error");
 const housekeepingConditionRetry = $("#housekeeping-condition-retry");
 const housekeepingConditionEmpty = $("#housekeeping-condition-empty");
 const housekeepingConditionList = $("#housekeeping-condition-list");
 const housekeepingConditionStatus = $("#housekeeping-condition-status");
 const housekeepingConditionMore = $("#housekeeping-condition-more");
 const housekeepingConditionInitializationSlot = $("#housekeeping-condition-initialization-slot");
 const housekeepingDiscrepancyWorkbench = $("#housekeeping-discrepancy-workbench");
 const housekeepingDiscrepancyTitle = $("#housekeeping-discrepancy-title");
 const housekeepingDiscrepancyRefresh = $("#housekeeping-discrepancy-refresh");
 const housekeepingDiscrepancyForm = $("#housekeeping-discrepancy-report-form");
 const housekeepingDiscrepancySpace = $("#housekeeping-discrepancy-space");
 const housekeepingDiscrepancyPersonsField = $("#housekeeping-discrepancy-persons-field");
 const housekeepingDiscrepancyPersons = $("#housekeeping-discrepancy-persons");
 const housekeepingDiscrepancySubmit = $("#housekeeping-discrepancy-submit");
 const housekeepingDiscrepancyStatus = $("#housekeeping-discrepancy-status");
 const housekeepingDiscrepancyError = $("#housekeeping-discrepancy-error");
 const housekeepingDiscrepancyRetry = $("#housekeeping-discrepancy-retry");
 const housekeepingDiscrepancyEmpty = $("#housekeeping-discrepancy-empty");
 const housekeepingDiscrepancyList = $("#housekeeping-discrepancy-list");
 const housekeepingSheetForm = $("#housekeeping-sheet-form");
 const housekeepingSheetDate = $("#housekeeping-sheet-date");
 const housekeepingAttendantQuery = $("#housekeeping-attendant-query");
 const housekeepingAttendantSearch = $("#housekeeping-attendant-search");
 const housekeepingAttendantSearchRow = $(".housekeeping-attendant-search-row");
 const housekeepingAttendantResults = $("#housekeeping-attendant-results");
 const housekeepingAttendantSelected = $("#housekeeping-attendant-selected");
 const housekeepingAttendantChange = $("#housekeeping-attendant-change");
 const housekeepingPreviewAction = $("#housekeeping-preview");
 const housekeepingSheetMessage = $("#housekeeping-sheet-message");
 const housekeepingSheetPreviewPanel = $("#housekeeping-sheet-preview");
 const housekeepingPreviewCount = $("#housekeeping-preview-count");
 const housekeepingPreviewRooms = $("#housekeeping-preview-rooms");
 const housekeepingGenerateCopy = $("#housekeeping-generate-copy");
 const housekeepingGenerate = $("#housekeeping-generate");
 const housekeepingSheetList = $("#housekeeping-sheet-list");
 const vehiclesView = $("#vehicles-view");
 const vehiclesRefresh = $("#vehicles-refresh");
 const vehicleRegister = $(".vehicle-register");
 const vehicleSearchForm = $("#vehicle-search-form");
 const vehicleRegistration = $("#vehicle-registration");
 const vehicleSearchClear = $("#vehicle-search-clear");
 const vehicleResultSummary = $("#vehicle-result-summary");
 const vehicleRegisterLoading = $("#vehicle-register-loading");
 const vehicleRegisterError = $("#vehicle-register-error");
 const vehicleRegisterRetry = $("#vehicle-register-retry");
 const vehicleRegisterEmpty = $("#vehicle-register-empty");
 const vehicleRegisterList = $("#vehicle-register-list");
 const vehicleRegisterNext = $("#vehicle-register-next");
 const inventoryView = $("#inventory-view");
 const restrictionsView = $("#restrictions-view");
 const ratesView = $("#rates-view");
 const operationsView = $("#operations-view");
 const reservationsView = $("#reservations-view");
 const foliosView = $("#folios-view");
 const cashiersView = $("#cashiers-view");
 const statusView = $("#status-view");
 const dayCloseView = $("#day-close-view");
 const dayCloseWorkbench = $("#day-close-workbench");
 const dayCloseRefresh = $("#day-close-refresh");
 const dayCloseDate = $("#day-close-date");
 const dayCloseLoading = $("#day-close-loading");
 const dayCloseError = $("#day-close-error");
 const dayCloseRetry = $("#day-close-retry");
 const dayCloseContent = $("#day-close-content");
 const dayCloseSelected = $("#day-close-selected");
 const dayCloseCurrent = $("#day-close-current");
 const dayCloseReady = $("#day-close-ready");
 const dayCloseOutboxLag = $("#day-close-outbox-lag");
 const dayCloseReasons = $("#day-close-reasons");
 const dayCloseCandidates = $("#day-close-candidates");
 const dayCloseStatus = $("#day-close-status");
 const dayCloseSeal = $("#day-close-seal");
 const dayCloseSealOpen = $("#day-close-seal-open");
 const dayCloseSealDialog = $("#day-close-seal-dialog");
 const dayCloseSealForm = $("#day-close-seal-form");
 const dayCloseSealCancel = $("#day-close-seal-cancel");
 const dayCloseSealConfirm = $("#day-close-seal-confirm");
 const dayCloseSealDialogDate = $("#day-close-seal-dialog-date");
 const trustView = $("#trust-view");
 const trustWorkbench = $("#trust-workbench");
 const trustRefresh = $("#trust-refresh");
 const trustExpenseForm = $("#trust-expense-form");
 const trustAccount = $("#trust-account");
 const trustAmount = $("#trust-amount");
 const trustReason = $("#trust-reason");
 const trustPreviewAction = $("#trust-preview-action");
 const trustRequestApproval = $("#trust-request-approval");
 const trustPost = $("#trust-post");
 const trustMessage = $("#trust-message");
 const trustPreviewTitle = $("#trust-preview-title");
 const trustPreviewFacts = $("#trust-preview-facts");
 const trustInboxRefresh = $("#trust-inbox-refresh");
 const trustApprovalInbox = $("#trust-approval-inbox");
 const trustInboxMore = $("#trust-inbox-more");
 let trustAccounts = [], trustPreviewData = null, trustApprovals = [], trustApprovalCursor = null;
 let trustRequestGeneration = 0;
 const trustMutationKeys = new Map();
 let dayCloseSealDraft = null;
 let dayCloseSealAttempt = null;
 const dayCloseCarryKeys = new Map();
 let dayCloseApprovalGeneration = 0;
 const dayCloseApprovals = node("section", "card day-close-approvals");
 dayCloseApprovals.setAttribute("aria-labelledby", "day-close-approvals-title");
 const dayCloseApprovalsTitle = node("h3", "", "Discrepancy carry approvals");
 dayCloseApprovalsTitle.id = "day-close-approvals-title";
 dayCloseApprovalsTitle.tabIndex = -1;
 const dayCloseApprovalList = node("ul", "day-close-approval-list");
 const dayCloseApprovalRefresh = node("button", "secondary", "Refresh approvals");
 dayCloseApprovalRefresh.type = "button";
 dayCloseApprovals.append(dayCloseApprovalsTitle, dayCloseApprovalRefresh, dayCloseApprovalList);
 dayCloseContent.append(dayCloseApprovals);
 const dayCloseCarryDialog = document.createElement("dialog"); dayCloseCarryDialog.className = "day-close-carry-dialog";
 const dayCloseCarryForm = document.createElement("form"); dayCloseCarryForm.method = "dialog";
 const dayCloseCarryLabel = node("label", "", "Reason for carrying this discrepancy");
 const dayCloseCarryReason = document.createElement("textarea"); dayCloseCarryReason.required = true; dayCloseCarryReason.maxLength = 500;
 dayCloseCarryReason.setAttribute("aria-describedby", "day-close-carry-help"); dayCloseCarryLabel.append(dayCloseCarryReason);
 const dayCloseCarryHelp = node("p", "muted", "Required. 1–500 UTF-8 bytes."); dayCloseCarryHelp.id = "day-close-carry-help";
 const dayCloseCarryCancel = node("button", "secondary", "Cancel"); dayCloseCarryCancel.type = "button";
 const dayCloseCarrySubmit = node("button", "primary", "Request approval"); dayCloseCarrySubmit.type = "submit";
 dayCloseCarryForm.append(node("h3", "", "Request discrepancy carry approval"), dayCloseCarryLabel, dayCloseCarryHelp, dayCloseCarryCancel, dayCloseCarrySubmit);
 dayCloseCarryDialog.append(dayCloseCarryForm); document.body.append(dayCloseCarryDialog);
 let dayCloseCarryDraft = null;
 dayCloseCarryCancel.addEventListener("click", () => { dayCloseCarryDraft = null; dayCloseCarryDialog.close(); });
 dayCloseCarryForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const draft = dayCloseCarryDraft; if (!draft) return;
  const reason = dayCloseCarryReason.value.trim().normalize("NFC");
  if (!reason || new TextEncoder().encode(reason).length > 500) { dayCloseCarryHelp.textContent = "Enter 1–500 UTF-8 bytes."; dayCloseCarryReason.focus(); return; }
  const identity = `request:${draft.candidate.discrepancyId}`; const key = dayCloseCarryKeys.get(identity) || crypto.randomUUID(); dayCloseCarryKeys.set(identity, key);
  dayCloseCarrySubmit.disabled = true;
  try { await request(`/api/v1/properties/${enc(propertySelect.value)}/business-days/${enc(draft.selected)}/close-workbench/carry-candidates/${enc(draft.candidate.discrepancyId)}/approvals`,
    { method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify({ reason }) });
    dayCloseCarryKeys.delete(identity); dayCloseCarryDraft = null; dayCloseCarryDialog.close(); await loadDayCloseWorkbench({ businessDate: draft.selected, focus: true });
  } catch (error) { dayCloseStatus.textContent = error instanceof Error ? error.message : "Approval request outcome is unknown; retry uses the same key."; dayCloseCarryReason.focus(); }
  finally { dayCloseCarrySubmit.disabled = false; }
 });
 let dayCloseRequestGeneration = 0;
 const cashierRefresh = $("#cashier-refresh");
 const cashierLoading = $("#cashier-loading");
 const cashierError = $("#cashier-error");
 const cashierRetry = $("#cashier-retry");
 const cashierWorkbench = $("#cashier-workbench");
 const cashierDrawer = $("#cashier-drawer");
 const cashierDrawerName = $("#cashier-drawer-name");
 const cashierCurrency = $("#cashier-currency");
 const cashierSessionState = $("#cashier-session-state");
 const cashierCountState = $("#cashier-count-state");
 const cashierSessionSummary = $("#cashier-session-summary");
 const cashierOpenPanel = $("#cashier-open-panel");
 const cashierOpenForm = $("#cashier-open-form");
 const cashierOpenFields = $("#cashier-open-fields");
 const cashierOpenDenominations = $("#cashier-open-denominations");
 const cashierOpenConfirm = $("#cashier-open-confirm");
 const cashierOpenSubmit = $("#cashier-open-submit");
 const cashierCountPanel = $("#cashier-count-panel");
 const cashierCountForm = $("#cashier-count-form");
 const cashierCountFields = $("#cashier-count-fields");
 const cashierCountDenominations = $("#cashier-count-denominations");
 const cashierCountConfirm = $("#cashier-count-confirm");
 const cashierCountSubmit = $("#cashier-count-submit");
 const cashierClosePanel = $("#cashier-close-panel");
 const cashierCloseForm = $("#cashier-close-form");
 const cashierCloseReason = $("#cashier-close-reason");
 const cashierCloseApproval = $("#cashier-close-approval");
 const cashierCloseConfirm = $("#cashier-close-confirm");
 const cashierCloseSubmit = $("#cashier-close-submit");
 const cashierSupervisedClose = $("#cashier-supervised-close");
 const cashierApprovalRequest = $("#cashier-approval-request");
 const cashierSupervisedApprovalRequest = $("#cashier-supervised-approval-request");
 const cashierApprovalApprove = $("#cashier-approval-approve");
 const cashierApprovalReject = $("#cashier-approval-reject");
 const cashierCloseCopy = $("#cashier-close-copy");
 const cashierEvidence = $("#cashier-evidence");
 const cashierEvidenceList = $("#cashier-evidence-list");
 const navigation = document.querySelectorAll(".domain-tab,.day-close-nav");
 const managementJourneyControls = document.querySelectorAll("[data-journey-view]");
 const refreshInventory = $("#refresh-inventory");
 const inventoryStatus = $("#inventory-status");
 const unitTypeList = $("#unit-type-list");
 const spaceList = $("#space-list");
 const sellableList = $("#sellable-list");
 const unitTypeCount = $("#unit-type-count");
 const spaceCount = $("#space-count");
 const sellableCount = $("#sellable-count");
 const unitTypeForm = $("#unit-type-form");
 const spaceForm = $("#space-form");
 const sellableForm = $("#sellable-unit-form");
 const sellableUnitType = $("#sellable-unit-type");
 const sellableSpace = $("#sellable-space");
 const bulkRoomForm = $("#bulk-room-form");
 const bulkRoomUnitType = $("#bulk-room-unit-type");
 const bulkRoomMode = $("#bulk-room-mode");
 const bulkRoomRangeFields = $("#bulk-room-range-fields");
 const bulkRoomPasteFields = $("#bulk-room-paste-fields");
 const bulkRoomPreview = $("#bulk-room-preview");
 const bulkRoomCount = $("#bulk-room-count");
 const bulkRoomRefreshPreview = $("#bulk-room-refresh-preview");
 const projectionForm = $("#projection-rebuild-form");
 const projectionSummary = $("#projection-summary");
 const refreshProjection = $("#refresh-projection");
 const refreshRestrictions = $("#refresh-restrictions");
 const restrictionStatus = $("#restriction-status");
 const restrictionList = $("#restriction-list");
 const restrictionCount = $("#restriction-count");
 const restrictionForm = $("#restriction-form");
 const restrictionKind = $("#restriction-kind");
 const restrictionValueField = $("#restriction-value-field");
 const restrictionValueLabel = $("#restriction-value-label");
 const restrictionUnitType = $("#restriction-unit-type");
 const restrictionSemantics = $("#restriction-semantics");
 const refreshRates = $("#refresh-rates");
 const ratesStatus = $("#rates-status");
 const policyCount = $("#policy-count");
 const ratePlanCount = $("#rate-plan-count");
 const policyList = $("#policy-list");
 const ratePlanList = $("#rate-plan-list");
 const policyForm = $("#policy-form");
 const ratePlanForm = $("#rate-plan-form");
 const policyKind = $("#policy-kind");
 const cancellationPolicyFields = $("#cancellation-policy-fields");
 const depositPolicyFields = $("#deposit-policy-fields");
 const guaranteePolicyFields = $("#guarantee-policy-fields");
 const noShowPolicyFields = $("#no-show-policy-fields");
 const depositBasis = $("#deposit-basis");
 const depositDue = $("#deposit-due");
 const depositValueField = $("#deposit-value-field");
 const depositDaysField = $("#deposit-days-field");
 const planCancellationPolicy = $("#plan-cancellation-policy");
 const planGuaranteePolicy = $("#plan-guarantee-policy");
 const planDepositPolicy = $("#plan-deposit-policy");
 const builderPlan = $("#builder-plan");
 const builderModeSelect = $("#builder-mode-select");
 const builderModeRadios = document.querySelectorAll('input[name="builder-mode"]');
 const builderAiPanel = $("#builder-ai-panel");
 const builderAiIntent = $("#builder-ai-intent");
 const builderAiInterpret = $("#builder-ai-interpret");
 const builderAiApply = $("#builder-ai-apply");
 const builderAiStatus = $("#builder-ai-status");
 const builderAiResults = $("#builder-ai-results");
 const builderAiAdapter = $("#builder-ai-adapter");
 const builderAiChanges = $("#builder-ai-changes");
 const builderAiAssumptions = $("#builder-ai-assumptions");
 const builderAiQuestions = $("#builder-ai-questions");
 const builderAiWarnings = $("#builder-ai-warnings");
 const builderAiGuardrails = $("#builder-ai-guardrails");
 const builderSteps = document.querySelectorAll(".builder-step");
 const builderPanels = document.querySelectorAll("[data-builder-panel]");
 const builderModelCatalogue = $("#builder-model-catalogue");
 const builderBaseAmount = $("#builder-base-amount");
 const builderFloor = $("#builder-floor");
 const builderCeiling = $("#builder-ceiling");
 const builderCalendarFields = $("#builder-calendar-fields");
 const builderCalendarCells = $("#builder-calendar-cells");
 const builderReferenceFields = $("#builder-reference-fields");
 const builderReferenceId = $("#builder-reference-id");
 const builderReferenceVersion = $("#builder-reference-version");
 const builderRuleFields = $("#builder-rule-fields");
 const builderAdjustmentKind = $("#builder-adjustment-kind");
 const builderAdjustmentValue = $("#builder-adjustment-value");
 const builderRuleStage = $("#builder-rule-stage");
 const builderRulePriority = $("#builder-rule-priority");
 const builderBarLevel = $("#builder-bar-level");
 const builderBookingWindow = $("#builder-booking-window");
 const builderLos = $("#builder-los");
 const builderOccupancy = $("#builder-occupancy");
 const builderRmsFields = $("#builder-rms-fields");
 const builderRmsKey = $("#builder-rms-key");
 const builderRmsVersion = $("#builder-rms-version");
 const builderRmsAge = $("#builder-rms-age");
 const builderExpertComponents = $("#builder-expert-components");
 const builderComponentGrid = $("#builder-component-grid");
 const builderTargetRuleList = $("#builder-target-rule-list");
 const builderTargetRuleCount = $("#builder-target-rule-count");
 const builderAddTargetRule = $("#builder-add-target-rule");
 const builderStayStart = $("#builder-stay-start");
 const builderStayEnd = $("#builder-stay-end");
 const builderMinAdults = $("#builder-min-adults");
 const builderMaxAdults = $("#builder-max-adults");
 const builderMaxChildren = $("#builder-max-children");
 const builderCancellationPolicy = $("#builder-cancellation-policy");
 const builderDepositPolicy = $("#builder-deposit-policy");
 const builderGuaranteePolicy = $("#builder-guarantee-policy");
 const builderNoShowPolicy = $("#builder-no-show-policy");
 const builderRefundTreatment = $("#builder-refund-treatment");
 const builderPackageCode = $("#builder-package-code");
 const builderPackageAmount = $("#builder-package-amount");
 const builderPackageRhythm = $("#builder-package-rhythm");
 const builderPromotionCode = $("#builder-promotion-code");
 const builderPromotionBps = $("#builder-promotion-bps");
 const builderDistributionMode = $("#builder-distribution-mode");
 const builderDistributionChannels = $("#builder-distribution-channels");
 const builderExpertJsonGroup = $("#builder-expert-json-group");
 const builderExpertJson = $("#builder-expert-json");
 const builderRefreshJson = $("#builder-refresh-json");
 const builderCommandPreview = $("#builder-command-preview");
 const builderSaveDraft = $("#builder-save-draft");
 const builderPreviewDates = $("#builder-preview-dates");
 const builderRunPreview = $("#builder-run-preview");
 const builderRequestApproval = $("#builder-request-approval");
 const builderApprovalInbox = $("#builder-approval-inbox");
 const builderRefreshApprovals = $("#builder-refresh-approvals");
 const builderLoadMoreApprovals = $("#builder-load-more-approvals");
 const builderSelectedApproval = $("#builder-selected-approval");
 const builderPublish = $("#builder-publish");
 const builderSimulationOutput = $("#builder-simulation");
 const builderSimulationCells = $("#builder-simulation-cells");
 const builderRefreshHistory = $("#builder-refresh-history");
 const builderReleaseHistory = $("#builder-release-history");
 const builderQuoteSellable = $("#builder-quote-sellable");
 const builderQuoteStart = $("#builder-quote-start");
 const builderQuoteEnd = $("#builder-quote-end");
 const builderLiveQuote = $("#builder-live-quote");
 const builderQuoteResult = $("#builder-quote-result");
 const builderMessage = $("#builder-message");
 const builderPrevious = $("#builder-previous");
 const builderNext = $("#builder-next");
 const ratePriceForm = $("#rate-price-form");
 const currentPriceForm = $("#current-price-form");
 const priceRatePlan = $("#price-rate-plan");
 const priceUnitType = $("#price-unit-type");
 const currentPricePlan = $("#current-price-plan");
 const currentPriceUnitType = $("#current-price-unit-type");
 const createTierList = $("#create-tier-list");
 const addCreateTier = $("#add-create-tier");
 const createExtraAdult = $("#create-extra-adult");
 const createChildList = $("#create-child-list");
 const addCreateChild = $("#add-create-child");
 const currentPriceResult = $("#current-price-result");
 const loadPriceCorrectionButton = $("#load-price-correction");
 const rateCorrectionForm = $("#rate-correction-form");
 const correctionKeySummary = $("#correction-key-summary");
 const correctionTierList = $("#correction-tier-list");
 const addCorrectionTier = $("#add-correction-tier");
 const correctionExtraAdult = $("#correction-extra-adult");
 const correctionChildList = $("#correction-child-list");
 const addCorrectionChild = $("#add-correction-child");
 const refreshOperationalBlocks = $("#refresh-operational-blocks");
 const operationalBlockStatus = $("#operational-block-status");
 const operationalBlockCount = $("#operational-block-count");
 const activeBlockList = $("#active-block-list");
 const operationalBlockForm = $("#operational-block-form");
 const operationalBlockSpace = $("#operational-block-space");
 const operationalBlockKind = $("#operational-block-kind");
 const oosPolicyForm = $("#oos-policy-form");
 const oosSellability = $("#oos-sellability");
 const refreshHolds = $("#refresh-holds");
 const activeHoldList = $("#active-hold-list");
 const holdStatus = $("#hold-status");
 const offlineLeaseForm = $("#offline-lease-form");
 const offlineLeaseSellable = $("#offline-lease-sellable");
 const offlineLeaseList = $("#offline-lease-list");
 const offlineLeaseStatus = $("#offline-lease-status");
 const refreshOfflineLeases = $("#refresh-offline-leases");
 const refreshStatus = $("#refresh-status");
 const roadmapProgress = $("#roadmap-progress");
 const reviewProgress = $("#review-progress");
 const statusOrder = $("#status-order");
 const statusReviewed = document.querySelector("#status-reviewed");
 const statusReferee = $("#status-referee");
 const statusRecordedAt = $("#status-recorded-at");
 const statusRoadmapCopy = $("#status-roadmap-copy");
 const statusReviewCopy = $("#status-review-copy");
 const statusPhaseList = $("#status-phase-list");
 const statusCurrentWork = document.querySelector("#status-current-work");
 const statusHealthGrid = $("#status-health-grid");
 const statusMessage = $("#status-message");
 const reservationLookupForm = $("#reservation-lookup-form");
 const reservationGuestForm = $("#reservation-guest-form");
 const reservationConfirmation = $("#reservation-confirmation");
 const reservationStatus = $("#reservation-status");
 const reservationPrimaryParty = $("#reservation-primary-party");
 const reservationPrimaryShare = $("#reservation-primary-share");
 const reservationGuestList = $("#reservation-guest-list");
 const reservationShareTotal = $("#reservation-share-total");
 const addReservationGuest = $("#add-reservation-guest");
 const reservationGuestHome = reservationGuestForm.parentElement;
 const reservationLifecycleLookupForm = $("#reservation-lifecycle-lookup-form");
 const reservationLifecycleEditor = $("#reservation-lifecycle-editor");
 const lifecycleConfirmation = $("#lifecycle-confirmation");
 const lifecycleStatus = $("#lifecycle-status");
 const lifecycleCommandMessage = $("#lifecycle-command-message");
 const reservationMetadataForm = $("#reservation-metadata-form");
 const reservationCancelForm = $("#reservation-cancel-form");
 const reservationReinstatePanel = $("#reservation-reinstate-panel");
 const reservationReinstate = $("#reservation-reinstate");
 const reservationLifecycleHome = reservationLifecycleEditor.parentElement;
 const reservationSegmentLookupForm = $("#reservation-segment-lookup-form");
 const reservationSegmentEditor = $("#reservation-segment-editor");
 const reservationSegmentHome = reservationSegmentEditor.parentElement;
 const segmentConfirmation = $("#segment-confirmation");
 const segmentReservationStatus = $("#segment-reservation-status");
 const reservationSegmentHistory = $("#reservation-segment-history");
 const segmentCommandMessage = $("#segment-command-message");
 const reservationDepartureForm = $("#reservation-departure-form");
 const reservationRoomMoveForm = $("#reservation-room-move-form");
 const reservationTravelForm = $("#reservation-travel-form");
 const reservationTravelHome = reservationTravelForm.parentElement;
 const reservationTravelConfirmation = $("#reservation-travel-confirmation");
 const reservationTravelStatus = $("#reservation-travel-status");
 const reservationTravelDirection = $("#reservation-travel-direction");
 const reservationTravelFieldsLegend = $("#reservation-travel-fields-legend");
 const reservationTravelPickup = reservationTravelForm.querySelector(".reservation-travel-pickup");
 const reservationTravelBoundary = reservationTravelForm.querySelector(".reservation-travel-boundary");
 const reservationTravelSummary = $("#reservation-travel-summary");
 const reservationBookingForm = $("#reservation-booking-form");
 const reservationBookingOptions = $("#reservation-booking-options");
 const reservationBookingCommit = $("#reservation-booking-commit");
 const reservationOfferRetry = $("#reservation-offer-retry");
 const reservationBookingSelectionText = $("#reservation-booking-selection");
 const reservationBookingHoldText = $("#reservation-booking-hold");
 const reservationBookingHoldAction = $("#reservation-booking-hold-action");
 const reservationBookingDirect = $("#reservation-booking-direct");
 const reservationBookingHeld = $("#reservation-booking-held");
 const reservationBookingMessage = $("#reservation-booking-message");
 const reservationBookingConfirmation = $("#reservation-booking-confirmation");
 const partyProfileSearchForm = $("#party-profile-search-form");
 const partyProfileResults = $("#party-profile-results");
 const partyProfileCreate = $("#party-profile-create");
 const partyProfileCreateForm = $("#party-profile-create-form");
 const partyDuplicateReview = $("#party-duplicate-review");
 const partyDuplicateCandidates = $("#party-duplicate-candidates");
 const partyCreateDistinctConfirm = $("#party-create-distinct-confirm");
 const partyCreateDistinct = $("#party-create-distinct");
 const partyDuplicateMessage = $("#party-duplicate-message");
 const partyProfilePicker = $("#party-profile-picker");
 const partyProfileSelected = $("#party-profile-selected");
 const partyProfileClear = $("#party-profile-clear");
 const reservationBoard = $("#reservation-board");
 const reservationBoardForm = $("#reservation-board-filters");
 const reservationBoardSummary = $("#reservation-board-summary");
 const reservationBoardLoading = $("#reservation-board-loading");
 const reservationBoardError = $("#reservation-board-error");
 const reservationBoardEmpty = $("#reservation-board-empty");
 const reservationBoardContent = $("#reservation-board-content");
 const reservationBoardRowsTarget = $("#reservation-board-rows");
 const reservationBoardCards = $("#reservation-board-cards");
 const reservationBoardMore = $("#reservation-board-more");
 const reservationBoardStatus = $("#reservation-board-status");
 const reservationBoardRetry = $("#reservation-board-retry");
 const reservationFiltersClear = $("#reservation-filters-clear");
 const reservationEmptyClear = $("#reservation-empty-clear");
 const reservationCreateOpen = $("#reservation-create-open");
 const reservationEmptyCreate = $("#reservation-empty-create");
 const reservationCreatePanel = $("#reservation-create-panel");
 const reservationCreateCancel = $("#reservation-create-cancel");
 const reservationCreateSteps = document.querySelectorAll("[data-reservation-create-step]");
 const reservationCreatePanels = document.querySelectorAll("[data-reservation-create-panel]");
 const reservationStayNext = $("#reservation-stay-next");
 const reservationGuestNext = $("#reservation-guest-next");
 const reservationSearchOffers = $("#reservation-search-offers");
 const reservationBackButtons = document.querySelectorAll("[data-reservation-back]");
 const reservationDetailDrawer = $("#reservation-detail-drawer");
 const reservationDetailTitle = $("#reservation-detail-title");
 const reservationDetailClose = $("#reservation-detail-close");
 const reservationDetailLoading = $("#reservation-detail-loading");
 const reservationDetailError = $("#reservation-detail-error");
 const reservationDetailRetry = $("#reservation-detail-retry");
 const reservationDetailContent = $("#reservation-detail-content");
 const reservationDetailFolios = $("#reservation-detail-folios");
 const reservationDetailFolioList = $("#reservation-detail-folio-list");
 const reservationPrimaryFolioCreate = $("#reservation-primary-folio-create");
 const reservationPrimaryFolioMessage = $("#reservation-primary-folio-message");
 const reservationDetailActions = $("#reservation-detail-actions");
 const reservationDetailStatus = $("#reservation-detail-status");
 const checkInWorkbench = $("#checkin-workbench");
 const checkInHeading = $("#checkin-workbench-heading");
 const checkInBadge = $("#checkin-readiness-badge");
 const checkInSummary = $("#checkin-readiness-summary");
 const checkInBlockers = $("#checkin-blockers");
 const checkInHousekeepingAction = $("#checkin-housekeeping-action");
 const dueInRoomAssignment = $("#checkin-room-assignment");
 const dueInRoomAssignmentHeading = $("#checkin-room-assignment-heading");
 const dueInRoomAssignmentForm = $("#checkin-room-assignment-form");
 const dueInRoomAssignmentCandidates = $("#checkin-room-assignment-candidates");
 const dueInRoomAssignmentSubmit = $("#checkin-room-assignment-submit");
 const dueInRoomAssignmentRefresh = $("#checkin-room-assignment-refresh");
 const dueInRoomAssignmentClose = $("#checkin-room-assignment-close");
 const dueInRoomAssignmentMessage = $("#checkin-room-assignment-message");
 const checkInForm = $("#checkin-form");
 const checkInOverrideLabel = $("#checkin-override-label");
 const checkInOverrideReason = $("#checkin-override-reason");
 const checkInOverrideNote = $("#checkin-override-note");
 const checkInConfirm = $("#checkin-confirm");
 const checkInSubmit = $("#checkin-submit");
 const checkInRefresh = $("#checkin-refresh");
 const checkInMessage = $("#checkin-message");
 const departureWorkbench = $("#reservation-departure-workbench");
 const departureHeading = $("#departure-readiness-heading");
 const departureBadge = $("#departure-readiness-badge");
 const departureSummary = $("#departure-readiness-summary");
 const departureError = $("#departure-readiness-error");
 const departureContent = $("#departure-readiness-content");
 const departureEvidence = $("#departure-readiness-evidence");
 const departureBlockerPanel = departureWorkbench.querySelector(".departure-blocker-panel");
 const departureBlockers = $("#departure-blockers");
 const departureFolioCount = $("#departure-folio-count");
 const departureFolioList = $("#departure-folio-list");
 const departureCheckoutForm = $("#checkout-command-form");
 const departureCheckoutConfirm = $("#checkout-command-confirm");
 const departureCheckoutSubmit = $("#checkout-command-submit");
 const departureRefresh = $("#departure-readiness-refresh");
 const departureRetry = $("#departure-readiness-retry");
 const departureMessage = $("#departure-readiness-message");
 const folioStatementLookupForm = $("#folio-statement-lookup-form");
 const folioFindViaReservation = $("#folio-find-via-reservation");
 const folioWorkspace = $("#folio-workspace");
 const folioWorkspaceTitle = $("#folio-workspace-title");
 const folioWorkspaceBack = $("#folio-workspace-back");
 const operationStatus = $("#operation-status");
 const folioWindowTabs = $("#folio-window-tabs");
 const folioWindowNew = $("#folio-window-new");
 const folioWindowNewForm = $("#folio-window-new-form");
 const folioWindowNewCancel = $("#folio-window-new-cancel");
 const tabs = [...$("#folio-workspace-tabs").children].map(t=>[t.id.slice(10),t]);
 const folioOrganizeForm = $("#folio-organize-form");
 const folioOrganizeFields = $("#folio-organize-fields");
 const folioOrganizeGroups = $("#folio-organize-groups");
 const folioOrganizeDestination = $("#folio-organize-destination");
 const folioOrganizeNewWindowName = $("#folio-organize-new-window-name");
 const folioOrganizeReason = $("#folio-organize-reason");
 const folioOrganizePreview = $("#folio-organize-preview");
 const folioOrganizePreviewSubmit = $("#folio-organize-preview-submit");
 const folioOrganizeAcknowledgement = $("#folio-organize-acknowledgement");
 const folioOrganizeSubmit = $("#folio-organize-submit");
 const receivableTransferForm = $("#receivable-transfer-workbench");
 const receivableTransferFields = $("#receivable-transfer-fields");
 const receivableTransferAccount = $("#receivable-transfer-account");
 const receivableTransferReason = $("#receivable-transfer-reason");
 const receivableTransferAvailability = $("#receivable-transfer-availability");
 const receivableTransferPreviewSubmit = $("#receivable-transfer-preview-submit");
 const receivableTransferPreview = $("#receivable-transfer-preview");
 const receivableTransferApprovalActions = $("#receivable-transfer-approval-actions");
 const receivableTransferApprovalRequest = $("#receivable-transfer-approval-request");
 const receivableTransferApprovalApprove = $("#receivable-transfer-approval-approve");
 const receivableTransferApprovalReject = $("#receivable-transfer-approval-reject");
 const receivableTransferConfirm = $("#receivable-transfer-confirm");
 const receivableTransferSubmit = $("#receivable-transfer-submit");
 const folioCorrectionPanel = $("#folio-correction-panel");
 const folioStatementLoading = $("#folio-statement-loading");
 const folioStatementError = $("#folio-statement-error");
 const folioStatementRetry = $("#folio-statement-retry");
 const folioStatement = $("#folio-statement");
 const folioStatementTitle = $("#folio-statement-title");
 const folioWindow = $("#folio-window");
 const folioStatus = $("#folio-status");
 const folioCurrency = $("#folio-currency");
 const folioBalance = $("#folio-balance");
 const folioLineCount = $("#folio-line-count");
 const folioSettlementPanel = $("#folio-settlement-panel");
 const folioSettlementHeading = $("#folio-settlement-heading");
 const folioSettlementCopy = $("#folio-settlement-copy");
 const folioSettlementState = $("#folio-settlement-state");
 const folioSettlementBalance = $("#folio-settlement-balance");
 const folioSettlementAction = $("#folio-settlement-action");
 const folioSettlementStatus = $("#folio-settlement-status");
 const folioStayTotal = $("#folio-stay-total");
 const folioActiveTotal = $("#folio-active-total");
 const folioAccountCurrency = $("#folio-account-currency");
 const folioWindowCount = $("#folio-window-count");
 const folioStatementRows = $("#folio-statement-rows");
 const folioStatementCards = $("#folio-statement-cards");
 const folioLoadOlder = $("#folio-load-older");
 const folioPageStatus = $("#folio-page-status");
 const folioError = $("#folio-error");
 const folioChargeForm = $("#folio-charge-form");
 const folioChargeFields = $("#folio-charge-fields");
 const folioChargeCode = $("#folio-charge-code");
 const folioChargeConfirm = $("#folio-charge-confirm");
 const folioChargeSubmit = $("#folio-charge-submit");
 const folioChargeAvailability = $("#folio-charge-availability");
 const folioCorrectionForm = $("#folio-correction-form");
 const folioCorrectionFields = $("#folio-correction-fields");
 const folioCorrectionHeading = $("#folio-correction-heading");
 const folioCorrectionReason = $("#folio-correction-reason");
 const folioCorrectionConfirm = $("#folio-correction-confirm");
 const folioCorrectionSubmit = $("#folio-correction-submit");
 const folioCorrectionCancel = $("#folio-correction-cancel");
 const folioCorrectionCurrency = $("#folio-correction-currency");
 const folioCorrectionOriginal = $("#folio-correction-original");
 const folioCorrectionEffect = $("#folio-correction-effect");
 const folioCorrectionBalance = $("#folio-correction-balance");
 const folioCorrectionExpected = $("#folio-correction-expected");
 const SYSTEM_STATUS_SUFFIX = "/system-status";
 const MAX_MINOR = BigInt("9223372036854775807");
 const THEMES = new Set(["apple", "android", "win95", "glass", "neo", "erp"]);
 const WORKSPACE_SKINS = new Set(["calm", "precision", "timeline"]);
 const EXPERIENCES = new Set(["simple", "advanced", "expert"]);
 const SECONDARY_VIEWS = new Set(["operations", "housekeeping", "vehicles", "inventory", "restrictions", "rates", "status"]);
  function motionPreference(query) {
 return typeof window.matchMedia === "function" ? window.matchMedia(query) : { matches: true, addEventListener() {} };
 }
 const reducedMotion = motionPreference("(prefers-reduced-motion: reduce)");
 const coarsePointer = motionPreference("(pointer: coarse)");
 const forcedColours = motionPreference("(forced-colors: active)");
 let motionSequence = 0;
 let activeMotion = null;
  function cancelWorkspaceMotion(commit = false) {
 motionSequence += 1;
 const motion = activeMotion;
 activeMotion = null;
 if (!motion) return;
 if (commit) motion.commit();
 motion.cancel();
 }
  function workspaceMotionAllowed(nextTheme) {
 const supportsBackdrop = nextTheme !== "glass" || (typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" && (CSS.supports("backdrop-filter", "blur(2px)") ||
  CSS.supports("-webkit-backdrop-filter", "blur(2px)")));
 return !workbenchView.hidden && document.visibilityState === "visible" &&
  !reducedMotion.matches && !coarsePointer.matches && !forcedColours.matches && supportsBackdrop;
 }
  function animateWorkspaceFallback(duration, sequence, commit) {
 commit();
 if (typeof workbenchView.animate !== "function") return;
 const animation = workbenchView.animate([
  { opacity: 0.72, transform: "translate3d(0, 8px, 0) scale(.995)" },
  { opacity: 1, transform: "none" },
 ], { duration, easing: "cubic-bezier(.2, .8, .2, 1)" });
 activeMotion = {
  commit,
  cancel() { animation.cancel(); },
 };
 animation.finished.catch(() => {}).finally(() => {
  if (sequence === motionSequence) activeMotion = null;
 });
 }
  function transitionWorkspace(change, { duration = 280, nextTheme = document.documentElement.dataset.theme } = {}) {
 cancelWorkspaceMotion();
 const sequence = motionSequence;
 const boundedDuration = Math.min(400, Math.max(0, duration));
 let committed = false;
 const commit = () => {
  if (committed) return;
  committed = true;
  change();
 };
 if (!workspaceMotionAllowed(nextTheme)) {
  commit();
  return;
 }
 if (typeof document.startViewTransition !== "function") {
  animateWorkspaceFallback(boundedDuration, sequence, commit);
  return;
 }
 const rootTransitionName = document.documentElement.style.viewTransitionName;
 const workspaceTransitionName = workbenchView.style.viewTransitionName;
 document.documentElement.style.viewTransitionName = "none";
 workbenchView.style.viewTransitionName = "yellow-workspace";
 let cleaned = false;
 const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  document.documentElement.style.viewTransitionName = rootTransitionName;
  workbenchView.style.viewTransitionName = workspaceTransitionName;
 };
 try {
  const transition = document.startViewTransition(() => {
  if (sequence === motionSequence) commit();
  });
  activeMotion = {
  commit,
  cancel() {
   transition.skipTransition?.();
   cleanup();
  },
  };
  transition.ready.then(() => {
  if (sequence !== motionSequence || typeof document.getAnimations !== "function") return;
  for (const animation of document.getAnimations()) {
   const pseudo = animation.effect?.pseudoElement ?? "";
   if (pseudo.startsWith("::view-transition")) animation.effect.updateTiming({ duration: boundedDuration });
  }
  }).catch(() => {});
  transition.updateCallbackDone.catch(() => {
  if (sequence === motionSequence) commit();
  });
  transition.finished.catch(() => {}).finally(() => {
  cleanup();
  if (sequence === motionSequence) activeMotion = null;
  });
 } catch {
  cleanup();
  animateWorkspaceFallback(boundedDuration, sequence, commit);
 }
 }
  function applyTheme(theme) {
 const next = THEMES.has(theme) ? theme : "apple";
 document.documentElement.dataset.theme = next;
 themeSelect.value = next;
 }
  function applyExperience(experience, { preserveActive = true } = {}) {
 const next = EXPERIENCES.has(experience) ? experience : "simple";
 const keepSecondaryOpen = preserveActive && SECONDARY_VIEWS.has(activeView);
 document.documentElement.dataset.experience = next;
 experienceSelect.value = next;
 secondaryWorkspacesToggle.hidden = next !== "simple";
 secondaryWorkspaces.hidden = next === "simple" && !keepSecondaryOpen;
 secondaryWorkspacesToggle.setAttribute("aria-expanded", String(!secondaryWorkspaces.hidden));
 secondaryWorkspacesToggle.textContent = secondaryWorkspaces.hidden ? "More workspaces" : "Fewer workspaces";
 }
  function applyWorkspaceSkin(skin) {
 // Presentation only: keep the mounted workspace, draft and request identity intact.
 // The choice lasts for this page session, just like the existing appearance choice.
 const next = WORKSPACE_SKINS.has(skin) ? skin : "calm";
 document.documentElement.dataset.workspaceSkin = next;
 workspaceSkinSelect.value = next;
 }
  function localInputValue(date) {
 const offset = date.getTimezoneOffset() * 60_000;
 return new Date(date.getTime() - offset).toISOString().slice(0, 16);
 }
  function utcInstantInputValue(instant) {
 const date = new Date(instant);
 if (!Number.isFinite(date.getTime())) throw new Error("Server returned an invalid segment instant.");
 return date.toISOString().slice(0, 23);
 }
  function initializeDates() {
 const from = new Date();
 from.setDate(from.getDate() + 1);
 from.setHours(15, 0, 0, 0);
 const to = new Date(from);
 to.setDate(to.getDate() + 2);
 availabilityForm.elements.from.value = localInputValue(from);
 availabilityForm.elements.to.value = localInputValue(to);
 reservationBookingForm.elements.from.value = utcInstantInputValue(from);
 reservationBookingForm.elements.to.value = utcInstantInputValue(to);
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
  function resetReservationStayDates() {
 const from = new Date();
 from.setDate(from.getDate() + 1);
 from.setHours(15, 0, 0, 0);
 const to = new Date(from);
 to.setDate(to.getDate() + 2);
 reservationBookingForm.elements.from.value = utcInstantInputValue(from);
 reservationBookingForm.elements.to.value = utcInstantInputValue(to);
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
  const error = new Error(message);
  error.status = response.status;
  error.problem = body;
  throw error;
 }
 return body;
 }
  function setLoginMessage(message, isError = false) {
 loginMessage.textContent = message;
 loginMessage.classList.toggle("error", isError);
 }
  function restoreLocalLoginDefaults() {
 const event = new Event("yellow:restore-local-login-defaults", { cancelable: true });
 if (loginForm.dispatchEvent(event)) loginForm.elements.password.value = "";
 }
  function showLogin() {
 closeReservationPickupTaskDetail({ history: false, restoreFocus: false });
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
 reservationGuestData = null;
 reservationLifecycleData = null;
 reservationSegmentData = null;
 reservationBookingOffers = [];
 reservationBookingSelection = null;
 reservationBookingHold = null;
 reservationBookingDraft = null;
 reservationBookingSearchGeneration += 1;
 reservationBoardGeneration += 1;
 reservationDetailGeneration += 1;
 housekeepingGeneration += 1;
 housekeepingRequestGeneration += 1;
 housekeepingData = [];
 housekeepingReturnFocus = "";
 clearHousekeepingTaskDetailState();
 housekeepingAttempts.clear();
 housekeepingTaskDetailAttempts.clear();
 clearHousekeepingSheetState();
 clearVehicleRegisterState();
 vehicleLinkedReservationReturn = null;
 vehicleRegisterLinkedReservationReturn = null;
 reservationBoardRows = [];
 reservationBoardNextCursor = null;
 reservationRouteReservationId = "";
 currentReservationWorkbench = null;
 reservationOperationalPreparationReturn = null;
 checkInHousekeepingReturn = null;
 if (housekeepingArrivalReturnAction) housekeepingArrivalReturnAction.hidden = true;
 checkoutHousekeepingCompletion = null;
 checkoutHousekeepingActionOrigin = null;
 checkoutHousekeepingReturn = null;
 clearCheckoutHousekeepingReturnControl();
 reservationPrimaryFolioAttemptKey = "";
 reservationPrimaryFolioReservationId = "";
 reservationDrawerReturnView = "";
 reservationDrawerReturnReservationId = "";
 todayReturnFocus = { reservationId: "", cycle: 0 };
 resetTodayState();
 reservationCreateDirty = false;
 clearPartyProfileState();
 clearFolioState();
 cashierGeneration += 1;
 cashierData = null;
 cashierDrawerId = "";
 cashierLatestEvidence = null;
 clearReservationDrawerLifecycle();
 reservationGuestForm.hidden = true;
 reservationLifecycleEditor.hidden = true;
 reservationSegmentEditor.hidden = true;
 reservationBookingCommit.hidden = true;
 reservationBookingOptions.replaceChildren();
 reservationGuestList.replaceChildren();
 loadPriceCorrectionButton.hidden = true;
 rateCorrectionForm.hidden = true;
 trustRequestGeneration += 1; trustAccounts = []; trustApprovals = []; trustApprovalCursor = null; trustMutationKeys.clear(); clearTrustPreview();
 pendingKeys.clear();
 history.replaceState(null, "", "/");
 applyExperience("simple", { preserveActive: false });
 restoreLocalLoginDefaults();
 loginForm.elements.email.focus();
 }
  async function loadProperties() {
 const body = await request("/api/v1/me/properties");
 propertiesData = body.properties;
 propertySelect.replaceChildren();
 for (const property of body.properties) {
  const option = el("option");
  option.value = property.id;
  option.textContent = `${property.name} · ${property.timezone}`;
  propertySelect.append(option);
 }
 if (body.properties.length === 0) {
  const option = node("option", "", "No granted properties");
  option.value = "";
  propertySelect.append(option);
  propertySelect.disabled = true;
 } else {
  propertySelect.disabled = false;
  const pathProperty = location.pathname.match(/^\/p\/([0-9a-f-]+)\/(?:today|availability|inventory|operations|housekeeping(?:\/tasks\/[0-9a-f-]+)?|vehicles(?:\/[0-9a-f-]+)?|reservations|folios|cashiers|day-close|trust|restrictions|rates|status|res\/[0-9a-f-]+(?:\/pickup-task\/[0-9a-f-]+)?|folio\/[0-9a-f-]+)$/)?.[1];
  if (pathProperty && body.properties.some(({ id }) => id === pathProperty)) propertySelect.value = pathProperty;
 }
 }
  function showWorkbench() {
 loginView.hidden = true;
 workbenchView.hidden = false;
 sessionState.textContent = `${operator.displayName} · authenticated`;
 operatorName.textContent = `Signed in as ${operator.displayName}. Results come from live tenant-scoped PostgreSQL truth.`;
 propertySelect.focus();
 if (location.pathname === "/" && propertySelect.value) {
  history.replaceState({}, "", `/p/${enc(propertySelect.value)}/today`);
 }
 setView(activeView, false);
 }
  function emptyList(container, message) {
 const item = node("p", "list-empty", message);
 container.replaceChildren(item);
 }
 const reservationStatusLabels = Object.freeze({
 quote: "Quote", reserved: "Reserved", waitlist: "Waitlist", due_in: "Due in",
 in_house: "In house", due_out: "Due out", checked_out: "Checked out",
 cancelled: "Cancelled", no_show: "No show",
 });
  function reservationWorkbenchIntent(search) {
 const query = new URLSearchParams(search);
 const keys = [...query.keys()];
 if (keys.length === 0) return { valid: true, value: null };
 const values = query.getAll("workbench");
 if (keys.length === 1 && keys[0] === "workbench" && values.length === 1
  && ["check-in", "checkout"].includes(values[0])) return { valid: true, value: values[0] };
 return { valid: false, value: null };
 }
  function reservationPickupTaskRoute() {
 const match = location.pathname.match(/^\/p\/([0-9a-f-]+)\/res\/([0-9a-f-]+)\/pickup-task\/([0-9a-f-]+)$/);
 return match ? { property: match[1], reservationId: match[2], taskId: match[3] } : null;
 }
  function reservationNavigationRoute() {
 const pickupTask = reservationPickupTaskRoute();
 if (pickupTask) {
  if (location.search) history.replaceState(history.state, "", location.pathname);
  return { kind: "pickup-task", ...pickupTask };
 }
 return reservationRoute();
 }
  function reservationRoute() {
 const detail = location.pathname.match(/^\/p\/([0-9a-f-]+)\/res\/([0-9a-f-]+)$/);
 if (detail) {
  const parsed = reservationWorkbenchIntent(location.search);
  if (!parsed.valid) history.replaceState(history.state, "", `/p/${detail[1]}/res/${detail[2]}`);
  return { kind: "detail", property: detail[1], reservationId: detail[2], workbench: parsed.value };
 }
 const board = location.pathname.match(/^\/p\/([0-9a-f-]+)\/reservations$/);
 if (!board) return { kind: "other" };
 const query = new URLSearchParams(location.search);
 const stepNames = ["stay", "guest", "offer", "review"];
 const requestedStep = stepNames.indexOf(query.get("step") || "stay") + 1;
 return query.get("new") === "1"
  ? { kind: "create", property: board[1], step: requestedStep || 1 }
  : { kind: "board", property: board[1] };
 }
  function reservationDateTime(value) {
 const date = new Date(String(value));
 if (!Number.isFinite(date.getTime())) return "Invalid server date";
 return new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
 }).format(date) + " UTC";
 }
  function reservationStay(row) {
 return `${reservationDateTime(row.stayFrom)} – ${reservationDateTime(row.stayTo)}`;
 }
  function canonicalReservationPickupTaskPath(property, reservationId, taskId) {
 return `/p/${property}/res/${reservationId}/pickup-task/${taskId}`;
 }
 const RESERVATION_PICKUP_TASK_STATUS_LABELS = Object.freeze({
 open: "Open", assigned: "Assigned", in_progress: "In progress", done: "Done",
 verified: "Verified", cancelled: "Cancelled",
 });
 const RESERVATION_PICKUP_TASK_ACTION_LABELS = Object.freeze({
 assign: "Assign pickup", start: "Start pickup", complete: "Complete pickup",
 });
  function reservationPickupTaskCanonicalInstant(value) {
 if (typeof value !== "string" ||
  !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value)) return false;
 return Number.isFinite(Date.parse(value));
 }
  function reservationPickupTaskDetailResult(value, origin) {
 if (!value || typeof value !== "object" || Array.isArray(value) ||
  Object.keys(value).sort().join(",") !== "pickupTask") {
  throw new Error("The server returned an invalid pickup-task detail envelope.");
 }
 const task = value.pickupTask;
 const keys = ["assigneePartyId", "completedAt", "confirmationNo", "createdAt", "dueAt", "eligibleAction", "priority", "reservationId", "status", "taskId"];
 const eligibleAction = task && typeof task === "object" ? task.eligibleAction : undefined;
 const compatibleAction = eligibleAction === null ||
  (eligibleAction === "assign" && task.status === "open" && task.assigneePartyId === null) ||
  (eligibleAction === "start" && task.status === "assigned" && canonicalUuid(String(task.assigneePartyId || ""))) ||
  (eligibleAction === "complete" && task.status === "in_progress" && canonicalUuid(String(task.assigneePartyId || "")));
 if (!task || typeof task !== "object" || Array.isArray(task) ||
  Object.keys(task).sort().join(",") !== keys.join(",") ||
  !canonicalUuid(task.taskId) || task.taskId !== origin.taskId ||
  !canonicalUuid(task.reservationId) || task.reservationId !== origin.reservationId ||
  typeof task.confirmationNo !== "string" || task.confirmationNo !== origin.confirmationNo ||
  task.confirmationNo.length < 1 || task.confirmationNo.length > 120 ||
  !["open", "assigned", "in_progress", "done", "verified", "cancelled"].includes(task.status) ||
  (task.assigneePartyId !== null && !canonicalUuid(String(task.assigneePartyId))) ||
  (eligibleAction !== null && !Object.hasOwn(RESERVATION_PICKUP_TASK_ACTION_LABELS, eligibleAction)) ||
  !compatibleAction ||
  task.priority !== 3 || !reservationPickupTaskCanonicalInstant(task.dueAt) ||
  !reservationPickupTaskCanonicalInstant(task.createdAt) ||
  (task.completedAt !== null && !reservationPickupTaskCanonicalInstant(task.completedAt))) {
  throw new Error("The server returned invalid pickup-task detail.");
 }
 return Object.freeze({ ...task });
 }
  function reservationPickupTaskPanel(reservationId, taskId) {
 for (const existing of reservationDetailDrawer.querySelectorAll(".pickup-task-detail-panel")) existing.remove();
 const panel = node("section", "pickup-task-detail-panel reservation-detail-section");
 panel.hidden = true;
 panel.dataset.reservationId = reservationId;
 panel.dataset.taskId = taskId;
 panel.setAttribute("aria-labelledby", "pickup-task-detail-title");
 panel.setAttribute("aria-busy", "false");
 const head = node("div", "pickup-task-detail-head");
 const titleCopy = el("div");
 titleCopy.append(node("p", "eyebrow", "Arrival transfer"));
 const heading = node("h4", "", "Arrival pickup task");
 heading.id = "pickup-task-detail-title";
 heading.tabIndex = -1;
 titleCopy.append(heading);
 const back = node("button", "quiet pickup-task-detail-back", "Back to reservation");
 back.type = "button";
 back.addEventListener("click", () => closeReservationPickupTaskDetail());
 head.append(titleCopy, back);
 const loading = node("div", "pickup-task-detail-loading");
 loading.setAttribute("aria-hidden", "true");
 loading.append(el("span"), el("span"), el("span"));
 const error = node("section", "pickup-task-detail-error");
 error.hidden = true;
 error.setAttribute("role", "alert");
 const errorCopy = node("p", "", "Pickup task detail is unavailable.");
 const retry = node("button", "secondary pickup-task-detail-retry", "Try again");
 retry.type = "button";
 retry.addEventListener("click", () => {
  const reservation = reservationDetailData?.reservation;
  if (reservation?.reservationId === reservationId && reservationRoutePickupTaskId === taskId) {
  void loadReservationPickupTaskDetail(panel, reservation, taskId, { focus: true });
  }
 });
 error.append(node("strong", "", "Pickup task detail could not be loaded"), errorCopy, retry);
 const content = node("div", "pickup-task-detail-content");
 content.hidden = true;
 panel.append(head, loading, error, content);
 reservationDetailStatus.before(panel);
 return panel;
 }
  function reservationPickupTaskRequestIsCurrent(origin, panel) {
 return origin.requestGeneration === reservationPickupTaskRequestGeneration
  && origin.detailGeneration === reservationDetailGeneration
  && origin.property === propertySelect.value
  && origin.reservationId === reservationRouteReservationId
  && origin.taskId === reservationRoutePickupTaskId
  && reservationDetailData?.reservation?.reservationId === origin.reservationId
  && reservationDetailData.reservation.confirmationNo === origin.confirmationNo
  && reservationDetailDrawer.hidden === false
  && panel.isConnected && panel.classList.contains("pickup-task-detail-panel")
  && panel.dataset.reservationId === origin.reservationId && panel.dataset.taskId === origin.taskId
  && location.pathname === canonicalReservationPickupTaskPath(origin.property, origin.reservationId, origin.taskId);
 }
 function clearReservationPickupTaskActionDraft({ clearAttempts = false } = {}) {
 reservationPickupTaskStaffSearchGeneration += 1;
 reservationPickupTaskStaffSelection = null;
 if (clearAttempts) reservationPickupTaskAttempts.clear();
 }
 function reservationPickupTaskActionIsCurrent(origin, panel, control) {
 const task = reservationPickupTaskData;
 const content = panel?.querySelector(".pickup-task-detail-content");
 return origin.requestGeneration === reservationPickupTaskRequestGeneration &&
  origin.detailGeneration === reservationDetailGeneration && origin.property === propertySelect.value &&
  origin.reservationId === reservationRouteReservationId && origin.taskId === reservationRoutePickupTaskId &&
  origin.confirmationNo === reservationDetailData?.reservation?.confirmationNo &&
  task !== null && task.taskId === origin.taskId && task.reservationId === origin.reservationId &&
  task.confirmationNo === origin.confirmationNo && task.status === origin.taskStatus &&
  task.assigneePartyId === origin.assigneePartyId && task.eligibleAction === origin.action &&
  panel === reservationDetailDrawer.querySelector(".pickup-task-detail-panel") && panel.isConnected &&
  panel.hidden === false && reservationDetailDrawer.hidden === false &&
  reservationDetailDrawer.classList.contains("is-pickup-task-detail") && content?.hidden === false &&
  control?.isConnected && content.contains(control) &&
  control.dataset.taskId === origin.taskId && control.dataset.action === origin.action &&
  control.dataset.expectedTaskStatus === origin.taskStatus &&
  control.dataset.expectedAssigneePartyId === (origin.assigneePartyId || "") &&
  location.pathname === canonicalReservationPickupTaskPath(origin.property, origin.reservationId, origin.taskId) &&
  location.search === "";
 }
 function reservationPickupTaskActionOrigin(task) {
 return Object.freeze({
  requestGeneration: reservationPickupTaskRequestGeneration,
  detailGeneration: reservationDetailGeneration,
  property: propertySelect.value,
  reservationId: task.reservationId,
  confirmationNo: task.confirmationNo,
  taskId: task.taskId,
  taskStatus: task.status,
  assigneePartyId: task.assigneePartyId,
  action: task.eligibleAction,
 });
 }
 function reservationPickupTaskStaffSearchIsCurrent(origin, panel, picker, generation) {
 const search = picker?.querySelector(".pickup-task-assignee-search");
 return generation === reservationPickupTaskStaffSearchGeneration && origin.action === "assign" &&
  reservationPickupTaskActionIsCurrent(origin, panel, search) && picker.isConnected &&
  panel.querySelector(".pickup-task-detail-content")?.contains(picker);
 }
 function chooseReservationPickupTaskStaff(origin, panel, picker, profile) {
 const search = picker.querySelector(".pickup-task-assignee-search");
 if (!reservationPickupTaskActionIsCurrent(origin, panel, search) || !canonicalUuid(profile.partyId)) return;
 reservationPickupTaskStaffSearchGeneration += 1;
 reservationPickupTaskStaffSelection = Object.freeze({ partyId: profile.partyId, displayName: profile.displayName });
 picker.querySelector(".pickup-task-assignee-search-row").hidden = true;
 picker.querySelector(".pickup-task-assignee-results").replaceChildren();
 const selected = picker.querySelector(".pickup-task-assignee-selected");
 selected.querySelector("strong").textContent = profile.displayName;
 selected.hidden = false;
 const submit = picker.querySelector(".pickup-task-detail-governed-action");
 submit.disabled = false;
 submit.setAttribute("aria-label", `Assign arrival pickup to ${profile.displayName}`);
 selected.focus({ preventScroll: true });
 picker.querySelector(".pickup-task-assignee-status").textContent = "Staff selected. The server will revalidate active staff truth before assignment.";
 }
 function reservationPickupTaskStaffCard(origin, panel, picker, profile) {
 const card = node("article", "pickup-task-assignee-result");
 card.append(node("strong", "", profile.displayName));
 const use = node("button", "secondary", "Choose staff");
 use.type = "button";
 use.setAttribute("aria-label", `Choose ${profile.displayName} for this arrival pickup`);
 use.addEventListener("click", () => chooseReservationPickupTaskStaff(origin, panel, picker, profile));
 card.append(use);
 return card;
 }
 async function searchReservationPickupTaskStaff(origin, panel, picker) {
 const query = picker.querySelector(".pickup-task-assignee-query").value.trim();
 const search = picker.querySelector(".pickup-task-assignee-search");
 const status = picker.querySelector(".pickup-task-assignee-status");
 const results = picker.querySelector(".pickup-task-assignee-results");
 if (!reservationPickupTaskActionIsCurrent(origin, panel, search)) return;
 if (query.length < 2) {
  status.textContent = "Enter at least two characters to find an active staff Party.";
  picker.querySelector(".pickup-task-assignee-query").focus({ preventScroll: true });
  return;
 }
 const generation = ++reservationPickupTaskStaffSearchGeneration;
 search.disabled = true;
 results.replaceChildren();
 status.textContent = "Searching canonical Party profiles…";
 try {
  const result = await request(`/api/v1/properties/${enc(origin.property)}/parties:search`, {
   method: "POST", body: JSON.stringify({ query, limit: 20 }),
  });
  if (!reservationPickupTaskStaffSearchIsCurrent(origin, panel, picker, generation)) return;
  const staff = (Array.isArray(result.profiles) ? result.profiles : []).flatMap((profile) =>
   canonicalUuid(String(profile?.partyId || "")) && typeof profile?.displayName === "string" &&
   profile.displayName.length > 0 && profile.displayName.length <= 120 &&
   Array.isArray(profile.roles) && profile.roles.includes("staff")
    ? [Object.freeze({ partyId: String(profile.partyId), displayName: profile.displayName })] : []);
  results.replaceChildren(...staff.map((profile) => reservationPickupTaskStaffCard(origin, panel, picker, profile)));
  if (staff.length === 0) results.append(node("p", "field-note", "No active staff-labelled Party matched. Refine the search."));
  results.tabIndex = -1;
  results.focus({ preventScroll: true });
  status.textContent = `${staff.length} staff-labelled Party result${staff.length === 1 ? "" : "s"}.`;
 } catch (error) {
  if (!reservationPickupTaskStaffSearchIsCurrent(origin, panel, picker, generation)) return;
  status.textContent = error instanceof Error ? error.message : "Staff search failed. Try again.";
 } finally {
  if (reservationPickupTaskStaffSearchIsCurrent(origin, panel, picker, generation)) search.disabled = false;
 }
 }
 function reservationPickupTaskAssignmentPicker(panel, task) {
 const origin = reservationPickupTaskActionOrigin(task);
 const form = node("form", "pickup-task-assignee-picker");
 form.setAttribute("aria-labelledby", "pickup-task-assignee-title");
 const fieldset = el("fieldset");
 const legend = node("legend", "", "Assign pickup");
 legend.id = "pickup-task-assignee-title";
 fieldset.append(legend, node("p", "field-note", "Choose one active staff Party. Contact details are never copied into this task."));
 const row = node("div", "pickup-task-assignee-search-row");
 const label = node("label", "", "Find active staff");
 const query = el("input");
 query.type = "search";
 query.className = "pickup-task-assignee-query";
 query.minLength = 2;
 query.maxLength = 120;
 query.autocomplete = "off";
 query.placeholder = "Name or Party ID";
 label.append(query);
 const search = node("button", "secondary pickup-task-assignee-search", "Search staff");
 search.type = "button";
 search.dataset.taskId = task.taskId;
 search.dataset.action = "assign";
 search.dataset.expectedTaskStatus = task.status;
 search.dataset.expectedAssigneePartyId = "";
 search.addEventListener("click", () => void searchReservationPickupTaskStaff(origin, panel, form));
 query.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); void searchReservationPickupTaskStaff(origin, panel, form); }
 });
 row.append(label, search);
 const results = node("div", "pickup-task-assignee-results");
 results.setAttribute("role", "region");
 results.setAttribute("aria-label", "Active staff Party results");
 results.setAttribute("aria-live", "polite");
 const selected = node("div", "pickup-task-assignee-selected");
 selected.hidden = true;
 selected.tabIndex = -1;
 selected.append(node("div", "", "Selected staff: "), node("strong", "", ""));
 const change = node("button", "quiet", "Change staff");
 change.type = "button";
 change.addEventListener("click", () => {
  if (!reservationPickupTaskActionIsCurrent(origin, panel, search)) return;
  reservationPickupTaskStaffSearchGeneration += 1;
  reservationPickupTaskStaffSelection = null;
  selected.hidden = true;
  row.hidden = false;
  results.replaceChildren();
  form.querySelector(".pickup-task-detail-governed-action").disabled = true;
  form.querySelector(".pickup-task-assignee-status").textContent = "Choose an active staff Party before assigning pickup.";
  query.focus({ preventScroll: true });
 });
 selected.append(change);
 const submit = node("button", "primary pickup-task-detail-governed-action", "Assign pickup");
 submit.type = "submit";
 submit.disabled = true;
 submit.dataset.taskId = task.taskId;
 submit.dataset.action = "assign";
 submit.dataset.expectedTaskStatus = task.status;
 submit.dataset.expectedAssigneePartyId = "";
 const status = node("p", "field-note pickup-task-assignee-status", "Choose an active staff Party before assigning pickup.");
 status.setAttribute("role", "status");
 status.setAttribute("aria-live", "polite");
 fieldset.append(row, results, selected, submit, status);
 form.append(fieldset);
 form.addEventListener("submit", (event) => {
  event.preventDefault();
  const selection = reservationPickupTaskStaffSelection;
  if (!selection || !canonicalUuid(selection.partyId)) return;
  void submitReservationPickupTaskAction(submit, selection.partyId);
 });
 return form;
 }
 function focusReservationPickupTaskCurrentAction() {
 const panel = reservationDetailDrawer.querySelector(".pickup-task-detail-panel");
 if (!panel || panel.hidden || !reservationDetailDrawer.classList.contains("is-pickup-task-detail")) return;
 const target = panel.querySelector(".pickup-task-assignee-query,.pickup-task-detail-governed-action:not(:disabled),#pickup-task-detail-title");
 target?.focus({ preventScroll: true });
 }
 async function refreshReservationPickupTaskActionTruth(origin) {
 const reservation = reservationDetailData?.reservation;
 if (!reservation || reservation.reservationId !== origin.reservationId || reservation.confirmationNo !== origin.confirmationNo ||
  location.pathname !== canonicalReservationPickupTaskPath(origin.property, origin.reservationId, origin.taskId)) return;
 const panel = reservationDetailDrawer.querySelector(".pickup-task-detail-panel");
 if (!panel) return;
 await loadReservationPickupTaskDetail(panel, reservation, origin.taskId);
 focusReservationPickupTaskCurrentAction();
 }
 async function submitReservationPickupTaskAction(control, staffPartyId = null) {
 const task = reservationPickupTaskData;
 const panel = reservationDetailDrawer.querySelector(".pickup-task-detail-panel");
 if (!task || !panel || !task.eligibleAction) return;
 const origin = reservationPickupTaskActionOrigin(task);
 if (!reservationPickupTaskActionIsCurrent(origin, panel, control)) return;
 if (origin.action === "assign" && (!canonicalUuid(String(staffPartyId || "")) ||
  reservationPickupTaskStaffSelection?.partyId !== staffPartyId)) return;
 const body = origin.action === "assign"
  ? { expectedTaskStatus: "open", expectedAssigneePartyId: null, staffPartyId }
  : { expectedTaskStatus: origin.taskStatus, expectedAssigneePartyId: origin.assigneePartyId };
 const draft = JSON.stringify({ property: origin.property, reservationId: origin.reservationId, taskId: origin.taskId, action: origin.action, ...body });
 const existing = reservationPickupTaskAttempts.get(origin.taskId);
 const attempt = existing?.draft === draft ? existing : { draft, key: crypto.randomUUID() };
 reservationPickupTaskAttempts.set(origin.taskId, attempt);
 reservationPickupTaskStaffSearchGeneration += 1;
 const controls = [...panel.querySelectorAll(".pickup-task-detail-governed-actions button,.pickup-task-detail-governed-actions input")];
 const disabled = controls.map((item) => item.disabled);
 for (const item of controls) item.disabled = true;
 panel.setAttribute("aria-busy", "true");
 reservationDetailStatus.textContent = `${RESERVATION_PICKUP_TASK_ACTION_LABELS[origin.action]} using exact current task and assignment evidence…`;
 try {
  await request(`/api/v1/properties/${enc(origin.property)}/reservations/${enc(origin.reservationId)}/arrival-pickup-task/${enc(origin.taskId)}/${enc(origin.action)}`, {
   method: "POST", headers: { "idempotency-key": attempt.key }, body: JSON.stringify(body),
  });
  if (!reservationPickupTaskActionIsCurrent(origin, panel, control)) return;
  reservationPickupTaskAttempts.delete(origin.taskId);
  reservationDetailStatus.textContent = "Pickup task action recorded. Refreshing authoritative detail…";
  await refreshReservationPickupTaskActionTruth(origin);
 } catch (error) {
  if (!reservationPickupTaskActionIsCurrent(origin, panel, control)) return;
  if (error?.status === 409) {
   reservationPickupTaskAttempts.delete(origin.taskId);
   reservationDetailStatus.textContent = "Pickup task or assignment evidence changed. Refreshing authoritative detail…";
   await refreshReservationPickupTaskActionTruth(origin);
  } else {
   panel.setAttribute("aria-busy", "false");
   controls.forEach((item, index) => { item.disabled = disabled[index]; });
   reservationDetailStatus.textContent = `${error instanceof Error ? error.message : "Pickup task action failed"}. Retry this unchanged action to keep the same idempotency key.`;
   control.focus({ preventScroll: true });
  }
 }
 }
 function renderReservationPickupTaskDetail(panel, task) {
 clearReservationPickupTaskActionDraft();
 const content = panel.querySelector(".pickup-task-detail-content");
 const status = node("span", "pickup-task-detail-status", RESERVATION_PICKUP_TASK_STATUS_LABELS[task.status]);
 status.dataset.taskStatus = task.status;
 status.setAttribute("aria-label", `Task status: ${RESERVATION_PICKUP_TASK_STATUS_LABELS[task.status]}`);
 const summary = node("div", "pickup-task-detail-summary");
 summary.append(node("span", "eyebrow", "Current task state"), status,
  node("span", "pickup-task-detail-governed-label", "Server governed"));
 const facts = el("dl");
 for (const [label, value] of [
  ["Reservation", task.confirmationNo],
  ["Due", reservationDateTime(task.dueAt)],
  ["Priority", String(task.priority)],
  ["Assignment", task.assigneePartyId === null ? "Unassigned" : "Assigned"],
  ["Created", reservationDateTime(task.createdAt)],
  ["Completed", task.completedAt === null ? "Not completed" : reservationDateTime(task.completedAt)],
 ]) facts.append(node("dt", "", label), node("dd", "", value));
 const identifiers = node("details", "pickup-task-detail-identifiers");
 identifiers.append(node("summary", "", "Recorded identifiers"));
 const identityFacts = el("dl");
 identityFacts.append(node("dt", "", "Task ID"), node("dd", "", task.taskId),
  node("dt", "", "Reservation ID"), node("dd", "", task.reservationId));
 identifiers.append(identityFacts);
 const governedActions = node("section", "pickup-task-detail-governed-actions");
 governedActions.setAttribute("aria-label", "Pickup task actions");
 if (task.eligibleAction === "assign") {
  governedActions.append(reservationPickupTaskAssignmentPicker(panel, task));
 } else if (task.eligibleAction === "start" || task.eligibleAction === "complete") {
  const action = node("button", "primary pickup-task-detail-governed-action", RESERVATION_PICKUP_TASK_ACTION_LABELS[task.eligibleAction]);
  action.type = "button";
  action.dataset.taskId = task.taskId;
  action.dataset.action = task.eligibleAction;
  action.dataset.expectedTaskStatus = task.status;
  action.dataset.expectedAssigneePartyId = task.assigneePartyId || "";
  action.setAttribute("aria-label", `${RESERVATION_PICKUP_TASK_ACTION_LABELS[task.eligibleAction]} for reservation ${task.confirmationNo}`);
  action.addEventListener("click", () => void submitReservationPickupTaskAction(action));
  governedActions.append(action);
 } else {
  governedActions.append(node("p", "field-note pickup-task-detail-action-blocker", "No action is permitted for your current grant and this server state."));
 }
 content.replaceChildren(summary, facts, governedActions, identifiers,
  node("p", "field-note", "Task evidence is authoritative. Any offered action remains governed and revalidated by the server."));
 content.hidden = false;
 panel.querySelector(".pickup-task-detail-loading").hidden = true;
 panel.querySelector(".pickup-task-detail-error").hidden = true;
 panel.setAttribute("aria-busy", "false");
 }
 async function loadReservationPickupTaskDetail(panel, reservation, taskId, { focus = false } = {}) {
 const origin = Object.freeze({
  requestGeneration: ++reservationPickupTaskRequestGeneration,
  detailGeneration: reservationDetailGeneration,
  property: propertySelect.value,
  reservationId: reservation.reservationId,
  confirmationNo: reservation.confirmationNo,
  taskId,
 });
 const loading = panel.querySelector(".pickup-task-detail-loading");
 const error = panel.querySelector(".pickup-task-detail-error");
 panel.setAttribute("aria-busy", "true");
 loading.hidden = false;
 error.hidden = true;
 panel.querySelector(".pickup-task-detail-content").hidden = true;
 try {
  const body = await request(`/api/v1/properties/${enc(origin.property)}/reservations/${enc(origin.reservationId)}/arrival-pickup-task/${enc(origin.taskId)}`);
  if (!reservationPickupTaskRequestIsCurrent(origin, panel)) return;
  const task = reservationPickupTaskDetailResult(body, origin);
  if (!reservationPickupTaskRequestIsCurrent(origin, panel)) return;
  reservationPickupTaskData = task;
  renderReservationPickupTaskDetail(panel, task);
  reservationDetailStatus.textContent = "Current arrival pickup task loaded from server truth.";
  if (focus) panel.querySelector("h4").focus({ preventScroll: true });
 } catch (requestError) {
  if (!reservationPickupTaskRequestIsCurrent(origin, panel)) return;
  reservationPickupTaskData = null;
  loading.hidden = true;
  error.hidden = false;
  error.querySelector("p").textContent = requestError?.status === 404
  ? "The linked pickup task was not found for this reservation and property."
  : requestError?.status === 409 ? "Stored pickup task truth is inconsistent; no task detail was disclosed."
   : requestError instanceof Error ? requestError.message : "The pickup task detail is unavailable.";
  panel.setAttribute("aria-busy", "false");
  reservationDetailStatus.textContent = "Arrival pickup task detail unavailable.";
  if (focus) panel.querySelector(".pickup-task-detail-retry").focus({ preventScroll: true });
 }
 }
  async function openReservationPickupTaskDetail(reservation, taskId, { push = true, trigger = null } = {}) {
 if (!reservation || reservation.reservationId !== reservationRouteReservationId ||
  reservationDetailData?.reservation?.confirmationNo !== reservation.confirmationNo || !canonicalUuid(taskId)) return;
 reservationRoutePickupTaskId = taskId;
 reservationPickupTaskReturnFocus = trigger || [...reservationDetailContent.querySelectorAll(".pickup-task-detail-action")]
  .find((button) => button.dataset.taskId === taskId) || null;
 if (push) {
  history.pushState({ yellowSurface: "reservation-pickup-task-detail" }, "",
   canonicalReservationPickupTaskPath(propertySelect.value, reservation.reservationId, taskId));
 }
 const panel = reservationPickupTaskPanel(reservation.reservationId, taskId);
 reservationDetailDrawer.classList.add("is-pickup-task-detail");
 panel.hidden = false;
 const action = reservationPickupTaskReturnFocus;
 if (action?.isConnected) action.setAttribute("aria-expanded", "true");
 panel.querySelector("h4").focus({ preventScroll: true });
 await loadReservationPickupTaskDetail(panel, reservation, taskId, { focus: true });
 }
  function closeReservationPickupTaskDetail({ history: updateHistory = true, restoreFocus = true } = {}) {
 const reservationId = reservationRouteReservationId;
 const returnFocus = reservationPickupTaskReturnFocus;
 reservationPickupTaskRequestGeneration += 1;
 reservationPickupTaskData = null;
 reservationPickupTaskReturnFocus = null;
 clearReservationPickupTaskActionDraft({ clearAttempts: true });
 reservationRoutePickupTaskId = "";
 reservationDetailDrawer.classList.remove("is-pickup-task-detail");
 for (const action of reservationDetailContent.querySelectorAll(".pickup-task-detail-action")) action.setAttribute("aria-expanded", "false");
 for (const panel of reservationDetailDrawer.querySelectorAll(".pickup-task-detail-panel")) panel.remove();
 if (updateHistory && propertySelect.value && reservationId) {
  if (reservationExitHistoryAction(history.state, "reservation-pickup-task-detail") === "back") history.back();
  else history.replaceState({ yellowSurface: "reservation-detail" }, "", `/p/${propertySelect.value}/res/${reservationId}`);
 }
 if (restoreFocus) {
  const target = returnFocus?.isConnected ? returnFocus : reservationDetailTitle;
  target?.focus({ preventScroll: true });
 }
 }
const RESERVATION_TRAVEL_MODE_LABELS = Object.freeze({
 flight: "Flight", train: "Train", bus: "Bus", car: "Car", ferry: "Ferry", other: "Other",
 });
  function reservationPickupAutomationState(travel) {
 if (!travel || travel.direction !== "arrival") return null;
 if (travel.pickupRequested !== true) {
  return Object.freeze({ state: "not-requested", label: "Pickup not requested" });
 }
 if (!travel.scheduledAt) {
  return Object.freeze({ state: "schedule-required", label: "Pickup requested · schedule required" });
 }
 if (typeof travel.pickupTaskId !== "string" || travel.pickupTaskId.length === 0) {
  return Object.freeze({ state: "task-pending", label: "Pickup requested · task pending" });
 }
 return Object.freeze({ state: "task-linked", label: "Pickup task linked" });
 }
  function reservationPickupTaskAction(item, pickup) {
 if (pickup.state !== "task-linked" || !canonicalUuid(item.pickupTaskId)) return null;
 const reservation = reservationDetailData?.reservation;
 if (!reservation || reservation.reservationId !== reservationRouteReservationId) return null;
 const action = el("button");
 action.type = "button";
 action.className = "secondary pickup-task-detail-action";
 action.textContent = "Open pickup task";
 action.dataset.taskId = item.pickupTaskId;
 action.setAttribute("aria-expanded", "false");
 action.setAttribute("aria-label", `Open arrival pickup task for reservation ${reservation.confirmationNo}`);
 action.addEventListener("click", () => {
  void openReservationPickupTaskDetail(reservation, item.pickupTaskId, { push: true, trigger: action });
 });
 return action;
 }
  function reservationTravelDetailCollection(items) {
 const section = node("section", "reservation-detail-section");
 const heading = node("h4", "", "Travel");
 const list = el("ul");
 if (items.length === 0) {
  list.append(node("li", "", "No travel recorded."));
 } else {
  for (const item of items) {
  const row = node("li", "reservation-travel-detail");
  const identity = [item.carrier, item.serviceNo]
   .filter((value) => typeof value === "string" && value.length > 0).join(" ");
  const copy = [
   item.direction,
   RESERVATION_TRAVEL_MODE_LABELS[item.mode] || "Mode not recorded",
   identity,
   item.scheduledAt ? reservationDateTime(item.scheduledAt) : "Time not recorded",
  ].filter(Boolean).join(" · ");
  row.append(node("span", "reservation-travel-detail-copy", copy));
  const pickup = reservationPickupAutomationState(item);
  if (pickup) {
   const state = node("span", "reservation-pickup-state", pickup.label);
   state.dataset.pickupState = pickup.state;
   row.append(state);
   const action = reservationPickupTaskAction(item, pickup);
   if (action) row.append(action);
  }
  list.append(row);
  }
 }
 section.append(heading, list);
 return section;
 }
  function reservationArrivalTravelSummary(row) {
 const travel = row?.arrivalTravel;
 if (!travel) return null;
 const identity = [travel.carrier, travel.serviceNo].filter((value) => typeof value === "string" && value.length > 0).join(" ");
 const details = [
  "Arrival",
  RESERVATION_TRAVEL_MODE_LABELS[travel.mode] || "Mode not recorded",
  identity,
  travel.scheduledAt ? reservationDateTime(travel.scheduledAt) : "Time not recorded",
  travel.pickupRequested ? "pickup requested" : "pickup not requested",
  travel.pickupTaskLinked ? "pickup task linked" : "no linked pickup task",
 ].filter(Boolean);
 const summary = details.join(" · ");
 const line = node("small", "reservation-arrival-travel", summary);
 line.setAttribute("aria-label", summary);
 return line;
 }
  function reservationDepartureTravelSummary(row) {
 const travel = row?.departureTravel;
 if (!travel) return null;
 const identity = [travel.carrier, travel.serviceNo].filter((value) => typeof value === "string" && value.length > 0).join(" ");
 const details = [
  "Departure",
  RESERVATION_TRAVEL_MODE_LABELS[travel.mode] || "Mode not recorded",
  identity,
  travel.scheduledAt ? reservationDateTime(travel.scheduledAt) : "Time not recorded",
 ].filter(Boolean);
 const summary = details.join(" · ");
 const line = node("small", "reservation-departure-travel", summary);
 line.setAttribute("aria-label", summary);
 return line;
 }
  function reservationStaySummary(row) {
 const summary = node("div", "reservation-stay-summary");
 summary.append(node("span", "", reservationStay(row)));
 const arrival = reservationArrivalTravelSummary(row);
 const departure = reservationDepartureTravelSummary(row);
 if (arrival) summary.append(arrival);
 if (departure) summary.append(departure);
 return summary;
 }
  function reservationStatusBadge(status) {
 const badge = node("span", "reservation-status-badge");
 badge.dataset.status = status;
 badge.textContent = reservationStatusLabels[status] || "Unknown status";
 return badge;
 }
  function reservationOpenButton(row) {
 const button = el("button");
 button.type = "button";
 button.className = "reservation-row-open";
 button.dataset.reservationId = row.reservationId;
 button.textContent = row.confirmationNo;
 button.setAttribute("aria-label", `Open reservation ${row.confirmationNo} for ${row.primaryGuestDisplayName}`);
 button.addEventListener("click", () => void openReservationDetail(row.reservationId, { trigger: button }));
 return button;
 }
  function reservationTableRow(row) {
 const tr = el("tr");
 const values = [
  reservationOpenButton(row), row.primaryGuestDisplayName, reservationStatusBadge(row.status),
  reservationStaySummary(row), row.sellableUnitLabel || row.unitTypeLabel, row.ratePlanLabel,
  `${row.adults} adult${row.adults === 1 ? "" : "s"}${row.children ? ` · ${row.children} child${row.children === 1 ? "" : "ren"}` : ""}`,
  row.channelCode,
 ];
 for (const value of values) {
  const td = el("td");
  if (value instanceof Node) td.append(value); else td.textContent = value;
  tr.append(td);
 }
 return tr;
 }
  function reservationCard(row, { showArrivalTravel = true, showDepartureTravel = true, operationalAction = null } = {}) {
 const article = node("article", "card reservation-board-card");
 const head = node("div", "reservation-board-card-head");
 head.append(reservationOpenButton(row), reservationStatusBadge(row.status));
 const guest = node("strong", "", row.primaryGuestDisplayName);
 const stay = node("span", "", reservationStay(row));
 const room = node("span", "", `${row.sellableUnitLabel || row.unitTypeLabel} · ${row.ratePlanLabel}`);
 const party = node("small", "", `${row.adults} adult${row.adults === 1 ? "" : "s"}${row.children ? ` · ${row.children} child${row.children === 1 ? "" : "ren"}` : ""} · ${row.channelCode}`);
 const arrival = showArrivalTravel ? reservationArrivalTravelSummary(row) : null;
 const departure = showDepartureTravel ? reservationDepartureTravelSummary(row) : null;
 article.append(head, guest, stay, room, party);
 if (arrival) article.append(arrival);
 if (departure) article.append(departure);
 if (operationalAction) {
  const action = node("button", "today-operational-action", operationalAction.label);
  action.type = "button";
  action.setAttribute("aria-label", `${operationalAction.label} for reservation ${row.confirmationNo}`);
  action.addEventListener("click", () => void openReservationDetail(row.reservationId, {
   trigger: action, workbench: operationalAction.workbench,
  }));
  article.append(action);
 }
 return article;
 }
 const TODAY_STATUSES = Object.freeze(["due_in", "due_out", "in_house"]);
  function todayOperationalAction(laneStatus, rowStatus) {
 if (laneStatus === "due_in" && rowStatus === "due_in") {
  return { workbench: "check-in", label: "Prepare check-in" };
 }
 if (laneStatus === "due_out" && rowStatus === "due_out") {
  return { workbench: "checkout", label: "Prepare checkout" };
 }
 if (laneStatus === "in_house" && rowStatus === "in_house") {
  return { workbench: "checkout", label: "Prepare checkout" };
 }
 return null;
 }
  function todayLaneElements(status) {
 const lane = todayLanes.find((candidate) => candidate.dataset.todayLane === status);
 return {
  lane,
  summary: lane.querySelector("[data-today-summary]"),
  loading: lane.querySelector("[data-today-loading]"),
  error: lane.querySelector("[data-today-error]"),
  empty: lane.querySelector("[data-today-empty]"),
  list: lane.querySelector("[data-today-list]"),
  more: lane.querySelector("[data-today-more]"),
  status: lane.querySelector("[data-today-status]"),
 };
 }
  function setTodayLaneState(status, state, message = "") {
 const elements = todayLaneElements(status);
 elements.loading.hidden = state !== "loading";
 elements.error.hidden = state !== "error";
 elements.empty.hidden = state !== "empty";
 elements.list.hidden = state !== "ready";
 elements.lane.setAttribute("aria-busy", String(state === "loading"));
 if (state === "error") elements.error.querySelector("p").textContent = message;
 }
  function propertyLocalDate(instant, timeZone) {
 const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
  timeZone, year: "numeric", month: "2-digit", day: "2-digit",
 }).formatToParts(instant).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
 }
  function todayWindow(now = new Date()) {
 const timeZone = propertyTimeZone();
 const localDate = propertyLocalDate(now, timeZone);
 const from = zonedInstant(localDate, 0, 0, timeZone);
 const nextDate = dateAfter(localDate);
 const to = zonedInstant(nextDate, 0, 0, timeZone);
 if (propertyLocalDate(new Date(from), timeZone) !== localDate || propertyLocalDate(new Date(to), timeZone) !== nextDate) {
  throw new Error("The property-local Today boundary could not be represented safely.");
 }
 return { localDate, timeZone, from, to, key: `${localDate}|${timeZone}|${from}|${to}` };
 }
  function todayBoardQuery(status, window, after = "") {
 if (!TODAY_STATUSES.includes(status)) throw new Error("Unsupported Today lane.");
 const query = new URLSearchParams({ status, from: window.from, to: window.to, limit: "50" });
 if (after) query.set("after", after);
 return query;
 }
  function resetTodayState() {
 todayGeneration += 1;
 todayWindowState = null;
 for (const status of TODAY_STATUSES) {
  const state = todayLaneState[status];
  state.rows = [];
  state.nextCursor = null;
  state.requestGeneration += 1;
  const elements = todayLaneElements(status);
  elements.list.replaceChildren();
  elements.more.hidden = true;
  elements.summary.textContent = "Not loaded.";
  elements.status.textContent = "";
  setTodayLaneState(status, "empty");
 }
 }
  function todayRequestIsCurrent(status, cycle, requestGeneration, property, windowKey) {
 return cycle === todayGeneration && requestGeneration === todayLaneState[status].requestGeneration &&
  property === propertySelect.value && activeView === "today" && location.pathname === `/p/${property}/today` &&
  todayWindowState?.key === windowKey;
 }
  function todayReturnFocusDecision(reservationId, matched, settled) {
 if (!reservationId) return "none";
 if (matched) return "row";
 return settled ? "heading" : "wait";
 }
  function restoreTodayReturnFocus(cycle, settled = false) {
 if (todayReturnFocus.cycle !== cycle || activeView !== "today" || location.pathname !== `/p/${propertySelect.value}/today`) return;
 const match = [...todayView.querySelectorAll(".reservation-row-open")]
  .find((button) => button.dataset.reservationId === todayReturnFocus.reservationId && !button.closest("[hidden]"));
 const decision = todayReturnFocusDecision(todayReturnFocus.reservationId, Boolean(match), settled);
 if (decision === "row") match.focus();
 if (decision === "heading") $("#today-title").focus();
 if (decision === "row" || decision === "heading") todayReturnFocus = { reservationId: "", cycle: 0 };
 }
  function renderTodayLane(status, page, older = false, cycle = todayGeneration) {
 const state = todayLaneState[status];
 const elements = todayLaneElements(status);
 state.rows = Array.isArray(page.reservations) ? page.reservations.slice(0, 50) : [];
 state.nextCursor = typeof page.nextCursor === "string" ? page.nextCursor : null;
 elements.list.replaceChildren(...state.rows.map((row) => reservationCard(row, {
  showArrivalTravel: status === "due_in",
  showDepartureTravel: status === "due_out",
  operationalAction: todayOperationalAction(status, row.status),
 })));
 elements.more.hidden = state.nextCursor === null;
 const count = state.rows.length;
 elements.summary.textContent = `${count} shown on this bounded page${state.nextCursor ? " · more records available" : ""}.`;
 elements.status.textContent = older ? `Showing the next bounded page of ${count}; the previous page was replaced.` : `${count} record${count === 1 ? "" : "s"} shown.`;
 setTodayLaneState(status, count === 0 ? "empty" : "ready");
 restoreTodayReturnFocus(cycle);
 }
  async function loadTodayLane(status, { older = false, cycle = todayGeneration, window = todayWindowState } = {}) {
 if (!window) return;
 const state = todayLaneState[status];
 if (older && !state.nextCursor) return;
 const property = propertySelect.value;
 const requestGeneration = ++state.requestGeneration;
 const elements = todayLaneElements(status);
 if (!older) {
  state.nextCursor = null;
  elements.more.hidden = true;
  setTodayLaneState(status, "loading");
 }
 elements.more.disabled = older;
 elements.status.textContent = older ? "Loading the next bounded page…" : "Loading this bounded page…";
 try {
  const query = todayBoardQuery(status, window, older ? state.nextCursor || "" : "");
  const page = await request(`/api/v1/properties/${enc(property)}/reservation-board?${query}`);
  if (!todayRequestIsCurrent(status, cycle, requestGeneration, property, window.key)) return;
  renderTodayLane(status, page, older, cycle);
 } catch (error) {
  if (!todayRequestIsCurrent(status, cycle, requestGeneration, property, window.key)) return;
  const message = error instanceof Error ? error.message : "This Today lane is unavailable.";
  if (older && state.rows.length > 0) {
  setTodayLaneState(status, "ready");
  elements.status.textContent = `${message} The current page remains visible.`;
  } else {
  setTodayLaneState(status, "error", message);
  elements.status.textContent = error?.status === 403 ? "Reservation access is not granted." : "Lane unavailable.";
  }
 } finally {
  if (todayRequestIsCurrent(status, cycle, requestGeneration, property, window.key)) elements.more.disabled = false;
 }
 }
  function loadToday() {
 const property = propertySelect.value;
 if (!property || activeView !== "today") return;
 const cycle = ++todayGeneration;
 let window;
 try {
  window = todayWindow();
 } catch (error) {
  const message = error instanceof Error ? error.message : "The property-local Today boundary is unavailable.";
  todayWindowState = null;
  todayWindowLabel.textContent = "Property-local day unavailable.";
  for (const status of TODAY_STATUSES) setTodayLaneState(status, "error", message);
  return;
 }
 todayWindowState = window;
 if (todayReturnFocus.reservationId) todayReturnFocus.cycle = cycle;
 const label = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeZone: window.timeZone }).format(new Date(window.from));
 todayWindowLabel.textContent = `${label} · ${window.timeZone} · browser-computed display boundary`;
 void Promise.all(TODAY_STATUSES.map((status) => loadTodayLane(status, { cycle, window })))
  .then(() => restoreTodayReturnFocus(cycle, true));
 }
 const HOUSEKEEPING_ACTION_LABELS = Object.freeze({
 start: "Start cleaning", complete: "Mark room clean", verify: "Verify inspection",
 });
 const HOUSEKEEPING_STATUS_LABELS = Object.freeze({
 assigned: "Assigned", in_progress: "In progress", done: "Awaiting inspection", verified: "Verified",
 });
 const HOUSEKEEPING_CONDITION_LABELS = Object.freeze({
 dirty: "Dirty", pickup: "Pickup", clean: "Clean", inspected: "Inspected",
 });
 const HOUSEKEEPING_CADENCE_LABELS = Object.freeze({ daily: "Daily", on_departure: "On departure" });
 function setHousekeepingSheetMessage(message, isError = false) {
 housekeepingSheetMessage.textContent = message;
 housekeepingSheetMessage.classList.toggle("error", isError);
 }
 function clearHousekeepingSheetReceipt() {
 housekeepingGenerationReceiptGeneration += 1;
 housekeepingGenerationReceipt = null;
 if (housekeepingGenerationReceiptPanel) {
  housekeepingGenerationReceiptPanel.hidden = true;
  housekeepingGenerationReceiptPanel.replaceChildren();
 }
 }
 function parseHousekeepingGenerationReceipt(value, origin) {
 const receiptKeys = ["attendantPartyId", "replayed", "sheetDate", "sheetId", "taskCount", "tasks"];
 const taskKeys = ["cadence", "profileKey", "spaceCode", "spaceId", "taskId"];
 const validOrigin = origin && typeof origin === "object" && !Array.isArray(origin) &&
  Object.keys(origin).sort().join(",") === "attendantPartyId,property,sheetDate" &&
  canonicalUuid(String(origin.property || "")) && canonicalUuid(String(origin.attendantPartyId || "")) &&
  /^\d{4}-\d{2}-\d{2}$/.test(String(origin.sheetDate || ""));
 if (!validOrigin || !value || typeof value !== "object" || Array.isArray(value) ||
  Object.keys(value).sort().join(",") !== receiptKeys.join(",") || !canonicalUuid(String(value.sheetId || "")) ||
  value.sheetDate !== origin.sheetDate || value.attendantPartyId !== origin.attendantPartyId ||
  typeof value.replayed !== "boolean" || !Number.isInteger(value.taskCount) || value.taskCount < 1 ||
  value.taskCount > 200 || !Array.isArray(value.tasks) || value.tasks.length !== value.taskCount) {
  throw new Error("The housekeeping generation receipt was invalid.");
 }
 const taskIds = new Set();
 const spaceIds = new Set();
 const tasks = value.tasks.map((task) => {
  const validTask = task && typeof task === "object" && !Array.isArray(task) &&
   Object.keys(task).sort().join(",") === taskKeys.join(",") &&
   canonicalUuid(String(task.taskId || "")) && canonicalUuid(String(task.spaceId || "")) &&
   typeof task.spaceCode === "string" && task.spaceCode.trim().length > 0 && task.spaceCode.length <= 120 &&
   typeof task.profileKey === "string" && task.profileKey.trim().length > 0 && task.profileKey.length <= 120 &&
   ["daily", "on_departure"].includes(task.cadence) &&
   !taskIds.has(task.taskId) && !spaceIds.has(task.spaceId);
  if (!validTask) throw new Error("The housekeeping generation receipt contained invalid task truth.");
  taskIds.add(task.taskId);
  spaceIds.add(task.spaceId);
  return Object.freeze({
   taskId: task.taskId,
   spaceId: task.spaceId,
   spaceCode: task.spaceCode,
   profileKey: task.profileKey,
   cadence: task.cadence,
  });
 });
 return Object.freeze({
  property: origin.property,
  sheetId: value.sheetId,
  sheetDate: value.sheetDate,
  attendantPartyId: value.attendantPartyId,
  taskCount: value.taskCount,
  tasks: Object.freeze(tasks),
  replayed: value.replayed,
 });
 }
function ensureHousekeepingGenerationReceiptPanel() {
 if (housekeepingGenerationReceiptPanel?.isConnected) return housekeepingGenerationReceiptPanel;
 const panel = node("section", "housekeeping-sheet-task-receipt");
 panel.hidden = true;
 panel.setAttribute("aria-labelledby", "housekeeping-sheet-task-receipt-title");
 panel.addEventListener("click", (event) => {
  const action = event.target.closest?.(".housekeeping-sheet-task-receipt-action");
  if (action instanceof HTMLButtonElement) openGeneratedHousekeepingTaskDetail(action);
 });
 housekeepingSheetPreviewPanel.after(panel);
 housekeepingGenerationReceiptPanel = panel;
 return panel;
 }
 function renderHousekeepingSheetTaskReceipt(receipt) {
 const panel = ensureHousekeepingGenerationReceiptPanel();
 const generation = ++housekeepingGenerationReceiptGeneration;
 housekeepingGenerationReceipt = Object.freeze({ ...receipt, generation });
 const head = node("div", "housekeeping-sheet-task-receipt-head");
 const copy = node("div");
 copy.append(node("span", "eyebrow", receipt.replayed ? "Existing server receipt" : "Generation receipt"));
 const title = node("h4", "", `${receipt.taskCount} task${receipt.taskCount === 1 ? "" : "s"} ready to open`);
 title.id = "housekeeping-sheet-task-receipt-title";
 title.tabIndex = -1;
 copy.append(title);
 head.append(copy, housekeepingBadge("sheet-state", receipt.replayed ? "Confirmed" : "Generated", "generated"));
 const list = node("div", "housekeeping-sheet-task-receipt-list");
 list.setAttribute("role", "list");
 list.setAttribute("aria-label", "Tasks returned by this housekeeping-sheet generation");
 for (const task of receipt.tasks) {
  const item = node("article", "housekeeping-sheet-task-receipt-item");
  item.setAttribute("role", "listitem");
  const identity = node("div", "housekeeping-sheet-task-receipt-identity");
  identity.append(node("strong", "", `Room ${task.spaceCode}`),
   node("small", "housekeeping-sheet-task-receipt-meta", `${HOUSEKEEPING_CADENCE_LABELS[task.cadence]} · ${task.profileKey}`));
  const action = node("button", "secondary housekeeping-sheet-task-receipt-action", "Open task");
  action.type = "button";
  action.dataset.receiptGeneration = String(generation);
  action.dataset.sheetId = receipt.sheetId;
  action.dataset.taskId = task.taskId;
  action.dataset.spaceId = task.spaceId;
  action.dataset.cadence = task.cadence;
  action.setAttribute("aria-label", `Open generated housekeeping task for room ${task.spaceCode}`);
  item.append(identity, action);
  list.append(item);
 }
 panel.replaceChildren(head, list,
  node("p", "field-note", "This transient list is the exact successful generation receipt. Opening a task refetches current governed truth."));
 panel.hidden = false;
 return title;
 }
 function generatedHousekeepingTaskAction(taskId) {
 const receipt = housekeepingGenerationReceipt;
 const panel = housekeepingGenerationReceiptPanel;
 if (!receipt || !panel?.isConnected || panel.hidden) return null;
 const action = [...panel.querySelectorAll(".housekeeping-sheet-task-receipt-action")]
  .find((candidate) => candidate.dataset.taskId === taskId && candidate.dataset.receiptGeneration === String(receipt.generation));
 return action instanceof HTMLButtonElement ? action : null;
 }
 function openGeneratedHousekeepingTaskDetail(action) {
 const receipt = housekeepingGenerationReceipt;
 const panel = housekeepingGenerationReceiptPanel;
 if (!receipt || !panel?.isConnected || !(panel.hidden === false) || !(action instanceof HTMLButtonElement) ||
  !action.isConnected || !panel.contains(action) || !action.classList.contains("housekeeping-sheet-task-receipt-action") ||
  receipt.generation !== housekeepingGenerationReceiptGeneration || receipt.property !== propertySelect.value ||
  receipt.sheetDate !== housekeepingSheetDate.value || receipt.attendantPartyId !== housekeepingSheetAttendant?.partyId ||
  activeView !== "housekeeping" || location.pathname !== `/p/${receipt.property}/housekeeping` || location.search !== "") return;
 const task = receipt.tasks.find((item) => item.taskId === action.dataset.taskId);
 if (!task || action.dataset.receiptGeneration !== String(receipt.generation) ||
  action.dataset.sheetId !== receipt.sheetId || action.dataset.spaceId !== task.spaceId ||
  action.dataset.cadence !== task.cadence) return;
 openHousekeepingTaskDetail(task.taskId, { trigger: action });
 }
  function clearHousekeepingSheetPreview() {
 housekeepingSheetRequestGeneration += 1;
 clearHousekeepingSheetReceipt();
 housekeepingSheetPreview = [];
 housekeepingSheetCanGenerate = false;
 housekeepingSheetAttemptKey = "";
 housekeepingSheetAttemptDraft = "";
 housekeepingSheetPreviewPanel.hidden = true;
 housekeepingPreviewRooms.replaceChildren();
 housekeepingPreviewCount.textContent = "0 rooms";
 housekeepingGenerate.disabled = true;
 }
  function clearHousekeepingSheetState() {
 housekeepingSheetGeneration += 1;
 clearHousekeepingSheetReceipt();
 clearHousekeepingSheetPreview();
 housekeepingSheetAttendant = null;
 housekeepingSheetForm.reset();
 housekeepingAttendantResults.replaceChildren();
 housekeepingAttendantSelected.hidden = true;
 housekeepingAttendantSearchRow.hidden = false;
 housekeepingAttendantSelected.querySelector("strong").textContent = "";
 housekeepingAttendantSelected.querySelector("small").textContent = "";
 housekeepingSheetList.replaceChildren();
 housekeepingPreviewAction.disabled = true;
 setHousekeepingSheetMessage("");
 }
  function housekeepingSheetIsCurrent(generation, requestGeneration, property, sheetDate) {
 return generation === housekeepingSheetGeneration && requestGeneration === housekeepingSheetRequestGeneration &&
  property === propertySelect.value && sheetDate === housekeepingSheetDate.value &&
  activeView === "housekeeping" && location.pathname === `/p/${property}/housekeeping`;
 }
  function updateHousekeepingSheetProgress() {
 const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(housekeepingSheetDate.value);
 const hasAttendant = canonicalUuid(String(housekeepingSheetAttendant?.partyId || ""));
 housekeepingPreviewAction.disabled = !(hasDate && hasAttendant);
 for (const step of document.querySelectorAll("[data-sheet-step]")) {
  const name = step.dataset.sheetStep;
  const current = !hasDate ? name === "date" : !hasAttendant ? name === "attendant" : name === "preview";
  step.classList.toggle("is-current", current);
 }
 }
  function chooseHousekeepingAttendant(profile) {
 housekeepingSheetGeneration += 1;
 clearHousekeepingSheetReceipt();
 clearHousekeepingSheetPreview();
 housekeepingSheetAttendant = { partyId: String(profile.partyId), displayName: String(profile.displayName || "Staff Party") };
 housekeepingAttendantSelected.querySelector("strong").textContent = housekeepingSheetAttendant.displayName;
 housekeepingAttendantSelected.querySelector("small").textContent = `Party ${housekeepingSheetAttendant.partyId} · server revalidates active staff authority`;
 housekeepingAttendantSelected.hidden = false;
 housekeepingAttendantSearchRow.hidden = true;
 housekeepingAttendantResults.replaceChildren();
 housekeepingAttendantQuery.value = "";
 housekeepingAttendantSelected.focus({ preventScroll: true });
 setHousekeepingSheetMessage("Attendant selected. Preview will still be validated against current staff truth.");
 updateHousekeepingSheetProgress();
 }
  function housekeepingAttendantCard(profile) {
 const card = node("article", "housekeeping-attendant-result");
 const copy = node("div");
 copy.append(node("strong", "", String(profile.displayName || "Staff Party")), node("small", "", `Party ${profile.partyId}`));
 const use = node("button", "secondary", "Choose attendant");
 use.type = "button";
 use.dataset.partyId = String(profile.partyId || "");
 use.setAttribute("aria-label", `Choose ${profile.displayName || "this staff Party"} as housekeeping attendant`);
 use.addEventListener("click", () => chooseHousekeepingAttendant(profile));
 card.append(copy, use);
 return card;
 }
  async function searchHousekeepingAttendants() {
 const query = housekeepingAttendantQuery.value.trim();
 const property = propertySelect.value;
 if (query.length < 2 || !property) {
  setHousekeepingSheetMessage("Enter at least two characters to find an active staff Party.", true);
  housekeepingAttendantQuery.focus();
  return;
 }
 const generation = ++housekeepingSheetGeneration;
 clearHousekeepingSheetPreview();
 housekeepingAttendantSearch.disabled = true;
 housekeepingAttendantResults.replaceChildren();
 setHousekeepingSheetMessage("Searching canonical Party profiles…");
 try {
  const result = await request(`/api/v1/properties/${enc(property)}/parties:search`, {
  method: "POST", body: JSON.stringify({ query, limit: 20 }),
  });
  if (generation !== housekeepingSheetGeneration || property !== propertySelect.value || activeView !== "housekeeping") return;
  const staff = (Array.isArray(result.profiles) ? result.profiles : [])
  .filter((profile) => canonicalUuid(String(profile.partyId || "")) && Array.isArray(profile.roles) && profile.roles.includes("staff"));
  housekeepingAttendantResults.replaceChildren(...staff.map(housekeepingAttendantCard));
  if (staff.length === 0) {
  housekeepingAttendantResults.append(node("p", "field-note", "No staff-labelled Party matched. Refine the search; the server validates active staff again at generation."));
  }
  housekeepingAttendantResults.tabIndex = -1;
  housekeepingAttendantResults.focus({ preventScroll: true });
  setHousekeepingSheetMessage(`${staff.length} staff-labelled Party result${staff.length === 1 ? "" : "s"}.`);
 } catch (error) {
  if (generation !== housekeepingSheetGeneration || property !== propertySelect.value || activeView !== "housekeeping") return;
  setHousekeepingSheetMessage(error instanceof Error ? error.message : "Staff search failed. Try again.", true);
 } finally {
  if (generation === housekeepingSheetGeneration && property === propertySelect.value) housekeepingAttendantSearch.disabled = false;
 }
 }
  function housekeepingPreviewRoomCard(room) {
 const card = node("article", "housekeeping-preview-room");
 const head = node("div", "housekeeping-preview-room-head");
 const identity = node("div");
 identity.append(node("span", "eyebrow", room.floor ? `Floor ${room.floor}` : "Floor not set"), node("strong", "", `Room ${room.spaceCode}`));
 head.append(identity, housekeepingBadge("cadence", HOUSEKEEPING_CADENCE_LABELS[room.cadence] || "Server cadence", room.cadence));
 const evidence = node("dl", "housekeeping-evidence");
 for (const [term, value] of [
  ["Profile", String(room.profileKey || "Not returned")],
  ["Arrival", housekeepingDate(room.arrivalAt)],
  ["Departure", housekeepingDate(room.departureAt)],
 ]) evidence.append(node("dt", "", term), node("dd", "", value));
 card.append(head, evidence);
 return card;
 }
  function renderHousekeepingSheetList(sheets) {
 housekeepingSheetList.replaceChildren();
 if (sheets.length === 0) {
  housekeepingSheetList.append(node("p", "field-note", "No generated sheet exists for this date."));
  return;
 }
 for (const sheet of sheets.slice(0, 200)) {
  const row = node("article", "housekeeping-sheet-row");
  const identity = node("div");
  identity.append(node("strong", "", String(sheet.attendantName || "Housekeeping attendant")),
  node("small", "", `${sheet.taskCount} assigned task${sheet.taskCount === 1 ? "" : "s"} · ${sheet.sheetDate}`));
  row.append(identity, housekeepingBadge("sheet-state", "Generated", "generated"));
  housekeepingSheetList.append(row);
 }
 }
  function renderHousekeepingSheetPreview(body, sheets) {
 const rooms = Array.isArray(body.rooms) ? body.rooms.slice(0, 200) : [];
 housekeepingSheetPreview = rooms;
 housekeepingSheetCanGenerate = body.canGenerate === true;
 housekeepingPreviewRooms.replaceChildren(...rooms.map(housekeepingPreviewRoomCard));
 housekeepingPreviewCount.textContent = `${rooms.length} room${rooms.length === 1 ? "" : "s"}`;
 housekeepingGenerate.disabled = rooms.length === 0 || !housekeepingSheetCanGenerate || !housekeepingSheetAttendant;
 housekeepingGenerateCopy.textContent = rooms.length === 0
  ? "No currently occupied room is eligible for a supported daily or departure cadence."
  : !housekeepingSheetCanGenerate
  ? "Preview is available, but your current property grant does not permit generation."
  : `Generate ${rooms.length} assigned task${rooms.length === 1 ? "" : "s"} for ${housekeepingSheetAttendant.displayName}.`;
 housekeepingSheetPreviewPanel.hidden = false;
 renderHousekeepingSheetList(sheets);
 }
  async function previewHousekeepingSheet({ focus = false } = {}) {
 clearHousekeepingSheetReceipt();
 if (!housekeepingSheetForm.reportValidity() || !housekeepingSheetAttendant) {
  setHousekeepingSheetMessage("Choose a date and one staff attendant before previewing.", true);
  (!housekeepingSheetDate.value ? housekeepingSheetDate : housekeepingAttendantQuery).focus();
  return;
 }
 const property = propertySelect.value;
 const sheetDate = housekeepingSheetDate.value;
 const generation = ++housekeepingSheetGeneration;
 const requestGeneration = ++housekeepingSheetRequestGeneration;
 housekeepingPreviewAction.disabled = true;
 housekeepingGenerate.disabled = true;
 setHousekeepingSheetMessage("Resolving current occupancy and effective cadence…");
 try {
  const query = `sheetDate=${enc(sheetDate)}`;
  const [preview, list] = await Promise.all([
  request(`/api/v1/properties/${enc(property)}/housekeeping/sheets/preview?${query}`),
  request(`/api/v1/properties/${enc(property)}/housekeeping/sheets?${query}`),
  ]);
  if (!housekeepingSheetIsCurrent(generation, requestGeneration, property, sheetDate)) return;
  if (!preview || !Array.isArray(preview.rooms) || !list || !Array.isArray(list.sheets)) throw new Error("The housekeeping sheet response was invalid.");
  renderHousekeepingSheetPreview(preview, list.sheets);
  setHousekeepingSheetMessage(`${preview.rooms.length} authoritative room${preview.rooms.length === 1 ? "" : "s"} ready for review.`);
  if (focus) housekeepingSheetPreviewPanel.focus({ preventScroll: true });
  return true;
 } catch (error) {
  if (!housekeepingSheetIsCurrent(generation, requestGeneration, property, sheetDate)) return;
  housekeepingSheetPreviewPanel.hidden = true;
  const message = error instanceof Error ? error.message : "Preview failed";
  const cadenceHelp = /cadence/i.test(message) ? " Update the room profile to daily or on-departure, then preview again." : " Refresh and try again.";
  setHousekeepingSheetMessage(`${message}.${cadenceHelp}`, true);
  if (focus) housekeepingPreviewAction.focus({ preventScroll: true });
  return false;
 } finally {
  if (housekeepingSheetIsCurrent(generation, requestGeneration, property, sheetDate)) updateHousekeepingSheetProgress();
 }
 }
  async function generateHousekeepingSheet() {
 const property = propertySelect.value;
 const sheetDate = housekeepingSheetDate.value;
 const attendantPartyId = String(housekeepingSheetAttendant?.partyId || "");
 if (!property || !/^\d{4}-\d{2}-\d{2}$/.test(sheetDate) || !canonicalUuid(attendantPartyId) ||
  housekeepingSheetPreview.length === 0 || !housekeepingSheetCanGenerate) return;
 const draft = JSON.stringify({ property, sheetDate, attendantPartyId });
 if (housekeepingSheetAttemptDraft !== draft) {
  housekeepingSheetAttemptDraft = draft;
  housekeepingSheetAttemptKey = crypto.randomUUID();
 }
 const generation = housekeepingSheetGeneration;
 const requestGeneration = housekeepingSheetRequestGeneration;
 clearHousekeepingSheetReceipt();
 housekeepingGenerate.disabled = true;
 setHousekeepingSheetMessage(`Generating ${housekeepingSheetPreview.length} governed assigned task${housekeepingSheetPreview.length === 1 ? "" : "s"}…`);
 try {
  const result = await request(`/api/v1/properties/${enc(property)}/housekeeping/sheets/generate`, {
  method: "POST", headers: { "idempotency-key": housekeepingSheetAttemptKey },
  body: JSON.stringify({ sheetDate, attendantPartyId }),
  });
  if (!housekeepingSheetIsCurrent(generation, requestGeneration, property, sheetDate)) return;
  const receipt = parseHousekeepingGenerationReceipt(result, { property, sheetDate, attendantPartyId });
  housekeepingSheetAttemptKey = "";
  housekeepingSheetAttemptDraft = "";
  setHousekeepingSheetMessage(result.replayed ? "The existing sheet was confirmed. Refreshing authoritative tasks…" : "Task sheet generated. Refreshing authoritative tasks…");
  const [previewCurrent] = await Promise.all([previewHousekeepingSheet(), loadHousekeepingBoard()]);
  if (previewCurrent !== true || activeView !== "housekeeping" || property !== propertySelect.value ||
   sheetDate !== housekeepingSheetDate.value || attendantPartyId !== housekeepingSheetAttendant?.partyId ||
   location.pathname !== `/p/${property}/housekeeping` || location.search !== "") return;
  const receiptTitle = renderHousekeepingSheetTaskReceipt(receipt);
  setHousekeepingSheetMessage(result.replayed ? "The existing sheet receipt was confirmed. Open a task to refetch current governed truth." : "Task sheet generated. Open a task to refetch current governed truth.");
  receiptTitle.focus({ preventScroll: true });
 } catch (error) {
  if (!housekeepingSheetIsCurrent(generation, requestGeneration, property, sheetDate)) return;
  clearHousekeepingSheetReceipt();
  if (error?.status === 409) {
  housekeepingSheetAttemptKey = "";
  housekeepingSheetAttemptDraft = "";
  setHousekeepingSheetMessage("Sheet truth changed or another attendant already owns it. Refreshing before another decision…", true);
  await previewHousekeepingSheet();
  } else {
  const message = error instanceof Error ? error.message : "Sheet generation failed";
  setHousekeepingSheetMessage(`${message}. If the Party became inactive or lost the staff role, choose another attendant; otherwise retry keeps the same key.`, true);
  housekeepingGenerate.disabled = false;
  housekeepingGenerate.focus({ preventScroll: true });
  }
  async function loadHousekeepingSheetHistory({ focus = false } = {}) {
 const property = propertySelect.value;
 const sheetDate = housekeepingSheetDate.value;
 if (!property || !/^\d{4}-\d{2}-\d{2}$/.test(sheetDate) || activeView !== "housekeeping") return;
 const generation = ++housekeepingSheetGeneration;
 const requestGeneration = ++housekeepingSheetRequestGeneration;
 setHousekeepingSheetMessage("Loading generated sheets for this date…");
 try {
  const body = await request(`/api/v1/properties/${enc(property)}/housekeeping/sheets?sheetDate=${enc(sheetDate)}`);
  if (!housekeepingSheetIsCurrent(generation, requestGeneration, property, sheetDate)) return;
  if (!body || !Array.isArray(body.sheets)) throw new Error("The generated sheet response was invalid.");
  renderHousekeepingSheetList(body.sheets);
  setHousekeepingSheetMessage(`${body.sheets.length} generated sheet${body.sheets.length === 1 ? "" : "s"} found for this date.`);
  if (focus) $("#housekeeping-sheet-history").focus({ preventScroll: true });
 } catch (error) {
  if (!housekeepingSheetIsCurrent(generation, requestGeneration, property, sheetDate)) return;
  setHousekeepingSheetMessage(error instanceof Error ? error.message : "Generated sheets could not be loaded.", true);
 }
 }
 }
 }
  function setHousekeepingConditionState(state, message = "") {
 housekeepingConditionLoading.hidden = state !== "loading";
 housekeepingConditionError.hidden = state !== "error";
 housekeepingConditionEmpty.hidden = state !== "empty";
 housekeepingConditionList.hidden = state !== "ready";
 housekeepingConditionBoard.setAttribute("aria-busy", String(state === "loading"));
 if (state === "error") housekeepingConditionError.querySelector("p").textContent = message;
  }
  function housekeepingConditionIsCurrent(generation, requestGeneration, property, condition, detailTaskId = "") {
 return generation === housekeepingConditionGeneration
  && requestGeneration === housekeepingConditionRequestGeneration
  && property === propertySelect.value && condition === housekeepingConditionFilter.value
  && activeView === "housekeeping" && (detailTaskId
   ? detailTaskId === housekeepingRouteTaskId && location.pathname === canonicalHousekeepingTaskDetailPath(property, detailTaskId)
   : location.pathname === `/p/${property}/housekeeping`);
  }
  function housekeepingCanonicalInstant(value) {
 if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)) return false;
 const millisecondInstant = `${value.slice(0, 23)}Z`;
 const instant = new Date(millisecondInstant);
 return Number.isFinite(instant.getTime()) && instant.toISOString() === millisecondInstant;
  }
  function housekeepingConditionResult(value) {
 const topKeys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort() : [];
 if (JSON.stringify(topKeys) !== JSON.stringify(["nextCursor", "rooms"]) || !Array.isArray(value.rooms)
  || value.rooms.length > 100 || (value.nextCursor !== null
   && (typeof value.nextCursor !== "string" || value.nextCursor.length === 0 || value.nextCursor.length > 8192))) {
  throw new Error("The room-condition response was invalid.");
 }
 const valid = value.rooms.every((room) => room && typeof room === "object" && !Array.isArray(room)
  && JSON.stringify(Object.keys(room).sort()) === JSON.stringify(["code", "condition", "floor", "spaceId", "updatedAt"])
  && canonicalUuid(String(room.spaceId || "")) && typeof room.code === "string" && room.code.length > 0
  && (room.floor === null || typeof room.floor === "string")
  && Object.hasOwn(HOUSEKEEPING_CONDITION_LABELS, room.condition)
  && housekeepingCanonicalInstant(room.updatedAt));
 if (!valid) throw new Error("The room-condition response contained invalid room truth.");
 return value;
  }
  function clearHousekeepingConditionInitialization() {
 housekeepingConditionInitializationRequestGeneration += 1;
 housekeepingConditionInitialization = null;
 housekeepingConditionInitializationSlot.replaceChildren();
  }
  function clearArrivalRoomCleaningTask() {
 arrivalRoomCleaningTaskRequestGeneration += 1;
 arrivalRoomCleaningTaskRequest = null;
 arrivalRoomCleaningTaskAttempt = null;
 housekeepingConditionInitializationSlot.replaceChildren();
  }
  function housekeepingConditionInitializationIsCurrent(origin, action) {
 return checkInHousekeepingReturn?.property === origin.property
 && checkInHousekeepingReturn?.reservationId === origin.reservationId
 && checkInHousekeepingReturn?.assignedSpaceId === origin.assignedSpaceId
 && checkInHousekeepingReturn?.blocker === origin.blocker
  && checkInHousekeepingReturn === origin.returning
  && activeView === "housekeeping"
  && propertySelect.value === origin.property
  && location.pathname === `/p/${origin.property}/housekeeping`
  && location.search === ""
  && housekeepingConditionGeneration === origin.conditionGeneration
  && housekeepingConditionRequestGeneration === origin.conditionRequestGeneration
  && origin.assignedSpaceId === action?.dataset.spaceId
  && origin.blocker === "room_condition_missing"
  && housekeepingConditionInitialization?.origin === origin
  && housekeepingConditionInitialization?.action === action
  && action.isConnected
  && action.hidden === false
  && housekeepingConditionBoard.contains(action);
  }
  function housekeepingConditionInitializationContextIsCurrent(origin) {
 return origin?.returning === checkInHousekeepingReturn
  && origin.blocker === "room_condition_missing"
  && origin.assignedSpaceId === checkInHousekeepingReturn?.assignedSpaceId
  && origin.reservationId === checkInHousekeepingReturn?.reservationId
  && activeView === "housekeeping"
  && origin.property === propertySelect.value
  && location.pathname === `/p/${origin.property}/housekeeping`
  && location.search === "";
  }
  function housekeepingInitialConditionCandidateResult(value, origin) {
 const topKeys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort() : [];
 const candidate = JSON.stringify(topKeys) === JSON.stringify(["candidate"]) ? value.candidate : null;
 const keys = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? Object.keys(candidate).sort() : [];
 const exactInitialConditions = ["clean", "dirty", "pickup"];
 const allowed = candidate?.allowedInitialConditions;
 if (!candidate || JSON.stringify(keys) !== JSON.stringify(["allowedInitialConditions", "code", "floor", "roomCondition", "spaceId"])
  || candidate.spaceId !== origin.assignedSpaceId || !canonicalUuid(candidate.spaceId)
  || typeof candidate.code !== "string" || candidate.code.length < 1 || candidate.code.length > 120
  || (candidate.floor !== null && typeof candidate.floor !== "string") || candidate.roomCondition !== null
  || !Array.isArray(allowed) || allowed.length > exactInitialConditions.length
  || new Set(allowed).size !== allowed.length || !allowed.every((condition) => exactInitialConditions.includes(condition))
  || JSON.stringify(allowed) !== JSON.stringify(exactInitialConditions.filter((condition) => allowed.includes(condition)))) {
  throw new Error("The initial room-condition candidate response was invalid.");
 }
 return Object.freeze({ ...candidate, allowedInitialConditions: Object.freeze(allowed.slice()) });
  }
  function renderHousekeepingConditionInitialization(origin, candidate) {
 const section = node("section", "housekeeping-condition-initialization");
 section.setAttribute("aria-label", `Initial condition for assigned room ${candidate?.code || ""}`.trim());
 const copy = node("div", "housekeeping-condition-initialization-copy");
 copy.append(
  node("strong", "", candidate ? `Room ${candidate.code} has no recorded condition` : "Checking the assigned room condition"),
  node("p", "muted", "Choose a first canonical condition deliberately. This control never changes an existing condition."),
 );
 const action = node("button", "quiet housekeeping-condition-initialize-action", "Set initial condition");
 action.type = "button";
 action.dataset.spaceId = origin.assignedSpaceId;
 action.setAttribute("aria-expanded", "false");
 action.disabled = !candidate || candidate.allowedInitialConditions.length === 0;
 const status = node("p", "housekeeping-condition-initialization-status", candidate
  ? candidate.allowedInitialConditions.length === 0
   ? "You may view this room, but initialization is not granted."
   : "No condition is selected."
  : "Loading the exact assigned-room candidate…");
 status.setAttribute("role", "status");
 status.setAttribute("aria-live", "polite");
 section.append(copy, action, status);
 housekeepingConditionInitializationSlot.replaceChildren(section);
 housekeepingConditionInitialization = { origin, candidate, action, section, status };
 if (!candidate || candidate.allowedInitialConditions.length === 0) return action;
 const form = node("form", "housekeeping-condition-initialization-form");
 form.id = `housekeeping-condition-initialization-${origin.assignedSpaceId}`;
 form.hidden = true;
 form.setAttribute("aria-busy", "false");
 const fieldset = node("fieldset", "housekeeping-condition-initialization-options");
 fieldset.append(node("legend", "", "Initial room condition"));
 const labels = Object.freeze({ clean: "Clean", dirty: "Dirty", pickup: "Pickup" });
 for (const condition of candidate.allowedInitialConditions) {
  const label = node("label", "housekeeping-condition-initialization-option");
  const input = el("input");
  input.type = "radio";
  input.name = "initial-room-condition";
  input.value = condition;
  input.required = true;
  label.append(input, node("span", "", labels[condition]));
  fieldset.append(label);
 }
 const controls = node("div", "housekeeping-condition-initialization-controls");
 const submit = node("button", "primary", "Record initial condition");
 submit.type = "submit";
 const cancel = node("button", "quiet", "Cancel");
 cancel.type = "button";
 controls.append(submit, cancel);
 form.append(fieldset, controls);
 action.setAttribute("aria-controls", form.id);
 action.addEventListener("click", () => {
  if (!housekeepingConditionInitializationIsCurrent(origin, action)) return;
  const expanded = action.getAttribute("aria-expanded") !== "true";
  action.setAttribute("aria-expanded", String(expanded));
  form.hidden = !expanded;
  if (expanded) form.querySelector('input[name="initial-room-condition"]')?.focus({ preventScroll: true });
 });
 cancel.addEventListener("click", () => {
  form.hidden = true;
  action.setAttribute("aria-expanded", "false");
  status.textContent = "No condition is selected.";
  action.focus({ preventScroll: true });
 });
 form.addEventListener("submit", (event) => void submitHousekeepingConditionInitialization(event, origin, candidate, form, action, status));
 section.insertBefore(form, status);
 return action;
  }
  async function loadHousekeepingInitialConditionCandidate(returning) {
 if (!returning || returning.blocker !== "room_condition_missing" || !returning.assignedSpaceId
  || activeView !== "housekeeping" || returning.property !== propertySelect.value
  || location.pathname !== `/p/${returning.property}/housekeeping` || location.search !== "") return null;
 const origin = Object.freeze({
  ...returning,
  returning,
  conditionGeneration: housekeepingConditionGeneration,
  conditionRequestGeneration: housekeepingConditionRequestGeneration,
 });
 const action = renderHousekeepingConditionInitialization(origin, null);
 if (!housekeepingConditionInitializationIsCurrent(origin, action)) return null;
 const requestGeneration = ++housekeepingConditionInitializationRequestGeneration;
 try {
  const value = await request(`/api/v1/properties/${enc(origin.property)}/housekeeping/conditions/${enc(origin.assignedSpaceId)}/candidate`);
  if (requestGeneration !== housekeepingConditionInitializationRequestGeneration
   || !housekeepingConditionInitializationIsCurrent(origin, action)) return null;
  const candidate = housekeepingInitialConditionCandidateResult(value, origin);
  const refreshedAction = renderHousekeepingConditionInitialization(origin, candidate);
  return housekeepingConditionInitializationIsCurrent(origin, refreshedAction) ? candidate : null;
 } catch (error) {
  if (requestGeneration !== housekeepingConditionInitializationRequestGeneration
   || !housekeepingConditionInitializationIsCurrent(origin, action)) return null;
  if (error?.status === 404) {
   clearHousekeepingConditionInitialization();
   return null;
  }
  action.disabled = true;
  housekeepingConditionInitialization.status.textContent = error?.status === 403
   ? "Initialization is not granted for this property."
   : `${error instanceof Error ? error.message : "The exact room candidate could not be loaded"}. Refresh conditions to retry.`;
  return null;
 }
  }
  function openHousekeepingConditionInitialization(origin) {
 if (!origin || origin.blocker !== "room_condition_missing" || !origin.assignedSpaceId
  || origin !== checkInHousekeepingReturn || origin.property !== propertySelect.value
  || activeView !== "housekeeping" || location.pathname !== `/p/${origin.property}/housekeeping` || location.search !== "") return false;
 clearArrivalRoomCleaningTask();
 void loadHousekeepingInitialConditionCandidate(origin);
 return true;
  }
  function reopenHousekeepingConditionInitialization() {
 const returning = checkInHousekeepingReturn;
 if (returning?.blocker === "room_condition_missing") openHousekeepingConditionInitialization(returning);
  }

  function arrivalRoomCleaningTaskIsCurrent(origin, section) {
 return origin?.returning === checkInHousekeepingReturn
  && origin.blocker === "dirty_room_override_unauthorized"
  && origin.reservationId === checkInHousekeepingReturn?.reservationId
  && origin.assignedSpaceId === checkInHousekeepingReturn?.assignedSpaceId
  && origin.property === propertySelect.value
  && activeView === "housekeeping"
  && location.pathname === `/p/${origin.property}/housekeeping`
  && location.search === ""
  && arrivalRoomCleaningTaskRequest?.origin === origin
  && arrivalRoomCleaningTaskRequest?.section === section
  && section?.isConnected
  && housekeepingConditionInitializationSlot.contains(section);
  }
  function arrivalRoomCleaningCandidateResult(value, origin) {
 const keys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort() : [];
 const candidate = value?.candidate;
 const candidateKeys = candidate && typeof candidate === "object" && !Array.isArray(candidate)
  ? Object.keys(candidate).sort() : [];
 if (JSON.stringify(keys) !== JSON.stringify(["canCreate", "candidate"])
  || typeof value.canCreate !== "boolean"
  || JSON.stringify(candidateKeys) !== JSON.stringify([
   "dueAt", "existingTaskId", "reservationId", "roomCondition", "spaceCode", "spaceId",
  ])
  || candidate.reservationId !== origin.reservationId
  || candidate.spaceId !== origin.assignedSpaceId
  || !canonicalUuid(candidate.spaceId)
  || typeof candidate.spaceCode !== "string" || candidate.spaceCode.length < 1 || candidate.spaceCode.length > 120
  || (candidate.roomCondition !== "dirty" && candidate.roomCondition !== "pickup")
  || typeof candidate.dueAt !== "string" || !Number.isFinite(new Date(candidate.dueAt).getTime())
  || (candidate.existingTaskId !== null && !canonicalUuid(candidate.existingTaskId))
  || (candidate.existingTaskId !== null && value.canCreate)) {
  throw new Error("The arrival cleaning candidate response was invalid.");
 }
 return Object.freeze({ candidate: Object.freeze({ ...candidate }), canCreate: value.canCreate });
  }
  function renderArrivalRoomCleaningTask(origin, state) {
 const section = node("section", "arrival-room-cleaning-task");
 section.setAttribute("aria-label", "Arrival room cleaning task");
 const heading = node("header", "arrival-room-cleaning-task-heading");
 heading.append(
  node("strong", "", state ? `Prepare room ${state.candidate.spaceCode}` : "Checking cleaning-task truth"),
  node("p", "muted", "Create one governed assigned task for this exact dirty or pickup arrival room. Yellow never changes the room condition here."),
 );
 const status = node("p", "arrival-room-cleaning-task-status", state ? "Authoritative candidate loaded." : "Loading authoritative candidate…");
 status.setAttribute("role", "status");
 status.setAttribute("aria-live", "polite");
 section.append(heading, status);
 housekeepingConditionInitializationSlot.replaceChildren(section);
 arrivalRoomCleaningTaskRequest = { origin, section, status, state };
 if (!state) return section;
 if (state.candidate.existingTaskId) {
  const open = node("button", "primary arrival-room-cleaning-task-open", "Open cleaning task");
  open.type = "button";
  open.addEventListener("click", () => {
   if (!arrivalRoomCleaningTaskIsCurrent(origin, section)) return;
   const arrivalReturn = arrivalCleaningCheckInReturnDescriptor(origin, state.candidate.existingTaskId);
   if (!arrivalReturn) return;
   void openHousekeepingTaskDetail(state.candidate.existingTaskId, { trigger: open, arrivalReturn });
  });
  section.append(open);
  status.textContent = "An actionable task already exists; no duplicate was created.";
  return section;
 }
 if (!state.canCreate) {
  status.textContent = "You may review this room, but cleaning-task creation is not granted.";
  return section;
 }
 const form = node("form", "arrival-room-cleaning-task-form");
 const label = node("label", "", "Find active housekeeping staff");
 const query = el("input");
 query.type = "search";
 query.minLength = 2;
 query.maxLength = 120;
 query.autocomplete = "off";
 query.placeholder = "Name or Party ID";
 label.append(query);
 const search = node("button", "secondary", "Search staff");
 search.type = "button";
 const results = node("div", "arrival-room-cleaning-task-results");
 results.setAttribute("role", "region");
 results.setAttribute("aria-live", "polite");
 const selected = node("p", "arrival-room-cleaning-task-selected", "No attendant selected.");
 const create = node("button", "primary", "Create cleaning task");
 create.type = "submit";
 create.disabled = true;
 let attendant = null;
 const choose = (profile) => {
  if (!arrivalRoomCleaningTaskIsCurrent(origin, section)) return;
  attendant = profile;
  selected.textContent = `Selected attendant: ${profile.displayName}`;
  create.disabled = false;
  results.replaceChildren();
  selected.tabIndex = -1;
  selected.focus({ preventScroll: true });
 };
 const searchStaff = async () => {
  if (!arrivalRoomCleaningTaskIsCurrent(origin, section)) return;
  const term = query.value.trim();
  if (term.length < 2) { status.textContent = "Enter at least two characters."; query.focus(); return; }
  const generation = ++arrivalRoomCleaningTaskRequestGeneration;
  search.disabled = true;
  status.textContent = "Searching canonical staff Parties…";
  try {
   const value = await request(`/api/v1/properties/${enc(origin.property)}/parties:search`, {
    method: "POST", body: JSON.stringify({ query: term, limit: 20 }),
   });
   if (generation !== arrivalRoomCleaningTaskRequestGeneration || !arrivalRoomCleaningTaskIsCurrent(origin, section)) return;
   const staff = (Array.isArray(value.profiles) ? value.profiles : []).flatMap((profile) =>
    canonicalUuid(String(profile?.partyId || "")) && typeof profile?.displayName === "string"
    && Array.isArray(profile.roles) && profile.roles.includes("staff")
     ? [Object.freeze({ partyId: profile.partyId, displayName: profile.displayName })] : []);
   results.replaceChildren(...staff.map((profile) => {
    const button = node("button", "quiet", `Choose ${profile.displayName}`);
    button.type = "button";
    button.addEventListener("click", () => choose(profile));
    return button;
   }));
   if (staff.length === 0) results.append(node("p", "field-note", "No active staff-labelled Party matched."));
   status.textContent = `${staff.length} staff result${staff.length === 1 ? "" : "s"}.`;
  } catch (error) {
   if (generation === arrivalRoomCleaningTaskRequestGeneration && arrivalRoomCleaningTaskIsCurrent(origin, section)) {
    status.textContent = error instanceof Error ? error.message : "Staff search failed.";
   }
  } finally {
   if (arrivalRoomCleaningTaskIsCurrent(origin, section)) search.disabled = false;
  }
 };
 search.addEventListener("click", () => void searchStaff());
 query.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); void searchStaff(); }
 });
 form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!attendant || !arrivalRoomCleaningTaskIsCurrent(origin, section)) return;
  const draft = JSON.stringify({ reservationId: origin.reservationId, attendantPartyId: attendant.partyId });
  arrivalRoomCleaningTaskAttempt = arrivalRoomCleaningTaskAttempt?.draft === draft
   ? arrivalRoomCleaningTaskAttempt : { draft, key: crypto.randomUUID() };
  for (const control of form.querySelectorAll("button,input")) control.disabled = true;
  status.textContent = "Creating the governed cleaning task…";
  try {
   const value = await request(`/api/v1/properties/${enc(origin.property)}/reservations/${enc(origin.reservationId)}/arrival-room-cleaning-task`, {
    method: "POST",
    headers: { "Idempotency-Key": arrivalRoomCleaningTaskAttempt.key },
    body: JSON.stringify({ attendantPartyId: attendant.partyId }),
   });
   if (!arrivalRoomCleaningTaskIsCurrent(origin, section) || !canonicalUuid(String(value?.taskId || ""))) return;
   arrivalRoomCleaningTaskAttempt = null;
   status.textContent = value.created ? "Cleaning task created. Opening authoritative task detail…" : "Existing cleaning task found. Opening authoritative detail…";
   await loadHousekeepingBoard();
   if (arrivalRoomCleaningTaskIsCurrent(origin, section)) {
    const arrivalReturn = arrivalCleaningCheckInReturnDescriptor(origin, value.taskId);
    if (!arrivalReturn) return;
    await openHousekeepingTaskDetail(value.taskId, { trigger: create, arrivalReturn });
   }
  } catch (error) {
   if (!arrivalRoomCleaningTaskIsCurrent(origin, section)) return;
   status.textContent = `${error instanceof Error ? error.message : "Task creation failed"}. Retry the unchanged action safely.`;
   for (const control of form.querySelectorAll("button,input")) control.disabled = false;
   create.disabled = attendant === null;
  }
 });
 form.append(label, search, results, selected, create);
 section.append(form);
 return section;
  }
  async function openArrivalRoomCleaningTask(returning) {
 if (!returning || returning.blocker !== "dirty_room_override_unauthorized" || !returning.assignedSpaceId
  || returning !== checkInHousekeepingReturn || returning.property !== propertySelect.value
  || activeView !== "housekeeping" || location.pathname !== `/p/${returning.property}/housekeeping` || location.search !== "") return false;
 clearHousekeepingConditionInitialization();
 const origin = Object.freeze({ ...returning, returning });
 const section = renderArrivalRoomCleaningTask(origin, null);
 const generation = ++arrivalRoomCleaningTaskRequestGeneration;
 try {
  const value = await request(`/api/v1/properties/${enc(origin.property)}/reservations/${enc(origin.reservationId)}/arrival-room-cleaning-task/candidate`);
  if (generation !== arrivalRoomCleaningTaskRequestGeneration || !arrivalRoomCleaningTaskIsCurrent(origin, section)) return false;
  renderArrivalRoomCleaningTask(origin, arrivalRoomCleaningCandidateResult(value, origin));
  return true;
 } catch (error) {
  if (generation !== arrivalRoomCleaningTaskRequestGeneration || !arrivalRoomCleaningTaskIsCurrent(origin, section)) return false;
  if (error?.status === 404) { clearArrivalRoomCleaningTask(); return false; }
  arrivalRoomCleaningTaskRequest.status.textContent = error?.status === 403
   ? "Cleaning-task access is not granted for this property."
   : `${error instanceof Error ? error.message : "Cleaning candidate unavailable"}. Refresh conditions to retry.`;
  return false;
 }
  }
  async function refreshHousekeepingConditionInitializationTruth(origin) {
 if (!housekeepingConditionInitializationContextIsCurrent(origin)) return null;
 await Promise.all([
  loadHousekeepingConditions(),
  loadCheckInReadiness({ preserveDraft: true }),
 ]);
 if (!housekeepingConditionInitializationContextIsCurrent(origin)) return null;
 return loadHousekeepingInitialConditionCandidate(checkInHousekeepingReturn);
  }
  function restoreHousekeepingConditionInitializationFocus(origin, candidate) {
 if (!housekeepingConditionInitializationContextIsCurrent(origin)) return false;
 const action = housekeepingConditionInitialization?.action;
 const exact = candidate && candidate.roomCondition === null && action?.isConnected && action.hidden === false
  && housekeepingConditionBoard.contains(action) ? action : null;
 (exact || housekeepingConditionTitle).focus({ preventScroll: true });
 return true;
  }
  async function submitHousekeepingConditionInitialization(event, origin, candidate, form, action, status) {
 event.preventDefault();
 if (!housekeepingConditionInitializationIsCurrent(origin, action)) return;
 const selected = form.querySelector('input[name="initial-room-condition"]:checked');
 const roomCondition = selected?.value;
 if (!roomCondition || !candidate.allowedInitialConditions.includes(roomCondition)) {
  status.textContent = "Choose one allowed initial condition.";
  form.querySelector('input[name="initial-room-condition"]')?.focus({ preventScroll: true });
  return;
 }
 const body = { expectedRoomCondition: null, roomCondition };
 const draft = JSON.stringify(body);
 const attemptId = `${origin.property}:${origin.assignedSpaceId}`;
 const existing = housekeepingConditionInitializationAttempts.get(attemptId);
 const attempt = existing?.draft === draft ? existing : { draft, key: crypto.randomUUID() };
 housekeepingConditionInitializationAttempts.set(attemptId, attempt);
 form.setAttribute("aria-busy", "true");
 action.disabled = true;
 for (const control of form.elements) control.disabled = true;
 status.classList.remove("error");
 status.textContent = "Recording the first condition from current server truth…";
 try {
  await request(`/api/v1/properties/${enc(origin.property)}/housekeeping/conditions/${enc(origin.assignedSpaceId)}/initialize`, {
   method: "POST",
   headers: { "idempotency-key": attempt.key },
   body: JSON.stringify(body),
  });
  const refreshedCandidate = await refreshHousekeepingConditionInitializationTruth(origin);
  housekeepingConditionInitializationAttempts.delete(attemptId);
  restoreHousekeepingConditionInitializationFocus(origin, refreshedCandidate);
 } catch (error) {
  if (error?.status === 409) {
   const refreshedCandidate = await refreshHousekeepingConditionInitializationTruth(origin);
   housekeepingConditionInitializationAttempts.delete(attemptId);
   restoreHousekeepingConditionInitializationFocus(origin, refreshedCandidate);
   return;
  }
  if (!housekeepingConditionInitializationIsCurrent(origin, action)) return;
  form.setAttribute("aria-busy", "false");
  action.disabled = false;
  for (const control of form.elements) control.disabled = false;
  status.classList.add("error");
  status.textContent = `${error instanceof Error ? error.message : "The first condition could not be recorded"}. Retry keeps the same request key.`;
  selected.focus({ preventScroll: true });
 }
  }
  function housekeepingConditionCard(room) {
 const article = node("article", "housekeeping-condition-card");
 article.setAttribute("role", "listitem");
 article.tabIndex = -1;
 article.dataset.spaceId = room.spaceId;
 article.setAttribute("aria-label", `Room ${room.code}: ${HOUSEKEEPING_CONDITION_LABELS[room.condition]}`);
 const head = node("div", "housekeeping-condition-card-head");
 const identity = node("div", "housekeeping-room-identity");
 identity.append(node("span", "eyebrow", room.floor ? `Floor ${room.floor}` : "Floor not set"), node("h4", "", `Room ${room.code}`));
 head.append(identity, housekeepingBadge("room-condition", HOUSEKEEPING_CONDITION_LABELS[room.condition], room.condition));
 const evidence = node("dl", "housekeeping-evidence");
 evidence.append(node("dt", "", "Condition updated"), node("dd", "", housekeepingDate(room.updatedAt)));
 article.append(head, evidence);
 return article;
  }
  function restoreHousekeepingConditionFocus(target, previousLength) {
 if (activeView !== "housekeeping") return;
 if (target === "more") {
  const appended = housekeepingConditionList.children[previousLength];
  (appended || housekeepingConditionMore).focus({ preventScroll: true });
  return;
 }
 if (target === "filter") housekeepingConditionFilter.focus({ preventScroll: true });
 if (target === "refresh") housekeepingConditionRefresh.focus({ preventScroll: true });
 if (target === "title") housekeepingConditionTitle.focus({ preventScroll: true });
  }
  function renderHousekeepingConditions(page, older, focusTarget) {
 const previousLength = older ? housekeepingConditionRows.length : 0;
 const combined = older ? housekeepingConditionRows.concat(page.rooms) : page.rooms.slice();
 if (new Set(combined.map((room) => room.spaceId)).size !== combined.length) {
  throw new Error("The room-condition response repeated a room across bounded pages.");
 }
 housekeepingConditionRows = combined;
 housekeepingConditionNextCursor = page.nextCursor;
 housekeepingConditionList.replaceChildren(...combined.map(housekeepingConditionCard));
 syncHousekeepingDiscrepancyRooms();
 housekeepingConditionCount.textContent = String(combined.length);
 setHousekeepingConditionState(combined.length === 0 ? "empty" : "ready");
 housekeepingConditionMore.hidden = combined.length === 0 || page.nextCursor === null;
 housekeepingConditionMore.disabled = false;
 const label = housekeepingConditionFilter.value
  ? HOUSEKEEPING_CONDITION_LABELS[housekeepingConditionFilter.value].toLowerCase() : "all conditions";
 housekeepingConditionStatus.textContent = `${combined.length} room${combined.length === 1 ? "" : "s"} loaded for ${label}. This is a bounded loaded count, not a whole-property total.`;
 restoreHousekeepingConditionFocus(focusTarget, previousLength);
  }
  function clearHousekeepingConditionState() {
 housekeepingConditionGeneration += 1;
 housekeepingConditionRequestGeneration += 1;
 clearHousekeepingConditionInitialization();
 clearArrivalRoomCleaningTask();
 housekeepingConditionRows = [];
 housekeepingConditionNextCursor = null;
 housekeepingConditionFilter.value = "";
 housekeepingConditionCount.textContent = "0";
 housekeepingConditionList.replaceChildren();
 syncHousekeepingDiscrepancyRooms();
 housekeepingConditionMore.hidden = true;
 housekeepingConditionMore.disabled = false;
 housekeepingConditionRefresh.disabled = false;
 setHousekeepingConditionState("empty");
 housekeepingConditionStatus.textContent = "Open Housekeeping to load one bounded page.";
  }
  async function loadHousekeepingConditions({ older = false, focus = "", detailTaskId = "" } = {}) {
 const property = propertySelect.value;
 const condition = housekeepingConditionFilter.value;
 if (!property || activeView !== "housekeeping") return;
 const cursor = older ? housekeepingConditionNextCursor : null;
 if (older && cursor === null) return;
 const generation = older ? housekeepingConditionGeneration : ++housekeepingConditionGeneration;
 const requestGeneration = ++housekeepingConditionRequestGeneration;
 const previousRows = housekeepingConditionRows.slice();
 housekeepingConditionRefresh.disabled = true;
 housekeepingConditionMore.disabled = true;
 if (older) {
  housekeepingConditionBoard.setAttribute("aria-busy", "true");
  housekeepingConditionStatus.textContent = "Loading the next bounded room page…";
 } else {
  housekeepingConditionRows = [];
  housekeepingConditionNextCursor = null;
  housekeepingConditionCount.textContent = "0";
  housekeepingConditionMore.hidden = true;
  setHousekeepingConditionState("loading");
  housekeepingConditionStatus.textContent = "Loading canonical room conditions…";
 }
 try {
  const query = new URLSearchParams({ limit: "50" });
  if (condition) query.set("condition", condition);
  if (cursor !== null) query.set("cursor", cursor);
  const page = housekeepingConditionResult(await request(`/api/v1/properties/${enc(property)}/housekeeping/conditions?${query}`));
  if (!housekeepingConditionIsCurrent(generation, requestGeneration, property, condition, detailTaskId)) return;
  renderHousekeepingConditions(page, older, focus);
 } catch (error) {
  if (!housekeepingConditionIsCurrent(generation, requestGeneration, property, condition, detailTaskId)) return;
  const message = error instanceof Error ? error.message : "Room conditions could not be loaded.";
  if (older && previousRows.length > 0) {
   housekeepingConditionRows = previousRows;
   setHousekeepingConditionState("ready");
   housekeepingConditionMore.hidden = housekeepingConditionNextCursor === null;
   housekeepingConditionStatus.textContent = `${message} The ${previousRows.length} already loaded room${previousRows.length === 1 ? " remains" : "s remain"} visible.`;
   housekeepingConditionMore.focus({ preventScroll: true });
  } else {
   housekeepingConditionRows = [];
   housekeepingConditionNextCursor = null;
   housekeepingConditionCount.textContent = "0";
   setHousekeepingConditionState("error", message);
   housekeepingConditionStatus.textContent = error?.status === 403
    ? "Housekeeping room-condition read access is not granted."
    : "No room-condition conclusion was made. Retry this read-only request.";
   if (focus) housekeepingConditionRetry.focus({ preventScroll: true });
  }
  } finally {
  if (housekeepingConditionIsCurrent(generation, requestGeneration, property, condition, detailTaskId)) {
   housekeepingConditionBoard.setAttribute("aria-busy", "false");
   housekeepingConditionRefresh.disabled = false;
   housekeepingConditionMore.disabled = false;
  }
 }
  }
  function housekeepingDiscrepancyIsCurrent(generation, requestGeneration, property) {
 return generation === housekeepingDiscrepancyGeneration
  && requestGeneration === housekeepingDiscrepancyRequestGeneration
  && property === propertySelect.value && activeView === "housekeeping"
  && location.pathname === `/p/${property}/housekeeping` && location.search === ""
  && housekeepingDiscrepancyWorkbench.isConnected && !housekeepingDiscrepancyWorkbench.hidden;
  }
  function housekeepingDiscrepancyRow(value) {
 const keys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort() : [];
 if (JSON.stringify(keys) !== JSON.stringify(["floor", "kind", "reported", "reportedAt", "reportedBy", "spaceCode", "spaceId", "systemState"]) ||
  !canonicalUuid(String(value.spaceId || "")) || typeof value.spaceCode !== "string" || value.spaceCode.length === 0 ||
  (value.floor !== null && typeof value.floor !== "string") || !["sleep", "skip", "person"].includes(value.kind) ||
  typeof value.reported !== "string" || !/^(?:occupied|vacant|persons:(?:[1-9]|[1-9][0-9]))$/.test(value.reported) ||
  typeof value.systemState !== "string" || !/^(?:occupied|vacant|persons:[1-9][0-9]{0,2})$/.test(value.systemState) ||
  !canonicalUuid(String(value.reportedBy || "")) || !housekeepingCanonicalInstant(value.reportedAt)) {
  throw new Error("The unresolved discrepancy response contained invalid room truth.");
 }
 return Object.freeze({ ...value });
  }
  function housekeepingDiscrepancyResult(value) {
 const keys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort() : [];
 if (JSON.stringify(keys) !== JSON.stringify(["discrepancies"]) || !Array.isArray(value.discrepancies) || value.discrepancies.length > 200) {
  throw new Error("The unresolved discrepancy response was invalid.");
 }
 const rows = value.discrepancies.map(housekeepingDiscrepancyRow);
 if (new Set(rows.map((row) => row.spaceId)).size !== rows.length) throw new Error("The unresolved discrepancy response repeated a room.");
 return Object.freeze(rows);
  }
  function syncHousekeepingDiscrepancyRooms() {
 const selected = housekeepingDiscrepancySpace.value;
 const options = [node("option", "", housekeepingConditionRows.length === 0 ? "Load and choose a room" : "Choose an exact loaded room")];
 options[0].value = "";
 for (const room of housekeepingConditionRows) {
  const option = node("option", "", `Room ${room.code}${room.floor ? ` · Floor ${room.floor}` : ""}`);
  option.value = room.spaceId;
  options.push(option);
 }
 housekeepingDiscrepancySpace.replaceChildren(...options);
 housekeepingDiscrepancySpace.value = housekeepingConditionRows.some((room) => room.spaceId === selected) ? selected : "";
 housekeepingDiscrepancySubmit.disabled = housekeepingDiscrepancySpace.value === "";
  }
  function housekeepingDiscrepancyCard(row) {
 const article = node("article", "housekeeping-discrepancy-card");
 article.setAttribute("role", "listitem");
 article.tabIndex = -1;
 article.dataset.spaceId = row.spaceId;
 article.setAttribute("aria-label", `${row.kind} discrepancy for room ${row.spaceCode}`);
 const head = node("div", "housekeeping-discrepancy-card-head");
 const identity = node("div", "housekeeping-room-identity");
 identity.append(node("span", "eyebrow", row.floor ? `Floor ${row.floor}` : "Floor not set"), node("h4", "", `Room ${row.spaceCode}`));
 head.append(identity, housekeepingBadge("discrepancy-kind", row.kind[0].toUpperCase() + row.kind.slice(1), row.kind));
 const evidence = node("dl", "");
 evidence.append(
  node("dt", "", "Observed"), node("dd", "", row.reported),
  node("dt", "", "System"), node("dd", "", row.systemState),
  node("dt", "", "Reported by"), node("dd", "", row.reportedBy),
  node("dt", "", "Reported at"), node("dd", "", housekeepingDate(row.reportedAt)),
 );
 article.append(head, evidence);
 return article;
  }
  function renderHousekeepingDiscrepancies(rows) {
 housekeepingDiscrepancyRows = Object.freeze(rows.slice());
 housekeepingDiscrepancyList.replaceChildren(...rows.map(housekeepingDiscrepancyCard));
 housekeepingDiscrepancyList.hidden = rows.length === 0;
 housekeepingDiscrepancyEmpty.hidden = rows.length !== 0;
 housekeepingDiscrepancyError.hidden = true;
 housekeepingDiscrepancyStatus.textContent = rows.length === 0
  ? "No unresolved room discrepancy is recorded for this property."
  : `${rows.length} unresolved room discrepanc${rows.length === 1 ? "y" : "ies"} loaded from current server truth.`;
  }
  function clearHousekeepingDiscrepancyState() {
 housekeepingDiscrepancyGeneration += 1;
 housekeepingDiscrepancyRequestGeneration += 1;
 housekeepingDiscrepancyRows = Object.freeze([]);
 housekeepingDiscrepancyAttempts.clear();
 housekeepingDiscrepancyList.replaceChildren();
 housekeepingDiscrepancyList.hidden = true;
 housekeepingDiscrepancyEmpty.hidden = true;
 housekeepingDiscrepancyError.hidden = true;
 housekeepingDiscrepancyWorkbench.setAttribute("aria-busy", "false");
 housekeepingDiscrepancyForm.reset();
 housekeepingDiscrepancyPersonsField.hidden = true;
 housekeepingDiscrepancyPersons.disabled = true;
 housekeepingDiscrepancySpace.replaceChildren(Object.assign(node("option", "", "Load and choose a room"), { value: "" }));
 housekeepingDiscrepancySubmit.disabled = true;
 housekeepingDiscrepancyStatus.textContent = "Open Housekeeping to load unresolved discrepancies.";
  }
  async function loadHousekeepingDiscrepancies({ focus = "", focusSpaceId = "" } = {}) {
 const property = propertySelect.value;
 if (!property || activeView !== "housekeeping" || location.pathname !== `/p/${property}/housekeeping` || location.search !== "") return;
 const generation = ++housekeepingDiscrepancyGeneration;
 const requestGeneration = ++housekeepingDiscrepancyRequestGeneration;
 housekeepingDiscrepancyRefresh.disabled = true;
 housekeepingDiscrepancyWorkbench.setAttribute("aria-busy", "true");
 housekeepingDiscrepancyStatus.textContent = "Loading unresolved room discrepancies…";
 try {
  const rows = housekeepingDiscrepancyResult(await request(`/api/v1/properties/${enc(property)}/housekeeping/discrepancies`));
  if (!housekeepingDiscrepancyIsCurrent(generation, requestGeneration, property)) return;
  renderHousekeepingDiscrepancies(rows);
  if (focusSpaceId) {
   const card = [...housekeepingDiscrepancyList.querySelectorAll(".housekeeping-discrepancy-card")]
    .find((candidate) => candidate.dataset.spaceId === focusSpaceId);
   (card || housekeepingDiscrepancyTitle).focus({ preventScroll: true });
  } else if (focus === "refresh") housekeepingDiscrepancyRefresh.focus({ preventScroll: true });
  else if (focus === "title") housekeepingDiscrepancyTitle.focus({ preventScroll: true });
 } catch (error) {
  if (!housekeepingDiscrepancyIsCurrent(generation, requestGeneration, property)) return;
  housekeepingDiscrepancyRows = Object.freeze([]);
  housekeepingDiscrepancyList.replaceChildren();
  housekeepingDiscrepancyList.hidden = true;
  housekeepingDiscrepancyEmpty.hidden = true;
  housekeepingDiscrepancyError.hidden = false;
  housekeepingDiscrepancyError.querySelector("p").textContent = error instanceof Error ? error.message : "Open discrepancies could not be loaded.";
  housekeepingDiscrepancyStatus.textContent = error?.status === 403
   ? "Housekeeping discrepancy read access is not granted."
   : "No discrepancy conclusion was made. Retry this read-only request.";
  if (focus) housekeepingDiscrepancyRetry.focus({ preventScroll: true });
 } finally {
  if (housekeepingDiscrepancyIsCurrent(generation, requestGeneration, property)) {
   housekeepingDiscrepancyRefresh.disabled = false;
   housekeepingDiscrepancyWorkbench.setAttribute("aria-busy", "false");
  }
 }
  }
  function updateHousekeepingDiscrepancyPresence(preserveAttempt = false) {
 const presence = housekeepingDiscrepancyForm.elements.observedPresence.value;
 const occupied = presence === "occupied";
 housekeepingDiscrepancyPersonsField.hidden = !occupied;
 housekeepingDiscrepancyPersons.disabled = !occupied;
 housekeepingDiscrepancyPersons.required = occupied;
 if (!occupied) housekeepingDiscrepancyPersons.value = "";
 if (!preserveAttempt) housekeepingDiscrepancyAttempts.clear();
  }
  async function submitHousekeepingDiscrepancy(event) {
 event.preventDefault();
 const property = propertySelect.value;
 const spaceId = housekeepingDiscrepancySpace.value;
 const observedPresence = housekeepingDiscrepancyForm.elements.observedPresence.value;
 const roomCurrent = housekeepingConditionRows.some((room) => room.spaceId === spaceId);
 if (!property || !roomCurrent || !["occupied", "vacant"].includes(observedPresence)) {
  (!spaceId ? housekeepingDiscrepancySpace : housekeepingDiscrepancyForm.elements.observedPresence[0]).focus({ preventScroll: true });
  housekeepingDiscrepancyStatus.textContent = "Choose one exact loaded room and an explicit observed presence.";
  return;
 }
 const observedPersons = observedPresence === "occupied" ? Number(housekeepingDiscrepancyPersons.value) : null;
 if (observedPresence === "occupied" && (!Number.isInteger(observedPersons) || observedPersons < 1 || observedPersons > 99)) {
  housekeepingDiscrepancyPersons.focus({ preventScroll: true });
  housekeepingDiscrepancyStatus.textContent = "Enter the observed persons from 1 to 99.";
  return;
 }
 const body = { spaceId, observedPresence, observedPersons };
 const draft = JSON.stringify({ property, ...body });
 const attempt = housekeepingDiscrepancyAttempts.get(spaceId)?.draft === draft
  ? housekeepingDiscrepancyAttempts.get(spaceId) : Object.freeze({ draft, key: crypto.randomUUID() });
 housekeepingDiscrepancyAttempts.set(spaceId, attempt);
 const generation = housekeepingDiscrepancyGeneration;
 const requestGeneration = housekeepingDiscrepancyRequestGeneration;
 const form = housekeepingDiscrepancyForm;
 for (const control of form.elements) control.disabled = true;
 housekeepingDiscrepancyRefresh.disabled = true;
 housekeepingDiscrepancyStatus.textContent = "Comparing the explicit observation with current PostgreSQL stay and occupancy truth…";
 try {
  const result = await request(`/api/v1/properties/${enc(property)}/housekeeping/discrepancies`, {
   method: "POST", headers: { "idempotency-key": attempt.key }, body: JSON.stringify(body),
  });
  if (!housekeepingDiscrepancyIsCurrent(generation, requestGeneration, property) || !form.isConnected ||
   housekeepingDiscrepancySpace.value !== spaceId) return;
  if (!result || typeof result !== "object" || typeof result.created !== "boolean" || typeof result.replayed !== "boolean" ||
   (result.discrepancy !== null && (!result.discrepancy || typeof result.discrepancy !== "object"))) {
   throw new Error("The discrepancy report receipt was invalid.");
  }
  housekeepingDiscrepancyAttempts.delete(spaceId);
  const message = result.discrepancy === null
   ? "The observation matches current server truth; no discrepancy was created."
   : `${result.created ? "Discrepancy recorded" : "Existing discrepancy returned"}${result.replayed ? " from the retained request" : ""}.`;
  await Promise.all([loadHousekeepingDiscrepancies({ focusSpaceId: result.discrepancy === null ? "" : spaceId }), loadHousekeepingConditions()]);
  if (activeView === "housekeeping" && propertySelect.value === property && location.pathname === `/p/${property}/housekeeping`) {
   syncHousekeepingDiscrepancyRooms();
   housekeepingDiscrepancyStatus.textContent = message;
   if (result.discrepancy === null) housekeepingDiscrepancyTitle.focus({ preventScroll: true });
  }
 } catch (error) {
  if (!housekeepingDiscrepancyIsCurrent(generation, requestGeneration, property) || !form.isConnected) return;
  housekeepingDiscrepancyStatus.textContent = `${error instanceof Error ? error.message : "The observation could not be reported"} Retry keeps the same request key for this unchanged draft.`;
  housekeepingDiscrepancySpace.focus({ preventScroll: true });
 } finally {
  if (activeView === "housekeeping" && propertySelect.value === property && location.pathname === `/p/${property}/housekeeping` && form.isConnected) {
   for (const control of form.elements) control.disabled = false;
   updateHousekeepingDiscrepancyPresence(true);
   syncHousekeepingDiscrepancyRooms();
   housekeepingDiscrepancyRefresh.disabled = false;
  }
 }
  }
  function canonicalHousekeepingTaskDetailPath(property, taskId) {
 return `/p/${property}/housekeeping/tasks/${taskId}`;
 }
  function housekeepingTaskDetailRouteFromLocation() {
 const match = location.pathname.match(/^\/p\/([0-9a-f-]+)\/housekeeping\/tasks\/([0-9a-f-]+)$/);
 if (!match || !canonicalUuid(match[1]) || !canonicalUuid(match[2])) return null;
 if (location.search) history.replaceState(history.state, "", location.pathname);
 return { property: match[1], taskId: match[2] };
 }
  function housekeepingNavigationRoute() {
 const detail = housekeepingTaskDetailRouteFromLocation();
 if (detail) return { kind: "detail", ...detail };
 const board = location.pathname.match(/^\/p\/([0-9a-f-]+)\/housekeeping$/);
 return board && canonicalUuid(board[1]) ? { kind: "board", property: board[1] } : { kind: "other" };
 }
 function housekeepingTaskDetailResult(value, origin) {
 const envelopeKeys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort().join(",") : "";
 const task = envelopeKeys === "task" ? value.task : null;
 const keys = ["allowedActions", "assigned", "completedAt", "dueAt", "floor", "priority", "roomCondition", "roomUpdatedAt", "spaceCode", "spaceId", "taskId", "taskStatus"];
 const allowedActions = task && Array.isArray(task.allowedActions) ? task.allowedActions : null;
 const allowedAction = allowedActions?.length === 1 ? allowedActions[0] : null;
 const compatibleAction = allowedAction === null ||
  (allowedAction === "start" && task.taskStatus === "assigned" && task.assigned === true) ||
  (allowedAction === "complete" && task.taskStatus === "in_progress" && ["dirty", "pickup"].includes(task.roomCondition)) ||
  (allowedAction === "verify" && task.taskStatus === "done" && task.roomCondition === "clean");
 if (!task || typeof task !== "object" || Array.isArray(task) || Object.keys(task).sort().join(",") !== keys.join(",") ||
  task.taskId !== origin.taskId || !canonicalUuid(task.taskId) || !canonicalUuid(task.spaceId) ||
  !["assigned", "in_progress", "done"].includes(task.taskStatus) ||
  !["clean", "dirty", "pickup", "inspected"].includes(task.roomCondition) ||
  allowedActions === null || allowedActions.length > 1 ||
  (allowedAction !== null && !Object.hasOwn(HOUSEKEEPING_ACTION_LABELS, allowedAction)) || !compatibleAction ||
  typeof task.spaceCode !== "string" || task.spaceCode.length < 1 || task.spaceCode.length > 120 ||
  (task.floor !== null && typeof task.floor !== "string") || typeof task.assigned !== "boolean" ||
  !Number.isInteger(task.priority) || !housekeepingCanonicalInstant(task.roomUpdatedAt) ||
  (task.dueAt !== null && !housekeepingCanonicalInstant(task.dueAt)) ||
  (task.completedAt !== null && !housekeepingCanonicalInstant(task.completedAt))) {
 throw new Error("The server returned invalid housekeeping-task detail.");
 }
 return Object.freeze({ ...task, allowedActions: Object.freeze(allowedActions.slice()) });
 }
  function arrivalCleaningCheckInReturnDescriptor(origin, taskId) {
 const returning = checkInHousekeepingReturnFromState(history.state, propertySelect.value);
 if (!returning || !origin || origin.returning !== checkInHousekeepingReturn ||
  origin.property !== returning.property || origin.reservationId !== returning.reservationId ||
 origin.confirmationNo !== returning.confirmationNo || origin.status !== "due_in" ||
  origin.blocker !== "dirty_room_override_unauthorized" || origin.blocker !== returning.blocker ||
  origin.assignedSpaceId !== returning.assignedSpaceId || origin.roomCondition !== returning.roomCondition ||
  !canonicalUuid(origin.assignedSpaceId) || (origin.roomCondition !== "dirty" && origin.roomCondition !== "pickup") ||
  origin.originPath !== canonicalCheckInWorkbenchPath(origin.property, origin.reservationId) ||
  origin.detailGeneration !== returning.detailGeneration || origin.readinessGeneration !== returning.readinessGeneration ||
  origin.drawerReturnView !== returning.drawerReturnView ||
  returning.originPath !== origin.originPath || !canonicalUuid(taskId) || activeView !== "housekeeping" ||
  location.pathname !== `/p/${origin.property}/housekeeping` || location.search !== "") return null;
 return Object.freeze({
  property: origin.property,
  reservationId: origin.reservationId,
  confirmationNo: origin.confirmationNo,
  status: origin.status,
  blocker: origin.blocker,
  assignedSpaceId: origin.assignedSpaceId,
  roomCondition: origin.roomCondition,
  originPath: origin.originPath,
  detailGeneration: origin.detailGeneration,
  readinessGeneration: origin.readinessGeneration,
  drawerReturnView: origin.drawerReturnView,
  taskId,
  taskPath: canonicalHousekeepingTaskDetailPath(origin.property, taskId),
  housekeepingGeneration,
  housekeepingConditionGeneration,
  taskDetailRequestGeneration: housekeepingTaskDetailRequestGeneration,
 });
  }
  function arrivalCleaningCheckInReturnFromState(state, property, taskId = housekeepingRouteTaskId) {
 const value = state?.arrivalCleaningCheckInReturn;
 const keys = [
  "assignedSpaceId", "blocker", "confirmationNo", "detailGeneration", "drawerReturnView",
  "housekeepingConditionGeneration", "housekeepingGeneration", "originPath", "property",
  "readinessGeneration", "reservationId", "roomCondition", "status", "taskDetailRequestGeneration",
  "taskId", "taskPath",
 ].sort();
 if (state?.yellowSurface !== "housekeeping-task-detail" || !value || typeof value !== "object" || Array.isArray(value) ||
  Object.keys(value).sort().join(",") !== keys.join(",") || value.property !== property || value.taskId !== taskId ||
  !canonicalUuid(value.property) || !canonicalUuid(value.reservationId) || !canonicalUuid(value.assignedSpaceId) ||
  !canonicalUuid(value.taskId) || typeof value.confirmationNo !== "string" || value.confirmationNo.length < 1 ||
  value.confirmationNo.length > 120 || value.status !== "due_in" ||
  value.blocker !== "dirty_room_override_unauthorized" ||
  (value.roomCondition !== "dirty" && value.roomCondition !== "pickup") ||
  value.originPath !== canonicalCheckInWorkbenchPath(value.property, value.reservationId) ||
  value.taskPath !== canonicalHousekeepingTaskDetailPath(value.property, value.taskId) ||
  !Number.isSafeInteger(value.detailGeneration) || value.detailGeneration < 1 ||
  !Number.isSafeInteger(value.readinessGeneration) || value.readinessGeneration < 1 ||
  !Number.isSafeInteger(value.housekeepingGeneration) || value.housekeepingGeneration < 0 ||
  !Number.isSafeInteger(value.housekeepingConditionGeneration) || value.housekeepingConditionGeneration < 0 ||
  !Number.isSafeInteger(value.taskDetailRequestGeneration) || value.taskDetailRequestGeneration < 0 ||
  !["", "today", "vehicles", "vehicle-register"].includes(value.drawerReturnView)) return null;
 return Object.freeze({ ...value });
  }
  function checkInHousekeepingReturnFromArrivalCleaning(returning) {
 if (!returning) return null;
 return Object.freeze({
  property: returning.property,
  reservationId: returning.reservationId,
  confirmationNo: returning.confirmationNo,
  status: returning.status,
  blocker: returning.blocker,
  assignedSpaceId: returning.assignedSpaceId,
  roomCondition: returning.roomCondition,
  originPath: returning.originPath,
  detailGeneration: returning.detailGeneration,
  readinessGeneration: returning.readinessGeneration,
  drawerReturnView: returning.drawerReturnView,
 });
  }
  function rebaseArrivalCleaningCheckInReturn(task) {
 const returning = arrivalCleaningCheckInReturnFromState(history.state, propertySelect.value, task?.taskId);
 if (!returning || task?.taskId !== housekeepingRouteTaskId || task.spaceId !== returning.assignedSpaceId ||
  location.pathname !== returning.taskPath || location.search !== "") return null;
 const current = Object.freeze({
  ...returning,
  housekeepingGeneration,
  housekeepingConditionGeneration,
  taskDetailRequestGeneration: housekeepingTaskDetailRequestGeneration,
 });
 history.replaceState({ ...history.state, arrivalCleaningCheckInReturn: current }, "", current.taskPath);
 checkInHousekeepingReturn = checkInHousekeepingReturnFromArrivalCleaning(current);
 return current;
  }
  function ensureHousekeepingTaskDetailPanel() {
 if (housekeepingTaskDetailPanel?.isConnected) return housekeepingTaskDetailPanel;
 const panel = node("section", "card housekeeping-task-detail-panel");
 panel.hidden = true;
 panel.setAttribute("aria-labelledby", "housekeeping-task-detail-title");
 panel.setAttribute("aria-busy", "false");
 const head = node("div", "housekeeping-task-detail-head");
 const titleCopy = el("div");
 titleCopy.append(node("p", "eyebrow", "Housekeeping task"));
 const title = node("h3", "housekeeping-task-detail-title", "Task detail");
 title.id = "housekeeping-task-detail-title";
 title.tabIndex = -1;
 titleCopy.append(title);
 const actions = node("div", "housekeeping-task-detail-actions");
 const back = node("button", "quiet housekeeping-task-detail-back", "Back to board");
 back.type = "button";
 const refresh = node("button", "secondary housekeeping-task-detail-refresh", "Refresh detail");
 refresh.type = "button";
 actions.append(back, refresh);
 head.append(titleCopy, actions);
 const loading = node("div", "housekeeping-task-detail-loading");
 loading.hidden = true;
 loading.setAttribute("aria-hidden", "true");
 loading.append(el("span"), el("span"), el("span"));
 const error = node("section", "housekeeping-task-detail-error");
 error.hidden = true;
 error.setAttribute("role", "alert");
 const errorCopy = node("p", "", "Housekeeping-task detail is unavailable.");
 const retry = node("button", "secondary housekeeping-task-detail-retry", "Try again");
 retry.type = "button";
 error.append(node("strong", "", "Task detail could not be loaded"), errorCopy, retry);
 const content = node("div", "housekeeping-task-detail-content");
 content.hidden = true;
 panel.append(head, loading, error, content);
 housekeepingView.append(panel);
 back.addEventListener("click", () => closeHousekeepingTaskDetail());
 refresh.addEventListener("click", () => {
  if (housekeepingRouteTaskId) void loadHousekeepingTaskDetail(housekeepingRouteTaskId, { focus: true });
 });
 retry.addEventListener("click", () => {
  if (housekeepingRouteTaskId) void loadHousekeepingTaskDetail(housekeepingRouteTaskId, { focus: true });
 });
 panel.addEventListener("click", (event) => {
  const action = event.target.closest?.(".housekeeping-task-detail-governed-action");
  if (action instanceof HTMLButtonElement && !action.disabled) void submitHousekeepingTaskDetailAction(action);
 });
 housekeepingTaskDetailPanel = panel;
 return panel;
 }
  function arrivalCleaningCheckInReturnIsCurrent(returning, panel, action) {
 const current = arrivalCleaningCheckInReturnFromState(history.state, propertySelect.value, housekeepingRouteTaskId);
 const task = housekeepingTaskDetailData;
 const content = panel?.querySelector(".housekeeping-task-detail-content");
 return current !== null && returning !== null && activeView === "housekeeping" &&
  current.property === returning.property && current.reservationId === returning.reservationId &&
 current.confirmationNo === returning.confirmationNo && current.status === returning.status &&
  current.blocker === returning.blocker && current.assignedSpaceId === returning.assignedSpaceId &&
  current.roomCondition === returning.roomCondition && current.originPath === returning.originPath &&
  current.detailGeneration === returning.detailGeneration && current.readinessGeneration === returning.readinessGeneration &&
  current.drawerReturnView === returning.drawerReturnView &&
  current.housekeepingGeneration === returning.housekeepingGeneration &&
  current.housekeepingConditionGeneration === returning.housekeepingConditionGeneration &&
  current.taskDetailRequestGeneration === returning.taskDetailRequestGeneration &&
  current.taskId === returning.taskId && current.taskPath === returning.taskPath &&
  returning.property === propertySelect.value && returning.taskId === housekeepingRouteTaskId &&
  returning.blocker === "dirty_room_override_unauthorized" &&
  (returning.roomCondition === "dirty" || returning.roomCondition === "pickup") &&
  returning.originPath === canonicalCheckInWorkbenchPath(returning.property, returning.reservationId) &&
  returning.taskPath === canonicalHousekeepingTaskDetailPath(returning.property, returning.taskId) &&
  returning.housekeepingGeneration === housekeepingGeneration &&
  returning.housekeepingConditionGeneration === housekeepingConditionGeneration &&
  returning.taskDetailRequestGeneration === housekeepingTaskDetailRequestGeneration &&
  task?.taskId === returning.taskId && task.spaceId === returning.assignedSpaceId &&
  housekeepingTaskDetailPanel === panel && panel?.isConnected && panel.hidden === false &&
  housekeepingView.classList.contains("is-task-detail") && content?.hidden === false &&
  action?.isConnected && content.contains(action) &&
  action.classList.contains("housekeeping-task-detail-arrival-return") && action.hidden === false && action.disabled === false &&
  action.dataset.taskId === returning.taskId && action.dataset.reservationId === returning.reservationId &&
  action.dataset.blocker === returning.blocker && action.dataset.spaceId === returning.assignedSpaceId &&
  action.dataset.roomCondition === returning.roomCondition && action.dataset.originPath === returning.originPath &&
  location.pathname === returning.taskPath && location.search === "";
  }
  function renderHousekeepingTaskDetailArrivalReturn(panel, task) {
 const returning = rebaseArrivalCleaningCheckInReturn(task);
 if (!returning) return null;
 const wrapper = node("div", "housekeeping-task-detail-arrival-actions");
 const label = task.taskStatus === "done" && task.roomCondition === "clean"
  ? "Continue check-in preparation" : "Back to arrival";
 const action = node("button", "quiet housekeeping-arrival-return housekeeping-task-detail-arrival-return", label);
 action.type = "button";
 action.dataset.taskId = returning.taskId;
 action.dataset.reservationId = returning.reservationId;
 action.dataset.blocker = returning.blocker;
 action.dataset.spaceId = returning.assignedSpaceId;
 action.dataset.roomCondition = returning.roomCondition;
 action.dataset.originPath = returning.originPath;
 action.setAttribute("aria-label", `${label} for ${returning.confirmationNo}`);
 action.addEventListener("click", () => void returnFromArrivalCleaningTaskToCheckIn(action));
 wrapper.append(action);
 return wrapper;
  }
  function housekeepingTaskDetailRequestIsCurrent(origin, panel) {
 return origin.requestGeneration === housekeepingTaskDetailRequestGeneration && activeView === "housekeeping" &&
  origin.property === propertySelect.value && origin.taskId === housekeepingRouteTaskId &&
  panel.isConnected && panel.hidden === false && housekeepingView.classList.contains("is-task-detail") &&
  location.pathname === canonicalHousekeepingTaskDetailPath(origin.property, origin.taskId) && location.search === "";
 }
 function renderHousekeepingTaskDetail(panel, task) {
 panel.querySelector(".housekeeping-task-detail-title").textContent = `Room ${task.spaceCode}`;
 const summary = node("div", "housekeeping-task-detail-summary");
 summary.append(
  housekeepingBadge("task-status", HOUSEKEEPING_STATUS_LABELS[task.taskStatus] || task.taskStatus, task.taskStatus),
  housekeepingBadge("room-condition", HOUSEKEEPING_CONDITION_LABELS[task.roomCondition] || task.roomCondition, task.roomCondition),
  node("span", "housekeeping-task-read-only", "Read only"),
 );
 const facts = node("dl", "housekeeping-task-detail-facts");
 for (const [label, value] of [
  ["Room", task.spaceCode], ["Floor", task.floor || "Not recorded"],
  ["Assignment", task.assigned ? "Assigned" : "Not assigned"], ["Priority", String(task.priority)],
  ["Due", housekeepingDate(task.dueAt)], ["Room evidence", housekeepingDate(task.roomUpdatedAt)],
  ["Completed", housekeepingDate(task.completedAt)],
 ]) facts.append(node("dt", "", label), node("dd", "", value));
 const identifiers = node("details", "housekeeping-task-detail-identifiers");
 identifiers.append(node("summary", "", "Recorded identifiers"));
 const ids = node("dl", "housekeeping-task-detail-facts");
 ids.append(node("dt", "", "Task ID"), node("dd", "", task.taskId),
  node("dt", "", "Space ID"), node("dd", "", task.spaceId));
 identifiers.append(ids);
 const governedAction = node("div", "housekeeping-task-detail-governed-actions");
 const action = task.allowedActions[0] || "";
 if (action) {
  const button = node("button", "primary housekeeping-task-detail-governed-action", HOUSEKEEPING_ACTION_LABELS[action]);
  button.type = "button";
  button.dataset.taskId = task.taskId;
  button.dataset.action = action;
  button.dataset.expectedTaskStatus = task.taskStatus;
  button.dataset.expectedRoomCondition = task.roomCondition;
  button.dataset.expectedRoomUpdatedAt = task.roomUpdatedAt;
  button.setAttribute("aria-label", `${HOUSEKEEPING_ACTION_LABELS[action]} for room ${task.spaceCode}`);
  governedAction.append(button);
 } else {
  governedAction.append(node("p", "field-note housekeeping-task-detail-blocker", "No action is permitted for your current grant and this server state."));
 }
 const content = panel.querySelector(".housekeeping-task-detail-content");
 const arrivalReturn = renderHousekeepingTaskDetailArrivalReturn(panel, task);
 content.replaceChildren(summary, facts, identifiers, governedAction, ...(arrivalReturn ? [arrivalReturn] : []),
  node("p", "field-note", "Task evidence is read only. Any offered lifecycle action remains governed by the server."));
 content.hidden = false;
 panel.querySelector(".housekeeping-task-detail-loading").hidden = true;
 panel.querySelector(".housekeeping-task-detail-error").hidden = true;
 panel.setAttribute("aria-busy", "false");
 }
  function housekeepingTaskDetailActionIsCurrent(origin, panel, button) {
 const task = housekeepingTaskDetailData;
 const content = panel.querySelector(".housekeeping-task-detail-content");
 return origin.requestGeneration === housekeepingTaskDetailRequestGeneration && activeView === "housekeeping" &&
  origin.property === propertySelect.value && origin.taskId === housekeepingRouteTaskId &&
  task !== null && task.taskId === origin.taskId && task.taskStatus === origin.taskStatus &&
  task.roomCondition === origin.roomCondition && task.roomUpdatedAt === origin.roomUpdatedAt &&
  task.allowedActions.length === 1 && task.allowedActions[0] === origin.action &&
  housekeepingTaskDetailPanel === panel && panel.isConnected && panel.hidden === false &&
  housekeepingView.classList.contains("is-task-detail") && content?.hidden === false &&
  button.isConnected && content.contains(button) && button.classList.contains("housekeeping-task-detail-governed-action") &&
  button.dataset.taskId === origin.taskId && button.dataset.action === origin.action &&
  button.dataset.expectedTaskStatus === origin.taskStatus &&
  button.dataset.expectedRoomCondition === origin.roomCondition &&
  button.dataset.expectedRoomUpdatedAt === origin.roomUpdatedAt &&
  location.pathname === canonicalHousekeepingTaskDetailPath(origin.property, origin.taskId) && location.search === "";
  }
  async function refreshHousekeepingTaskDetailActionTruth(origin) {
 await Promise.all([
  loadHousekeepingTaskDetail(origin.taskId, { focus: true }),
  loadHousekeepingBoard({ detailTaskId: origin.taskId }),
  loadHousekeepingConditions({ detailTaskId: origin.taskId }),
 ]);
  }
  async function returnFromArrivalCleaningTaskToCheckIn(action) {
 const panel = housekeepingTaskDetailPanel;
 const returning = arrivalCleaningCheckInReturnFromState(history.state, propertySelect.value, housekeepingRouteTaskId);
 if (!arrivalCleaningCheckInReturnIsCurrent(returning, panel, action)) return false;
 const checkInReturn = checkInHousekeepingReturnFromArrivalCleaning(returning);
 action.disabled = true;
 checkInHousekeepingReturn = checkInReturn;
 reservationDrawerReturnView = returning.drawerReturnView;
 reservationDrawerReturnReservationId = returning.reservationId;
 closeHousekeepingTaskDetail({ history: false, restoreFocus: false });
 history.pushState({ yellowSurface: "reservation-detail" }, "", returning.originPath);
 setView("reservations", false);
 await openReservationDetail(returning.reservationId, { push: false, workbench: "check-in" });
 return true;
  }
  async function exitVerifiedHousekeepingTaskDetail(origin) {
 const arrivalReturn = arrivalCleaningCheckInReturnFromState(history.state, origin.property, origin.taskId);
 const checkInReturn = checkInHousekeepingReturnFromArrivalCleaning(arrivalReturn);
  housekeepingReturnFocus = origin.taskId;
  closeHousekeepingTaskDetail({ history: false, restoreFocus: false });
 if (checkInReturn) history.replaceState({
  yellowSurface: "housekeeping", checkInHousekeepingReturn: checkInReturn,
 }, "", `/p/${origin.property}/housekeeping`);
 else history.replaceState(null, "", `/p/${origin.property}/housekeeping`);
 checkInHousekeepingReturn = checkInReturn;
 syncCheckInHousekeepingContext();
  await Promise.all([loadHousekeepingBoard({ focus: true }), loadHousekeepingConditions()]);
  }
  async function submitHousekeepingTaskDetailAction(button) {
 const task = housekeepingTaskDetailData;
 const panel = housekeepingTaskDetailPanel;
 if (!task || !panel || task.allowedActions.length !== 1) return;
 const origin = Object.freeze({
  requestGeneration: housekeepingTaskDetailRequestGeneration,
  property: propertySelect.value,
  taskId: task.taskId,
  taskStatus: task.taskStatus,
  roomCondition: task.roomCondition,
  roomUpdatedAt: task.roomUpdatedAt,
  action: task.allowedActions[0],
 });
 if (!housekeepingTaskDetailActionIsCurrent(origin, panel, button)) return;
 const body = {
  action: origin.action,
  expectedTaskStatus: origin.taskStatus,
  expectedRoomCondition: origin.roomCondition,
  expectedRoomUpdatedAt: origin.roomUpdatedAt,
 };
 const draft = JSON.stringify({ property: origin.property, taskId: origin.taskId, ...body });
 const existing = housekeepingTaskDetailAttempts.get(origin.taskId);
 const attempt = existing?.draft === draft ? existing : { draft, key: crypto.randomUUID() };
 housekeepingTaskDetailAttempts.set(origin.taskId, attempt);
 button.disabled = true;
 panel.setAttribute("aria-busy", "true");
 housekeepingStatus.textContent = `${HOUSEKEEPING_ACTION_LABELS[origin.action]} using the exact displayed task and room evidence…`;
 try {
  const result = await request(`/api/v1/properties/${enc(origin.property)}/housekeeping/tasks/${enc(origin.taskId)}/transition`, {
   method: "POST", headers: { "idempotency-key": attempt.key }, body: JSON.stringify(body),
  });
  if (!housekeepingTaskDetailActionIsCurrent(origin, panel, button)) return;
  housekeepingTaskDetailAttempts.delete(origin.taskId);
  housekeepingStatus.textContent = result.replayed
   ? "The existing task transition was confirmed. Refreshing authoritative evidence…"
   : "Task transition recorded. Refreshing authoritative evidence…";
  if (origin.action === "verify") await exitVerifiedHousekeepingTaskDetail(origin);
  else await refreshHousekeepingTaskDetailActionTruth(origin);
 } catch (error) {
  if (!housekeepingTaskDetailActionIsCurrent(origin, panel, button)) return;
  if (error?.status === 409) {
   housekeepingTaskDetailAttempts.delete(origin.taskId);
   housekeepingStatus.textContent = "Task or room evidence changed. Refreshing authoritative detail before another action…";
   await refreshHousekeepingTaskDetailActionTruth(origin);
  } else {
   panel.setAttribute("aria-busy", "false");
   housekeepingStatus.textContent = `${error instanceof Error ? error.message : "Task action failed"}. Retry this unchanged action to keep the same idempotency key.`;
   button.disabled = false;
   button.focus({ preventScroll: true });
  }
 }
  }
  async function loadHousekeepingTaskDetail(taskId, { focus = false } = {}) {
 const panel = ensureHousekeepingTaskDetailPanel();
 const origin = Object.freeze({
  requestGeneration: ++housekeepingTaskDetailRequestGeneration,
  property: propertySelect.value,
  taskId,
 });
 panel.setAttribute("aria-busy", "true");
 panel.querySelector(".housekeeping-task-detail-loading").hidden = false;
 panel.querySelector(".housekeeping-task-detail-error").hidden = true;
 panel.querySelector(".housekeeping-task-detail-content").hidden = true;
 panel.querySelector(".housekeeping-task-detail-refresh").disabled = true;
 try {
  const body = await request(`/api/v1/properties/${enc(origin.property)}/housekeeping/tasks/${enc(origin.taskId)}`);
  if (!housekeepingTaskDetailRequestIsCurrent(origin, panel)) return;
  const task = housekeepingTaskDetailResult(body, origin);
  if (!housekeepingTaskDetailRequestIsCurrent(origin, panel)) return;
  housekeepingTaskDetailData = task;
  renderHousekeepingTaskDetail(panel, task);
  housekeepingStatus.textContent = `Exact housekeeping task for room ${task.spaceCode} loaded from server truth.`;
  if (focus) panel.querySelector(".housekeeping-task-detail-title").focus({ preventScroll: true });
 } catch (error) {
  if (!housekeepingTaskDetailRequestIsCurrent(origin, panel)) return;
  housekeepingTaskDetailData = null;
  panel.querySelector(".housekeeping-task-detail-loading").hidden = true;
  panel.querySelector(".housekeeping-task-detail-error").hidden = false;
  panel.querySelector(".housekeeping-task-detail-error p").textContent = error?.status === 404
   ? "This eligible housekeeping task was not found in the current property."
   : error?.status === 409 ? "Stored housekeeping truth is inconsistent; no detail was disclosed."
    : error instanceof Error ? error.message : "The housekeeping-task detail is unavailable.";
  panel.setAttribute("aria-busy", "false");
  housekeepingStatus.textContent = "No housekeeping-task conclusion was made. Retry this read-only request.";
  if (focus) panel.querySelector(".housekeeping-task-detail-retry").focus({ preventScroll: true });
 } finally {
  if (housekeepingTaskDetailRequestIsCurrent(origin, panel)) panel.querySelector(".housekeeping-task-detail-refresh").disabled = false;
 }
 }
  function openHousekeepingTaskDetail(taskId, { push = true, trigger = null, focus = true, arrivalReturn = null } = {}) {
 if (!canonicalUuid(taskId) || !propertySelect.value) return;
 const panel = ensureHousekeepingTaskDetailPanel();
 housekeepingRouteTaskId = taskId;
 housekeepingTaskDetailReturnFocus = trigger || housekeepingTaskDetailReturnFocus;
 if (housekeepingTaskDetailReturnFocus?.isConnected) housekeepingTaskDetailReturnFocus.setAttribute("aria-expanded", "true");
 if (push) history.pushState(arrivalReturn ? {
  yellowSurface: "housekeeping-task-detail", arrivalCleaningCheckInReturn: arrivalReturn,
 } : { yellowSurface: "housekeeping-task-detail" }, "", canonicalHousekeepingTaskDetailPath(propertySelect.value, taskId));
 const contextualReturn = arrivalCleaningCheckInReturnFromState(history.state, propertySelect.value, taskId);
 if (contextualReturn) checkInHousekeepingReturn = checkInHousekeepingReturnFromArrivalCleaning(contextualReturn);
 housekeepingView.classList.add("is-task-detail");
 housekeepingDiscrepancyGeneration += 1;
 housekeepingDiscrepancyRequestGeneration += 1;
 housekeepingDiscrepancyWorkbench.hidden = true;
 panel.hidden = false;
 panel.querySelector(".housekeeping-task-detail-title").focus({ preventScroll: true });
 void loadHousekeepingTaskDetail(taskId, { focus });
 }
  function closeHousekeepingTaskDetail({ history: updateHistory = true, restoreFocus = true } = {}) {
 const returnFocus = housekeepingTaskDetailReturnFocus;
 housekeepingTaskDetailRequestGeneration += 1;
 housekeepingTaskDetailData = null;
 housekeepingRouteTaskId = "";
 housekeepingTaskDetailReturnFocus = null;
 for (const action of housekeepingTaskList.querySelectorAll(".housekeeping-task-detail-action")) action.setAttribute("aria-expanded", "false");
 housekeepingView.classList.remove("is-task-detail");
 if (housekeepingTaskDetailPanel) {
  housekeepingTaskDetailPanel.hidden = true;
  housekeepingTaskDetailPanel.setAttribute("aria-busy", "false");
 }
 if (updateHistory && propertySelect.value) {
  if (history.state?.yellowSurface === "housekeeping-task-detail") history.back();
  else history.replaceState(null, "", `/p/${propertySelect.value}/housekeeping`);
 }
 if (restoreFocus) {
  const target = returnFocus?.isConnected ? returnFocus : document.querySelector("#housekeeping-title");
  target?.focus({ preventScroll: true });
 }
 }
 function syncHousekeepingRoute({ focus = false } = {}) {
 const route = housekeepingNavigationRoute();
 if (route.kind === "detail" && route.property === propertySelect.value) {
  const arrivalReturn = arrivalCleaningCheckInReturnFromState(history.state, route.property, route.taskId);
  openHousekeepingTaskDetail(route.taskId, {
   push: false, focus: true, trigger: generatedHousekeepingTaskAction(route.taskId), arrivalReturn,
  });
  return;
 }
 if (route.kind !== "board" || route.property !== propertySelect.value) return;
 const wasDetail = housekeepingRouteTaskId !== "";
 const returnFocus = housekeepingTaskDetailReturnFocus;
 closeHousekeepingTaskDetail({ history: false, restoreFocus: false });
 housekeepingDiscrepancyWorkbench.hidden = false;
 if (housekeepingDiscrepancyRows.length === 0) void loadHousekeepingDiscrepancies();
 if (housekeepingData.length === 0) void loadHousekeepingBoard({ focus: focus || wasDetail });
 else if (focus || wasDetail) (returnFocus?.isConnected ? returnFocus : document.querySelector("#housekeeping-title"))?.focus({ preventScroll: true });
 }
  function clearHousekeepingTaskDetailState() {
 closeHousekeepingTaskDetail({ history: false, restoreFocus: false });
 housekeepingTaskDetailRequestGeneration += 1;
 }
  function setHousekeepingState(state, message = "") {
 housekeepingLoading.hidden = state !== "loading";
 housekeepingError.hidden = state !== "error";
 housekeepingEmpty.hidden = state !== "empty";
 housekeepingTaskList.hidden = state !== "ready";
 housekeepingView.setAttribute("aria-busy", String(state === "loading"));
 if (state === "error") housekeepingErrorCopy.textContent = message;
 }
  function housekeepingIsCurrent(generation, requestGeneration, property, detailTaskId = "") {
 return generation === housekeepingGeneration && requestGeneration === housekeepingRequestGeneration &&
  property === propertySelect.value && activeView === "housekeeping" &&
  (detailTaskId
   ? detailTaskId === housekeepingRouteTaskId && location.pathname === canonicalHousekeepingTaskDetailPath(property, detailTaskId)
   : location.pathname === `/p/${property}/housekeeping`);
 }
  function housekeepingDate(value, empty = "Not set") {
 if (value === null || value === undefined || value === "") return empty;
 const instant = new Date(String(value));
 if (!Number.isFinite(instant.getTime())) return "Invalid server date";
 return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(instant);
 }
  function housekeepingBadge(className, text, value) {
 const badge = node("span", `housekeeping-badge ${className}`, text);
 badge.dataset.value = value;
 return badge;
 }
  function housekeepingTaskCard(task) {
 const article = node("article", "card housekeeping-task-card");
 article.dataset.taskId = task.taskId;
 const heading = node("div", "housekeeping-task-head");
 const identity = node("div", "housekeeping-room-identity");
 identity.append(node("span", "eyebrow", task.floor ? `Floor ${task.floor}` : "Floor not set"), node("h3", "", `Room ${task.spaceCode}`));
 const badges = node("div", "housekeeping-badges");
 badges.append(
  housekeepingBadge("task-status", HOUSEKEEPING_STATUS_LABELS[task.taskStatus] || "Unknown status", task.taskStatus),
  housekeepingBadge("room-condition", HOUSEKEEPING_CONDITION_LABELS[task.roomCondition] || "Unknown condition", task.roomCondition),
 );
 heading.append(identity, badges);
 const evidence = node("dl", "housekeeping-evidence");
 const values = [
  ["Assignment", task.assigned ? "Assigned" : "Not assigned"],
  ["Priority", String(task.priority)],
  ["Due", housekeepingDate(task.dueAt)],
  ["Room evidence", housekeepingDate(task.roomUpdatedAt)],
 ];
 for (const [term, value] of values) evidence.append(node("dt", "", term), node("dd", "", value));
 const actionArea = node("div", "housekeeping-task-action");
 const detail = node("button", "secondary housekeeping-task-detail-action", "Open details");
 detail.type = "button";
 detail.dataset.taskId = task.taskId;
 detail.setAttribute("aria-label", `Open housekeeping task details for room ${task.spaceCode}`);
 detail.setAttribute("aria-expanded", "false");
 const allowedActions = Array.isArray(task.allowedActions) ? task.allowedActions.slice(0, 1) : [];
 if (allowedActions.length === 1 && HOUSEKEEPING_ACTION_LABELS[allowedActions[0]]) {
  const action = allowedActions[0];
  const button = node("button", "primary housekeeping-action", HOUSEKEEPING_ACTION_LABELS[action]);
  button.type = "button";
  button.dataset.taskId = task.taskId;
  button.dataset.action = action;
  button.dataset.expectedTaskStatus = task.taskStatus;
  button.dataset.expectedRoomCondition = task.roomCondition;
  button.dataset.expectedRoomUpdatedAt = task.roomUpdatedAt;
  button.setAttribute("aria-label", `${HOUSEKEEPING_ACTION_LABELS[action]} for room ${task.spaceCode}`);
  actionArea.append(button);
 } else {
  actionArea.append(node("p", "field-note housekeeping-blocker", "No action is permitted for your current grant and this server state."));
 }
 actionArea.prepend(detail);
 article.append(heading, evidence, actionArea);
 return article;
 }
  function restoreHousekeepingFocus() {
 if (!housekeepingReturnFocus || activeView !== "housekeeping") return;
 const control = [...housekeepingTaskList.querySelectorAll(".housekeeping-task-detail-action,.housekeeping-action")]
  .find((button) => button.dataset.taskId === housekeepingReturnFocus);
 (control || $("#housekeeping-title")).focus({ preventScroll: true });
 housekeepingReturnFocus = "";
 }
 function renderHousekeepingBoard(tasks) {
 housekeepingData = tasks.slice(0, 200);
 housekeepingTaskList.replaceChildren(...housekeepingData.map(housekeepingTaskCard));
 if (housekeepingRouteTaskId) {
  const refreshedReturnFocus = [...housekeepingTaskList.querySelectorAll(".housekeeping-task-detail-action")]
   .find((button) => button.dataset.taskId === housekeepingRouteTaskId);
  if (refreshedReturnFocus) {
   housekeepingTaskDetailReturnFocus = refreshedReturnFocus;
   refreshedReturnFocus.setAttribute("aria-expanded", "true");
  }
 }
 setHousekeepingState(housekeepingData.length === 0 ? "empty" : "ready");
 housekeepingStatus.textContent = `${housekeepingData.length} existing task${housekeepingData.length === 1 ? "" : "s"} shown on this bounded property board.`;
 restoreHousekeepingFocus();
 }
  async function loadHousekeepingBoard({ focus = false, detailTaskId = "" } = {}) {
 const property = propertySelect.value;
 if (!property || activeView !== "housekeeping") return;
 const generation = ++housekeepingGeneration;
 const requestGeneration = ++housekeepingRequestGeneration;
 housekeepingRefresh.disabled = true;
 housekeepingStatus.textContent = "Loading current server task and room-condition evidence…";
 setHousekeepingState("loading");
 try {
  const body = await request(`/api/v1/properties/${enc(property)}/housekeeping/tasks?limit=200`);
  if (!housekeepingIsCurrent(generation, requestGeneration, property, detailTaskId)) return;
  if (!body || !Array.isArray(body.tasks)) throw new Error("The housekeeping board response was invalid.");
  renderHousekeepingBoard(body.tasks);
  if (focus && !housekeepingReturnFocus) $("#housekeeping-title").focus({ preventScroll: true });
 } catch (error) {
  if (!housekeepingIsCurrent(generation, requestGeneration, property, detailTaskId)) return;
  setHousekeepingState("error", error instanceof Error ? error.message : "The housekeeping board is unavailable.");
  housekeepingStatus.textContent = error?.status === 403 ? "Housekeeping read access is not granted." : "Board unavailable; no task state was changed.";
  if (focus) housekeepingRetry.focus({ preventScroll: true });
 } finally {
  if (housekeepingIsCurrent(generation, requestGeneration, property, detailTaskId)) housekeepingRefresh.disabled = false;
 }
 }
  function setReservationBoardState(state, message = "") {
 reservationBoardLoading.hidden = state !== "loading";
 reservationBoardError.hidden = state !== "error";
 reservationBoardEmpty.hidden = state !== "empty";
 reservationBoardContent.hidden = state !== "ready";
 reservationBoard.setAttribute("aria-busy", String(state === "loading"));
 if (state === "error") reservationBoardError.querySelector("p").textContent = message;
 }
  async function submitHousekeepingAction(button) {
 const property = propertySelect.value;
 const taskId = button.dataset.taskId;
 const body = {
  action: button.dataset.action,
  expectedTaskStatus: button.dataset.expectedTaskStatus,
  expectedRoomCondition: button.dataset.expectedRoomCondition,
  expectedRoomUpdatedAt: button.dataset.expectedRoomUpdatedAt,
 };
 const draft = JSON.stringify({ property, taskId, ...body });
 const existing = housekeepingAttempts.get(taskId);
 const attempt = existing?.draft === draft ? existing : { draft, key: crypto.randomUUID() };
 housekeepingAttempts.set(taskId, attempt);
 const generation = housekeepingGeneration;
 button.disabled = true;
 housekeepingStatus.textContent = `${HOUSEKEEPING_ACTION_LABELS[body.action]} using the exact displayed task and room evidence…`;
 try {
  const result = await request(`/api/v1/properties/${enc(property)}/housekeeping/tasks/${enc(taskId)}/transition`, {
  method: "POST", headers: { "idempotency-key": attempt.key }, body: JSON.stringify(body),
  });
  if (generation !== housekeepingGeneration || property !== propertySelect.value || activeView !== "housekeeping") return;
  housekeepingAttempts.delete(taskId);
  housekeepingReturnFocus = taskId;
  housekeepingStatus.textContent = result.replayed ? "The existing task transition was confirmed. Refreshing authoritative evidence…" : "Task transition recorded. Refreshing authoritative evidence…";
  await Promise.all([loadHousekeepingBoard(), loadHousekeepingConditions()]);
 } catch (error) {
  if (generation !== housekeepingGeneration || property !== propertySelect.value || activeView !== "housekeeping") return;
  if (error?.status === 409) {
  housekeepingAttempts.delete(taskId);
  housekeepingReturnFocus = taskId;
  housekeepingStatus.textContent = "Task or room evidence changed. Refreshing the authoritative board before another action…";
  await Promise.all([loadHousekeepingBoard(), loadHousekeepingConditions()]);
  } else {
  housekeepingStatus.textContent = `${error instanceof Error ? error.message : "Task action failed"}. Retry this unchanged action to keep the same idempotency key.`;
  button.disabled = false;
  button.focus({ preventScroll: true });
  }
 }
 }
  function reservationBoardQuery(after = "") {
 const fields = new FormData(reservationBoardForm);
 const query = new URLSearchParams({ limit: "50" });
 const status = String(fields.get("status") || "");
 const fromValue = String(fields.get("from") || "");
 const toValue = String(fields.get("to") || "");
 if (status) query.set("status", status);
 if ((fromValue === "") !== (toValue === "")) throw new Error("Choose both UTC overlap dates, or leave both empty.");
 if (fromValue && toValue) {
  const from = new Date(`${fromValue}Z`);
  const to = new Date(`${toValue}Z`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
  throw new Error("Choose a valid positive UTC overlap period.");
  }
  query.set("from", from.toISOString());
  query.set("to", to.toISOString());
 }
 if (after) query.set("after", after);
 return query;
 }
  function boundedReservationPage(rows) {
 return Array.isArray(rows) ? rows.slice(0, 100) : [];
 }
  function renderReservationBoard(page, older = false) {
 const incoming = boundedReservationPage(page.reservations);
 reservationBoardRows = incoming;
 reservationBoardNextCursor = typeof page.nextCursor === "string" ? page.nextCursor : null;
 reservationBoardRowsTarget.replaceChildren();
 reservationBoardCards.replaceChildren();
 for (const row of incoming) {
  reservationBoardRowsTarget.append(reservationTableRow(row));
  reservationBoardCards.append(reservationCard(row));
 }
 reservationBoardMore.hidden = reservationBoardNextCursor === null;
 const count = reservationBoardRows.length;
 reservationBoardSummary.textContent = `${count} reservation${count === 1 ? "" : "s"} on this bounded page${reservationBoardNextCursor ? " · older records available" : ""}.`;
 reservationBoardStatus.textContent = older ? `Showing the next ${count} older reservation${count === 1 ? "" : "s"}; the previous page was replaced.` : `${count} reservation${count === 1 ? "" : "s"} loaded.`;
 setReservationBoardState(count === 0 ? "empty" : "ready");
 }
  async function loadReservationBoard({ older = false } = {}) {
 const generation = ++reservationBoardGeneration;
 const property = propertySelect.value;
 if (!property) return;
 let query;
 try {
  query = reservationBoardQuery(older ? reservationBoardNextCursor || "" : "");
 } catch (error) {
  setReservationBoardState("error", error instanceof Error ? error.message : "Reservation filters are invalid.");
  reservationBoardStatus.textContent = "Filters need attention.";
  return;
 }
 if (older && !reservationBoardNextCursor) return;
 if (!older) setReservationBoardState("loading");
 reservationBoardMore.disabled = older;
 reservationBoardStatus.textContent = older ? "Loading the next bounded page…" : "Loading reservations…";
 try {
  const page = await request(`/api/v1/properties/${enc(property)}/reservation-board?${query}`);
  if (generation !== reservationBoardGeneration || property !== propertySelect.value) return;
  renderReservationBoard(page, older);
 } catch (error) {
  if (generation !== reservationBoardGeneration || property !== propertySelect.value) return;
  const message = error instanceof Error ? error.message : "The reservation board is unavailable.";
  if (older && reservationBoardRows.length > 0) {
  setReservationBoardState("ready");
  reservationBoardStatus.textContent = `${message} The current page remains visible; try loading the next page again.`;
  } else {
  setReservationBoardState("error", message);
  reservationBoardStatus.textContent = error?.status === 403 ? "Reservation access is not granted." : "Reservation board unavailable.";
  }
 } finally {
  if (generation === reservationBoardGeneration) reservationBoardMore.disabled = false;
 }
 }
  function clearReservationBoardFilters() {
 reservationBoardForm.reset();
 void loadReservationBoard();
 }
  function setReservationCreateStep(step, { push = true, focus = true } = {}) {
 reservationCreateStep = Math.max(1, Math.min(4, Number(step) || 1));
 for (const button of reservationCreateSteps) {
  const active = Number(button.dataset.reservationCreateStep) === reservationCreateStep;
  button.setAttribute("aria-current", active ? "step" : "false");
  button.disabled = Number(button.dataset.reservationCreateStep) > reservationCreateStep &&
  (Number(button.dataset.reservationCreateStep) === 3 && reservationBookingOffers.length === 0 ||
   Number(button.dataset.reservationCreateStep) === 4 && !reservationBookingSelection);
 }
 for (const panel of reservationCreatePanels) panel.hidden = Number(panel.dataset.reservationCreatePanel) !== reservationCreateStep;
 if (push && propertySelect.value) {
  const name = ["stay", "guest", "offer", "review"][reservationCreateStep - 1];
  const route = `/p/${propertySelect.value}/reservations?new=1&step=${name}`;
  if (history.state?.yellowSurface === "reservation-create") history.replaceState({ yellowSurface: "reservation-create" }, "", route);
  else history.pushState({ yellowSurface: "reservation-create" }, "", route);
 }
 if (focus) {
  const heading = $(`[data-reservation-create-panel="${reservationCreateStep}"] h4`);
  if (heading) { heading.tabIndex = -1; heading.focus(); }
 }
 }
  function emptyReservationJourneyState() {
 return { offers: [], selection: null, hold: null, draft: null, dirty: false, step: 1 };
 }
  function reservationExitHistoryAction(state, surface) {
 return state?.yellowSurface === surface ? "back" : "replace";
 }
  function shouldConfirmReservationExit(visible, dirty, destinationKind) {
 return visible && dirty && destinationKind !== "create";
 }
  function allowedReservationCreateStep(requestedStep, prerequisites) {
 const requested = Math.max(1, Math.min(4, Number(requestedStep) || 1));
 if (!prerequisites.active) return 1;
 if (!prerequisites.stay) return 1;
 if (requested === 1) return 1;
 if (!prerequisites.party) return 2;
 if (requested < 4) return requested;
 return prerequisites.offer && prerequisites.draft ? 4 : 3;
 }
  function reservationStayPrerequisiteValid() {
 const fields = reservationBookingForm.elements;
 const controls = [fields.from, fields.to, fields.adults, fields.channelCode];
 if (controls.some((control) => !control.checkValidity())) return false;
 const from = new Date(`${fields.from.value}Z`);
 const to = new Date(`${fields.to.value}Z`);
 if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) return false;
 try { reservationBookingChildAges(fields.childAges.value); } catch { return false; }
 return true;
 }
  function reservationCreatePrerequisites(active) {
 const partyId = reservationBookingForm.elements.primaryPartyId.value;
 const party = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(partyId);
 return {
  active,
  stay: active && reservationStayPrerequisiteValid(),
  party: active && party,
  offer: active && reservationBookingSelection !== null,
  draft: active && reservationBookingDraft !== null && reservationBookingDraft.primaryPartyId === partyId,
 };
 }
  function resetReservationCreateJourney() {
 const empty = emptyReservationJourneyState();
 reservationBookingSearchGeneration += 1;
 reservationBookingOffers = empty.offers;
 reservationBookingSelection = empty.selection;
 reservationBookingHold = empty.hold;
 reservationBookingDraft = empty.draft;
 reservationCreateDirty = empty.dirty;
 reservationCreateStep = empty.step;
 reservationCreateProperty = "";
 reservationBookingForm.reset();
 resetReservationStayDates();
 clearPartyProfileState();
 reservationBookingOptions.replaceChildren();
 clearReservationBookingSelection();
 reservationOfferRetry.hidden = true;
 reservationBookingConfirmation.hidden = true;
 reservationBookingConfirmation.querySelector("strong").textContent = "";
 reservationBookingConfirmation.querySelector("small").textContent = "";
 reservationBookingMessage.textContent = "";
 reservationBookingMessage.classList.remove("error");
 formMessage(reservationBookingForm, "Enter the stay, then continue to a server Party.");
 for (const key of pendingKeys.keys()) {
  if (key.startsWith("reservation-booking-")) pendingKeys.delete(key);
 }
 }
  function openReservationCreate({ push = true } = {}) {
 closeReservationDetail({ history: false, restoreFocus: false, preserveCheckInHousekeepingReturn: true });
 resetReservationCreateJourney();
 reservationBoard.hidden = true;
 reservationCreatePanel.hidden = false;
 reservationCreateProperty = propertySelect.value;
 setReservationCreateStep(1, { push, focus: false });
 $("#reservation-booking-title").focus();
 }
  function closeReservationCreate({ history: updateHistory = true, force = false } = {}) {
 if (reservationCreatePanel.hidden) return true;
 if (!force && reservationCreateDirty && !confirm("Discard this unfinished reservation? Entered details will be lost.")) return false;
 resetReservationCreateJourney();
 reservationCreatePanel.hidden = true;
 reservationBoard.hidden = false;
 if (updateHistory && propertySelect.value) {
  if (reservationExitHistoryAction(history.state, "reservation-create") === "back") history.back();
  else history.replaceState(null, "", `/p/${propertySelect.value}/reservations`);
 }
 reservationCreateOpen.focus();
 return true;
 }
  function detailSection(title, values) {
 const section = node("section", "reservation-detail-section");
 const heading = node("h4", "", title);
 const list = el("dl");
 for (const [label, value] of values) {
  const term = node("dt", "", label);
  const detail = node("dd", "", value === null || value === "" ? "Not recorded" : String(value));
  list.append(term, detail);
 }
 section.append(heading, list);
 return section;
 }
  function detailCollection(title, items, copy) {
 const section = node("section", "reservation-detail-section");
 const heading = node("h4", "", title);
 const list = el("ul");
 if (items.length === 0) {
  const empty = node("li", "", `No ${title.toLowerCase()} recorded.`);
  list.append(empty);
 } else {
  for (const item of items) {
  const row = node("li", "", copy(item));
  list.append(row);
  }
 }
 section.append(heading, list);
 return section;
 }
  function reservationLifecycleFromDetail(result) {
 const reservation = result.reservation;
 return {
  reservationId: reservation.reservationId,
  confirmationNo: reservation.confirmationNo,
  status: reservation.status,
  fields: {
  notes: reservation.notes,
  eta: reservation.eta,
  etd: reservation.etd,
  marketCode: reservation.marketCode,
  sourceCode: reservation.sourceCode,
  originCode: reservation.originCode,
  },
  actions: {
  canModify: result.actions?.canModify === true,
  canCancel: result.actions?.canCancel === true,
  canReinstate: result.actions?.canReinstate === true,
  },
 };
 }
  function clearReservationDrawerLifecycle() {
 restoreReservationGuestEditorHome();
 restoreReservationSegmentEditorHome();
 restoreReservationTravelEditorHome();
 reservationLifecycleData = null;
 reservationMetadataForm.hidden = true;
 reservationCancelForm.hidden = true;
 reservationReinstatePanel.hidden = true;
 reservationMetadataForm.reset();
 reservationCancelForm.reset();
 lifecycleCommandMessage.textContent = "";
 lifecycleCommandMessage.classList.remove("error");
 reservationLifecycleEditor.hidden = true;
 if (reservationLifecycleEditor.parentElement !== reservationLifecycleHome) {
  reservationLifecycleHome.append(reservationLifecycleEditor);
 }
 reservationDetailActions.replaceChildren();
 reservationDetailActions.hidden = true;
 }
  function restoreReservationGuestEditorHome() {
 reservationGuestRequestGeneration += 1;
 reservationGuestData = null;
 reservationGuestForm.hidden = true;
 reservationGuestForm.reset();
 reservationGuestList.replaceChildren();
 reservationConfirmation.textContent = "—";
 reservationStatus.textContent = "—";
 reservationShareTotal.textContent = "No sharers · primary share must stay empty.";
 const message = reservationGuestForm.querySelector(".form-message");
 message.textContent = "";
 message.classList.remove("error");
 if (reservationGuestForm.parentElement !== reservationGuestHome) {
  reservationGuestHome.append(reservationGuestForm);
 }
 }
  function restoreReservationSegmentEditorHome() {
 reservationSegmentRequestGeneration += 1;
 reservationSegmentData = null;
 reservationSegmentEditor.hidden = true;
 reservationDepartureForm.hidden = true;
 reservationRoomMoveForm.hidden = true;
 segmentCommandMessage.textContent = "";
 segmentCommandMessage.classList.remove("error");
 if (reservationSegmentEditor.parentElement !== reservationSegmentHome) {
  reservationSegmentHome.append(reservationSegmentEditor);
 }
 }
  function restoreReservationTravelEditorHome() {
 reservationTravelRequestGeneration += 1;
 reservationTravelData = null;
 reservationTravelForm.hidden = true;
 reservationTravelForm.reset();
 reservationTravelForm.setAttribute("aria-busy", "false");
 reservationTravelForm.querySelector("button[type=submit]").disabled = false;
 reservationTravelConfirmation.textContent = "—";
 reservationTravelStatus.textContent = "—";
 reservationTravelSummary.textContent = "No travel direction loaded.";
 reservationTravelForm.querySelector(".form-message").textContent = "";
 reservationTravelForm.querySelector(".form-message").classList.remove("error");
 if (reservationTravelForm.parentElement !== reservationTravelHome) {
  reservationTravelHome.append(reservationTravelForm);
 }
 }
  function drawerLifecycleButton(label, target) {
 const button = el("button");
 button.type = "button";
 button.className = "secondary";
 button.textContent = label;
 button.setAttribute("aria-controls", target.id);
 button.setAttribute("aria-expanded", "false");
 button.addEventListener("click", () => {
  const stayChangesPanel = reservationDetailActions.querySelector(".reservation-stay-changes-panel");
  if (stayChangesPanel && !stayChangesPanel.hidden) {
  stayChangesPanel.hidden = true;
  restoreReservationSegmentEditorHome();
  }
  const guestAllocationPanel = reservationDetailActions.querySelector(".reservation-guest-allocation-panel");
  if (guestAllocationPanel && !guestAllocationPanel.hidden) {
  guestAllocationPanel.hidden = true;
  restoreReservationGuestEditorHome();
  }
  const travelPanel = reservationDetailActions.querySelector(".reservation-travel-panel");
  if (travelPanel && !travelPanel.hidden) {
  travelPanel.hidden = true;
  restoreReservationTravelEditorHome();
  }
  for (const peer of reservationDetailActions.querySelectorAll(".reservation-detail-action-menu button")) {
  peer.setAttribute("aria-expanded", String(peer === button));
  }
  reservationMetadataForm.hidden = target !== reservationMetadataForm;
  reservationCancelForm.hidden = target !== reservationCancelForm;
  reservationReinstatePanel.hidden = target !== reservationReinstatePanel;
  reservationLifecycleEditor.hidden = false;
  target.hidden = false;
  target.querySelector("textarea, input, button")?.focus();
 });
 return button;
 }
  function reservationDrawerActionNames(actions) {
 const names = [];
 if (actions.canModify === true) names.push("modify");
 if (actions.canCancel === true) names.push("cancel");
 if (actions.canReinstate === true) names.push("reinstate");
 return names;
 }
  function renderReservationDrawerLifecycle(result) {
 const lifecycle = reservationLifecycleFromDetail(result);
 const actionNames = reservationDrawerActionNames(lifecycle.actions);
 const menu = node("div", "reservation-detail-action-menu");
 const preparation = reservationOperationalPreparation(result.reservation.status);
 const plainDetailPath = `/p/${propertySelect.value}/res/${result.reservation.reservationId}`;
 if (preparation && currentReservationWorkbench === null && location.pathname === plainDetailPath && location.search === "") {
  const action = node("button", "primary reservation-operational-preparation-action", preparation.label);
  action.type = "button";
  action.setAttribute("aria-label", `${preparation.label} for reservation ${result.reservation.confirmationNo}`);
  const origin = Object.freeze({
   property: propertySelect.value,
   reservationId: result.reservation.reservationId,
   confirmationNo: result.reservation.confirmationNo,
   status: result.reservation.status,
   workbench: preparation.workbench,
   detailGeneration: reservationDetailGeneration,
  });
  action.addEventListener("click", () => openReservationOperationalPreparation(origin, action));
  menu.append(action);
 }
 const stayChangesPanel = node("section", "reservation-stay-changes-panel");
 stayChangesPanel.id = "reservation-stay-changes-panel";
 stayChangesPanel.hidden = true;
 const stayChangesHeading = node("h4", "", "Stay changes");
 stayChangesHeading.id = "reservation-stay-changes-heading";
 stayChangesPanel.setAttribute("aria-labelledby", stayChangesHeading.id);
 stayChangesPanel.append(stayChangesHeading,
  node("p", "muted", "Authoritative segment history and server-permitted departure or room changes for this reservation."));
 const stayChangesAction = el("button");
 stayChangesAction.type = "button";
 stayChangesAction.className = "secondary reservation-stay-changes-action";
 stayChangesAction.textContent = "Stay changes";
 stayChangesAction.setAttribute("aria-controls", stayChangesPanel.id);
 stayChangesAction.setAttribute("aria-expanded", "false");
 stayChangesAction.addEventListener("click", () => {
  for (const peer of reservationDetailActions.querySelectorAll(".reservation-detail-action-menu button")) {
  peer.setAttribute("aria-expanded", String(peer === stayChangesAction));
  }
  reservationMetadataForm.hidden = true;
  reservationCancelForm.hidden = true;
  reservationReinstatePanel.hidden = true;
  reservationLifecycleEditor.hidden = true;
  const guestAllocationPanel = reservationDetailActions.querySelector(".reservation-guest-allocation-panel");
  if (guestAllocationPanel) guestAllocationPanel.hidden = true;
  restoreReservationGuestEditorHome();
  const travelPanel = reservationDetailActions.querySelector(".reservation-travel-panel");
  if (travelPanel) travelPanel.hidden = true;
  restoreReservationTravelEditorHome();
  stayChangesPanel.hidden = false;
  void openReservationStayChanges(result.reservation, { focus: true });
 });
 menu.append(stayChangesAction);
 const guestAllocationPanel = node("section", "reservation-guest-allocation-panel");
 guestAllocationPanel.id = "reservation-guest-allocation-panel";
 guestAllocationPanel.hidden = true;
 const guestAllocationHeading = node("h4", "", "Guests & shares");
 guestAllocationHeading.id = "reservation-guest-allocation-heading";
 guestAllocationPanel.setAttribute("aria-labelledby", guestAllocationHeading.id);
 guestAllocationPanel.append(guestAllocationHeading,
  node("p", "muted", "Authoritative guest occurrence and exact server-governed sharing for this reservation."));
 const guestAllocationAction = el("button");
 guestAllocationAction.type = "button";
 guestAllocationAction.className = "secondary reservation-guest-allocation-action";
 guestAllocationAction.textContent = "Guests & shares";
 guestAllocationAction.setAttribute("aria-controls", guestAllocationPanel.id);
 guestAllocationAction.setAttribute("aria-expanded", "false");
 guestAllocationAction.addEventListener("click", () => {
  for (const peer of reservationDetailActions.querySelectorAll(".reservation-detail-action-menu button")) {
  peer.setAttribute("aria-expanded", String(peer === guestAllocationAction));
  }
  reservationMetadataForm.hidden = true;
  reservationCancelForm.hidden = true;
  reservationReinstatePanel.hidden = true;
  reservationLifecycleEditor.hidden = true;
  stayChangesPanel.hidden = true;
  restoreReservationSegmentEditorHome();
  const travelPanel = reservationDetailActions.querySelector(".reservation-travel-panel");
  if (travelPanel) travelPanel.hidden = true;
  restoreReservationTravelEditorHome();
  guestAllocationPanel.hidden = false;
  void openReservationGuestAllocation(result.reservation, { focus: true });
 });
 menu.append(guestAllocationAction);
 const travelPanel = node("section", "reservation-travel-panel");
 travelPanel.id = "reservation-travel-panel";
 travelPanel.hidden = true;
 const travelHeading = node("h4", "", "Travel details");
 travelHeading.id = "reservation-travel-heading";
 travelHeading.tabIndex = -1;
 travelPanel.setAttribute("aria-labelledby", travelHeading.id);
 travelPanel.append(travelHeading,
  node("p", "muted", "Record one exact arrival or departure leg. Pickup requests record intent only and never claim a linked task."));
 const travelAction = el("button");
 travelAction.type = "button";
 travelAction.className = "secondary reservation-travel-action";
 travelAction.textContent = "Travel details";
 travelAction.setAttribute("aria-controls", travelPanel.id);
 travelAction.setAttribute("aria-expanded", "false");
 travelAction.addEventListener("click", () => {
  for (const peer of reservationDetailActions.querySelectorAll(".reservation-detail-action-menu button")) {
  peer.setAttribute("aria-expanded", String(peer === travelAction));
  }
  reservationMetadataForm.hidden = true;
  reservationCancelForm.hidden = true;
  reservationReinstatePanel.hidden = true;
  reservationLifecycleEditor.hidden = true;
  stayChangesPanel.hidden = true;
  guestAllocationPanel.hidden = true;
  restoreReservationSegmentEditorHome();
  restoreReservationGuestEditorHome();
  travelPanel.hidden = false;
  void openReservationTravelEditor(result.reservation, { focus: true });
 });
 if (lifecycle.actions.canModify) menu.append(travelAction);
 if (actionNames.length > 0) {
  renderReservationLifecycle(lifecycle);
  reservationMetadataForm.hidden = true;
  reservationCancelForm.hidden = true;
  reservationReinstatePanel.hidden = true;
 }
 for (const name of actionNames) {
  if (name === "modify") menu.append(drawerLifecycleButton("Edit details", reservationMetadataForm));
  if (name === "cancel") menu.append(drawerLifecycleButton("Cancel", reservationCancelForm));
  if (name === "reinstate") menu.append(drawerLifecycleButton("Reinstate", reservationReinstatePanel));
 }
 reservationDetailActions.append(menu, stayChangesPanel, guestAllocationPanel, travelPanel);
 if (actionNames.length > 0) {
  reservationDetailActions.append(reservationLifecycleEditor);
  reservationLifecycleEditor.hidden = false;
 }
 reservationDetailActions.hidden = false;
 }
  function renderReservationFolios(result) {
 const reservation = result.reservation;
 const folios = Array.isArray(reservation.folios) ? reservation.folios : [];
 reservationDetailFolioList.replaceChildren();
 reservationDetailFolios.hidden = false;
 reservationPrimaryFolioMessage.textContent = "";
 for (const folio of folios) {
  const button = el("button");
  button.type = "button";
  button.className = "reservation-folio-open";
  button.dataset.folioId = folio.folioId;
  const identity = node("strong", "", folio.folioNo || `Window ${String(folio.windowNo)}`);
  const state = node("small", "", `Window ${String(folio.windowNo)} · ${folio.status}`);
  button.append(identity, state);
  button.setAttribute("aria-label", `Open folio ${folio.folioNo || folio.folioId}, window ${String(folio.windowNo)}, ${folio.status}`);
  button.addEventListener("click", () => openReservationFolioWorkspace(folio.folioId, {
   source: "existing", control: button,
  }));
  reservationDetailFolioList.append(button);
 }
 const canOpen = folios.length === 0 && result.actions?.canOpenPrimaryFolio === true;
 reservationPrimaryFolioCreate.hidden = !canOpen;
 reservationPrimaryFolioCreate.disabled = false;
 if (folios.length === 0 && !canOpen) {
  const empty = node("p", "muted", "No primary folio is available for an explicit command in the current server state.");
  reservationDetailFolioList.append(empty);
 }
 }
  function primaryFolioResult(value) {
 const keys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort() : [];
 const expected = ["changed", "folioId", "folioNo", "replayed", "reservationId", "windowNo"];
 if (JSON.stringify(keys) !== JSON.stringify(expected)
  || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.folioId)
  || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.reservationId)
  || typeof value.folioNo !== "string" || value.folioNo.length < 1 || value.folioNo.length > 120
  || value.windowNo !== 1 || typeof value.changed !== "boolean" || typeof value.replayed !== "boolean") {
  throw new Error("The server returned an invalid primary folio result.");
 }
 return value;
 }
  async function openPrimaryFolio() {
 if (!reservationDetailData || reservationPrimaryFolioCreate.hidden) return;
 const generation = reservationDetailGeneration;
 const property = propertySelect.value;
 const reservationId = reservationDetailData.reservation.reservationId;
 if (reservationPrimaryFolioReservationId !== reservationId) {
  reservationPrimaryFolioReservationId = reservationId;
  reservationPrimaryFolioAttemptKey = crypto.randomUUID();
 }
 const attemptKey = reservationPrimaryFolioAttemptKey;
 reservationPrimaryFolioCreate.disabled = true;
 reservationPrimaryFolioMessage.classList.remove("error");
 reservationPrimaryFolioMessage.textContent = "Creating or resolving the primary folio from server truth…";
 try {
  const result = primaryFolioResult(await request(`/api/v1/properties/${enc(property)}/reservations/${enc(reservationId)}/primary-folio`, {
  method: "POST", headers: { "idempotency-key": attemptKey }, body: "{}",
  }));
  if (generation !== reservationDetailGeneration || property !== propertySelect.value || reservationRouteReservationId !== reservationId) return;
  if (result.reservationId !== reservationId || typeof result.folioId !== "string") throw new Error("The server returned a different reservation or folio.");
  reservationPrimaryFolioMessage.textContent = result.replayed
  ? "The existing primary folio was confirmed. Opening its immutable statement…"
  : result.changed ? "Primary folio created. Opening its immutable statement…" : "Primary folio already existed. Opening its immutable statement…";
  openReservationFolioWorkspace(result.folioId, {
   source: "primary-receipt", control: reservationPrimaryFolioCreate, receipt: result, detailGeneration: generation,
  });
 } catch (error) {
  if (generation !== reservationDetailGeneration || property !== propertySelect.value || reservationRouteReservationId !== reservationId) return;
  reservationPrimaryFolioMessage.classList.add("error");
  reservationPrimaryFolioMessage.textContent = `${error instanceof Error ? error.message : "The primary folio could not be confirmed"}. Retry keeps the same idempotency key.`;
 } finally {
  if (generation === reservationDetailGeneration && property === propertySelect.value && reservationRouteReservationId === reservationId) {
  reservationPrimaryFolioCreate.disabled = false;
  }
 }
 }
  function clearDueInRoomAssignment({ preserveAttempt = false } = {}) {
 dueInRoomAssignmentRequestGeneration += 1;
 dueInRoomAssignmentData = null;
 dueInRoomAssignmentOrigin = null;
 dueInRoomAssignment.hidden = true;
 dueInRoomAssignment.setAttribute("aria-busy", "false");
 dueInRoomAssignmentForm.setAttribute("aria-busy", "false");
 dueInRoomAssignmentCandidates.replaceChildren();
 dueInRoomAssignmentSubmit.disabled = true;
 dueInRoomAssignmentRefresh.disabled = false;
 dueInRoomAssignmentClose.disabled = false;
 dueInRoomAssignmentMessage.textContent = "";
 dueInRoomAssignmentMessage.classList.remove("error");
 if (!preserveAttempt) dueInRoomAssignmentAttempt = null;
 }
  function dueInRoomAssignmentSegment() {
 const segments = reservationDetailData?.reservation?.segments;
 if (!Array.isArray(segments) || segments.length < 1) return null;
 const latest = segments.reduce((selected, segment) =>
  !selected || segment.sequence > selected.sequence ? segment : selected, null);
 if (!latest || latest.status !== "booked" || latest.sellableUnitId !== null ||
  !canonicalUuid(latest.segmentId) || !canonicalUuid(latest.unitTypeId) ||
  typeof latest.from !== "string" || typeof latest.to !== "string") return null;
 return latest;
 }
  function dueInRoomAssignmentActionIsCurrent(origin, action) {
 const reservation = reservationDetailData?.reservation;
 const segment = dueInRoomAssignmentSegment();
 const item = checkInBlockers.querySelector('li[data-blocker="room_assignment_missing"]');
 return origin === dueInRoomAssignmentOrigin && activeView === "reservations" &&
  currentReservationWorkbench === "check-in" && origin.detailGeneration === reservationDetailGeneration &&
  origin.readinessGeneration === checkInReadinessGeneration && origin.property === propertySelect.value &&
  origin.reservationId === reservationRouteReservationId && reservation?.reservationId === origin.reservationId &&
  reservation.confirmationNo === origin.confirmationNo && reservation.status === "due_in" &&
  origin.expectedReservationStatus === "due_in" && origin.expectedSegmentStatus === "booked" &&
  segment?.segmentId === origin.segmentId && segment.sequence === origin.segmentSequence &&
  segment.status === "booked" && segment.unitTypeId === origin.expectedUnitTypeId &&
  segment.sellableUnitId === null && segment.from === origin.expectedPeriod.from &&
  segment.to === origin.expectedPeriod.to && checkInReadinessData?.reservationId === origin.reservationId &&
  checkInReadinessData.status === "due_in" && checkInReadinessData.segmentId === origin.segmentId &&
  checkInReadinessData.assignedSpaceId === null &&
  checkInReadinessData.blockers.includes("room_assignment_missing") &&
  origin.originPath === canonicalCheckInWorkbenchPath(origin.property, origin.reservationId) &&
  `${location.pathname}${location.search}` === origin.originPath && checkInWorkbench.hidden === false &&
  reservationDetailDrawer.isConnected && reservationDetailDrawer.hidden === false &&
  item?.isConnected && checkInBlockers.contains(item) && item.dataset.blocker === "room_assignment_missing" &&
  action?.isConnected && action.hidden === false && action.disabled === false && item.contains(action) &&
  action.dataset.reservationId === origin.reservationId && action.dataset.segmentId === origin.segmentId;
 }
  function dueInRoomAssignmentResult(value, origin) {
 const keys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort() : [];
 if (keys.join(",") !== "candidates" || !Array.isArray(value.candidates)) {
  throw new Error("The room-assignment candidate response was invalid.");
 }
 const sellableUnits = new Set();
 const spaces = new Set();
 const candidates = value.candidates.map((candidate) => {
  const candidateKeys = candidate && typeof candidate === "object" && !Array.isArray(candidate)
   ? Object.keys(candidate).sort().join(",") : "";
  if (candidateKeys !== "floor,roomCondition,sellableUnitId,sellableUnitName,spaceCode,spaceId" ||
   !canonicalUuid(candidate.sellableUnitId) || !canonicalUuid(candidate.spaceId) ||
   typeof candidate.sellableUnitName !== "string" || candidate.sellableUnitName.trim() !== candidate.sellableUnitName ||
   candidate.sellableUnitName.length < 1 || candidate.sellableUnitName.length > 120 ||
   typeof candidate.spaceCode !== "string" || candidate.spaceCode.trim() !== candidate.spaceCode ||
   candidate.spaceCode.length < 1 || candidate.spaceCode.length > 120 ||
   (candidate.floor !== null && (typeof candidate.floor !== "string" || candidate.floor.trim() !== candidate.floor ||
    candidate.floor.length < 1 || candidate.floor.length > 64)) ||
   (candidate.roomCondition !== null && !CHECKIN_HOUSEKEEPING_CONDITIONS.includes(candidate.roomCondition)) ||
   sellableUnits.has(candidate.sellableUnitId) || spaces.has(candidate.spaceId)) {
   throw new Error("The room-assignment candidate response was invalid.");
  }
  sellableUnits.add(candidate.sellableUnitId);
  spaces.add(candidate.spaceId);
  return Object.freeze({ ...candidate });
 });
 return Object.freeze({
  reservationId: origin.reservationId,
  segmentId: origin.segmentId,
  expectedReservationStatus: "due_in",
  expectedSegmentStatus: "booked",
  expectedUnitTypeId: origin.expectedUnitTypeId,
  expectedSellableUnitId: null,
  expectedPeriod: origin.expectedPeriod,
  candidates: Object.freeze(candidates),
 });
 }
  function dueInRoomAssignmentPanelIsCurrent(origin) {
 const action = checkInBlockers.querySelector(
  `.checkin-room-assignment-action[data-reservation-id="${origin.reservationId}"][data-segment-id="${origin.segmentId}"]`,
 );
 return dueInRoomAssignmentActionIsCurrent(origin, action) && dueInRoomAssignment.hidden === false &&
  dueInRoomAssignment.isConnected && reservationDetailDrawer.contains(dueInRoomAssignment) &&
  dueInRoomAssignmentForm.isConnected && dueInRoomAssignment.contains(dueInRoomAssignmentForm);
 }
  function renderDueInRoomAssignmentCandidates(origin, data) {
 if (!dueInRoomAssignmentPanelIsCurrent(origin)) return false;
 dueInRoomAssignmentData = data;
 dueInRoomAssignmentCandidates.replaceChildren();
 for (const candidate of data.candidates) {
  const label = node("label", "checkin-room-assignment-candidate");
  const input = el("input");
  input.type = "radio";
  input.name = "due-in-room-assignment";
  input.value = candidate.sellableUnitId;
  input.dataset.spaceId = candidate.spaceId;
  const evidence = node("span", "checkin-room-assignment-candidate-evidence");
  evidence.append(
   node("strong", "", `Room ${candidate.spaceCode}`),
   node("span", "", candidate.sellableUnitName),
   node("span", "", candidate.floor === null ? "Floor not recorded" : `Floor ${candidate.floor}`),
   node("span", "", candidate.roomCondition === null
    ? "No condition recorded" : `Current condition: ${candidate.roomCondition.replaceAll("_", " ")}`),
  );
  input.addEventListener("change", () => {
   if (!dueInRoomAssignmentPanelIsCurrent(origin) || !label.isConnected || !dueInRoomAssignmentCandidates.contains(label)) return;
   dueInRoomAssignmentSubmit.disabled = false;
   dueInRoomAssignmentMessage.classList.remove("error");
   dueInRoomAssignmentMessage.textContent = `Room ${candidate.spaceCode} selected. Assignment still requires deliberate confirmation.`;
  });
  label.append(input, evidence);
  dueInRoomAssignmentCandidates.append(label);
 }
 dueInRoomAssignmentSubmit.disabled = true;
 dueInRoomAssignmentMessage.textContent = data.candidates.length === 0
  ? "No currently admitted physical room is available. Refresh rooms after inventory truth changes."
  : `${data.candidates.length} current room candidate${data.candidates.length === 1 ? "" : "s"}. Choose one to continue.`;
 return true;
 }
  async function loadDueInRoomAssignmentCandidates(origin, { focus = false } = {}) {
 if (!dueInRoomAssignmentPanelIsCurrent(origin)) return false;
 const generation = ++dueInRoomAssignmentRequestGeneration;
 dueInRoomAssignmentData = null;
 dueInRoomAssignment.setAttribute("aria-busy", "true");
 dueInRoomAssignmentForm.setAttribute("aria-busy", "true");
 dueInRoomAssignmentCandidates.replaceChildren();
 dueInRoomAssignmentSubmit.disabled = true;
 dueInRoomAssignmentRefresh.disabled = true;
 dueInRoomAssignmentClose.disabled = true;
 dueInRoomAssignmentMessage.classList.remove("error");
 dueInRoomAssignmentMessage.textContent = "Loading current server-admitted rooms…";
 try {
  const value = await request(`/api/v1/properties/${enc(origin.property)}/reservations/${enc(origin.reservationId)}/due-in-room-assignment/candidates`);
  if (generation !== dueInRoomAssignmentRequestGeneration || !dueInRoomAssignmentPanelIsCurrent(origin)) return false;
  const data = dueInRoomAssignmentResult(value, origin);
  if (!renderDueInRoomAssignmentCandidates(origin, data)) return false;
  if (focus) (dueInRoomAssignmentCandidates.querySelector("input") || dueInRoomAssignmentHeading).focus({ preventScroll: true });
  return true;
 } catch (error) {
  if (generation !== dueInRoomAssignmentRequestGeneration || !dueInRoomAssignmentPanelIsCurrent(origin)) return false;
  dueInRoomAssignmentMessage.classList.add("error");
  dueInRoomAssignmentMessage.textContent = error?.status === 404
   ? "This stay is no longer an assignable due-in arrival. Refresh check-in readiness."
   : `${error instanceof Error ? error.message : "Current rooms could not be loaded"}. Refresh rooms to retry.`;
  if (focus) dueInRoomAssignmentRefresh.focus({ preventScroll: true });
  return false;
 } finally {
  if (generation === dueInRoomAssignmentRequestGeneration && dueInRoomAssignmentPanelIsCurrent(origin)) {
   dueInRoomAssignment.setAttribute("aria-busy", "false");
   dueInRoomAssignmentForm.setAttribute("aria-busy", "false");
   dueInRoomAssignmentRefresh.disabled = false;
   dueInRoomAssignmentClose.disabled = false;
  }
 }
 }
  function openDueInRoomAssignment(origin, action) {
 if (!dueInRoomAssignmentActionIsCurrent(origin, action)) return false;
 dueInRoomAssignment.hidden = false;
 dueInRoomAssignmentHeading.focus({ preventScroll: true });
 void loadDueInRoomAssignmentCandidates(origin);
 return true;
 }
  function closeDueInRoomAssignment({ restoreFocus = true } = {}) {
 if (dueInRoomAssignment.hidden) return false;
 const origin = dueInRoomAssignmentOrigin;
 const action = origin ? checkInBlockers.querySelector(
  `.checkin-room-assignment-action[data-reservation-id="${origin.reservationId}"][data-segment-id="${origin.segmentId}"]`,
 ) : null;
 const exactAction = origin && dueInRoomAssignmentActionIsCurrent(origin, action) ? action : null;
 clearDueInRoomAssignment();
 if (restoreFocus) (exactAction?.isConnected ? exactAction : checkInHeading).focus({ preventScroll: true });
 return true;
 }
  function restoreDueInRoomAssignmentSuccessFocus(readiness) {
 const receipt = dueInRoomAssignmentSuccessFocus;
 if (!receipt || receipt.property !== propertySelect.value || receipt.reservationId !== readiness.reservationId ||
  activeView !== "reservations" || currentReservationWorkbench !== "check-in") return false;
 dueInRoomAssignmentSuccessFocus = null;
 const housekeeping = readiness.blockers.some((blocker) => CHECKIN_HOUSEKEEPING_BLOCKERS.includes(blocker)) &&
  checkInHousekeepingAction.isConnected && checkInHousekeepingAction.hidden === false
  ? checkInHousekeepingAction : null;
 const folio = readiness.blockers.includes("primary_folio_not_open") &&
  reservationPrimaryFolioCreate.isConnected && reservationPrimaryFolioCreate.hidden === false
  ? reservationPrimaryFolioCreate : null;
 (housekeeping || folio || checkInHeading).focus({ preventScroll: true });
 return true;
 }
  async function submitDueInRoomAssignment(event) {
 event.preventDefault();
 const origin = dueInRoomAssignmentOrigin;
 if (!origin || !dueInRoomAssignmentPanelIsCurrent(origin) || !dueInRoomAssignmentData) return;
 const selected = dueInRoomAssignmentForm.querySelector('input[name="due-in-room-assignment"]:checked');
 const candidate = dueInRoomAssignmentData.candidates.find((item) =>
  item.sellableUnitId === selected?.value && item.spaceId === selected?.dataset.spaceId);
 if (!candidate || !selected?.isConnected || !dueInRoomAssignmentCandidates.contains(selected)) {
  dueInRoomAssignmentMessage.textContent = "Choose one current room candidate.";
  dueInRoomAssignmentCandidates.querySelector("input")?.focus({ preventScroll: true });
  return;
 }
 const body = {
  segmentId: dueInRoomAssignmentData.segmentId,
  expectedReservationStatus: dueInRoomAssignmentData.expectedReservationStatus,
  expectedSegmentStatus: dueInRoomAssignmentData.expectedSegmentStatus,
  expectedUnitTypeId: dueInRoomAssignmentData.expectedUnitTypeId,
  expectedSellableUnitId: null,
  expectedPeriod: dueInRoomAssignmentData.expectedPeriod,
  sellableUnitId: candidate.sellableUnitId,
 };
 const draft = JSON.stringify({ property: origin.property, reservationId: origin.reservationId, body });
 dueInRoomAssignmentAttempt = dueInRoomAssignmentAttempt?.draft === draft
  ? dueInRoomAssignmentAttempt : Object.freeze({ draft, key: crypto.randomUUID() });
 const attempt = dueInRoomAssignmentAttempt;
 dueInRoomAssignmentForm.setAttribute("aria-busy", "true");
 for (const control of dueInRoomAssignmentForm.elements) control.disabled = true;
 dueInRoomAssignmentRefresh.disabled = true;
 dueInRoomAssignmentClose.disabled = true;
 dueInRoomAssignmentMessage.classList.remove("error");
 dueInRoomAssignmentMessage.textContent = `Assigning room ${candidate.spaceCode} from current server truth…`;
 try {
  const value = await request(`/api/v1/properties/${enc(origin.property)}/reservations/${enc(origin.reservationId)}/due-in-room-assignment`, {
   method: "POST", headers: { "idempotency-key": attempt.key }, body: JSON.stringify(body),
  });
  if (!dueInRoomAssignmentPanelIsCurrent(origin)) return;
  const assignment = value?.assignment;
  if (!assignment || assignment.reservationId !== origin.reservationId || assignment.segmentId !== origin.segmentId ||
   assignment.sellableUnitId !== candidate.sellableUnitId || assignment.spaceId !== candidate.spaceId) {
   throw new Error("The server returned a different room assignment");
  }
  dueInRoomAssignmentAttempt = null;
  dueInRoomAssignmentSuccessFocus = Object.freeze({ property: origin.property, reservationId: origin.reservationId });
  dueInRoomAssignmentMessage.textContent = `Room ${candidate.spaceCode} assigned. Rechecking check-in preparation…`;
  await loadReservationDetail(origin.reservationId);
 } catch (error) {
  if (!dueInRoomAssignmentPanelIsCurrent(origin)) return;
  dueInRoomAssignmentMessage.classList.add("error");
  dueInRoomAssignmentMessage.textContent = error?.status === 409
   ? "Room or stay truth changed concurrently. Refresh rooms before choosing again."
   : `${error instanceof Error ? error.message : "Room assignment failed"}. Retry the unchanged selection safely.`;
  for (const control of dueInRoomAssignmentForm.elements) control.disabled = false;
  dueInRoomAssignmentSubmit.disabled = false;
  dueInRoomAssignmentRefresh.disabled = false;
  dueInRoomAssignmentClose.disabled = false;
  if (error?.status === 409) {
   selected.checked = false;
   dueInRoomAssignmentSubmit.disabled = true;
   dueInRoomAssignmentRefresh.focus({ preventScroll: true });
  }
 } finally {
  if (dueInRoomAssignmentPanelIsCurrent(origin)) dueInRoomAssignmentForm.setAttribute("aria-busy", "false");
 }
 }
  function clearCheckInWorkbench({ preserveDraft = false } = {}) {
 checkInReadinessGeneration += 1;
 checkInReadinessData = null;
 clearDueInRoomAssignment({ preserveAttempt: preserveDraft });
 checkInWorkbench.hidden = true;
 checkInWorkbench.setAttribute("aria-busy", "false");
 checkInBlockers.replaceChildren();
 checkInHousekeepingAction.hidden = true;
 checkInHousekeepingAction.disabled = false;
 delete checkInHousekeepingAction.dataset.blocker;
 delete checkInHousekeepingAction.dataset.reservationId;
 checkInHousekeepingActionOrigin = null;
 checkInBadge.textContent = "Checking…";
 checkInSummary.textContent = "Yellow is checking the assigned room, primary folio and configured identity evidence.";
 checkInOverrideLabel.hidden = true;
 checkInOverrideNote.hidden = true;
 checkInConfirm.checked = false;
 checkInSubmit.disabled = true;
 checkInRefresh.disabled = false;
 checkInMessage.textContent = "";
 checkInMessage.classList.remove("error");
 if (!preserveDraft) {
  dueInRoomAssignmentSuccessFocus = null;
  checkInOverrideReason.value = "";
  checkInAttemptKey = "";
  checkInAttemptDraft = "";
 }
 }
 const CHECKIN_HOUSEKEEPING_BLOCKERS = Object.freeze([
  "room_condition_missing", "room_not_ready", "dirty_room_override_unauthorized",
 ]);
 const CHECKIN_HOUSEKEEPING_CONDITIONS = Object.freeze(["clean", "dirty", "pickup", "inspected"]);
  function canonicalCheckInWorkbenchPath(property, reservationId) {
 return `/p/${property}/res/${reservationId}?${RESERVATION_WORKBENCH_QUERY["check-in"]}`;
 }
  function checkInHousekeepingReturnFromState(state, property) {
 const value = state?.checkInHousekeepingReturn;
 const keys = ["assignedSpaceId", "blocker", "confirmationNo", "detailGeneration", "drawerReturnView", "originPath", "property", "readinessGeneration", "reservationId", "roomCondition", "status"];
 if (state?.yellowSurface !== "housekeeping" || !value || typeof value !== "object" || Array.isArray(value) ||
  Object.keys(value).sort().join(",") !== keys.join(",") || value.property !== property ||
  !canonicalUuid(value.property) || !canonicalUuid(value.reservationId) ||
  typeof value.confirmationNo !== "string" || value.confirmationNo.length < 1 || value.confirmationNo.length > 120 ||
  value.status !== "due_in" || !CHECKIN_HOUSEKEEPING_BLOCKERS.includes(value.blocker) ||
  (value.assignedSpaceId !== null && !canonicalUuid(value.assignedSpaceId)) ||
  (value.roomCondition !== null && !CHECKIN_HOUSEKEEPING_CONDITIONS.includes(value.roomCondition)) ||
  value.originPath !== canonicalCheckInWorkbenchPath(value.property, value.reservationId) ||
  !Number.isSafeInteger(value.detailGeneration) || value.detailGeneration < 1 ||
  !Number.isSafeInteger(value.readinessGeneration) || value.readinessGeneration < 1 ||
  !["", "today", "vehicles", "vehicle-register"].includes(value.drawerReturnView)) return null;
 return Object.freeze({ ...value });
 }
  function checkInHousekeepingActionIsCurrent(origin, action) {
 const reservation = reservationDetailData?.reservation;
 const item = checkInBlockers.querySelector(`li[data-blocker="${origin.blocker}"]`);
 return activeView === "reservations" && currentReservationWorkbench === "check-in" &&
  origin.detailGeneration === reservationDetailGeneration && origin.readinessGeneration === checkInReadinessGeneration &&
  origin.property === propertySelect.value && origin.reservationId === reservationRouteReservationId &&
  origin.originPath === canonicalCheckInWorkbenchPath(origin.property, origin.reservationId) &&
  `${location.pathname}${location.search}` === origin.originPath && origin.drawerReturnView === reservationDrawerReturnView &&
  reservation?.reservationId === origin.reservationId && reservation.confirmationNo === origin.confirmationNo &&
  reservation.status === origin.status && origin.status === "due_in" && checkInReadinessData?.reservationId === origin.reservationId &&
  checkInReadinessData.status === origin.status && checkInReadinessData.assignedSpaceId === origin.assignedSpaceId &&
  checkInReadinessData.roomCondition === origin.roomCondition && checkInReadinessData.blockers.includes(origin.blocker) &&
  CHECKIN_HOUSEKEEPING_BLOCKERS.includes(origin.blocker) && checkInWorkbench.hidden === false &&
  reservationDetailDrawer.isConnected && reservationDetailDrawer.hidden === false && item?.isConnected && checkInBlockers.contains(item) &&
  item?.dataset.blocker === origin.blocker && action?.isConnected && action.hidden === false && action.disabled === false &&
  action === checkInHousekeepingAction && action.dataset.blocker === origin.blocker &&
  action.dataset.reservationId === origin.reservationId && checkInHousekeepingActionOrigin === origin;
 }
  function syncCheckInHousekeepingContext() {
 const returning = checkInHousekeepingReturnFromState(history.state, propertySelect.value);
 const action = housekeepingArrivalReturnAction;
 checkInHousekeepingReturn = returning;
 action.hidden = returning === null;
 if (!returning) return null;
 action.setAttribute("aria-label", `Back to arrival ${returning.confirmationNo}`);
 action.dataset.reservationId = returning.reservationId;
 action.dataset.blocker = returning.blocker;
 housekeepingConditionFilter.value = returning.roomCondition !== null ? returning.roomCondition : "";
 return returning;
 }
  function restoreCheckInHousekeepingRoomFocus(returning) {
 const current = checkInHousekeepingReturnFromState(history.state, propertySelect.value);
 if (!current || checkInHousekeepingReturn !== returning || activeView !== "housekeeping" ||
  location.pathname !== `/p/${returning.property}/housekeeping` || location.search !== "" ||
  housekeepingConditionFilter.value !== (returning.roomCondition || "")) return;
 const row = returning.assignedSpaceId === null ? null :
  housekeepingConditionRows.find((candidate) => candidate.spaceId === returning.assignedSpaceId);
 const card = row ? [...housekeepingConditionList.querySelectorAll(".housekeeping-condition-card")]
  .find((candidate) => candidate.dataset.spaceId === returning.assignedSpaceId) : null;
 (card?.isConnected ? card : housekeepingConditionTitle).focus({ preventScroll: true });
 }
  async function openCheckInHousekeeping(origin, action) {
 if (!checkInHousekeepingActionIsCurrent(origin, action)) return false;
 const returning = Object.freeze({
  property: origin.property,
  reservationId: origin.reservationId,
  confirmationNo: origin.confirmationNo,
  status: origin.status,
  blocker: origin.blocker,
  assignedSpaceId: origin.assignedSpaceId,
  roomCondition: origin.roomCondition,
  originPath: origin.originPath,
  detailGeneration: origin.detailGeneration,
  readinessGeneration: origin.readinessGeneration,
  drawerReturnView: origin.drawerReturnView,
 });
 checkInHousekeepingReturn = returning;
 history.pushState({ yellowSurface: "housekeeping", checkInHousekeepingReturn: returning }, "", `/p/${origin.property}/housekeeping`);
 closeReservationDetail({ history: false, restoreFocus: false });
 setView("housekeeping", false);
 return true;
 }
  function returnFromHousekeepingToCheckIn({ fromHistory = false } = {}) {
 const checkInWorkbenchHeading = checkInHeading;
 const returning = fromHistory ? checkInHousekeepingReturn :
  checkInHousekeepingReturnFromState(history.state, propertySelect.value);
 if (!returning || returning.property !== propertySelect.value ||
  returning.originPath !== canonicalCheckInWorkbenchPath(returning.property, returning.reservationId)) return false;
 if (!fromHistory) {
  checkInHousekeepingReturn = returning;
  history.back();
  return true;
 }
 if (`${location.pathname}${location.search}` !== returning.originPath) return false;
 if (housekeepingArrivalReturnAction) housekeepingArrivalReturnAction.hidden = true;
 housekeepingConditionFilter.value = "";
 setView("reservations", false);
 reservationDrawerReturnView = returning.drawerReturnView;
 reservationDrawerReturnReservationId = returning.reservationId;
 checkInWorkbenchHeading.focus({ preventScroll: true });
 return true;
 }
  function restoreCheckInHousekeepingArrivalFocus(readiness) {
 const returning = checkInHousekeepingReturn;
 const reservation = reservationDetailData?.reservation;
 if (!returning || activeView !== "reservations" || currentReservationWorkbench !== "check-in" ||
  `${location.pathname}${location.search}` !== returning.originPath ||
  returning.property !== propertySelect.value || returning.reservationId !== reservationRouteReservationId ||
  reservation?.reservationId !== returning.reservationId || reservation.confirmationNo !== returning.confirmationNo ||
  reservation.status !== "due_in" || readiness.reservationId !== returning.reservationId) return false;
 const action = [...checkInBlockers.querySelectorAll(".checkin-housekeeping-action")]
  .find((candidate) => candidate === checkInHousekeepingAction &&
   candidate.dataset.blocker === returning.blocker && candidate.dataset.reservationId === returning.reservationId);
 const exact = readiness.status === returning.status && readiness.assignedSpaceId === returning.assignedSpaceId &&
  readiness.roomCondition === returning.roomCondition && readiness.blockers.includes(returning.blocker) &&
  action?.isConnected && action.hidden === false;
 (exact ? action : checkInHeading).focus({ preventScroll: true });
 checkInHousekeepingReturn = null;
 return true;
 }
  function checkInReadinessResult(value, reservationId) {
 if (!value || typeof value !== "object" || Array.isArray(value)
  || value.reservationId !== reservationId || typeof value.status !== "string"
  || !Array.isArray(value.blockers) || typeof value.canCheckIn !== "boolean"
  || typeof value.dirtyRoomOverrideRequired !== "boolean"
  || typeof value.dirtyRoomOverrideAuthorized !== "boolean"
  || (value.assignedSpaceId !== null && !canonicalUuid(value.assignedSpaceId))
  || (value.roomCondition !== null && !CHECKIN_HOUSEKEEPING_CONDITIONS.includes(value.roomCondition))) {
  throw new Error("The server returned an invalid check-in readiness result.");
 }
 for (const blocker of value.blockers) {
  if (typeof blocker !== "string" || blocker.length < 1) {
   throw new Error("The server returned an invalid check-in blocker.");
  }
 }
 return Object.freeze({ ...value, blockers: Object.freeze(value.blockers.slice()) });
 }
 const checkInBlockerLabels = Object.freeze({
 reservation_not_due_in: "Reservation is no longer due in.",
 active_segment_missing: "No active booked stay segment was found.",
 room_assignment_missing: "Assign a physical room before check-in.",
 room_mapping_invalid: "The assigned sellable room mapping needs correction.",
 room_condition_missing: "The assigned room has no current housekeeping condition.",
 room_not_ready: "The assigned room is dirty or awaiting pickup service.",
 dirty_room_override_unauthorized: "Your property access does not allow a dirty-room exception.",
 primary_folio_not_open: "Open the primary folio before check-in.",
 statutory_adapter_unavailable: "The configured statutory identity adapter is unavailable.",
 identity_document_missing: "Required recorded identity evidence is incomplete.",
 });
  function renderCheckInReadiness(readiness) {
 checkInReadinessData = readiness;
 clearDueInRoomAssignment({ preserveAttempt: true });
 checkInBlockers.replaceChildren();
 const blockers = readiness.blockers;
 const exactCheckInRoute = currentReservationWorkbench === "check-in" &&
  `${location.pathname}${location.search}` === canonicalCheckInWorkbenchPath(propertySelect.value, readiness.reservationId);
 checkInBadge.textContent = readiness.canCheckIn ? "Ready" : `${blockers.length} blocker${blockers.length === 1 ? "" : "s"}`;
 checkInBadge.dataset.state = readiness.canCheckIn ? "ready" : "blocked";
 checkInSummary.textContent = readiness.canCheckIn
  ? readiness.dirtyRoomOverrideRequired ? "Ready with an authorised dirty-room exception. Record the operational reason before check-in." : "Assigned room, folio and identity evidence are ready."
  : "Check-in stays unavailable until every named server-owned blocker is resolved.";
 for (const blocker of blockers) {
  const item = node("li", "", checkInBlockerLabels[blocker] || blocker.replaceAll("_", " "));
  item.dataset.blocker = blocker;
  if (blocker === "room_assignment_missing" && exactCheckInRoute) {
   const segment = dueInRoomAssignmentSegment();
   if (segment && readiness.segmentId === segment.segmentId && readiness.assignedSpaceId === null) {
    const action = node("button", "quiet checkin-room-assignment-action", "Assign room");
    action.type = "button";
    action.dataset.reservationId = readiness.reservationId;
    action.dataset.segmentId = segment.segmentId;
    const origin = Object.freeze({
     property: propertySelect.value,
     reservationId: readiness.reservationId,
     confirmationNo: reservationDetailData.reservation.confirmationNo,
     segmentId: segment.segmentId,
     segmentSequence: segment.sequence,
     expectedReservationStatus: "due_in",
     expectedSegmentStatus: "booked",
     expectedUnitTypeId: segment.unitTypeId,
     expectedPeriod: Object.freeze({ from: segment.from, to: segment.to }),
     originPath: canonicalCheckInWorkbenchPath(propertySelect.value, readiness.reservationId),
     detailGeneration: reservationDetailGeneration,
     readinessGeneration: checkInReadinessGeneration,
    });
    dueInRoomAssignmentOrigin = origin;
    action.addEventListener("click", () => openDueInRoomAssignment(origin, action));
    item.append(action);
   }
  }
  checkInBlockers.append(item);
 }
 const housekeepingBlocker = exactCheckInRoute
  ? blockers.find((blocker) => CHECKIN_HOUSEKEEPING_BLOCKERS.includes(blocker)) : null;
 if (housekeepingBlocker) {
   checkInHousekeepingAction.hidden = false;
   checkInHousekeepingAction.dataset.blocker = housekeepingBlocker;
   checkInHousekeepingAction.dataset.reservationId = readiness.reservationId;
   const origin = Object.freeze({
    property: propertySelect.value,
    reservationId: readiness.reservationId,
    confirmationNo: reservationDetailData.reservation.confirmationNo,
    status: reservationDetailData.reservation.status,
    blocker: housekeepingBlocker,
    assignedSpaceId: readiness.assignedSpaceId,
    roomCondition: readiness.roomCondition,
    originPath: canonicalCheckInWorkbenchPath(propertySelect.value, readiness.reservationId),
    detailGeneration: reservationDetailGeneration,
    readinessGeneration: checkInReadinessGeneration,
    drawerReturnView: reservationDrawerReturnView,
   });
   checkInHousekeepingActionOrigin = origin;
 } else {
  checkInHousekeepingAction.hidden = true;
  delete checkInHousekeepingAction.dataset.blocker;
  delete checkInHousekeepingAction.dataset.reservationId;
  checkInHousekeepingActionOrigin = null;
 }
 const needsReason = readiness.dirtyRoomOverrideRequired === true && readiness.dirtyRoomOverrideAuthorized === true;
 checkInOverrideLabel.hidden = !needsReason;
 checkInOverrideNote.hidden = !needsReason;
 checkInOverrideReason.required = needsReason;
 checkInConfirm.disabled = !readiness.canCheckIn;
 checkInSubmit.disabled = !readiness.canCheckIn || !checkInConfirm.checked || (needsReason && checkInOverrideReason.value.trim() === "");
 checkInWorkbench.setAttribute("aria-busy", "false");
 return restoreDueInRoomAssignmentSuccessFocus(readiness) || restoreCheckInHousekeepingArrivalFocus(readiness);
 }
  async function loadCheckInReadiness({ focus = false, preserveDraft = false } = {}) {
 if (!reservationDetailData || reservationDetailData.reservation.status !== "due_in") {
  clearCheckInWorkbench();
  return;
 }
 const reservationId = reservationDetailData.reservation.reservationId;
 const property = propertySelect.value;
 const detailGeneration = reservationDetailGeneration;
 const generation = ++checkInReadinessGeneration;
 checkInWorkbench.hidden = false;
 checkInWorkbench.setAttribute("aria-busy", "true");
 checkInRefresh.disabled = true;
 checkInSubmit.disabled = true;
 checkInHousekeepingAction.hidden = true;
 checkInHousekeepingActionOrigin = null;
 checkInBadge.textContent = "Checking…";
 checkInMessage.classList.remove("error");
 checkInMessage.textContent = "Loading current arrival readiness…";
 if (!preserveDraft) checkInConfirm.checked = false;
 try {
  const result = checkInReadinessResult(await request(`/api/v1/properties/${enc(property)}/reservations/${enc(reservationId)}/check-in/readiness`), reservationId);
  if (generation !== checkInReadinessGeneration || detailGeneration !== reservationDetailGeneration
   || property !== propertySelect.value || reservationRouteReservationId !== reservationId) return;
  const restoredHousekeepingFocus = renderCheckInReadiness(result);
  checkInMessage.textContent = "Readiness refreshed from server truth.";
  if (focus && !restoredHousekeepingFocus) checkInHeading.focus({ preventScroll: true });
 } catch (error) {
  if (generation !== checkInReadinessGeneration || detailGeneration !== reservationDetailGeneration
   || property !== propertySelect.value || reservationRouteReservationId !== reservationId) return;
  checkInReadinessData = null;
  checkInWorkbench.setAttribute("aria-busy", "false");
  checkInMessage.classList.add("error");
  checkInMessage.textContent = `${error instanceof Error ? error.message : "Readiness could not be loaded"}. Refresh to retry.`;
  if (dueInRoomAssignmentSuccessFocus?.property === property &&
   dueInRoomAssignmentSuccessFocus.reservationId === reservationId) {
   dueInRoomAssignmentSuccessFocus = null;
   checkInHeading.focus({ preventScroll: true });
  }
  if (checkInHousekeepingReturn && `${location.pathname}${location.search}` === checkInHousekeepingReturn.originPath) {
   checkInHeading.focus({ preventScroll: true });
   checkInHousekeepingReturn = null;
  } else if (focus) checkInRefresh.focus({ preventScroll: true });
 } finally {
  if (generation === checkInReadinessGeneration && detailGeneration === reservationDetailGeneration
   && property === propertySelect.value && reservationRouteReservationId === reservationId) checkInRefresh.disabled = false;
 }
 }
  async function submitCheckIn(event) {
 event.preventDefault();
 if (!reservationDetailData || !checkInReadinessData?.canCheckIn || !checkInConfirm.checked) return;
 const reservationId = reservationDetailData.reservation.reservationId;
 const property = propertySelect.value;
 const detailGeneration = reservationDetailGeneration;
 const needsReason = checkInReadinessData.dirtyRoomOverrideRequired === true;
 const reason = checkInOverrideReason.value.trim();
 if (needsReason && reason === "") { checkInOverrideReason.focus(); return; }
 const body = needsReason ? { reason } : {};
 const draft = JSON.stringify({ property, reservationId, body });
 if (!checkInAttemptKey || checkInAttemptDraft !== draft) {
  checkInAttemptKey = crypto.randomUUID();
  checkInAttemptDraft = draft;
 }
 const attemptKey = checkInAttemptKey;
 checkInSubmit.disabled = true;
 checkInRefresh.disabled = true;
 checkInMessage.classList.remove("error");
 checkInMessage.textContent = "Checking in from current server truth…";
 try {
  const result = await request(`/api/v1/properties/${enc(property)}/reservations/${enc(reservationId)}/check-in`, {
  method: "POST", headers: { "idempotency-key": attemptKey }, body: JSON.stringify(body),
  });
  if (detailGeneration !== reservationDetailGeneration || property !== propertySelect.value || reservationRouteReservationId !== reservationId) return;
  if (!result || result.reservationId !== reservationId) throw new Error("The server returned a different reservation");
  checkInAttemptKey = "";
  checkInAttemptDraft = "";
  checkInMessage.textContent = result.replayed ? "Existing check-in confirmed. Refreshing the stay…" : "Guest checked in. Refreshing the stay…";
  await loadReservationDetail(reservationId);
  void loadToday();
 } catch (error) {
  if (detailGeneration !== reservationDetailGeneration || property !== propertySelect.value || reservationRouteReservationId !== reservationId) return;
  checkInMessage.classList.add("error");
  checkInMessage.textContent = `${error instanceof Error ? error.message : "Check-in could not be completed"}. Retry keeps the same request key; refresh readiness if conditions changed.`;
  checkInRefresh.disabled = false;
  checkInSubmit.disabled = false;
 }
 }
 const CHECKOUT_READINESS_BLOCKERS = Object.freeze([
 "reservation_not_departure_state", "current_segment_missing_or_ambiguous",
 "physical_room_missing_or_ambiguous", "occupancy_missing_or_ambiguous",
 "folio_window_missing", "folio_window_unsettled", "folio_window_nonzero",
 ]);
 const checkoutReadinessBlockerLabels = Object.freeze({
 reservation_not_departure_state: "Reservation must be in house or due out before departure readiness can pass.",
 current_segment_missing_or_ambiguous: "Resolve the stay so exactly one current segment is in house.",
 physical_room_missing_or_ambiguous: "Assign exactly one active physical room to the current segment.",
 occupancy_missing_or_ambiguous: "The current segment needs one exact matching exclusive reservation occupancy.",
 folio_window_missing: "Open at least one reservation folio window.",
 folio_window_unsettled: "Settle or close every folio window. An open zero-balance window is still blocked.",
 folio_window_nonzero: "Bring every folio window to an exact zero server balance through governed financial controls.",
 });
  function clearCheckoutReadinessWorkbench() {
 checkoutReadinessGeneration += 1;
 checkoutReadinessData = null;
 if (checkoutCompletionNotice && (checkoutCompletionNotice.property !== propertySelect.value
  || checkoutCompletionNotice.reservationId !== reservationRouteReservationId)) checkoutCompletionNotice = null;
 checkoutAttemptKey = "";
 checkoutAttemptDraft = "";
 checkoutPending = false;
 departureWorkbench.hidden = true;
 departureWorkbench.setAttribute("aria-busy", "false");
 departureBadge.textContent = "Checking…";
 departureBadge.removeAttribute("data-state");
 departureSummary.textContent = "Yellow is checking the current stay, physical room, exclusive occupancy and every folio window.";
 departureError.hidden = true;
 departureError.querySelector("p").textContent = "";
 departureContent.hidden = true;
 departureEvidence.replaceChildren();
 departureBlockers.replaceChildren();
 departureFolioList.replaceChildren();
 departureFolioCount.textContent = "0 windows";
 departureCheckoutForm.setAttribute("aria-busy", "false");
 departureCheckoutConfirm.checked = false;
 departureCheckoutConfirm.disabled = true;
 departureCheckoutSubmit.disabled = true;
 departureRefresh.disabled = false;
 departureMessage.classList.remove("error");
 departureMessage.textContent = "";
 }
  function syncCheckoutConfirmation() {
 const ready = checkoutReadinessData?.ready === true;
 departureCheckoutConfirm.disabled = checkoutPending || !ready;
 departureCheckoutSubmit.disabled = checkoutPending || !ready || !departureCheckoutConfirm.checked;
 departureRefresh.disabled = checkoutPending;
 }
  function checkoutReadinessResult(value, reservationId) {
 if (!value || typeof value !== "object" || Array.isArray(value) || value.reservationId !== reservationId
  || typeof value.reservationStatus !== "string" || typeof value.ready !== "boolean"
  || !Array.isArray(value.blockers) || !Array.isArray(value.folios)) {
  throw new Error("The server returned an invalid departure readiness result.");
 }
 const blockerOrder = value.blockers.map((blocker) => CHECKOUT_READINESS_BLOCKERS.indexOf(blocker));
 if (blockerOrder.some((position) => position < 0)
  || blockerOrder.some((position, index) => index > 0 && position <= blockerOrder[index - 1])
  || value.ready !== (value.blockers.length === 0)) {
  throw new Error("The server returned invalid or unordered departure blockers.");
 }
 const segmentValid = value.segment === null || (canonicalUuid(String(value.segment.segmentId || ""))
  && canonicalUuid(String(value.segment.sellableUnitId || ""))
  && typeof value.segment.periodStart === "string" && typeof value.segment.periodEnd === "string");
 const roomValid = value.room === null || (canonicalUuid(String(value.room.spaceId || ""))
  && typeof value.room.spaceCode === "string");
 const occupancyValid = value.occupancy === null || (canonicalUuid(String(value.occupancy.occupancyId || ""))
  && typeof value.occupancy.periodStart === "string" && typeof value.occupancy.periodEnd === "string");
 const foliosValid = value.folios.every((folio) => folio && canonicalUuid(String(folio.folioId || ""))
  && (folio.folioNo === null || typeof folio.folioNo === "string")
  && Number.isInteger(folio.windowNo) && folio.windowNo > 0
  && (folio.name === null || typeof folio.name === "string")
  && ["open", "settled", "closed"].includes(folio.status)
  && /^[A-Z]{3}$/.test(String(folio.currency || ""))
  && /^-?(?:0|[1-9][0-9]*)$/.test(String(folio.balanceMinor || "")));
 if (!segmentValid || !roomValid || !occupancyValid || !foliosValid) {
  throw new Error("The server returned invalid departure evidence.");
 }
 return value;
 }
  function checkoutReadinessIsCurrent(generation, detailGeneration, property, reservationId) {
 return generation === checkoutReadinessGeneration && detailGeneration === reservationDetailGeneration
  && property === propertySelect.value && reservationRouteReservationId === reservationId
  && reservationDetailData?.reservation?.reservationId === reservationId
  && !reservationDetailDrawer.hidden && location.pathname === `/p/${property}/res/${reservationId}`;
 }
 function departureFolioReturnIsCurrent(origin, card = null, action = null) {
 const reservation = reservationDetailData?.reservation;
 const currentPath = `${location.pathname}${location.search}`;
 const folio = checkoutReadinessData?.folios?.find((item) => item.folioId === origin?.folioId);
 if (card !== null || action !== null) {
  return origin?.property === propertySelect.value && origin.reservationId === reservationRouteReservationId &&
   origin.confirmationNo === reservation?.confirmationNo && origin.reservationStatus === reservation?.status &&
   origin.workbench === "checkout" && currentReservationWorkbench === "checkout" &&
   origin.readinessGeneration === checkoutReadinessGeneration && origin.detailGeneration === reservationDetailGeneration &&
   checkoutReadinessData?.reservationId === origin.reservationId && checkoutReadinessData.reservationStatus === origin.reservationStatus &&
   folio?.folioId === origin.folioId && activeView === "reservations" && currentPath === origin.originPath &&
   reservationDetailDrawer.isConnected && reservationDetailDrawer.hidden === false &&
   departureWorkbench.isConnected && departureWorkbench.hidden === false && departureContent.hidden === false &&
   departureFolioList.isConnected && departureFolioList.contains(card) && card.isConnected && card.hidden === false &&
   card.contains(action) && action.isConnected && action.hidden === false && action.disabled === false &&
   card.dataset.folioId === origin.folioId && action.dataset.folioId === origin.folioId;
 }
 const folioPath = canonicalFolioPath(origin?.property, origin?.folioId, folioActiveTab, folioRouteCursor);
 return origin?.property === propertySelect.value && origin.workbench === "checkout" &&
  activeView === "folios" && folioWorkspace.isConnected && folioWorkspace.hidden === false &&
  folioIdentity === origin.folioId && folioStatementData?.folio?.id === origin.folioId &&
  (currentPath === folioPath || currentPath === origin.originPath);
 }
 function departureFolioReturnFromState(state, property, folioId) {
 const value = state?.departureFolioReturn;
 const expected = "confirmationNo,detailGeneration,folioId,originPath,property,readinessGeneration,reservationId,reservationStatus,workbench";
 if (state?.yellowSurface !== "folio-workspace" || !value || typeof value !== "object" || Array.isArray(value) ||
  Object.keys(value).sort().join(",") !== expected || value.property !== property || value.folioId !== folioId ||
  !canonicalUuid(value.property) || !canonicalUuid(value.reservationId) || !canonicalUuid(value.folioId) ||
  typeof value.confirmationNo !== "string" || value.confirmationNo.trim().length < 1 || value.confirmationNo.length > 120 ||
  !["in_house", "due_out"].includes(value.reservationStatus) || value.workbench !== "checkout" ||
  value.originPath !== `/p/${value.property}/res/${value.reservationId}?workbench=checkout` ||
  !Number.isInteger(value.readinessGeneration) || value.readinessGeneration < 0 ||
  !Number.isInteger(value.detailGeneration) || value.detailGeneration < 0) return null;
 return Object.freeze({ ...value });
 }
 function reservationFolioReturnIsCurrent(origin, control = null, receipt = null) {
 const reservation = reservationDetailData?.reservation;
 const currentPath = `${location.pathname}${location.search}`;
 const expectedOrigin = `/p/${origin?.property}/res/${origin?.reservationId}${origin?.workbench
  ? `?${RESERVATION_WORKBENCH_QUERY[origin.workbench]}` : ""}`;
 const exactReservation = origin?.property === propertySelect.value && origin.reservationId === reservationRouteReservationId &&
  origin.reservationId === reservation?.reservationId && origin.confirmationNo === reservation?.confirmationNo &&
  origin.reservationStatus === reservation?.status && origin.workbench === currentReservationWorkbench &&
  origin.detailGeneration === reservationDetailGeneration && origin.originPath === expectedOrigin &&
  activeView === "reservations" && currentPath === origin.originPath && reservationDetailDrawer.isConnected &&
  reservationDetailDrawer.hidden === false && reservationDetailFolios.isConnected && reservationDetailFolios.hidden === false;
 if (control !== null || receipt !== null) {
  if (!exactReservation || !["existing", "primary-receipt"].includes(origin?.source) ||
   !control?.isConnected || control.hidden === true || !canonicalUuid(String(origin?.folioId || ""))) return false;
  if (origin.source === "existing") {
   return receipt === null && reservationDetailFolioList.contains(control) && control.disabled === false &&
    control.classList.contains("reservation-folio-open") && control.dataset.folioId === origin.folioId &&
    reservation.folios.some((item) => item.folioId === origin.folioId);
  }
  const primaryFolioReceipt = receipt;
  return control === reservationPrimaryFolioCreate && reservationDetailFolios.contains(control) &&
   reservationPrimaryFolioReservationId === origin.reservationId && control.disabled === true &&
   primaryFolioReceipt?.reservationId === origin.reservationId && primaryFolioReceipt?.folioId === origin.folioId;
 }
 const folioPath = canonicalFolioPath(origin?.property, origin?.folioId, folioActiveTab, folioRouteCursor);
 return ["existing", "primary-receipt"].includes(origin?.source) && origin?.property === propertySelect.value &&
  activeView === "folios" && folioWorkspace.isConnected && folioWorkspace.hidden === false &&
  folioIdentity === origin.folioId && folioStatementData?.folio?.id === origin.folioId &&
  (currentPath === folioPath || currentPath === origin.originPath);
 }
 function reservationFolioReturnFromState(state, property, folioId) {
 const value = state?.reservationFolioReturn;
 const expected = "confirmationNo,detailGeneration,folioId,originPath,property,reservationId,reservationStatus,source,workbench";
 if (state?.yellowSurface !== "folio-workspace" || !value || typeof value !== "object" || Array.isArray(value) ||
  Object.keys(value).sort().join(",") !== expected || value.property !== property || value.folioId !== folioId ||
  !canonicalUuid(value.property) || !canonicalUuid(value.reservationId) || !canonicalUuid(value.folioId) ||
  typeof value.confirmationNo !== "string" || value.confirmationNo.trim().length < 1 || value.confirmationNo.length > 120 ||
  !Object.hasOwn(reservationStatusLabels, value.reservationStatus) || !["existing", "primary-receipt"].includes(value.source) ||
  ![null, "check-in", "checkout"].includes(value.workbench) ||
  value.originPath !== `/p/${value.property}/res/${value.reservationId}${value.workbench
   ? `?${RESERVATION_WORKBENCH_QUERY[value.workbench]}` : ""}` ||
  !Number.isInteger(value.detailGeneration) || value.detailGeneration < 0) return null;
 return Object.freeze({ ...value });
 }
 function syncDepartureFolioReturnControl() {
 const departureCurrent = departureFolioReturnIsCurrent(departureFolioReturn);
 const reservationCurrent = !departureCurrent && reservationFolioReturnIsCurrent(reservationFolioReturn);
 folioWorkspaceBack.textContent = departureCurrent ? "Back to departure" : reservationCurrent ? "Back to reservation" : "Back to folio lookup";
 folioWorkspaceBack.classList.toggle("folio-departure-return", departureCurrent);
 folioWorkspaceBack.classList.toggle("folio-reservation-return", reservationCurrent);
 }
 function folioWorkspaceHistoryState(folioId) {
 const departureCurrent = departureFolioReturn?.folioId === folioId ? departureFolioReturn : null;
 const reservationCurrent = !departureCurrent && reservationFolioReturn?.folioId === folioId ? reservationFolioReturn : null;
 return departureCurrent ? { yellowSurface: "folio-workspace", departureFolioReturn: departureCurrent }
  : reservationCurrent ? { yellowSurface: "folio-workspace", reservationFolioReturn: reservationCurrent }
   : { yellowSurface: "folio-workspace" };
 }
function departureEvidenceRow(term, value) {
 const row = node("div");
 row.append(node("dt", "", term), node("dd", "", value));
 return row;
 }
  function departureFolioCard(folio) {
 const card = node("article", "departure-folio-card");
 card.dataset.folioId = folio.folioId;
 const head = node("div", "departure-folio-card-head");
 const identity = node("div");
 identity.append(
  node("strong", "", folio.name || folio.folioNo || `Window ${folio.windowNo}`),
  node("small", "", `${folio.folioNo || "No reference"} · Window ${folio.windowNo}`),
 );
 const status = node("span", "departure-folio-status", folio.status);
 status.dataset.status = folio.status;
 head.append(identity, status);
 const balance = node("div", "departure-folio-balance");
 balance.append(node("span", "", "Exact server balance"), node("strong", "", `${folio.currency} ${folio.balanceMinor} minor units`));
 const open = node("button", "secondary departure-folio-open", "Open Folio controls");
 open.type = "button";
 open.dataset.folioId = folio.folioId;
 open.setAttribute("aria-label", `Open governed Folio controls for ${folio.folioNo || `window ${folio.windowNo}`}`);
 open.addEventListener("click", () => openDepartureFolioWorkspace(folio.folioId, card, open));
 card.append(head, balance, open);
 return card;
 }
  function renderCheckoutReadiness(readiness) {
 checkoutReadinessData = readiness;
 departureEvidence.replaceChildren(
  departureEvidenceRow("Reservation state", reservationStatusLabels[readiness.reservationStatus] || readiness.reservationStatus),
  departureEvidenceRow("Current segment", readiness.segment
   ? `${reservationDateTime(readiness.segment.periodStart)} – ${reservationDateTime(readiness.segment.periodEnd)}` : "Not resolved"),
  departureEvidenceRow("Physical room", readiness.room ? `Room ${readiness.room.spaceCode}` : "Not resolved"),
  departureEvidenceRow("Exclusive occupancy", readiness.occupancy
   ? `${reservationDateTime(readiness.occupancy.periodStart)} – ${reservationDateTime(readiness.occupancy.periodEnd)}` : "Not resolved"),
 );
 departureBlockers.replaceChildren(...readiness.blockers.map((blocker) => {
  const item = node("li", "", checkoutReadinessBlockerLabels[blocker]);
  item.dataset.blocker = blocker;
  return item;
 }));
 departureBlockerPanel.hidden = readiness.blockers.length === 0;
 departureFolioList.replaceChildren(...readiness.folios.map(departureFolioCard));
 departureFolioCount.textContent = `${readiness.folios.length} window${readiness.folios.length === 1 ? "" : "s"}`;
 departureBadge.textContent = readiness.ready ? "Ready" : `${readiness.blockers.length} blocker${readiness.blockers.length === 1 ? "" : "s"}`;
 departureBadge.dataset.state = readiness.ready ? "ready" : "blocked";
 departureSummary.textContent = readiness.ready
  ? "Current server evidence is ready for a later governed checkout command to lock and revalidate. No checkout occurred here."
  : "Departure remains blocked until every named server-owned condition is resolved.";
 departureError.hidden = true;
 departureContent.hidden = false;
 departureWorkbench.setAttribute("aria-busy", "false");
 syncCheckoutConfirmation();
 restoreDepartureFolioReturnFocus(readiness);
 }
 function restoreDepartureFolioReturnFocus(readiness) {
 const returning = departureFolioReturn;
 const reservation = reservationDetailData?.reservation;
 if (!returning || activeView !== "reservations" || currentReservationWorkbench !== "checkout" ||
  `${location.pathname}${location.search}` !== returning.originPath || returning.property !== propertySelect.value ||
  returning.reservationId !== reservationRouteReservationId || returning.reservationId !== reservation?.reservationId ||
  returning.confirmationNo !== reservation.confirmationNo || returning.reservationStatus !== reservation.status) return;
 const card = readiness?.reservationId === returning.reservationId
  ? [...departureFolioList.querySelectorAll(".departure-folio-card")].find((item) => item.dataset.folioId === returning.folioId) : null;
 const action = card?.querySelector(".departure-folio-open");
 (action?.isConnected ? action : departureHeading).focus({ preventScroll: true });
 departureFolioReturn = null;
 }
 function openDepartureFolioWorkspace(folioId, card, action) {
 const reservation = reservationDetailData?.reservation;
 const property = propertySelect.value;
 const reservationId = reservation?.reservationId;
 const originPath = `/p/${property}/res/${reservationId}?workbench=checkout`;
 const descriptor = Object.freeze({
  property, reservationId, confirmationNo: reservation?.confirmationNo,
  reservationStatus: reservation?.status, folioId, workbench: "checkout", originPath,
  readinessGeneration: checkoutReadinessGeneration, detailGeneration: reservationDetailGeneration,
 });
 if (!departureFolioReturnIsCurrent(descriptor, card, action)) return;
 openFolioWorkspace(folioId, { trigger: action, departureReturn: descriptor });
 }
 function openReservationFolioWorkspace(folioId, {
  source, control, receipt = null, detailGeneration = reservationDetailGeneration,
 } = {}) {
 const reservation = reservationDetailData?.reservation;
 const property = propertySelect.value;
 const reservationId = reservation?.reservationId;
 const workbench = currentReservationWorkbench;
 const originPath = `/p/${property}/res/${reservationId}${workbench ? `?${RESERVATION_WORKBENCH_QUERY[workbench]}` : ""}`;
 const descriptor = Object.freeze({
  source, property, reservationId, confirmationNo: reservation?.confirmationNo,
  reservationStatus: reservation?.status, folioId, workbench, originPath, detailGeneration,
 });
 if (!reservationFolioReturnIsCurrent(descriptor, control, receipt)) return;
 openFolioWorkspace(folioId, { trigger: control, reservationReturn: descriptor });
 }
  async function loadCheckoutReadiness({ focus = false } = {}) {
 if (!reservationDetailData) {
  clearCheckoutReadinessWorkbench();
  return;
 }
 const reservationId = reservationDetailData.reservation.reservationId;
 const property = propertySelect.value;
 const detailGeneration = reservationDetailGeneration;
 const generation = ++checkoutReadinessGeneration;
 departureWorkbench.hidden = false;
 departureWorkbench.setAttribute("aria-busy", "true");
 departureRefresh.disabled = true;
 departureCheckoutConfirm.checked = false;
 departureCheckoutConfirm.disabled = true;
 departureCheckoutSubmit.disabled = true;
 departureError.hidden = true;
 departureContent.hidden = true;
 departureBadge.textContent = "Checking…";
 departureMessage.classList.remove("error");
 departureMessage.textContent = "Loading one coherent departure snapshot…";
 try {
  const result = checkoutReadinessResult(await request(`/api/v1/properties/${enc(property)}/reservations/${enc(reservationId)}/checkout-readiness`), reservationId);
  if (!checkoutReadinessIsCurrent(generation, detailGeneration, property, reservationId)) return;
  renderCheckoutReadiness(result);
  const completion = checkoutCompletionNotice?.property === property
   && checkoutCompletionNotice.reservationId === reservationId ? checkoutCompletionNotice.message : "";
  departureMessage.textContent = completion || "Departure readiness refreshed from current server truth.";
  if (completion) checkoutCompletionNotice = null;
  if (focus) departureHeading.focus({ preventScroll: true });
 } catch (error) {
  if (!checkoutReadinessIsCurrent(generation, detailGeneration, property, reservationId)) return;
  checkoutReadinessData = null;
  departureWorkbench.setAttribute("aria-busy", "false");
  departureContent.hidden = true;
  departureError.hidden = false;
  departureError.querySelector("p").textContent = error instanceof Error ? error.message : "Departure readiness is unavailable.";
  departureMessage.classList.add("error");
  departureMessage.textContent = "No readiness conclusion was made. Retry this read-only snapshot.";
  syncCheckoutConfirmation();
  const returning = departureFolioReturn;
  restoreDepartureFolioReturnFocus(null);
  if (focus && departureFolioReturn === returning) departureRetry.focus({ preventScroll: true });
 } finally {
  if (checkoutReadinessIsCurrent(generation, detailGeneration, property, reservationId)) departureRefresh.disabled = false;
 }
 }
  function checkoutResult(value, reservationId) {
 const keys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort() : [];
 const expected = ["assignedSpaceId", "checkedOutAt", "folioWindowCount", "previousReservationStatus", "previousSegmentPeriod", "releasedClaimCount", "replayed", "reservationId", "reservationStatus", "segmentId", "segmentPeriod", "segmentStatus"];
 const periodsValid = [value?.previousSegmentPeriod, value?.segmentPeriod].every((period) => period
  && typeof period === "object" && !Array.isArray(period)
  && JSON.stringify(Object.keys(period).sort()) === JSON.stringify(["from", "to"])
  && typeof period.from === "string" && typeof period.to === "string");
 if (JSON.stringify(keys) !== JSON.stringify(expected) || value.reservationId !== reservationId
  || !["in_house", "due_out"].includes(value.previousReservationStatus)
  || value.reservationStatus !== "checked_out" || value.segmentStatus !== "departed"
  || !canonicalUuid(String(value.segmentId || "")) || !canonicalUuid(String(value.assignedSpaceId || ""))
  || typeof value.checkedOutAt !== "string" || !periodsValid
  || !Number.isInteger(value.releasedClaimCount) || value.releasedClaimCount < 0
  || !Number.isInteger(value.folioWindowCount) || value.folioWindowCount < 0
  || typeof value.replayed !== "boolean") {
  throw new Error("The server returned an invalid checkout result.");
 }
 return value;
 }
 function checkoutHousekeepingCompletionDescriptor(result, context) {
 const contextKeys = context && typeof context === "object" && !Array.isArray(context)
  ? Object.keys(context).sort().join(",") : "";
 if (!result || typeof result !== "object" || Array.isArray(result) ||
  contextKeys !== "browserGeneration,confirmationNo,detailGeneration,originPath,property,reservationId" ||
  result.reservationId !== context.reservationId || result.reservationStatus !== "checked_out" ||
  result.segmentStatus !== "departed" || result.releasedClaimCount !== 1 ||
  !canonicalUuid(String(context.property || "")) || !canonicalUuid(String(context.reservationId || "")) ||
  !canonicalUuid(String(result.assignedSpaceId || "")) ||
  typeof context.confirmationNo !== "string" || context.confirmationNo.trim().length < 1 ||
  context.confirmationNo.length > 120 ||
  context.originPath !== `/p/${context.property}/res/${context.reservationId}` ||
  !Number.isSafeInteger(context.detailGeneration) || context.detailGeneration < 1 ||
  !Number.isSafeInteger(context.browserGeneration) || context.browserGeneration < 1) return null;
 return Object.freeze({
  property: context.property,
  reservationId: context.reservationId,
  confirmationNo: context.confirmationNo,
  assignedSpaceId: result.assignedSpaceId,
  reservationStatus: result.reservationStatus,
  segmentStatus: result.segmentStatus,
  releasedClaimCount: result.releasedClaimCount,
  originPath: context.originPath,
  detailGeneration: context.detailGeneration,
  browserGeneration: context.browserGeneration,
 });
 }
 function checkoutHousekeepingCompletionFromState(state, property, reservationId) {
 const value = state?.checkoutHousekeepingCompletion;
 const expected = "assignedSpaceId,browserGeneration,confirmationNo,detailGeneration,originPath,property,releasedClaimCount,reservationId,reservationStatus,segmentStatus";
 if (state?.yellowSurface !== "reservation-detail" || !value || typeof value !== "object" || Array.isArray(value) ||
  Object.keys(value).sort().join(",") !== expected || value.property !== property || value.reservationId !== reservationId ||
  !canonicalUuid(value.property) || !canonicalUuid(value.reservationId) || !canonicalUuid(value.assignedSpaceId) ||
  typeof value.confirmationNo !== "string" || value.confirmationNo.trim().length < 1 || value.confirmationNo.length > 120 ||
  value.reservationStatus !== "checked_out" || value.segmentStatus !== "departed" || value.releasedClaimCount !== 1 ||
  value.originPath !== `/p/${value.property}/res/${value.reservationId}` ||
  !Number.isSafeInteger(value.detailGeneration) || value.detailGeneration < 1 ||
  !Number.isSafeInteger(value.browserGeneration) || value.browserGeneration < 1) return null;
 return Object.freeze({ ...value });
 }
 function checkoutHousekeepingReturnFromState(state, property) {
 const value = state?.checkoutHousekeepingReturn;
 const expected = "assignedSpaceId,browserGeneration,confirmationNo,detailGeneration,originPath,property,releasedClaimCount,reservationId,reservationStatus,segmentStatus";
 if (state?.yellowSurface !== "housekeeping" || !value || typeof value !== "object" || Array.isArray(value) ||
  Object.keys(value).sort().join(",") !== expected || value.property !== property ||
  !canonicalUuid(value.property) || !canonicalUuid(value.reservationId) || !canonicalUuid(value.assignedSpaceId) ||
  typeof value.confirmationNo !== "string" || value.confirmationNo.trim().length < 1 || value.confirmationNo.length > 120 ||
  value.reservationStatus !== "checked_out" || value.segmentStatus !== "departed" || value.releasedClaimCount !== 1 ||
  value.originPath !== `/p/${value.property}/res/${value.reservationId}` ||
  !Number.isSafeInteger(value.detailGeneration) || value.detailGeneration < 1 ||
  !Number.isSafeInteger(value.browserGeneration) || value.browserGeneration < 1) return null;
 return Object.freeze({ ...value });
 }
 function sameCheckoutHousekeepingDescriptor(left, right) {
 return Boolean(left && right) && left.property === right.property &&
  left.reservationId === right.reservationId && left.confirmationNo === right.confirmationNo &&
  left.assignedSpaceId === right.assignedSpaceId && left.reservationStatus === right.reservationStatus &&
  left.segmentStatus === right.segmentStatus && left.releasedClaimCount === right.releasedClaimCount &&
  left.originPath === right.originPath && left.detailGeneration === right.detailGeneration &&
  left.browserGeneration === right.browserGeneration;
 }
 function checkoutHousekeepingDepartedSegment(reservation) {
 const segments = Array.isArray(reservation?.segments) ? reservation.segments : [];
 const latestSequence = segments.reduce((latest, segment) => Number.isInteger(segment?.sequence)
  ? Math.max(latest, segment.sequence) : latest, -1);
 const current = segments.filter((segment) => segment?.sequence === latestSequence);
 if (current.length !== 1 || current[0].status !== "departed" ||
  !canonicalUuid(String(current[0].sellableUnitId || ""))) return null;
 return current[0];
 }
function checkoutHousekeepingCompletionActionIsCurrent(origin, section, action) {
 const reservation = reservationDetailData?.reservation;
 const fromState = checkoutHousekeepingCompletionFromState(history.state, propertySelect.value, reservationRouteReservationId);
 const segment = checkoutHousekeepingDepartedSegment(reservation);
 return activeView === "reservations" && currentReservationWorkbench === null &&
  sameCheckoutHousekeepingDescriptor(origin, checkoutHousekeepingCompletion) &&
  sameCheckoutHousekeepingDescriptor(origin, fromState) &&
  origin.detailGeneration === reservationDetailGeneration &&
  origin.browserGeneration === checkoutHousekeepingBrowserGeneration &&
  origin.property === propertySelect.value && origin.reservationId === reservationRouteReservationId &&
  origin.originPath === `/p/${origin.property}/res/${origin.reservationId}` &&
  `${location.pathname}${location.search}` === origin.originPath &&
  reservation?.reservationId === origin.reservationId && reservation.confirmationNo === origin.confirmationNo &&
  reservation.status === origin.reservationStatus && origin.reservationStatus === "checked_out" &&
  segment?.status === origin.segmentStatus && origin.segmentStatus === "departed" &&
  origin.releasedClaimCount === 1 && canonicalUuid(origin.assignedSpaceId) &&
  reservationDetailDrawer.isConnected && reservationDetailDrawer.hidden === false &&
  reservationDetailContent.isConnected && reservationDetailContent.hidden === false &&
  section?.isConnected && reservationDetailContent.contains(section) && section.hidden === false &&
  section.dataset.reservationId === origin.reservationId && section.dataset.spaceId === origin.assignedSpaceId &&
  action?.isConnected && section.contains(action) && action.hidden === false && action.disabled === false &&
  action.classList.contains("checkout-housekeeping-action") && action.dataset.reservationId === origin.reservationId &&
  action.dataset.spaceId === origin.assignedSpaceId && action.dataset.browserGeneration === String(origin.browserGeneration) &&
  checkoutHousekeepingActionOrigin === origin;
 }
 function clearCheckoutHousekeepingReturnControl() {
 if (housekeepingCheckoutReturnAction?.isConnected) housekeepingCheckoutReturnAction.remove();
 housekeepingCheckoutReturnAction = null;
 }
 function ensureCheckoutHousekeepingReturnControl(returning) {
 clearCheckoutHousekeepingReturnControl();
 const action = node("button", "quiet housekeeping-checkout-return", "Back to checked-out stay");
 action.type = "button";
 action.dataset.reservationId = returning.reservationId;
 action.dataset.spaceId = returning.assignedSpaceId;
 action.setAttribute("aria-label", `Back to checked-out reservation ${returning.confirmationNo}`);
 action.addEventListener("click", () => void returnFromHousekeepingToCheckedOutReservation());
 housekeepingHeadingActions.insertBefore(action, housekeepingRefresh);
 housekeepingCheckoutReturnAction = action;
 return action;
 }
 function syncCheckoutHousekeepingContext() {
 const returning = checkoutHousekeepingReturnFromState(history.state, propertySelect.value);
 const arrivalReturning = checkInHousekeepingReturnFromState(history.state, propertySelect.value);
 if (!returning || arrivalReturning !== null) {
  checkoutHousekeepingReturn = null;
  clearCheckoutHousekeepingReturnControl();
  return null;
 }
 checkoutHousekeepingReturn = returning;
 checkoutHousekeepingBrowserGeneration = Math.max(checkoutHousekeepingBrowserGeneration, returning.browserGeneration);
 ensureCheckoutHousekeepingReturnControl(returning);
 return returning;
 }
 function restoreCheckoutHousekeepingRoomFocus(returning) {
 const current = checkoutHousekeepingReturnFromState(history.state, propertySelect.value);
 if (!sameCheckoutHousekeepingDescriptor(current, returning) ||
  !sameCheckoutHousekeepingDescriptor(checkoutHousekeepingReturn, returning) ||
  activeView !== "housekeeping" || location.pathname !== `/p/${returning.property}/housekeeping` ||
  location.search !== "") return false;
 const row = housekeepingConditionRows.find((candidate) => candidate.spaceId === returning.assignedSpaceId);
 const card = row ? [...housekeepingConditionList.querySelectorAll(".housekeeping-condition-card")]
  .find((candidate) => candidate.dataset.spaceId === returning.assignedSpaceId) : null;
 (card?.isConnected ? card : housekeepingConditionTitle).focus({ preventScroll: true });
 return true;
 }
 async function openCheckoutHousekeeping(origin, section, action) {
 if (!checkoutHousekeepingCompletionActionIsCurrent(origin, section, action)) return false;
 const returning = Object.freeze({ ...origin });
 checkoutHousekeepingReturn = returning;
 history.pushState({ yellowSurface: "housekeeping", checkoutHousekeepingReturn: returning }, "", `/p/${origin.property}/housekeeping`);
 closeReservationDetail({
  history: false,
  restoreFocus: false,
  preserveCheckoutHousekeepingReturn: true,
 });
 setView("housekeeping", false);
 return true;
 }
 async function returnFromHousekeepingToCheckedOutReservation({ fromHistory = false } = {}) {
 const returning = fromHistory ? checkoutHousekeepingReturn :
  checkoutHousekeepingReturnFromState(history.state, propertySelect.value);
 if (!returning || returning.property !== propertySelect.value ||
  returning.originPath !== `/p/${returning.property}/res/${returning.reservationId}`) return false;
 if (!fromHistory) {
  checkoutHousekeepingReturn = returning;
  history.back();
  return true;
 }
 if (`${location.pathname}${location.search}` !== returning.originPath) return false;
 clearCheckoutHousekeepingReturnControl();
 setView("reservations", false);
 reservationDrawerReturnView = "";
 reservationDrawerReturnReservationId = returning.reservationId;
 await openReservationDetail(returning.reservationId, { push: false });
 return true;
 }
 function renderCheckoutHousekeepingReview(reservation) {
 for (const section of reservationDetailContent.querySelectorAll(".checkout-housekeeping-completion")) section.remove();
 checkoutHousekeepingActionOrigin = null;
 const completion = checkoutHousekeepingCompletionFromState(history.state, propertySelect.value, reservation.reservationId);
 if (!completion || completion.detailGeneration !== reservationDetailGeneration ||
  checkoutHousekeepingDepartedSegment(reservation) === null || reservation.status !== "checked_out" ||
  reservation.confirmationNo !== completion.confirmationNo) {
  checkoutHousekeepingCompletion = null;
  return null;
 }
 checkoutHousekeepingCompletion = completion;
 checkoutHousekeepingBrowserGeneration = Math.max(checkoutHousekeepingBrowserGeneration, completion.browserGeneration);
 const section = node("section", "reservation-detail-section checkout-housekeeping-completion");
 section.dataset.reservationId = completion.reservationId;
 section.dataset.spaceId = completion.assignedSpaceId;
 const title = node("h4", "", "Checkout complete");
 const copy = node("p", "field-note", "Review the released room in canonical Housekeeping condition truth. No room condition or work is inferred here.");
 const action = node("button", "quiet checkout-housekeeping-action", "Review room in Housekeeping");
 action.type = "button";
 action.dataset.reservationId = completion.reservationId;
 action.dataset.spaceId = completion.assignedSpaceId;
 action.dataset.browserGeneration = String(completion.browserGeneration);
 action.setAttribute("aria-label", `Review released room in Housekeeping for reservation ${completion.confirmationNo}`);
 checkoutHousekeepingActionOrigin = completion;
 action.addEventListener("click", () => void openCheckoutHousekeeping(completion, section, action));
 section.append(title, copy, action);
 reservationDetailContent.append(section);
 return action;
 }
 function restoreCheckoutHousekeepingDetailFocus(reservation) {
 const returning = checkoutHousekeepingReturn;
 if (!returning || activeView !== "reservations" || currentReservationWorkbench !== null ||
  `${location.pathname}${location.search}` !== returning.originPath ||
  returning.property !== propertySelect.value || returning.reservationId !== reservationRouteReservationId ||
  reservation?.reservationId !== returning.reservationId || reservation.confirmationNo !== returning.confirmationNo ||
  reservation.status !== "checked_out") return false;
 const action = reservationDetailContent.querySelector(".checkout-housekeeping-action");
 const exact = sameCheckoutHousekeepingDescriptor(returning, checkoutHousekeepingCompletion) &&
  checkoutHousekeepingCompletionActionIsCurrent(checkoutHousekeepingCompletion,
   action?.closest(".checkout-housekeeping-completion"), action);
 reservationDetailTitle.tabIndex = -1;
 (exact ? action : reservationDetailTitle).focus({ preventScroll: true });
 checkoutHousekeepingReturn = null;
 return true;
 }
  async function submitCheckout(event) {
 event.preventDefault();
 if (!reservationDetailData || checkoutReadinessData?.ready !== true || !departureCheckoutConfirm.checked || checkoutPending) return;
 const reservationId = reservationDetailData.reservation.reservationId;
 const property = propertySelect.value;
 const detailGeneration = reservationDetailGeneration;
 const readinessGeneration = checkoutReadinessGeneration;
 const draft = JSON.stringify({ property, reservationId });
 if (!checkoutAttemptKey || checkoutAttemptDraft !== draft) {
  checkoutAttemptKey = crypto.randomUUID();
  checkoutAttemptDraft = draft;
 }
 const attemptKey = checkoutAttemptKey;
 checkoutPending = true;
 departureCheckoutForm.setAttribute("aria-busy", "true");
 departureMessage.classList.remove("error");
 departureMessage.textContent = "Checking out from locked, current server truth…";
 syncCheckoutConfirmation();
 let focusRefresh = false;
 try {
  const result = checkoutResult(await request(`/api/v1/properties/${enc(property)}/reservations/${enc(reservationId)}/checkout`, {
   method: "POST", headers: { "idempotency-key": attemptKey }, body: "{}",
  }), reservationId);
  if (!checkoutReadinessIsCurrent(readinessGeneration, detailGeneration, property, reservationId)) return;
  checkoutAttemptKey = "";
  checkoutAttemptDraft = "";
  departureCheckoutConfirm.checked = false;
  departureMessage.textContent = result.replayed
   ? "Existing checkout confirmed. Refreshing the authoritative stay and Today lanes…"
   : "Guest checked out. Refreshing the authoritative stay and Today lanes…";
  checkoutCompletionNotice = Object.freeze({
   property,
   reservationId,
   message: result.replayed
    ? "Existing checkout confirmed. Reservation detail and departure evidence are refreshed from server truth."
    : "Guest checked out. Reservation detail and departure evidence are refreshed from server truth.",
  });
  announceOperation(result.replayed ? "Existing checkout confirmed." : "Guest checked out successfully.");
  void loadToday();
  const confirmationNo = reservationDetailData.reservation.confirmationNo;
  const detailRefresh = loadReservationDetail(reservationId);
  const authoritativeDetailGeneration = reservationDetailGeneration;
  const browserGeneration = ++checkoutHousekeepingBrowserGeneration;
  const completion = checkoutHousekeepingCompletionDescriptor(result, {
   property,
   reservationId,
   confirmationNo,
   originPath: `/p/${property}/res/${reservationId}`,
   detailGeneration: authoritativeDetailGeneration,
   browserGeneration,
  });
  if (completion === null) return;
  checkoutHousekeepingCompletion = completion;
  history.replaceState({
   yellowSurface: "reservation-detail",
   checkoutHousekeepingCompletion: completion,
  }, "", completion.originPath);
  await detailRefresh;
  if (authoritativeDetailGeneration !== reservationDetailGeneration || property !== propertySelect.value
   || reservationRouteReservationId !== reservationId || reservationDetailData?.reservation?.reservationId !== reservationId
   || reservationDetailData.reservation.status !== "checked_out" || reservationDetailDrawer.hidden
   || location.pathname !== `/p/${property}/res/${reservationId}`) return;
  departureMessage.textContent = result.replayed
   ? "Existing checkout confirmed. Reservation detail is refreshed from server truth."
   : "Guest checked out. Reservation detail is refreshed from server truth.";
  const housekeepingAction = reservationDetailContent.querySelector(".checkout-housekeeping-action");
  (housekeepingAction?.isConnected ? housekeepingAction : reservationDetailTitle).focus({ preventScroll: true });
 } catch (error) {
  if (!checkoutReadinessIsCurrent(readinessGeneration, detailGeneration, property, reservationId)) return;
  const conflict = error?.status === 409;
  if (conflict) {
   checkoutReadinessData = null;
   departureCheckoutConfirm.checked = false;
   departureBadge.textContent = "Refresh required";
   departureBadge.dataset.state = "blocked";
   departureSummary.textContent = "Checkout conditions changed on the server. Refresh departure readiness before retrying.";
   focusRefresh = true;
  }
  departureMessage.classList.add("error");
  departureMessage.textContent = conflict
   ? `${error instanceof Error ? error.message : "Checkout conditions changed"}. Refresh departure readiness; the same request key is retained.`
   : `${error instanceof Error ? error.message : "Checkout could not be completed"}. Retry keeps the same request key; refresh departure readiness if conditions changed.`;
  if (!conflict) departureHeading.focus({ preventScroll: true });
 } finally {
  if (property === propertySelect.value && reservationRouteReservationId === reservationId) {
   checkoutPending = false;
   departureCheckoutForm.setAttribute("aria-busy", "false");
   syncCheckoutConfirmation();
   if (focusRefresh) departureRefresh.focus({ preventScroll: true });
  }
 }
 }
  function canonicalizeReservationWorkbenchIntent(reservationId) {
 currentReservationWorkbench = null;
 const plainDetail = `/p/${propertySelect.value}/res/${reservationId}`;
 if (location.pathname === plainDetail && location.search) {
  history.replaceState(history.state, "", plainDetail);
 }
 }
  function reservationOperationalPreparation(status) {
  if (status === "due_in") return Object.freeze({ workbench: "check-in", label: "Prepare check-in" });
  if (status === "in_house" || status === "due_out") {
   return Object.freeze({ workbench: "checkout", label: "Prepare checkout" });
  }
  return null;
 }
  function reservationOperationalPreparationReturnFromState(state, property, reservationId) {
  const value = state?.reservationOperationalPreparationReturn;
  if (state?.yellowSurface !== "reservation-detail" || !value || typeof value !== "object" || Array.isArray(value) ||
   Object.keys(value).sort().join(",") !== "confirmationNo,exitAction,property,reservationId,status,workbench" ||
   value.property !== property || value.reservationId !== reservationId || !canonicalUuid(value.property) ||
   !canonicalUuid(value.reservationId) || typeof value.confirmationNo !== "string" || value.confirmationNo.length < 1 ||
   value.confirmationNo.length > 120 || !["back", "replace"].includes(value.exitAction) ||
   reservationOperationalPreparation(value.status)?.workbench !== value.workbench) return null;
  return Object.freeze({ ...value });
 }
  function reservationOperationalPreparationActionIsCurrent(origin, action) {
  const reservation = reservationDetailData?.reservation;
  const preparation = reservationOperationalPreparation(reservation?.status);
  return activeView === "reservations" && origin.detailGeneration === reservationDetailGeneration &&
   origin.property === propertySelect.value && origin.reservationId === reservationRouteReservationId &&
   reservation?.reservationId === origin.reservationId && reservation.confirmationNo === origin.confirmationNo &&
   reservation.status === origin.status && preparation?.workbench === origin.workbench &&
   location.pathname === `/p/${origin.property}/res/${origin.reservationId}` && location.search === "" &&
   reservationDetailDrawer.isConnected && reservationDetailDrawer.hidden === false &&
   reservationDetailContent.isConnected && reservationDetailContent.hidden === false &&
   reservationDetailActions.isConnected && reservationDetailActions.hidden === false &&
   action?.isConnected && action.hidden === false && action.disabled === false && reservationDetailDrawer.contains(action);
 }
  function openReservationOperationalPreparation(origin, action) {
  if (!reservationOperationalPreparationActionIsCurrent(origin, action)) return;
  const returnState = Object.freeze({
   property: origin.property,
   reservationId: origin.reservationId,
   confirmationNo: origin.confirmationNo,
   status: origin.status,
   workbench: origin.workbench,
   exitAction: reservationExitHistoryAction(history.state, "reservation-detail"),
  });
  const path = `/p/${origin.property}/res/${origin.reservationId}?${RESERVATION_WORKBENCH_QUERY[origin.workbench]}`;
  history.pushState({
   yellowSurface: "reservation-detail",
   reservationOperationalPreparationReturn: returnState,
  }, "", path);
  const route = reservationRoute();
  if (route.kind !== "detail" || route.property !== origin.property || route.reservationId !== origin.reservationId ||
   route.workbench !== origin.workbench) return;
  reservationOperationalPreparationReturn = returnState;
  currentReservationWorkbench = route.workbench;
  reservationDetailStatus.textContent = `${origin.workbench === "check-in" ? "Check-in" : "Checkout"} preparation opened. Authoritative readiness and explicit confirmation remain required; no command was run.`;
  applyReservationWorkbenchIntent(reservationDetailData.reservation);
 }
  function restoreReservationOperationalPreparationFocus(reservation) {
  const returning = reservationOperationalPreparationReturn;
  if (!returning || currentReservationWorkbench !== null || activeView !== "reservations" ||
   location.pathname !== `/p/${propertySelect.value}/res/${reservation.reservationId}` || location.search !== "") return;
  const preparation = reservationOperationalPreparation(reservation.status);
  const action = reservationDetailActions.querySelector(".reservation-operational-preparation-action");
  const exact = returning.property === propertySelect.value && returning.reservationId === reservation.reservationId &&
   returning.confirmationNo === reservation.confirmationNo && returning.status === reservation.status &&
   preparation?.workbench === returning.workbench && action?.isConnected && action.hidden === false;
  reservationDetailTitle.tabIndex = -1;
  (exact ? action : reservationDetailTitle).focus({ preventScroll: true });
  reservationOperationalPreparationReturn = null;
 }
  function applyReservationWorkbenchIntent(reservation) {
 const intent = currentReservationWorkbench;
 const checkInCompatible = intent === "check-in" && reservation.status === "due_in";
 const checkoutCompatible = intent === "checkout" && ["in_house", "due_out"].includes(reservation.status);
 if (intent && !checkInCompatible && !checkoutCompatible) {
  canonicalizeReservationWorkbenchIntent(reservation.reservationId);
  reservationDetailStatus.textContent = `${intent === "check-in" ? "Check-in" : "Checkout"} preparation is no longer compatible with the authoritative reservation status. Plain detail remains open; no command was run.`;
  announceOperation("Preparation route removed because the reservation status changed. No command was run.");
  reservationDetailDrawer.focus({ preventScroll: true });
 }
 if (reservation.status === "due_in") void loadCheckInReadiness({ focus: checkInCompatible });
 else clearCheckInWorkbench();
 void loadCheckoutReadiness({ focus: checkoutCompatible });
 }
  function renderReservationDetail(result) {
 clearReservationDrawerLifecycle();
 const reservation = result.reservation;
 reservationDetailData = result;
 reservationDetailTitle.textContent = reservation.confirmationNo;
 reservationDetailContent.replaceChildren();
 const primary = reservation.guests.find(({ role }) => role === "primary");
 reservationDetailContent.append(
  detailSection("Summary", [
  ["Guest", primary?.displayName || "Not recorded"],
  ["Status", reservationStatusLabels[reservation.status] || reservation.status],
  ["Channel", reservation.channelCode], ["Currency", reservation.currency],
  ["Created", reservationDateTime(reservation.createdAt)], ["Notes", reservation.notes],
  ]),
  detailCollection("Stay segments", reservation.segments, (segment) =>
  `${reservationDateTime(segment.from)} – ${reservationDateTime(segment.to)} · ${segment.adults} adult${segment.adults === 1 ? "" : "s"} · ${segment.status}`),
  detailCollection("Guests", reservation.guests, (guest) =>
  `${guest.displayName} · ${guest.role}${guest.sharePct ? ` · ${guest.sharePct}% share` : ""}`),
  detailCollection("Alerts", reservation.alerts, (alert) =>
  `${alert.active ? "Active" : "Inactive"} · ${alert.showOn} · ${alert.message}`),
  reservationTravelDetailCollection(reservation.travel),
  detailCollection("History", reservation.history, (fact) =>
  `${reservationDateTime(fact.recordedAt)} · ${fact.factType}`),
 );
 renderReservationFolios(result);
 renderReservationDrawerLifecycle(result);
 reservationDetailLoading.hidden = true;
 reservationDetailError.hidden = true;
 reservationDetailContent.hidden = false;
 reservationDetailStatus.textContent = "Complete reservation detail loaded from server truth.";
 reservationDetailDrawer.setAttribute("aria-busy", "false");
 applyReservationWorkbenchIntent(reservation);
 renderCheckoutHousekeepingReview(reservation);
 restoreReservationOperationalPreparationFocus(reservation);
 restoreReservationFolioReturnFocus(result);
 restoreCheckoutHousekeepingDetailFocus(reservation);
 }
 function restoreReservationFolioReturnFocus(result) {
 const returning = reservationFolioReturn;
 const reservation = result?.reservation;
 if (!returning) return;
 const exact = activeView === "reservations" && `${location.pathname}${location.search}` === returning.originPath &&
  returning.property === propertySelect.value && returning.reservationId === reservationRouteReservationId &&
  returning.reservationId === reservation?.reservationId && returning.confirmationNo === reservation?.confirmationNo &&
  returning.reservationStatus === reservation?.status && returning.workbench === currentReservationWorkbench &&
  reservationDetailDrawer.isConnected && reservationDetailDrawer.hidden === false;
 if (!exact) {
  reservationFolioReturn = null;
  return;
 }
 const action = [...reservationDetailFolioList.querySelectorAll(".reservation-folio-open")]
  .find((item) => item.dataset.folioId === returning.folioId);
 reservationDetailFolios.tabIndex = -1;
 (action?.isConnected ? action : reservationDetailFolios).focus({ preventScroll: true });
 reservationFolioReturn = null;
 }
  async function loadReservationDetail(reservationId) {
 const generation = ++reservationDetailGeneration;
 const property = propertySelect.value;
 reservationRouteReservationId = reservationId;
 const retainedCheckoutCompletion = checkoutHousekeepingCompletionFromState(history.state, property, reservationId);
 if (retainedCheckoutCompletion && location.pathname === retainedCheckoutCompletion.originPath && location.search === "") {
  const refreshedCompletion = Object.freeze({ ...retainedCheckoutCompletion, detailGeneration: generation });
  checkoutHousekeepingCompletion = refreshedCompletion;
  checkoutHousekeepingBrowserGeneration = Math.max(
   checkoutHousekeepingBrowserGeneration, refreshedCompletion.browserGeneration,
  );
  if (checkoutHousekeepingReturn?.property === refreshedCompletion.property &&
   checkoutHousekeepingReturn.reservationId === refreshedCompletion.reservationId &&
   checkoutHousekeepingReturn.assignedSpaceId === refreshedCompletion.assignedSpaceId &&
   checkoutHousekeepingReturn.browserGeneration === refreshedCompletion.browserGeneration) {
   checkoutHousekeepingReturn = refreshedCompletion;
  }
  history.replaceState({
   yellowSurface: "reservation-detail",
   checkoutHousekeepingCompletion: refreshedCompletion,
  }, "", refreshedCompletion.originPath);
 }
 if (!reservationPickupTaskRoute()) reservationRoutePickupTaskId = "";
 reservationPickupTaskRequestGeneration += 1;
 reservationPickupTaskData = null;
 reservationPickupTaskReturnFocus = null;
 reservationDetailDrawer.classList.remove("is-pickup-task-detail");
 for (const panel of reservationDetailDrawer.querySelectorAll(".pickup-task-detail-panel")) panel.remove();
 reservationDetailTitle.textContent = "Loading reservation…";
 reservationDetailLoading.hidden = false;
 reservationDetailError.hidden = true;
 reservationDetailContent.hidden = true;
 clearCheckInWorkbench({ preserveDraft: true });
 clearCheckoutReadinessWorkbench();
 reservationDetailFolios.hidden = true;
 reservationDetailFolioList.replaceChildren();
 reservationPrimaryFolioCreate.hidden = true;
 reservationPrimaryFolioMessage.textContent = "";
 if (reservationPrimaryFolioReservationId !== reservationId) {
  reservationPrimaryFolioAttemptKey = "";
  reservationPrimaryFolioReservationId = "";
 }
 clearReservationDrawerLifecycle();
 reservationDetailDrawer.setAttribute("aria-busy", "true");
 reservationDetailStatus.textContent = "Loading reservation details…";
 try {
  const result = await request(`/api/v1/properties/${enc(property)}/reservations/${enc(reservationId)}`);
  if (generation !== reservationDetailGeneration || property !== propertySelect.value || reservationRouteReservationId !== reservationId) return;
  renderReservationDetail(result);
 } catch (error) {
  if (generation !== reservationDetailGeneration || property !== propertySelect.value || reservationRouteReservationId !== reservationId) return;
  reservationDetailLoading.hidden = true;
  reservationDetailError.hidden = false;
  reservationDetailError.querySelector("p").textContent = error?.status === 404
  ? "This reservation was not found for the current property."
  : error?.status === 403 ? "Reservation access is not granted for this property."
   : error instanceof Error ? error.message : "The reservation is unavailable.";
  reservationDetailStatus.textContent = error?.status === 404 ? "Reservation not found." : "Reservation detail unavailable.";
  reservationDetailDrawer.setAttribute("aria-busy", "false");
 }
 }
  async function openReservationDetail(reservationId, { push = true, trigger = null, workbench = null } = {}) {
 closeReservationCreate({ history: false, force: true });
 const reopeningSameDetail = reservationDetailDrawer.hidden === false && reservationRouteReservationId === reservationId;
 const operationalReturn = reservationOperationalPreparationReturnFromState(history.state, propertySelect.value, reservationId);
 if (operationalReturn) reservationOperationalPreparationReturn = operationalReturn;
 const linkedVehicleReturn = vehicleLinkedReservationReturnFromState(history.state, propertySelect.value, reservationId);
 const registerVehicleReturn = linkedVehicleReturn ? null
  : vehicleRegisterLinkedReservationReturnFromState(history.state, propertySelect.value, reservationId);
 if (linkedVehicleReturn) {
  vehicleLinkedReservationReturn = linkedVehicleReturn;
  reservationDrawerReturnView = "vehicles";
  reservationDrawerReturnReservationId = reservationId;
 } else if (registerVehicleReturn) {
  vehicleRegisterLinkedReservationReturn = registerVehicleReturn;
  reservationDrawerReturnView = "vehicle-register";
  reservationDrawerReturnReservationId = reservationId;
 } else if (activeView === "today") {
  reservationDrawerReturnView = "today";
  reservationDrawerReturnReservationId = reservationId;
  setView("reservations", false);
 } else if (reservationDrawerReturnView === "vehicles" || reservationDrawerReturnView === "vehicle-register") {
  vehicleLinkedReservationReturn = null;
  vehicleRegisterLinkedReservationReturn = null;
  reservationDrawerReturnView = "";
  reservationDrawerReturnReservationId = "";
 }
 if (!reopeningSameDetail || trigger !== null) reservationDrawerReturnFocus = trigger;
 currentReservationWorkbench = workbench === "check-in" || workbench === "checkout" ? workbench : null;
 reservationDetailDrawer.hidden = false;
 if (push) {
  const query = currentReservationWorkbench ? `?${RESERVATION_WORKBENCH_QUERY[currentReservationWorkbench]}` : "";
  const path = `/p/${propertySelect.value}/res/${reservationId}${query}`;
  history.pushState({ yellowSurface: "reservation-detail" }, "", path);
 }
 reservationDetailDrawer.focus();
 await loadReservationDetail(reservationId);
 }
  async function openReservationPickupTaskRoute(reservationId, taskId) {
 await openReservationDetail(reservationId, { push: false });
 if (!canonicalUuid(taskId) || reservationDetailData?.reservation?.reservationId !== reservationId ||
  location.pathname !== canonicalReservationPickupTaskPath(propertySelect.value, reservationId, taskId)) return;
 reservationRoutePickupTaskId = taskId;
 await openReservationPickupTaskDetail(reservationDetailData.reservation, taskId, { push: false });
 }
  function closeReservationDetail({ history: updateHistory = true, restoreFocus = true,
   preserveCheckInHousekeepingReturn = false, preserveCheckoutHousekeepingReturn = false } = {}) {
 if (reservationDetailDrawer.hidden) return;
 const operationalReturn = reservationOperationalPreparationReturnFromState(
  history.state, propertySelect.value, reservationRouteReservationId,
 );
 const linkedVehicleReturn = reservationDrawerReturnView === "vehicles"
  ? vehicleLinkedReservationReturnFromState(history.state, propertySelect.value, reservationRouteReservationId)
  : null;
 const registerVehicleReturn = reservationDrawerReturnView === "vehicle-register"
  ? vehicleRegisterLinkedReservationReturnFromState(history.state, propertySelect.value, reservationRouteReservationId)
  : null;
 if (updateHistory && registerVehicleReturn && returnFromReservationToVehicleRegister()) return;
 closeReservationPickupTaskDetail({ history: false, restoreFocus: false });
 reservationDetailGeneration += 1;
 reservationRouteReservationId = "";
 currentReservationWorkbench = null;
 reservationOperationalPreparationReturn = null;
 if (!preserveCheckInHousekeepingReturn) {
  checkInHousekeepingReturn = null;
  housekeepingArrivalReturnAction.hidden = true;
 }
 if (!preserveCheckoutHousekeepingReturn) {
  checkoutHousekeepingCompletion = null;
  checkoutHousekeepingActionOrigin = null;
  checkoutHousekeepingReturn = null;
  clearCheckoutHousekeepingReturnControl();
 }
 reservationPrimaryFolioAttemptKey = "";
 reservationPrimaryFolioReservationId = "";
 reservationDetailData = null;
 clearCheckInWorkbench();
 clearCheckoutReadinessWorkbench();
 reservationDetailDrawer.hidden = true;
 reservationDetailContent.replaceChildren();
 reservationDetailFolios.hidden = true;
 reservationDetailFolioList.replaceChildren();
 clearReservationDrawerLifecycle();
 const returnView = reservationDrawerReturnView === "vehicles" && linkedVehicleReturn === null
  ? "" : reservationDrawerReturnView === "vehicle-register" && registerVehicleReturn === null
   ? "" : reservationDrawerReturnView;
 const returnReservationId = reservationDrawerReturnReservationId;
 if (updateHistory && propertySelect.value) {
  if (returnView === "today") history.replaceState(null, "", `/p/${propertySelect.value}/today`);
  else if (operationalReturn?.exitAction === "back") history.go(-2);
  else if (operationalReturn?.exitAction === "replace") history.replaceState(null, "", `/p/${propertySelect.value}/reservations`);
  else if (returnView === "vehicles") history.back();
  else if (reservationExitHistoryAction(history.state, "reservation-detail") === "back") history.back();
  else history.replaceState(null, "", `/p/${propertySelect.value}/reservations`);
 }
 if (returnView === "today") {
  todayReturnFocus = { reservationId: returnReservationId, cycle: 0 };
  setView("today", false);
 }
 if (restoreFocus && returnView !== "vehicles" && returnView !== "vehicle-register") {
  const target = returnView === "today" ? document.querySelector("#today-title") :
  reservationDrawerReturnFocus?.isConnected ? reservationDrawerReturnFocus : $("#reservations-title");
  target?.focus();
 }
 reservationDrawerReturnFocus = null;
 reservationDrawerReturnView = "";
 reservationDrawerReturnReservationId = "";
 vehicleLinkedReservationReturn = null;
 vehicleRegisterLinkedReservationReturn = null;
 }
  function syncReservationRoute() {
 const route = reservationNavigationRoute();
 if (route.kind === "other" || !propertySelect.value || route.property !== propertySelect.value) return;
 if (route.kind === "detail") {
  if (reservationRouteReservationId !== route.reservationId || currentReservationWorkbench !== route.workbench || reservationDetailDrawer.hidden) {
  void openReservationDetail(route.reservationId, { push: false, workbench: route.workbench });
  } else if (reservationRoutePickupTaskId) {
  closeReservationPickupTaskDetail({ history: false, restoreFocus: true });
  }
  return;
 }
 if (route.kind === "pickup-task") {
  if (reservationRouteReservationId !== route.reservationId || reservationDetailDrawer.hidden ||
   reservationDetailData?.reservation?.reservationId !== route.reservationId) {
  void openReservationPickupTaskRoute(route.reservationId, route.taskId);
  } else if (reservationRoutePickupTaskId !== route.taskId ||
   !reservationDetailDrawer.classList.contains("is-pickup-task-detail")) {
  reservationRoutePickupTaskId = route.taskId;
  void openReservationPickupTaskDetail(reservationDetailData.reservation, route.taskId, { push: false });
  }
  return;
 }
 closeReservationDetail({ history: false });
 if (route.kind === "create") {
  const continuing = reservationCreatePanel.hidden === false && reservationCreateProperty === propertySelect.value;
  const step = allowedReservationCreateStep(route.step, reservationCreatePrerequisites(continuing));
  if (!continuing) resetReservationCreateJourney();
  reservationBoard.hidden = true;
  reservationCreatePanel.hidden = false;
  reservationCreateProperty = propertySelect.value;
  setReservationCreateStep(step, { push: false, focus: false });
  if (step !== route.step) {
  const name = ["stay", "guest", "offer", "review"][step - 1];
  history.replaceState({ yellowSurface: "reservation-create" }, "", `/p/${propertySelect.value}/reservations?new=1&step=${name}`);
  }
 } else {
  closeReservationCreate({ history: false, force: true });
 }
 }
  function inventoryItem(titleText, detailText, badgeText) {
 const item = node("article", "inventory-item");
 const copy = el("div");
 const title = node("strong", "", titleText);
 const detail = node("span", "", detailText);
 copy.append(title, detail);
 const badge = node("span", "mini-badge", badgeText);
 item.append(copy, badge);
 return item;
 }
  function populateSelect(select, items, label, value) {
 select.replaceChildren();
 if (items.length === 0) {
  const option = el("option");
  option.value = "";
  option.textContent = `Create a ${label} first`;
  select.append(option);
  select.disabled = true;
  return;
 }
 select.disabled = false;
 for (const item of items) {
  const option = el("option");
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
  inventoryData = await request(`/api/v1/properties/${enc(property)}/inventory`);
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
  renderProjectionStatus(await request(`/api/v1/properties/${enc(property)}/availability-projection`));
 } catch (error) {
  projectionSummary.textContent = error instanceof Error ? error.message : "Projection status could not be loaded";
 }
 }
  function renderOperationalBlocks() {
 operationalBlockCount.textContent = String(operationalBlocksData.length);
 activeBlockList.replaceChildren(...operationalBlocksData.map((block) => {
  const item = node("article", "restriction-item");
  const copy = el("div");
  const title = el("strong");
  const space = inventoryData.spaces.find(({ id }) => id === block.spaceId);
  title.textContent = `${block.kind === "ooo" ? "Out of order" : "Out of service"} · ${space?.code || block.spaceId}`;
  const detail = node("span", "", `${new Date(block.from).toLocaleString()} → ${new Date(block.to).toLocaleString()} · ${block.reason}`);
  copy.append(title, detail);
  const actions = node("div", "block-actions");
  const badge = node("span", `mini-badge block-badge-${block.kind}`, block.kind.toUpperCase());
  const close = el("button");
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
  request(`/api/v1/properties/${enc(property)}/operational-blocks`),
  request(`/api/v1/properties/${enc(property)}/inventory`),
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
 const body = await request(`/api/v1/properties/${enc(property)}/inventory-policy`);
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
  await request(`/api/v1/properties/${enc(propertySelect.value)}/operational-blocks/${enc(block.id)}/close`, {
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
  const card = node("article", "restriction-item");
  const copy = el("div");
  const title = node("strong", "", restrictionKindLabel(item.kind));
  const detail = el("span");
  const roomType = inventoryData.unitTypes.find(({ id }) => id === item.unitTypeId);
  const scope = roomType ? `${roomType.code} · ${roomType.name}` : "All room types";
  detail.textContent = `${item.stayStart} → ${item.stayEnd} (end exclusive) · ${scope}${item.channelCode ? ` · ${item.channelCode}` : ""}`;
  copy.append(title, detail);
  const badge = node("span", "mini-badge restriction-badge", item.value === null ? "Active" : String(item.value));
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
  request(`/api/v1/properties/${enc(property)}/restrictions`),
  request(`/api/v1/properties/${enc(property)}/inventory`),
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
  const empty = node("li", "ai-empty", emptyMessage);
  list.append(empty);
  return;
 }
 for (const value of items) {
  const item = node("li", "", String(value));
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
  const body = await request(`/api/v1/properties/${enc(propertySelect.value)}/rate-builder/${enc(builderPlan.value)}/intents:interpret`, {
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
  const label = node("label", "model-choice");
  const radio = el("input");
  radio.type = "radio";
  radio.name = "builder-model";
  radio.value = entry.key;
  radio.checked = entry.key === builderSelectedModel;
  const copy = node("span", "model-choice-copy");
  const title = node("strong", "", entry.label);
  const description = node("small", "", entry.description);
  const capabilities = node("em", "", entry.capabilities.join(" · ").replaceAll("-", " "));
  copy.append(title, description, capabilities);
  label.append(radio, copy);
  builderModelCatalogue.append(label);
  if (entry.key !== "expert-composition") {
  const component = el("label");
  const check = el("input");
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
 const label = el("label");
 label.append(document.createTextNode(labelText));
 const input = el("input");
 input.dataset.targetField = name;
 input.value = value;
 for (const [key, entry] of Object.entries(attributes)) input.setAttribute(key, String(entry));
 label.append(input);
 return label;
 }
  function targetSelect(labelText, name, options, value = "") {
 const label = el("label");
 label.append(document.createTextNode(labelText));
 const select = el("select");
 select.dataset.targetField = name;
 for (const [optionValue, optionLabel] of options) {
  const option = el("option");
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
  const placeholder = el("option");
  placeholder.value = "";
  placeholder.textContent = `Choose ${label}`;
  select.append(placeholder);
 }
 for (const item of items) {
  const option = el("option");
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
 const details = node("details", "target-rule-card");
 details.open = builderTargetCards().length === 0;
 const summary = el("summary");
 const summaryCopy = el("span");
 const summaryTitle = el("strong");
 summaryTitle.dataset.targetSummaryTitle = "";
 const summaryDetail = el("small");
 summaryDetail.dataset.targetSummaryCopy = "";
 summaryCopy.append(summaryTitle, summaryDetail);
 const effectBadge = el("b");
 effectBadge.dataset.targetSummaryEffect = "";
 summary.append(summaryCopy, effectBadge);
 const body = node("div", "target-rule-body");
 const core = node("div", "builder-form-grid four-up target-rule-core");
 core.append(
  targetInput("Stable rule key", "key", initial.key || `property-rule-${sequence}`, { maxlength: 64, pattern: "[a-z0-9][a-z0-9._-]{0,63}" }),
  targetSelect("Effect", "effect", [["include", "Include"], ["exclude", "Exclude"]], initial.effect || "include"),
  targetInput("Priority", "priority", String(initial.priority ?? 0), { type: "number", min: 0, max: 1000 }),
  targetSelect("Physical scope", "physicalKind", [["property", "Whole property"], ["class", "Room class"], ["unit_type", "Room type"], ["sellable", "Exact sellable room"]], physical.kind || "property"),
 );
 const scope = node("div", "builder-form-grid two-up target-scope-fields");
 const classCode = targetInput("Class code", "classCode", physical.kind === "class" ? physical.classCode || "" : "", { maxlength: 64, placeholder: "DELUXE" });
 classCode.dataset.targetScope = "class";
 const classMembership = el("label");
 classMembership.dataset.targetScope = "class";
 classMembership.append(document.createTextNode("Exact room-type membership"));
 const classSelect = el("select");
 classSelect.dataset.targetField = "unitTypeIds";
 classSelect.multiple = true;
 classSelect.size = 4;
 classMembership.append(classSelect);
 const unitType = targetSelect("Room type", "unitTypeId", [], physical.kind === "unit_type" ? physical.unitTypeId || "" : "");
 unitType.dataset.targetScope = "unit_type";
 const sellable = targetSelect("Sellable room", "sellableUnitId", [], physical.kind === "sellable" ? physical.sellableUnitId || "" : "");
 sellable.dataset.targetScope = "sellable";
 scope.append(classCode, classMembership, unitType, sellable);
 const commercialDetails = node("details", "target-commercial-fields");
 const commercialSummary = node("summary", "", "Commercial dimensions and exceptions");
 const commercialGrid = node("div", "builder-form-grid three-up");
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
 const actions = node("div", "target-rule-actions");
 const previewLabel = node("label", "preview-rule-choice");
 const previewRadio = el("input");
 previewRadio.type = "radio";
 previewRadio.name = "builder-preview-target";
 previewRadio.checked = builderTargetCards().length === 0;
 previewLabel.append(previewRadio, document.createTextNode("Use this rule's context in server preview"));
 const duplicate = el("button");
 duplicate.type = "button";
 duplicate.className = "quiet compact";
 duplicate.dataset.targetAction = "duplicate";
 duplicate.textContent = "Duplicate";
 const remove = el("button");
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
  const card = node("article", "release-row release-item");
  const state = node("span", "release-state", release.status);
  const copy = el("div");
  const title = node("strong", "", `Version ${release.extensionVersion} · ${release.status}`);
  const detail = node("small", "", `${release.contentHash.slice(0, 12)}${release.undoOfVersion ? ` · undo of v${release.undoOfVersion}` : ""}`);
  const command = builderReleaseCommand(release);
  const commandSummary = node("small", "", builderReleaseSummary(command));
  copy.append(title, detail, commandSummary);
  const actions = node("div", "release-actions");
  if (release.status === "draft") {
  const use = el("button");
  use.type = "button";
  use.className = "quiet compact";
  use.textContent = release.id === builderReleaseId ? "Selected" : "Use draft";
  use.disabled = release.id === builderReleaseId;
  use.addEventListener("click", () => selectBuilderRelease(release.id));
  actions.append(use);
  }
  const reuse = el("button");
  reuse.type = "button";
  reuse.className = "quiet compact";
  reuse.textContent = "Use as starting point";
  reuse.addEventListener("click", () => loadBuilderReleaseAsStartingPoint(release));
  actions.append(reuse);
  if (release.status === "active" || release.status === "retired") {
  const undo = el("button");
  undo.type = "button";
  undo.className = "quiet compact";
  undo.textContent = "Create undo draft";
  undo.addEventListener("click", () => void createBuilderUndo(release.id, undo));
  actions.append(undo);
  }
  const inspection = node("details", "release-inspection");
  const inspectionTitle = node("summary");
  inspectionTitle.textContent = "Inspect exact version";
  const commandView = node("pre", "release-command");
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
  const row = node("article", "approval-inbox-row");
  row.dataset.status = approval.status;
  const status = node("span", "approval-state", approval.status);
  const copy = node("div", "approval-inbox-copy");
  const title = node("strong", "", `Version ${approval.releaseVersion}${approval.releaseIsLatest ? " · latest" : ""}`);
  const requested = node("small", "", `Requested by ${approval.requestedBy.displayName} · ${new Date(approval.createdAt).toLocaleString()}`);
  copy.append(title, requested);
  if (approval.decidedBy) {
  const decided = node("small", "", `${approval.status === "approved" ? "Approved" : "Rejected"} by ${approval.decidedBy.displayName}${approval.decidedAt ? ` · ${new Date(approval.decidedAt).toLocaleString()}` : ""}`);
  copy.append(decided);
  }
  const actions = node("div", "approval-inbox-actions");
  if (approval.canDecide) {
  for (const [decision, label, className] of [
   ["approved", "Approve", "secondary compact"],
   ["rejected", "Reject", "quiet compact"],
  ]) {
   const button = el("button");
   button.type = "button";
   button.className = className;
   button.textContent = label;
   button.addEventListener("click", () => void decideBuilderApproval(approval.id, decision, button));
   actions.append(button);
  }
  }
  if (approval.canPublish) {
  const select = el("button");
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
  const note = node("small", "approval-inbox-note");
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
  const after = append && rateApprovalNextCursor ? `&after=${enc(rateApprovalNextCursor)}` : "";
  const body = await request(`/api/v1/properties/${enc(property)}/rate-builder/${enc(plan)}/approvals?limit=50${after}`);
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
  const body = await request(`/api/v1/properties/${enc(propertySelect.value)}/rate-builder/${enc(builderPlan.value)}/approvals/${enc(approvalId)}/decision`, {
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
  rateBuilderData = await request(`/api/v1/properties/${enc(property)}/rate-builder/${enc(plan)}`);
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
 const route = `/api/v1/properties/${enc(propertySelect.value)}/rate-builder/${enc(builderPlan.value)}/releases`;
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
  const card = node("article", "simulation-cell-card");
  card.dataset.state = cell.result.state;
  const heading = node("div", "simulation-cell-heading");
  const title = node("strong", "", `${cell.evaluationContext.nightDate} · ${cell.key}`);
  const badge = node("span", "simulation-cell-state", cell.result.state);
  heading.append(title, badge);
  const evidence = node("dl", "simulation-cell-evidence");
  const rows = [
  ["Target", cell.targetResolution.state],
  ["Winner", cell.targetResolution.winningRuleKey || "None"],
  ["Matched", cell.targetResolution.matchedRuleKeys.length ? cell.targetResolution.matchedRuleKeys.join(", ") : "None"],
  ["Conflicts", cell.targetResolution.conflictingRuleKeys.length ? cell.targetResolution.conflictingRuleKeys.join(", ") : "None"],
  ["Pre-tax subtotal", cell.result.preTaxSubtotalMinor === null ? "Not quoted" : `${cell.result.currency} ${cell.result.preTaxSubtotalMinor} minor units`],
  ["Evidence", cell.result.reason || `${cell.result.workUnits} server work units`],
  ];
  for (const [term, description] of rows) {
  const dt = node("dt", "", term);
  const dd = node("dd", "", String(description));
  evidence.append(dt, dd);
  }
  card.append(heading, evidence);
  return card;
 });
 builderSimulationCells.replaceChildren(...cards);
 }
  function renderSimulation(simulation) {
 const summary = node("div", simulation.conflictCount > 0 ? "simulation-alert error" : "simulation-alert success");
 const title = node("strong", "", simulation.conflictCount > 0 ? "Conflict blocks publication" : "Server preview completed");
 const detail = node("span", "", `${simulation.quotedCount} quoted · ${simulation.blockedCount} blocked · ${simulation.unpricedCount} unpriced · ${simulation.conflictCount} conflicts · ${simulation.workUnits} bounded work units`);
 const hashes = node("code", "", `content ${simulation.contentHash.slice(0, 12)} · preview ${simulation.previewHash.slice(0, 12)}`);
 const note = node("small", "", "Draft preview is pre-tax evidence. Published live quote below resolves current tax, policy, restriction and inventory truth.");
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
  const body = await request(`/api/v1/properties/${enc(propertySelect.value)}/rate-builder/${enc(builderPlan.value)}/releases/${enc(builderReleaseId)}/simulate`, {
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
  const body = await request(`/api/v1/properties/${enc(propertySelect.value)}/rate-builder/${enc(builderPlan.value)}/releases/${enc(builderReleaseId)}/approval-request`, {
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
  const body = await request(`/api/v1/properties/${enc(propertySelect.value)}/rate-builder/${enc(builderPlan.value)}/releases/${enc(builderReleaseId)}/publish`, {
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
  const release = await request(`/api/v1/properties/${enc(propertySelect.value)}/rate-builder/${enc(builderPlan.value)}/releases/${enc(sourceReleaseId)}/undo`, {
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
  const body = await request(`/api/v1/properties/${enc(propertySelect.value)}/rate-builder/${enc(builderPlan.value)}/quotes:resolve`, {
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
  request(`/api/v1/properties/${enc(property)}/rate-configuration`),
  request(`/api/v1/properties/${enc(property)}/inventory`),
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
 const card = node("article", "card status-health-card");
 const dot = node("span", `status-dot ${state}`);
 dot.setAttribute("aria-hidden", "true");
 const copy = el("div");
 const title = node("strong", "", `${name} · ${readableState(state)}`);
 const explanation = node("p", "", detail);
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
 statusReviewed.textContent = `${snapshot.review.independentlyReviewedThroughOrder} orders`;
 statusReviewCopy.textContent = `Orders 1–${snapshot.review.independentlyReviewedThroughOrder} are independently reviewed. Gate-3 manifest debt: ${snapshot.review.gate3Debt} orders. Later builder evidence remains ${snapshot.review.state}.`;
 reviewProgress.max = snapshot.roadmap.latestBuiltOrder;
 reviewProgress.value = snapshot.review.independentlyReviewedThroughOrder;
 reviewProgress.textContent = `${snapshot.review.independentlyReviewedThroughOrder} of ${snapshot.roadmap.latestBuiltOrder} orders independently reviewed`;
 statusReferee.textContent = `${snapshot.referee.requiredPasses}/${snapshot.referee.requiredPasses} required`;
 statusRecordedAt.textContent = `Snapshot date ${snapshot.recordedAt} · current order ${snapshot.roadmap.currentOrder}`;
 const phases = snapshot.phases.map((phase) => {
  const item = node("li", "status-phase-item");
  item.dataset.state = phase.state;
  const number = node("b", "", String(phase.number));
  const copy = el("span");
  const name = node("span", "", phase.name);
  const state = node("small", "", readableState(phase.state));
  copy.append(name, state);
  item.append(number, copy);
  return item;
 });
 statusPhaseList.replaceChildren(...phases);
 const currentWork = snapshot.recordedWork.map((item) => {
  const entry = node("li", "status-phase-item");
  entry.dataset.state = item.state;
  const order = node("b", "", String(item.order));
  const copy = el("span");
  const summary = node("span", "", item.summary);
  copy.append(summary);
  if (item.remaining) {
  const remaining = node("small", "", item.remaining);
  copy.append(remaining);
  }
  entry.append(order, copy);
  return entry;
 });
 statusCurrentWork.replaceChildren(...currentWork);
 const appChecked = new Date(live.app.checkedAt).toLocaleString();
 const databaseChecked = new Date(live.database.checkedAt).toLocaleString();
 statusHealthGrid.replaceChildren(
  healthCard("Application", live.app.state, `Responded at ${appChecked}; process started ${new Date(live.app.processStartedAt).toLocaleString()}.`),
  healthCard("PostgreSQL", live.database.state, `Tenant context confirmed: ${live.database.tenantContext ? "yes" : "no"}. Checked at ${databaseChecked}.`),
  healthCard("Hold-expiry worker", live.workers.holdExpiry, "Configured means the runtime flag is enabled; this card does not claim a successful poll."),
  healthCard("Projection worker", live.workers.availabilityProjection, "Configured means the runtime flag is enabled; projection remains disposable acceleration."),
  healthCard("Arrival pickup worker", live.workers.arrivalPickupTask, "Configured means current pickup intent is consumed into governed transport tasks; this card does not claim dispatch or completion."),
  healthCard("Reservation arrival-roll worker", live.workers.reservationArrivalRoll, "Configured means the bounded property-local due-in roll is enabled; this card does not claim a successful cycle or check-in."),
  healthCard("Reservation departure-roll worker", live.workers.reservationDepartureRoll, "Configured means the bounded property-local due-out roll is enabled; this card does not claim a successful cycle or checkout."),
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
  renderSystemStatus(await request(`/api/v1/properties/${enc(property)}${SYSTEM_STATUS_SUFFIX}`));
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
  function folioRouteFromLocation(pathname = location.pathname, search = location.search) {
 const workspace = pathname.match(/^\/p\/([0-9a-f-]+)\/folio\/([0-9a-f-]+)$/);
 if (workspace) {
  const query = new URLSearchParams(search);
  const exactKeys = [...query.keys()].every((key) => key === "tab" || key === "after")
  && query.getAll("tab").length <= 1 && query.getAll("after").length <= 1;
  const t = exactKeys ? query.get("tab") : "";
  const tab = t === "charge" || t === "deposit" || t === "organize" || t === "direct-billing" ? t : "postings";
  const a = exactKeys ? query.get("after") || "" : "";
  const after = /^[A-Za-z0-9_-]{1,512}$/.test(a) ? a : "";
  return { kind: "workspace", property: workspace[1], folioId: workspace[2], tab, after };
 }
 const list = pathname.match(/^\/p\/([0-9a-f-]+)\/folios$/);
 return list ? { kind: "list", property: list[1] } : { kind: "other" };
 }
  function canonicalFolioPath(property, folioId, tab = "postings", after = "") {
 const query = new URLSearchParams({ tab: tabs.find(([name]) => name === tab) ? tab : "postings" });
 if (after) query.set("after", after);
 return `/p/${property}/folio/${folioId}?${query.toString()}`;
 }
  function folioChargeIsDirty(amount, quantity, confirmed) {
 return String(amount).trim() !== "" || String(quantity).trim() !== "" || confirmed === true;
 }
  function currentFolioChargeIsDirty() {
 return folioChargeIsDirty(folioChargeForm.elements.amountMinor.value, folioChargeForm.elements.quantity.value, folioChargeConfirm.checked);
 }
  function currentFolioCorrectionIsDirty() {
 return folioCorrectionReason.value !== "" || folioCorrectionConfirm.checked;
 }
  function currentFolioWindowIsDirty() {
 return !folioWindowNewForm.hidden && folioWindowNewForm.elements.name.value !== "";
 }
  function currentFolioOrganizeIsDirty() {
 return [...folioOrganizeGroups.querySelectorAll('input[type="checkbox"]')].some((control) => control.checked) ||
  folioOrganizeDestination.value !== "" || folioOrganizeNewWindowName.value !== "" ||
  folioOrganizeReason.value !== "" || folioOrganizeAcknowledgement.checked || folioTransferPreview !== null;
 }
  function currentFolioDraftIsDirty() {
 return currentFolioChargeIsDirty() || d?.d() || currentFolioCorrectionIsDirty() || currentFolioWindowIsDirty() || currentFolioOrganizeIsDirty() ||
  (typeof currentReceivableTransferIsDirty === "function" && currentReceivableTransferIsDirty()) || folioStatusPending;
 }
  function confirmFolioExit() {
 if (currentFolioCorrectionIsDirty()) return confirm("Discard this unfinished posting correction?");
 if (currentFolioChargeIsDirty()) return confirm("Discard this unfinished untaxed charge?");
 if (typeof currentReceivableTransferIsDirty === "function" && currentReceivableTransferIsDirty()) return confirm("Discard this unfinished direct-billing transfer?");
 return !currentFolioDraftIsDirty()||confirm("Discard this unfinished folio task?");
 }
  function folioRefreshDecision(origin, current) {
 return origin.generation === current.generation && origin.property === current.property
  && origin.identity === current.identity && origin.folioId === current.folioId && current.active === true
  ? "render" : "suppress";
 }
  function isCurrentFolioRequest(generation, property, identity, folioId = identity) {
 return folioRefreshDecision(
  { generation, property, identity, folioId },
  { generation: folioGeneration, property: propertySelect.value, identity: folioIdentity,
  folioId: folioStatementData?.folio.id || folioIdentity, active: activeView === "folios" },
 ) === "render";
 }
  function boundedFolioPage(rows) {
 return Array.isArray(rows) ? rows.slice(0, 50) : [];
 }
  function setFolioError(message = "") {
 folioError.textContent = message;
 }
  function resetFolioPresentation() {
 folioStatementData = null;
 folioNextCursor = null;
 folioRouteCursor = "";
 folioWorkspace.hidden = true;
 folioStatementLoading.hidden = true;
 folioStatementError.hidden = true;
 folioStatement.hidden = true;
 folioStatementRows.replaceChildren();
 folioStatementCards.replaceChildren();
 folioStatementTitle.textContent = "Folio";
 folioWorkspaceTitle.textContent = "Folio workspace";
 for (const target of [folioWindow, folioStatus, folioCurrency, folioBalance, folioStayTotal,
  folioActiveTotal, folioAccountCurrency]) target.textContent = "—";
 folioWindowCount.textContent = "0";
 folioLineCount.textContent = "0";
 folioLoadOlder.hidden = true;
 folioLoadOlder.disabled = false;
 folioPageStatus.textContent = "";
 folioChargeCode.replaceChildren();
 folioChargeAvailability.textContent = "Current server charge availability.";
 folioChargeFields.disabled = true;
 folioChargeForm.reset();
 folioChargeAttemptKey = "";
 folioChargeDraft = "";
 d?.r();
 folioCorrectionForm.reset();
 folioCorrectionFields.disabled = true;
 folioCorrectionAttemptKey = "";
 folioCorrectionDraft = "";
 folioCorrectionSelection = null;
 folioCorrectionReturnFocus = null;
 folioWindowNewForm.reset();
 folioWindowNewForm.hidden = true;
 folioWindowNew.disabled = true;
 folioWindowAttemptKey = "";
 folioWindowDraft = "";
 folioOrganizeForm.reset();
 folioOrganizeGroups.replaceChildren();
 folioOrganizeDestination.replaceChildren(new Option("Choose a sibling or create one", ""));
 folioOrganizePreview.replaceChildren();
 folioOrganizePreview.hidden = true;
 folioTransferAttemptKey = "";
 folioTransferDraft = "";
 folioTransferPreview = null;
 receivableTargets = [];
 receivablePreview = null;
 receivableApproval = null;
 receivablePreviewGeneration += 1;
 receivableApprovalAttemptKey = receivableApprovalDraft = "";
 receivableDecisionAttemptKey = receivableDecisionDraft = "";
 receivableTransferAttemptKey = receivableTransferDraft = "";
 receivableTransferForm.reset();
 receivableTransferFields.disabled = true;
 receivableTransferAccount.replaceChildren(new Option("Loading eligible targets…", ""));
 receivableTransferPreview.replaceChildren();
 receivableTransferPreview.hidden = true;
 receivableTransferApprovalActions.hidden = true;
 receivableTransferAvailability.textContent = "Choose an eligible company or travel-agent target from the server-owned list.";
 folioStatusAttemptKey = "";
 folioStatusAttemptDraft = "";
 folioStatusPending = false;
 folioSettlementPanel.removeAttribute("data-status");
 folioSettlementPanel.setAttribute("aria-busy", "false");
 folioSettlementHeading.textContent = "Checking settlement readiness";
 folioSettlementCopy.textContent = "Yellow will use the current server status and exact balance to show the next governed action.";
 folioSettlementState.textContent = "—";
 folioSettlementBalance.textContent = "—";
 folioSettlementAction.hidden = true;
 folioSettlementAction.disabled = true;
 folioSettlementAction.removeAttribute("data-action");
 folioSettlementStatus.classList.remove("error");
 folioSettlementStatus.textContent = "";
 folioWindowTabs.replaceChildren();
 setFolioError();
 }
  function clearFolioState() {
 folioGeneration += 1;
 folioIdentity = "";
 folioActiveTab = "postings";
 folioWorkspaceProperty = "";
 folioReturnFocus = null;
 resetFolioPresentation();
 folioStatementLookupForm.reset();
 formMessage(folioStatementLookupForm, "Enter the exact human-readable folio reference.");
 syncDepartureFolioReturnControl();
 }
  function receivableTransferBody() {
 return {
  receivableAccountId: receivableTransferAccount.value,
  reason: receivableTransferReason.value.trim(),
  ...(receivableApproval?.status === "approved" && canonicalUuid(receivableApproval.approvalId)
   ? { approvalId: receivableApproval.approvalId } : {}),
 };
 }
  function currentReceivableTransferIsDirty() {
 return receivableTransferAccount.value !== "" || receivableTransferReason.value !== "" ||
  receivableTransferConfirm.checked || receivablePreview !== null || receivableApproval !== null;
 }
  function resetReceivablePreview() {
 receivablePreview = null;
 receivableApproval = null;
 receivablePreviewGeneration += 1;
 receivableApprovalAttemptKey = receivableApprovalDraft = "";
 receivableDecisionAttemptKey = receivableDecisionDraft = "";
 receivableTransferAttemptKey = receivableTransferDraft = "";
 receivableTransferPreview.replaceChildren();
 receivableTransferPreview.hidden = true;
 receivableTransferApprovalActions.hidden = true;
 receivableTransferConfirm.checked = false;
 syncReceivableTransferConfirmation();
 }
  function renderReceivableTargets(targets, selected = receivableTransferAccount.value) {
 const fragment = document.createDocumentFragment();
 fragment.append(new Option("Choose a server-owned receivable target", ""));
 for (const target of targets) {
  if (!target || !canonicalUuid(target.accountId) || !canonicalUuid(target.partyId) ||
   (target.partyRole !== "company" && target.partyRole !== "agent") || typeof target.name !== "string" ||
   typeof target.currency !== "string") continue;
  const option = el("option"); option.value = target.accountId;
  option.textContent = `${target.name} · ${target.partyRole} · ${target.currency}`;
  fragment.append(option);
 }
 receivableTransferAccount.replaceChildren(fragment);
 receivableTransferAccount.value = targets.some((target) => target?.accountId === selected) ? selected : "";
 }
  async function loadReceivableTransferTargets() {
 if (!folioStatementData) return;
 const generation = folioGeneration, property = propertySelect.value, identity = folioIdentity;
 const folioId = folioStatementData.folio.id;
 receivableTransferFields.disabled = true;
 receivableTransferAvailability.textContent = "Loading current eligible receivable targets…";
 try {
  const result = await request(`/api/operator/properties/${enc(property)}/receivable-transfers/targets`);
  if (!isCurrentFolioRequest(generation, property, identity, folioId) || folioActiveTab !== "direct-billing") return;
  const targets = Array.isArray(result?.targets) ? result.targets : [];
  receivableTargets = targets;
  renderReceivableTargets(targets);
  receivableTransferFields.disabled = targets.length === 0;
  receivableTransferAvailability.textContent = targets.length === 0
   ? "The server returned no eligible company or travel-agent receivable targets for this property."
   : "Choose one server-owned target, then refresh the authoritative direct-billing preview.";
 } catch (error) {
  if (!isCurrentFolioRequest(generation, property, identity, folioId) || folioActiveTab !== "direct-billing") return;
  receivableTransferFields.disabled = true;
  receivableTransferAvailability.textContent = error instanceof Error ? error.message : "Eligible receivable targets could not be loaded.";
  formMessage(receivableTransferForm, "Eligible receivable targets could not be loaded. Refresh the folio and try again.", true);
 }
 }
  function renderReceivableTransferPreview(preview) {
 const fields = [
  ["Target", preview.name], ["Party role", preview.partyRole], ["Currency", preview.currency],
  ["Exact transfer", preview.amountMinor], ["Current exposure", preview.exposureMinor],
  ["Credit limit", preview.creditLimitMinor === null ? "—" : preview.creditLimitMinor],
  ["Projected exposure", preview.projectedExposureMinor],
  ["Approval", preview.requiresApproval === true ? "Required" : "Not required"],
 ];
 const fragment = document.createDocumentFragment();
 for (const [label, value] of fields) {
  const item = node("div"); const heading = node("span", "", label); const detail = node("strong", "", String(value));
  item.append(heading, detail); fragment.append(item);
 }
 receivableTransferPreview.replaceChildren(fragment);
 receivableTransferPreview.hidden = false;
 receivableTransferApprovalActions.hidden = preview.requiresApproval !== true;
 }
  function syncReceivableTransferConfirmation() {
 const previewReady = receivablePreview !== null && receivablePreview.receivableAccountId === receivableTransferAccount.value;
 const reason = receivableTransferReason.value.trim();
 const approvalReady = receivablePreview?.requiresApproval !== true || receivableApproval?.status === "approved";
 receivableTransferSubmit.disabled = receivableTransferFields.disabled || !previewReady || !approvalReady ||
  !receivableTransferConfirm.checked || reason.length < 1 || reason.length > 500;
 receivableTransferApprovalRequest.disabled = receivableTransferFields.disabled || receivablePreview?.requiresApproval !== true ||
  receivableApproval?.status === "pending" || receivableApproval?.status === "approved";
 const decisionReady = receivableApproval?.status === "pending" && canonicalUuid(receivableApproval.approvalId);
 receivableTransferApprovalApprove.disabled = !decisionReady;
 receivableTransferApprovalReject.disabled = !decisionReady;
 }
  async function loadReceivableTransferPreview() {
 if (!folioStatementData || !canonicalUuid(receivableTransferAccount.value)) return;
 const generation = folioGeneration, property = propertySelect.value, identity = folioIdentity;
 const folioId = folioStatementData.folio.id, accountId = receivableTransferAccount.value;
 const requestGeneration = ++receivablePreviewGeneration;
 receivableTransferPreviewSubmit.disabled = true;
 receivableTransferForm.setAttribute("aria-busy", "true");
 formMessage(receivableTransferForm, "Reading the server-owned direct-billing preview…");
 try {
  const preview = await request(`/api/operator/properties/${enc(property)}/folios/${enc(folioId)}/receivable-transfers:preview`, {
   method: "POST", body: JSON.stringify({ receivableAccountId: accountId }),
  });
  if (!isCurrentFolioRequest(generation, property, identity, folioId) || requestGeneration !== receivablePreviewGeneration ||
   accountId !== receivableTransferAccount.value || folioActiveTab !== "direct-billing") return;
  if (preview.folioId !== folioId || preview.receivableAccountId !== accountId || !canonicalUuid(preview.partyId) ||
   (preview.partyRole !== "company" && preview.partyRole !== "agent") || typeof preview.currency !== "string") {
   throw new Error("The server returned a different receivable preview.");
  }
  receivablePreview = preview;
  receivableApproval = null;
  renderReceivableTransferPreview(preview);
  formMessage(receivableTransferForm, preview.requiresApproval === true
   ? "The server requires a fresh different-user approval before this exact transfer."
   : "Server preview confirmed. Review it, enter a reason and confirm the immutable transfer.");
  syncReceivableTransferConfirmation();
 } catch (error) {
  if (!isCurrentFolioRequest(generation, property, identity, folioId) || requestGeneration !== receivablePreviewGeneration) return;
  resetReceivablePreview();
  formMessage(receivableTransferForm, error instanceof Error ? error.message : "Direct-billing preview failed.", true);
 } finally {
  if (isCurrentFolioRequest(generation, property, identity, folioId) && requestGeneration === receivablePreviewGeneration) {
   receivableTransferPreviewSubmit.disabled = false; receivableTransferForm.setAttribute("aria-busy", "false");
  }
 }
 }
  async function requestReceivableTransferApproval() {
 if (!folioStatementData || receivablePreview?.requiresApproval !== true || receivableTransferApprovalRequest.disabled) return;
 const generation = folioGeneration, property = propertySelect.value, identity = folioIdentity;
 const folioId = folioStatementData.folio.id, accountId = receivablePreview.receivableAccountId;
 const draft = JSON.stringify({ folioId, accountId });
 if (draft !== receivableApprovalDraft) { receivableApprovalDraft = draft; receivableApprovalAttemptKey = crypto.randomUUID(); }
 receivableTransferApprovalRequest.disabled = true; receivableTransferForm.setAttribute("aria-busy", "true");
 formMessage(receivableTransferForm, "Requesting one exact server-bound over-limit approval…");
 try {
  const approval = await request(`/api/operator/properties/${enc(property)}/folios/${enc(folioId)}/receivable-transfers/approvals`, {
   method: "POST", headers: { "idempotency-key": receivableApprovalAttemptKey }, body: JSON.stringify({ receivableAccountId: accountId }),
  });
  if (!isCurrentFolioRequest(generation, property, identity, folioId) || accountId !== receivableTransferAccount.value) return;
  if (approval.folioId !== folioId || approval.receivableAccountId !== accountId || !canonicalUuid(approval.approvalId)) {
   throw new Error("The server returned a different approval request.");
  }
  receivableApproval = approval;
  formMessage(receivableTransferForm, approval.replayed === true
   ? "The existing exact approval request was confirmed. A different approver may decide it."
   : "Exact approval requested. A different approver may decide it.");
  syncReceivableTransferConfirmation();
 } catch (error) {
  if (isCurrentFolioRequest(generation, property, identity, folioId)) {
   formMessage(receivableTransferForm, `${error instanceof Error ? error.message : "Approval request failed"}. Retry keeps the same idempotency key.`, true);
  }
 } finally {
  if (isCurrentFolioRequest(generation, property, identity, folioId)) {
   receivableTransferForm.setAttribute("aria-busy", "false"); syncReceivableTransferConfirmation();
  }
 }
 }
  async function decideReceivableTransferApproval(decision) {
 if ((decision !== "approve" && decision !== "reject") || !folioStatementData || receivableApproval?.status !== "pending") return;
 const control = decision === "approve" ? receivableTransferApprovalApprove : receivableTransferApprovalReject;
 if (control.disabled || !canonicalUuid(receivableApproval.approvalId)) return;
 const generation = folioGeneration, property = propertySelect.value, identity = folioIdentity;
 const folioId = folioStatementData.folio.id, approvalId = receivableApproval.approvalId;
 const draft = JSON.stringify({ folioId, approvalId, decision });
 if (draft !== receivableDecisionDraft) { receivableDecisionDraft = draft; receivableDecisionAttemptKey = crypto.randomUUID(); }
 control.disabled = true; receivableTransferForm.setAttribute("aria-busy", "true");
 formMessage(receivableTransferForm, `${decision === "approve" ? "Approving" : "Rejecting"} only the server-bound approval evidence…`);
 try {
  const approval = await request(`/api/operator/properties/${enc(property)}/folios/${enc(folioId)}/receivable-transfers/approvals/${enc(approvalId)}/${decision}`, {
   method: "POST", headers: { "idempotency-key": receivableDecisionAttemptKey }, body: JSON.stringify({}),
  });
  if (!isCurrentFolioRequest(generation, property, identity, folioId) || approvalId !== receivableApproval?.approvalId) return;
  if (approval.folioId !== folioId || approval.approvalId !== approvalId || approval.status !== `${decision}d`) {
   throw new Error("The server returned a different approval decision.");
  }
  receivableApproval = approval;
  formMessage(receivableTransferForm, approval.replayed === true ? "The existing approval decision was confirmed."
   : decision === "approve" ? "Exact approval recorded. You may now confirm this transfer."
   : "Exact approval rejected. This transfer remains unavailable.");
  syncReceivableTransferConfirmation();
 } catch (error) {
  if (isCurrentFolioRequest(generation, property, identity, folioId)) {
   formMessage(receivableTransferForm, `${error instanceof Error ? error.message : "Approval decision failed"}. Retry keeps the same idempotency key.`, true);
  }
 } finally {
  if (isCurrentFolioRequest(generation, property, identity, folioId)) {
   receivableTransferForm.setAttribute("aria-busy", "false"); syncReceivableTransferConfirmation();
  }
 }
 }
  async function submitReceivableTransfer() {
 if (!folioStatementData || receivableTransferSubmit.disabled) return;
 const generation = folioGeneration, property = propertySelect.value, identity = folioIdentity;
 const folioId = folioStatementData.folio.id, body = receivableTransferBody();
 const draft = JSON.stringify(body);
 if (draft !== receivableTransferDraft) { receivableTransferDraft = draft; receivableTransferAttemptKey = crypto.randomUUID(); }
 receivableTransferFields.disabled = true; receivableTransferForm.setAttribute("aria-busy", "true");
 formMessage(receivableTransferForm, "Transferring only the server-verified exact positive balance…");
 try {
  const transferred = await request(`/api/operator/properties/${enc(property)}/folios/${enc(folioId)}/receivable-transfers`, {
   method: "POST", headers: { "idempotency-key": receivableTransferAttemptKey }, body: JSON.stringify(body),
  });
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  if (transferred.folioId !== folioId || transferred.receivableAccountId !== body.receivableAccountId || !canonicalUuid(transferred.journalId)) {
   throw new Error("The server returned a different receivable transfer.");
  }
  const refreshed = await request(`/api/v1/properties/${enc(property)}/folios/${enc(folioId)}/statement?limit=50`);
  if (!isCurrentFolioRequest(generation, property, identity, folioId) || refreshed.folio?.id !== folioId) return;
  receivableTransferAttemptKey = receivableTransferDraft = "";
  renderFolioStatement(refreshed);
  folioActiveTab = "postings";
  setFolioTab("postings", { updateHistory: true, focus: false });
  formMessage(receivableTransferForm, transferred.replayed === true
   ? "Existing direct-billing transfer confirmed. The authoritative folio was refreshed."
   : "Direct-billing transfer recorded. The authoritative folio was refreshed.");
  folioBalance.focus({ preventScroll: true });
 } catch (error) {
  if (isCurrentFolioRequest(generation, property, identity, folioId)) {
   receivableTransferFields.disabled = false;
   formMessage(receivableTransferForm, `${error instanceof Error ? error.message : "Direct-billing transfer failed"}. Retry keeps the same idempotency key.`, true);
   syncReceivableTransferConfirmation();
  }
 } finally {
  if (isCurrentFolioRequest(generation, property, identity, folioId)) receivableTransferForm.setAttribute("aria-busy", "false");
 }
 }
  function folioCell(text) {
 const cell = el("td");
 cell.textContent = text === null || text === undefined || text === "" ? "—" : String(text);
 return cell;
 }
  function exactFolioMinor(value, label) {
 if (typeof value !== "string" || !/^-?(?:0|[1-9][0-9]*)$/.test(value)) throw new Error(`Server returned an invalid exact ${label}.`);
 return value;
 }
  function exactFolioQuantity(value) {
 if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value)) throw new Error("Server returned an invalid exact quantity.");
 return value;
 }
  function announceOperation(message) {
 operationStatus.textContent = "";
 requestAnimationFrame(() => { operationStatus.textContent = message; });
 }
  function folioWindows(statement = folioStatementData) {
 const windows = statement?.siblingWindows;
 return Array.isArray(windows) ? windows.slice(0, 20) : [];
 }
  function renderFolioWindowTabs(windows, activeId) {
 const fragment = document.createDocumentFragment();
 const destinations = document.createDocumentFragment();
 destinations.append(new Option("Choose a sibling or create one", ""));
 for (const window of windows) {
  const selected = window.id === activeId;
  const tab = el("button");
  tab.type = "button";
  tab.className = "quiet folio-window-tab";
  tab.dataset.folioId = window.id;
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", String(selected));
  tab.tabIndex = selected ? 0 : -1;
  tab.textContent = `${String(window.windowNo)} · ${window.name || "Folio"} · ${window.reference || window.id} · ${exactFolioMinor(window.balanceMinor, "window balance")} · ${window.status}`;
  fragment.append(tab);
  if (!selected && window.status === "open") destinations.append(new Option(`${String(window.windowNo)} · ${window.name || "Folio"}`, window.id));
 }
 folioWindowTabs.replaceChildren(fragment);
 folioOrganizeDestination.replaceChildren(destinations);
 }
  function handleFolioWindowTabKeydown(event) {
 const target = event.target.closest?.("[data-folio-id]");
 if (!(target instanceof HTMLButtonElement)) return;
 const tabs = [...folioWindowTabs.querySelectorAll("[data-folio-id]")];
 if (!["ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "].includes(event.key)) return;
 event.preventDefault();
 if (event.key === "Enter" || event.key === " ") {
  if (!confirmFolioExit()) return;
  history.pushState({ yellowSurface: "folio-workspace" }, "", canonicalFolioPath(propertySelect.value, target.dataset.folioId));
  void loadFolioWorkspace(target.dataset.folioId);
  return;
 }
 const index = tabs.indexOf(target);
 const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
  (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
 tabs[next]?.focus();
 }
  function renderFolioTransferGroups(rows) {
 const seen = new Set();
 const fragment = document.createDocumentFragment();
 for (const row of rows) {
  const group = row.transferGroup;
  if (!group || seen.has(group.id)) continue;
  seen.add(group.id);
  const label = el("label");
  const input = el("input");
  input.type = "checkbox";
  input.name = "groupId";
  input.value = group.id;
  input.disabled = group.eligible !== true;
  label.append(input, ` ${row.txCode} · ${String(group.memberCount)} immutable member${group.memberCount === 1 ? "" : "s"}${group.reason ? ` · ${group.reason}` : ""}`);
  fragment.append(label);
 }
 folioOrganizeGroups.replaceChildren(fragment);
 if (seen.size === 0) emptyList(folioOrganizeGroups, "No server-owned transferable groups are available in this window.");
 }
  function folioTransferBody() {
 const groupIds = [...folioOrganizeGroups.querySelectorAll('input[name="groupId"]:checked')].map((control) => control.value);
 const destinationFolioId = folioOrganizeDestination.value || null;
 const newWindowName = folioOrganizeNewWindowName.value.trim() || null;
 return {
  sourceFolioId: folioStatementData?.folio.id || "",
  destinationFolioId,
  newWindowName,
  groupIds,
  reason: folioOrganizeReason.value.trim(),
  generation: String(folioStatementData?.generation || ""),
  previewRevision: String(folioTransferPreview?.previewRevision || folioStatementData?.previewRevision || ""),
 };
 }
  function renderFolioTransferPreview(preview) {
 const fields = [
  ["Source before", preview.sourceBeforeMinor], ["Source after", preview.sourceAfterMinor],
  ["Destination before", preview.destinationBeforeMinor], ["Destination after", preview.destinationAfterMinor],
  ["Stay total unchanged", preview.stayTotalMinor],
 ];
 const fragment = document.createDocumentFragment();
 for (const [label, value] of fields) {
  const item = node("span", "", `${label}: ${exactFolioMinor(value, label.toLowerCase())}`);
  fragment.append(item);
 }
 folioOrganizePreview.replaceChildren(fragment);
 folioOrganizePreview.hidden = false;
 }
  function syncFolioTransferConfirmation() {
 const body = folioTransferBody();
 const destinationCount = (body.destinationFolioId ? 1 : 0) + (body.newWindowName ? 1 : 0);
 folioOrganizeSubmit.disabled = folioTransferPreview === null || !folioOrganizeAcknowledgement.checked ||
  body.groupIds.length < 1 || destinationCount !== 1 || body.reason.length < 1 || body.reason.length > 500;
 }
  async function submitFolioTransfer(commit = false) {
 if (!folioStatementData) return;
 const generation = folioGeneration, property = propertySelect.value, identity = folioIdentity;
 const folioId = folioStatementData.folio.id;
 let body = folioTransferBody();
 if (!commit) {
  folioOrganizePreviewSubmit.disabled = true;
  try {
  const preview = await request(`/api/v1/properties/${enc(property)}/folios/${enc(folioId)}/transfers:preview`, {
   method: "POST", body: JSON.stringify(body),
  });
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  folioTransferPreview = preview;
  renderFolioTransferPreview(preview);
  folioOrganizeAcknowledgement.checked = false;
  syncFolioTransferConfirmation();
  } catch (error) {
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  formMessage(folioOrganizeForm, error instanceof Error ? error.message : "Preview failed", true);
  folioOrganizePreviewSubmit.focus();
  } finally {
  if (isCurrentFolioRequest(generation, property, identity, folioId)) folioOrganizePreviewSubmit.disabled = false;
  }
  return;
 }
 if (!folioOrganizeAcknowledgement.checked || folioTransferPreview === null) return;
 body = folioTransferBody();
 const draft = JSON.stringify(body);
 if (draft !== folioTransferDraft) {
  folioTransferDraft = draft;
  folioTransferAttemptKey = crypto.randomUUID();
 }
 const attemptKey = folioTransferAttemptKey;
 folioOrganizeFields.disabled = true;
 try {
  const transferred = await request(`/api/v1/properties/${enc(property)}/folios/${enc(folioId)}/transfers`, {
  method: "POST", headers: { "idempotency-key": attemptKey }, body: JSON.stringify(body),
  });
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  const targetId = transferred.destinationFolioId;
  const refreshed = await request(`/api/v1/properties/${enc(property)}/folios/${enc(targetId)}/statement?limit=50`);
  if (!isCurrentFolioRequest(generation, property, identity, folioId) || refreshed.folio.id !== targetId) return;
  folioTransferAttemptKey = folioTransferDraft = "";
  folioTransferPreview = null;
  folioActiveTab = "postings";
  folioIdentity = targetId;
  folioOrganizeForm.reset();
  renderFolioStatement(refreshed);
  history.pushState({ yellowSurface: "folio-workspace" }, "", canonicalFolioPath(property, targetId));
  announceOperation(transferred.replayed ? "Existing transfer confirmed." : "Balanced transfer appended.");
  folioWindowTabs.querySelector(`[data-folio-id="${CSS.escape(targetId)}"]`)?.focus();
 } catch (error) {
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  folioOrganizeFields.disabled = false;
  formMessage(folioOrganizeForm, `${error instanceof Error ? error.message : "Transfer failed"}. Retry keeps the same idempotency key.`, true);
  folioOrganizeSubmit.focus();
 }
 }
  async function openAdditionalFolioWindow() {
 if (!folioStatementData) return;
 const reservationId = folioStatementData.reservationId;
 if (!canonicalUuid(reservationId)) {
  formMessage(folioWindowNewForm, "No reservation.", true);
  folioWindowNewForm.elements.name.focus();
  return;
 }
 const name = folioWindowNewForm.elements.name.value.trim();
 const body = { sourceFolioId: folioStatementData.folio.id, name };
 const draft = JSON.stringify(body);
 if (draft !== folioWindowDraft) {
  folioWindowDraft = draft;
  folioWindowAttemptKey = crypto.randomUUID();
 }
 const generation = folioGeneration, property = propertySelect.value, identity = folioIdentity;
 try {
  const opened = await request(`/api/v1/properties/${enc(property)}/reservations/${enc(reservationId)}/folios`, {
  method: "POST", headers: { "idempotency-key": folioWindowAttemptKey }, body: JSON.stringify(body),
  });
  if (!isCurrentFolioRequest(generation, property, identity)) return;
  folioWindowAttemptKey = folioWindowDraft = "";
  history.pushState({ yellowSurface: "folio-workspace" }, "", canonicalFolioPath(property, opened.folioId));
  folioIdentity = opened.folioId;
  await loadFolioWorkspace(opened.folioId, "", { focus: false });
  announceOperation(opened.replayed ? "Existing window confirmed." : `${opened.name || name} opened.`);
  folioWindowTabs.querySelector(`[data-folio-id="${CSS.escape(opened.folioId)}"]`)?.focus();
 } catch (error) {
  if (!isCurrentFolioRequest(generation, property, identity)) return;
  formMessage(folioWindowNewForm, `${error instanceof Error ? error.message : "Window could not be opened"}. Retry keeps the same idempotency key.`, true);
  folioWindowNewForm.elements.name.focus();
 }
 }
  function folioCardField(list, label, value) {
 const term = node("dt", "", label);
 const description = node("dd", "", value === null || value === undefined || value === "" ? "—" : String(value));
 list.append(term, description);
 }
  function renderFolioRows(rows) {
 const bounded = boundedFolioPage(rows);
 const fragment = document.createDocumentFragment();
 const cards = document.createDocumentFragment();
 for (const row of bounded) {
  const lineage = row.reversesJournalId
  ? `Corrects original charge journal ${row.reversesJournalId}`
  : row.reversedByJournalId ? `Corrected by adjustment journal ${row.reversedByJournalId}` : "";
  const posting = `${row.kind} · ${row.txCode}${lineage ? ` · ${lineage}` : ""}`;
  const description = `${row.description || "—"} · quantity ${exactFolioQuantity(row.quantity)}`;
  const amount = exactFolioMinor(row.amountMinor, "amount");
  const running = exactFolioMinor(row.runningBalanceMinor, "running balance");
  const tableRow = el("tr");
  const postingCell = folioCell(posting);
  tableRow.append(
  folioCell(row.businessDate),
  folioCell(row.postedAt),
  postingCell,
  folioCell(description),
  folioCell(amount),
  folioCell(running),
  );
  tableRow.title = lineage || `${row.kind} · journal ${row.journalId}`;
  if (row.correctionEligible === true) {
  const action = el("button");
  action.type = "button";
  action.className = "quiet compact folio-correct-action";
  action.textContent = "Correct a wrong charge";
  action.dataset.journalId = row.journalId;
  postingCell.append(el("br"), action);
  }
  fragment.append(tableRow);
  const card = node("article", "folio-posting-card");
  const list = el("dl");
  folioCardField(list, "Business date", row.businessDate);
  folioCardField(list, "Posted UTC", row.postedAt);
  folioCardField(list, "Posting", posting);
  folioCardField(list, "Description", description);
  folioCardField(list, "Signed minor amount", amount);
  folioCardField(list, "Running minor balance", running);
  card.append(list);
  if (row.correctionEligible === true) {
  const action = el("button");
  action.type = "button";
  action.className = "quiet folio-correct-action";
  action.textContent = "Correct a wrong charge";
  action.dataset.journalId = row.journalId;
  card.append(action);
  }
  cards.append(card);
 }
 folioStatementRows.replaceChildren();
 folioStatementCards.replaceChildren();
 folioStatementRows.append(fragment);
 folioStatementCards.append(cards);
 if (bounded.length === 0) {
  const emptyRow = el("tr");
  const emptyCell = node("td", "folio-empty");
  emptyCell.colSpan = 6;
  emptyCell.textContent = "No immutable guest-side postings were returned.";
  emptyRow.append(emptyCell);
  folioStatementRows.append(emptyRow);
  emptyList(folioStatementCards, "No immutable guest-side postings were returned.");
 }
 }
  function renderFolioChargeOptions(options, availability) {
 folioChargeCode.replaceChildren();
 for (const option of options) {
  const choice = el("option");
  choice.value = option.code;
  choice.textContent = `${option.code} · ${option.name} · USALI ${option.usaliLine}`;
  folioChargeCode.append(choice);
 }
 const allowed = availability.allowed === true && options.length > 0;
 folioChargeFields.disabled = !allowed;
 folioChargeConfirm.checked = false;
 folioChargeSubmit.disabled = true;
 folioChargeAvailability.textContent = allowed
  ? "Choose one server-governed revenue code. The server derives property, currency, business date and ledger route."
  : availability.reason || "No currently governed untaxed charge is available.";
 }
  function clearFolioCorrection({ restoreFocus = false } = {}) {
 const target = folioCorrectionReturnFocus;
 folioCorrectionForm.reset();
 folioCorrectionFields.disabled = true;
 folioCorrectionAttemptKey = "";
 folioCorrectionDraft = "";
 folioCorrectionSelection = null;
 folioCorrectionCurrency.textContent = "—";
 folioCorrectionOriginal.textContent = "—";
 folioCorrectionEffect.textContent = "—";
 folioCorrectionBalance.textContent = "—";
 folioCorrectionExpected.textContent = "—";
 syncFolioCorrectionConfirmation();
 if (restoreFocus) {
  if (target?.isConnected) target.focus();
  else tabs[0][1].focus();
 }
 folioCorrectionReturnFocus = null;
 }
  function openFolioCorrection(journalId, trigger) {
 if (!folioStatementData) return;
 const row = folioStatementData.rows.find((candidate) =>
  candidate.journalId === journalId && candidate.correctionEligible === true
 );
 if (!row) return;
 folioCorrectionSelection = row;
 folioCorrectionReturnFocus = trigger;
 folioCorrectionFields.disabled = false;
 const original = BigInt(exactFolioMinor(row.amountMinor, "original amount"));
 const balance = BigInt(exactFolioMinor(folioStatementData.balanceMinor, "server balance"));
 const effect = -original;
 folioCorrectionCurrency.textContent = folioStatementData.folio.currency;
 folioCorrectionOriginal.textContent = original.toString();
 folioCorrectionEffect.textContent = effect.toString();
 folioCorrectionBalance.textContent = balance.toString();
 folioCorrectionExpected.textContent = `${(balance + effect).toString()} · preview subject to authoritative refresh`;
 setFolioTab("correction", { updateHistory: false, focus: false });
 folioCorrectionHeading.focus();
 }
  function folioCorrectionBody() {
 return {
  reversesJournalId: folioCorrectionSelection?.journalId || "",
  reason: folioCorrectionReason.value,
 };
 }
  function syncFolioCorrectionConfirmation() {
 const validReason = folioCorrectionReason.value.length >= 1 &&
  folioCorrectionReason.value.length <= 500 &&
  folioCorrectionReason.value.trim() === folioCorrectionReason.value;
 folioCorrectionSubmit.disabled = folioCorrectionFields.disabled ||
  !folioCorrectionSelection || !validReason || !folioCorrectionConfirm.checked;
 }
  async function postFolioCorrection() {
 if (!folioStatementData || !folioCorrectionSelection || folioCorrectionSubmit.disabled) return;
 const generation = folioGeneration;
 const property = propertySelect.value;
 const identity = folioIdentity;
 const folioId = folioStatementData.folio.id;
 const body = folioCorrectionBody();
 const draft = JSON.stringify(body);
 if (draft !== folioCorrectionDraft) {
  folioCorrectionDraft = draft;
  folioCorrectionAttemptKey = crypto.randomUUID();
 }
 const attemptKey = folioCorrectionAttemptKey;
 folioCorrectionFields.disabled = true;
 folioCorrectionForm.setAttribute("aria-busy", "true");
 formMessage(folioCorrectionForm, "Creating one immutable balanced adjustment…");
 try {
  const corrected = await request(`/api/v1/properties/${enc(property)}/folios/${enc(folioId)}/adjustments`, {
  method: "POST",
  headers: { "idempotency-key": attemptKey },
  body: JSON.stringify(body),
  });
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  if (corrected.folioId !== folioId || corrected.reversesJournalId !== body.reversesJournalId) {
  throw new Error("The server returned different correction lineage.");
  }
  const refreshed = await request(`/api/v1/properties/${enc(property)}/folios/${enc(folioId)}/statement?limit=50`);
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  if (refreshed.folio.id !== folioId) throw new Error("The server returned a different folio.");
  folioRouteCursor = "";
  clearFolioCorrection();
  folioActiveTab = "postings";
  renderFolioStatement(refreshed);
  history.pushState({ yellowSurface: "folio-workspace" }, "", canonicalFolioPath(property, folioId, "postings"));
  formMessage(folioCorrectionForm, corrected.replayed
  ? "The existing adjustment was confirmed and the authoritative statement refreshed."
  : "Balanced adjustment created and the authoritative statement refreshed.");
  folioBalance.focus();
 } catch (error) {
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  folioCorrectionFields.disabled = false;
  const message = error instanceof Error ? error.message : "The correction could not be created";
  formMessage(folioCorrectionForm, `${message}. Retry keeps the same idempotency key.`, true);
  syncFolioCorrectionConfirmation();
 } finally {
  if (isCurrentFolioRequest(generation, property, identity, folioId)) {
  folioCorrectionForm.setAttribute("aria-busy", "false");
  }
 }
 }
  function setFolioTab(tab, { updateHistory = true, focus = true } = {}) {
 const next = tabs.find(([name]) => name === tab) || tab === "correction" ? tab : "postings";
 if (next !== folioActiveTab && currentFolioDraftIsDirty()) {
  if (!confirmFolioExit()) return false;
  d?.r();
  if (folioActiveTab === "charge") {
  folioChargeForm.reset();
  folioChargeAttemptKey = "";
  folioChargeDraft = "";
  syncFolioChargeConfirmation();
  } else {
  clearFolioCorrection();
  }
 }
 folioActiveTab = next;
 for (const [name, button] of tabs) {
  const selected = name === next;
  $(`#folio-${name}-panel`).hidden = !selected;
  button.setAttribute("aria-selected", selected);
 }
 folioCorrectionPanel.hidden = next !== "correction";
 if (updateHistory && propertySelect.value && folioStatementData) {
 history.pushState(folioWorkspaceHistoryState(folioStatementData.folio.id), "", canonicalFolioPath(propertySelect.value, folioStatementData.folio.id, next, folioRouteCursor));
 }
 if(next==="deposit")if(d)d.s();else if(!p){const g=folioGeneration;p=import("/assets/operator-deposits.js").then(m=>(d=m.default([
  () => [folioGeneration, propertySelect.value, folioIdentity, folioStatementData], request, renderFolioStatement,
 ])).s(g),()=>p=g==folioGeneration&&folioActiveTab==="deposit"&&announceOperation("error"))}
 if (next === "direct-billing") void loadReceivableTransferTargets();
 if (focus) (tabs.find(([name]) => name === next)?.[1] || folioCorrectionHeading).focus();
 return true;
 }
  function folioStatusAction(statement = folioStatementData) {
 if (!statement?.folio) return null;
 const balance = BigInt(exactFolioMinor(statement.balanceMinor, "server balance"));
 if (balance !== 0n) return null;
 if (statement.folio.status === "open") return "settle";
 if (statement.folio.status === "settled") return "close";
 return null;
 }
  function renderFolioSettlement(statement) {
 const status = String(statement.folio.status || "unknown");
 const balance = BigInt(exactFolioMinor(statement.balanceMinor, "server balance"));
 const action = folioStatusAction(statement);
 folioSettlementPanel.dataset.status = status;
 folioSettlementPanel.setAttribute("aria-busy", String(folioStatusPending));
 folioSettlementState.textContent = status;
 folioSettlementBalance.textContent = balance.toString();
 folioSettlementAction.hidden = true;
 folioSettlementAction.disabled = true;
 folioSettlementAction.removeAttribute("data-action");
 folioSettlementStatus.classList.remove("error");
 folioSettlementStatus.textContent = "";
 if (balance !== 0n) {
  folioSettlementHeading.textContent = "Payment required before settlement";
  folioSettlementCopy.textContent = `The server balance is ${balance.toString()} minor units. Use an authorized payment or deposit workflow to bring this window to exactly zero; Yellow will not force or simulate settlement.`;
  return;
 }
 if (action === "settle") {
  folioSettlementHeading.textContent = "Ready to settle this window";
  folioSettlementCopy.textContent = "The server reports an open folio with an exact zero balance. Settlement records that assertion only; it does not pay, invoice or check out the stay.";
  folioSettlementAction.textContent = folioStatusPending ? "Settling…" : "Settle folio";
 } else if (action === "close") {
  folioSettlementHeading.textContent = "Ready to close this window";
  folioSettlementCopy.textContent = "The server reports a settled folio that is still exactly zero. Closure finalizes this folio window only; it does not close the account, issue an invoice or check out the reservation.";
  folioSettlementAction.textContent = folioStatusPending ? "Closing…" : "Close folio";
 } else if (status === "closed") {
  folioSettlementHeading.textContent = "Folio window closed";
  folioSettlementCopy.textContent = "This window has reached its final status. Its immutable postings remain available as evidence; no reopen action is offered here.";
  return;
 } else {
  folioSettlementHeading.textContent = "No status action available";
  folioSettlementCopy.textContent = "The server returned a folio status that has no authorized transition in this workspace.";
  return;
 }
 folioSettlementAction.dataset.action = action;
 folioSettlementAction.hidden = false;
 folioSettlementAction.disabled = folioStatusPending;
 }
  async function submitFolioStatus(action) {
 if (!folioStatementData || (action !== "settle" && action !== "close") || folioStatusPending) return;
 if (folioStatusAction(folioStatementData) !== action) {
  renderFolioSettlement(folioStatementData);
  folioSettlementStatus.classList.add("error");
  folioSettlementStatus.textContent = "The current server statement no longer offers that status action.";
  return;
 }
 const folioId = folioStatementData.folio.id;
 const prompt = action === "settle"
  ? "Settle this zero-balance folio window? This records a final status assertion and does not take payment, issue an invoice or check out the reservation."
  : "Close this settled zero-balance folio window? Closed folios cannot be reopened from this workspace.";
 if (!confirm(prompt)) return;
 const generation = folioGeneration;
 const property = propertySelect.value;
 const identity = folioIdentity;
 const draft = JSON.stringify({
  folioId, action, status: folioStatementData.folio.status,
  balanceFingerprint: exactFolioMinor(folioStatementData.balanceMinor, "server balance"),
  generation: String(folioStatementData.generation || ""),
 });
 if (draft !== folioStatusAttemptDraft) {
  folioStatusAttemptDraft = draft;
  folioStatusAttemptKey = crypto.randomUUID();
 }
 const attemptKey = folioStatusAttemptKey;
 const expectedPreviousStatus = action === "settle" ? "open" : "settled";
 const expectedStatus = action === "settle" ? "settled" : "closed";
 folioStatusPending = true;
 renderFolioSettlement(folioStatementData);
 folioSettlementStatus.textContent = action === "settle"
  ? "Asking the server to verify zero balance and settle this folio…"
  : "Asking the server to verify zero balance and close this folio…";
 try {
  const transitioned = await request(`/api/v1/properties/${enc(property)}/folios/${enc(folioId)}/status`, {
  method: "POST", body: JSON.stringify({ action, idempotencyKey: attemptKey }),
  });
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  const returnedFolioId = transitioned.folioId ?? transitioned.folio?.id;
  const returnedStatus = transitioned.status ?? transitioned.folio?.status;
  if (returnedFolioId !== folioId || transitioned.previousStatus !== expectedPreviousStatus || returnedStatus !== expectedStatus ||
  exactFolioMinor(transitioned.balanceMinor, "transition balance") !== "0") {
  throw new Error("The server returned a different folio status transition");
  }
  const refreshed = await request(`/api/v1/properties/${enc(property)}/folios/${enc(folioId)}/statement?limit=50`);
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  if (refreshed.folio?.id !== folioId || refreshed.folio?.status !== expectedStatus) {
  throw new Error("The authoritative statement did not confirm the requested folio status");
  }
  folioStatusAttemptKey = "";
  folioStatusAttemptDraft = "";
  folioStatusPending = false;
  folioRouteCursor = "";
  renderFolioStatement(refreshed);
  const replayed = transitioned.replayed === true;
  folioSettlementStatus.textContent = action === "settle"
  ? replayed ? "Existing settlement confirmed. The authoritative statement was refreshed." : "Folio settled. The authoritative statement was refreshed."
  : replayed ? "Existing closure confirmed. The authoritative statement was refreshed." : "Folio closed. The authoritative statement was refreshed.";
  folioSettlementHeading.focus({ preventScroll: true });
 } catch (error) {
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  folioStatusPending = false;
  renderFolioSettlement(folioStatementData);
  const message = error instanceof Error ? error.message : "The folio status could not be changed";
  folioSettlementStatus.classList.add("error");
  folioSettlementStatus.textContent = `${message}. Retry keeps the same idempotency key.`;
  folioSettlementAction.focus({ preventScroll: true });
 }
 }
  function renderFolioStatement(statement) {
 folioStatementData = statement;
 folioNextCursor = statement.nextCursor;
 folioStatementTitle.textContent = statement.folio.reference || statement.folio.id;
 folioWorkspaceTitle.textContent = statement.folio.reference || `Folio ${statement.folio.id}`;
 folioWindow.textContent = String(statement.folio.windowNo);
 folioStatus.textContent = statement.folio.status;
 folioCurrency.textContent = statement.folio.currency;
 folioBalance.textContent = exactFolioMinor(statement.balanceMinor, "server balance");
 folioStayTotal.textContent = exactFolioMinor(statement.stayTotalMinor, "stay total");
 folioActiveTotal.textContent = exactFolioMinor(statement.balanceMinor, "active window total");
 folioAccountCurrency.textContent = statement.folio.currency;
 const windows = folioWindows(statement);
 folioWindowCount.textContent = String(windows.length);
 folioWindowNew.disabled = !canonicalUuid(statement.reservationId);
 renderFolioWindowTabs(windows, statement.folio.id);
 renderFolioTransferGroups(statement.rows);
 folioLineCount.textContent = String(statement.lineCount);
 renderFolioRows(statement.rows);
 renderFolioChargeOptions(statement.chargeOptions, statement.chargeAvailability);
 renderFolioSettlement(statement);
 folioLoadOlder.hidden = statement.nextCursor === null;
 folioPageStatus.textContent = statement.nextCursor === null
  ? `All ${String(statement.lineCount)} immutable line${statement.lineCount === 1 ? "" : "s"} loaded.`
  : "Older postings available.";
 folioStatementLoading.hidden = true;
 folioStatementError.hidden = true;
 folioStatement.hidden = false;
 folioWorkspace.hidden = false;
 setFolioTab(folioActiveTab, { updateHistory: false, focus: false });
 }
  async function lookupFolioStatement() {
 const reference = String(new FormData(folioStatementLookupForm).get("reference") || "").trim();
 if (!reference) return;
 const generation = ++folioGeneration;
 const property = propertySelect.value;
 const identity = reference;
 folioIdentity = identity;
 folioWorkspaceProperty = property;
 resetFolioPresentation();
 folioWorkspace.hidden = false;
 folioStatementLoading.hidden = false;
 const button = folioStatementLookupForm.querySelector("button[type=submit]");
 button.disabled = true;
 formMessage(folioStatementLookupForm, "Reading one immutable server statement…");
 try {
  const statement = await request(`/api/v1/properties/${enc(property)}/folios/${enc(reference)}/statement?limit=50`);
  if (!isCurrentFolioRequest(generation, property, identity)) return;
  if (typeof statement.folio?.id !== "string") throw new Error("The server returned an invalid folio identity.");
  folioRouteCursor = "";
  renderFolioStatement(statement);
  folioIdentity = statement.folio.id;
  formMessage(folioStatementLookupForm, `Loaded exact folio ${statement.folio.reference || statement.folio.id}.`);
  history.pushState({ yellowSurface: "folio-workspace" }, "", canonicalFolioPath(property, statement.folio.id, "postings"));
  folioWorkspace.focus();
 } catch (error) {
  if (generation !== folioGeneration || property !== propertySelect.value || activeView !== "folios") return;
  folioStatementLoading.hidden = true;
  folioStatementError.hidden = false;
  folioStatementError.querySelector("p").textContent = error instanceof Error ? error.message : "Folio statement could not be loaded";
  const message = error instanceof Error ? error.message : "Folio statement could not be loaded";
  formMessage(folioStatementLookupForm, message, true);
  setFolioError(message);
 } finally {
  if (generation === folioGeneration && property === propertySelect.value && activeView === "folios") button.disabled = false;
 }
 }
  async function loadFolioWorkspace(folioId, after = "", { focus = true } = {}) {
 if (departureFolioReturn && departureFolioReturn.folioId !== folioId) departureFolioReturn = null;
 if (reservationFolioReturn && reservationFolioReturn.folioId !== folioId) reservationFolioReturn = null;
 const generation = ++folioGeneration;
 const property = propertySelect.value;
 const identity = folioId;
 folioWorkspaceProperty = property;
 folioIdentity = identity;
 folioRouteCursor = after;
 resetFolioPresentation();
 folioIdentity = identity;
 folioRouteCursor = after;
 folioWorkspace.hidden = false;
 folioStatementLoading.hidden = false;
 folioWorkspace.setAttribute("aria-busy", "true");
 try {
  const query = after ? `?after=${enc(after)}&limit=50` : "?limit=50";
  const statement = await request(`/api/v1/properties/${enc(property)}/folios/${enc(folioId)}/statement${query}`);
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  if (statement.folio.id !== folioId) throw new Error("The server returned a different folio.");
  renderFolioStatement(statement);
  folioWorkspace.setAttribute("aria-busy", "false");
  syncDepartureFolioReturnControl();
  if (focus) folioWorkspace.focus();
 } catch (error) {
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  const message = error instanceof Error ? error.message : "Older postings could not be loaded";
  folioStatementLoading.hidden = true;
  folioStatementError.hidden = false;
  folioStatementError.querySelector("p").textContent = message;
  folioWorkspace.setAttribute("aria-busy", "false");
  setFolioError(message);
 }
 }
  function loadOlderFolioRows() {
 if (!folioStatementData || !folioNextCursor || !confirmFolioExit()) return;
 const cursor = folioNextCursor;
 history.pushState(folioWorkspaceHistoryState(folioStatementData.folio.id), "", canonicalFolioPath(propertySelect.value, folioStatementData.folio.id, folioActiveTab, cursor));
 void loadFolioWorkspace(folioStatementData.folio.id, cursor);
 }
  function openFolioWorkspace(folioId, { trigger = null, departureReturn = null, reservationReturn = null } = {}) {
 if (activeView === "folios" && !confirmFolioExit()) return;
 departureFolioReturn = departureReturn;
 reservationFolioReturn = departureReturn ? null : reservationReturn;
 departureFolioExitConfirmed = false;
 reservationFolioExitConfirmed = false;
 syncDepartureFolioReturnControl();
 folioReturnFocus = trigger;
 closeReservationDetail({ history: false, restoreFocus: false });
 setView("folios", false);
 folioActiveTab = "postings";
 const departureHistoryState = departureFolioReturn
  ? { yellowSurface: "folio-workspace", departureFolioReturn }
  : { yellowSurface: "folio-workspace" };
 const folioHistoryState = reservationFolioReturn
  ? { yellowSurface: "folio-workspace", reservationFolioReturn }
  : departureHistoryState;
 history.pushState(folioHistoryState, "", canonicalFolioPath(propertySelect.value, folioId));
 void loadFolioWorkspace(folioId);
 }
 function returnFromFolioWorkspaceToDeparture({ fromHistory = false } = {}) {
 const returning = departureFolioReturn;
 if (!departureFolioReturnIsCurrent(returning)) return false;
 const departurePath = `/p/${returning.property}/res/${returning.reservationId}?workbench=checkout`;
 if (returning.originPath !== departurePath) return false;
 if (!fromHistory) {
  if (!confirmFolioExit()) return false;
  departureFolioExitConfirmed = true;
  history.back();
  return true;
 }
 clearFolioState();
 setView("reservations", false);
 void openReservationDetail(returning.reservationId, { push: false, workbench: "checkout" });
 return true;
 }
 function returnFromFolioWorkspaceToReservation({ fromHistory = false } = {}) {
 const returning = reservationFolioReturn;
 if (!reservationFolioReturnIsCurrent(returning)) return false;
 const reservationPath = `/p/${returning.property}/res/${returning.reservationId}${returning.workbench
  ? `?${RESERVATION_WORKBENCH_QUERY[returning.workbench]}` : ""}`;
 if (returning.originPath !== reservationPath) return false;
 if (!fromHistory) {
  if (!confirmFolioExit()) return false;
  reservationFolioExitConfirmed = true;
  history.back();
  return true;
 }
 clearFolioState();
 setView("reservations", false);
 void openReservationDetail(returning.reservationId, { push: false, workbench: returning.workbench });
 return true;
 }
  function syncFolioRoute() {
 const route = folioRouteFromLocation();
 if (route.kind === "other" || !propertySelect.value || route.property !== propertySelect.value) return;
 if (route.kind === "list") {
  departureFolioReturn = null;
  reservationFolioReturn = null;
  clearFolioState();
  syncDepartureFolioReturnControl();
  $("#folios-title")?.focus();
  return;
 }
 departureFolioReturn = departureFolioReturnFromState(history.state, route.property, route.folioId);
 reservationFolioReturn = departureFolioReturn ? null
  : reservationFolioReturnFromState(history.state, route.property, route.folioId);
 const canonical = canonicalFolioPath(route.property, route.folioId, route.tab, route.after);
 if (`${location.pathname}${location.search}` !== canonical) history.replaceState(folioWorkspaceHistoryState(route.folioId), "", canonical);
 folioActiveTab = route.tab;
 if (folioIdentity !== route.folioId || folioRouteCursor !== route.after || folioWorkspace.hidden) {
  void loadFolioWorkspace(route.folioId, route.after, { focus: false });
 } else {
  setFolioTab(route.tab, { updateHistory: false, focus: false });
  syncDepartureFolioReturnControl();
 }
 }
  function folioChargeBody() {
 const fields = new FormData(folioChargeForm);
 const quantity = String(fields.get("quantity") || "").trim();
 return {
  txCode: String(fields.get("txCode") || ""),
  amountMinor: String(fields.get("amountMinor") || ""),
  ...(quantity ? { quantity } : {}),
 };
 }
  function syncFolioChargeConfirmation() {
 folioChargeSubmit.disabled = folioChargeFields.disabled || !folioChargeConfirm.checked;
 }
  async function postFolioCharge() {
 if (!folioStatementData || !folioChargeConfirm.checked) return;
 const generation = folioGeneration;
 const property = propertySelect.value;
 const identity = folioIdentity;
 const folioId = folioStatementData.folio.id;
 const body = folioChargeBody();
 const draft = JSON.stringify(body);
 if (draft !== folioChargeDraft) {
  folioChargeDraft = draft;
  folioChargeAttemptKey = crypto.randomUUID();
 }
 const attemptKey = folioChargeAttemptKey;
 folioChargeSubmit.disabled = true;
 formMessage(folioChargeForm, "Posting one irreversible untaxed charge through the governed server command…");
 setFolioError();
 try {
  const posted = await request(`/api/v1/properties/${enc(property)}/folios/${enc(folioId)}/charges`, {
  method: "POST",
  headers: { "idempotency-key": attemptKey },
  body: JSON.stringify(body),
  });
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  if (posted.folioId !== folioId) throw new Error("The server returned a different folio.");
  const refreshed = await request(`/api/v1/properties/${enc(property)}/folios/${enc(folioId)}/statement?limit=50`);
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  if (refreshed.folio.id !== folioId) throw new Error("The server returned a different folio.");
  renderFolioStatement(refreshed);
  folioChargeForm.reset();
  folioChargeAttemptKey = "";
  folioChargeDraft = "";
  syncFolioChargeConfirmation();
  formMessage(folioChargeForm, posted.replayed ? "The existing charge was confirmed and the server statement was refreshed." : "Charge posted and the server statement was refreshed.");
  folioBalance.focus();
 } catch (error) {
  if (!isCurrentFolioRequest(generation, property, identity, folioId)) return;
  const message = error instanceof Error ? error.message : "The charge could not be confirmed";
  formMessage(folioChargeForm, `${message}. Retry keeps the same idempotency key.`, true);
  setFolioError(message);
 } finally {
  if (isCurrentFolioRequest(generation, property, identity, folioId)) syncFolioChargeConfirmation();
 }
 }
  function canonicalCashierPath(property) { return `/p/${enc(property)}/cashiers`; }
  function cashierRouteFromLocation() {
 const match = /^\/p\/([0-9a-f-]+)\/cashiers$/.exec(location.pathname);
 return match ? { property: match[1] } : null;
 }
  function cashierDenominations(drawer) {
 return Array.isArray(drawer?.denominations) ? drawer.denominations.filter((denomination) =>
  denomination && typeof denomination.denominationMinor === "string") : [];
 }
  function cashierSession(drawer) { return drawer?.session || drawer?.activeSession || null; }
  function cashierCurrentDrawer() {
 return Array.isArray(cashierData?.drawers) ? cashierData.drawers.find((drawer) => drawer?.id === cashierDrawerId) || null : null;
 }
  function cashierMessage(form, message, isError = false) { formMessage(form, message, isError); }
  function cashierFormBody(drawer, container) {
 const denominations = cashierDenominations(drawer).map((denomination) => {
  const input = container.querySelector(`[data-denomination-minor="${denomination.denominationMinor}"]`);
  return { denominationMinor: denomination.denominationMinor, quantity: String(input?.value || "0") };
 });
 return { denominations };
 }
  function renderCashierDenominations(container, drawer) {
 container.replaceChildren();
 for (const denomination of cashierDenominations(drawer)) {
  const label = node("label", "cashier-denomination");
  const title = node("span", "", String(denomination.label || denomination.display || denomination.denominationMinor || "Governed denomination"));
  const input = el("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.maxLength = 19;
  input.pattern = "(?:0|[1-9][0-9]*)";
  input.value = "0";
  input.dataset.denominationMinor = denomination.denominationMinor;
  input.setAttribute("aria-label", `${title.textContent} quantity`);
  label.append(title, input);
  container.append(label);
 }
 }
  function syncCashierConfirmations() {
 const drawer = cashierCurrentDrawer();
 const hasDrawer = !!drawer;
 cashierOpenSubmit.disabled = !hasDrawer || !cashierOpenConfirm.checked;
 cashierCountSubmit.disabled = !hasDrawer || !cashierCountConfirm.checked;
 cashierCloseSubmit.disabled = !hasDrawer || drawer?.canOperate !== true || !cashierCloseConfirm.checked || !cashierSession(drawer)?.sessionId || !cashierSession(drawer)?.latestCount?.countId;
 cashierSupervisedClose.hidden = drawer?.supervised !== true;
 cashierSupervisedClose.disabled = !hasDrawer || drawer?.supervised !== true || !cashierCloseConfirm.checked || !cashierSession(drawer)?.sessionId || !cashierSession(drawer)?.latestCount?.countId;
 cashierApprovalRequest.disabled = !hasDrawer || drawer?.canOperate !== true || !cashierSession(drawer)?.sessionId || !cashierSession(drawer)?.latestCount?.countId;
 cashierSupervisedApprovalRequest.hidden = drawer?.supervised !== true;
 cashierSupervisedApprovalRequest.disabled = !hasDrawer || drawer?.supervised !== true || !cashierSession(drawer)?.sessionId || !cashierSession(drawer)?.latestCount?.countId;
 cashierApprovalApprove.disabled = !hasDrawer || drawer.supervised !== true || !cashierSession(drawer)?.sessionId || !canonicalUuid(cashierCloseApproval.value);
 cashierApprovalReject.disabled = !hasDrawer || drawer.supervised !== true || !cashierSession(drawer)?.sessionId || !canonicalUuid(cashierCloseApproval.value);
 }
  function cashierEvidenceRows(value) {
 cashierEvidenceList.replaceChildren();
 if (!value || typeof value !== "object") { cashierEvidence.hidden = true; return; }
 const entries = [
  ["Session", value.sessionId || value.id], ["Count", value.countId || value.latestCountId],
  ["Expected", value.expectedMinor], ["Counted", value.countedMinor], ["Over / short", value.overShortMinor],
  ["Status", value.status],
 ].filter(([, item]) => item !== undefined && item !== null && item !== "");
 for (const [label, entry] of entries) {
  cashierEvidenceList.append(node("dt", "", label), node("dd", "", String(entry)));
 }
 cashierEvidence.hidden = entries.length === 0;
 }
  function renderCashierState(data) {
 const drawers = Array.isArray(data?.drawers) ? data.drawers : [];
 cashierDrawer.replaceChildren();
 for (const drawer of drawers) {
  if (!drawer || typeof drawer.id !== "string") continue;
  const option = el("option"); option.value = drawer.id; option.textContent = String(drawer.name || drawer.code || drawer.id); cashierDrawer.append(option);
 }
 if (!drawers.some((drawer) => drawer?.id === cashierDrawerId)) cashierDrawerId = cashierDrawer.value || "";
 const drawer = cashierCurrentDrawer();
 cashierWorkbench.hidden = !drawer;
 if (!drawer) return;
 const session = cashierSession(drawer);
 cashierDrawerName.textContent = String(drawer.name || drawer.code || drawer.id);
 cashierCurrency.textContent = String(drawer.currency || "—");
 cashierSessionState.textContent = session?.sessionId ? "Open" : "No active session";
 cashierCountState.textContent = session?.latestCount?.countId ? `Attempt ${session.latestCount.attemptNo}` : "—";
 cashierSessionSummary.textContent = session?.sessionId ? "Server evidence controls each available action." : "Open custody only after entering your physical opening count.";
 cashierOpenPanel.hidden = !!session || drawer.canOpen === false;
 cashierCountPanel.hidden = !session || drawer.canCount === false;
 cashierClosePanel.hidden = !session || drawer.canClose === false;
 cashierCloseSubmit.hidden = drawer.canOperate !== true;
 cashierApprovalRequest.hidden = drawer.canOperate !== true;
 renderCashierDenominations(cashierOpenDenominations, drawer);
 renderCashierDenominations(cashierCountDenominations, drawer);
 cashierOpenForm.reset(); cashierCountForm.reset(); cashierCloseForm.reset();
 cashierOpenConfirm.checked = false; cashierCountConfirm.checked = false; cashierCloseConfirm.checked = false;
 cashierCloseCopy.textContent = session?.latestCount?.countId ? "The server validates the latest immutable count, close authority and any required approval." : "Submit a fresh physical count before attempting close.";
 cashierEvidenceRows(session?.latestOperationalAttempt || session?.closeEvidence || cashierLatestEvidence);
 syncCashierConfirmations();
 }
  function cashierIsCurrent(generation, property, drawerId = cashierDrawerId) {
 return generation === cashierGeneration && activeView === "cashiers" && property === propertySelect.value && drawerId === cashierDrawerId;
 }
  async function loadCashierSession({ focus = false } = {}) {
 const property = propertySelect.value;
 if (!property) return;
 const generation = ++cashierGeneration;
 cashierLoading.hidden = false; cashierError.hidden = true; cashierWorkbench.setAttribute("aria-busy", "true");
 try {
  const result = await request(`/api/v1/properties/${enc(property)}/cashier-sessions`);
  if (!cashierIsCurrent(generation, property)) return;
  cashierData = result; renderCashierState(result); cashierLoading.hidden = true; cashierWorkbench.setAttribute("aria-busy", "false");
  if (focus) cashierWorkbench.focus();
 } catch (error) {
  if (!cashierIsCurrent(generation, property)) return;
  cashierLoading.hidden = true; cashierWorkbench.setAttribute("aria-busy", "false"); cashierError.hidden = false;
  cashierError.querySelector("p").textContent = error instanceof Error ? error.message : "Cashier state could not be loaded";
 }
 }
  async function submitCashierOpen() {
 const drawer = cashierCurrentDrawer(); if (!drawer || cashierOpenSubmit.disabled) return;
 const property = propertySelect.value, generation = cashierGeneration;
 const body = { drawerId: drawer.id, ...cashierFormBody(drawer, cashierOpenDenominations) };
 const draft = JSON.stringify(body); if (draft !== cashierOpenDraft) { cashierOpenDraft = draft; cashierOpenAttemptKey = crypto.randomUUID(); }
 cashierOpenSubmit.disabled = true; cashierMessage(cashierOpenForm, "Opening this cashier session through the governed server command…");
 try {
  const result = await request(`/api/v1/properties/${enc(property)}/cashier-sessions`, { method: "POST", headers: { "idempotency-key": cashierOpenAttemptKey }, body: JSON.stringify(body) });
  if (!cashierIsCurrent(generation, property, drawer.id)) return;
  cashierMessage(cashierOpenForm, result.replayed ? "The existing cashier opening was confirmed. Refreshing server evidence…" : "Cashier session opened. Refreshing server evidence…");
  cashierLatestEvidence = result; cashierOpenAttemptKey = ""; cashierOpenDraft = ""; await loadCashierSession({ focus: true });
 } catch (error) { if (cashierIsCurrent(generation, property, drawer.id)) cashierMessage(cashierOpenForm, `${error instanceof Error ? error.message : "Opening failed"}. Retry keeps the same idempotency key.`, true); }
 finally { if (cashierIsCurrent(generation, property, drawer.id)) syncCashierConfirmations(); }
 }
  async function submitCashierCount() {
 const drawer = cashierCurrentDrawer(), session = cashierSession(drawer); if (!drawer || !session?.sessionId || cashierCountSubmit.disabled) return;
 const property = propertySelect.value, generation = cashierGeneration;
 const body = cashierFormBody(drawer, cashierCountDenominations);
 const draft = JSON.stringify({ sessionId: session.sessionId, ...body }); if (draft !== cashierCountDraft) { cashierCountDraft = draft; cashierCountAttemptKey = crypto.randomUUID(); }
 cashierCountSubmit.disabled = true; cashierMessage(cashierCountForm, "Submitting one blind physical count. Expected cash remains hidden…");
 try {
  const result = await request(`/api/v1/properties/${enc(property)}/cashier-sessions/${enc(session.sessionId)}/counts`, { method: "POST", headers: { "idempotency-key": cashierCountAttemptKey }, body: JSON.stringify(body) });
  if (!cashierIsCurrent(generation, property, drawer.id)) return;
  cashierMessage(cashierCountForm, result.replayed ? "The existing count was confirmed. Refreshing server evidence…" : "Blind count recorded. Refreshing server evidence…");
  cashierLatestEvidence = result; cashierCountAttemptKey = ""; cashierCountDraft = ""; await loadCashierSession({ focus: true });
 } catch (error) { if (cashierIsCurrent(generation, property, drawer.id)) cashierMessage(cashierCountForm, `${error instanceof Error ? error.message : "Count failed"}. Retry keeps the same idempotency key.`, true); }
 finally { if (cashierIsCurrent(generation, property, drawer.id)) syncCashierConfirmations(); }
 }
  async function requestCashierApproval(supervised = false) {
 const drawer = cashierCurrentDrawer(), session = cashierSession(drawer);
 const control = supervised ? cashierSupervisedApprovalRequest : cashierApprovalRequest;
 if (!drawer || !session?.sessionId || !session?.latestCount?.countId || control.disabled || (supervised && drawer.supervised !== true)) return;
 const property = propertySelect.value, generation = cashierGeneration;
 const body = { countId: session.latestCount.countId };
 const draft = JSON.stringify({ sessionId: session.sessionId, ...body });
 if (draft !== cashierApprovalRequestDraft) { cashierApprovalRequestDraft = draft; cashierApprovalRequestKey = crypto.randomUUID(); }
 control.disabled = true; cashierMessage(cashierCloseForm, "Requesting exact server-derived discrepancy approval…");
 try {
  const route = supervised ? "supervised-approvals" : "approvals";
  const result = await request(`/api/v1/properties/${enc(property)}/cashier-sessions/${enc(session.sessionId)}/${route}`, { method: "POST", headers: { "idempotency-key": cashierApprovalRequestKey }, body: JSON.stringify(body) });
  if (!cashierIsCurrent(generation, property, drawer.id)) return;
  cashierCloseApproval.value = String(result.approvalId || ""); cashierLatestEvidence = result; cashierEvidenceRows(result);
  cashierMessage(cashierCloseForm, result.replayed ? "The existing approval request was confirmed. A different supervisor may approve it." : "Discrepancy approval requested. A different supervisor may approve this exact evidence.");
  cashierApprovalRequestKey = ""; cashierApprovalRequestDraft = ""; syncCashierConfirmations();
 } catch (error) { if (cashierIsCurrent(generation, property, drawer.id)) cashierMessage(cashierCloseForm, `${error instanceof Error ? error.message : "Approval request failed"}. Retry keeps the same idempotency key.`, true); }
 finally { if (cashierIsCurrent(generation, property, drawer.id)) syncCashierConfirmations(); }
 }
  async function decideCashierApproval(action) {
 const drawer = cashierCurrentDrawer(), session = cashierSession(drawer), approvalId = cashierCloseApproval.value.trim();
 const control = action === "approve" ? cashierApprovalApprove : cashierApprovalReject;
 if ((action !== "approve" && action !== "reject") || !drawer || drawer.supervised !== true || !session?.sessionId || !canonicalUuid(approvalId) || control.disabled) return;
 const property = propertySelect.value, generation = cashierGeneration;
 const draft = JSON.stringify({ sessionId: session.sessionId, approvalId });
 if (draft !== cashierApprovalDecisionDraft) { cashierApprovalDecisionDraft = draft; cashierApprovalDecisionKey = crypto.randomUUID(); }
 control.disabled = true; cashierMessage(cashierCloseForm, action === "approve" ? "Approving only the server-bound discrepancy evidence…" : "Rejecting only the server-bound discrepancy evidence…");
 try {
  const result = await request(`/api/v1/properties/${enc(property)}/cashier-sessions/${enc(session.sessionId)}/approvals/${enc(approvalId)}/${action}`, { method: "POST", headers: { "idempotency-key": cashierApprovalDecisionKey }, body: JSON.stringify({}) });
  if (!cashierIsCurrent(generation, property, drawer.id)) return;
  cashierLatestEvidence = result; cashierEvidenceRows(result);
  cashierMessage(cashierCloseForm, result.replayed ? "The existing approval decision was confirmed." : action === "approve" ? "Discrepancy approval recorded. You may now close from this exact count." : "Discrepancy approval rejected. Close remains unavailable for this count.");
  cashierApprovalDecisionKey = ""; cashierApprovalDecisionDraft = ""; syncCashierConfirmations();
 } catch (error) { if (cashierIsCurrent(generation, property, drawer.id)) cashierMessage(cashierCloseForm, `${error instanceof Error ? error.message : "Approval failed"}. Retry keeps the same idempotency key.`, true); }
 finally { if (cashierIsCurrent(generation, property, drawer.id)) syncCashierConfirmations(); }
 }
  async function submitCashierClose(supervised = false) {
 const drawer = cashierCurrentDrawer(), session = cashierSession(drawer);
 const control = supervised ? cashierSupervisedClose : cashierCloseSubmit;
 if (!drawer || !session?.sessionId || !session?.latestCount?.countId || control.disabled || (supervised && drawer.supervised !== true)) return;
 const property = propertySelect.value, generation = cashierGeneration;
 const reason = cashierCloseReason.value.trim(), approvalId = cashierCloseApproval.value.trim();
 const body = { countId: session.latestCount.countId, ...(reason ? { reason } : {}), ...(approvalId ? { approvalId } : {}) };
 const draft = JSON.stringify({ sessionId: session.sessionId, ...body }); if (draft !== cashierCloseDraft) { cashierCloseDraft = draft; cashierCloseAttemptKey = crypto.randomUUID(); }
 control.disabled = true; cashierMessage(cashierCloseForm, "Closing only through the server’s current immutable evidence…");
 try {
  const route = supervised ? "supervised-close" : "close";
  const result = await request(`/api/v1/properties/${enc(property)}/cashier-sessions/${enc(session.sessionId)}/${route}`, { method: "POST", headers: { "idempotency-key": cashierCloseAttemptKey }, body: JSON.stringify(body) });
  if (!cashierIsCurrent(generation, property, drawer.id)) return;
  cashierLatestEvidence = result; cashierEvidenceRows(result); cashierMessage(cashierCloseForm, result.replayed ? "The existing close was confirmed. Refreshing server evidence…" : "Cashier session closed. Refreshing server evidence…");
  cashierCloseAttemptKey = ""; cashierCloseDraft = ""; await loadCashierSession({ focus: true });
 } catch (error) { if (cashierIsCurrent(generation, property, drawer.id)) cashierMessage(cashierCloseForm, `${error instanceof Error ? error.message : "Close failed"}. Retry keeps the same idempotency key.`, true); }
 finally { if (cashierIsCurrent(generation, property, drawer.id)) syncCashierConfirmations(); }
 }
 function canonicalVehiclePath(property, registration = "", cursor = "") {
 const query = new URLSearchParams();
 if (registration !== "") query.set("registration", registration);
 if (cursor !== "") query.set("cursor", cursor);
 const suffix = query.toString();
 return `/p/${property}/vehicles${suffix ? `?${suffix}` : ""}`;
 }
 function canonicalVehicleDetailPath(property, vehicleId) {
 return `/p/${property}/vehicles/${vehicleId}`;
 }
 function canonicalReservationDetailPath(property, reservationId) {
 return `/p/${property}/res/${reservationId}`;
 }
 function vehicleLinkedReservationReturnFromState(state, property, reservationId) {
 const value = state?.vehicleLinkedReservationReturn;
 if (state?.yellowSurface !== "reservation-detail" || !value || typeof value !== "object" || Array.isArray(value) ||
  Object.keys(value).sort().join(",") !== "property,reservationId,vehicleDetailPath,vehicleId" ||
  !canonicalUuid(value.property) || value.property !== property ||
  !canonicalUuid(value.vehicleId) || !canonicalUuid(value.reservationId) || value.reservationId !== reservationId ||
  value.vehicleDetailPath !== canonicalVehicleDetailPath(value.property, value.vehicleId)) return null;
 return Object.freeze({
  property: value.property,
  vehicleId: value.vehicleId,
  reservationId: value.reservationId,
  vehicleDetailPath: value.vehicleDetailPath,
 });
 }
 function vehicleRegisterLinkedReservationReturnFromState(state, property, reservationId) {
 const value = state?.vehicleRegisterLinkedReservationReturn;
 if (state?.yellowSurface !== "reservation-detail" || !value || typeof value !== "object" || Array.isArray(value) ||
  Object.keys(value).sort().join(",") !== "cursor,pageGeneration,property,registerPath,registration,reservationId,vehicleId" ||
  !canonicalUuid(value.property) || value.property !== property ||
  !canonicalUuid(value.vehicleId) || !canonicalUuid(value.reservationId) || value.reservationId !== reservationId ||
  typeof value.registration !== "string" || typeof value.cursor !== "string" ||
  !Number.isSafeInteger(value.pageGeneration) || value.pageGeneration < 1 ||
  value.registerPath !== canonicalVehiclePath(value.property, value.registration, value.cursor)) return null;
 return Object.freeze({
  property: value.property,
  vehicleId: value.vehicleId,
  reservationId: value.reservationId,
  registration: value.registration,
  cursor: value.cursor,
  registerPath: value.registerPath,
  pageGeneration: value.pageGeneration,
 });
 }
 function vehicleRouteFromLocation() {
 const match = location.pathname.match(/^\/p\/([0-9a-f-]+)\/vehicles$/);
 if (!match) return null;
 const query = new URLSearchParams(location.search);
 if ([...query.keys()].some((key) => key !== "registration" && key !== "cursor") ||
  query.getAll("registration").length > 1 || query.getAll("cursor").length > 1) return null;
 return { property: match[1], registration: query.get("registration") || "", cursor: query.get("cursor") || "" };
 }
 function vehicleDetailRouteFromLocation() {
 const match = location.pathname.match(/^\/p\/([0-9a-f-]+)\/vehicles\/([0-9a-f-]+)$/);
 if (!match || !canonicalUuid(match[1]) || !canonicalUuid(match[2])) return null;
 if (location.search) history.replaceState(history.state, "", location.pathname);
 return { property: match[1], vehicleId: match[2] };
 }
 function vehicleNavigationRoute() {
 const detail = vehicleDetailRouteFromLocation();
 return detail ? { kind: "detail", ...detail } : vehicleRouteFromLocation() === null
  ? { kind: "other" } : { kind: "register", ...vehicleRouteFromLocation() };
 }
function vehicleReturnPathFromState(state, property) {
 if (typeof state?.vehicleReturnPath !== "string") return "";
 if (state.vehicleReturnPath.includes("#") || state.vehicleReturnPath.split("?").length > 2) return "";
 const [pathname, rawSearch = ""] = state.vehicleReturnPath.split("?");
 const match = pathname.match(/^\/p\/([0-9a-f-]+)\/vehicles$/);
 const query = new URLSearchParams(rawSearch);
 if (!match || match[1] !== property || !canonicalUuid(match[1]) ||
     [...query.keys()].some((key) => key !== "registration" && key !== "cursor") ||
     query.getAll("registration").length > 1 || query.getAll("cursor").length > 1) return "";
 return `${pathname}${rawSearch ? `?${rawSearch}` : ""}`;
}
 function vehicleRecordResult(vehicle, expectedId = "") {
 const keys = ["colour", "driverName", "enteredAt", "exitedAt", "make", "model", "partyId", "registration", "reservationId", "vehicleId"];
 const nullable = ["colour", "driverName", "enteredAt", "exitedAt", "make", "model", "partyId", "reservationId"];
 if (!vehicle || typeof vehicle !== "object" || Array.isArray(vehicle) ||
  Object.keys(vehicle).sort().join(",") !== keys.join(",") || !canonicalUuid(vehicle.vehicleId) ||
  (expectedId !== "" && vehicle.vehicleId !== expectedId) ||
  typeof vehicle.registration !== "string" || nullable.some((key) => vehicle[key] !== null && typeof vehicle[key] !== "string") ||
  (vehicle.partyId !== null && !canonicalUuid(vehicle.partyId)) ||
  (vehicle.reservationId !== null && !canonicalUuid(vehicle.reservationId)) ||
  (vehicle.enteredAt !== null && !vehicleCanonicalInstant(vehicle.enteredAt)) ||
  (vehicle.exitedAt !== null && !vehicleCanonicalInstant(vehicle.exitedAt))) {
  throw new Error("The server returned an invalid vehicle-register row.");
 }
 return Object.freeze({ ...vehicle });
 }
 function vehicleCanonicalInstant(value) {
 return typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) &&
  Number.isFinite(Date.parse(value));
 }
 function vehicleRegisterResult(value) {
 if (!value || typeof value !== "object" || Array.isArray(value) ||
  Object.keys(value).sort().join(",") !== "nextCursor,vehicles" || !Array.isArray(value.vehicles) ||
  (value.nextCursor !== null && typeof value.nextCursor !== "string")) {
  throw new Error("The server returned an invalid vehicle-register page.");
 }
 return Object.freeze({ vehicles: Object.freeze(value.vehicles.map((vehicle) => vehicleRecordResult(vehicle))), nextCursor: value.nextCursor });
 }
 function vehicleDetailResult(value, origin) {
 if (!value || typeof value !== "object" || Array.isArray(value) ||
  Object.keys(value).sort().join(",") !== "vehicle") {
  throw new Error("The server returned an invalid vehicle-detail envelope.");
 }
 return vehicleRecordResult(value.vehicle, origin.vehicleId);
 }
 function vehicleParkingSpaceResult(value) {
 const keys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort() : [];
 if (keys.join(",") !== "code,floor,parkingSpaceId" || !canonicalUuid(value.parkingSpaceId) ||
  typeof value.code !== "string" || value.code.length < 1 || value.code.length > 120 ||
  (value.floor !== null && (typeof value.floor !== "string" || value.floor.length < 1 || value.floor.length > 120))) {
  throw new Error("The server returned an invalid parking space.");
 }
 return Object.freeze({ ...value });
 }
 function vehicleParkingSnapshotResult(value, origin) {
 if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).join(",") !== "snapshot") {
  throw new Error("The server returned an invalid parking envelope.");
 }
 const snapshot = value.snapshot;
 const keys = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? Object.keys(snapshot).sort() : [];
 if (keys.join(",") !== "assignment,candidates,vehicleId" || snapshot.vehicleId !== origin.vehicleId ||
  !Array.isArray(snapshot.candidates)) throw new Error("The server returned invalid parking truth.");
 const assignment = snapshot.assignment === null ? null : vehicleParkingSpaceResult(snapshot.assignment);
 const candidates = Object.freeze(snapshot.candidates.map(vehicleParkingSpaceResult));
 if (assignment !== null && candidates.length !== 0) throw new Error("The server returned replaceable parking truth.");
 return Object.freeze({ vehicleId: snapshot.vehicleId, assignment, candidates });
 }
 function vehicleParkingAssignmentResult(value, origin, expectedSpace) {
 const keys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort() : [];
 if (keys.join(",") !== "assignment,created,replayed" || typeof value.created !== "boolean" ||
  typeof value.replayed !== "boolean") throw new Error("The server returned an invalid parking receipt.");
 const assignment = value.assignment;
 const assignmentKeys = assignment && typeof assignment === "object" && !Array.isArray(assignment)
  ? Object.keys(assignment).sort() : [];
 if (assignmentKeys.join(",") !== "code,floor,from,parkingSpaceId,registration,to,vehicleId" ||
  assignment.vehicleId !== origin.vehicleId || assignment.parkingSpaceId !== expectedSpace ||
  typeof assignment.registration !== "string" || !Number.isFinite(Date.parse(assignment.from)) ||
  !Number.isFinite(Date.parse(assignment.to)) || Date.parse(assignment.from) >= Date.parse(assignment.to)) {
  throw new Error("The server returned mismatched parking evidence.");
 }
 vehicleParkingSpaceResult({
  parkingSpaceId: assignment.parkingSpaceId,
  code: assignment.code,
  floor: assignment.floor,
 });
 return Object.freeze({ assignment: Object.freeze({ ...assignment }), created: value.created, replayed: value.replayed });
 }
 function vehicleRegisterIsCurrent(generation, property, registration, cursor) {
 return generation === vehicleRegisterGeneration && activeView === "vehicles" &&
  property === propertySelect.value && registration === vehicleRegisterFilter && cursor === vehicleRegisterCursor &&
  location.pathname === `/p/${property}/vehicles`;
 }
 function vehicleValue(value) {
 return value === null || value === "" ? "Not recorded" : value;
 }
 function vehicleMeta(term, value) {
 const item = node("div", "vehicle-meta-item");
 item.append(node("dt", "", term), node("dd", "", vehicleValue(value)));
 return item;
 }
 function vehicleRegisterLinkedReservationActionIsCurrent(origin, action) {
 const currentRow = vehicleRegisterRows.find((row) => row.vehicleId === origin.vehicleId);
 return origin.pageGeneration === vehicleRegisterGeneration && activeView === "vehicles" &&
  origin.property === propertySelect.value && origin.registration === vehicleRegisterFilter &&
  origin.cursor === vehicleRegisterCursor && origin.registerPath === vehicleRegisterRenderedPath &&
  origin.registerPath === canonicalVehiclePath(origin.property, origin.registration, origin.cursor) &&
  `${location.pathname}${location.search}` === origin.registerPath && vehiclesView.hidden === false &&
  vehicleRegister.hidden === false && vehicleRegisterList.hidden === false &&
  Object.isFrozen(origin.row) && currentRow === origin.row && origin.row.vehicleId === origin.vehicleId &&
  origin.row.reservationId === origin.reservationId && canonicalUuid(origin.reservationId) &&
  origin.card.isConnected && origin.card.hidden === false && vehicleRegisterList.contains(origin.card) &&
  origin.card.dataset.vehicleId === origin.vehicleId && origin.card.dataset.reservationId === origin.reservationId &&
  action.isConnected && action.hidden === false && action.disabled === false && origin.card.contains(action) &&
  action.dataset.vehicleId === origin.vehicleId && action.dataset.reservationId === origin.reservationId;
 }
 async function openVehicleRegisterLinkedReservation(origin, action) {
 if (!vehicleRegisterLinkedReservationActionIsCurrent(origin, action)) return false;
 const linkedReturn = Object.freeze({
  property: origin.property,
  vehicleId: origin.vehicleId,
  reservationId: origin.reservationId,
  registration: origin.registration,
  cursor: origin.cursor,
  registerPath: origin.registerPath,
  pageGeneration: origin.pageGeneration,
 });
 vehicleRegisterLinkedReservationReturn = linkedReturn;
 reservationDrawerReturnView = "vehicle-register";
 reservationDrawerReturnReservationId = origin.reservationId;
 setView("reservations", false);
 history.pushState({
  yellowSurface: "reservation-detail",
  vehicleRegisterLinkedReservationReturn: linkedReturn,
 }, "", canonicalReservationDetailPath(origin.property, origin.reservationId));
 await openReservationDetail(origin.reservationId, { push: false, trigger: action });
 return true;
 }
 function returnFromReservationToVehicleRegister({ fromHistory = false } = {}) {
 const returning = fromHistory ? vehicleRegisterLinkedReservationReturn
  : vehicleRegisterLinkedReservationReturnFromState(history.state, propertySelect.value, reservationRouteReservationId);
 if (!returning || returning.property !== propertySelect.value ||
  returning.registerPath !== canonicalVehiclePath(returning.property, returning.registration, returning.cursor)) return false;
 if (!fromHistory) {
  vehicleRegisterLinkedReservationReturn = returning;
  history.back();
  return true;
 }
 if (`${location.pathname}${location.search}` !== returning.registerPath) return false;
 closeReservationDetail({ history: false, restoreFocus: false });
 vehicleRegisterLinkedReservationReturn = returning;
 vehicleRegisterRows = Object.freeze([]);
 vehicleRegisterRenderedPath = "";
 vehicleRegisterFilter = returning.registration;
 vehicleRegisterCursor = returning.cursor;
 vehicleRegistration.value = returning.registration;
 vehicleRegisterDeferSync = true;
 setView("vehicles", false);
 vehicleRegisterDeferSync = false;
 void loadVehicleRegister({ cursor: returning.cursor }).then(() => {
  if (vehicleRegisterLinkedReservationReturn !== returning || activeView !== "vehicles" ||
   `${location.pathname}${location.search}` !== returning.registerPath) return;
  const action = [...vehicleRegisterList.querySelectorAll(".vehicle-register-linked-reservation-action")]
   .find((item) => item.dataset.vehicleId === returning.vehicleId && item.dataset.reservationId === returning.reservationId);
  (action?.isConnected ? action : vehicleResultSummary).focus({ preventScroll: true });
  vehicleRegisterLinkedReservationReturn = null;
 });
 return true;
 }
 function vehicleCard(vehicle, pageOrigin) {
 const card = node("article", "vehicle-register-card");
 card.setAttribute("role", "listitem");
 card.dataset.vehicleId = vehicle.vehicleId;
 if (vehicle.reservationId !== null) card.dataset.reservationId = vehicle.reservationId;
 const head = node("div", "vehicle-register-card-head");
 const title = node("div");
 title.append(node("span", "eyebrow", "Recorded registration"), node("h3", "vehicle-registration", vehicle.registration));
 const actions = node("div", "vehicle-card-actions");
 const open = node("button", "secondary vehicle-detail-action", "Open vehicle");
 open.type = "button";
 open.dataset.vehicleId = vehicle.vehicleId;
 open.setAttribute("aria-label", `Open vehicle ${vehicle.registration}`);
 actions.append(node("span", "vehicle-read-only", "Read only"), open);
 if (vehicle.reservationId !== null) {
  const linkedReservation = node("button", "vehicle-register-linked-reservation-action", "Open linked reservation");
  linkedReservation.type = "button";
  linkedReservation.dataset.vehicleId = vehicle.vehicleId;
  linkedReservation.dataset.reservationId = vehicle.reservationId;
  linkedReservation.setAttribute("aria-label", `Open linked reservation for vehicle ${vehicle.registration}`);
  const linkedOrigin = Object.freeze({
   pageGeneration: pageOrigin.pageGeneration,
   property: pageOrigin.property,
   registration: pageOrigin.registration,
   cursor: pageOrigin.cursor,
   registerPath: pageOrigin.registerPath,
   vehicleId: vehicle.vehicleId,
   reservationId: vehicle.reservationId,
   row: vehicle,
   card: card,
  });
  linkedReservation.addEventListener("click", () => void openVehicleRegisterLinkedReservation(linkedOrigin, linkedReservation));
  actions.append(linkedReservation);
 }
 head.append(title, actions);
 const details = node("dl", "vehicle-register-meta");
 details.append(
  vehicleMeta("Make", vehicle.make), vehicleMeta("Model", vehicle.model),
  vehicleMeta("Colour", vehicle.colour), vehicleMeta("Driver", vehicle.driverName),
  vehicleMeta("Entered at", vehicle.enteredAt), vehicleMeta("Exited at", vehicle.exitedAt),
 );
 const linked = node("details", "vehicle-linked-records");
 linked.append(node("summary", "", "Linked record references"));
 const linkedValues = node("dl", "vehicle-register-meta");
 linkedValues.append(
  vehicleMeta("Vehicle ID", vehicle.vehicleId), vehicleMeta("Reservation ID", vehicle.reservationId),
  vehicleMeta("Party ID", vehicle.partyId),
 );
 linked.append(linkedValues);
 card.append(head, details, linked);
 return card;
 }
 function ensureVehicleDetailPanel() {
 if (vehicleDetailPanel?.isConnected) return vehicleDetailPanel;
 const panel = node("section", "card vehicle-detail-panel");
 panel.hidden = true;
 panel.setAttribute("aria-labelledby", "vehicle-detail-title");
 panel.setAttribute("aria-busy", "false");
 const head = node("div", "vehicle-detail-head");
 const titleCopy = el("div");
 titleCopy.append(node("p", "eyebrow", "Recorded vehicle"));
 const title = node("h3", "vehicle-detail-title", "Vehicle detail");
 title.id = "vehicle-detail-title";
 title.tabIndex = -1;
 titleCopy.append(title);
 const actions = node("div", "vehicle-detail-actions");
 const back = node("button", "quiet vehicle-detail-back", "Back to register");
 back.type = "button";
 const refresh = node("button", "secondary vehicle-detail-refresh", "Refresh detail");
 refresh.type = "button";
 actions.append(back, refresh);
 head.append(titleCopy, actions);
 const loading = node("div", "vehicle-detail-loading");
 loading.hidden = true;
 loading.setAttribute("aria-hidden", "true");
 loading.append(el("span"), el("span"), el("span"));
 const error = node("section", "vehicle-detail-error");
 error.hidden = true;
 error.setAttribute("role", "alert");
 const errorCopy = node("p", "", "Vehicle detail is unavailable.");
 const retry = node("button", "secondary vehicle-detail-retry", "Try again");
 retry.type = "button";
 error.append(node("strong", "", "Vehicle detail could not be loaded"), errorCopy, retry);
 const content = node("div", "vehicle-detail-content");
 content.hidden = true;
 panel.append(head, loading, error, content);
 vehicleRegister.after(panel);
 back.addEventListener("click", () => closeVehicleDetail());
 refresh.addEventListener("click", () => {
  if (vehicleRouteVehicleId) void loadVehicleDetail(vehicleRouteVehicleId, { focus: true });
 });
 retry.addEventListener("click", () => {
  if (vehicleRouteVehicleId) void loadVehicleDetail(vehicleRouteVehicleId, { focus: true });
 });
 vehicleDetailPanel = panel;
 return panel;
 }
 function vehicleDetailRequestIsCurrent(origin, panel) {
 return origin.requestGeneration === vehicleDetailRequestGeneration && activeView === "vehicles" &&
  origin.property === propertySelect.value && origin.vehicleId === vehicleRouteVehicleId &&
  panel.isConnected && panel.hidden === false && vehicleRegister.hidden === true &&
 location.pathname === canonicalVehicleDetailPath(origin.property, origin.vehicleId) && location.search === "";
 }
 function vehicleLinkedReservationActionIsCurrent(origin, action) {
 return origin.requestGeneration === vehicleDetailRequestGeneration && activeView === "vehicles" &&
  origin.property === propertySelect.value && origin.vehicleId === vehicleRouteVehicleId &&
  Object.isFrozen(origin.detail) && vehicleDetailData === origin.detail &&
  origin.detail.vehicleId === origin.vehicleId && origin.detail.reservationId === origin.reservationId &&
  canonicalUuid(origin.reservationId) && vehicleDetailPanel === origin.panel &&
  origin.panel.isConnected && origin.panel.hidden === false && vehiclesView.hidden === false &&
  origin.panel.querySelector(".vehicle-detail-content")?.hidden === false &&
  action?.isConnected && action.hidden === false && action.disabled === false && origin.panel.contains(action) &&
  location.pathname === canonicalVehicleDetailPath(origin.property, origin.vehicleId) && location.search === "";
 }
 async function openVehicleLinkedReservation(origin, action) {
 if (!vehicleLinkedReservationActionIsCurrent(origin, action)) return;
 const linkedReturn = Object.freeze({
  property: origin.property,
  vehicleId: origin.vehicleId,
  reservationId: origin.reservationId,
  vehicleDetailPath: canonicalVehicleDetailPath(origin.property, origin.vehicleId),
 });
 vehicleLinkedReservationReturn = linkedReturn;
 reservationDrawerReturnView = "vehicles";
 reservationDrawerReturnReservationId = origin.reservationId;
 setView("reservations", false);
 history.pushState({
  yellowSurface: "reservation-detail",
  vehicleLinkedReservationReturn: linkedReturn,
 }, "", `/p/${origin.property}/res/${origin.reservationId}`);
 await openReservationDetail(origin.reservationId, { push: false, trigger: action });
 }
 function renderVehicleDetail(panel, vehicle, origin) {
 const title = panel.querySelector(".vehicle-detail-title");
 title.textContent = vehicle.registration;
 const summary = node("div", "vehicle-detail-summary");
 summary.append(node("span", "vehicle-read-only", "Vehicle record"),
  node("p", "", "Recorded vehicle-register truth with a separate governed parking command."));
 if (vehicle.reservationId !== null) {
  const linkedReservation = node("button", "vehicle-linked-reservation-action", "Open linked reservation");
  linkedReservation.type = "button";
  linkedReservation.setAttribute("aria-label", "Open linked reservation detail");
  const linkedOrigin = Object.freeze({
   requestGeneration: origin.requestGeneration,
   property: origin.property,
   vehicleId: vehicle.vehicleId,
   reservationId: vehicle.reservationId,
   detail: vehicle,
   panel,
  });
  linkedReservation.addEventListener("click", () => void openVehicleLinkedReservation(linkedOrigin, linkedReservation));
  summary.append(linkedReservation);
 }
 const facts = node("dl", "vehicle-detail-facts");
 for (const [label, value] of [
  ["Make", vehicle.make], ["Model", vehicle.model], ["Colour", vehicle.colour],
  ["Driver", vehicle.driverName], ["Entered at", vehicle.enteredAt], ["Exited at", vehicle.exitedAt],
 ]) facts.append(vehicleMeta(label, value));
 const identifiers = node("details", "vehicle-detail-identifiers");
 identifiers.append(node("summary", "", "Recorded identifiers"));
 const identityFacts = node("dl", "vehicle-detail-facts");
 identityFacts.append(vehicleMeta("Vehicle ID", vehicle.vehicleId),
  vehicleMeta("Reservation ID", vehicle.reservationId), vehicleMeta("Party ID", vehicle.partyId));
 identifiers.append(identityFacts);
 const parking = node("section", "vehicle-parking-assignment");
 parking.setAttribute("aria-labelledby", "vehicle-parking-title");
 parking.setAttribute("aria-busy", "true");
 const parkingTitle = node("h4", "", "Parking assignment");
 parkingTitle.id = "vehicle-parking-title";
 parking.append(parkingTitle, node("p", "vehicle-parking-status", "Loading current parking truth…"));
 panel.querySelector(".vehicle-detail-content").replaceChildren(summary, facts, parking, identifiers,
  node("p", "field-note", "Vehicle entry, exit and guest records remain separate governed operations."));
 panel.querySelector(".vehicle-detail-content").hidden = false;
 panel.querySelector(".vehicle-detail-loading").hidden = true;
 panel.querySelector(".vehicle-detail-error").hidden = true;
 panel.setAttribute("aria-busy", "false");
 }
 function vehicleParkingActionIsCurrent(origin, panel, snapshot, button, select) {
 return vehicleDetailRequestIsCurrent(origin, panel) && vehicleDetailData?.vehicleId === origin.vehicleId &&
  Object.isFrozen(snapshot) && snapshot.vehicleId === origin.vehicleId && snapshot.assignment === null &&
  panel.querySelector(".vehicle-parking-assignment")?.contains(button) &&
  panel.querySelector(".vehicle-parking-assignment")?.contains(select) &&
  button.isConnected && !button.disabled && select.isConnected && !select.disabled &&
  snapshot.candidates.some((candidate) => candidate.parkingSpaceId === select.value);
 }
 async function assignVehicleParking(origin, panel, snapshot, select, button, message) {
 if (!vehicleParkingActionIsCurrent(origin, panel, snapshot, button, select)) return;
 const parkingSpaceId = select.value;
 const attemptKey = crypto.randomUUID();
 button.disabled = true;
 select.disabled = true;
 message.classList.remove("error");
 message.textContent = "Assigning this vehicle through live parking occupancy truth…";
 try {
  const receipt = vehicleParkingAssignmentResult(await request(
   `/api/v1/properties/${enc(origin.property)}/vehicles/${enc(origin.vehicleId)}/parking`, {
    method: "POST",
    headers: { "idempotency-key": attemptKey },
    body: JSON.stringify({ parkingSpaceId }),
   }), origin, parkingSpaceId);
  if (!vehicleDetailRequestIsCurrent(origin, panel)) return;
  message.textContent = receipt.replayed
   ? `Parking ${receipt.assignment.code} was already assigned. Refreshing server truth…`
   : `Parking ${receipt.assignment.code} assigned. Refreshing server truth…`;
  await loadVehicleDetail(origin.vehicleId, { focus: true });
 } catch (error) {
  if (!vehicleDetailRequestIsCurrent(origin, panel)) return;
  message.classList.add("error");
  message.textContent = `${error instanceof Error ? error.message : "Parking could not be assigned"}. Refresh and choose again.`;
  button.disabled = false;
  select.disabled = false;
  message.focus({ preventScroll: true });
 }
 }
 function renderVehicleParking(origin, panel, snapshot) {
 const parking = panel.querySelector(".vehicle-parking-assignment");
 if (!parking || !vehicleDetailRequestIsCurrent(origin, panel)) return;
 const title = node("h4", "", "Parking assignment");
 title.id = "vehicle-parking-title";
 if (snapshot.assignment) {
  const assigned = node("div", "vehicle-parking-assigned");
  assigned.append(node("span", "status-pill", "Assigned"),
   node("strong", "", snapshot.assignment.code),
   node("p", "muted", snapshot.assignment.floor ? `Floor ${snapshot.assignment.floor}` : "Parking floor not recorded"));
  parking.replaceChildren(title, assigned,
   node("p", "field-note", "Create-only assignment. Checkout releases the linked stay occupancy."));
  parking.setAttribute("aria-busy", "false");
  return;
 }
 if (snapshot.candidates.length === 0) {
  parking.replaceChildren(title,
   node("p", "vehicle-parking-empty", "No currently available parking space is configured for this stay."),
   node("p", "field-note", "Refresh after parking inventory or occupancy changes."));
  parking.setAttribute("aria-busy", "false");
  return;
 }
 const form = node("div", "vehicle-parking-form");
 const label = node("label", "", "Available parking space");
 const select = el("select");
 select.className = "vehicle-parking-select";
 select.setAttribute("aria-label", "Available parking space");
 for (const candidate of snapshot.candidates) {
  const option = el("option");
  option.value = candidate.parkingSpaceId;
  option.textContent = candidate.floor ? `${candidate.code} · floor ${candidate.floor}` : candidate.code;
  select.append(option);
 }
 label.append(select);
 const button = node("button", "vehicle-parking-assign", "Assign parking");
 button.type = "button";
 const message = node("p", "vehicle-parking-message", "Selection is rechecked against PostgreSQL before assignment.");
 message.tabIndex = -1;
 message.setAttribute("role", "status");
 button.addEventListener("click", () => void assignVehicleParking(origin, panel, snapshot, select, button, message));
 form.append(label, button);
 parking.replaceChildren(title, form, message,
  node("p", "field-note", "Assignment is create-only; replacement and manual release are not inferred."));
 parking.setAttribute("aria-busy", "false");
 }
 async function loadVehicleParking(origin, panel) {
 const parking = panel.querySelector(".vehicle-parking-assignment");
 if (!parking || !vehicleDetailRequestIsCurrent(origin, panel)) return;
 parking.setAttribute("aria-busy", "true");
 try {
  const snapshot = vehicleParkingSnapshotResult(await request(
   `/api/v1/properties/${enc(origin.property)}/vehicles/${enc(origin.vehicleId)}/parking`), origin);
  if (!vehicleDetailRequestIsCurrent(origin, panel)) return;
  renderVehicleParking(origin, panel, snapshot);
 } catch (error) {
  if (!vehicleDetailRequestIsCurrent(origin, panel)) return;
  const title = node("h4", "", "Parking assignment");
  title.id = "vehicle-parking-title";
  const message = node("p", "vehicle-parking-message error",
   error?.status === 403 ? "Parking assignment is not granted to this role."
    : error?.status === 404 ? "This vehicle has no exact current assignable stay."
     : error instanceof Error ? error.message : "Parking truth is unavailable.");
  const retry = node("button", "secondary vehicle-parking-retry", "Refresh parking");
  retry.type = "button";
  retry.addEventListener("click", () => void loadVehicleParking(origin, panel));
  parking.replaceChildren(title, message, retry);
  parking.setAttribute("aria-busy", "false");
 }
 }
 async function loadVehicleDetail(vehicleId, { focus = false } = {}) {
 const panel = ensureVehicleDetailPanel();
 const origin = Object.freeze({
  requestGeneration: ++vehicleDetailRequestGeneration,
  property: propertySelect.value,
  vehicleId,
 });
 panel.setAttribute("aria-busy", "true");
 panel.querySelector(".vehicle-detail-loading").hidden = false;
 panel.querySelector(".vehicle-detail-error").hidden = true;
 panel.querySelector(".vehicle-detail-content").hidden = true;
 panel.querySelector(".vehicle-detail-refresh").disabled = true;
 try {
  const body = await request(`/api/v1/properties/${enc(origin.property)}/vehicles/${enc(origin.vehicleId)}`);
  if (!vehicleDetailRequestIsCurrent(origin, panel)) return;
  const vehicle = vehicleDetailResult(body, origin);
  if (!vehicleDetailRequestIsCurrent(origin, panel)) return;
  vehicleDetailData = vehicle;
  renderVehicleDetail(panel, vehicle, origin);
  void loadVehicleParking(origin, panel);
  vehicleResultSummary.textContent = `Exact vehicle ${vehicle.registration} loaded from server truth.`;
  if (focus) panel.querySelector(".vehicle-detail-title").focus({ preventScroll: true });
 } catch (error) {
  if (!vehicleDetailRequestIsCurrent(origin, panel)) return;
  vehicleDetailData = null;
  panel.querySelector(".vehicle-detail-loading").hidden = true;
  panel.querySelector(".vehicle-detail-error").hidden = false;
  panel.querySelector(".vehicle-detail-error p").textContent = error?.status === 404
   ? "This vehicle was not found in the current property."
   : error?.status === 409 ? "Stored vehicle associations are inconsistent; no detail was disclosed."
    : error instanceof Error ? error.message : "The vehicle detail is unavailable.";
  panel.setAttribute("aria-busy", "false");
  vehicleResultSummary.textContent = "No vehicle-detail conclusion was made. Retry this read-only request.";
  if (focus) panel.querySelector(".vehicle-detail-retry").focus({ preventScroll: true });
 } finally {
  if (vehicleDetailRequestIsCurrent(origin, panel)) panel.querySelector(".vehicle-detail-refresh").disabled = false;
 }
 }
 function openVehicleDetail(vehicleId, { push = true, trigger = null, focus = true } = {}) {
 if (!canonicalUuid(vehicleId) || !propertySelect.value) return;
 const panel = ensureVehicleDetailPanel();
 const returnPath = canonicalVehiclePath(propertySelect.value, vehicleRegisterFilter, vehicleRegisterCursor);
 vehicleRouteVehicleId = vehicleId;
 vehicleDetailReturnFocus = trigger || vehicleDetailReturnFocus;
 vehicleDetailReturnPath = push ? returnPath : vehicleReturnPathFromState(history.state, propertySelect.value) || vehicleDetailReturnPath || canonicalVehiclePath(propertySelect.value);
 if (push) history.pushState({ yellowSurface: "vehicle-detail", vehicleReturnPath: returnPath }, "", canonicalVehicleDetailPath(propertySelect.value, vehicleId));
 vehicleRegister.hidden = true;
 panel.hidden = false;
 panel.querySelector(".vehicle-detail-title").focus({ preventScroll: true });
 void loadVehicleDetail(vehicleId, { focus });
 }
 function closeVehicleDetail({ history: updateHistory = true, restoreFocus = true } = {}) {
 const returnFocus = vehicleDetailReturnFocus;
 const returnPath = vehicleDetailReturnPath || canonicalVehiclePath(propertySelect.value);
 vehicleDetailRequestGeneration += 1;
 vehicleDetailData = null;
 vehicleRouteVehicleId = "";
 vehicleDetailReturnFocus = null;
 vehicleDetailReturnPath = "";
 if (vehicleDetailPanel) {
  vehicleDetailPanel.hidden = true;
  vehicleDetailPanel.setAttribute("aria-busy", "false");
 }
 vehicleRegister.hidden = false;
 if (updateHistory && propertySelect.value) {
  if (history.state?.yellowSurface === "vehicle-detail") history.back();
  else history.replaceState({ yellowSurface: "vehicle-register" }, "", returnPath);
 }
 if (restoreFocus) {
  const target = returnFocus?.isConnected ? returnFocus : document.querySelector("#vehicles-title");
  target?.focus({ preventScroll: true });
 }
 }
 function syncVehicleRoute({ focus = false } = {}) {
 const route = vehicleNavigationRoute();
 if (route.kind === "detail" && route.property === propertySelect.value) {
  openVehicleDetail(route.vehicleId, { push: false, focus: true });
  return;
 }
 if (route.kind !== "register" || route.property !== propertySelect.value) return;
 const targetPath = canonicalVehiclePath(route.property, route.registration, route.cursor);
 const wasDetail = vehicleRouteVehicleId !== "";
 const returnFocus = vehicleDetailReturnFocus;
 closeVehicleDetail({ history: false, restoreFocus: false });
 vehicleRegisterFilter = route.registration;
 vehicleRegisterCursor = route.cursor;
 vehicleRegistration.value = route.registration;
 if (vehicleRegisterRenderedPath === targetPath && vehicleRegisterList.childElementCount > 0) {
  vehicleRegister.hidden = false;
  if (focus || wasDetail) (returnFocus?.isConnected ? returnFocus : vehicleResultSummary).focus({ preventScroll: true });
  return;
 }
 void loadVehicleRegister({ cursor: route.cursor, focus: focus || wasDetail });
 }
 function clearVehicleRegisterState() {
 closeVehicleDetail({ history: false, restoreFocus: false });
 vehicleRegisterGeneration += 1;
 vehicleRegisterNextCursor = null;
 vehicleRegisterCursor = "";
 vehicleRegisterFilter = "";
 vehicleRegisterRenderedPath = "";
 vehicleRegisterRows = Object.freeze([]);
 vehicleRegisterList.replaceChildren();
 vehicleRegisterList.hidden = true;
 vehicleRegisterLoading.hidden = true;
 vehicleRegisterError.hidden = true;
 vehicleRegisterEmpty.hidden = true;
 vehicleRegisterNext.hidden = true;
 vehicleRegister.setAttribute("aria-busy", "false");
 }
 function renderVehicleRegister(page, { focus = false, pageOrigin } = {}) {
 vehicleRegisterNextCursor = page.nextCursor;
 vehicleRegisterRenderedPath = canonicalVehiclePath(propertySelect.value, vehicleRegisterFilter, vehicleRegisterCursor);
 vehicleRegisterRows = page.vehicles;
 vehicleRegisterList.replaceChildren(...page.vehicles.map((vehicle) => vehicleCard(vehicle, pageOrigin)));
 vehicleRegisterList.hidden = page.vehicles.length === 0;
 vehicleRegisterEmpty.hidden = page.vehicles.length !== 0;
 vehicleRegisterNext.hidden = page.nextCursor === null;
 const context = vehicleRegisterFilter === "" ? "bounded property register" : `exact registration “${vehicleRegisterFilter}”`;
 vehicleResultSummary.textContent = `${page.vehicles.length} vehicle${page.vehicles.length === 1 ? "" : "s"} shown for the ${context}.${page.nextCursor ? " Another page is available." : " End of this result."}`;
 if (focus) (page.vehicles.length === 0 ? vehicleRegisterEmpty : vehicleResultSummary).focus({ preventScroll: true });
 }
 async function loadVehicleRegister({ cursor = "", focus = false, updateHistory = false } = {}) {
 const property = propertySelect.value;
 if (!property) return;
 const registration = vehicleRegisterFilter;
 vehicleRegisterCursor = cursor;
 const generation = ++vehicleRegisterGeneration;
 const pageOrigin = Object.freeze({
  pageGeneration: generation,
  property,
  registration,
  cursor,
  registerPath: canonicalVehiclePath(property, registration, cursor),
 });
 vehicleRegisterRows = Object.freeze([]);
 vehicleRegister.setAttribute("aria-busy", "true");
 vehicleRegisterLoading.hidden = false;
 vehicleRegisterError.hidden = true;
 vehicleRegisterEmpty.hidden = true;
 vehicleRegisterList.hidden = true;
 vehicleRegisterNext.hidden = true;
 vehiclesRefresh.disabled = true;
 vehicleSearchForm.querySelector("button[type=submit]").disabled = true;
 vehicleResultSummary.textContent = registration === "" ? "Loading one bounded vehicle-register page…" : `Searching for exact registration “${registration}”…`;
 const query = new URLSearchParams({ limit: "25" });
 if (registration !== "") query.set("registration", registration);
 if (cursor !== "") query.set("cursor", cursor);
 if (updateHistory) history.pushState({ yellowSurface: "vehicle-register" }, "", canonicalVehiclePath(property, registration, cursor));
 try {
  const page = vehicleRegisterResult(await request(`/api/v1/properties/${enc(property)}/vehicles?${query}`));
  if (!vehicleRegisterIsCurrent(generation, property, registration, cursor)) return;
  renderVehicleRegister(page, { focus, pageOrigin });
  vehicleRegisterError.hidden = true;
 } catch (error) {
  if (!vehicleRegisterIsCurrent(generation, property, registration, cursor)) return;
  vehicleRegisterNextCursor = null;
  vehicleRegisterRows = Object.freeze([]);
  vehicleRegisterError.hidden = false;
  vehicleRegisterError.querySelector("p").textContent = error instanceof Error ? error.message : "The vehicle register could not be loaded.";
  vehicleResultSummary.textContent = "No vehicle-register conclusion was made. Retry this read-only request.";
  if (focus) vehicleRegisterRetry.focus({ preventScroll: true });
 } finally {
  if (vehicleRegisterIsCurrent(generation, property, registration, cursor)) {
   vehicleRegisterLoading.hidden = true;
   vehicleRegister.setAttribute("aria-busy", "false");
   vehiclesRefresh.disabled = false;
   vehicleSearchForm.querySelector("button[type=submit]").disabled = false;
  }
 }
 }
 function dayCloseRouteDate() {
  const match = location.pathname.match(/^\/p\/([0-9a-f-]+)\/day-close$/);
  if (!match || match[1] !== propertySelect.value) return null;
  const query = new URLSearchParams(location.search);
  const values = query.getAll("date");
  return [...query.keys()].length === 1 && values.length === 1 && /^\d{4}-\d{2}-\d{2}$/.test(values[0])
   ? values[0] : null;
 }
 function dayCloseCanonicalPath(date) {
  return `/p/${propertySelect.value}/day-close${date ? `?date=${enc(date)}` : ""}`;
 }
 function dayCloseLagLabel(lag) {
  if (lag.kind === "none") return "No unpublished events";
  if (lag.kind === "unknown") return `Unknown (${lag.count})`;
  return `${lag.kind === "over_threshold" ? "Over threshold" : "Within threshold"} · ${lag.ageMilliseconds}ms`;
 }
 function renderDayClose(result, focus = false) {
  const selected = result.businessDate;
  dayCloseDate.replaceChildren(...result.openDays.map((day) => {
   const option = node("option", "", `${day.businessDate}${day.isCurrent ? " · current" : ""}`);
   option.value = day.businessDate;
   return option;
  }));
  dayCloseDate.value = selected;
  dayCloseDate.disabled = false;
  dayCloseSelected.textContent = selected;
  dayCloseCurrent.textContent = result.currentOpenBusinessDate;
  dayCloseReady.textContent = result.readiness.ready ? "Ready" : "Blocked";
  dayCloseReady.dataset.state = result.readiness.ready ? "ready" : "blocked";
  dayCloseOutboxLag.textContent = dayCloseLagLabel(result.readiness.outboxLag);
  dayCloseReasons.replaceChildren(...(result.readiness.reasons.length ? result.readiness.reasons.map((reason) =>
   node("li", "", `${reason.source.replaceAll("_", " ")} · ${reason.code.replaceAll("_", " ")} · ${reason.count}`)) :
   [node("li", "list-empty", "No readiness blockers were reported.")]));
  dayCloseCandidates.replaceChildren(...(result.carryCandidates.length ? result.carryCandidates.map((candidate) => {
   const item = node("li", "day-close-candidate", `${candidate.spaceCode} · reported ${candidate.reportedBusinessDate} `);
   const action = node("button", "secondary", "Request carry approval"); action.type = "button";
   action.addEventListener("click", () => {
    dayCloseCarryDraft = { candidate, selected, action }; dayCloseCarryReason.value = ""; dayCloseCarryDialog.showModal(); dayCloseCarryReason.focus();
   }); item.append(action); return item;
  }) :
   [node("li", "list-empty", selected === result.currentOpenBusinessDate ? "The current open day has no carry candidates." : "No safely attributable candidates were returned.")]));
  if (typeof dayCloseSeal !== "undefined") {
   dayCloseSeal.hidden = result.readiness.ready !== true;
   dayCloseSealOpen.disabled = result.readiness.ready !== true;
   if (result.readiness.ready === true) dayCloseSealOpen.dataset.businessDate = selected;
   else delete dayCloseSealOpen.dataset.businessDate;
  }
  dayCloseContent.hidden = false;
  dayCloseError.hidden = true;
  dayCloseStatus.textContent = `Authoritative snapshot captured ${reservationDateTime(result.capturedAt)}. No changes were made.`;
  history.replaceState({ yellowSurface: "day-close" }, "", dayCloseCanonicalPath(selected));
  if (focus) $("#day-close-workbench-title").focus({ preventScroll: true });
  void loadDayCloseCarryApprovals();
 }
 function dayCloseSealIsCurrent(draft) {
  return Boolean(draft && activeView === "day-close" && draft.property === propertySelect.value &&
   draft.businessDate === dayCloseDate.value && draft.generation === dayCloseRequestGeneration);
 }
 function dayCloseSealOutcomeIsAmbiguous(error) {
  return !Number.isInteger(error?.status) || error.status >= 500 || [408, 425, 429].includes(error.status);
 }
 function closeDayCloseSealDialog() {
  if (dayCloseSealDialog.open) dayCloseSealDialog.close();
 }
 if (typeof dayCloseSealOpen !== "undefined") dayCloseSealOpen.addEventListener("click", () => {
  const businessDate = dayCloseSealOpen.dataset.businessDate;
  if (!businessDate || dayCloseSeal.hidden || dayCloseSealOpen.disabled) return;
  dayCloseSealDraft = { property: propertySelect.value, businessDate, generation: dayCloseRequestGeneration, returnFocus: dayCloseSealOpen };
  dayCloseSealDialogDate.textContent = businessDate;
  dayCloseSealDialog.showModal();
  dayCloseSealCancel.focus({ preventScroll: true });
 });
 if (typeof dayCloseSealCancel !== "undefined") dayCloseSealCancel.addEventListener("click", () => {
  const control = dayCloseSealDraft?.returnFocus;
  closeDayCloseSealDialog();
  if (control?.isConnected && !control.hidden) control.focus({ preventScroll: true });
 });
 if (typeof dayCloseSealDialog !== "undefined") dayCloseSealDialog.addEventListener("close", () => {
  const control = dayCloseSealDraft?.returnFocus;
  dayCloseSealDraft = null;
  if (control?.isConnected && !control.hidden) control.focus({ preventScroll: true });
 });
 if (typeof dayCloseSealForm !== "undefined") dayCloseSealForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const draft = dayCloseSealDraft;
  if (!dayCloseSealIsCurrent(draft)) { closeDayCloseSealDialog(); return; }
  const identity = `${draft.property}:${draft.businessDate}`;
  const key = dayCloseSealAttempt?.identity === identity ? dayCloseSealAttempt.key : crypto.randomUUID();
  if (!/^[\x20-\x7e]{8,200}$/.test(key)) throw new Error("The seal retry identity is invalid.");
  dayCloseSealAttempt = { identity, key };
  dayCloseSealConfirm.disabled = true;
  dayCloseSealCancel.disabled = true;
  let status = "Seal outcome is unknown. Authoritative state is being refreshed; retry will use the same identity.";
  try {
   await request(`/api/v1/properties/${enc(draft.property)}/business-days/${enc(draft.businessDate)}/seal`,
    { method: "POST", headers: { "Idempotency-Key": key } });
   dayCloseSealAttempt = null;
   status = `Business day ${draft.businessDate} was sealed. Authoritative open-day state is being refreshed.`;
  } catch (error) {
   if (!dayCloseSealOutcomeIsAmbiguous(error)) dayCloseSealAttempt = null;
   status = dayCloseSealOutcomeIsAmbiguous(error)
    ? "Seal outcome is unknown. Authoritative state is being refreshed; retry will use the same identity."
    : `${error instanceof Error ? error.message : "The business day was not sealed"}. Authoritative state is being refreshed.`;
  } finally {
   const current = dayCloseSealIsCurrent(draft);
   closeDayCloseSealDialog();
   dayCloseSealConfirm.disabled = false;
   dayCloseSealCancel.disabled = false;
   if (current) {
    dayCloseStatus.textContent = status;
    await loadDayCloseWorkbench({ businessDate: draft.businessDate, focus: true, recoverSealed: true, completionStatus: status });
   }
  }
 });
 async function runDayCloseApprovalAction(approval, action, button) {
  const identity = `${action}:${approval.approvalId}`; const key = dayCloseCarryKeys.get(identity) || crypto.randomUUID(); dayCloseCarryKeys.set(identity, key);
  button.disabled = true;
  try { await request(`/api/v1/properties/${enc(propertySelect.value)}/business-days/close-workbench/carry-approvals/${enc(approval.approvalId)}/${action}`,
    { method: "POST", headers: { "idempotency-key": key }, body: "{}" });
    dayCloseCarryKeys.delete(identity); await loadDayCloseWorkbench({ businessDate: dayCloseDate.value, focus: true });
  } catch (error) { dayCloseStatus.textContent = error instanceof Error ? error.message : "Action outcome is unknown; retry uses the same key."; button.disabled = false; button.focus(); }
  finally { button.disabled = false; }
 }
 async function loadDayCloseCarryApprovals() {
  const property = propertySelect.value; const generation = ++dayCloseApprovalGeneration;
  try {
   const page = await request(`/api/v1/properties/${enc(property)}/business-days/close-workbench/carry-approvals`);
   if (generation !== dayCloseApprovalGeneration || activeView !== "day-close" || property !== propertySelect.value) return;
   dayCloseApprovalList.replaceChildren(...(page.approvals.length ? page.approvals.map((approval) => {
    const item = node("li", "day-close-approval", `${approval.roomCode} · ${approval.sourceBusinessDate} → ${approval.targetBusinessDate} · ${approval.status} · ${approval.reason} `);
    for (const action of approval.canDecide ? ["approve", "reject"] : approval.canCarry ? ["carry"] : []) {
     const button = node("button", action === "reject" ? "secondary" : "primary", action[0].toUpperCase() + action.slice(1)); button.type = "button";
     button.addEventListener("click", () => void runDayCloseApprovalAction(approval, action, button)); item.append(button);
    } return item;
   }) : [node("li", "list-empty", "No carry approvals are available.")]));
  } catch (error) { if (generation === dayCloseApprovalGeneration) dayCloseApprovalList.replaceChildren(node("li", "list-empty", error instanceof Error ? error.message : "Approvals are unavailable.")); }
 }
 async function loadDayCloseWorkbench({ businessDate = dayCloseRouteDate(), focus = false, recoverSealed = false, completionStatus = "" } = {}) {
  const property = propertySelect.value;
  if (!property) return;
  const generation = ++dayCloseRequestGeneration;
  dayCloseWorkbench.setAttribute("aria-busy", "true");
  dayCloseLoading.hidden = false;
  dayCloseError.hidden = true;
  dayCloseRefresh.disabled = true;
  dayCloseDate.disabled = true;
  dayCloseSeal.hidden = true;
  dayCloseSealOpen.disabled = true;
  try {
   let selected = businessDate;
   if (!selected) {
    dayCloseDate.replaceChildren();
    dayCloseDate.value = "";
    const entry = await request(`/api/v1/properties/${enc(property)}/business-days/close-workbench`);
    if (generation !== dayCloseRequestGeneration || activeView !== "day-close" || property !== propertySelect.value) return;
    selected = entry.businessDate;
   }
   const result = await request(`/api/v1/properties/${enc(property)}/business-days/${enc(selected)}/close-workbench`);
   if (generation !== dayCloseRequestGeneration || activeView !== "day-close" || property !== propertySelect.value) return;
   renderDayClose(result, focus);
   if (completionStatus) dayCloseStatus.textContent = completionStatus;
  } catch (error) {
   if (generation !== dayCloseRequestGeneration || activeView !== "day-close" || property !== propertySelect.value) return;
   if (recoverSealed && businessDate && error?.status === 404) {
    await loadDayCloseWorkbench({ businessDate: null, focus, completionStatus });
    return;
   }
   dayCloseContent.hidden = true;
   dayCloseError.hidden = false;
   dayCloseError.querySelector("p").textContent = error instanceof Error ? error.message : "No financial conclusion was made.";
   dayCloseStatus.textContent = "Close readiness is unavailable. No changes were made.";
   if (focus) dayCloseRetry.focus({ preventScroll: true });
  } finally {
   if (generation === dayCloseRequestGeneration && activeView === "day-close" && property === propertySelect.value) {
    dayCloseLoading.hidden = true;
    dayCloseWorkbench.setAttribute("aria-busy", "false");
    dayCloseRefresh.disabled = false;
   }
  }
 }
 // function setView remains the boundary after the day-close loader; trust helpers are independent of its snapshot proof.
 function trustCurrencyDigits(currency) {
  if (["BHD", "JOD", "KWD", "OMR", "TND"].includes(currency)) return 3;
  if (currency === "CLF") return 4;
  if (["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF"].includes(currency)) return 0;
  return 2;
 }
 function trustMinorFromDisplay(value, currency) {
  const digits = trustCurrencyDigits(currency), match = String(value).trim().match(/^(?:0|[1-9][0-9]{0,15})(?:\.([0-9]+))?$/);
  if (!match || (match[1]?.length || 0) > digits) throw new Error(`Enter a positive ${currency} amount with no more than ${digits} decimal places.`);
  const [whole, fraction = ""] = String(value).trim().split(".");
  const minor = `${whole}${fraction.padEnd(digits, "0")}`.replace(/^0+(?=\d)/, "");
  if (!/^[1-9][0-9]*$/.test(minor) || BigInt(minor) > 9223372036854775807n) throw new Error("Enter a positive amount within the supported range.");
  return minor;
 }
 function trustMoney(minor, currency) {
  const digits = trustCurrencyDigits(currency), negative = String(minor).startsWith("-"), raw = String(minor).replace(/^-/, "").padStart(digits + 1, "0");
  const major = digits ? `${raw.slice(0, -digits)}.${raw.slice(-digits)}` : raw;
  return `${currency} ${negative ? "-" : ""}${major}`;
 }
 function trustDisplayFromMinor(minor, currency) { return trustMoney(minor, currency).slice(currency.length + 1); }
 function trustDraft() {
  const account = trustAccounts.find((item) => item.accountReference === trustAccount.value);
  if (!account) throw new Error("Choose an authorized owner trust account.");
  const reason = trustReason.value.trim().normalize("NFC");
  const bytes = new TextEncoder().encode(reason).length;
  if (!reason || bytes > 500) throw new Error("Enter a clear business reason of 1–500 UTF-8 bytes.");
  return { account, accountId: account.accountReference, amountMinor: trustMinorFromDisplay(trustAmount.value, account.currency), reason };
 }
 function trustIsCurrent(generation, property, identity = null) {
  if (generation !== trustRequestGeneration || activeView !== "trust" || property !== propertySelect.value) return false;
  if (identity === null) return true;
  try { const draft = trustDraft(); return `${draft.accountId}:${draft.amountMinor}:${draft.reason}` === identity; } catch { return false; }
 }
 function clearTrustPreview(message = "Preview required") {
  trustPreviewData = null;
  trustPreviewTitle.textContent = "No preview yet";
  trustPreviewFacts.replaceChildren(...[
   ["Available before", "—"], ["Expense", "—"], ["Projected available", "—"], ["Governed next step", message],
  ].map(([term, detail]) => { const row = node("div"); row.append(node("dt", "", term), node("dd", "", detail)); return row; }));
  trustRequestApproval.disabled = true; trustPost.disabled = true;
 }
 function renderTrustPreview(result, draft) {
  trustPreviewData = { ...result, identity: `${draft.accountId}:${draft.amountMinor}:${draft.reason}`, reason: draft.reason, canPost: result.canPost === true || (result.approvalRequired !== true && draft.account.canPost === true) };
  trustPreviewTitle.textContent = `${draft.account.accountLabel} · ${result.approvalRequired ? "Approval required" : "Ready to post"}`;
  const next = result.approvalRequired ? "Request a different-user approval" : "Deliberately post this expense";
  trustPreviewFacts.replaceChildren(...[
   ["Available before", trustMoney(result.availableBalanceMinor, result.currency)],
   ["Expense", trustMoney(result.amountMinor, result.currency)],
   ["Projected available", trustMoney(result.projectedBalanceMinor, result.currency)],
   ["Governed next step", next],
  ].map(([term, detail]) => { const row = node("div"); row.append(node("dt", "", term), node("dd", "", detail)); return row; }));
  trustRequestApproval.disabled = result.approvalRequired !== true || draft.account.canPost !== true;
  trustPost.disabled = result.approvalRequired === true || draft.account.canPost !== true;
 }
 function renderTrustInbox() {
  if (!trustApprovals.length) { trustApprovalInbox.replaceChildren(node("p", "muted", "No approval requests are available in this bounded page.")); return; }
  trustApprovalInbox.replaceChildren(...trustApprovals.map((approval) => {
   const row = node("article", "trust-approval-row"); row.dataset.status = approval.status;
   const copy = node("div", "trust-approval-copy");
   copy.append(node("strong", "", `${approval.accountLabel || "Owner trust"} · ${trustMoney(approval.amountMinor, approval.currency)}`), node("span", "approval-state", approval.status), node("p", "", approval.reason));
   const meta = [`Owner ${approval.ownerLabel || "authorized account"}`, `Requested by ${approval.requesterLabel || "operator"}`, new Date(approval.requestedAt).toLocaleString()];
   if (approval.decidedAt) meta.push(`Decided ${new Date(approval.decidedAt).toLocaleString()}`);
   copy.append(node("small", "", meta.join(" · ")));
   const actions = node("div", "trust-approval-actions");
   if (approval.canDecide) for (const action of ["approve", "reject"]) { const button = node("button", action === "approve" ? "secondary" : "quiet", action === "approve" ? "Approve exact request" : "Reject"); button.type = "button"; button.addEventListener("click", () => void decideTrustApproval(approval, action, button)); actions.append(button); }
   if (approval.canPost) { const button = node("button", "primary", "Use approved request"); button.type = "button"; button.addEventListener("click", () => { let account = trustAccounts.find((item) => item.accountReference === approval.accountReference); if (!account) { account = { accountReference:approval.accountReference, accountLabel:approval.accountLabel, ownerLabel:approval.ownerLabel, currency:approval.currency, availableBalanceMinor:approval.availableBalanceMinor, canPost:true }; trustAccounts.push(account); trustAccount.append(new Option(`${account.accountLabel} · ${account.ownerLabel} · ${account.currency}`, account.accountReference)); } trustAccount.value = approval.accountReference; trustAmount.value = trustDisplayFromMinor(approval.amountMinor, approval.currency); trustReason.value = approval.reason; renderTrustPreview({ ...approval, approvalRequired:true }, { account, accountId:approval.accountReference, amountMinor:approval.amountMinor, reason:approval.reason }); trustPreviewData.approvalId = approval.approvalId; trustPost.disabled = false; trustExpenseForm.scrollIntoView({ block: "start" }); trustPost.focus({ preventScroll: true }); }); actions.append(button); }
   row.append(copy, actions); return row;
  }));
 }
 async function loadTrustApprovals({ append = false } = {}) {
  const generation = trustRequestGeneration, property = propertySelect.value, after = append && trustApprovalCursor ? `&after=${enc(trustApprovalCursor)}` : "";
  try { const result = await request(`/api/v1/properties/${enc(property)}/trust/approval-requests?limit=50${after}`); if (!trustIsCurrent(generation, property)) return;
   trustApprovals = append ? [...trustApprovals, ...(result.approvals || []).filter((item) => !trustApprovals.some((old) => old.approvalId === item.approvalId))] : (result.approvals || []); trustApprovalCursor = result.nextCursor || null; trustInboxMore.hidden = !trustApprovalCursor; renderTrustInbox();
  } catch (error) { if (trustIsCurrent(generation, property)) trustApprovalInbox.replaceChildren(node("p", "form-message error", error instanceof Error ? error.message : "Approval inbox unavailable.")); }
 }
 async function loadTrustWorkbench({ focus = false } = {}) {
  const generation = ++trustRequestGeneration, property = propertySelect.value; trustWorkbench.setAttribute("aria-busy", "true"); trustRefresh.disabled = true; trustMessage.classList.remove("error"); clearTrustPreview();
  trustAccount.disabled = true; trustAmount.disabled = true; trustReason.disabled = true; trustPreviewAction.disabled = true; trustMessage.textContent = "Loading authorized owner trust accounts…";
  try { const result = await request(`/api/v1/properties/${enc(property)}/trust/accounts?limit=50`); if (!trustIsCurrent(generation, property)) return;
   trustAccounts = Array.isArray(result.accounts) ? result.accounts : []; trustAccount.replaceChildren(new Option(trustAccounts.length ? "Choose an owner trust account" : "No authorized owner trust accounts", ""), ...trustAccounts.map((account) => new Option(`${account.accountLabel} · ${account.ownerLabel} · ${account.currency}`, account.accountReference)));
   trustAccount.disabled = !trustAccounts.length; trustAmount.disabled = !trustAccounts.length; trustReason.disabled = !trustAccounts.length; trustPreviewAction.disabled = !trustAccounts.length; trustMessage.textContent = trustAccounts.length ? "Choose an account and preview one exact expense." : "No owner trust accounts are available for this property.";
   trustApprovals = []; trustApprovalCursor = null; await loadTrustApprovals(); if (focus) trustAccount.focus({ preventScroll: true });
  } catch (error) { if (trustIsCurrent(generation, property)) { trustAccounts = []; trustMessage.textContent = error instanceof Error ? error.message : "Owner trust workbench unavailable."; trustMessage.classList.add("error"); } }
  finally { if (trustIsCurrent(generation, property)) { trustWorkbench.setAttribute("aria-busy", "false"); trustRefresh.disabled = false; } }
 }
 async function previewTrustExpense(event) {
  event.preventDefault(); let draft; try { draft = trustDraft(); } catch (error) { trustMessage.textContent = error.message; trustMessage.classList.add("error"); return; }
  const generation = ++trustRequestGeneration, property = propertySelect.value, identity = `${draft.accountId}:${draft.amountMinor}:${draft.reason}`; trustPreviewAction.disabled = true; trustMessage.classList.remove("error"); trustMessage.textContent = "Checking authoritative trust availability…";
  try { const result = await request(`/api/v1/properties/${enc(property)}/trust/accounts/${enc(draft.accountId)}/preview`, { method: "POST", body: JSON.stringify({ amountMinor: draft.amountMinor, reason: draft.reason }) }); if (!trustIsCurrent(generation, property, identity)) return; renderTrustPreview(result, draft); trustMessage.textContent = "Authoritative preview loaded. Review it before continuing.";
  } catch (error) { if (trustIsCurrent(generation, property, identity)) { clearTrustPreview("Preview unavailable"); trustMessage.textContent = error instanceof Error ? error.message : "Preview unavailable."; trustMessage.classList.add("error"); } }
  finally { if (trustIsCurrent(generation, property, identity)) trustPreviewAction.disabled = false; }
 }
 async function requestTrustApproval() {
  let draft; try { draft = trustDraft(); } catch (error) { trustMessage.textContent = error.message; return; } const preview = trustPreviewData;
  if (!preview || preview.identity !== `${draft.accountId}:${draft.amountMinor}:${draft.reason}` || preview.approvalRequired !== true) return;
  if (!confirm(`Request a different-user approval for ${trustMoney(draft.amountMinor, draft.account.currency)} from ${draft.account.accountLabel}?`)) { trustRequestApproval.focus({ preventScroll: true }); return; }
  const property = propertySelect.value, generation = trustRequestGeneration, identity = `request:${property}:${preview.identity}`, key = trustMutationKeys.get(identity) || crypto.randomUUID(); trustMutationKeys.set(identity, key); trustRequestApproval.disabled = true;
  try { await request(`/api/v1/properties/${enc(property)}/trust/accounts/${enc(draft.accountId)}/approval-requests`, { method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify({ amountMinor: draft.amountMinor, reason: draft.reason }) }); if (!trustIsCurrent(generation, property, preview.identity)) return; trustMutationKeys.delete(identity); trustMessage.textContent = "Approval requested. A different authorized user may decide it."; await loadTrustWorkbench({ focus: true });
  } catch (error) { if (error?.status) trustMutationKeys.delete(identity); if (trustIsCurrent(generation, property, preview.identity)) { trustMessage.textContent = error instanceof Error ? error.message : "Approval outcome is unknown; retry preserves the exact request identity."; trustMessage.classList.add("error"); trustRequestApproval.disabled = false; trustRequestApproval.focus({ preventScroll: true }); } }
 }
 async function decideTrustApproval(approval, action, button) {
  if (!confirm(`${action === "approve" ? "Approve" : "Reject"} this exact ${trustMoney(approval.amountMinor, approval.currency)} request?`)) { button.focus({ preventScroll: true }); return; }
  const property = propertySelect.value, generation = trustRequestGeneration, identity = `${action}:${property}:${approval.approvalId}`, key = trustMutationKeys.get(identity) || crypto.randomUUID(); trustMutationKeys.set(identity, key); button.disabled = true;
  try { await request(`/api/v1/properties/${enc(property)}/trust/approval-requests/${enc(approval.approvalId)}/${action}`, { method: "POST", headers: { "idempotency-key": key } }); if (!trustIsCurrent(generation, property)) return; trustMutationKeys.delete(identity); await loadTrustWorkbench({ focus: true }); }
  catch (error) { if (error?.status) trustMutationKeys.delete(identity); if (trustIsCurrent(generation, property)) { trustMessage.textContent = error instanceof Error ? error.message : "Decision outcome is unknown; retry preserves its exact identity."; trustMessage.classList.add("error"); button.disabled = false; button.focus({ preventScroll: true }); } }
 }
 async function postTrustExpense() {
  let draft; try { draft = trustDraft(); } catch (error) { trustMessage.textContent = error.message; return; } const preview = trustPreviewData;
  if (!preview || preview.identity !== `${draft.accountId}:${draft.amountMinor}:${draft.reason}` || preview.canPost !== true) return;
  if (!confirm(`Post ${trustMoney(draft.amountMinor, draft.account.currency)} as an immutable owner trust expense? This creates financial records and cannot be deleted.`)) { trustPost.focus({ preventScroll: true }); return; }
  const property = propertySelect.value, generation = trustRequestGeneration, identity = `post:${property}:${preview.identity}:${preview.approvalId || "none"}`, key = trustMutationKeys.get(identity) || crypto.randomUUID(); trustMutationKeys.set(identity, key); trustPost.disabled = true;
  try { await request(`/api/v1/properties/${enc(property)}/trust/accounts/${enc(draft.accountId)}/expenses`, { method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify({ amountMinor: draft.amountMinor, reason: draft.reason, ...(preview.approvalId ? { approvalRequestId: preview.approvalId } : {}) }) }); if (!trustIsCurrent(generation, property, preview.identity)) return; trustMutationKeys.delete(identity); trustAmount.value = ""; trustReason.value = ""; clearTrustPreview("Expense posted"); trustMessage.textContent = "Owner trust expense posted as immutable balanced financial evidence."; await loadTrustWorkbench({ focus: true });
  } catch (error) { if (error?.status) trustMutationKeys.delete(identity); if (trustIsCurrent(generation, property, preview.identity)) { trustMessage.textContent = error instanceof Error ? error.message : "Post outcome is unknown; retry preserves its exact identity."; trustMessage.classList.add("error"); trustPost.disabled = false; trustPost.focus({ preventScroll: true }); } }
 }
  function setView(view, updateHistory = true) {
 const previousView = activeView;
 activeView = ["today", "availability", "inventory", "operations", "housekeeping", "vehicles", "reservations", "folios", "cashiers", "day-close", "trust", "restrictions", "rates", "status"].includes(view) ? view : "today";
 if (document.documentElement.dataset.experience === "simple" && SECONDARY_VIEWS.has(activeView)) {
  closeSecondaryWorkspaces();
 }
 if (previousView === "folios" && activeView !== "folios") {
  clearFolioState();
  if (activeView !== "reservations" || `${location.pathname}${location.search}` !== departureFolioReturn?.originPath) {
   departureFolioReturn = null;
  }
  if (activeView !== "reservations" || `${location.pathname}${location.search}` !== reservationFolioReturn?.originPath) {
   reservationFolioReturn = null;
  }
 }
 if (previousView === "today" && activeView !== "today") todayGeneration += 1;
  if (previousView === "housekeeping" && activeView !== "housekeeping") {
   clearHousekeepingConditionInitialization();
   clearArrivalRoomCleaningTask();
   clearHousekeepingSheetReceipt();
  closeHousekeepingTaskDetail({ history: false, restoreFocus: false });
  housekeepingGeneration += 1;
  housekeepingRequestGeneration += 1;
  housekeepingConditionGeneration += 1;
   housekeepingConditionRequestGeneration += 1;
   clearHousekeepingDiscrepancyState();
  housekeepingSheetGeneration += 1;
  housekeepingSheetRequestGeneration += 1;
  if (activeView !== "reservations" || `${location.pathname}${location.search}` !== checkInHousekeepingReturn?.originPath) {
   checkInHousekeepingReturn = null;
  }
  if (activeView !== "reservations" || `${location.pathname}${location.search}` !== checkoutHousekeepingReturn?.originPath) {
   checkoutHousekeepingReturn = null;
  }
  if (housekeepingArrivalReturnAction) housekeepingArrivalReturnAction.hidden = true;
  clearCheckoutHousekeepingReturnControl();
 }
 if (previousView === "vehicles" && activeView !== "vehicles") {
  vehicleRegisterGeneration += 1;
  vehicleDetailRequestGeneration += 1;
 }
 if (previousView === "trust" && activeView !== "trust") { trustRequestGeneration += 1; clearTrustPreview(); }
 todayView.hidden = activeView !== "today";
 housekeepingView.hidden = activeView !== "housekeeping";
 vehiclesView.hidden = activeView !== "vehicles";
 availabilityView.hidden = activeView !== "availability";
 inventoryView.hidden = activeView !== "inventory";
 restrictionsView.hidden = activeView !== "restrictions";
 ratesView.hidden = activeView !== "rates";
 operationsView.hidden = activeView !== "operations";
 reservationsView.hidden = activeView !== "reservations";
 foliosView.hidden = activeView !== "folios";
 cashiersView.hidden = activeView !== "cashiers";
 dayCloseView.hidden = activeView !== "day-close";
 trustView.hidden = activeView !== "trust";
 statusView.hidden = activeView !== "status";
 workbenchTitle.textContent = activeView === "today" ? "Today" : activeView === "inventory" ? "Inventory setup" :
  activeView === "operations" ? "Room outages" : activeView === "housekeeping" ? "Housekeeping" : activeView === "vehicles" ? "Vehicle Register" : activeView === "reservations" ? "Reservations" : activeView === "folios" ? "Folios" : activeView === "cashiers" ? "Cashiers" : activeView === "day-close" ? "Business-day close" : activeView === "trust" ? "Owner trust expenses" : activeView === "restrictions" ? "Restrictions" :
  activeView === "rates" ? "Rates" : activeView === "status" ? "Project status" : "Availability";
 for (const tab of navigation) {
  const selected = tab.dataset.view === activeView;
  tab.classList.toggle("is-active", selected);
  tab.setAttribute("aria-current", selected ? "page" : "false");
 }
 if (propertySelect.value && updateHistory) {
  history.pushState(null, "", `/p/${propertySelect.value}/${activeView}`);
  if (activeView === "day-close" && dayCloseDate.value) history.replaceState({ yellowSurface: "day-close" }, "", dayCloseCanonicalPath(dayCloseDate.value));
 }
 if (activeView === "inventory") void loadInventory();
 if (activeView === "today") loadToday();
 if (activeView === "availability") {
  void loadActiveHolds();
  void loadOfflineLeases();
 }
 if (activeView === "operations") void loadOperationalBlocks();
 if (activeView === "housekeeping") {
  if (propertySelect.value) {
   const arrivalReturn = syncCheckInHousekeepingContext();
   const checkoutReturn = syncCheckoutHousekeepingContext();
   const route = housekeepingNavigationRoute();
   if (route.kind === "other" || route.property !== propertySelect.value) {
    history.replaceState(null, "", `/p/${propertySelect.value}/housekeeping`);
   }
    if (housekeepingNavigationRoute().kind === "detail") syncHousekeepingRoute();
    else {
     syncHousekeepingRoute();
     housekeepingDiscrepancyWorkbench.hidden = false;
     void loadHousekeepingBoard();
     void loadHousekeepingDiscrepancies();
    void loadHousekeepingConditions().then(() => {
     if (arrivalReturn?.blocker === "room_condition_missing") openHousekeepingConditionInitialization(arrivalReturn);
     else if (arrivalReturn?.blocker === "dirty_room_override_unauthorized") void openArrivalRoomCleaningTask(arrivalReturn);
     else if (arrivalReturn) restoreCheckInHousekeepingRoomFocus(arrivalReturn);
     else if (checkoutReturn) restoreCheckoutHousekeepingRoomFocus(checkoutReturn);
    });
    if (housekeepingSheetDate.value) {
     if (housekeepingSheetAttendant) void previewHousekeepingSheet();
     else void loadHousekeepingSheetHistory();
    }
   }
  }
 }
 if (activeView === "vehicles") {
  const route = vehicleNavigationRoute();
  if (route.kind === "other" || route.property !== propertySelect.value) {
   history.replaceState({ yellowSurface: "vehicle-register" }, "", canonicalVehiclePath(propertySelect.value));
  }
  if (!vehicleRegisterDeferSync) syncVehicleRoute();
 }
 if (activeView === "restrictions") void loadRestrictions();
 if (activeView === "rates") void loadRates();
 if (activeView === "status") void loadSystemStatus();
 if (activeView === "reservations") {
  syncReservationRoute();
  if (reservationBoardRows.length === 0) void loadReservationBoard();
 }
 if (activeView === "folios") syncFolioRoute();
 if (activeView === "cashiers") void loadCashierSession();
 if (activeView === "day-close") void loadDayCloseWorkbench();
 if (activeView === "trust") void loadTrustWorkbench();
 }
 function finishWorkspaceNavigation(view) {
  if (document.documentElement.dataset.experience === "simple" && SECONDARY_VIEWS.has(view)) closeSecondaryWorkspaces();
  const heading = document.getElementById(`${view}-title`);
  requestAnimationFrame(() => {
   if (activeView !== view || !heading || heading.closest("section")?.hidden) return;
   if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
   heading.focus({ preventScroll: true });
   heading.scrollIntoView({ block: "start" });
  });
 }
  function formMessage(form, message, isError = false) {
 const target = form.querySelector(".form-message");
 target.textContent = message;
 target.classList.toggle("error", isError);
 }
  function canonicalShare(value) {
 return /^(?:0\.(?:0[1-9]|[1-9]\d)|[1-9]\d?\.\d{2}|100\.00)$/.test(value) ? value : null;
 }
  function shareBasisPoints(value) {
 const canonical = canonicalShare(value);
 if (canonical === null) return null;
 const [whole, fraction] = canonical.split(".");
 return BigInt(whole) * 100n + BigInt(fraction);
 }
  function formatBasisPoints(value) {
 return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
 }
  function updateReservationShareTotal() {
 const rows = [...reservationGuestList.querySelectorAll(".reservation-guest-row")];
 const sharers = rows.filter((row) => row.querySelector("select").value === "sharer");
 for (const row of rows) {
  const share = row.querySelector('input[name="sharePct"]');
  const isSharer = row.querySelector("select").value === "sharer";
  share.disabled = !isSharer;
  share.required = isSharer;
  if (!isSharer) share.value = "";
 }
 reservationPrimaryShare.required = sharers.length > 0;
 reservationPrimaryShare.disabled = sharers.length === 0;
 if (sharers.length === 0) {
  reservationPrimaryShare.value = "";
  reservationShareTotal.textContent = "No sharers · primary share must stay empty.";
  return;
 }
 const values = [reservationPrimaryShare.value, ...sharers.map((row) => row.querySelector('input[name="sharePct"]').value)];
 const basisPoints = values.map(shareBasisPoints);
 const valid = basisPoints.every((value) => value !== null);
 const total = valid ? basisPoints.reduce((sum, value) => sum + value, 0n) : null;
 reservationShareTotal.textContent = total === null
  ? "Enter every share with exactly two decimal places."
  : `Current total: ${formatBasisPoints(total)}%${total === 10000n ? " · ready" : " · must equal 100.00%"}`;
 }
  function addReservationGuestRow(guest = { partyId: "", role: "accompanying", sharePct: null }) {
 const row = node("div", "reservation-guest-row");
 const partyLabel = node("label", "", "Party ID");
 const party = el("input");
 party.name = "partyId";
 party.required = true;
 party.pattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
 party.value = guest.partyId;
 partyLabel.append(party);
 const roleLabel = node("label", "", "Role");
 const role = el("select");
 role.name = "role";
 for (const value of ["accompanying", "sharer"]) {
  const option = el("option");
  option.value = value;
  option.textContent = value === "sharer" ? "Sharer" : "Accompanying";
  role.append(option);
 }
 role.value = guest.role;
 roleLabel.append(role);
 const shareLabel = node("label", "", "Share (%)");
 const share = el("input");
 share.name = "sharePct";
 share.inputMode = "decimal";
 share.pattern = "(?:0\\.(?:0[1-9]|[1-9][0-9])|[1-9][0-9]?\\.[0-9]{2}|100\\.00)";
 share.placeholder = "40.00";
 share.value = guest.sharePct ?? "";
 shareLabel.append(share);
 const remove = el("button");
 remove.type = "button";
 remove.className = "quiet remove-row";
 remove.textContent = "Remove";
 remove.setAttribute("aria-label", `Remove guest ${guest.partyId || "row"}`);
 remove.addEventListener("click", () => {
  const focusTarget = row.nextElementSibling?.querySelector('input[name="partyId"]') ??
  row.previousElementSibling?.querySelector('input[name="partyId"]') ?? addReservationGuest;
  row.remove();
  updateReservationShareTotal();
  focusTarget.focus();
    });
    role.addEventListener("change", updateReservationShareTotal);
 share.addEventListener("input", updateReservationShareTotal);
 row.append(partyLabel, roleLabel, shareLabel, remove);
 reservationGuestList.append(row);
 updateReservationShareTotal();
 if (!guest.partyId) party.focus();
 }
  function renderReservationGuests(reservation, focus = false) {
 reservationGuestData = reservation;
 reservationConfirmation.textContent = reservation.confirmationNo;
 reservationStatus.textContent = reservation.status.replaceAll("_", " ");
 reservationPrimaryParty.value = reservation.primaryPartyId;
 const primary = reservation.guests.find((guest) => guest.role === "primary");
 reservationPrimaryShare.value = primary?.sharePct ?? "";
 reservationGuestList.replaceChildren();
 for (const guest of reservation.guests) {
  if (guest.role !== "primary") addReservationGuestRow(guest);
 }
 reservationGuestForm.hidden = false;
 updateReservationShareTotal();
 if (focus) {
  reservationGuestForm.tabIndex = -1;
  reservationGuestForm.focus({ preventScroll: true });
 }
 }
  function reservationGuestDetailRequestIsCurrent(origin) {
 return origin.requestGeneration === reservationGuestRequestGeneration
  && origin.detailGeneration === reservationDetailGeneration
  && origin.property === propertySelect.value
  && origin.reservationId === reservationRouteReservationId
  && reservationDetailData?.reservation?.reservationId === origin.reservationId
  && reservationDetailData.reservation.confirmationNo === origin.confirmationNo
  && reservationDetailDrawer.hidden === false
  && reservationGuestForm.parentElement?.classList.contains("reservation-guest-allocation-panel");
 }
  async function requestReservationGuests(property, confirmationNo) {
 return request(`/api/v1/properties/${enc(property)}/reservation-guests?confirmationNo=${enc(confirmationNo)}`);
 }
  async function openReservationGuestAllocation(reservation = reservationDetailData?.reservation, { focus = true } = {}) {
 const panel = reservationDetailActions.querySelector(".reservation-guest-allocation-panel");
 const action = reservationDetailActions.querySelector(".reservation-guest-allocation-action");
 if (!panel || !action || !reservation || reservationDetailDrawer.hidden
  || reservation.reservationId !== reservationRouteReservationId
  || reservationDetailData?.reservation?.reservationId !== reservation.reservationId
  || reservationDetailData.reservation.confirmationNo !== reservation.confirmationNo) {
  restoreReservationGuestEditorHome();
  return false;
 }
 restoreReservationGuestEditorHome();
 panel.hidden = false;
 panel.append(reservationGuestForm);
 const confirmationNo = reservation.confirmationNo;
 reservationLookupForm.elements.confirmationNo.value = confirmationNo;
 const origin = {
  requestGeneration: ++reservationGuestRequestGeneration,
  detailGeneration: reservationDetailGeneration,
  property: propertySelect.value,
  reservationId: reservation.reservationId,
  confirmationNo,
 };
 reservationDetailStatus.textContent = "Loading authoritative guests and shares…";
 action.textContent = "Guests & shares";
 try {
  const body = await requestReservationGuests(origin.property, confirmationNo);
  if (!reservationGuestDetailRequestIsCurrent(origin)) return false;
  if (body?.reservation?.reservationId !== origin.reservationId
   || body.reservation.confirmationNo !== origin.confirmationNo) {
  throw new Error("Guest allocation did not match the current reservation.");
  }
  renderReservationGuests(body.reservation, focus);
  reservationDetailStatus.textContent = "Guests and shares loaded from authoritative reservation truth.";
  return true;
 } catch (error) {
  if (!reservationGuestDetailRequestIsCurrent(origin)) return false;
  reservationGuestData = null;
  reservationGuestForm.hidden = true;
  reservationDetailStatus.textContent = error instanceof Error ? error.message : "Guests and shares could not be loaded.";
  action.textContent = "Retry guests & shares";
  if (focus) action.focus({ preventScroll: true });
  return false;
 }
 }
  function reservationGuestCommandOrigin() {
 const hosted = reservationGuestForm.parentElement?.classList.contains("reservation-guest-allocation-panel") === true;
 return {
  kind: hosted ? "drawer" : "legacy",
  requestGeneration: reservationGuestRequestGeneration,
  detailGeneration: reservationDetailGeneration,
  property: propertySelect.value,
  reservationId: reservationGuestData?.reservationId || "",
  confirmationNo: reservationGuestData?.confirmationNo || "",
  reservation: reservationGuestData,
 };
 }
  async function refreshReservationDetailAfterGuestCommand(origin, responseReservation) {
 if (origin.kind !== "drawer") {
  renderReservationGuests({ ...origin.reservation, ...responseReservation });
  return true;
 }
 if (!reservationGuestDetailRequestIsCurrent(origin)) return false;
 await loadReservationDetail(origin.reservationId);
 const current = reservationDetailData?.reservation;
 if (propertySelect.value !== origin.property || reservationRouteReservationId !== origin.reservationId
  || reservationDetailDrawer.hidden || reservationDetailError.hidden === false || reservationDetailContent.hidden
  || current?.reservationId !== origin.reservationId
  || current.confirmationNo !== origin.confirmationNo) return false;
 return openReservationGuestAllocation(current, { focus: true });
 }
  async function submitReservationGuestCommand(body) {
 if (!reservationGuestData) return false;
 const origin = reservationGuestCommandOrigin();
 if (origin.kind === "drawer" && !reservationGuestDetailRequestIsCurrent(origin)) return false;
 const identity = `reservation-guests:${reservationGuestData.reservationId}:${JSON.stringify(body)}`;
 const key = pendingKeys.get(identity) || crypto.randomUUID();
 pendingKeys.set(identity, key);
 const button = reservationGuestForm.querySelector("button[type=submit]");
 button.disabled = true;
 formMessage(reservationGuestForm, "Saving through the audited reservation command…");
 try {
  const response = await request(`/api/v1/properties/${enc(origin.property)}/reservations/${enc(reservationGuestData.reservationId)}/guests`, {
  method: "PUT",
  headers: { "idempotency-key": key },
  body: JSON.stringify(body),
  });
  pendingKeys.delete(identity);
  const refreshed = await refreshReservationDetailAfterGuestCommand(origin, response.reservation);
  if (origin.kind === "drawer" && !refreshed) return true;
  formMessage(reservationGuestForm, response.reservation.changed
  ? "Guest allocation saved with its audit fact and event."
  : "Allocation already matched server truth; no evidence was invented.");
  return true;
 } catch (error) {
  if (origin.kind === "drawer" && !reservationGuestDetailRequestIsCurrent(origin)) return false;
  formMessage(reservationGuestForm, error instanceof Error ? error.message : "Guest allocation could not be saved", true);
  return false;
 } finally {
  button.disabled = false;
 }
 }
  function reservationTravelTuple(item, direction) {
 if (!item || item.direction !== direction) return null;
 return Object.freeze({
  mode: item.mode ?? null,
  carrier: item.carrier ?? null,
  serviceNo: item.serviceNo ?? null,
  scheduledAt: item.scheduledAt ?? null,
  pickupRequested: direction === "arrival" && item.pickupRequested === true,
 });
 }
  function reservationTravelDirectionItem(direction) {
 return reservationTravelData?.travel.find((item) => item.direction === direction) || null;
 }
  function renderReservationTravelDirection({ focus = false } = {}) {
 if (!reservationTravelData) return false;
 const direction = reservationTravelDirection.value === "departure" ? "departure" : "arrival";
 const tuple = reservationTravelTuple(reservationTravelDirectionItem(direction), direction);
 const fields = reservationTravelForm.elements;
 formMessage(reservationTravelForm, "");
 fields.mode.value = tuple?.mode || "";
 fields.carrier.value = tuple?.carrier || "";
 fields.serviceNo.value = tuple?.serviceNo || "";
 fields.scheduledAt.value = tuple?.scheduledAt ? utcInstantInputValue(tuple.scheduledAt) : "";
 fields.pickupRequested.checked = tuple?.pickupRequested === true;
 const arrival = direction === "arrival";
 reservationTravelFieldsLegend.textContent = arrival ? "Arrival details" : "Departure details";
 reservationTravelPickup.hidden = !arrival;
 reservationTravelBoundary.hidden = !arrival;
 fields.pickupRequested.disabled = !arrival;
 reservationTravelSummary.textContent = tuple
  ? `${arrival ? "Arrival" : "Departure"} truth loaded. Saving replaces only this exact recorded tuple.`
  : `No ${direction} leg is recorded. Saving creates one without task, vehicle or parking effects.`;
 reservationTravelForm.hidden = false;
 if (focus) {
  const heading = reservationTravelForm.parentElement?.querySelector("#reservation-travel-heading");
  if (heading) heading.focus({ preventScroll: true });
  else reservationTravelDirection.focus({ preventScroll: true });
 }
 return true;
 }
  function reservationTravelDetailRequestIsCurrent(origin) {
 return origin.requestGeneration === reservationTravelRequestGeneration
  && origin.detailGeneration === reservationDetailGeneration
  && origin.property === propertySelect.value
  && origin.reservationId === reservationRouteReservationId
  && location.pathname === `/p/${origin.property}/res/${origin.reservationId}`
  && reservationDetailData?.reservation?.reservationId === origin.reservationId
  && reservationDetailData.reservation.confirmationNo === origin.confirmationNo
  && reservationDetailDrawer.hidden === false
  && reservationTravelForm.parentElement?.classList.contains("reservation-travel-panel");
 }
  async function openReservationTravelEditor(reservation = reservationDetailData?.reservation, { focus = true } = {}) {
 const panel = reservationDetailActions.querySelector(".reservation-travel-panel");
 const action = reservationDetailActions.querySelector(".reservation-travel-action");
 if (!panel || !action || !reservation || reservationDetailDrawer.hidden
  || reservation.reservationId !== reservationRouteReservationId
  || reservationDetailData?.reservation?.reservationId !== reservation.reservationId
  || reservationDetailData.reservation.confirmationNo !== reservation.confirmationNo) {
  restoreReservationTravelEditorHome();
  return false;
 }
 restoreReservationTravelEditorHome();
 panel.hidden = false;
 panel.append(reservationTravelForm);
 reservationTravelData = Object.freeze({
  reservationId: reservation.reservationId,
  confirmationNo: reservation.confirmationNo,
  status: reservation.status,
  travel: Object.freeze(Array.isArray(reservation.travel) ? [...reservation.travel] : []),
 });
 reservationTravelDirection.value = reservationTravelData.travel.some(({ direction }) => direction === "arrival")
  ? "arrival"
  : reservationTravelData.travel.some(({ direction }) => direction === "departure") ? "departure" : "arrival";
 const origin = {
  requestGeneration: ++reservationTravelRequestGeneration,
  detailGeneration: reservationDetailGeneration,
  property: propertySelect.value,
  reservationId: reservation.reservationId,
  confirmationNo: reservation.confirmationNo,
 };
 if (!reservationTravelDetailRequestIsCurrent(origin)) return false;
 reservationTravelConfirmation.textContent = reservation.confirmationNo;
 reservationTravelStatus.textContent = String(reservation.status).replaceAll("_", " ");
 action.textContent = "Travel details";
 reservationDetailStatus.textContent = "Travel editor loaded from authoritative reservation detail.";
 return renderReservationTravelDirection({ focus });
 }
  function reservationTravelCommandOrigin() {
 return {
  requestGeneration: reservationTravelRequestGeneration,
  detailGeneration: reservationDetailGeneration,
  property: propertySelect.value,
  reservationId: reservationTravelData?.reservationId || "",
  confirmationNo: reservationTravelData?.confirmationNo || "",
 };
 }
  function desiredReservationTravel(direction) {
 const fields = reservationTravelForm.elements;
 const scheduledValue = String(fields.scheduledAt.value || "");
 const loaded = reservationTravelTuple(reservationTravelDirectionItem(direction), direction);
 let scheduledAt = null;
 if (scheduledValue) {
  if (loaded?.scheduledAt && scheduledValue === utcInstantInputValue(loaded.scheduledAt)) {
  scheduledAt = loaded.scheduledAt;
  } else {
  const instant = new Date(`${scheduledValue}Z`);
  if (!Number.isFinite(instant.getTime())) throw new Error("Scheduled date and time must be a valid UTC instant.");
  scheduledAt = instant.toISOString();
  }
 }
 const travel = {
  mode: fields.mode.value || null,
  carrier: fields.carrier.value.trim() || null,
  serviceNo: fields.serviceNo.value.trim() || null,
  scheduledAt,
  pickupRequested: direction === "arrival" && fields.pickupRequested.checked,
 };
 if (travel.mode === null && travel.carrier === null && travel.serviceNo === null
  && travel.scheduledAt === null && travel.pickupRequested === false) {
  throw new Error("Record at least one travel value; empty travel and deletion are not available.");
 }
 return travel;
 }
  async function refreshReservationDetailAfterTravelCommand(origin) {
 if (!reservationTravelDetailRequestIsCurrent(origin)) return false;
 await loadReservationDetail(origin.reservationId);
 const current = reservationDetailData?.reservation;
 if (propertySelect.value !== origin.property || reservationRouteReservationId !== origin.reservationId
  || reservationDetailDrawer.hidden || reservationDetailError.hidden === false || reservationDetailContent.hidden
  || current?.reservationId !== origin.reservationId || current.confirmationNo !== origin.confirmationNo) return false;
 return openReservationTravelEditor(current, { focus: true });
 }
  async function submitReservationTravelCommand() {
 if (!reservationTravelData) return false;
 const origin = reservationTravelCommandOrigin();
 if (!reservationTravelDetailRequestIsCurrent(origin)) return false;
 const direction = reservationTravelDirection.value === "departure" ? "departure" : "arrival";
 let travel;
 try {
  travel = desiredReservationTravel(direction);
 } catch (error) {
  formMessage(reservationTravelForm, error instanceof Error ? error.message : "Travel details are invalid.", true);
  reservationTravelForm.elements.mode.focus({ preventScroll: true });
  return false;
 }
 const expected = reservationTravelTuple(reservationTravelDirectionItem(direction), direction);
 const body = { expected, travel };
 const identity = `reservation-travel:${origin.reservationId}:${direction}:${JSON.stringify(body)}`;
 const key = pendingKeys.get(identity) || crypto.randomUUID();
 pendingKeys.set(identity, key);
 const button = reservationTravelForm.querySelector("button[type=submit]");
 button.disabled = true;
 reservationTravelForm.setAttribute("aria-busy", "true");
 formMessage(reservationTravelForm, `Saving exact ${direction} truth through the audited reservation command…`);
 try {
  await request(`/api/v1/properties/${enc(origin.property)}/reservations/${enc(origin.reservationId)}/travel/${enc(direction)}`, {
  method: "PUT",
  headers: { "idempotency-key": key },
  body: JSON.stringify(body),
  });
  pendingKeys.delete(identity);
  const refreshed = await refreshReservationDetailAfterTravelCommand(origin);
  if (!refreshed) return true;
  formMessage(reservationTravelForm, `${direction === "arrival" ? "Arrival" : "Departure"} travel saved and refreshed from authoritative truth.`);
  return true;
 } catch (error) {
  if (!reservationTravelDetailRequestIsCurrent(origin)) return false;
  formMessage(reservationTravelForm, error instanceof Error ? error.message : "Travel details could not be saved.", true);
  reservationTravelForm.querySelector(".form-message").focus?.({ preventScroll: true });
  return false;
 } finally {
  if (reservationTravelDetailRequestIsCurrent(origin)) {
  button.disabled = false;
  reservationTravelForm.setAttribute("aria-busy", "false");
  }
 }
 }
  function lifecycleFieldValue(value) {
 return value === null ? "" : value;
 }
  function renderReservationSegments(reservation, focus = false) {
 reservationSegmentData = reservation;
 segmentConfirmation.textContent = reservation.confirmationNo;
 segmentReservationStatus.textContent = reservation.status.replaceAll("_", " ");
 reservationSegmentHistory.replaceChildren(...reservation.segments.map((segment) => {
  const item = el("li");
  const title = node("strong", "", `Segment ${segment.sequence} · ${segment.status.replaceAll("_", " ")}`);
  const period = node("span", "segment-meta", `${segment.period.from} → ${segment.period.to}`);
  const assignment = node("span", "segment-meta");
  assignment.textContent = segment.sellableUnitId
  ? `Sellable ${segment.sellableUnitId} · unit type ${segment.unitTypeId}`
  : `Unassigned · unit type ${segment.unitTypeId}`;
  item.append(title, period, assignment);
  return item;
 }));
 const latest = reservation.segments.at(-1);
 reservationDepartureForm.hidden = !latest?.actions.canChangeDeparture;
 reservationRoomMoveForm.hidden = !latest?.actions.canMoveRoom;
 if (latest?.actions.canChangeDeparture) {
  reservationDepartureForm.elements.newDeparture.value = utcInstantInputValue(latest.period.to);
 }
 if (latest?.actions.canMoveRoom) {
  const select = reservationRoomMoveForm.elements.destinationSellableUnitId;
  const destinations = inventoryData.sellableUnits.filter((item) =>
  item.unitTypeId === latest.unitTypeId && item.id !== latest.sellableUnitId
  );
  select.replaceChildren();
  if (destinations.length === 0) {
  const option = el("option");
  option.value = "";
  option.textContent = "No other same-type room is configured";
  select.append(option);
  select.disabled = true;
  } else {
  select.disabled = false;
  for (const destination of destinations) {
   const option = el("option");
   option.value = destination.id;
   option.textContent = `${destination.unitTypeCode} · ${destination.name}`;
   select.append(option);
  }
  }
  reservationRoomMoveForm.querySelector("button[type=submit]").disabled = destinations.length === 0;
 }
 reservationSegmentEditor.hidden = false;
 if (focus) {
  reservationSegmentEditor.tabIndex = -1;
  reservationSegmentEditor.focus();
 }
 }
  function reservationSegmentDetailRequestIsCurrent(origin) {
 return origin.requestGeneration === reservationSegmentRequestGeneration
  && origin.detailGeneration === reservationDetailGeneration
  && origin.property === propertySelect.value
  && origin.reservationId === reservationRouteReservationId
  && reservationDetailData?.reservation?.reservationId === origin.reservationId
  && reservationDetailData.reservation.confirmationNo === origin.confirmationNo
  && reservationDetailDrawer.hidden === false
  && reservationSegmentEditor.parentElement?.classList.contains("reservation-stay-changes-panel");
 }
  async function requestReservationSegments(property, confirmationNo) {
 return request(`/api/v1/properties/${enc(property)}/reservation-segments?confirmationNo=${enc(confirmationNo)}`);
 }
  async function openReservationStayChanges(reservation = reservationDetailData?.reservation, { focus = true } = {}) {
 const panel = reservationDetailActions.querySelector(".reservation-stay-changes-panel");
 const action = reservationDetailActions.querySelector(".reservation-stay-changes-action");
 if (!panel || !action || !reservation || reservationDetailDrawer.hidden
  || reservation.reservationId !== reservationRouteReservationId
  || reservationDetailData?.reservation?.reservationId !== reservation.reservationId
  || reservationDetailData.reservation.confirmationNo !== reservation.confirmationNo) {
  restoreReservationSegmentEditorHome();
  return false;
 }
 restoreReservationSegmentEditorHome();
 panel.hidden = false;
 panel.append(reservationSegmentEditor);
 const confirmationNo = reservation.confirmationNo;
 reservationSegmentLookupForm.elements.confirmationNo.value = confirmationNo;
 const origin = {
  requestGeneration: ++reservationSegmentRequestGeneration,
  detailGeneration: reservationDetailGeneration,
  property: propertySelect.value,
  reservationId: reservation.reservationId,
  confirmationNo,
 };
 reservationDetailStatus.textContent = "Loading authoritative stay changes…";
 action.textContent = "Stay changes";
 try {
  const body = await requestReservationSegments(origin.property, confirmationNo);
  if (!reservationSegmentDetailRequestIsCurrent(origin)) return false;
  if (body?.reservation?.reservationId !== origin.reservationId
   || body.reservation.confirmationNo !== origin.confirmationNo) {
  throw new Error("Segment history did not match the current reservation.");
  }
  renderReservationSegments(body.reservation, focus);
  reservationDetailStatus.textContent = "Stay changes loaded from authoritative segment truth.";
  return true;
 } catch (error) {
  if (!reservationSegmentDetailRequestIsCurrent(origin)) return false;
  reservationSegmentData = null;
  reservationSegmentEditor.hidden = true;
  reservationDetailStatus.textContent = error instanceof Error ? error.message : "Stay changes could not be loaded.";
  action.textContent = "Retry stay changes";
  if (focus) action.focus({ preventScroll: true });
  return false;
 }
 }
  async function loadReservationSegments(focus = false) {
 const confirmationNo = String(new FormData(reservationSegmentLookupForm).get("confirmationNo") || "");
 const body = await requestReservationSegments(propertySelect.value, confirmationNo);
 renderReservationSegments(body.reservation, focus);
 }
  function reservationSegmentCommandOrigin() {
 const hosted = reservationSegmentEditor.parentElement?.classList.contains("reservation-stay-changes-panel") === true;
 return {
  kind: hosted ? "drawer" : "legacy",
  requestGeneration: reservationSegmentRequestGeneration,
  detailGeneration: reservationDetailGeneration,
  property: propertySelect.value,
  reservationId: reservationSegmentData?.reservationId || "",
  confirmationNo: reservationSegmentData?.confirmationNo || "",
 };
 }
  async function refreshReservationDetailAfterSegmentCommand(origin) {
 if (origin.kind !== "drawer") {
  await loadReservationSegments(true);
  return true;
 }
 if (!reservationSegmentDetailRequestIsCurrent(origin)) return false;
 await loadReservationDetail(origin.reservationId);
 const current = reservationDetailData?.reservation;
 if (propertySelect.value !== origin.property || reservationRouteReservationId !== origin.reservationId
  || reservationDetailDrawer.hidden || current?.reservationId !== origin.reservationId
  || current.confirmationNo !== origin.confirmationNo) return false;
 return openReservationStayChanges(current, { focus: true });
 }
  async function submitSegmentCommand(path, method, body, form, successMessage) {
 const latest = reservationSegmentData?.segments.at(-1);
 if (!reservationSegmentData || !latest) return false;
 const origin = reservationSegmentCommandOrigin();
 if (origin.kind === "drawer" && !reservationSegmentDetailRequestIsCurrent(origin)) return false;
 const identity = `reservation-segment:${path}:${reservationSegmentData.reservationId}:${latest.segmentId}:${JSON.stringify(body)}`;
 const key = pendingKeys.get(identity) || crypto.randomUUID();
 pendingKeys.set(identity, key);
 const button = form.querySelector("button[type=submit]");
 button.disabled = true;
 segmentCommandMessage.textContent = "Applying the audited segment command…";
 segmentCommandMessage.classList.remove("error");
 try {
  await request(`/api/v1/properties/${enc(origin.property)}/reservations/${enc(reservationSegmentData.reservationId)}/segments/${enc(latest.segmentId)}${path}`, {
  method,
  headers: { "idempotency-key": key },
  body: JSON.stringify(body),
  });
  pendingKeys.delete(identity);
  const refreshed = await refreshReservationDetailAfterSegmentCommand(origin);
  if (origin.kind === "drawer" && !refreshed) return true;
  segmentCommandMessage.textContent = successMessage;
  segmentCommandMessage.classList.remove("error");
  return true;
 } catch (error) {
  if (origin.kind === "drawer" && !reservationSegmentDetailRequestIsCurrent(origin)) return false;
  segmentCommandMessage.textContent = error instanceof Error ? error.message : "Reservation segment command failed";
  segmentCommandMessage.classList.add("error");
  return false;
 } finally {
  button.disabled = form === reservationRoomMoveForm
  ? form.elements.destinationSellableUnitId.disabled
  : false;
 }
 }
  function renderReservationLifecycle(reservation, focus = false) {
 reservationLifecycleData = reservation;
 lifecycleConfirmation.textContent = reservation.confirmationNo;
 lifecycleStatus.textContent = reservation.status.replaceAll("_", " ");
 for (const name of ["notes", "eta", "etd", "marketCode", "sourceCode", "originCode"]) {
  reservationMetadataForm.elements[name].value = lifecycleFieldValue(reservation.fields[name]);
 }
 reservationMetadataForm.hidden = !reservation.actions.canModify;
 reservationCancelForm.hidden = !reservation.actions.canCancel;
 reservationReinstatePanel.hidden = !reservation.actions.canReinstate;
 reservationLifecycleEditor.hidden = false;
 if (focus) {
  reservationLifecycleEditor.tabIndex = -1;
  reservationLifecycleEditor.focus();
 }
 }
  async function loadReservationLifecycle(focus = false) {
 const confirmationNo = String(new FormData(reservationLifecycleLookupForm).get("confirmationNo") || "");
 const body = await request(`/api/v1/properties/${enc(propertySelect.value)}/reservations?confirmationNo=${enc(confirmationNo)}`);
 renderReservationLifecycle(body.reservation, focus);
 }
  function reservationLifecycleCommand(action) {
 if (action === "modify") return { path: "", method: "PATCH" };
 if (action === "cancel") return { path: "/cancel", method: "POST" };
 if (action === "reinstate") return { path: "/reinstate", method: "POST" };
 return null;
 }
  function reservationLifecycleRefreshDecision(origin, current) {
 if (origin.kind === "drawer") {
  return origin.routeReservationId === origin.reservationId &&
  current.drawerHidden === false && current.property === origin.property &&
  current.routeReservationId === origin.reservationId &&
  current.detailGeneration === origin.detailGeneration ? "uuid" : "suppress";
 }
 return current.property === origin.property ? "legacy" : "suppress";
 }
  function dispatchReservationLifecycleRefresh(decision, reservationId, refreshUuid, refreshLegacy) {
 if (decision === "uuid") return refreshUuid(reservationId);
 if (decision === "legacy") return refreshLegacy();
 return undefined;
 }
  async function submitLifecycleCommand(path, method, body, form, successMessage) {
 if (!reservationLifecycleData) return false;
 const reservationId = reservationLifecycleData.reservationId;
 const origin = {
  kind: reservationLifecycleEditor.parentElement === reservationDetailActions ? "drawer" : "legacy",
  property: propertySelect.value,
  reservationId,
  routeReservationId: reservationRouteReservationId,
  detailGeneration: reservationDetailGeneration,
 };
 const identity = `reservation-lifecycle:${path}:${reservationId}:${JSON.stringify(body)}`;
 const key = pendingKeys.get(identity) || crypto.randomUUID();
 pendingKeys.set(identity, key);
 const button = form.querySelector("button") ?? reservationReinstate;
 button.disabled = true;
 lifecycleCommandMessage.textContent = "Applying the audited reservation command…";
 lifecycleCommandMessage.classList.remove("error");
 try {
  await request(`/api/v1/properties/${encodeURIComponent(origin.property)}/reservations/${enc(reservationId)}${path}`, {
  method, headers: { "idempotency-key": key }, body: JSON.stringify(body),
  });
  pendingKeys.delete(identity);
  const refreshDecision = reservationLifecycleRefreshDecision(origin, {
  property: propertySelect.value,
  routeReservationId: reservationRouteReservationId,
  detailGeneration: reservationDetailGeneration,
  drawerHidden: reservationDetailDrawer.hidden,
  });
  await dispatchReservationLifecycleRefresh(
  refreshDecision,
  reservationId,
  loadReservationDetail,
  () => loadReservationLifecycle(true),
  );
  lifecycleCommandMessage.textContent = successMessage;
  lifecycleCommandMessage.classList.remove("error");
  return true;
 } catch (error) {
  lifecycleCommandMessage.textContent = error instanceof Error ? error.message : "Reservation command failed";
  lifecycleCommandMessage.classList.add("error");
  return false;
 } finally {
  button.disabled = false;
 }
 }
  async function submitInventory(form, route, body) {
 const button = form.querySelector("button[type=submit]");
 const identity = `${route}:${JSON.stringify(body)}`;
 const key = pendingKeys.get(identity) || crypto.randomUUID();
 pendingKeys.set(identity, key);
 button.disabled = true;
 formMessage(form, "Saving through the audited inventory service…");
 try {
  await request(`/api/v1/properties/${enc(propertySelect.value)}/inventory/${route}`, {
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
  await request(`/api/v1/properties/${enc(propertySelect.value)}/restrictions`, {
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
  await request(`/api/v1/properties/${enc(propertySelect.value)}/rate-configuration/${route}`, {
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
 const row = node("div", "pricing-editor-row");
 row.dataset.kind = kind;
 const firstLabel = el("label");
 const firstText = kind === "tier" ? "Adults" : "Maximum child age";
 firstLabel.textContent = firstText;
 const first = el("input");
 first.type = "number";
 first.required = true;
 first.min = kind === "tier" ? "1" : "0";
 first.max = kind === "tier" ? "100" : "17";
 first.step = "1";
 first.value = String(firstValue);
 first.dataset.field = kind === "tier" ? "adults" : "maxAge";
 first.setAttribute("aria-label", `${firstText} row ${pricingRowSequence}`);
 firstLabel.append(first);
 const amountLabel = node("label", "", "Exact minor units");
 const amount = el("input");
 amount.required = true;
 amount.inputMode = "numeric";
 amount.pattern = "0|[1-9][0-9]*";
 amount.value = String(amountValue);
 amount.dataset.field = "amountMinor";
 amount.setAttribute("aria-label", `Exact minor units row ${pricingRowSequence}`);
 amountLabel.append(amount);
 const remove = el("button");
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
  const result = await request(`/api/v1/properties/${enc(propertySelect.value)}/rate-prices`, {
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
 const item = node("li", `cause ${cause.blocks ? "blocking" : "warning"}`);
 const title = node("strong", "", type === "restriction" ? `Restriction · ${cause.kind}` : `${cause.kind.toUpperCase()} · ${cause.blocks ? "blocks sale" : "warning only"}`);
 const detail = el("span");
 detail.textContent = type === "restriction"
  ? (cause.value === null ? "Rule is active" : `Rule value: ${cause.value}`)
  : (cause.reason || "No reason recorded");
 item.append(title, detail);
 return item;
 }
  function renderActiveHolds() {
 activeHoldList.replaceChildren(...activeHoldsData.map((hold) => {
  const item = node("article", "restriction-item");
  const copy = el("div");
  const title = el("strong");
  title.textContent = typeof hold.holder?.reference === "string"
  ? hold.holder.reference
  : "Temporary hold";
  const detail = node("span", "", `${new Date(hold.from).toLocaleString()} → ${new Date(hold.to).toLocaleString()} · expires ${new Date(hold.expiresAt).toLocaleTimeString()}`);
  copy.append(title, detail);
  const release = el("button");
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
  const body = await request(`/api/v1/properties/${enc(property)}/holds`);
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
  await request(`/api/v1/properties/${enc(propertySelect.value)}/holds`, {
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
  await request(`/api/v1/properties/${enc(propertySelect.value)}/holds/${enc(hold.id)}/release`, {
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
  const item = node("article", "restriction-item");
  const copy = el("div");
  const title = el("strong");
  title.textContent = typeof lease.holder?.device_label === "string"
  ? lease.holder.device_label
  : lease.holder?.device_id || "Offline device";
  const detail = node("span", "", `${lease.holder?.device_id || "unknown device"} · ${new Date(lease.from).toLocaleString()} → ${new Date(lease.to).toLocaleString()} · lease expires ${new Date(lease.expiresAt).toLocaleString()}`);
  copy.append(title, detail);
  const release = el("button");
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
  const body = await request(`/api/v1/properties/${enc(property)}/offline-leases`);
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
  await request(`/api/v1/properties/${enc(propertySelect.value)}/offline-leases/${enc(lease.id)}/release`, {
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
 const placeholder = el("option");
 placeholder.value = "";
 placeholder.textContent = choices.length === 0 ? "No bookable option in this search" : "Choose exact searched capacity";
 offlineLeaseSellable.replaceChildren(placeholder);
 for (const option of choices) {
  const choice = el("option");
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
  ratePlanId: offer.rate_plan.id,
  ratePlanName: offer.rate_plan.name,
  currency: offer.rate_plan.currency,
  perNight: offer.per_night,
  total: offer.total,
  stay: offer.stay,
  promise: offer.promise,
  commitArbitrationRequired: offer.commit_arbitration_required,
  evidence: offer.evidence,
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
  function partyContactSummary(contacts) {
 return (Array.isArray(contacts) ? contacts : [])
  .map((contact) => `${contact.kind}: ${contact.hint}`)
  .join(" · ");
 }
  function clearPartyDuplicateReview() {
 partyDuplicateIds = [];
 partyDuplicateCandidates.replaceChildren();
 partyCreateDistinctConfirm.checked = false;
 partyCreateDistinct.disabled = true;
 partyDuplicateReview.hidden = true;
 partyDuplicateMessage.textContent = "";
 partyDuplicateMessage.classList.remove("error");
 }
  function clearPartyProfileState() {
 partyProfileGeneration += 1;
 partyCreateAttemptKey = "";
 partyCreateDraft = null;
 clearPartyDuplicateReview();
 partyProfileSearchForm.reset();
 partyProfileCreateForm.reset();
 partyProfileResults.replaceChildren();
 partyProfileCreate.open = false;
 partyProfilePicker.hidden = false;
 partyProfileSelected.hidden = true;
 partyProfileSelected.querySelector("strong").textContent = "";
 partyProfileSelected.querySelector("small").textContent = "";
 partyProfileClear.hidden = true;
 reservationBookingForm.elements.primaryPartyId.value = "";
 reservationBookingSearchGeneration += 1;
 reservationBookingOffers = [];
 reservationBookingDraft = null;
 reservationBookingOptions.replaceChildren();
 clearReservationBookingSelection();
 }
  function selectPartyProfile(profile, masked = false) {
 partyProfileGeneration += 1;
 const partyId = String(profile.partyId || "");
 reservationBookingForm.elements.primaryPartyId.value = partyId;
 partyProfileSelected.querySelector("strong").textContent = masked
  ? `${profile.displayNameHint || "Masked Party"} · ${partyId}`
  : `${profile.displayName || "Party"} · ${partyId}`;
 const roles = Array.isArray(profile.roles) && profile.roles.length > 0 ? profile.roles.join(", ") : "masked duplicate candidate";
 const contacts = partyContactSummary(profile.contacts);
 partyProfileSelected.querySelector("small").textContent = `${roles}${contacts ? ` · ${contacts}` : " · no contact hint returned"}`;
 partyProfileSearchForm.reset();
 partyProfileCreateForm.reset();
 partyProfileResults.replaceChildren();
 clearPartyDuplicateReview();
 partyCreateAttemptKey = "";
 partyCreateDraft = null;
 partyProfilePicker.hidden = true;
 partyProfileSelected.hidden = false;
 partyProfileClear.hidden = false;
 reservationBookingSearchGeneration += 1;
 reservationBookingOffers = [];
 reservationBookingDraft = null;
 reservationBookingOptions.replaceChildren();
 clearReservationBookingSelection();
 reservationCreateDirty = true;
 partyProfileSelected.focus();
 }
  function partyProfileCard(profile, masked = false) {
 const card = node("article", "party-profile-result");
 const copy = el("div");
 const name = node("strong", "", masked ? profile.displayNameHint : profile.displayName);
 const details = el("span");
 const roles = masked ? (profile.reasons || []).join(", ") : (profile.roles || []).join(", ");
 details.textContent = `${masked ? "Possible match" : profile.kind} · ${roles || "no role detail"} · Party ${profile.partyId}`;
 const contacts = node("small", "", partyContactSummary(profile.contacts) || "No masked contact hint returned");
 copy.append(name, details, contacts);
 const use = el("button");
 use.type = "button";
 use.className = "secondary";
 use.textContent = "Use for reservation";
 use.addEventListener("click", () => selectPartyProfile(profile, masked));
 card.append(copy, use);
 return card;
 }
  function renderPartyProfiles(profiles) {
 partyProfileResults.replaceChildren();
 for (const profile of profiles) partyProfileResults.append(partyProfileCard(profile));
 if (profiles.length === 0) emptyList(partyProfileResults, "No Parties matched. Refine the search or create a new canonical Party.");
 partyProfileResults.tabIndex = -1;
 partyProfileResults.focus();
 }
  function renderPartyDuplicateReview(candidates) {
 partyDuplicateIds = candidates.map(({ partyId }) => partyId).sort();
 partyDuplicateCandidates.replaceChildren();
 for (const candidate of candidates) partyDuplicateCandidates.append(partyProfileCard(candidate, true));
 partyCreateDistinctConfirm.checked = false;
 partyCreateDistinct.disabled = true;
 partyDuplicateMessage.textContent = `${candidates.length} current masked candidate${candidates.length === 1 ? "" : "s"} require review.`;
 partyDuplicateMessage.classList.remove("error");
 partyDuplicateReview.hidden = false;
 partyDuplicateReview.focus();
 }
  async function searchPartyProfiles() {
 const generation = ++partyProfileGeneration;
 const property = propertySelect.value;
 const button = partyProfileSearchForm.querySelector("button[type=submit]");
 button.disabled = true;
 formMessage(partyProfileSearchForm, "Searching canonical Party profiles…");
 partyProfileResults.replaceChildren();
 clearPartyDuplicateReview();
 partyCreateAttemptKey = "";
 partyCreateDraft = null;
 try {
  const query = String(new FormData(partyProfileSearchForm).get("query") || "");
  const result = await request(`/api/v1/properties/${enc(property)}/parties:search`, {
  method: "POST", body: JSON.stringify({ query, limit: 20 }),
  });
  if (generation !== partyProfileGeneration || property !== propertySelect.value) return;
  const profiles = Array.isArray(result.profiles) ? result.profiles : [];
  renderPartyProfiles(profiles);
  formMessage(partyProfileSearchForm, `${profiles.length} Party result${profiles.length === 1 ? "" : "s"}. Choose Use for reservation explicitly.`);
 } catch (error) {
  if (generation !== partyProfileGeneration || property !== propertySelect.value) return;
  formMessage(partyProfileSearchForm, error instanceof Error ? error.message : "Party search failed", true);
 } finally {
  button.disabled = false;
 }
 }
  function partyCreateBody() {
 const fields = new FormData(partyProfileCreateForm);
 const contacts = ["email", "phone", "whatsapp"]
  .map((kind) => ({ kind, value: String(fields.get(kind) || "").trim(), isPrimary: true }))
  .filter(({ value }) => value !== "");
 const legalName = String(fields.get("legalName") || "").trim();
 return {
  kind: String(fields.get("kind") || "person"),
  displayName: String(fields.get("displayName") || ""),
  ...(legalName ? { legalName } : {}),
  roles: fields.getAll("roles").map(String),
  contacts,
  acknowledgedDuplicatePartyIds: [],
 };
 }
  async function createPartyProfile(acknowledgedDuplicatePartyIds = []) {
 if (!partyCreateDraft) return;
 const generation = ++partyProfileGeneration;
 const property = propertySelect.value;
 const button = acknowledgedDuplicatePartyIds.length > 0
  ? partyCreateDistinct
  : partyProfileCreateForm.querySelector("button[type=submit]");
 button.disabled = true;
 formMessage(partyProfileCreateForm, acknowledgedDuplicatePartyIds.length > 0
  ? "Creating a distinct canonical Party after explicit review…"
  : "Checking current duplicate evidence…");
 try {
  const result = await request(`/api/v1/properties/${enc(property)}/parties`, {
  method: "POST",
  headers: { "idempotency-key": partyCreateAttemptKey },
  body: JSON.stringify({ ...partyCreateDraft, acknowledgedDuplicatePartyIds }),
  });
  if (generation !== partyProfileGeneration || property !== propertySelect.value) return;
  selectPartyProfile(result.party);
 } catch (error) {
  if (generation !== partyProfileGeneration || property !== propertySelect.value) return;
  const candidates = error?.problem?.type === "profiles/duplicate_review_required"
  && Array.isArray(error.problem.candidates) ? error.problem.candidates : null;
  if (candidates) {
  renderPartyDuplicateReview(candidates);
  formMessage(partyProfileCreateForm, "Possible duplicates found. No Party was created; review every masked candidate below.", true);
  } else {
  formMessage(partyProfileCreateForm, error instanceof Error ? error.message : "Party could not be created", true);
  }
 } finally {
  button.disabled = false;
  if (button === partyCreateDistinct) button.disabled = !partyCreateDistinctConfirm.checked;
 }
 }
  function clearReservationBookingSelection() {
 reservationBookingSelection = null;
 reservationBookingHold = null;
 reservationBookingCommit.hidden = true;
 reservationBookingHeld.hidden = true;
 reservationBookingDirect.hidden = false;
 reservationBookingHoldAction.hidden = false;
 reservationBookingConfirmation.hidden = true;
 }
  function selectReservationBookingOffer(offer) {
 reservationBookingSelection = offer;
 reservationBookingHold = null;
 reservationBookingSelectionText.textContent = `${offer.sellableUnitName} · ${offer.ratePlanCode} · ${offer.total.currency} ${offer.total.amount_minor} minor units ${offer.total.kind} · promise=false · commit_arbitration_required=true`;
 reservationBookingHoldText.textContent = "No hold. Direct commit will re-arbitrate occupancy.";
 reservationBookingHeld.hidden = true;
 reservationBookingDirect.hidden = false;
 reservationBookingHoldAction.hidden = false;
 reservationBookingMessage.textContent = "Selected from server evidence. Commit remains the inventory promise.";
 reservationBookingMessage.classList.remove("error");
 reservationBookingConfirmation.hidden = true;
 reservationBookingCommit.hidden = false;
 reservationCreateDirty = true;
 setReservationCreateStep(4);
 reservationBookingCommit.tabIndex = -1;
 reservationBookingCommit.focus();
 }
  function renderReservationBookingOffers(options, issues) {
 reservationBookingOffers = options;
 reservationOfferRetry.hidden = true;
 reservationBookingOptions.replaceChildren();
 clearReservationBookingSelection();
 for (const offer of options) {
  const card = node("label", `card booking-offer ${offer.bookable ? "" : "is-blocked"}`);
  const radio = el("input");
  radio.type = "radio";
  radio.name = "reservationBookingOffer";
  radio.disabled = offer.bookable !== true || offer.promise !== false || offer.commitArbitrationRequired !== true || offer.total === null;
  radio.addEventListener("change", () => { if (radio.checked) selectReservationBookingOffer(offer); });
  const copy = node("span", "booking-offer-copy");
  const title = node("strong", "", `${offer.sellableUnitName} · ${offer.unitTypeCode} · ${offer.ratePlanCode}`);
  const truth = el("span");
  truth.textContent = offer.total
  ? `${offer.total.currency} ${offer.total.amount_minor} minor units ${offer.total.kind} · ${offer.availableCount} physically free`
  : `${offer.state}${offer.reason ? ` · ${offer.reason}` : ""} · no price offered`;
  const evidence = node("span", "", `promise=${String(offer.promise)} · commit_arbitration_required=${String(offer.commitArbitrationRequired)} · ${offer.evidence?.availability_ref || "no availability evidence"}`);
  copy.append(title, truth, evidence);
  card.append(radio, copy);
  reservationBookingOptions.append(card);
 }
 for (const issue of issues) {
  const item = node("div", "card booking-offer is-blocked", `${issue.unit_type_code} · ${issue.rate_plan_code} · ${issue.reason}`);
  reservationBookingOptions.append(item);
 }
 if (options.length === 0 && issues.length === 0) emptyList(reservationBookingOptions, "No server offers matched this search.");
 reservationBookingOptions.tabIndex = -1;
 reservationBookingOptions.focus();
 setReservationCreateStep(3);
 }
  function reservationBookingChildAges(value) {
 if (value.trim() === "") return [];
 const ages = value.split(",").map((part) => Number(part.trim()));
 if (ages.length > 30 || ages.some((age) => !Number.isSafeInteger(age) || age < 0 || age > 17)) {
  throw new Error("Child ages must be comma-separated whole numbers from 0 to 17.");
 }
 return ages;
 }
  async function placeReservationBookingHold() {
 if (!reservationBookingSelection || !reservationBookingDraft) return;
 const operationGeneration = reservationBookingSearchGeneration;
 const property = propertySelect.value;
 const body = {
  sellableUnitId: reservationBookingSelection.sellableUnitId,
  from: reservationBookingSelection.stay.from,
  to: reservationBookingSelection.stay.to,
  holderReference: `booking:${reservationBookingDraft.primaryPartyId}`,
 };
 const identity = `reservation-booking-hold:${property}:${JSON.stringify(body)}`;
 const key = pendingKeys.get(identity) || crypto.randomUUID();
 pendingKeys.set(identity, key);
 reservationBookingHoldAction.disabled = true;
 reservationBookingMessage.classList.remove("error");
 reservationBookingMessage.textContent = "Protecting this offer for ten minutes…";
 try {
  const result = await request(`/api/v1/properties/${encodeURIComponent(property)}/holds`, {
  method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify(body),
  });
  pendingKeys.delete(identity);
  if (operationGeneration !== reservationBookingSearchGeneration || property !== propertySelect.value) return;
  reservationBookingHold = result.hold;
  reservationBookingHoldText.textContent = `Temporary hold ${result.hold.id} · expires ${result.hold.expiresAt}. This is not a reservation.`;
  reservationBookingHeld.hidden = false;
  reservationBookingDirect.hidden = true;
  reservationBookingHoldAction.hidden = true;
  reservationBookingMessage.classList.remove("error");
  reservationBookingMessage.textContent = "Temporary protection committed. Complete held reservation before expiry.";
 } catch (error) {
  if (operationGeneration !== reservationBookingSearchGeneration || property !== propertySelect.value) return;
  reservationBookingMessage.textContent = error instanceof Error ? error.message : "Hold could not be placed";
  reservationBookingMessage.classList.add("error");
 } finally {
  reservationBookingHoldAction.disabled = false;
 }
 }
  async function commitReservationBooking(useHold) {
 if (!reservationBookingSelection || !reservationBookingDraft) return;
 const operationGeneration = reservationBookingSearchGeneration;
 const property = propertySelect.value;
 const offer = reservationBookingSelection;
 const body = {
  propertyNode: property,
  primaryPartyId: reservationBookingDraft.primaryPartyId,
  ratePlanId: offer.ratePlanId,
  adults: reservationBookingDraft.adults,
  childAges: reservationBookingDraft.childAges,
  channelCode: reservationBookingDraft.channelCode,
  ...(useHold
  ? { holdId: reservationBookingHold?.id || "" }
  : { direct: { sellableUnitId: offer.sellableUnitId, from: offer.stay.from, to: offer.stay.to } }),
 };
 const identity = `reservation-booking-commit:${JSON.stringify(body)}`;
 const key = pendingKeys.get(identity) || crypto.randomUUID();
 pendingKeys.set(identity, key);
 const button = useHold ? reservationBookingHeld : reservationBookingDirect;
 button.disabled = true;
 reservationBookingMessage.classList.remove("error");
 reservationBookingMessage.textContent = "Committing through authoritative occupancy…";
 try {
  const result = await request("/api/v1/reservations:commit", {
  method: "POST", headers: { "idempotency-key": key }, body: JSON.stringify(body),
  });
  pendingKeys.delete(identity);
  if (operationGeneration !== reservationBookingSearchGeneration || property !== propertySelect.value) return;
  reservationBookingMessage.classList.remove("error");
  reservationBookingMessage.textContent = "Reservation confirmed by the server. Financial and document workflows remain separate.";
  reservationBookingConfirmation.querySelector("strong").textContent = result.reservation.confirmationNo;
  reservationBookingConfirmation.querySelector("small").textContent = `Status ${result.reservation.status} · reservation ${result.reservation.reservationId}`;
  reservationBookingConfirmation.hidden = false;
  reservationBookingConfirmation.focus();
  reservationBookingHold = null;
  reservationBookingSelection = null;
  reservationBookingDirect.hidden = true;
  reservationBookingHeld.hidden = true;
  reservationBookingHoldAction.hidden = true;
  reservationCreateDirty = false;
  void loadReservationBoard();
  const reservationId = result.reservation.reservationId;
  closeReservationCreate({ history: false, force: true });
  history.replaceState(null, "", `/p/${propertySelect.value}/reservations`);
  if (reservationId) {
  void openReservationDetail(reservationId, { trigger: reservationCreateOpen });
  }
 } catch (error) {
  if (operationGeneration !== reservationBookingSearchGeneration || property !== propertySelect.value) return;
  reservationBookingMessage.textContent = error instanceof Error ? error.message : "Reservation could not be committed";
  reservationBookingMessage.classList.add("error");
  if (error?.status === 409) {
  reservationBookingSelection = null;
  reservationBookingHold = null;
  reservationBookingOffers = [];
  clearReservationBookingSelection();
  reservationBookingOptions.replaceChildren();
  emptyList(reservationBookingOptions, "The previous offers are no longer current.");
  reservationOfferRetry.hidden = false;
  reservationBookingMessage.textContent = "Inventory or reservation state changed. Your stay and guest are preserved; search current offers again.";
  formMessage(reservationBookingForm, "Inventory changed. Search current offers again before booking.", true);
  setReservationCreateStep(3);
  }
 } finally {
  button.disabled = false;
 }
 }
  function renderOptions(options, summary) {
 results.replaceChildren();
 populateOfflineSellables(options);
 if (options.length === 0) {
  const empty = node("div", "empty-state", "No active sellable configurations fit this search. Inventory setup may still be required.");
  results.append(empty);
  resultSummary.textContent = "No options returned.";
  return;
 }
 const bookable = options.filter((option) => option.bookable).length;
 resultSummary.textContent = `${options.length} published option${options.length === 1 ? "" : "s"} · ${bookable} bookable · ${summary?.publication_unavailable || 0} awaiting publication`;
 for (const option of options) {
  const card = node("article", `option-card ${option.bookable ? "" : "is-blocked"}`);
  const head = node("div", "option-head");
  const identity = el("div");
  const name = node("h2", "", option.sellableUnitName);
  const code = node("div", "code", `${option.unitTypeCode} · max ${option.maxOccupancy}`);
  identity.append(name, code);
  const count = node("div", "count");
  const number = node("strong", "", String(option.availableCount));
  const countLabel = node("span", "", "physically free");
  count.append(number, countLabel);
  head.append(identity, count);
  const badge = node("span", `badge ${option.bookable ? "available" : "blocked"}`, option.bookable ? "Bookable" : "Not bookable");
  card.append(head, badge);
  const rate = node("div", "code");
  if (option.total) {
  rate.textContent = `${option.ratePlanCode} · ${option.currency} ${option.total.amount_minor} minor units pre-tax · exact published evidence, commit rechecks inventory`;
  } else {
  rate.textContent = `${option.ratePlanCode} · ${option.state}${option.reason ? ` · ${option.reason}` : ""} · no price offered`;
  }
  card.append(rate);
  const causes = node("ul", "cause-list");
  for (const restriction of option.restrictionsApplied) causes.append(causeNode(restriction, "restriction"));
  for (const block of option.operationalBlocksApplied) causes.append(causeNode(block, "operational"));
  if (causes.childElementCount > 0) card.append(causes);
  if (option.bookable) {
  const actions = node("div", "option-actions");
  const hold = el("button");
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
  restoreLocalLoginDefaults();
  await loadProperties();
  showWorkbench();
  setLoginMessage("");
 } catch (error) {
  accessToken = "";
  restoreLocalLoginDefaults();
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
  const body = await request(`/api/v1/properties/${enc(property)}/availability:search`, {
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
 reservationLifecycleLookupForm.addEventListener("submit", async (event) => {
 event.preventDefault();
 const button = reservationLifecycleLookupForm.querySelector("button[type=submit]");
 button.disabled = true;
 formMessage(reservationLifecycleLookupForm, "Finding exact lifecycle truth…");
 reservationLifecycleEditor.hidden = true;
 reservationLifecycleData = null;
 try {
  await loadReservationLifecycle(true);
  formMessage(reservationLifecycleLookupForm, "Reservation found. Actions below come from its server status.");
 } catch (error) {
  formMessage(reservationLifecycleLookupForm, error instanceof Error ? error.message : "Reservation could not be found", true);
 } finally {
  button.disabled = false;
 }
 });
 partyProfileSearchForm.addEventListener("submit", (event) => {
 event.preventDefault();
 void searchPartyProfiles();
 });
 partyProfileSearchForm.elements.query.addEventListener("input", () => {
 partyProfileGeneration += 1;
 partyProfileResults.replaceChildren();
 });
 partyProfileCreateForm.addEventListener("input", () => {
 partyProfileGeneration += 1;
 partyCreateAttemptKey = "";
 partyCreateDraft = null;
 clearPartyDuplicateReview();
 });
 partyProfileCreateForm.addEventListener("change", () => {
 partyProfileGeneration += 1;
 partyCreateAttemptKey = "";
 partyCreateDraft = null;
 clearPartyDuplicateReview();
 });
 partyProfileCreateForm.addEventListener("submit", (event) => {
 event.preventDefault();
 partyCreateDraft = partyCreateBody();
 if (partyCreateDraft.roles.length === 0) {
  partyCreateDraft = null;
  formMessage(partyProfileCreateForm, "Choose at least one canonical Party role.", true);
  partyProfileCreateForm.elements.roles[0].focus();
  return;
 }
 partyCreateAttemptKey = partyCreateAttemptKey || crypto.randomUUID();
 clearPartyDuplicateReview();
 void createPartyProfile();
 });
 partyCreateDistinctConfirm.addEventListener("change", () => {
 partyCreateDistinct.disabled = !partyCreateDistinctConfirm.checked;
 });
 partyCreateDistinct.addEventListener("click", () => {
 if (!partyCreateDistinctConfirm.checked || partyDuplicateIds.length === 0) return;
 void createPartyProfile([...partyDuplicateIds]);
 });
 partyProfileClear.addEventListener("click", () => {
 clearPartyProfileState();
 partyProfileSearchForm.elements.query.focus();
 });
 reservationBookingForm.addEventListener("submit", async (event) => {
 event.preventDefault();
 const searchGeneration = ++reservationBookingSearchGeneration;
 const property = propertySelect.value;
 const button = reservationBookingForm.querySelector("button[type=submit]");
 button.disabled = true;
 formMessage(reservationBookingForm, "Resolving complete server offers…");
 reservationBookingOptions.replaceChildren();
 clearReservationBookingSelection();
 try {
  const fields = new FormData(reservationBookingForm);
  const fromValue = String(fields.get("from") || "");
  const toValue = String(fields.get("to") || "");
  const from = new Date(`${fromValue}Z`);
  const to = new Date(`${toValue}Z`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
  throw new Error("Choose a valid positive UTC stay period.");
  }
  const childAges = reservationBookingChildAges(String(fields.get("childAges") || ""));
  const primaryPartyId = String(fields.get("primaryPartyId") || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(primaryPartyId)) {
  throw new Error("Choose a server Party before searching offers.");
  }
  reservationBookingDraft = {
  primaryPartyId,
  adults: Number(fields.get("adults")),
  childAges,
  channelCode: String(fields.get("channelCode") || ""),
  };
  const result = await request(`/api/v1/properties/${enc(property)}/availability:search`, {
  method: "POST",
  body: JSON.stringify({
   stay: { from: from.toISOString(), to: to.toISOString() },
   party: { adults: reservationBookingDraft.adults, children: childAges.map((age) => ({ age })) },
   channel: reservationBookingDraft.channelCode,
  }),
  });
  if (searchGeneration !== reservationBookingSearchGeneration || property !== propertySelect.value) return;
  const options = result.options.map(workbenchOption);
  renderReservationBookingOffers(options, result.issues || []);
  formMessage(reservationBookingForm, `${options.filter(({ bookable }) => bookable).length} bookable server offer(s). Selection is guidance; commit rechecks occupancy.`);
 } catch (error) {
  if (searchGeneration !== reservationBookingSearchGeneration || property !== propertySelect.value) return;
  reservationBookingDraft = null;
  formMessage(reservationBookingForm, error instanceof Error ? error.message : "Offers could not be resolved", true);
 } finally {
  button.disabled = false;
 }
 });
 reservationBookingHoldAction.addEventListener("click", () => void placeReservationBookingHold());
 reservationBookingDirect.addEventListener("click", () => void commitReservationBooking(false));
 reservationBookingHeld.addEventListener("click", () => void commitReservationBooking(true));
 reservationSegmentLookupForm.addEventListener("submit", async (event) => {
 event.preventDefault();
 const button = reservationSegmentLookupForm.querySelector("button[type=submit]");
 button.disabled = true;
 formMessage(reservationSegmentLookupForm, "Finding exact segment history…");
 reservationSegmentEditor.hidden = true;
 reservationSegmentData = null;
 reservationBookingOffers = [];
 reservationBookingSelection = null;
 reservationBookingHold = null;
 reservationBookingDraft = null;
 try {
  await loadReservationSegments(true);
  formMessage(reservationSegmentLookupForm, "Segment history loaded from server truth.");
 } catch (error) {
  formMessage(reservationSegmentLookupForm, error instanceof Error ? error.message : "Reservation segments could not be found", true);
 } finally {
  button.disabled = false;
 }
 });
 reservationDepartureForm.addEventListener("submit", async (event) => {
 event.preventDefault();
 const latest = reservationSegmentData?.segments.at(-1);
 if (!latest) return;
 const value = reservationDepartureForm.elements.newDeparture.value;
 const departure = new Date(`${value}Z`);
 if (!value || !Number.isFinite(departure.getTime())) {
  segmentCommandMessage.textContent = "Choose a valid departure date and time.";
  segmentCommandMessage.classList.add("error");
  return;
 }
 await submitSegmentCommand("/departure", "PATCH", {
  expectedPeriod: latest.period,
  newDeparture: departure.toISOString(),
 }, reservationDepartureForm, "Departure changed after live occupancy re-arbitration.");
 });
 reservationRoomMoveForm.addEventListener("submit", async (event) => {
 event.preventDefault();
 const latest = reservationSegmentData?.segments.at(-1);
 if (!latest?.sellableUnitId) return;
 await submitSegmentCommand("/move", "POST", {
  expectedSellableUnitId: latest.sellableUnitId,
  expectedPeriod: latest.period,
  destinationSellableUnitId: reservationRoomMoveForm.elements.destinationSellableUnitId.value,
 }, reservationRoomMoveForm, "Room moved at the server-owned instant; immutable segment history reloaded.");
 });
 reservationMetadataForm.addEventListener("submit", async (event) => {
 event.preventDefault();
 if (!reservationLifecycleData) return;
 const expected = {};
 const changes = {};
 for (const name of ["notes", "eta", "etd", "marketCode", "sourceCode", "originCode"]) {
  const before = reservationLifecycleData.fields[name];
  const raw = reservationMetadataForm.elements[name].value;
  const after = raw === "" ? null : raw;
  if (after !== before) {
  expected[name] = before;
  changes[name] = after;
  }
 }
 if (Object.keys(changes).length === 0) {
  formMessage(reservationMetadataForm, "No metadata changed. Nothing was sent or audited.");
  return;
 }
 const command = reservationLifecycleCommand("modify");
 await submitLifecycleCommand(command.path, command.method, { expected, changes }, reservationMetadataForm, "Metadata saved with exact before/after evidence.");
 });
 reservationCancelForm.addEventListener("submit", async (event) => {
 event.preventDefault();
 const fields = new FormData(reservationCancelForm);
 const approvalId = String(fields.get("approvalId") || "");
 const command = reservationLifecycleCommand("cancel");
 const saved = await submitLifecycleCommand(command.path, command.method, {
  reason: fields.get("reason"), ...(approvalId ? { approvalId } : {}),
 }, reservationCancelForm, "Reservation cancelled and occupancy released.");
 if (saved) reservationCancelForm.reset();
 });
 reservationReinstate.addEventListener("click", async () => {
 const command = reservationLifecycleCommand("reinstate");
 await submitLifecycleCommand(command.path, command.method, {}, reservationReinstatePanel, "Reservation reinstated after live occupancy re-arbitration.");
 });
 reservationLookupForm.addEventListener("submit", async (event) => {
 event.preventDefault();
 const button = reservationLookupForm.querySelector("button[type=submit]");
 const confirmationNo = String(new FormData(reservationLookupForm).get("confirmationNo") || "");
 button.disabled = true;
 formMessage(reservationLookupForm, "Finding the exact tenant and property reservation…");
 reservationGuestForm.hidden = true;
 reservationGuestData = null;
 try {
  const body = await requestReservationGuests(propertySelect.value, confirmationNo);
  renderReservationGuests(body.reservation);
  formMessage(reservationLookupForm, "Reservation found. Review the complete allocation below.");
 } catch (error) {
  formMessage(reservationLookupForm, error instanceof Error ? error.message : "Reservation could not be found", true);
 } finally {
  button.disabled = false;
 }
 });
 reservationGuestForm.addEventListener("submit", async (event) => {
 event.preventDefault();
 if (!reservationGuestData) return;
 const guests = [...reservationGuestList.querySelectorAll(".reservation-guest-row")].map((row) => {
  const role = row.querySelector("select").value;
  return {
  partyId: row.querySelector('input[name="partyId"]').value,
  role,
  sharePct: role === "sharer" ? row.querySelector('input[name="sharePct"]').value : null,
  };
 });
 const primarySharePct = guests.some((guest) => guest.role === "sharer") ? reservationPrimaryShare.value : null;
 const body = { primarySharePct, guests };
 await submitReservationGuestCommand(body);
 });
 addReservationGuest.addEventListener("click", () => {
 if (reservationGuestList.childElementCount < 99) addReservationGuestRow();
 });
 reservationPrimaryShare.addEventListener("input", updateReservationShareTotal);
 document.addEventListener("keydown", (event) => {
 const action = event.target.closest?.("#folio-window-new,.folio-correct-action");
 if (activeView === "folios" && action && !event.repeat && /^(Enter| )$/.test(event.key) && !action.disabled) {
  event.preventDefault();
  action.click();
  return;
 }
 if (activeView === "folios" && event.key === "Escape" && !folioWorkspace.hidden) {
  event.preventDefault();
  folioWorkspaceBack.click();
 return;
 }
 if (activeView === "housekeeping" && event.key === "Escape" && housekeepingRouteTaskId && housekeepingTaskDetailPanel?.hidden === false) {
  event.preventDefault();
  closeHousekeepingTaskDetail();
  return;
 }
 if (activeView === "housekeeping" && event.key === "Escape" &&
  checkInHousekeepingReturnFromState(history.state, propertySelect.value)) {
  event.preventDefault();
  void returnFromHousekeepingToCheckIn();
  return;
 }
 if (activeView === "housekeeping" && event.key === "Escape" &&
  checkoutHousekeepingReturnFromState(history.state, propertySelect.value)) {
  event.preventDefault();
  void returnFromHousekeepingToCheckedOutReservation();
  return;
 }
 if (activeView === "vehicles" && event.key === "Escape" && vehicleRouteVehicleId && vehicleDetailPanel?.hidden === false) {
  event.preventDefault();
  closeVehicleDetail();
  return;
 }
 if (activeView !== "reservations") return;
 const editable = event.target.closest?.("input, select, textarea, [contenteditable=true]");
 if (event.key === "Escape") {
  if (!dueInRoomAssignment.hidden) {
   event.preventDefault();
   closeDueInRoomAssignment();
   return;
  }
  if (reservationRoutePickupTaskId && !reservationDetailDrawer.hidden) {
  event.preventDefault();
  closeReservationPickupTaskDetail();
  return;
  }
  if (!reservationDetailDrawer.hidden) { event.preventDefault(); closeReservationDetail(); return; }
  if (!reservationCreatePanel.hidden) { event.preventDefault(); closeReservationCreate(); }
  return;
 }
 if (editable || !reservationCreatePanel.hidden || !reservationDetailDrawer.hidden || (event.key !== "j" && event.key !== "k")) return;
 const rows = [...document.querySelectorAll(".reservation-board-table .reservation-row-open")];
 if (rows.length === 0) return;
 const current = rows.indexOf(document.activeElement);
 const forward = event.key === "j";
 const backwards = event.key === "k";
 const next = backwards ? Math.max(0, current < 0 ? 0 : current - 1) :
  forward ? Math.min(rows.length - 1, current + 1) : current;
 event.preventDefault();
 rows[next].focus();
 });
 propertySelect.addEventListener("change", () => {
 if (activeView === "folios" && !folioWorkspace.hidden && !confirmFolioExit()) {
  propertySelect.value = folioWorkspaceProperty;
  return;
 }
 if (shouldConfirmReservationExit(reservationCreatePanel.hidden === false, reservationCreateDirty, "property") &&
  !confirm("Discard this unfinished reservation? Entered details will be lost.")) {
  propertySelect.value = reservationCreateProperty;
  return;
 }
 if (!reservationCreatePanel.hidden) closeReservationCreate({ history: false, force: true });
 closeReservationPickupTaskDetail({ history: false, restoreFocus: false });
 clearHousekeepingTaskDetailState();
 reservationBookingSearchGeneration += 1;
 reservationBoardGeneration += 1;
 reservationDetailGeneration += 1;
 housekeepingGeneration += 1;
 housekeepingRequestGeneration += 1;
 housekeepingData = [];
 housekeepingReturnFocus = "";
 housekeepingAttempts.clear();
 housekeepingTaskDetailAttempts.clear();
 clearHousekeepingConditionState();
 clearHousekeepingDiscrepancyState();
 clearHousekeepingSheetState();
 departureFolioReturn = null;
 departureFolioExitConfirmed = false;
 reservationFolioReturn = null;
 reservationFolioExitConfirmed = false;
 clearVehicleRegisterState();
 vehicleLinkedReservationReturn = null;
 vehicleRegisterLinkedReservationReturn = null;
 resetTodayState();
 reservationBoardRows = [];
 reservationBoardNextCursor = null;
 reservationRouteReservationId = "";
 currentReservationWorkbench = null;
 reservationOperationalPreparationReturn = null;
 checkoutHousekeepingCompletion = null;
 checkoutHousekeepingActionOrigin = null;
 checkoutHousekeepingReturn = null;
 clearCheckoutHousekeepingReturnControl();
 reservationDrawerReturnView = "";
 reservationDrawerReturnReservationId = "";
 todayReturnFocus = { reservationId: "", cycle: 0 };
 reservationDetailDrawer.hidden = true;
 clearCheckInWorkbench();
 clearCheckoutReadinessWorkbench();
 reservationPrimaryFolioAttemptKey = "";
 reservationPrimaryFolioReservationId = "";
 clearReservationDrawerLifecycle();
 reservationCreatePanel.hidden = true;
 reservationBoard.hidden = false;
 reservationCreateDirty = false;
 clearPartyProfileState();
 clearFolioState();
 dayCloseRequestGeneration += 1;
 dayCloseContent.hidden = true;
 trustRequestGeneration += 1; trustAccounts = []; trustApprovals = []; trustApprovalCursor = null; clearTrustPreview();
 if (propertySelect.value) history.replaceState(null, "", `/p/${propertySelect.value}/${activeView}`);
 if (activeView === "inventory") void loadInventory();
 if (activeView === "today") loadToday();
 if (activeView === "availability") {
  void loadActiveHolds();
  void loadOfflineLeases();
 }
 if (activeView === "operations") void loadOperationalBlocks();
 if (activeView === "housekeeping") {
  void loadHousekeepingBoard();
  void loadHousekeepingConditions();
  housekeepingDiscrepancyWorkbench.hidden = false;
  void loadHousekeepingDiscrepancies();
 }
 if (activeView === "vehicles") {
  history.replaceState({ yellowSurface: "vehicle-register" }, "", canonicalVehiclePath(propertySelect.value));
  vehicleRegistration.value = "";
  void loadVehicleRegister();
 }
 if (activeView === "restrictions") void loadRestrictions();
 if (activeView === "rates") void loadRates();
 if (activeView === "status") void loadSystemStatus();
 if (activeView === "day-close") void loadDayCloseWorkbench();
 if (activeView === "trust") void loadTrustWorkbench();
 reservationGuestData = null;
 reservationLifecycleData = null;
 reservationSegmentData = null;
 reservationGuestForm.hidden = true;
 reservationLifecycleEditor.hidden = true;
 reservationSegmentEditor.hidden = true;
 reservationBookingCommit.hidden = true;
 reservationBookingOptions.replaceChildren();
 reservationBookingOffers = [];
 reservationBookingSelection = null;
 reservationBookingHold = null;
 reservationBookingDraft = null;
 reservationGuestList.replaceChildren();
 if (activeView === "reservations") void loadReservationBoard();
 });
 for (const tab of navigation) tab.addEventListener("click", () => {
 if (tab.dataset.view !== "reservations" && !reservationCreatePanel.hidden && !closeReservationCreate({ history: false })) return;
 if (activeView === "folios" && tab.dataset.view !== "folios" && !folioWorkspace.hidden && !confirmFolioExit()) return;
 setView(tab.dataset.view);
 finishWorkspaceNavigation(tab.dataset.view);
 });
 dayCloseRefresh.addEventListener("click", () => void loadDayCloseWorkbench({ businessDate: dayCloseDate.value || dayCloseRouteDate(), focus: true }));
 dayCloseRetry.addEventListener("click", () => void loadDayCloseWorkbench({ businessDate: dayCloseDate.value || dayCloseRouteDate(), focus: true }));
 dayCloseApprovalRefresh.addEventListener("click", () => void loadDayCloseCarryApprovals());
 dayCloseDate.addEventListener("change", () => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayCloseDate.value)) return;
  history.pushState({ yellowSurface: "day-close" }, "", dayCloseCanonicalPath(dayCloseDate.value));
  void loadDayCloseWorkbench({ businessDate: dayCloseDate.value, focus: true });
 });
 trustRefresh.addEventListener("click", () => void loadTrustWorkbench({ focus: true }));
 trustInboxRefresh.addEventListener("click", () => void loadTrustApprovals());
 trustInboxMore.addEventListener("click", () => void loadTrustApprovals({ append: true }));
 trustExpenseForm.addEventListener("submit", (event) => void previewTrustExpense(event));
 trustRequestApproval.addEventListener("click", () => void requestTrustApproval());
 trustPost.addEventListener("click", () => void postTrustExpense());
 for (const control of [trustAccount, trustAmount, trustReason]) control.addEventListener("input", () => {
  trustRequestGeneration += 1; clearTrustPreview("Inputs changed · preview again"); trustMessage.classList.remove("error"); trustMessage.textContent = "Inputs changed. Refresh the authoritative preview before continuing.";
 });
 for (const control of managementJourneyControls) control.addEventListener("click", () => {
  if (control.dataset.journeyView !== "reservations" && !reservationCreatePanel.hidden && !closeReservationCreate({ history: false })) return;
  if (activeView === "folios" && control.dataset.journeyView !== "folios" && !folioWorkspace.hidden && !confirmFolioExit()) return;
  if (control.dataset.journeyView === "today") {
   const operationalLanes = $("#today-operational-lanes");
   operationalLanes.focus({ preventScroll: true });
   operationalLanes.scrollIntoView({ block: "start" });
   return;
  }
  setView(control.dataset.journeyView);
  finishWorkspaceNavigation(control.dataset.journeyView);
 });
 folioFindViaReservation.addEventListener("click", () => {
  if (!confirmFolioExit()) return;
  setView("reservations");
  finishWorkspaceNavigation("reservations");
 });
 availabilityReservationShortcut.addEventListener("click", () => {
 setView("reservations");
 $("#reservations-title").focus({ preventScroll: true });
 $("#reservations-title").scrollIntoView({ block: "start" });
 });
 reservationBoardForm.addEventListener("submit", (event) => {
 event.preventDefault();
 void loadReservationBoard();
 });
 reservationFiltersClear.addEventListener("click", clearReservationBoardFilters);
 reservationEmptyClear.addEventListener("click", clearReservationBoardFilters);
 reservationBoardRetry.addEventListener("click", () => void loadReservationBoard());
 reservationBoardMore.addEventListener("click", () => void loadReservationBoard({ older: true }));
 todayRefresh.addEventListener("click", loadToday);
 housekeepingRefresh.addEventListener("click", () => {
 void loadHousekeepingBoard({ focus: true });
 void loadHousekeepingConditions().then(reopenHousekeepingConditionInitialization);
 void loadHousekeepingDiscrepancies();
 if (housekeepingSheetDate.value) {
  if (housekeepingSheetAttendant) void previewHousekeepingSheet();
  else void loadHousekeepingSheetHistory();
 }
 });
 housekeepingRetry.addEventListener("click", () => void loadHousekeepingBoard({ focus: true }));
 housekeepingConditionRefresh.addEventListener("click", () => void loadHousekeepingConditions({ focus: "refresh" }).then(reopenHousekeepingConditionInitialization));
 housekeepingArrivalReturnAction.addEventListener("click", () => void returnFromHousekeepingToCheckIn());
 housekeepingConditionRetry.addEventListener("click", () => void loadHousekeepingConditions({ focus: "title" }).then(reopenHousekeepingConditionInitialization));
 housekeepingConditionMore.addEventListener("click", () => void loadHousekeepingConditions({ older: true, focus: "more" }).then(reopenHousekeepingConditionInitialization));
 housekeepingConditionFilter.addEventListener("change", () => void loadHousekeepingConditions({ focus: "filter" }).then(reopenHousekeepingConditionInitialization));
 housekeepingDiscrepancyRefresh.addEventListener("click", () => void loadHousekeepingDiscrepancies({ focus: "refresh" }));
 housekeepingDiscrepancyRetry.addEventListener("click", () => void loadHousekeepingDiscrepancies({ focus: "title" }));
 housekeepingDiscrepancyForm.addEventListener("submit", (event) => void submitHousekeepingDiscrepancy(event));
 housekeepingDiscrepancySpace.addEventListener("change", () => {
  housekeepingDiscrepancyAttempts.clear();
  housekeepingDiscrepancySubmit.disabled = housekeepingDiscrepancySpace.value === "";
 });
 housekeepingDiscrepancyForm.addEventListener("change", (event) => {
  if (event.target.name === "observedPresence") updateHousekeepingDiscrepancyPresence();
 });
 housekeepingDiscrepancyPersons.addEventListener("input", () => housekeepingDiscrepancyAttempts.clear());
 housekeepingSheetForm.addEventListener("submit", (event) => {
 event.preventDefault();
 void previewHousekeepingSheet({ focus: true });
 });
 housekeepingAttendantSearch.addEventListener("click", () => void searchHousekeepingAttendants());
 housekeepingAttendantQuery.addEventListener("keydown", (event) => {
 if (event.key === "Enter") { event.preventDefault(); void searchHousekeepingAttendants(); }
 });
housekeepingAttendantQuery.addEventListener("input", () => {
 housekeepingSheetGeneration += 1;
 clearHousekeepingSheetReceipt();
 housekeepingAttendantResults.replaceChildren();
 setHousekeepingSheetMessage("");
 });
 housekeepingAttendantChange.addEventListener("click", () => {
 housekeepingSheetGeneration += 1;
 clearHousekeepingSheetPreview();
 housekeepingSheetAttendant = null;
 housekeepingAttendantSelected.hidden = true;
 housekeepingAttendantSearchRow.hidden = false;
 updateHousekeepingSheetProgress();
 setHousekeepingSheetMessage("Choose the attendant again, then refresh the authoritative preview.");
 housekeepingAttendantQuery.focus({ preventScroll: true });
 });
housekeepingSheetDate.addEventListener("change", () => {
 housekeepingSheetGeneration += 1;
 clearHousekeepingSheetReceipt();
 clearHousekeepingSheetPreview();
 updateHousekeepingSheetProgress();
 if (housekeepingSheetDate.value) void loadHousekeepingSheetHistory();
 });
 housekeepingGenerate.addEventListener("click", () => void generateHousekeepingSheet());
 vehicleSearchForm.addEventListener("submit", (event) => {
 event.preventDefault();
 if (!vehicleSearchForm.reportValidity()) return;
 vehicleRegisterFilter = vehicleRegistration.value;
 void loadVehicleRegister({ focus: true, updateHistory: true });
 });
 vehicleSearchClear.addEventListener("click", () => {
 vehicleRegistration.value = "";
 vehicleRegisterFilter = "";
 void loadVehicleRegister({ focus: true, updateHistory: true });
 });
 vehiclesRefresh.addEventListener("click", () => void loadVehicleRegister({ cursor: vehicleRegisterCursor, focus: true }));
 vehicleRegisterRetry.addEventListener("click", () => void loadVehicleRegister({ cursor: vehicleRegisterCursor, focus: true }));
 vehicleRegisterNext.addEventListener("click", () => {
 if (vehicleRegisterNextCursor !== null) void loadVehicleRegister({ cursor: vehicleRegisterNextCursor, focus: true, updateHistory: true });
 });
 vehicleRegisterList.addEventListener("click", (event) => {
 const action = event.target.closest?.(".vehicle-detail-action");
 if (!(action instanceof HTMLButtonElement) || !canonicalUuid(action.dataset.vehicleId || "")) return;
 openVehicleDetail(action.dataset.vehicleId, { trigger: action });
 });
 housekeepingTaskList.addEventListener("click", (event) => {
  const detail = event.target.closest?.(".housekeeping-task-detail-action");
  if (detail instanceof HTMLButtonElement && canonicalUuid(detail.dataset.taskId || "")) {
   openHousekeepingTaskDetail(detail.dataset.taskId, { trigger: detail });
   return;
  }
  const button = event.target.closest?.(".housekeeping-action");
  if (button && !button.disabled) void submitHousekeepingAction(button);
 });
 for (const lane of todayLanes) {
 const status = lane.dataset.todayLane;
 lane.querySelector("[data-today-retry]").addEventListener("click", () => void loadTodayLane(status));
 lane.querySelector("[data-today-more]").addEventListener("click", () => void loadTodayLane(status, { older: true }));
 }
 reservationCreateOpen.addEventListener("click", () => openReservationCreate());
 reservationEmptyCreate.addEventListener("click", () => openReservationCreate());
 reservationCreateCancel.addEventListener("click", () => closeReservationCreate());
 reservationStayNext.addEventListener("click", () => {
 const fields = reservationBookingForm.elements;
 const controls = [fields.from, fields.to, fields.adults, fields.channelCode];
 for (const control of controls) {
  if (!control.checkValidity()) { control.reportValidity(); control.focus(); return; }
 }
 const from = new Date(`${fields.from.value}Z`);
 const to = new Date(`${fields.to.value}Z`);
 if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
  formMessage(reservationBookingForm, "Choose a valid positive UTC stay period.", true);
  fields.from.focus();
  return;
 }
 try { reservationBookingChildAges(fields.childAges.value); }
 catch (error) { formMessage(reservationBookingForm, error.message, true); fields.childAges.focus(); return; }
 reservationCreateDirty = true;
 formMessage(reservationBookingForm, "Stay captured. Select the canonical Party next.");
 setReservationCreateStep(2);
 });
 reservationGuestNext.addEventListener("click", () => {
 if (!reservationBookingForm.elements.primaryPartyId.value) {
  formMessage(partyProfileSearchForm, "Choose or create a server Party before finding offers.", true);
  (partyProfileSelected.hidden ? partyProfileSearchForm.elements.query : partyProfileClear).focus();
  return;
 }
 reservationSearchOffers.click();
 });
 reservationOfferRetry.addEventListener("click", () => reservationSearchOffers.click());
 for (const button of reservationBackButtons) button.addEventListener("click", () => setReservationCreateStep(Number(button.dataset.reservationBack)));
 for (const button of reservationCreateSteps) button.addEventListener("click", () => {
 if (!button.disabled) setReservationCreateStep(Number(button.dataset.reservationCreateStep));
 });
 reservationBookingForm.addEventListener("input", (event) => {
 if (!["from", "to", "adults", "childAges", "channelCode"].includes(event.target.name)) return;
 reservationBookingSearchGeneration += 1;
 reservationBookingOffers = [];
 reservationBookingSelection = null;
 reservationBookingHold = null;
 reservationBookingDraft = null;
 reservationBookingOptions.replaceChildren();
 clearReservationBookingSelection();
 reservationOfferRetry.hidden = true;
 });
 reservationCreatePanel.addEventListener("input", () => { reservationCreateDirty = true; });
 reservationDetailClose.addEventListener("click", () => closeReservationDetail());
 reservationDetailRetry.addEventListener("click", () => {
 if (reservationRouteReservationId) void loadReservationDetail(reservationRouteReservationId);
 });
 reservationTravelDirection.addEventListener("change", () => {
 if (reservationTravelData) renderReservationTravelDirection({ focus: false });
 });
 reservationTravelForm.addEventListener("submit", (event) => {
 event.preventDefault();
 if (!reservationTravelForm.reportValidity()) return;
 void submitReservationTravelCommand();
 });
 reservationPrimaryFolioCreate.addEventListener("click", () => void openPrimaryFolio());
 dueInRoomAssignmentForm.addEventListener("submit", (event) => void submitDueInRoomAssignment(event));
 dueInRoomAssignmentRefresh.addEventListener("click", () => {
  if (dueInRoomAssignmentOrigin) void loadDueInRoomAssignmentCandidates(dueInRoomAssignmentOrigin, { focus: true });
 });
 dueInRoomAssignmentClose.addEventListener("click", () => closeDueInRoomAssignment());
 checkInForm.addEventListener("submit", (event) => void submitCheckIn(event));
 checkInHousekeepingAction.addEventListener("click", () => {
  if (checkInHousekeepingActionOrigin) void openCheckInHousekeeping(checkInHousekeepingActionOrigin, checkInHousekeepingAction);
 });
 checkInRefresh.addEventListener("click", () => void loadCheckInReadiness({ focus: true, preserveDraft: true }));
 const updateCheckInAction = () => {
  const needsReason = checkInReadinessData?.dirtyRoomOverrideRequired === true;
  checkInSubmit.disabled = checkInReadinessData?.canCheckIn !== true || !checkInConfirm.checked
  || (needsReason && checkInOverrideReason.value.trim() === "");
 };
 checkInConfirm.addEventListener("change", updateCheckInAction);
 checkInOverrideReason.addEventListener("input", updateCheckInAction);
 departureRefresh.addEventListener("click", () => void loadCheckoutReadiness({ focus: true }));
 departureRetry.addEventListener("click", () => void loadCheckoutReadiness({ focus: true }));
 departureCheckoutForm.addEventListener("submit", (event) => void submitCheckout(event));
 departureCheckoutConfirm.addEventListener("change", syncCheckoutConfirmation);
 window.addEventListener("popstate", () => {
 if (/^\/p\/[0-9a-f-]+\/day-close$/.test(location.pathname)) {
  if (activeView !== "day-close") setView("day-close", false);
  else void loadDayCloseWorkbench({ businessDate: dayCloseRouteDate(), focus: true });
  return;
 }
 if (location.pathname === `/p/${propertySelect.value}/trust`) {
  if (activeView !== "trust") setView("trust", false); else void loadTrustWorkbench({ focus:true });
  return;
 }
 if (location.pathname === `/p/${propertySelect.value}/today`) {
  closeReservationDetail({ history: false, restoreFocus: false });
  if (activeView !== "today") setView("today", false);
  return;
 }
 const arrivalRoute = reservationNavigationRoute();
 if (checkoutHousekeepingReturn && arrivalRoute.kind === "detail" &&
  arrivalRoute.property === propertySelect.value &&
  arrivalRoute.reservationId === checkoutHousekeepingReturn.reservationId && arrivalRoute.workbench === null &&
  `${location.pathname}${location.search}` === checkoutHousekeepingReturn.originPath) {
  void returnFromHousekeepingToCheckedOutReservation({ fromHistory: true });
  return;
 }
 if (checkInHousekeepingReturn && arrivalRoute.kind === "detail" && arrivalRoute.property === propertySelect.value &&
  arrivalRoute.reservationId === checkInHousekeepingReturn.reservationId && arrivalRoute.workbench === "check-in" &&
  `${location.pathname}${location.search}` === checkInHousekeepingReturn.originPath &&
  returnFromHousekeepingToCheckIn({ fromHistory: true })) return;
 const housekeepingRoute = housekeepingNavigationRoute();
 if (housekeepingRoute.kind !== "other" && housekeepingRoute.property === propertySelect.value) {
  closeReservationDetail({ history: false, restoreFocus: false });
  if (activeView !== "housekeeping") setView("housekeeping", false);
  else if (housekeepingRoute.kind === "detail") syncHousekeepingRoute({ focus: true });
  else {
   syncHousekeepingRoute({ focus: true });
   void loadHousekeepingBoard();
   void loadHousekeepingConditions();
   housekeepingDiscrepancyWorkbench.hidden = false;
   void loadHousekeepingDiscrepancies();
  }
 return;
 }
 const vehicleRoute = vehicleNavigationRoute();
 if (vehicleRegisterLinkedReservationReturn && vehicleRoute.kind === "register" &&
  vehicleRoute.property === propertySelect.value && returnFromReservationToVehicleRegister({ fromHistory: true })) return;
 if (vehicleRoute.kind !== "other" && vehicleRoute.property === propertySelect.value) {
  closeReservationDetail({ history: false, restoreFocus: false });
  if (activeView !== "vehicles") setView("vehicles", false);
  else syncVehicleRoute({ focus: true });
  return;
 }
 const folioRoute = folioRouteFromLocation();
 if (activeView === "folios" && !folioWorkspace.hidden && !departureFolioExitConfirmed && !reservationFolioExitConfirmed && !confirmFolioExit()) {
  const currentId = folioStatementData?.folio.id || folioIdentity;
  history.pushState(folioWorkspaceHistoryState(currentId), "", canonicalFolioPath(propertySelect.value, currentId, folioActiveTab, folioRouteCursor));
  return;
 }
 departureFolioExitConfirmed = false;
 reservationFolioExitConfirmed = false;
 const departureRoute = reservationNavigationRoute();
 if (departureFolioReturn && departureRoute.kind === "detail" && departureRoute.workbench === "checkout" &&
  `${location.pathname}${location.search}` === departureFolioReturn.originPath &&
  returnFromFolioWorkspaceToDeparture({ fromHistory: true })) return;
 if (reservationFolioReturn && departureRoute.kind === "detail" &&
  `${location.pathname}${location.search}` === reservationFolioReturn.originPath &&
  returnFromFolioWorkspaceToReservation({ fromHistory: true })) return;
 if (folioRoute.kind !== "other" && folioRoute.property === propertySelect.value) {
  setView("folios", false);
  syncFolioRoute();
  return;
 }
 const cashierRoute = cashierRouteFromLocation();
 if (cashierRoute && cashierRoute.property === propertySelect.value) {
  setView("cashiers", false);
  return;
 }
 const route = reservationNavigationRoute();
 if (shouldConfirmReservationExit(reservationCreatePanel.hidden === false, reservationCreateDirty, route.kind) &&
  !confirm("Leave this unfinished reservation? Entered details will be lost.")) {
  history.pushState({ yellowSurface: "reservation-create" }, "", `/p/${propertySelect.value}/reservations?new=1&step=${["stay", "guest", "offer", "review"][reservationCreateStep - 1]}`);
  return;
 }
 if (route.kind !== "other") setView("reservations", false);
 syncReservationRoute();
 });
 folioStatementLookupForm.addEventListener("submit", (event) => {
 event.preventDefault();
 void lookupFolioStatement();
 });
 folioLoadOlder.addEventListener("click", () => void loadOlderFolioRows());
 folioWorkspaceBack.addEventListener("click", () => {
 if (returnFromFolioWorkspaceToDeparture()) return;
 if (returnFromFolioWorkspaceToReservation()) return;
 if (!confirmFolioExit()) return;
 const returnTarget = folioReturnFocus;
 clearFolioState();
 history.replaceState(null, "", `/p/${propertySelect.value}/folios`);
 const target = returnTarget?.isConnected ? returnTarget : folioStatementLookupForm.elements.reference;
 target?.focus();
 folioReturnFocus = null;
 });
 for (const [tab, element] of tabs) {
 element.addEventListener("click", () => setFolioTab(tab));
 element.addEventListener("keydown", (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === "Home" ? "postings" : event.key === "End" ? tabs[tabs.length - 1][0] :
  tabs[(tabs.findIndex(([name]) => name === tab)+(event.key==="ArrowRight"?1:tabs.length - 1))%tabs.length][0];
  setFolioTab(next);
 });
 }
 folioWindowTabs.addEventListener("keydown", handleFolioWindowTabKeydown);
 folioWindowTabs.addEventListener("click", (event) => {
 const tab = event.target.closest?.("[data-folio-id]");
 if (!(tab instanceof HTMLButtonElement) || !confirmFolioExit()) return;
 history.pushState({ yellowSurface: "folio-workspace" }, "", canonicalFolioPath(propertySelect.value, tab.dataset.folioId));
 void loadFolioWorkspace(tab.dataset.folioId);
 });
 folioWindowNew.addEventListener("click", () => {
 folioWindowNewForm.hidden = false;
 folioWindowNewForm.elements.name.focus();
 });
 folioWindowNewCancel.addEventListener("click", () => {
 if (currentFolioWindowIsDirty() && !confirmFolioExit()) return;
 folioWindowNewForm.reset();
 folioWindowNewForm.hidden = true;
 folioWindowAttemptKey = "";
 folioWindowDraft = "";
 folioWindowNew.focus();
 });
 folioWindowNewForm.addEventListener("submit", (event) => {
 event.preventDefault();
 void openAdditionalFolioWindow();
 });
 folioOrganizeForm.addEventListener("input", (event) => {
 if (event.target === folioOrganizeAcknowledgement) {
  syncFolioTransferConfirmation();
  return;
 }
 const draft = JSON.stringify(folioTransferBody());
 if (folioTransferDraft && draft !== folioTransferDraft) folioTransferAttemptKey = "";
 folioTransferPreview = null;
 folioOrganizePreview.hidden = true;
 folioOrganizeAcknowledgement.checked = false;
 syncFolioTransferConfirmation();
 });
 folioOrganizePreviewSubmit.addEventListener("click", () => void submitFolioTransfer(false));
 folioOrganizeForm.addEventListener("submit", (event) => {
 event.preventDefault();
 void submitFolioTransfer(true);
 });
 receivableTransferAccount.addEventListener("change", () => {
  resetReceivablePreview();
  formMessage(receivableTransferForm, "Target changed. Refresh the server-owned preview before continuing.");
 });
 receivableTransferReason.addEventListener("input", () => {
  if (receivableTransferDraft) { receivableTransferAttemptKey = ""; receivableTransferDraft = ""; }
  syncReceivableTransferConfirmation();
 });
 receivableTransferConfirm.addEventListener("change", syncReceivableTransferConfirmation);
 receivableTransferPreviewSubmit.addEventListener("click", () => void loadReceivableTransferPreview());
 receivableTransferApprovalRequest.addEventListener("click", () => void requestReceivableTransferApproval());
 receivableTransferApprovalApprove.addEventListener("click", () => void decideReceivableTransferApproval("approve"));
 receivableTransferApprovalReject.addEventListener("click", () => void decideReceivableTransferApproval("reject"));
 receivableTransferForm.addEventListener("submit", (event) => { event.preventDefault(); void submitReceivableTransfer(); });
 folioWorkspace.addEventListener("click", (event) => {
 const action = event.target.closest?.(".folio-correct-action");
 if (action instanceof HTMLButtonElement && action.dataset.journalId) {
  openFolioCorrection(action.dataset.journalId, action);
 }
 });
 folioStatementRetry.addEventListener("click", () => {
 if (folioIdentity) void loadFolioWorkspace(folioIdentity, folioRouteCursor);
 });
 folioChargeConfirm.addEventListener("change", syncFolioChargeConfirmation);
 folioChargeForm.addEventListener("input", () => {
 const draft = JSON.stringify(folioChargeBody());
 if (folioChargeDraft && draft !== folioChargeDraft) {
  folioChargeAttemptKey = "";
  folioChargeDraft = "";
 }
 syncFolioChargeConfirmation();
 });
 folioChargeForm.addEventListener("submit", (event) => {
 event.preventDefault();
 void postFolioCharge();
 });
 cashierRefresh.addEventListener("click", () => void loadCashierSession({ focus: true }));
 cashierRetry.addEventListener("click", () => void loadCashierSession({ focus: true }));
 cashierDrawer.addEventListener("change", () => {
 cashierDrawerId = cashierDrawer.value;
 cashierLatestEvidence = null;
 cashierOpenAttemptKey = cashierOpenDraft = cashierCountAttemptKey = cashierCountDraft = cashierCloseAttemptKey = cashierCloseDraft = "";
 renderCashierState(cashierData);
 });
 cashierOpenConfirm.addEventListener("change", syncCashierConfirmations);
 cashierCountConfirm.addEventListener("change", syncCashierConfirmations);
 cashierCloseConfirm.addEventListener("change", syncCashierConfirmations);
 cashierOpenForm.addEventListener("input", () => { if (cashierOpenDraft) { cashierOpenDraft = ""; cashierOpenAttemptKey = ""; } syncCashierConfirmations(); });
 cashierCountForm.addEventListener("input", () => { if (cashierCountDraft) { cashierCountDraft = ""; cashierCountAttemptKey = ""; } syncCashierConfirmations(); });
 cashierCloseForm.addEventListener("input", () => { if (cashierCloseDraft) { cashierCloseDraft = ""; cashierCloseAttemptKey = ""; } syncCashierConfirmations(); });
 cashierOpenForm.addEventListener("submit", (event) => { event.preventDefault(); void submitCashierOpen(); });
 cashierCountForm.addEventListener("submit", (event) => { event.preventDefault(); void submitCashierCount(); });
 cashierCloseForm.addEventListener("submit", (event) => { event.preventDefault(); void submitCashierClose(); });
 cashierSupervisedClose.addEventListener("click", () => void submitCashierClose(true));
 cashierApprovalRequest.addEventListener("click", () => void requestCashierApproval());
 cashierSupervisedApprovalRequest.addEventListener("click", () => void requestCashierApproval(true));
 cashierApprovalApprove.addEventListener("click", () => void decideCashierApproval("approve"));
 cashierApprovalReject.addEventListener("click", () => void decideCashierApproval("reject"));
 folioSettlementAction.addEventListener("click", () => {
 const action = folioSettlementAction.dataset.action;
 if (action === "settle" || action === "close") void submitFolioStatus(action);
 });
 folioCorrectionForm.addEventListener("input", () => {
 const draft = JSON.stringify(folioCorrectionBody());
 if (folioCorrectionDraft && draft !== folioCorrectionDraft) {
  folioCorrectionAttemptKey = "";
  folioCorrectionDraft = "";
 }
 syncFolioCorrectionConfirmation();
 });
 folioCorrectionForm.addEventListener("submit", (event) => {
 event.preventDefault();
 void postFolioCorrection();
 });
 folioCorrectionCancel.addEventListener("click", () => {
 if (currentFolioCorrectionIsDirty() && !confirmFolioExit()) return;
 clearFolioCorrection({ restoreFocus: true });
 setFolioTab("postings", { focus: false });
 });
 folioCorrectionPanel.addEventListener("keydown", (event) => {
 if (event.key !== "Escape") return;
 event.preventDefault();
 folioCorrectionCancel.click();
 });
 window.addEventListener("beforeunload", (event) => {
 if (!currentFolioDraftIsDirty()) return;
 event.preventDefault();
 event.returnValue = "";
 });
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
  const status = await request(`/api/v1/properties/${enc(propertySelect.value)}/availability-projection:rebuild`, {
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
  await request(`/api/v1/properties/${enc(propertySelect.value)}/offline-leases`, {
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
  await request(`/api/v1/properties/${enc(propertySelect.value)}/operational-blocks`, {
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
  const result = await request(`/api/v1/properties/${enc(propertySelect.value)}/inventory-policy/oos-sellability`, {
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
  const body = await request(`/api/v1/properties/${enc(propertySelect.value)}/rate-prices/current?${query}`);
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
  const body = await request(`/api/v1/properties/${enc(propertySelect.value)}/rate-prices/${enc(currentRatePrice.id)}/supersede`, {
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
 $("#rate-builder").addEventListener("input", (event) => {
 if (event.target !== builderAiIntent && event.target !== builderExpertJson && builderAiAppliedProposal) {
  resetBuilderAiProposal("A typed rate choice changed. Interpret and apply the proposal again.");
 }
 if (event.target !== builderExpertJson) renderBuilderCommand();
 });
 builderExpertJson.addEventListener("input", renderBuilderCommand);
 themeSelect.addEventListener("change", () => {
 const theme = themeSelect.value;
 transitionWorkspace(() => applyTheme(theme), { duration: theme === "glass" ? 400 : 280, nextTheme: theme });
 });
 experienceSelect.addEventListener("change", () => {
 transitionWorkspace(() => applyExperience(experienceSelect.value));
 });
 workspaceSkinSelect.addEventListener("change", () => applyWorkspaceSkin(workspaceSkinSelect.value));
 for (const preference of [reducedMotion, coarsePointer, forcedColours]) {
 if (typeof preference.addEventListener === "function") {
  preference.addEventListener("change", () => cancelWorkspaceMotion(true));
 } else {
  preference.addListener?.(() => cancelWorkspaceMotion(true));
 }
 }
 document.addEventListener("visibilitychange", () => {
 if (document.visibilityState !== "visible") cancelWorkspaceMotion(true);
 });
 const workspaceMenuFocusable = () => Array.from(secondaryWorkspaces.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
  .filter((element) => element.getClientRects().length > 0);
 const positionSecondaryWorkspaces = () => {
  if (secondaryWorkspaces.hidden) return;
  const edge = 8;
  const anchor = secondaryWorkspacesToggle.getBoundingClientRect();
  const menuWidth = Math.min(320, Math.max(0, window.innerWidth - edge * 2));
  const desiredHeight = Math.min(520, secondaryWorkspaces.scrollHeight);
  const left = Math.min(Math.max(edge, anchor.right - menuWidth), Math.max(edge, window.innerWidth - menuWidth - edge));
  let top = anchor.bottom + edge;
  const availableBelow = window.innerHeight - top - edge;
  if (availableBelow < Math.min(desiredHeight, 240) && anchor.top > desiredHeight + edge * 2) top = anchor.top - desiredHeight - edge;
  top = Math.min(Math.max(edge, top), Math.max(edge, window.innerHeight - Math.min(desiredHeight, window.innerHeight - edge * 2) - edge));
  secondaryWorkspaces.style.setProperty("--workspace-menu-left", `${left}px`);
  secondaryWorkspaces.style.setProperty("--workspace-menu-top", `${top}px`);
  secondaryWorkspaces.style.setProperty("--workspace-menu-max-height", `${Math.max(120, window.innerHeight - top - edge)}px`);
 };
 const closeSecondaryWorkspaces = (restoreFocus = false) => {
  secondaryWorkspaces.hidden = true;
  secondaryWorkspacesToggle.setAttribute("aria-expanded", "false");
  secondaryWorkspacesToggle.textContent = "More workspaces";
  if (restoreFocus) secondaryWorkspacesToggle.focus({ preventScroll: true });
 };
 const openSecondaryWorkspaces = () => {
  if (secondaryWorkspaces.parentElement !== document.body) document.body.append(secondaryWorkspaces);
  secondaryWorkspaces.hidden = false;
  secondaryWorkspacesToggle.setAttribute("aria-expanded", "true");
  secondaryWorkspacesToggle.textContent = "Fewer workspaces";
  positionSecondaryWorkspaces();
  requestAnimationFrame(() => {
   positionSecondaryWorkspaces();
   workspaceMenuFocusable()[0]?.focus({ preventScroll: true });
  });
 };
 secondaryWorkspacesToggle.addEventListener("click", () => {
  if (secondaryWorkspaces.hidden) openSecondaryWorkspaces();
  else closeSecondaryWorkspaces(true);
 });
 document.addEventListener("keydown", (event) => {
  if (secondaryWorkspaces.hidden) return;
  if (event.key === "Escape") {
   event.preventDefault();
   closeSecondaryWorkspaces(true);
   return;
  }
  if (event.key !== "Tab") return;
  const focusable = workspaceMenuFocusable();
  if (focusable.length === 0) {
   event.preventDefault();
   secondaryWorkspaces.focus();
   return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
   event.preventDefault();
   last?.focus({ preventScroll: true });
  } else if (!event.shiftKey && document.activeElement === last) {
   event.preventDefault();
   first?.focus({ preventScroll: true });
  }
 });
 document.addEventListener("pointerdown", (event) => {
  if (secondaryWorkspaces.hidden || secondaryWorkspaces.contains(event.target) || secondaryWorkspacesToggle.contains(event.target)) return;
  closeSecondaryWorkspaces();
 });
 window.addEventListener("resize", positionSecondaryWorkspaces);
 document.addEventListener("scroll", positionSecondaryWorkspaces, { passive: true, capture: true });
 signOutButton.addEventListener("click", () => {
 if (activeView !== "folios" || folioWorkspace.hidden || confirmFolioExit()) showLogin();
 });
 applyTheme(themeSelect.value);
 applyWorkspaceSkin(workspaceSkinSelect.value);
 applyExperience(experienceSelect.value);
 initializeDates();
 addTier(createTierList, 1, "");
 addTier(createTierList, 2, "");
 updateRestrictionFields();
 updatePolicyFields();
 createBuilderTargetRuleCard({ key: "property-default", effect: "include", priority: 0, physical: { kind: "property" }, commercial: {} });
 setBuilderStep(1);
 setBuilderMode("guided", false);
 const initialView = location.pathname.endsWith("/inventory") ? "inventory" :
 location.pathname.endsWith("/availability") ? "availability" :
 location.pathname.endsWith("/today") ? "today" :
 location.pathname.endsWith("/operations") ? "operations" :
 (/^\/p\/[0-9a-f-]+\/housekeeping(?:\/tasks\/[0-9a-f-]+)?$/.test(location.pathname)) ? "housekeeping" :
 (/^\/p\/[0-9a-f-]+\/vehicles(?:\/[0-9a-f-]+)?$/.test(location.pathname)) ? "vehicles" :
 (location.pathname.endsWith("/reservations") || /^\/p\/[0-9a-f-]+\/res\/[0-9a-f-]+(?:\/pickup-task\/[0-9a-f-]+)?$/.test(location.pathname)) ? "reservations" :
 (location.pathname.endsWith("/folios") || /^\/p\/[0-9a-f-]+\/folio\/[0-9a-f-]+$/.test(location.pathname)) ? "folios" :
 location.pathname.endsWith("/cashiers") ? "cashiers" :
 location.pathname.endsWith("/day-close") ? "day-close" :
 location.pathname.endsWith("/trust") ? "trust" :
 location.pathname.endsWith("/restrictions") ? "restrictions" :
 location.pathname.endsWith("/rates") ? "rates" :
 location.pathname.endsWith("/status") ? "status" : "today";
 setView(initialView, false);
 loginForm.querySelector("button[type=submit]").disabled = false;
})();
