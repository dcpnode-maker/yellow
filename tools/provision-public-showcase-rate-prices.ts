const baseUrl = process.env.YELLOW_RATE_PROVISION_BASE_URL ?? "http://127.0.0.1:3010";
const apply = process.argv.includes("--apply");
const stayStart = "2026-09-21";
const stayEnd = "2027-09-22";
const dowMask = 127;

type RateRow = Readonly<{
  propertyId: string;
  propertyCode: "LOCANDA" | "LONDON";
  ratePlanId: string;
  unitTypeId: string;
  unitCode: string;
  currency: "SAR" | "GBP";
  occupancy: readonly string[];
}>;

const rows: readonly RateRow[] = [
  { propertyId: "6081b544-22a1-534f-a86d-bb1ae0519e14", propertyCode: "LOCANDA", ratePlanId: "3622192a-2f53-5382-b7e2-6fbf15480ae1", unitTypeId: "e398e16e-5d5c-5cab-b62b-35815cf9368c", unitCode: "L1BR", currency: "SAR", occupancy: ["75000", "85000"] },
  { propertyId: "6081b544-22a1-534f-a86d-bb1ae0519e14", propertyCode: "LOCANDA", ratePlanId: "3622192a-2f53-5382-b7e2-6fbf15480ae1", unitTypeId: "6e3aca45-0174-560a-915e-0f143931d402", unitCode: "L2BR", currency: "SAR", occupancy: ["125000", "125000", "140000", "155000"] },
  { propertyId: "6081b544-22a1-534f-a86d-bb1ae0519e14", propertyCode: "LOCANDA", ratePlanId: "3622192a-2f53-5382-b7e2-6fbf15480ae1", unitTypeId: "88d8d4b3-9e18-555a-8c31-69401c9e996b", unitCode: "LPH", currency: "SAR", occupancy: ["250000", "250000", "270000", "290000", "310000", "330000"] },
  { propertyId: "01e4e102-c54f-5205-9542-d84d103084f8", propertyCode: "LONDON", ratePlanId: "4e57039b-dd54-5abc-8e30-258884a5d048", unitTypeId: "98e568f5-f4bc-5976-ba7a-077cb4223b51", unitCode: "KING", currency: "GBP", occupancy: ["18000", "20500"] },
  { propertyId: "01e4e102-c54f-5205-9542-d84d103084f8", propertyCode: "LONDON", ratePlanId: "4e57039b-dd54-5abc-8e30-258884a5d048", unitTypeId: "931fc733-9a84-53fb-a612-7751f7e116b5", unitCode: "DLX", currency: "GBP", occupancy: ["24000", "27000"] },
  { propertyId: "01e4e102-c54f-5205-9542-d84d103084f8", propertyCode: "LONDON", ratePlanId: "4e57039b-dd54-5abc-8e30-258884a5d048", unitTypeId: "06b002d4-1a0d-52b2-9a71-dfb7110fb008", unitCode: "STE", currency: "GBP", occupancy: ["42000", "46000", "50000"] },
];

type JsonResult = Readonly<{ status: number; body: unknown; replayed: boolean }>;

