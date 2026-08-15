import type { Tx } from "./db";

export interface PublishEventInput {
  readonly tenantId: string;
  readonly propertyNode: string | null;
  readonly businessDate: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventVersion?: number;
  readonly actorId: string | null;
  readonly correlationId: string;
  readonly causationId?: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface OutboxEvent {
  readonly seq: number;
  readonly id: string;
  readonly tenantId: string;
  readonly propertyNode: string | null;
  readonly businessDate: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly actorId: string | null;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly occurredAt: Date;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ConsumeBatchOptions {
  readonly limit?: number;
}

export interface ConsumeBatchResult {
  readonly consumer: string;
  readonly examined: number;
  readonly processed: number;
  readonly lastSeq: number;
}

export type EventHandler = (event: OutboxEvent, tx: Tx) => Promise<void>;

export interface EventBus {
  publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent>;
  consumeBatch(
    consumer: string,
    handler: EventHandler,
    options?: ConsumeBatchOptions,
  ): Promise<ConsumeBatchResult>;
}
