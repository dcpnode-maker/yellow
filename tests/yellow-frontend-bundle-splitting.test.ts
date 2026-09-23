import { expect, test } from "bun:test";

const viteConfig = await Bun.file("frontend/yellow/vite.config.ts").text();

test("splits the Yellow frontend with the installed Rolldown contract", () => {
  expect(viteConfig).toContain("rolldownOptions");
  expect(viteConfig).toContain("codeSplitting");
  expect(viteConfig).toContain('name: "react-runtime"');
  expect(viteConfig).toContain('name: "vendor"');
  expect(viteConfig).toContain("node_modules[\\\\/](?:react|react-dom)[\\\\/]");
  expect(viteConfig).not.toContain("chunkSizeWarningLimit");
  expect(viteConfig).not.toContain("manualChunks");
});

test("keeps the emitted app entry and every JavaScript chunk within delivery budgets", async () => {
  const assetDirectory = "public/yellow-next/assets";
  const scripts = [...new Bun.Glob("*.js").scanSync(assetDirectory)];
  const indexHtml = await Bun.file("public/yellow-next/index.html").text();
  const entryName = indexHtml.match(/src="\/yellow-next\/assets\/(index-[^"]+\.js)"/)?.[1];

  expect(scripts.length).toBeGreaterThanOrEqual(3);
  expect(entryName).toBeDefined();

  for (const script of scripts) {
    expect(Bun.file(`${assetDirectory}/${script}`).size).toBeLessThan(500_000);
  }
  expect(Bun.file(`${assetDirectory}/${entryName}`).size).toBeLessThan(200_000);
});
