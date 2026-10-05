import { expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

test("Order424 intentional red: exact pre-document evidence composer is absent before implementation", async () => {
  const moduleUrl = new URL(
    "india-irp-accommodation-pre-document-evidence-assembly.ts",
    sourceRoot,
  );

  expect(await Bun.file(moduleUrl).exists()).toBeTrue();
  const [source, index] = await Promise.all([
    Bun.file(moduleUrl).text(),
    Bun.file(new URL("index.ts", sourceRoot)).text(),
  ]);
  expect(source).toContain(
    "export function composeIndiaIrpAccommodationPreDocumentEvidenceAssembly",
  );
  expect(source).toContain(
    "incomplete_non_submit_ready_irp_accommodation_pre_document_evidence",
  );
  expect(index).toContain(
    'from "./india-irp-accommodation-pre-document-evidence-assembly"',
  );
});
