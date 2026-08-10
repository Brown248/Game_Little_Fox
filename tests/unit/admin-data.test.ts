import { describe, expect, it } from "vitest";
import {
  bestAttemptPerUnit,
  certificateRoster,
  summarisePlayer,
  summarisePlayers,
  summariseUnits,
  tallySkills,
} from "@/lib/admin-data";
import { earnsCertificate } from "@/lib/format";
import type { AttemptWithPlayer, PlayerRow } from "@/lib/types";

let sequence = 0;

function attempt(
  overrides: Partial<AttemptWithPlayer> & { player_id: string; unit_id: string }
): AttemptWithPlayer {
  sequence += 1;
  return {
    id: `attempt-${sequence}`,
    score: 50,
    max_score: 100,
    correct_count: 5,
    total_questions: 10,
    time_seconds: 120,
    completed_at: new Date(Date.UTC(2026, 0, sequence)).toISOString(),
    game_type_breakdown: {},
    players: { name: "Mint" },
    ...overrides,
  };
}

function player(id: string, name = "Mint"): PlayerRow {
  return { id, name, created_at: "2026-01-01T00:00:00.000Z" };
}

// The teacher's roster: who has a certificate, who has not, and why not.
// Its whole job is to agree with what the child is told on /rank, so the rule
// itself is never re-implemented here — only the grouping around it.
describe("certificateRoster", () => {
  const GAME = "game-01";
  const FULL = 47; // scored questions in a complete run

  const complete = (over: Partial<AttemptWithPlayer> & { player_id: string }) =>
    attempt({
      unit_id: GAME,
      total_questions: FULL,
      correct_count: 60,
      score: 600,
      max_score: 470,
      ...over,
    });

  it("sorts the ones needing help first and the finished last", () => {
    const players = [player("p1", "Earned"), player("p2", "Never"), player("p3", "Short")];
    const rows = certificateRoster(
      players,
      [
        complete({ player_id: "p1" }),
        attempt({
          player_id: "p3",
          unit_id: GAME,
          total_questions: 27,
          correct_count: 27,
        }),
      ],
      GAME,
      FULL
    );

    expect(rows.map((r) => r.state)).toEqual([
      "never-played",
      "stopped-early",
      "earned",
    ]);
    expect(rows.map((r) => r.player.name)).toEqual(["Never", "Short", "Earned"]);
  });

  // A short run can score full marks on the questions it covered. That is the
  // trap the "Finish" button opens, and the teacher's list must not fall into
  // it any more than the child's screen does.
  it("does not count a perfect but unfinished run", () => {
    const rows = certificateRoster(
      [player("p1", "Fai")],
      [
        attempt({
          player_id: "p1",
          unit_id: GAME,
          total_questions: 27,
          correct_count: 27,
          score: 270,
        }),
      ],
      GAME,
      FULL
    );

    expect(rows[0].state).toBe("stopped-early");
    expect(rows[0].earnedWith).toBeNull();
    // still shows the teacher how far they actually got
    expect(rows[0].bestAny?.score).toBe(270);
  });

  it("names the run the certificate is for, not merely the best one", () => {
    const rows = certificateRoster(
      [player("p1", "Fai")],
      [
        // higher score, but stopped early — cannot be the certificate
        attempt({
          player_id: "p1",
          unit_id: GAME,
          total_questions: 40,
          correct_count: 40,
          score: 400,
        }),
        complete({ player_id: "p1", correct_count: 30, score: 300 }),
      ],
      GAME,
      FULL
    );

    expect(rows[0].state).toBe("earned");
    expect(rows[0].earnedWith?.score).toBe(300);
    expect(rows[0].correctCount).toBe(30);
  });

  it("picks the best of several finished runs", () => {
    const rows = certificateRoster(
      [player("p1", "Fai")],
      [
        complete({ player_id: "p1", correct_count: 40, score: 400 }),
        complete({ player_id: "p1", correct_count: 70, score: 700 }),
        complete({ player_id: "p1", correct_count: 55, score: 550 }),
      ],
      GAME,
      FULL
    );

    expect(rows[0].earnedWith?.score).toBe(700);
  });

  it("ignores runs saved under any other id", () => {
    const rows = certificateRoster(
      [player("p1", "Fai")],
      [
        attempt({
          player_id: "p1",
          unit_id: "unit-01",
          total_questions: FULL,
          correct_count: FULL,
        }),
      ],
      GAME,
      FULL
    );

    expect(rows[0].state).toBe("never-played");
    expect(rows[0].bestAny).toBeNull();
  });

  // If these two ever disagree, a child is told one thing and the teacher
  // another about the same run.
  it("agrees with earnsCertificate on every row", () => {
    const runs = [
      complete({ player_id: "p1", correct_count: 24 }), // half of 47 rounds up -> 24
      complete({ player_id: "p2", correct_count: 23 }),
      attempt({
        player_id: "p3",
        unit_id: GAME,
        total_questions: 40,
        correct_count: 40,
      }),
    ];
    const rows = certificateRoster(
      [player("p1", "A"), player("p2", "B"), player("p3", "C")],
      runs,
      GAME,
      FULL
    );

    for (const row of rows) {
      const run = row.earnedWith ?? row.bestAny;
      const expected = run
        ? earnsCertificate(GAME, run.correct_count, run.total_questions, FULL)
        : false;
      expect(row.state === "earned", row.player.name).toBe(expected);
    }
  });
});

