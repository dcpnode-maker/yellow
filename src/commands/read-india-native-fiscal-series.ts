import {
  IndiaNativeFiscalSeriesDiscoveryService,
  IndiaNativeFiscalSeriesValidationError,
  snapshotIndiaNativeFiscalSeriesDiscoveryInput,
  type IndiaNativeFiscalSeriesDiscoveryResult,
} from "../contexts/tax-fiscal";
import type { Database, Tx } from "../kernel";

export class ReadIndiaNativeFiscalSeriesCommand {
  readonly #database: Database;
  readonly #service = new IndiaNativeFiscalSeriesDiscoveryService();

  constructor(database: Database) {
    this.#database = database;
  }

  async execute(value: unknown): Promise<Readonly<IndiaNativeFiscalSeriesDiscoveryResult> | null> {
    const input = snapshotIndiaNativeFiscalSeriesDiscoveryInput(value);
    if (!input) throw new IndiaNativeFiscalSeriesValidationError("Fiscal-series discovery input is invalid");
    return this.#database.withTenantTransaction(input.tenantId, tx => this.executeInTransaction(tx, input));
  }

  executeInTransaction(tx: Tx, value: unknown): Promise<Readonly<IndiaNativeFiscalSeriesDiscoveryResult> | null> {
    return this.#service.read(tx, value);
  }
}

export function readIndiaNativeFiscalSeries(
  database: Database,
  value: unknown,
): Promise<Readonly<IndiaNativeFiscalSeriesDiscoveryResult> | null> {
  return new ReadIndiaNativeFiscalSeriesCommand(database).execute(value);
}

export function readIndiaNativeFiscalSeriesInTransaction(
  tx: Tx,
  value: unknown,
): Promise<Readonly<IndiaNativeFiscalSeriesDiscoveryResult> | null> {
  return new IndiaNativeFiscalSeriesDiscoveryService().read(tx, value);
}
