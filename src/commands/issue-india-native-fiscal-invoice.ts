import { IndiaNativeFiscalAccountingEventHandler } from "../contexts/financials";
import {
  IndiaNativeFiscalInvoiceIssuanceService,
  type IndiaNativeFiscalInvoiceIssueNativeInput,
  type IndiaNativeFiscalInvoiceReceipt,
} from "../contexts/tax-fiscal";
import type { Database } from "../kernel";

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
}

export function issueIndiaNativeFiscalInvoice(
  database: Database,
  input: IndiaNativeFiscalInvoiceIssueNativeInput,
): Promise<IndiaNativeFiscalInvoiceReceipt> {
  return new IssueIndiaNativeFiscalInvoiceCommand(database).execute(input);
}