describe("bestAttemptPerUnit", () => {
  it("keeps the highest score per player per unit", () => {
    const rows = [
      attempt({ player_id: "p1", unit_id: "unit-01", score: 30 }),
      attempt({ player_id: "p1", unit_id: "unit-01", score: 90 }),
      attempt({ player_id: "p1", unit_id: "unit-01", score: 60 }),
    ];
    const best = bestAttemptPerUnit(rows);
    expect(best).toHaveLength(1);
    expect(best[0].score).toBe(90);
  });

  it("breaks a score tie with the faster time", () => {
    const rows = [
      attempt({ player_id: "p1", unit_id: "unit-01", score: 60, time_seconds: 200 }),
      attempt({ player_id: "p1", unit_id: "unit-01", score: 60, time_seconds: 90 }),
      attempt({ player_id: "p1", unit_id: "unit-01", score: 60, time_seconds: 300 }),
    ];
    expect(bestAttemptPerUnit(rows)[0].time_seconds).toBe(90);
  });

  it("never lets a faster time beat a higher score", () => {
    const rows = [
      attempt({ player_id: "p1", unit_id: "unit-01", score: 100, time_seconds: 600 }),
      attempt({ player_id: "p1", unit_id: "unit-01", score: 10, time_seconds: 5 }),
    ];
    expect(bestAttemptPerUnit(rows)[0].score).toBe(100);
  });

  it("keeps players and units separate", () => {
    const rows = [
      attempt({ player_id: "p1", unit_id: "unit-01", score: 10 }),
      attempt({ player_id: "p1", unit_id: "unit-02", score: 20 }),
      attempt({ player_id: "p2", unit_id: "unit-01", score: 30 }),
    ];
    expect(bestAttemptPerUnit(rows)).toHaveLength(3);
  });

  it("handles an empty list", () => {
    expect(bestAttemptPerUnit([])).toEqual([]);
  });
});

describe("tallySkills", () => {
  it("adds up the per-game-type breakdown across attempts", () => {
    const rows = [
      attempt({
        player_id: "p1",
        unit_id: "unit-01",
        game_type_breakdown: {
          unscramble: { correct: 2, total: 3 },
          listening: { correct: 1, total: 1 },
        },
      }),
      attempt({
        player_id: "p1",
        unit_id: "unit-02",
        game_type_breakdown: { unscramble: { correct: 1, total: 4 } },
      }),
    ];

    expect(tallySkills(rows)).toEqual([
      { gameType: "listening", correct: 1, total: 1 },
      { gameType: "unscramble", correct: 3, total: 7 },
    ]);
  });

  it("tolerates a missing or partial breakdown column", () => {
    const rows = [
      attempt({ player_id: "p1", unit_id: "unit-01", game_type_breakdown: undefined }),
      attempt({
        player_id: "p1",
        unit_id: "unit-02",
        game_type_breakdown: { listening: { correct: 1, total: 2 } },
      }),
    ];
    expect(tallySkills(rows)).toEqual([
      { gameType: "listening", correct: 1, total: 2 },
    ]);
  });
});