async function jsonRequest(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<JsonResult> {
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

function occupancyBody(row: RateRow): readonly Readonly<{ adults: number; amountMinor: string }>[] {
  return row.occupancy.map((amountMinor, index) => ({ adults: index + 1, amountMinor }));
}

function expectedOccupancy(row: RateRow): Record<string, string> {
  return Object.fromEntries(row.occupancy.map((amount, index) => [String(index + 1), amount]));
}

function expectedPricing(row: RateRow): Readonly<Record<string, unknown>> {
  return { occupancy: expectedOccupancy(row), extraAdultMinor: null, extraChildren: [] };
}

function stayDates(): readonly string[] {
  const dates: string[] = [];
  for (let day = new Date(`${stayStart}T00:00:00.000Z`); day < new Date(`${stayEnd}T00:00:00.000Z`); day = new Date(day.getTime() + 86_400_000)) {
    dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
}

function currentPath(row: RateRow, stayDate: string): string {
  const query = new URLSearchParams({
    ratePlanId: row.ratePlanId,
    unitTypeId: row.unitTypeId,
    stayDate,
  });
  return `/api/v1/properties/${row.propertyId}/rate-prices/current?${query}`;
}

function isExact(row: RateRow, body: unknown): boolean {
  if (!body || typeof body !== "object" || !("ratePrice" in body)) return false;
  const price = (body as { ratePrice?: Record<string, unknown> }).ratePrice;
  if (!price) return false;
  const pricing = price.pricing as Record<string, unknown> | undefined;
  const actualPricing = pricing ? {
    occupancy: pricing.occupancy,
    extraAdultMinor: pricing.extraAdultMinor,
    extraChildren: pricing.extraChildren,
  } : null;
  return price.ratePlanId === row.ratePlanId &&
    price.unitTypeId === row.unitTypeId &&
    price.stayStart === stayStart &&
    price.stayEnd === stayEnd &&
    price.dowMask === dowMask &&
    price.currency === row.currency &&
    Object.keys(pricing ?? {}).sort().join(",") === "extraAdultMinor,extraChildren,occupancy" &&
    JSON.stringify(actualPricing) === JSON.stringify(expectedPricing(row));
}

const auth = await jsonRequest("/api/v1/auth/demo:enter", null, {
  method: "POST",
  body: "{}",
});
if (auth.status !== 200 || !auth.body || typeof auth.body !== "object" || !("accessToken" in auth.body)) {
  throw new Error(`Automatic demo entry failed with HTTP ${auth.status}`);
}
const token = String((auth.body as { accessToken: unknown }).accessToken);
if (!token) throw new Error("Automatic demo entry returned no token");

const existing = new Set<string>();
const dates = stayDates();
for (const row of rows) {
  const results: JsonResult[] = [];
  for (let offset = 0; offset < dates.length; offset += 28) {
    results.push(...await Promise.all(dates.slice(offset, offset + 28).map((date) => jsonRequest(currentPath(row, date), token))));
  }
  const present = results.filter((current) => current.status !== 404);
  const exact = present.filter((current) => current.status === 200 && isExact(row, current.body));
  if (present.length === 0) continue;
  if (present.some((current) => current.status !== 200) || exact.length !== dates.length) {
    throw new Error(`${row.propertyCode}/${row.unitCode} has conflicting or partial current coverage; no writes attempted`);
  }
  const ids = new Set(exact.map((current) => {
    const wrapper = current.body as { ratePrice: { id: unknown } };
    return String(wrapper.ratePrice.id);
  }));
  if (ids.size !== 1) throw new Error(`${row.propertyCode}/${row.unitCode} resolves multiple current price IDs; no writes attempted`);
  existing.add(`${row.propertyCode}/${row.unitCode}`);
}

if (!apply) {
  console.log(JSON.stringify({ mode: "preflight", planned: rows.length - existing.size, exactExisting: existing.size, currentDateChecks: dates.length * rows.length }));
  process.exit(0);
}

for (const row of rows) {
  const label = `${row.propertyCode}/${row.unitCode}`;
  if (existing.has(label)) continue;
  const created = await jsonRequest(`/api/v1/properties/${row.propertyId}/rate-prices`, token, {
    method: "POST",
    headers: { "idempotency-key": `yellow-order535-${row.propertyCode.toLowerCase()}-${row.unitCode.toLowerCase()}-20260921` },
    body: JSON.stringify({
      ratePlanId: row.ratePlanId,
      unitTypeId: row.unitTypeId,
      stayStart,
      stayEnd,
      dowMask,
      pricing: { occupancy: occupancyBody(row) },
    }),
  });
  if (created.status !== 201) throw new Error(`${label} create returned HTTP ${created.status}`);
}

for (const row of rows) {
  const current = await jsonRequest(currentPath(row, stayStart), token);
  if (current.status !== 200 || !isExact(row, current.body)) {
    throw new Error(`${row.propertyCode}/${row.unitCode} exact postflight failed`);
  }
}

const availabilityChecks = [
  { propertyCode: "LOCANDA", propertyId: rows[0]!.propertyId, from: "2026-09-27T12:00:00.000Z", to: "2026-09-28T08:00:00.000Z" },
  { propertyCode: "LONDON", propertyId: rows[3]!.propertyId, from: "2026-09-27T14:00:00.000Z", to: "2026-09-28T10:00:00.000Z" },
] as const;

const offerCounts: Record<string, number> = {};
for (const check of availabilityChecks) {
  const result = await jsonRequest(`/api/v1/properties/${check.propertyId}/availability:search`, token, {
    method: "POST",
    body: JSON.stringify({
      stay: { from: check.from, to: check.to },
      party: { adults: 2, children: [] },
      channel: "direct",
    }),
  });
  if (result.status !== 200 || !result.body || typeof result.body !== "object") {
    throw new Error(`${check.propertyCode} availability returned HTTP ${result.status}`);
  }
  const options = ((result.body as { options?: unknown[] }).options ?? []).filter((option) => {
    if (!option || typeof option !== "object") return false;
    const value = option as Record<string, unknown>;
    return value.bookable === true && value.promise === false &&
      value.commit_arbitration_required === true && value.total !== null;
  });
  if (!options.length) throw new Error(`${check.propertyCode} still has no canonical bookable priced offer`);
  offerCounts[check.propertyCode] = options.length;
}

console.log(JSON.stringify({ mode: "applied", rows: rows.length, exactExisting: existing.size, offerCounts }));
