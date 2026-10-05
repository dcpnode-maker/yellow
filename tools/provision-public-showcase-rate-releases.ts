import process from "node:process";

const baseUrl = process.env.YELLOW_RATE_RELEASE_BASE_URL ?? "http://127.0.0.1:3010";
const apply = process.argv.includes("--apply");

type Unit = Readonly<{
  id: string;
  code: string;
  expectedPriceMinor: string;
}>;

type Scenario = Readonly<{
  code: "LOCANDA" | "LONDON";
  propertyId: string;
  ratePlanId: string;
  currency: "SAR" | "GBP";
  propertyTimeZone: string;
  stayFrom: string;
  stayTo: string;
  maxGuests: number;
  units: readonly Unit[];
}>;

const scenarios: readonly Scenario[] = [
  {
    code: "LOCANDA",
    propertyId: "6081b544-22a1-534f-a86d-bb1ae0519e14",
    ratePlanId: "3622192a-2f53-5382-b7e2-6fbf15480ae1",
    currency: "SAR",
    propertyTimeZone: "Asia/Riyadh",
    stayFrom: "2026-09-27T12:00:00.000Z",
    stayTo: "2026-09-28T08:00:00.000Z",
    maxGuests: 6,
    units: [
      { id: "e398e16e-5d5c-5cab-b62b-35815cf9368c", code: "L1BR", expectedPriceMinor: "85000" },
      { id: "6e3aca45-0174-560a-915e-0f143931d402", code: "L2BR", expectedPriceMinor: "125000" },
      { id: "88d8d4b3-9e18-555a-8c31-69401c9e996b", code: "LPH", expectedPriceMinor: "250000" },
    ],
  },
  {
    code: "LONDON",
    propertyId: "01e4e102-c54f-5205-9542-d84d103084f8",
    ratePlanId: "4e57039b-dd54-5abc-8e30-258884a5d048",
    currency: "GBP",
    propertyTimeZone: "Europe/London",
    stayFrom: "2026-09-27T14:00:00.000Z",
    stayTo: "2026-09-28T10:00:00.000Z",
    maxGuests: 3,
    units: [
      { id: "931fc733-9a84-53fb-a612-7751f7e116b5", code: "DLX", expectedPriceMinor: "27000" },
      { id: "98e568f5-f4bc-5976-ba7a-077cb4223b51", code: "KING", expectedPriceMinor: "20500" },
      { id: "06b002d4-1a0d-52b2-9a71-dfb7110fb008", code: "STE", expectedPriceMinor: "46000" },
    ],
  },
];

const RETAINED_LOCANDA = Object.freeze({
  modelId: "0c3fa824-2ebd-4f27-962f-92888f0eb614",
  targetId: "f54f7ff2-88d3-4b95-8229-f5b41cee1d62",
  releaseId: "be444ca9-17c8-4f4a-98eb-1d64d8324148",
  approvalId: "55f6c947-1ab1-4791-af48-873de5352861",
  requestedBy: "9f90d3e9-94f9-54de-95ec-35bd00b99b15",
});

type JsonResult = Readonly<{
  status: number;
  body: unknown;
  replayed: boolean;
}>;

async function jsonRequest(path: string, token: string | null, init: RequestInit = {}): Promise<JsonResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch { body = { title: "Non-JSON response" }; }
  }
  return {
    status: response.status,
    body,
    replayed: response.headers.get("idempotency-replayed") === "true",
  };
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} is not an object`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} is not an array`);
  return value;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, canonical(entry)]));
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function builderPath(scenario: Scenario, suffix = ""): string {
  return `/api/v1/properties/${scenario.propertyId}/rate-builder/${scenario.ratePlanId}${suffix}`;
}

