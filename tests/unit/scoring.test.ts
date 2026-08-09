import { describe, expect, it, vi } from "vitest";
import {
  createScoringState,
  elapsedSeconds,
  recordAnswer,
} from "@/lib/scoring";

describe("scoring", () => {
  it("starts empty with a start time", () => {
    const state = createScoringState();
    expect(state).toMatchObject({
      score: 0,
      maxScore: 0,
      correctCount: 0,
      totalQuestions: 0,
      breakdown: {},
    });
    expect(state.startedAt).toBeGreaterThan(0);
  });

  it("awards 10 points per correct answer and counts the question either way", () => {
    let state = createScoringState();
    state = recordAnswer(state, "quiz-choice", true);
    state = recordAnswer(state, "quiz-choice", false);

    expect(state.score).toBe(10);
    expect(state.maxScore).toBe(20);
    expect(state.correctCount).toBe(1);
    expect(state.totalQuestions).toBe(2);
    expect(state.breakdown["quiz-choice"]).toEqual({ correct: 1, total: 2 });
  });

  it("honours a custom points value", () => {
    const state = recordAnswer(createScoringState(), "unscramble", true, 25);
    expect(state.score).toBe(25);
    expect(state.maxScore).toBe(25);
  });

  it("keeps a separate tally per game type", () => {
    let state = createScoringState();
    state = recordAnswer(state, "unscramble", true);
    state = recordAnswer(state, "listening", false);
    state = recordAnswer(state, "unscramble", true);

    expect(state.breakdown).toEqual({
      unscramble: { correct: 2, total: 2 },
      listening: { correct: 0, total: 1 },
    });
  });

  // The bug this guards: mutating the previous state's nested bucket. React
  // StrictMode calls a state updater twice in dev with the same input, so a
  // mutating implementation double counts every answer.
  it("never mutates the state it was given, including nested buckets", () => {
    const base = recordAnswer(createScoringState(), "unscramble", true);
    const snapshot = structuredClone(base);

    const first = recordAnswer(base, "unscramble", false);
    const second = recordAnswer(base, "unscramble", false);

    expect(base).toEqual(snapshot);
    expect(first.breakdown.unscramble).toEqual({ correct: 1, total: 2 });
    expect(second.breakdown.unscramble).toEqual({ correct: 1, total: 2 });
    expect(first.breakdown.unscramble).not.toBe(second.breakdown.unscramble);
  });

  it("reports whole elapsed seconds from the start time", () => {
    const state = createScoringState();
    vi.spyOn(Date, "now").mockReturnValue(state.startedAt + 65_400);
    expect(elapsedSeconds(state)).toBe(65);
  });
});
