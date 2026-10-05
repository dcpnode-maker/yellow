const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OPERATION = /^[a-z][a-z0-9_.-]*$/;

export interface AuditEnvelopeInput {
  readonly actorId: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly requestId: string;
  readonly operation: string;
}

export interface AuditEnvelope extends AuditEnvelopeInput {}

function requireUuid(name: string, value: string): void {
  if (!UUID.test(value)) throw new Error(`${name} must be a UUID`);
}

export function createAuditEnvelope(input: AuditEnvelopeInput): AuditEnvelope {
  requireUuid("actorId", input.actorId);
  requireUuid("tenantId", input.tenantId);
  requireUuid("propertyNode", input.propertyNode);
  requireUuid("requestId", input.requestId);
  if (!OPERATION.test(input.operation)) {
    throw new Error("operation must be a stable lowercase identifier");
  }

  return Object.freeze({ ...input });
}
