export { createAuditEnvelope } from "./audit";
export type { AuditEnvelope, AuditEnvelopeInput } from "./audit";
export { Database } from "./db";
export type { ConnectionPool, DatabaseOptions, Tx } from "./db";
export { ExtensionRegistry, ExtensionValidationError, validateJsonSchema } from "./extension";
export type {
  CompatibilityFailure,
  CreateExtensionInput,
  ExtensionInstance,
  RegisterExtensionTypeInput,
  ValidationIssue,
} from "./extension";
export { recordFact } from "./fact-log";
export type { FactSubject, RecordedFact, RecordFactInput } from "./fact-log";
export type {
  ConsumeBatchOptions,
  ConsumeBatchResult,
  EventBus,
  EventHandler,
  OutboxEvent,
  PublishEventInput,
} from "./event-bus";
export { PostgresEventBus } from "./outbox";
export type { ConsumedOutboxBatch } from "./outbox";
export { OutboxRelay } from "./relay";
export type {
  OutboxRelayOptions,
  RelayBatchHooks,
  RelayBatchResult,
  RelayRunOptions,
} from "./relay";
export {
  failClosedTenantResolver,
  TenantContextMiddleware,
} from "./tenant-context";
export type {
  TenantIdentity,
  TenantRequestContext,
  TenantRequestHandler,
  TenantResolver,
} from "./tenant-context";
