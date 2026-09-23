import {
  IndiaNativeCreditDeliveryService,
  IndiaNativeCreditDeliveryValidationError,
  snapshotIndiaNativeCreditDeliveryInput,
  type IndiaNativeCreditDelivery,
} from "../contexts/tax-fiscal";
import type { Database, Tx } from "../kernel";

export class ReadIndiaNativeCreditDeliveryCommand {
  readonly #database: Database;
  readonly #service = new IndiaNativeCreditDeliveryService();

  constructor(database: Database) {
    this.#database = database;
  }

  async execute(value: unknown): Promise<Readonly<IndiaNativeCreditDelivery> | null> {
    const input = snapshotIndiaNativeCreditDeliveryInput(value);
    if (!input) throw new IndiaNativeCreditDeliveryValidationError();
    return this.#database.withTenantTransaction(input.tenantId, tx => this.executeInTransaction(tx, input));
  }

  executeInTransaction(tx: Tx, value: unknown): Promise<Readonly<IndiaNativeCreditDelivery> | null> {
    return this.#service.read(tx, value);
  }
}

export function readIndiaNativeCreditDelivery(
  database: Database,
  value: unknown,
): Promise<Readonly<IndiaNativeCreditDelivery> | null> {
  return new ReadIndiaNativeCreditDeliveryCommand(database).execute(value);
}

export function readIndiaNativeCreditDeliveryInTransaction(
  tx: Tx,
  value: unknown,
): Promise<Readonly<IndiaNativeCreditDelivery> | null> {
  return new IndiaNativeCreditDeliveryService().read(tx, value);
}

