import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { reservationVoiceAction } from "../frontend/yellow/src/voice";

const app = readFileSync(new URL("../frontend/yellow/src/App.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../frontend/yellow/src/workspaces/ReservationWorkspace.tsx", import.meta.url), "utf8");

const completed = {
  reservationId: "history-1",
  confirmationNo: "L3R-DO-0013",
  primaryGuestDisplayName: "Rohan Kapoor",
  status: "checked_out",
  operationalState: "checked_out",
  sellableUnitLabel: "113",
} as const;

test("prefers one active departure over completed history", () => {
  const active = { ...completed, reservationId: "active-1", status: "due_out", operationalState: "due_out" } as const;
  const result = reservationVoiceAction("checkout Rohan Kapoor", [completed, active]);
  expect(result).toEqual({ reservation: active, workbench: "check-out" });
  expect(result?.completed).not.toBe(true);
});

test("resolves one completed departure only when no active identity matches", () => {
  expect(reservationVoiceAction("checkout Rohan Kapoor", [completed])).toEqual({
    reservation: completed,
    workbench: "check-out",
    completed: true,
    roomLabel: "113",
  });
  expect(reservationVoiceAction("checkout L3R-DO-0013", [completed])?.completed).toBe(true);
  const withoutRoom = { ...completed, sellableUnitLabel: undefined } as const;
  expect(reservationVoiceAction("checkout Rohan Kapoor", [withoutRoom])).toEqual({
    reservation: withoutRoom,
    workbench: "check-out",
    completed: true,
  });
});

test("fails closed for ambiguous active or completed identity matches", () => {
  const activeA = { ...completed, reservationId: "active-a", status: "in_house", operationalState: "in_house" } as const;
  const activeB = { ...completed, reservationId: "active-b", status: "due_out", operationalState: "due_out" } as const;
  expect(reservationVoiceAction("checkout Rohan Kapoor", [activeA, activeB, completed])).toBeNull();
  const historyB = { ...completed, reservationId: "history-b", confirmationNo: "L3R-DO-0014" } as const;
  expect(reservationVoiceAction("checkout Rohan Kapoor", [completed, historyB])).toBeNull();
});

test("completed route copy and room propagation are read-only and authoritative", () => {
  expect(app).toContain("Opening the completed departure review");
  expect(app).toContain('checkoutCompleted: completedDeparture');
  expect(app).toContain('checkoutRoomLabel: reservationAction.roomLabel ?? null');
  expect(app).toContain('authoritativeRoomLabel={assistantCard.checkoutRoomLabel}');
  expect(workspace).toContain('completedDeparture ? "release" : "stay"');
  expect(workspace).toContain('const roomLabel = completed ? authoritativeRoomLabel : departure.data?.room?.spaceCode;');
  expect(workspace).toContain("No checkout action is available.");
  expect(workspace).toContain("!completed && canSettle");
  expect(workspace).not.toContain("completed ? departure.data?.room?.spaceCode");
});
