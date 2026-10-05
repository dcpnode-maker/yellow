import {
  IndiaNativeFiscalCreditNoteListService,
  IndiaNativeFiscalCreditNoteValidationError,
  snapshotIndiaNativeFiscalCreditNoteListInput,
  type IndiaNativeFiscalCreditNoteListResult,
} from "../contexts/tax-fiscal";
import type { Database, Tx } from "../kernel";

export class ListIndiaNativeFiscalCreditNotesCommand {
  readonly #database: Database;
  readonly #service = new IndiaNativeFiscalCreditNoteListService();

  constructor(database: Database) { this.#database = database; }

  async execute(value: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteListResult>> {
    const input = snapshotIndiaNativeFiscalCreditNoteListInput(value);
    if (!input) throw new IndiaNativeFiscalCreditNoteValidationError();
    return this.#database.withTenantTransaction(input.tenantId, tx => this.executeInTransaction(tx, input));
  }

  executeInTransaction(tx: Tx, value: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteListResult>> {
    return this.#service.list(tx, value);
  }
}

export function listIndiaNativeFiscalCreditNotes(database: Database, value: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteListResult>> {
  return new ListIndiaNativeFiscalCreditNotesCommand(database).execute(value);
}

export function listIndiaNativeFiscalCreditNotesInTransaction(tx: Tx, value: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteListResult>> {
  return new IndiaNativeFiscalCreditNoteListService().list(tx, value);
}