function command(scenario: Scenario): Readonly<Record<string, unknown>> {
  const rules = scenario.units.map((unit, index) => ({
    key: `unit-${unit.code.toLowerCase()}`,
    effect: "include",
    priority: 10 + index,
    physical: { kind: "unit_type", unitTypeId: unit.id },
    commercial: {},
  }));
  return {
    authoringMode: "guided",
    ratePlanId: scenario.ratePlanId,
    model: { key: "room-matrix", version: 1, componentModelKeys: [] },
    target: { rules },
    evaluator: {
      modelKey: "room-matrix",
      currency: scenario.currency,
      base: { kind: "fixed", amountMinor: scenario.units[0]!.expectedPriceMinor },
      gate: {},
      rules: scenario.units.map((unit, index) => ({
        key: `price-${unit.code.toLowerCase()}`,
        stage: 1,
        priority: 10 + index,
        when: {},
        adjustment: { kind: "replace", amountMinor: unit.expectedPriceMinor },
        targetRuleKey: `unit-${unit.code.toLowerCase()}`,
      })),
      floorMinor: null,
      ceilingMinor: null,
      eligibleTargetRuleKeys: [],
    },
    composition: {
      currency: scenario.currency,
      guestEligibility: {
        minAdults: 1,
        maxAdults: scenario.maxGuests,
        minChildren: 0,
        maxChildren: scenario.maxGuests - 1,
        minTotalGuests: 1,
        maxTotalGuests: scenario.maxGuests,
      },
      package: null,
      promotions: [],
      policy: {
        cancellationPolicyId: null,
        depositPolicyId: null,
        guaranteePolicyId: null,
        noShowPolicyId: null,
        refundTreatment: "policy",
      },
      distribution: { mode: "all", channelCodes: [] },
    },
    rmsBinding: null,
  };
}

type InventoryUnit = Readonly<{ id: string; unitTypeId: string; unitTypeCode: string; status: string }>;
type ScenarioPreflight = Readonly<{
  representatives: ReadonlyMap<string, InventoryUnit>;
  retained: null | Readonly<{ releaseId: string; approvalId: string }>;
}>;

function previewCells(scenario: Scenario, sellableByUnit: ReadonlyMap<string, InventoryUnit>) {
  return scenario.units.map((unit) => {
    const sellable = sellableByUnit.get(unit.id);
    if (!sellable) throw new Error(`${scenario.code}/${unit.code} has no representative sellable unit`);
    return {
      key: `order536-${scenario.code.toLowerCase()}-${unit.code.toLowerCase()}`,
      evaluationContext: {
        propertyTimeZone: scenario.propertyTimeZone,
        bookingInstant: "2026-09-21T00:00:00.000Z",
        stayStartInstant: scenario.stayFrom,
        stayEndInstant: scenario.stayTo,
        nightDate: "2026-09-27",
      },
      targetContext: { unitTypeId: unit.id, sellableUnitId: sellable.id, commercial: {} },
      guests: { adults: 2, childAges: [] },
      selectedPromotionCodes: [],
      mandatoryPolicyEvidence: [],
      availabilityEvidence: {
        sellableUnitId: sellable.id,
        availableCount: 1,
        bookable: true,
        restrictionEvidence: [],
        operationalBlockEvidence: [],
        evidenceRef: `availability:yellow-order536:${scenario.code.toLowerCase()}:${unit.code.toLowerCase()}`,
      },
      channelCode: "direct",
      channelMappingEvidenceRef: null,
    };
  });
}

function assertSimulation(scenario: Scenario, body: unknown): void {
  const cells = array(object(object(body, "simulation response").simulation, "simulation").cells, "simulation cells");
  if (cells.length !== scenario.units.length) throw new Error(`${scenario.code} simulation cell count differs`);
  for (const unit of scenario.units) {
    const key = `order536-${scenario.code.toLowerCase()}-${unit.code.toLowerCase()}`;
    const cell = object(cells.find((candidate) => object(candidate, "simulation cell").key === key), `${key} cell`);
    const result = object(cell.result, `${key} result`);
    if (result.state !== "quoted" || result.preTaxSubtotalMinor !== unit.expectedPriceMinor) {
      throw new Error(`${scenario.code}/${unit.code} simulation did not quote the exact amount`);
    }
  }
}

