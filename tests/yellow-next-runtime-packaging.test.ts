import { expect, test } from "bun:test";

const dockerfile = await Bun.file("Dockerfile").text();

test("the runtime image ships the selected Yellow Next static surface", () => {
  expect(dockerfile).toContain("COPY --chown=bun:bun public/yellow-next ./public/yellow-next");
  expect(dockerfile).toContain('CMD ["bun", "run", "start"]');
});
