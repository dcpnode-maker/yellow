import {
  FiscalSubmissionService,
  snapshotFiscalSubmissionReceipt,
  snapshotRetryIndiaFiscalSubmissionInput,
  type FiscalSubmissionReceipt,
  type FiscalSubmissionServiceErrorCode,
  type FiscalSubmissionServiceResult,
} from "../contexts/tax-fiscal";
import type { Database } from "../kernel";

class RetryFiscalSubmissionAbort extends Error {
  readonly code: FiscalSubmissionServiceErrorCode;

  constructor(code: FiscalSubmissionServiceErrorCode) {
    super("fiscal submission retry transaction aborted");
    this.code = code;
  }
}

function failure(
  code: FiscalSubmissionServiceErrorCode,
): FiscalSubmissionServiceResult<FiscalSubmissionReceipt> {
  let message: string;
  switch (code) {
    case "invalid_input":
      message = "fiscal submission retry request is invalid";
      break;
    case "invalid_receipt":
      message = "PostgreSQL returned an invalid fiscal submission receipt";
      break;
    case "database_error":
      message = "Fiscal submission retry could not be persisted";
      break;
    default:
      return assertNever(code);
  }
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) });
}

function success(
  receipt: FiscalSubmissionReceipt,
): FiscalSubmissionServiceResult<FiscalSubmissionReceipt> {
  return Object.freeze({ ok: true, value: receipt });
}

export class RetryIndiaFiscalSubmissionCommand {
  readonly #database: Database;
  readonly #service = new FiscalSubmissionService();

  constructor(database: Database) {
    this.#database = database;
  }

  async execute(inputValue: unknown): Promise<FiscalSubmissionServiceResult<FiscalSubmissionReceipt>> {
    const input = snapshotRetryIndiaFiscalSubmissionInput(inputValue);
    if (!input) return failure("invalid_input");

    try {
      return await this.#database.withTenantTransaction(input.tenantId, async (tx) => {
        const result = await this.#service.retry(tx, input);
        if (!result.ok) throw new RetryFiscalSubmissionAbort(result.error.code);

        const receipt = snapshotFiscalSubmissionReceipt(result.value);
        if (!receipt || receipt.tenantId !== input.tenantId
            || receipt.submissionId !== input.submissionId) {
          throw new RetryFiscalSubmissionAbort("invalid_receipt");
        }
        return success(receipt);
      });
    } catch (error) {
      return error instanceof RetryFiscalSubmissionAbort
        ? failure(error.code)
        : failure("database_error");
    }
  }
}

export function retryIndiaFiscalSubmission(
  database: Database,
  inputValue: unknown,
): Promise<FiscalSubmissionServiceResult<FiscalSubmissionReceipt>> {
  return new RetryIndiaFiscalSubmissionCommand(database).execute(inputValue);
}

function assertNever(value: never): never {
  throw new Error(`unreachable fiscal submission retry error: ${String(value)}`);
}