async function authenticateRequester(): Promise<string> {
  const response = await jsonRequest("/api/v1/auth/demo:enter", null, { method: "POST", body: "{}" });
  const token = response.status === 200 ? object(response.body, "automatic demo entry").accessToken : null;
  if (typeof token !== "string" || token.length < 1) throw new Error(`Automatic demo entry failed with HTTP ${response.status}`);
  return token;
}

async function authenticateApprover(): Promise<string> {
  const tenant = process.env.YELLOW_LOCAL_REVIEW_TENANT;
  const password = process.env.YELLOW_REVIEW_APPROVER_PASSWORD;
  if (!tenant || !password) throw new Error("Protected reviewer credentials are unavailable");
  const response = await jsonRequest("/api/v1/auth/local:login", null, {
    method: "POST",
    body: JSON.stringify({ tenant, email: "approver@yellow.local", password }),
  });
  const token = response.status === 200 ? object(response.body, "approver login").accessToken : null;
  if (typeof token !== "string" || token.length < 1) throw new Error(`Distinct approver login failed with HTTP ${response.status}`);
  return token;
}

async function preflight(scenario: Scenario, token: string): Promise<ScenarioPreflight> {
  const [rates, inventory, builder] = await Promise.all([
    jsonRequest(`/api/v1/properties/${scenario.propertyId}/rate-configuration`, token),
    jsonRequest(`/api/v1/properties/${scenario.propertyId}/inventory`, token),
    jsonRequest(builderPath(scenario), token),
  ]);
  if (rates.status !== 200 || inventory.status !== 200 || builder.status !== 200) {
    throw new Error(`${scenario.code} configuration preflight failed`);
  }
  const plans = array(object(rates.body, "rate configuration").ratePlans, "rate plans").map((value) => object(value, "rate plan"));
  const plan = plans.find((value) => value.id === scenario.ratePlanId);
  if (!plan || plan.code !== "BAR" || plan.currency !== scenario.currency || plan.status !== "active") {
    throw new Error(`${scenario.code} BAR plan is not the exact expected active plan`);
  }
  const inventoryBody = object(inventory.body, "inventory");
  const unitTypes = array(inventoryBody.unitTypes, "unit types").map((value) => object(value, "unit type"));
  if (unitTypes.length !== scenario.units.length) throw new Error(`${scenario.code} unit-type count differs`);
  for (const unit of scenario.units) {
    const actual = unitTypes.find((value) => value.id === unit.id);
    if (!actual || actual.code !== unit.code) throw new Error(`${scenario.code}/${unit.code} unit type differs`);
    const priceQuery = new URLSearchParams({ ratePlanId: scenario.ratePlanId, unitTypeId: unit.id, stayDate: "2026-09-27" });
    const price = await jsonRequest(`/api/v1/properties/${scenario.propertyId}/rate-prices/current?${priceQuery}`, token);
    const ratePrice = price.status === 200 ? object(object(price.body, "current price").ratePrice, "rate price") : null;
    const pricing = ratePrice ? object(ratePrice.pricing, "pricing") : null;
    const occupancy = pricing ? object(pricing.occupancy, "occupancy pricing") : null;
    if (!ratePrice || ratePrice.ratePlanId !== scenario.ratePlanId || ratePrice.unitTypeId !== unit.id ||
        ratePrice.currency !== scenario.currency || occupancy?.["2"] !== unit.expectedPriceMinor) {
      throw new Error(`${scenario.code}/${unit.code} current price evidence is not exact`);
    }
  }
  const builderBody = object(builder.body, "rate builder");
  const modelDrafts = array(builderBody.modelDrafts, "model drafts");
  const targetDrafts = array(builderBody.targetDrafts, "target drafts");
  const releases = array(builderBody.releases, "releases").map((value) => object(value, "release"));
  let retained: ScenarioPreflight["retained"] = null;
  if (scenario.code === "LOCANDA") {
    const model = modelDrafts.length === 1 ? object(modelDrafts[0], "retained model") : null;
    const target = targetDrafts.length === 1 ? object(targetDrafts[0], "retained target") : null;
    if (!model || !target || releases.length !== 1 || model.id !== RETAINED_LOCANDA.modelId ||
        target.id !== RETAINED_LOCANDA.targetId || releases[0]?.id !== RETAINED_LOCANDA.releaseId ||
        releases[0]?.status !== "draft" ||
        !same(releases[0]?.authoringCommand, command(scenario))) {
      throw new Error(`${scenario.code} release history is not the exact retained recovery state`);
    }
    const inbox = await jsonRequest(builderPath(scenario, "/approvals?limit=2"), token);
    if (inbox.status !== 200) throw new Error(`${scenario.code} retained approval inbox is unavailable`);
    const approvals = array(object(inbox.body, "retained approval inbox").approvals, "retained approvals").map((value) => object(value, "retained approval"));
    const releaseId = String(releases[0]?.id ?? "");
    if (approvals.length !== 1 || approvals[0]?.id !== RETAINED_LOCANDA.approvalId ||
        !approvals[0]?.requestedBy || object(approvals[0]?.requestedBy, "retained requester").id !== RETAINED_LOCANDA.requestedBy ||
        approvals[0]?.releaseId !== releaseId || approvals[0]?.status !== "pending" ||
        approvals[0]?.canDecide !== false || approvals[0]?.canPublish !== false) {
      throw new Error(`${scenario.code} pending approval is not the exact retained recovery state`);
    }
    retained = Object.freeze({ releaseId, approvalId: String(approvals[0]?.id ?? "") });
    if (!retained.releaseId || !retained.approvalId) throw new Error(`${scenario.code} retained identifiers are missing`);
  } else if (modelDrafts.length !== 0 || targetDrafts.length !== 0 || releases.length !== 0) {
    throw new Error(`${scenario.code} release history must remain empty before fresh execution`);
  }
  const sellables = array(inventoryBody.sellableUnits, "sellable units")
    .map((value) => object(value, "sellable unit") as unknown as InventoryUnit)
    .filter((value) => value.status === "active");
  const representatives = new Map<string, InventoryUnit>();
  for (const unit of scenario.units) {
    const matches = sellables.filter((value) => value.unitTypeId === unit.id && value.unitTypeCode === unit.code);
    if (matches.length < 1) throw new Error(`${scenario.code}/${unit.code} has no active sellable unit`);
    representatives.set(unit.id, matches[0]!);
  }
  return Object.freeze({ representatives, retained });
}

