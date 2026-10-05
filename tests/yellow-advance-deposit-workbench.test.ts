import { expect, test } from "bun:test";
import { resolve } from "node:path";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

function between(start: string, end: string): string {
  const from = app.indexOf(start); const to = app.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`missing ${start}`);
  return app.slice(from, to);
}

test("advance deposits use only the accepted read model and never render payment secrets", () => {
  const helpers = between("type HostedDepositState", "const EXACT_MINOR");
  expect(helpers).toContain('`/api/v1/properties/${propertyId}/folios/${encodeURIComponent(folioId)}/hosted-deposits`');
  expect(helpers).toContain('`/api/v1/properties/${propertyId}/hosted-deposits/${encodeURIComponent(requestId)}`');
  expect(helpers).toContain('exactObject(value, ["instrumentId", "kind", "brand", "last4", "expiry", "psp"])');
  expect(helpers).toContain("validateDepositWorkbench");
  expect(helpers).not.toContain("token:");
  expect(helpers).not.toContain("bearerHash");
  expect(helpers).not.toContain("providerReference");
});

test("request and application are separately confirmed, freshly preflighted, idempotent and reconciled", () => {
  const workbench = between("function AdvanceDepositWorkbench", "function CashierWorkbench");
  expect(workbench).toContain('queryKey: ["cashier-hosted-deposits", propertyId, folioId]');
  expect(workbench).toContain('const [freshReservation, freshStatement, freshWorkbench] = await Promise.all');
  expect(workbench).toContain("const currentFolio = freshReservation.reservation.folios.find");
  expect(workbench).toContain("freshWorkbench.instruments.some");
  expect(workbench).toContain("current.state !== \"captured\"");
  expect(workbench).toContain("BigInt(proposal.amountMinor) > BigInt(freshStatement.balanceMinor)");
  expect(workbench).toContain('key: `yellow-hosted-deposit-${kind}-${crypto.randomUUID()}`');
  expect(workbench).toContain("await createHostedDeposit(proposal, attempt.current.key)");
  expect(workbench).toContain("await applyHostedDeposit(proposal, attempt.current.key)");
  expect(workbench).toContain("only same-key reconciliation is available");
  expect(workbench).toContain("const [recoveryLocked, setRecoveryLocked] = useState(false);");
  expect(workbench).toContain("const uncertain = recoveryLocked || crossed;");
  expect(workbench).toContain("setRecoveryLocked(true);");
  expect(workbench).toContain("refetchInterval");
  expect(workbench).toContain('state === "ready" || deposit.state === "processing"');
  expect(workbench).toContain("const matchingRows = refreshedStatement.rows.filter((row) => row.journalId === receipt.journalId);");
  expect(workbench).toContain("setOneTimeBearer(receipt.bearer ?? null)");
  expect(workbench).toContain("A browser return never proves capture");
  expect(workbench).toContain("const mutationLeaseHeld = useRef(false);");
  expect(workbench).toContain("const running = useRef(false);");
  expect(workbench).toContain("if (!acquireMutationLease())");
  expect(workbench).toContain("running.current = true;");
  expect(workbench).toContain("running.current = false;");
});

test("the mounted cashier route retains a responsive, masked-instrument deposit workbench", () => {
  expect(app).toContain("<AdvanceDepositWorkbench reservation={visibleReservationDetail!.reservation} statement={folio.data}");
  expect(app).toContain('aria-label="Advance deposits"');
  expect(app).toContain("No advance deposits.");
  expect(app).toContain("No eligible masked instruments are available for this open folio.");
  expect(app).toContain("Open guest deposit page");
  expect(css).toContain(".cashier-deposit-workbench {");
  expect(css).toContain(".deposit-status-list button,.deposit-request-fields button,.deposit-proposal button,.deposit-one-time a { min-height: 44px;");
  expect(css).toContain(".deposit-instruments { grid-template-columns: 1fr; }");
});

const mountedBaseUrl = process.env.YELLOW_ORDER580_BROWSER_BASE_URL;
const playwrightModule = process.env.YELLOW_ORDER580_PLAYWRIGHT_MODULE;
const browserExecutable = process.env.YELLOW_ORDER580_BROWSER_EXECUTABLE;
const mountedTest = process.env.YELLOW_ORDER580_DIRECT_PLAYWRIGHT === "1" && mountedBaseUrl && playwrightModule && browserExecutable ? test : test.skip;

