import { describe, expect, it } from "vitest";
import {
  GAME_LABELS,
  formatDate,
  formatDateTime,
  formatPercent,
  formatTime,
  gameLabel,
} from "@/lib/format";
import type { GameType } from "@/lib/types";

describe("format", () => {
  it("formats times as m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(9)).toBe("0:09");
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(605)).toBe("10:05");
    expect(formatTime(3600)).toBe("60:00");
  });

  it("clamps nonsense times instead of printing NaN", () => {
    expect(formatTime(-5)).toBe("0:00");
    expect(formatTime(12.7)).toBe("0:12");
    expect(formatTime(Number.NaN)).toBe("0:00");
  });

  it("rounds percentages and shows a dash for no data", () => {
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.666)).toBe("67%");
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(undefined)).toBe("—");
    expect(formatPercent(Number.NaN)).toBe("—");
  });

  it("shows a dash for missing or invalid dates", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("not a date")).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("2026-03-04T05:06:07.000Z")).toContain("2026");
  });

  it("labels every game type", () => {
    const types: GameType[] = [
      "quiz-choice",
      "unscramble",
      "sentence-builder",
      "listening",
      "writing",
    ];
    for (const type of types) {
      expect(GAME_LABELS[type]).toBeTruthy();
      expect(gameLabel(type)).toBe(GAME_LABELS[type]);
    }
  });

  it("falls back to the raw key for an unknown game type", () => {
    expect(gameLabel("future-game")).toBe("future-game");
  });
});