async function mutate(
  path: string,
  token: string,
  key: string,
  body: unknown,
  expectedStatus: number,
): Promise<JsonResult> {
  return jsonRequest(path, token, {
    method: "POST",
    headers: { "idempotency-key": key },
    body: JSON.stringify(body),
  }).then((result) => {
    if (result.status !== expectedStatus) throw new Error(`${path} returned HTTP ${result.status}`);
    return result;
  });
}

async function applyScenario(
  scenario: Scenario,
  requesterToken: string,
  approverToken: string,
  preflightState: ScenarioPreflight,
): Promise<number> {
  const exactCommand = command(scenario);
  const prefix = `yellow-order536-${scenario.code.toLowerCase()}`;
  const cells = previewCells(scenario, preflightState.representatives);
  let releaseId = preflightState.retained?.releaseId ?? "";
  let approvalId = preflightState.retained?.approvalId ?? "";
  if (preflightState.retained !== null) {
    const draftReplay = await mutate(builderPath(scenario, "/releases"), requesterToken, `${prefix}-draft`, exactCommand, 201);
    const replayRelease = object(object(draftReplay.body, "retained draft replay").release, "retained release");
    if (!draftReplay.replayed || replayRelease.id !== releaseId) throw new Error(`${scenario.code} retained draft idempotency evidence differs`);
    const requestReplay = await mutate(builderPath(scenario, `/releases/${releaseId}/approval-request`), requesterToken,
      `${prefix}-approval-request`, { previewCells: cells }, 201);
    const replayApproval = object(object(requestReplay.body, "retained request replay").approval, "retained approval");
    if (!requestReplay.replayed || replayApproval.id !== approvalId) throw new Error(`${scenario.code} retained approval idempotency evidence differs`);
  } else {
    const drafted = await mutate(builderPath(scenario, "/releases"), requesterToken, `${prefix}-draft`, exactCommand, 201);
    if (drafted.replayed) throw new Error(`${scenario.code} first draft command unexpectedly replayed`);
    const draftReplay = await mutate(builderPath(scenario, "/releases"), requesterToken, `${prefix}-draft`, exactCommand, 201);
    if (!draftReplay.replayed || !same(drafted.body, draftReplay.body)) throw new Error(`${scenario.code} draft replay differs`);
    const release = object(object(drafted.body, "draft response").release, "release");
    releaseId = String(release.id ?? "");
    if (!releaseId) throw new Error(`${scenario.code} draft returned no release`);
    const current = await jsonRequest(builderPath(scenario), requesterToken);
    const releases = array(object(current.body, "current builder").releases, "current releases").map((value) => object(value, "current release"));
    if (releases.length !== 1 || releases[0]?.id !== releaseId || !same(releases[0]?.authoringCommand, exactCommand)) {
      throw new Error(`${scenario.code} reconstructed authoring command differs`);
    }
  }
  const simulated = await jsonRequest(builderPath(scenario, `/releases/${releaseId}/simulate`), requesterToken, {
    method: "POST", body: JSON.stringify({ previewCells: cells }),
  });
  if (simulated.status !== 200) throw new Error(`${scenario.code} simulation returned HTTP ${simulated.status}`);
  assertSimulation(scenario, simulated.body);

  if (preflightState.retained === null) {
    const approvalBody = { previewCells: cells };
    const requested = await mutate(builderPath(scenario, `/releases/${releaseId}/approval-request`), requesterToken,
      `${prefix}-approval-request`, approvalBody, 201);
    if (requested.replayed) throw new Error(`${scenario.code} first approval request unexpectedly replayed`);
    const requestReplay = await mutate(builderPath(scenario, `/releases/${releaseId}/approval-request`), requesterToken,
      `${prefix}-approval-request`, approvalBody, 201);
    if (!requestReplay.replayed || !same(requested.body, requestReplay.body)) throw new Error(`${scenario.code} approval-request replay differs`);
    approvalId = String(object(object(requested.body, "approval request").approval, "approval").id ?? "");
    if (!approvalId) throw new Error(`${scenario.code} approval request returned no approval`);
    const requesterInbox = await jsonRequest(builderPath(scenario, "/approvals?limit=1"), requesterToken);
    const requesterApproval = object(array(object(requesterInbox.body, "requester inbox").approvals, "requester approvals")[0], "requester approval");
    if (requesterApproval.id !== approvalId || requesterApproval.canDecide !== false || requesterApproval.canPublish !== false) {
      throw new Error(`${scenario.code} requester unexpectedly gained approval authority`);
    }
    const selfDecision = await mutate(builderPath(scenario, `/approvals/${approvalId}/decision`), requesterToken,
      `${prefix}-requester-decision-denied`, { decision: "approved" }, 409);
    if (selfDecision.replayed) throw new Error(`${scenario.code} denied requester decision unexpectedly replayed`);
  }

  const approverInbox = await jsonRequest(builderPath(scenario, "/approvals?limit=1"), approverToken);
  const approverPending = object(array(object(approverInbox.body, "approver inbox").approvals, "approver approvals")[0], "approver approval");
  if (approverPending.id !== approvalId || approverPending.canDecide !== true || approverPending.canPublish !== false) {
    throw new Error(`${scenario.code} distinct approver cannot decide the pending request`);
  }
  const decisionBody = { decision: "approved" };
  const decided = await mutate(builderPath(scenario, `/approvals/${approvalId}/decision`), approverToken,
    `${prefix}-approval-decision`, decisionBody, 200);
  if (decided.replayed) throw new Error(`${scenario.code} first decision unexpectedly replayed`);
  const decisionReplay = await mutate(builderPath(scenario, `/approvals/${approvalId}/decision`), approverToken,
    `${prefix}-approval-decision`, decisionBody, 200);
  if (!decisionReplay.replayed || !same(decided.body, decisionReplay.body)) throw new Error(`${scenario.code} decision replay differs`);

  const selfPublish = await mutate(builderPath(scenario, `/releases/${releaseId}/publish`), requesterToken,
    `${prefix}-requester-publish-denied`, { approvalId, previewCells: cells }, 409);
  if (selfPublish.replayed) throw new Error(`${scenario.code} denied requester publication unexpectedly replayed`);
  const refreshed = await jsonRequest(builderPath(scenario, `/releases/${releaseId}/simulate`), approverToken, {
    method: "POST", body: JSON.stringify({ previewCells: cells }),
  });
  if (refreshed.status !== 200) throw new Error(`${scenario.code} refreshed simulation failed`);
  assertSimulation(scenario, refreshed.body);

  const publishBody = { approvalId, previewCells: cells };
  const published = await mutate(builderPath(scenario, `/releases/${releaseId}/publish`), approverToken,
    `${prefix}-publish`, publishBody, 201);
  if (published.replayed || object(object(published.body, "publish response").release, "published release").status !== "active") {
    throw new Error(`${scenario.code} release did not become active`);
  }
  const publishReplay = await mutate(builderPath(scenario, `/releases/${releaseId}/publish`), approverToken,
    `${prefix}-publish`, publishBody, 201);
  if (!publishReplay.replayed || !same(published.body, publishReplay.body)) throw new Error(`${scenario.code} publish replay differs`);

  const availability = await jsonRequest(`/api/v1/properties/${scenario.propertyId}/availability:search`, requesterToken, {
    method: "POST",
    body: JSON.stringify({
      stay: { from: scenario.stayFrom, to: scenario.stayTo },
      party: { adults: 2, children: [] },
      channel: "direct",
    }),
  });
  if (availability.status !== 200) throw new Error(`${scenario.code} availability returned HTTP ${availability.status}`);
  const offers = array(object(availability.body, "availability").options, "availability options").map((value) => object(value, "offer"));
  if (offers.length !== scenario.units.length) throw new Error(`${scenario.code} did not return one offer per room type`);
  for (const unit of scenario.units) {
    const offer = offers.find((value) => object(value.unit_type, "offer unit type").code === unit.code);
    const total = offer ? object(offer.total, "offer total") : null;
    if (!offer || offer.bookable !== true || offer.promise !== false || offer.commit_arbitration_required !== true ||
        total?.amount_minor !== unit.expectedPriceMinor || total.currency !== scenario.currency) {
      throw new Error(`${scenario.code}/${unit.code} canonical offer differs`);
    }
  }
  return offers.length;
}

