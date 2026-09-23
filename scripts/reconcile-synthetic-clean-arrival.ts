/**
 * Offline-only repair for the single documented synthetic-demo fixture collision.
 * It intentionally reads the current CAS values through the runtime RLS boundary;
 * no profile values, connection string, or identifiers are printed.
 */
import { Database } from "../src/kernel";

const TENANT_ID = "6d9b7ce2-2d14-5576-b8c3-80f06501a603";
const PROPERTY_ID = "4518a22f-b455-54c6-a50a-4584383749b9";
const PARTY_ID = "55ee1818-f8e8-570e-9fe5-6bc7f88db2df";
const RESERVATION_ID = "fe25d718-95b5-51d9-9443-0098cd4d10dc";
const ACTOR_ID = "9f90d3e9-94f9-54de-95ec-35bd00b99b15";
const CANONICAL_NAME = "Aarav Mehta";
const CANONICAL_ATTRS = { source: "local-review", checkin_example: "clean" };

interface CurrentParty {
  readonly display_name: string;
  readonly legal_name: string | null;
  readonly attrs: unknown;
}

interface ReconciliationResult {
  readonly changed: boolean;
  readonly changed_fields: readonly string[];
}

async function main(): Promise<void> {
  const databaseUrl = process.env.YELLOW_RUNTIME_DATABASE_URL;
  if (!databaseUrl) throw new Error("YELLOW_RUNTIME_DATABASE_URL is required");
  const database = Database.connect(databaseUrl);
  try {
    const result = await database.withTenantTransaction(TENANT_ID, async (tx) => {
      const current = await tx<CurrentParty[]>`
        SELECT display_name, legal_name, attrs
        FROM party
        WHERE tenant_id=${TENANT_ID}::uuid AND id=${PARTY_ID}::uuid
      `;
      if (current.length !== 1 || current[0]?.legal_name === null) {
        throw new Error("Synthetic clean-arrival fixture is unavailable");
      }
      const currentParty = current[0]!;
      const rows = await tx<ReconciliationResult[]>`
        SELECT changed, changed_fields
        FROM public.reconcile_synthetic_clean_arrival_party(
          ${TENANT_ID}::uuid, ${PROPERTY_ID}::uuid, ${PARTY_ID}::uuid,
          ${RESERVATION_ID}::uuid, ${ACTOR_ID}::uuid, ${crypto.randomUUID()}::uuid,
          ${currentParty.display_name}, ${currentParty.legal_name}, ${JSON.stringify(currentParty.attrs)}::text::jsonb,
          ${CANONICAL_NAME}, ${CANONICAL_NAME}, ${JSON.stringify(CANONICAL_ATTRS)}::text::jsonb
        )
      `;
      if (rows.length !== 1) throw new Error("Synthetic clean-arrival reconciliation returned no result");
      return rows[0]!;
    });
    console.log(`synthetic clean-arrival reconciliation completed: ${result.changed ? "changed" : "no-op"}; fields=${result.changed_fields.length}`);
  } finally {
    await database.close();
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch {
    // Database errors can include row values in DETAIL. This is an offline tool,
    // but it must remain safe when its output is captured by a supervisor.
    console.error("synthetic clean-arrival reconciliation failed");
    process.exitCode = 1;
  }
}
