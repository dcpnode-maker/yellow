type RequestOptions = Readonly<{
  method?: "GET" | "POST";
  body?: unknown;
  token?: string;
  idempotencyKey?: string;
}>;

const baseUrl = (process.env.YELLOW_PUBLIC_DEMO_URL ?? "https://lying-jones-terminal-church.trycloudflare.com").replace(/\/+$/u, "");
const propertyId = process.env.YELLOW_DEMO_PROPERTY_ID ?? "6081b544-22a1-534f-a86d-bb1ae0519e14";
const reservationId = process.env.YELLOW_FINANCE_PROOF_RESERVATION_ID ?? "9f483430-d582-5364-ba49-55d9e651cf77";
const folioId = process.env.YELLOW_FINANCE_PROOF_FOLIO_ID ?? "2160af77-e84a-433d-b803-5b7c105d374a";
const txCode = process.env.YELLOW_FINANCE_PROOF_TX_CODE ?? "L3R_BEVERAGE";
const amountMinor = process.env.YELLOW_FINANCE_PROOF_AMOUNT_MINOR ?? "123";
const quantity = process.env.YELLOW_FINANCE_PROOF_QUANTITY ?? "1";
const idempotencyKey = process.env.YELLOW_FINANCE_PROOF_IDEMPOTENCY_KEY ?? "order640-public-finance-posting-v1";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sameDecimal(left: unknown, right: string): boolean {
  return typeof left === "string" && Number(left) === Number(right);
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  headers.set("accept", "application/json");
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  if (options.idempotencyKey) headers.set("idempotency-key", options.idempotencyKey);
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  return (text.length ? JSON.parse(text) : null) as T;
}

const login = asRecord(await requestJson("/api/v1/auth/demo:enter", { method: "POST" }));
const token = login.accessToken;
assert(typeof token === "string" && token.length > 20, "Demo login did not return a usable access token.");

const before = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/folios/${encodeURIComponent(folioId)}/statement`, { token }));
const beforeFolio = asRecord(before.folio);
assert(before.reservationId === reservationId, "Finance proof folio is no longer attached to the expected synthetic reservation.");
assert(beforeFolio.id === folioId && beforeFolio.status === "open", "Finance proof folio is not the expected open folio.");
assert(asRecord(before.chargeAvailability).allowed === true, "Finance proof folio is not chargeable.");
assert(asArray(before.chargeOptions).map(asRecord).some((option) => option.code === txCode), "Finance proof transaction code is not available.");

const receipt = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/folios/${encodeURIComponent(folioId)}/charges`, {
  method: "POST",
  token,
  idempotencyKey,
  body: { txCode, amountMinor, quantity },
}));
assert(receipt.folioId === folioId, "Charge receipt folio does not match the requested folio.");
assert(receipt.txCode === txCode, "Charge receipt transaction code does not match the requested code.");
assert(receipt.amountMinor === amountMinor, "Charge receipt amount does not match the requested amount.");
assert(sameDecimal(receipt.quantity, quantity), "Charge receipt quantity does not match the requested quantity.");
assert(typeof receipt.journalId === "string" && /^[0-9a-f-]{36}$/iu.test(receipt.journalId), "Charge receipt did not include a journal id.");
assert(typeof receipt.businessDate === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(receipt.businessDate), "Charge receipt did not include a business date.");
assert(typeof receipt.currency === "string" && /^[A-Z]{3}$/u.test(receipt.currency), "Charge receipt did not include an ISO currency.");
assert(typeof receipt.replayed === "boolean", "Charge receipt replay flag is not boolean.");

const after = asRecord(await requestJson(`/api/v1/properties/${encodeURIComponent(propertyId)}/folios/${encodeURIComponent(folioId)}/statement`, { token }));
const rows = asArray(after.rows).map(asRecord);
const matchingRows = rows.filter((row) =>
  row.journalId === receipt.journalId &&
  row.txCode === txCode &&
  row.amountMinor === amountMinor &&
  row.kind === "charge");
assert(matchingRows.length === 1, "Authoritative folio statement does not contain exactly one matching charge row.");

console.table([{
  reservationId,
  folioId,
  txCode,
  amountMinor,
  currency: receipt.currency,
  businessDate: receipt.businessDate,
  journalId: receipt.journalId,
  replayed: receipt.replayed,
  statementRows: rows.length,
}]);
