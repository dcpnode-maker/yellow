import {
  createAuditEnvelope,
  recordFact,
  type AuditEnvelope,
  type Database,
  type EventBus,
} from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_POLL_INTERVAL_MS = 100;
const MAX_POLL_INTERVAL_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_SCOPE_BATCH_SIZE = 100;
const MAX_SCOPE_BATCH_SIZE = 100;

export const BUSINESS_DAY_ROLL_ACTOR_ID = "00000000-0000-0000-0000-000000000061";

export interface DueBusinessDayScope {
  readonly tenantId: string;
  readonly propertyNode: string;
}

export interface DueBusinessDayScopeSource {
  listDueScopes(limit: number): Promise<readonly DueBusinessDayScope[]>;
}

export interface OpenCurrentBusinessDayInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly envelope: AuditEnvelope;
}

export interface BusinessDayRollResult extends DueBusinessDayScope {
  readonly businessDate: string;
  readonly opened: boolean;
}

export interface BusinessDayRollServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
}

export interface BusinessDayRollWorkerOptions {
  readonly actorId?: string;
  readonly pollIntervalMs?: number;
  readonly scopeBatchSize?: number;
}

export interface BusinessDayRollFailure extends DueBusinessDayScope {
  readonly error: string;
}

export interface BusinessDayRollDrainResult {
  readonly scopes: number;
  readonly opened: number;
  readonly failures: readonly BusinessDayRollFailure[];
}

export interface BusinessDayRollRunOptions {
  readonly signal?: AbortSignal;
  readonly onPoll?: (startedAt: number) => void;
  readonly onResult?: (result: BusinessDayRollDrainResult) => void;
  readonly onError?: (error: unknown) => void;
}

interface OpenedDayRow {
  readonly business_date: string;
  readonly opened_at: Date;
  readonly opened: boolean;
}

type BusinessDayRollOperations = Pick<BusinessDayRollService, "openCurrentBusinessDay">;

export class BusinessDayRollValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessDayRollValidationError";
  }
}

export class BusinessDayRollNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessDayRollNotFoundError";
  }
}

function plain(value: unknown, subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new BusinessDayRollValidationError(`${subject} must be a plain object`);
  }
}

function exact(value: Record<string, unknown>, required: readonly string[], subject: string): void {
  const actual = Object.keys(value);
  if (required.some((key) => !Object.hasOwn(value, key)) || actual.some((key) => !required.includes(key))) {
    throw new BusinessDayRollValidationError(`${subject} shape is invalid`);
  }
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new BusinessDayRollValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}

function bounded(name: string, value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new BusinessDayRollValidationError(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value as number;
}

function normalize(input: OpenCurrentBusinessDayInput): OpenCurrentBusinessDayInput {
  plain(input, "business-day roll input");
  exact(input, ["tenantId", "propertyNode", "envelope"], "business-day roll input");
  plain(input.envelope, "business-day roll envelope");
  exact(input.envelope, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], "business-day roll envelope");
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  if (uuid(input.envelope.tenantId, "envelope.tenantId") !== tenantId ||
      uuid(input.envelope.propertyNode, "envelope.propertyNode") !== propertyNode ||
      input.envelope.operation !== "business_day.opened") {
    throw new BusinessDayRollValidationError("business-day roll envelope is not bound to business_day.opened");
  }
  return Object.freeze({
    tenantId,
    propertyNode,
    envelope: Object.freeze({
      actorId: uuid(input.envelope.actorId, "envelope.actorId"),
      tenantId,
      propertyNode,
      requestId: uuid(input.envelope.requestId, "envelope.requestId"),
      operation: "business_day.opened",
    }),
  });
}

function storedDate(value: unknown): string {
  if (typeof value !== "string" || !DATE.test(value)) throw new Error("Database returned an invalid business date");
  return value;
}

export class BusinessDayRollService {
  readonly #database: Database;
  readonly #events: EventBus;

  constructor(options: BusinessDayRollServiceOptions) {
    this.#database = options.database;
    this.#events = options.events;
  }

