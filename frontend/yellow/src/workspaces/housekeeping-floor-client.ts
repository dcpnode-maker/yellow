import { parseConditionPage, parseTask, parseTaskPage, type ConditionPage, type HousekeepingTaskRow } from "../housekeeping-floor-model";

export type TokenProvider = () => Promise<string>;
export type HousekeepingFloorClientOptions = Readonly<{
  propertyId: string; getToken: TokenProvider; fetcher?: typeof fetch;
}>;
export class HousekeepingFloorRequestError extends Error {
  constructor(message: string, readonly status: number | null = null, readonly scopeChanged = false) { super(message); this.name = "HousekeepingFloorRequestError"; }
}
type ReadScope = Readonly<{ token: string; epoch: number }>;
export function createHousekeepingFloorClient(options: HousekeepingFloorClientOptions) {
  const fetcher = options.fetcher ?? fetch;
  let activeToken: string | null = null;
  let epoch = 0;
  const changed = () => new HousekeepingFloorRequestError("Housekeeping access changed; reload current data.", null, true);
  function assertScope(scope: ReadScope): void {
    if (epoch !== scope.epoch || activeToken !== scope.token) throw changed();
  }
  async function begin(expectedToken?: string): Promise<ReadScope> {
    const started = epoch;
    const token = await options.getToken();
    // Invalidation while acquiring a token must never resurrect a revoked read.
    if (epoch !== started) throw changed();
    if (typeof token !== "string" || !token) { activeToken = null; epoch++; throw changed(); }
    if (expectedToken !== undefined) {
      if (token !== expectedToken || activeToken !== expectedToken) { activeToken = null; epoch++; throw changed(); }
    } else if (activeToken !== token) { activeToken = token; epoch++; }
    return Object.freeze({ token, epoch });
  }
  async function request(path: string, scope: ReadScope): Promise<unknown> {
    assertScope(scope);
    let response: Response;
    try { response = await fetcher(`/api/v1/properties/${encodeURIComponent(options.propertyId)}${path}`, {
      cache: "no-store", headers: { authorization: `Bearer ${scope.token}` },
    }); } catch { assertScope(scope); throw new HousekeepingFloorRequestError("Housekeeping data could not be reached."); }
    assertScope(scope);
    if (response.status !== 200) throw new HousekeepingFloorRequestError(`Housekeeping data is unavailable (${response.status}).`, response.status);
    let raw: unknown;
    try { raw = await response.json(); }
    catch { assertScope(scope); throw new HousekeepingFloorRequestError("Housekeeping data response was incomplete.", response.status); }
    assertScope(scope);
    const currentToken = await options.getToken();
    assertScope(scope);
    if (currentToken !== scope.token) { activeToken = null; epoch++; throw changed(); }
    return raw;
  }
  async function conditionsInScope(cursor: string | null, scope: ReadScope): Promise<ConditionPage> {
    const query = new URLSearchParams({ limit: "100", ...(cursor === null ? {} : { cursor }) });
    const raw = await request(`/housekeeping/conditions?${query}`, scope);
    assertScope(scope);
    return parseConditionPage(raw);
  }
  async function tasksInScope(scope: ReadScope): Promise<readonly HousekeepingTaskRow[]> {
    const raw = await request("/housekeeping/tasks?limit=200", scope);
    assertScope(scope);
    return parseTaskPage(raw);
  }
  return Object.freeze({
    async snapshot(): Promise<Readonly<{ page: ConditionPage; tasks: readonly HousekeepingTaskRow[]; token: string }>> {
      const scope = await begin();
      const [page, tasks] = await Promise.all([conditionsInScope(null, scope), tasksInScope(scope)]);
      assertScope(scope);
      return Object.freeze({ page, tasks, token: scope.token });
    },
    async conditions(cursor: string | null, expectedToken?: string): Promise<Readonly<{ page: ConditionPage; token: string }>> {
      // A subsequent page is always bound to the initial page, even if its caller omits the token.
      const expected = expectedToken ?? (cursor === null ? undefined : activeToken ?? undefined);
      if (cursor !== null && expected === undefined) throw changed();
      const scope = await begin(expected);
      const page = await conditionsInScope(cursor, scope);
      assertScope(scope);
      return Object.freeze({ page, token: scope.token });
    },
    async tasks(expectedToken?: string): Promise<Readonly<{ tasks: readonly HousekeepingTaskRow[]; token: string }>> {
      const scope = await begin(expectedToken);
      const tasks = await tasksInScope(scope);
      assertScope(scope);
      return Object.freeze({ tasks, token: scope.token });
    },
    async task(taskId: string, expectedToken?: string): Promise<HousekeepingTaskRow> {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(taskId))
        throw new HousekeepingFloorRequestError("The housekeeping task identifier is invalid.");
      const scope = await begin(expectedToken);
      const raw = await request(`/housekeeping/tasks/${encodeURIComponent(taskId)}`, scope);
      if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).length !== 1 || !("task" in raw))
        throw new HousekeepingFloorRequestError("Housekeeping task detail is incoherent.");
      const parsed = parseTask((raw as { task: unknown }).task);
      if (parsed.taskId.toLowerCase() !== taskId.toLowerCase()) throw new HousekeepingFloorRequestError("Housekeeping task detail did not match the requested task.");
      assertScope(scope);
      return parsed;
    },
    invalidateScope(): void { epoch++; activeToken = null; },
  });
}
export type HousekeepingFloorClient = ReturnType<typeof createHousekeepingFloorClient>;
