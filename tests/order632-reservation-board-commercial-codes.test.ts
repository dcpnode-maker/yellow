import { expect, test } from "bun:test";

const board = await Bun.file("src/contexts/reservations/board.ts").text();
const operator = await Bun.file("src/http/operator.ts").text();
const probe = await Bun.file("tools/probe-colleague-demo-readiness.ts").text();
const fixture = await Bun.file("tools/provision-public-commercial-codes.ps1").text();

test("Order 632 reservation board returns market and source codes", () => {
  expect(board).toContain("readonly marketCode: string | null;");
  expect(board).toContain("readonly sourceCode: string | null;");
  expect(board).toContain("reservation.market_code, reservation.source_code");
  expect(board).toContain("page.channel_code, page.market_code, page.source_code, page.currency");
  expect(board).toContain("marketCode: row.market_code");
  expect(board).toContain("sourceCode: row.source_code");
  expect(operator).toContain("marketCode: reservation.marketCode");
  expect(operator).toContain("sourceCode: reservation.sourceCode");
});

test("Order 632 public readiness checks board-level commercial contribution evidence", () => {
  expect(probe).toContain("reservation commercial contribution fields");
  expect(probe).toContain("commercialRows");
  expect(probe).toContain("row.marketCode");
  expect(probe).toContain("row.sourceCode");
  expect(probe).toContain("channels=");
  expect(probe).toContain("markets=");
  expect(probe).toContain("sources=");
});

test("Order 632 public fixture assigns realistic synthetic market and source codes", () => {
  expect(fixture).toContain("OTA_RETAIL");
  expect(fixture).toContain("WEBSITE");
  expect(fixture).toContain("BOOKING");
  expect(fixture).toContain("AIRBNB");
  expect(fixture).toContain("MICE");
  expect(fixture).toContain("SOCIAL");
  expect(fixture).toContain("6081b544-22a1-534f-a86d-bb1ae0519e14");
});