  async openCurrentBusinessDay(input: OpenCurrentBusinessDayInput): Promise<BusinessDayRollResult> {
    const normalized = normalize(input);
    try {
      return await this.#database.withTenantTransaction(normalized.tenantId, async (tx) => {
      const inserted = await tx<OpenedDayRow[]>`
        SELECT business_date::text, opened_at, opened
          FROM open_current_business_day(${normalized.tenantId}::uuid, ${normalized.propertyNode}::uuid)
      `;
      const opened = inserted[0];
      if (inserted.length !== 1 || !opened) throw new BusinessDayRollNotFoundError("Current business day could not be opened");
      const businessDate = storedDate(opened.business_date);
      if (!opened.opened) return Object.freeze({ tenantId: normalized.tenantId,
        propertyNode: normalized.propertyNode, businessDate, opened: false });
      const payload = Object.freeze({
        property_node: normalized.propertyNode,
        business_date: storedDate(opened.business_date),
        opened_at: opened.opened_at.toISOString(),
      });
      const fact = await recordFact(tx, {
        entityType: "business_day",
        entityId: normalized.propertyNode,
        envelope: normalized.envelope,
        payload,
      });
      if (fact.businessDate !== businessDate) throw new Error("Business-day roll fact date is incoherent");
      await this.#events.publish(tx, {
        tenantId: normalized.tenantId,
        propertyNode: normalized.propertyNode,
        businessDate,
        aggregateType: "business_day",
        aggregateId: normalized.propertyNode,
        eventType: "business_day.opened",
        actorId: normalized.envelope.actorId,
        correlationId: normalized.envelope.requestId,
        payload,
      });
      return Object.freeze({
        tenantId: normalized.tenantId,
        propertyNode: normalized.propertyNode,
        businessDate,
        opened: true,
      });
      });
    } catch (error) {
      if (error instanceof BusinessDayRollValidationError || error instanceof BusinessDayRollNotFoundError) throw error;
      const state = (error as { errno?: unknown; code?: unknown }).errno ??
        (error as { code?: unknown }).code;
      if (state === "P0002") {
        throw new BusinessDayRollNotFoundError("Active tenant property with a valid timezone was not found");
      }
      throw error;
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown business-day roll failure";
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
    const timer = setTimeout(finish, milliseconds);
    const abort = () => { clearTimeout(timer); finish(); };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export class BusinessDayRollWorker {
  readonly #rolls: BusinessDayRollOperations;
  readonly #source: DueBusinessDayScopeSource;
  readonly #actorId: string;
  readonly #pollIntervalMs: number;
  readonly #scopeBatchSize: number;

  constructor(
    rolls: BusinessDayRollOperations,
    source: DueBusinessDayScopeSource,
    options: BusinessDayRollWorkerOptions = {},
  ) {
    this.#rolls = rolls;
    this.#source = source;
    this.#actorId = uuid(options.actorId ?? BUSINESS_DAY_ROLL_ACTOR_ID, "actorId");
    this.#pollIntervalMs = bounded("pollIntervalMs", options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      MIN_POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS);
    this.#scopeBatchSize = bounded("scopeBatchSize", options.scopeBatchSize ?? DEFAULT_SCOPE_BATCH_SIZE,
      1, MAX_SCOPE_BATCH_SIZE);
  }

  async drainOnce(): Promise<BusinessDayRollDrainResult> {
    const scopes = await this.#source.listDueScopes(this.#scopeBatchSize);
    if (scopes.length > this.#scopeBatchSize) throw new Error("due business-day scope source exceeded its requested limit");
    let opened = 0;
    const failures: BusinessDayRollFailure[] = [];
    for (const scope of scopes) {
      try {
        const tenantId = uuid(scope.tenantId, "scope tenantId");
        const propertyNode = uuid(scope.propertyNode, "scope propertyNode");
        const result = await this.#rolls.openCurrentBusinessDay({
          tenantId,
          propertyNode,
          envelope: createAuditEnvelope({
            actorId: this.#actorId,
            tenantId,
            propertyNode,
            requestId: crypto.randomUUID(),
            operation: "business_day.opened",
          }),
        });
        if (result.opened) opened += 1;
      } catch (error) {
        failures.push(Object.freeze({ ...scope, error: errorMessage(error) }));
      }
    }
    return Object.freeze({ scopes: scopes.length, opened, failures: Object.freeze(failures) });
  }

  async run(options: BusinessDayRollRunOptions = {}): Promise<void> {
    while (!options.signal?.aborted) {
      const startedAt = Date.now();
      options.onPoll?.(startedAt);
      try {
        options.onResult?.(await this.drainOnce());
      } catch (error) {
        options.onError?.(error);
      }
      await wait(Math.max(0, this.#pollIntervalMs - (Date.now() - startedAt)), options.signal);
    }
  }
}