describe("summarisePlayer", () => {
  it("weights accuracy by score, not by averaging unit percentages", () => {
    // unit-01: 90/100, unit-02: 2/10 -> weighted 92/110 = 83.6%
    // A naive average of the two ratios would be 55%.
    const summary = summarisePlayer(player("p1"), [
      attempt({ player_id: "p1", unit_id: "unit-01", score: 90, max_score: 100 }),
      attempt({ player_id: "p1", unit_id: "unit-02", score: 2, max_score: 10 }),
    ]);

    expect(summary.bestScoreTotal).toBe(92);
    expect(summary.maxScoreTotal).toBe(110);
    expect(summary.accuracy).toBeCloseTo(92 / 110, 10);
  });

  it("uses only the best attempt per unit for accuracy but counts every attempt", () => {
    const summary = summarisePlayer(player("p1"), [
      attempt({ player_id: "p1", unit_id: "unit-01", score: 100, max_score: 100 }),
      attempt({ player_id: "p1", unit_id: "unit-01", score: 0, max_score: 100 }),
      attempt({ player_id: "p1", unit_id: "unit-01", score: 40, max_score: 100 }),
    ]);

    expect(summary.accuracy).toBe(1);
    expect(summary.attemptCount).toBe(3);
    expect(summary.unitsPlayed).toBe(1);
  });

  it("sums time across all attempts, not just the best", () => {
    const summary = summarisePlayer(player("p1"), [
      attempt({ player_id: "p1", unit_id: "unit-01", time_seconds: 100 }),
      attempt({ player_id: "p1", unit_id: "unit-01", time_seconds: 50 }),
    ]);
    expect(summary.totalTimeSeconds).toBe(150);
  });

  it("returns null accuracy and no weakest skill for a player who never played", () => {
    const summary = summarisePlayer(player("p1"), []);
    expect(summary.accuracy).toBeNull();
    expect(summary.weakestSkill).toBeNull();
    expect(summary.lastPlayedAt).toBeNull();
    expect(summary.unitsPlayed).toBe(0);
  });

  it("picks the weakest skill but ignores ones with fewer than 3 answers", () => {
    const summary = summarisePlayer(player("p1"), [
      attempt({
        player_id: "p1",
        unit_id: "unit-01",
        game_type_breakdown: {
          unscramble: { correct: 8, total: 10 },
          listening: { correct: 3, total: 10 },
          "sentence-builder": { correct: 0, total: 2 }, // too few to judge
        },
      }),
    ]);

    expect(summary.weakestSkill?.gameType).toBe("listening");
  });

  it("takes lastPlayedAt from the first row (queries come back newest first)", () => {
    const newest = attempt({
      player_id: "p1",
      unit_id: "unit-02",
      completed_at: "2026-05-05T10:00:00.000Z",
    });
    const older = attempt({
      player_id: "p1",
      unit_id: "unit-01",
      completed_at: "2026-01-01T10:00:00.000Z",
    });
    expect(summarisePlayer(player("p1"), [newest, older]).lastPlayedAt).toBe(
      "2026-05-05T10:00:00.000Z"
    );
  });
});

describe("summarisePlayers", () => {
  it("ranks by accuracy and keeps players with no attempts at the bottom", () => {
    const players = [player("p1", "Ann"), player("p2", "Ben"), player("p3", "Cat")];
    const attempts = [
      attempt({ player_id: "p1", unit_id: "unit-01", score: 50, max_score: 100 }),
      attempt({ player_id: "p2", unit_id: "unit-01", score: 90, max_score: 100 }),
    ];

    const ranked = summarisePlayers(players, attempts);
    expect(ranked.map((r) => r.player.name)).toEqual(["Ben", "Ann", "Cat"]);
    expect(ranked[2].accuracy).toBeNull();
  });

  it("does not mix one player's attempts into another's", () => {
    const ranked = summarisePlayers(
      [player("p1", "Ann"), player("p2", "Ben")],
      [
        attempt({ player_id: "p1", unit_id: "unit-01" }),
        attempt({ player_id: "p1", unit_id: "unit-02" }),
        attempt({ player_id: "p2", unit_id: "unit-01" }),
      ]
    );
    expect(ranked.find((r) => r.player.id === "p1")!.attemptCount).toBe(2);
    expect(ranked.find((r) => r.player.id === "p2")!.attemptCount).toBe(1);
  });
});

describe("summariseUnits", () => {
  it("summarises each unit by best attempts and sorts by id", () => {
    const stats = summariseUnits([
      attempt({ player_id: "p1", unit_id: "unit-02", score: 60, max_score: 100, time_seconds: 200 }),
      attempt({ player_id: "p1", unit_id: "unit-02", score: 80, max_score: 100, time_seconds: 300 }),
      attempt({ player_id: "p2", unit_id: "unit-02", score: 100, max_score: 100, time_seconds: 150 }),
      attempt({ player_id: "p1", unit_id: "unit-01", score: 10, max_score: 100, time_seconds: 90 }),
    ]);

    expect(stats.map((s) => s.unitId)).toEqual(["unit-01", "unit-02"]);

    const unit02 = stats[1];
    expect(unit02.attemptCount).toBe(3);
    expect(unit02.playerCount).toBe(2);
    // best attempts only: 80/100 and 100/100
    expect(unit02.averageAccuracy).toBeCloseTo(180 / 200, 10);
    expect(unit02.bestTimeSeconds).toBe(150);
  });

  it("reports null accuracy when max_score is zero", () => {
    const stats = summariseUnits([
      attempt({ player_id: "p1", unit_id: "unit-01", score: 0, max_score: 0 }),
    ]);
    expect(stats[0].averageAccuracy).toBeNull();
  });
});
