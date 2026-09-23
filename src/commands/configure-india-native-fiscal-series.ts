import {
  IndiaNativeFiscalSeriesConfigurationService,
  IndiaNativeFiscalSeriesValidationError,
  snapshotIndiaNativeFiscalSeriesConfigurationInput,
  type IndiaNativeFiscalSeriesConfigurationInput,
  type IndiaNativeFiscalSeriesConfigurationResult,
} from "../contexts/tax-fiscal";
import type { Database, Tx } from "../kernel";

export class ConfigureIndiaNativeFiscalSeriesCommand {
  readonly #database: Database;
  readonly #service = new IndiaNativeFiscalSeriesConfigurationService();

  constructor(database: Database) {
    this.#database = database;
  }

  async execute(value: unknown): Promise<Readonly<IndiaNativeFiscalSeriesConfigurationResult>> {
    const input = snapshotIndiaNativeFiscalSeriesConfigurationInput(value);
    if (!input) throw new IndiaNativeFiscalSeriesValidationError("fiscal series configuration input is invalid");
    return this.#database.withTenantTransaction(input.tenantId, tx => this.executeInTransaction(tx, input));
  }

  executeInTransaction(tx: Tx, value: unknown): Promise<Readonly<IndiaNativeFiscalSeriesConfigurationResult>> {
    return this.#service.configure(tx, value as IndiaNativeFiscalSeriesConfigurationInput);
  }
}

export function configureIndiaNativeFiscalSeries(
  database: Database,
  value: unknown,
): Promise<Readonly<IndiaNativeFiscalSeriesConfigurationResult>> {
  return new ConfigureIndiaNativeFiscalSeriesCommand(database).execute(value);
}

export function configureIndiaNativeFiscalSeriesInTransaction(
  tx: Tx,
  value: unknown,
): Promise<Readonly<IndiaNativeFiscalSeriesConfigurationResult>> {
  return new IndiaNativeFiscalSeriesConfigurationService().configure(tx, value);
}
