import { IndiaNativeFiscalAccountingEventHandler } from "../contexts/financials";
import {
  IndiaNativeFiscalInvoiceIssuanceService,
  type IndiaNativeFiscalInvoiceIssueNativeConfirmedInput,
  type IndiaNativeFiscalInvoiceIssueNativeInput,
  type IndiaNativeFiscalInvoiceOperatorIssueInput,
  type IndiaNativeFiscalInvoiceReceipt,
} from "../contexts/tax-fiscal";
import type { Database, Tx } from "../kernel";

export class IssueIndiaNativeFiscalInvoiceCommand {
  readonly #database: Database;
  readonly #issuer: IndiaNativeFiscalInvoiceIssuanceService;

  constructor(database: Database) {
    this.#database = database;
    const accountingHandler = new IndiaNativeFiscalAccountingEventHandler();
    this.#issuer = new IndiaNativeFiscalInvoiceIssuanceService({
      nativeAccounting: accountingHandler,
    });
  }

  async execute(input: IndiaNativeFiscalInvoiceIssueNativeInput): Promise<IndiaNativeFiscalInvoiceReceipt> {
    return this.#database.withTenantTransaction(input.tenantId, (tx) => this.#issuer.issueNative(tx, input));
  }

  async executeConfirmed(
    rawInput: IndiaNativeFiscalInvoiceIssueNativeConfirmedInput,
  ): Promise<IndiaNativeFiscalInvoiceReceipt> {
    const input = this.#issuer.snapshotNativeConfirmedInput(rawInput);
    return this.#database.withTenantTransaction(
      input.tenantId,
      (tx) => this.executeConfirmedInTransaction(tx, input),
    );
  }

  async executeConfirmedInTransaction(
    tx: Tx,
    input: IndiaNativeFiscalInvoiceIssueNativeConfirmedInput,
  ): Promise<IndiaNativeFiscalInvoiceReceipt> {
    return this.#issuer.issueNativeConfirmed(tx, input);
  }

  async executeOperator(
    rawInput: IndiaNativeFiscalInvoiceOperatorIssueInput,
  ): Promise<IndiaNativeFiscalInvoiceReceipt> {
    const input = this.#issuer.snapshotOperatorIssueInput(rawInput);
    return this.#database.withTenantTransaction(
      input.tenantId,
      (tx) => this.executeOperatorInTransaction(tx, input),
    );
  }

  async executeOperatorInTransaction(
    tx: Tx,
    input: IndiaNativeFiscalInvoiceOperatorIssueInput,
  ): Promise<IndiaNativeFiscalInvoiceReceipt> {
    return this.#issuer.issueNativeForOperator(tx, input);
  }
}

export function issueIndiaNativeFiscalInvoice(
  database: Database,
  input: IndiaNativeFiscalInvoiceIssueNativeInput,
): Promise<IndiaNativeFiscalInvoiceReceipt> {
  return new IssueIndiaNativeFiscalInvoiceCommand(database).execute(input);
}

export function issueIndiaNativeFiscalInvoiceConfirmed(
  database: Database,
  input: IndiaNativeFiscalInvoiceIssueNativeConfirmedInput,
): Promise<IndiaNativeFiscalInvoiceReceipt> {
  return new IssueIndiaNativeFiscalInvoiceCommand(database).executeConfirmed(input);
}

export function issueIndiaNativeFiscalInvoiceConfirmedInTransaction(
  tx: Tx,
  input: IndiaNativeFiscalInvoiceIssueNativeConfirmedInput,
): Promise<IndiaNativeFiscalInvoiceReceipt> {
  const issuer = new IndiaNativeFiscalInvoiceIssuanceService({
    nativeAccounting: new IndiaNativeFiscalAccountingEventHandler(),
  });
  return issuer.issueNativeConfirmed(tx, input);
}

export function issueIndiaNativeFiscalInvoiceForOperator(
  database: Database,
  input: IndiaNativeFiscalInvoiceOperatorIssueInput,
): Promise<IndiaNativeFiscalInvoiceReceipt> {
  return new IssueIndiaNativeFiscalInvoiceCommand(database).executeOperator(input);
}

export function issueIndiaNativeFiscalInvoiceForOperatorInTransaction(
  tx: Tx,
  input: IndiaNativeFiscalInvoiceOperatorIssueInput,
): Promise<IndiaNativeFiscalInvoiceReceipt> {
  const issuer = new IndiaNativeFiscalInvoiceIssuanceService({
    nativeAccounting: new IndiaNativeFiscalAccountingEventHandler(),
  });
  return issuer.issueNativeForOperator(tx, input);
}
