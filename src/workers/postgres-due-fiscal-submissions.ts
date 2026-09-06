import type { SQL } from "bun";

import type {
  DueFiscalSubmission,
  DueFiscalSubmissionSource,
  FiscalSubmissionCursor,
} from "../contexts/tax-fiscal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PROVIDER_KEY = /^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/;
const MAX_BATCH_SIZE = 500;
const DISCOVERY_LOCK_TIMEOUT = "5000ms";
const DISCOVERY_STATEMENT_TIMEOUT = "15000ms";

interface DueFiscalSubmissionRow {
  readonly tenant_id: string;
  readonly submission_id: string;
  readonly provider_key: string;
  readonly provider_extension_id: string;
  readonly provider_extension_version: number;
}

function dataRecord(value: unknown, expected: readonly string[]): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key === "symbol")) return null;
    const actual = keys.map(String).sort();
    const wanted = [...expected].sort();
    if (actual.length !== wanted.length || !actual.every((key, index) => key === wanted[index])) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result: Record<string, unknown> = {};
    for (const key of wanted) {
      const descriptor = descriptors[key];
      if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined
          || !("value" in descriptor) || descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function snapshotCursor(value: Readonly<FiscalSubmissionCursor> | null): Readonly<FiscalSubmissionCursor> | null | false {
  if (value === null) return null;
  const cursor = dataRecord(value, ["tenantId", "submissionId"]);
  if (cursor === null || typeof cursor.tenantId !== "string" || !UUID.test(cursor.tenantId)
      || typeof cursor.submissionId !== "string" || !UUID.test(cursor.submissionId)) return false;
  return Object.freeze({ tenantId: cursor.tenantId, submissionId: cursor.submissionId });
}

function row(value: unknown): Readonly<DueFiscalSubmission> {
  const checked = dataRecord(value, ["provider_extension_id", "provider_extension_version", "provider_key",
    "submission_id", "tenant_id"]);
  if (!checked
      || typeof checked.tenant_id !== "string" || !UUID.test(checked.tenant_id)
      || typeof checked.submission_id !== "string" || !UUID.test(checked.submission_id)
      || typeof checked.provider_key !== "string" || !PROVIDER_KEY.test(checked.provider_key)
      || typeof checked.provider_extension_id !== "string" || !UUID.test(checked.provider_extension_id)
      || typeof checked.provider_extension_version !== "number"
      || !Number.isSafeInteger(checked.provider_extension_version) || checked.provider_extension_version < 1) {
    throw new Error("PostgreSQL returned an invalid due fiscal submission identity");
  }
  return Object.freeze({ tenantId: checked.tenant_id, submissionId: checked.submission_id,
    providerKey: checked.provider_key, providerExtensionId: checked.provider_extension_id,
    providerExtensionVersion: checked.provider_extension_version });
}

export class PostgresDueFiscalSubmissionSource implements DueFiscalSubmissionSource {
  readonly #pool: SQL;

  constructor(pool: SQL) {
    this.#pool = pool;
  }

  async listDueSubmissions(
    limit: number,
    cursor: Readonly<FiscalSubmissionCursor> | null,
  ): Promise<readonly DueFiscalSubmission[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH_SIZE) {
      throw new Error(`limit must be between 1 and ${MAX_BATCH_SIZE}`);
    }
    const checkedCursor = snapshotCursor(cursor);
    if (checkedCursor === false) throw new Error("due fiscal submission cursor is invalid");
    const rows = await this.#pool.begin(async (connection) => {
      await connection.unsafe(
        `SELECT set_config('lock_timeout', $1, true),
                set_config('statement_timeout', $2, true)`,
        [DISCOVERY_LOCK_TIMEOUT, DISCOVERY_STATEMENT_TIMEOUT],
      );
      return connection<DueFiscalSubmissionRow[]>`
        SELECT tenant_id, submission_id, provider_key,
               provider_extension_id, provider_extension_version
          FROM runtime_due_india_fiscal_submissions(
            ${limit}::integer,
            ${checkedCursor?.tenantId ?? null}::uuid,
            ${checkedCursor?.submissionId ?? null}::uuid
          )
      `;
    });
    if (!Array.isArray(rows) || rows.length > limit) {
      throw new Error("PostgreSQL exceeded the due fiscal submission limit");
    }
    return Object.freeze(rows.map(row));
  }
}
