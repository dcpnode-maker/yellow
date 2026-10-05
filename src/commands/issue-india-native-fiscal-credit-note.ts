import {
  IndiaNativeFiscalCreditNoteService,
  IndiaNativeFiscalCreditNoteValidationError,
  snapshotIndiaNativeFiscalCreditNoteIssueInput,
  snapshotIndiaNativeFiscalCreditNoteReadInput,
  snapshotIndiaNativeFiscalCreditNoteDiscoveryInput,
  type IndiaNativeFiscalCreditNoteIssueResult,
  type IndiaNativeFiscalCreditNoteReadResult,
  type IndiaNativeFiscalCreditNoteDocumentReadResult,
} from "../contexts/tax-fiscal";
import type { Database, Tx } from "../kernel";

export class ReadIndiaNativeFiscalCreditNoteDocumentCommand {
  readonly #database: Database;
  readonly #service: IndiaNativeFiscalCreditNoteService;

  constructor(database: Database) {
    this.#database = database;
    this.#service = new IndiaNativeFiscalCreditNoteService();
  }

  async execute(inputValue: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteDocumentReadResult> | null> {
    const input = snapshotIndiaNativeFiscalCreditNoteReadInput(inputValue);
    if (!input) throw new IndiaNativeFiscalCreditNoteValidationError();
    return this.#database.withTenantTransaction(input.tenantId, tx => this.executeInTransaction(tx, input));
  }

  async executeInTransaction(
    tx: Tx,
    inputValue: unknown,
  ): Promise<Readonly<IndiaNativeFiscalCreditNoteDocumentReadResult> | null> {
    return this.#service.readDocument(tx, inputValue);
  }
}

export function readIndiaNativeFiscalCreditNoteDocument(
  database: Database,
  inputValue: unknown,
): Promise<Readonly<IndiaNativeFiscalCreditNoteDocumentReadResult> | null> {
  return new ReadIndiaNativeFiscalCreditNoteDocumentCommand(database).execute(inputValue);
}

export function readIndiaNativeFiscalCreditNoteDocumentInTransaction(
  tx: Tx,
  inputValue: unknown,
): Promise<Readonly<IndiaNativeFiscalCreditNoteDocumentReadResult> | null> {
  return new IndiaNativeFiscalCreditNoteService().readDocument(tx, inputValue);
}

export class IssueIndiaNativeFiscalCreditNoteCommand {
  readonly #database: Database;
  readonly #service: IndiaNativeFiscalCreditNoteService;

  constructor(database: Database) {
    this.#database = database;
    this.#service = new IndiaNativeFiscalCreditNoteService();
  }

  async execute(inputValue: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteIssueResult>> {
    const input = snapshotIndiaNativeFiscalCreditNoteIssueInput(inputValue);
    if (!input) throw new IndiaNativeFiscalCreditNoteValidationError();
    return this.#database.withTenantTransaction(
      input.tenantId,
      (tx) => this.executeInTransaction(tx, input),
    );
  }

  async executeInTransaction(
    tx: Tx,
    inputValue: unknown,
  ): Promise<Readonly<IndiaNativeFiscalCreditNoteIssueResult>> {
    return this.#service.issue(tx, inputValue);
  }
}

export class ReadIndiaNativeFiscalCreditNoteCommand {
  readonly #database: Database;
  readonly #service: IndiaNativeFiscalCreditNoteService;

  constructor(database: Database) {
    this.#database = database;
    this.#service = new IndiaNativeFiscalCreditNoteService();
  }

  async execute(inputValue: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteReadResult> | null> {
    const input = snapshotIndiaNativeFiscalCreditNoteReadInput(inputValue);
    if (!input) throw new IndiaNativeFiscalCreditNoteValidationError();
    return this.#database.withTenantTransaction(
      input.tenantId,
      (tx) => this.executeInTransaction(tx, input),
    );
  }

  async executeInTransaction(
    tx: Tx,
    inputValue: unknown,
  ): Promise<Readonly<IndiaNativeFiscalCreditNoteReadResult> | null> {
    return this.#service.read(tx, inputValue);
  }
}

export class DiscoverIndiaNativeFiscalCreditNoteCommand {
  readonly #database: Database;
  readonly #service: IndiaNativeFiscalCreditNoteService;

  constructor(database: Database) {
    this.#database = database;
    this.#service = new IndiaNativeFiscalCreditNoteService();
  }

  async execute(inputValue: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteReadResult> | null> {
    const input = snapshotIndiaNativeFiscalCreditNoteDiscoveryInput(inputValue);
    if (!input) throw new IndiaNativeFiscalCreditNoteValidationError();
    return this.#database.withTenantTransaction(
      input.tenantId,
      (tx) => this.executeInTransaction(tx, input),
    );
  }

  async executeInTransaction(
    tx: Tx,
    inputValue: unknown,
  ): Promise<Readonly<IndiaNativeFiscalCreditNoteReadResult> | null> {
    return this.#service.discover(tx, inputValue);
  }
}

export function discoverIndiaNativeFiscalCreditNote(
  database: Database,
  inputValue: unknown,
): Promise<Readonly<IndiaNativeFiscalCreditNoteReadResult> | null> {
  return new DiscoverIndiaNativeFiscalCreditNoteCommand(database).execute(inputValue);
}

export function discoverIndiaNativeFiscalCreditNoteInTransaction(
  tx: Tx,
  inputValue: unknown,
): Promise<Readonly<IndiaNativeFiscalCreditNoteReadResult> | null> {
  return new IndiaNativeFiscalCreditNoteService().discover(tx, inputValue);
}

export function issueIndiaNativeFiscalCreditNote(
  database: Database,
  inputValue: unknown,
): Promise<Readonly<IndiaNativeFiscalCreditNoteIssueResult>> {
  return new IssueIndiaNativeFiscalCreditNoteCommand(database).execute(inputValue);
}

export function issueIndiaNativeFiscalCreditNoteInTransaction(
  tx: Tx,
  inputValue: unknown,
): Promise<Readonly<IndiaNativeFiscalCreditNoteIssueResult>> {
  return new IndiaNativeFiscalCreditNoteService().issue(tx, inputValue);
}

export function readIndiaNativeFiscalCreditNote(
  database: Database,
  inputValue: unknown,
): Promise<Readonly<IndiaNativeFiscalCreditNoteReadResult> | null> {
  return new ReadIndiaNativeFiscalCreditNoteCommand(database).execute(inputValue);
}

export function readIndiaNativeFiscalCreditNoteInTransaction(
  tx: Tx,
  inputValue: unknown,
): Promise<Readonly<IndiaNativeFiscalCreditNoteReadResult> | null> {
  return new IndiaNativeFiscalCreditNoteService().read(tx, inputValue);
}