mountedTest("the mounted workbench synchronously blocks parent unmount and duplicate submission", async () => {
  const loaded = await import(playwrightModule! as string) as {
    chromium: { launch(options: Record<string, unknown>): Promise<{
      newPage(options: Record<string, unknown>): Promise<any>;
      close(): Promise<void>;
    }> };
  };
  const propertyId = "6081b544-22a1-534f-a86d-bb1ae0519e14";
  const reservationId = "fbe1dc20-456e-5345-8d7d-420b41685955";
  const folioId = "f728d2b3-eb9e-4e69-b433-6aa6ab88f649";
  const instrumentId = "58000000-0000-4000-8000-000000000001";
  const requestId = "58000000-0000-4000-8000-000000000002";
  const operationId = "58000000-0000-4000-8000-000000000003";
  const publicRoot = resolve(import.meta.dir, "..", "public", "yellow-next");
  const index = await Bun.file(resolve(publicRoot, "index.html")).text();
  const mainAsset = index.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)?.[1]?.split("/").at(-1);
  if (!mainAsset) throw new Error("Order580 mounted proof requires a freshly built main asset");

  const browser = await loaded.chromium.launch({ headless: true, executablePath: browserExecutable! });
  try {
    for (const doubleActivate of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
      page.setDefaultTimeout(8_000);
      const posts: Array<{ key: string | undefined; body: string | null }> = [];
      const runtimeErrors: string[] = [];
      page.on("pageerror", (error: Error) => runtimeErrors.push(error.message));
      await page.route("**/*", async (route: any) => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname;
        if (pathname.startsWith("/yellow-next/assets/")) {
          const requested = pathname.split("/").at(-1)!;
          const filename = /^index-.*\.js$/u.test(requested) ? mainAsset : requested;
          const file = resolve(publicRoot, "assets", filename);
          if (await Bun.file(file).exists()) {
            await route.fulfill({
              contentType: filename.endsWith(".css") ? "text/css" : "application/javascript",
              body: await Bun.file(file).arrayBuffer(),
            });
            return;
          }
        }
        if (request.method() === "GET" && pathname.endsWith("/hosted-deposits")) {
          await route.fulfill({ json: {
            propertyNode: propertyId,
            folioId,
            deposits: posts.length ? [{
              requestId, tenantId: "6d9b7ce2-2d14-5576-b8c3-80f06501a603", propertyNode: propertyId,
              propertyName: "Reviewer fictional property", folioId, folioReference: "REVIEW",
              operationId, amountMinor: "1000", currency: "SAR", generation: 1,
              expiresAt: "2026-09-22T12:00:00Z", state: "ready", capturedMinor: "0",
              appliedMinor: "0", remainingMinor: "0",
            }] : [],
            instruments: [{ instrumentId, kind: "card_network_token", brand: "Reviewer Card",
              last4: "1234", expiry: "2030-12", psp: "synthetic" }],
          } });
          return;
        }
        if (request.method() === "GET" && pathname.endsWith(`/hosted-deposits/${requestId}`)) {
          await route.fulfill({ json: {
            requestId, tenantId: "6d9b7ce2-2d14-5576-b8c3-80f06501a603", propertyNode: propertyId,
            propertyName: "Reviewer fictional property", folioId, folioReference: "REVIEW",
            operationId, amountMinor: "1000", currency: "SAR", generation: 1,
            expiresAt: "2026-09-22T12:00:00Z", state: "ready", capturedMinor: "0",
            appliedMinor: "0", remainingMinor: "0",
          } });
          return;
        }
        if (request.method() === "POST" && pathname.endsWith("/hosted-deposits")) {
          posts.push({ key: request.headers()["idempotency-key"], body: request.postData() });
          await new Promise(resolveDelay => setTimeout(resolveDelay, 600));
          await route.fulfill({ status: 201, json: {
            requestId, operationId, bearer: "review-one-time-handoff",
            expiresAt: "2026-09-22T12:00:00Z", amountMinor: "1000", currency: "SAR",
            generation: 1, replayed: false,
          } });
          return;
        }
        await route.continue();
      });
      await page.goto(`${mountedBaseUrl}/p/${propertyId}/today?workspace=finance&reservation=${reservationId}`, { waitUntil: "domcontentloaded", timeout: 8_000 });
      const panel = page.getByRole("region", { name: "Advance deposits", exact: true });
      await panel.getByRole("button", { name: "Review deposit request", exact: true }).waitFor();
      await panel.getByRole("radio").check();
      await panel.getByLabel("Amount (SAR minor units)", { exact: true }).fill("1000");
      await panel.getByRole("button", { name: "Review deposit request", exact: true }).click();
      await panel.getByRole("checkbox").check();
      const action = await panel.locator(".deposit-proposal button").elementHandle();
      const parent = await page.locator(".cashier-stay-list button").first().elementHandle();
      await page.evaluate(([submit, navigate, duplicate]: [HTMLElement, HTMLElement, boolean]) => {
        submit.click();
        if (duplicate) submit.click();
        navigate.click();
      }, [action, parent, doubleActivate]);
      try {
        await panel.getByRole("link", { name: "Open guest deposit page" }).waitFor({ timeout: 10_000 });
      } catch {
        throw new Error(`mounted overlap did not reconcile: ${JSON.stringify({ doubleActivate, posts, runtimeErrors, panelCount: await panel.count(), text: await panel.innerText().catch(() => "unmounted") })}`);
      }
      expect(posts).toHaveLength(1);
      expect(posts[0]?.body).toBe(JSON.stringify({ instrumentId, amountMinor: "1000" }));
      expect(posts[0]?.key).toMatch(/^yellow-hosted-deposit-create-/u);
      expect(await panel.count()).toBe(1);
      expect(await panel.getByText("Secure deposit handoff is ready.", { exact: false }).count()).toBe(1);
      expect(runtimeErrors).toEqual([]);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}, 45_000);

const ownedMountedHarness = process.env.YELLOW_ORDER580_MOUNTED_HARNESS;
const ownedMountedTest = ownedMountedHarness ? test : test.skip;

ownedMountedTest("reviewer-owned mounted effects keep one POST and the panel through synchronous overlap", async () => {
  for (const mode of ["sync-parent", "sync-overlap"]) {
    const child = Bun.spawn(["node", ownedMountedHarness!], {
      cwd: resolve(import.meta.dir, ".."),
      env: { ...process.env, REVIEW_MODE: mode },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(exitCode, stderr).toBe(0);
    const proof = stdout.slice(stdout.indexOf("syncOverlap"));
    expect(proof).toContain(`mode: '${mode}'`);
    expect(proof).toContain("panelCount: 1");
    expect(proof).toContain("Secure deposit handoff is ready.");
    expect((proof.match(/path: '\/api\/v1\/properties\//gu) ?? [])).toHaveLength(1);
  }
}, 30_000);