const requesterToken = await authenticateRequester();
const approverToken = apply ? await authenticateApprover() : null;
if (approverToken) {
  for (const scenario of scenarios) {
    const [builderAccess, approvalAccess] = await Promise.all([
      jsonRequest(builderPath(scenario), approverToken),
      jsonRequest(builderPath(scenario, "/approvals?limit=2"), approverToken),
    ]);
    if (builderAccess.status !== 200 || approvalAccess.status !== 200) {
      throw new Error(`${scenario.code} approver property authority is unavailable before mutation`);
    }
  }
}
const preflights = new Map<string, ScenarioPreflight>();
for (const scenario of scenarios) preflights.set(scenario.code, await preflight(scenario, requesterToken));

if (!apply) {
  console.log(JSON.stringify({ mode: "preflight", properties: scenarios.length, unitTypes: scenarios.reduce((sum, value) => sum + value.units.length, 0),
    retainedReleases: [...preflights.values()].filter(({ retained }) => retained !== null).length }));
  process.exit(0);
}

const offerCounts: Record<string, number> = {};
for (const scenario of scenarios) {
  offerCounts[scenario.code] = await applyScenario(scenario, requesterToken, approverToken!, preflights.get(scenario.code)!);
}
console.log(JSON.stringify({ mode: "applied", properties: scenarios.length, activeReleases: scenarios.length, offerCounts }));
