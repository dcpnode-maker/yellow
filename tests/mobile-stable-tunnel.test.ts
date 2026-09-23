import { expect, test } from "bun:test";

test("mobile shell documents and automates a stable HTTPS tunnel instead of throwaway URLs", async () => {
  const readme = await Bun.file("mobile/README.md").text();
  const script = await Bun.file("scripts/mobile-stable-tunnel.ps1").text();

  expect(readme).toContain("Permanent mobile URL");
  expect(readme).toContain("scripts\\mobile-stable-tunnel.ps1");
  expect(readme).toContain("cloudflared tunnel route dns");
  expect(readme).toContain("Do not build APKs against random trycloudflare URLs");
  expect(script).toContain("cloudflared tunnel create");
  expect(script).toContain("cloudflared tunnel route dns");
  expect(script).toContain("credentials-file");
  expect(script).toContain("http://127.0.0.1:$LocalPort");
  expect(script).toContain("YELLOW_PUBLIC_URL");
  expect(script).not.toContain("trycloudflare.com");
});
