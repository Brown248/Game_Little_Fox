import { beforeEach, describe, expect, it } from "vitest";
import {
  findOrCreatePlayer,
  getOverallRanking,
  getUnitRanking,
  saveAttempt,
  supabase,
} from "@/lib/supabase";
import { resetDb, scalar, seedAttempt, seedPlayer, sql } from "./helpers";

// The real student-facing client, against real Postgres + PostgREST, holding a
// real anon key — so RLS applies exactly as it will in production.

beforeEach(() => {
  resetDb();
});

describe("findOrCreatePlayer", () => {
  it("creates an explorer that doesn't exist yet", async () => {
    const player = await findOrCreatePlayer("Mint");

    expect(player.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(player.name).toBe("Mint");
    expect(scalar("select count(*) from players;")).toBe("1");
  });

  it("reuses the same record on a second visit", async () => {
    const first = await findOrCreatePlayer("Mint");
    const second = await findOrCreatePlayer("Mint");

    expect(second.id).toBe(first.id);
    expect(scalar("select count(*) from players;")).toBe("1");
  });

  it("ignores case and surrounding spaces", async () => {
    const first = await findOrCreatePlayer("Mint");

    for (const typed of ["mint", "MINT", "  Mint", "Mint  ", "  mInT  "]) {
      const again = await findOrCreatePlayer(typed);
      expect(again.id, `typed: "${typed}"`).toBe(first.id);
    }
    expect(scalar("select count(*) from players;")).toBe("1");
  });

  it("keeps genuinely different names apart", async () => {
    const a = await findOrCreatePlayer("Mint");
    const b = await findOrCreatePlayer("Mintra");

    expect(b.id).not.toBe(a.id);
    expect(scalar("select count(*) from players;")).toBe("2");
  });

  it("stores the trimmed name, not the raw input", async () => {
    await findOrCreatePlayer("   Ploy   ");
    expect(scalar("select name from players;")).toBe("Ploy");
  });

  // A name containing % or _ would be a wildcard in an unescaped ilike, which
  // would match the wrong explorer — or several, making maybeSingle throw.
  it("does not treat % or _ in a name as a wildcard", async () => {
    const literal = await findOrCreatePlayer("100%");
    const other = await findOrCreatePlayer("Mint");

    const wildcard = await findOrCreatePlayer("%");
    expect(wildcard.id).not.toBe(literal.id);
    expect(wildcard.id).not.toBe(other.id);
    expect(scalar("select count(*) from players;")).toBe("3");

    const underscore = await findOrCreatePlayer("A_C");
    const abc = await findOrCreatePlayer("ABC");
    expect(underscore.id).not.toBe(abc.id);
  });

  it("recovers when another device created the same explorer first", async () => {
    // Two devices resolving the same explorer at the same moment.
    const [a, b] = await Promise.all([
      findOrCreatePlayer("Race"),
      findOrCreatePlayer("race"),
    ]);

    expect(a.id).toBe(b.id);
    expect(scalar("select count(*) from players;")).toBe("1");
  });
});

describe("saveAttempt", () => {
  it("stores every field including the jsonb breakdown", async () => {
    const player = await findOrCreatePlayer("Mint");
    await saveAttempt({
      player_id: player.id,
      unit_id: "unit-02",
      score: 40,
      max_score: 60,
      correct_count: 4,
      total_questions: 6,
      time_seconds: 97,
      game_type_breakdown: {
        unscramble: { correct: 2, total: 3 },
        listening: { correct: 0, total: 1 },
      },
    });

    const row = sql(
      `select unit_id, score, max_score, correct_count, total_questions, time_seconds,
              game_type_breakdown->'unscramble'->>'correct',
              game_type_breakdown->'listening'->>'total'
       from attempts;`
    )[0];
    expect(row).toEqual(["unit-02", "40", "60", "4", "6", "97", "2", "1"]);
  });

  it("keeps every replay instead of overwriting", async () => {
    const player = await findOrCreatePlayer("Mint");
    const base = {
      player_id: player.id,
      unit_id: "unit-02",
      max_score: 60,
      correct_count: 3,
      total_questions: 6,
      time_seconds: 60,
    };

    await saveAttempt({ ...base, score: 30 });
    await saveAttempt({ ...base, score: 60, correct_count: 6 });
    await saveAttempt({ ...base, score: 10, correct_count: 1 });

    expect(scalar("select count(*) from attempts;")).toBe("3");
    expect(scalar("select score from v_unit_ranking;")).toBe("60");
  });

  it("is rejected by the database when the numbers are impossible", async () => {
    const player = await findOrCreatePlayer("Mint");
    await expect(
      saveAttempt({
        player_id: player.id,
        unit_id: "unit-02",
        score: 9999,
        max_score: 60,
        correct_count: 6,
        total_questions: 6,
        time_seconds: 10,
      })
    ).rejects.toBeDefined();
    expect(scalar("select count(*) from attempts;")).toBe("0");
  });

  it("accepts a full 30-question shadow unit", async () => {
    const player = await findOrCreatePlayer("Mint");
    await saveAttempt({
      player_id: player.id,
      unit_id: "unit-01",
      score: 280,
      max_score: 300,
      correct_count: 28,
      total_questions: 30,
      time_seconds: 640,
      game_type_breakdown: { unscramble: { correct: 28, total: 30 } },
    });

    expect(scalar("select max_score from attempts;")).toBe("300");
  });
});

describe("the anon key cannot rewrite history", () => {
  it("fails to update or delete an attempt", async () => {
    const playerId = seedPlayer("Ann");
    const attemptId = seedAttempt({ playerId, unitId: "unit-02", score: 10 });

    const updated = await supabase
      .from("attempts")
      .update({ score: 999 })
      .eq("id", attemptId);
    const deleted = await supabase.from("attempts").delete().eq("id", attemptId);

    expect(updated.error).not.toBeNull();
    expect(deleted.error).not.toBeNull();
    expect(scalar("select score from attempts;")).toBe("10");
    expect(scalar("select count(*) from attempts;")).toBe("1");
  });

  it("fails to rename or delete an explorer", async () => {
    const playerId = seedPlayer("Ann");

    const updated = await supabase
      .from("players")
      .update({ name: "Hacked" })
      .eq("id", playerId);
    const deleted = await supabase.from("players").delete().eq("id", playerId);

    expect(updated.error).not.toBeNull();
    expect(deleted.error).not.toBeNull();
    expect(scalar("select name from players;")).toBe("Ann");
  });
});

describe("getUnitRanking", () => {
  it("returns the best attempt per explorer, highest score first", async () => {
    const ann = seedPlayer("Ann");
    const ben = seedPlayer("Ben");
    const cat = seedPlayer("Cat");

    seedAttempt({ playerId: ann, unitId: "unit-02", score: 40, maxScore: 60, timeSeconds: 100 });
    seedAttempt({ playerId: ann, unitId: "unit-02", score: 60, maxScore: 60, timeSeconds: 500 });
    seedAttempt({ playerId: ben, unitId: "unit-02", score: 60, maxScore: 60, timeSeconds: 200 });
    seedAttempt({ playerId: cat, unitId: "unit-02", score: 10, maxScore: 60, timeSeconds: 5 });
    seedAttempt({ playerId: cat, unitId: "unit-01", score: 60, maxScore: 60, timeSeconds: 5 });

    const rows = await getUnitRanking("unit-02");

    expect(rows.map((r) => r.name)).toEqual(["Ben", "Ann", "Cat"]);
    expect(rows[0]).toMatchObject({ score: 60, time_seconds: 200 });
    // Ann's own best (60 in 500s) is used, not her first attempt
    expect(rows[1]).toMatchObject({ score: 60, time_seconds: 500 });
  });

  it("returns only the requested unit", async () => {
    const ann = seedPlayer("Ann");
    seedAttempt({ playerId: ann, unitId: "unit-01", score: 10 });
    seedAttempt({ playerId: ann, unitId: "unit-02", score: 20 });

    const rows = await getUnitRanking("unit-02");
    expect(rows).toHaveLength(1);
    expect(rows[0].unit_id).toBe("unit-02");
  });

  it("returns an empty list for a unit nobody has played", async () => {
    expect(await getUnitRanking("unit-19")).toEqual([]);
  });
});

describe("getOverallRanking", () => {
  it("returns names without a PostgREST embed", async () => {
    const ann = seedPlayer("Ann");
    seedAttempt({ playerId: ann, unitId: "unit-01", score: 50, maxScore: 100 });

    const rows = await getOverallRanking();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Ann", units_completed: 1 });
    expect(rows[0].overall_accuracy).toBeCloseTo(0.5, 6);
  });

  it("orders by accuracy, then by units played", async () => {
    const ann = seedPlayer("Ann");
    const ben = seedPlayer("Ben");
    const cat = seedPlayer("Cat");

    seedAttempt({ playerId: ann, unitId: "unit-01", score: 90, maxScore: 100 });
    seedAttempt({ playerId: ben, unitId: "unit-01", score: 100, maxScore: 100 });
    seedAttempt({ playerId: cat, unitId: "unit-01", score: 100, maxScore: 100 });
    seedAttempt({ playerId: cat, unitId: "unit-02", score: 100, maxScore: 100 });

    const rows = await getOverallRanking();
    expect(rows.map((r) => r.name)).toEqual(["Cat", "Ben", "Ann"]);
    expect(rows[0].units_completed).toBe(2);
  });

  it("ranks by accuracy, never by total raw score", async () => {
    const grinder = seedPlayer("Grinder");
    const sharp = seedPlayer("Sharp");

    // Grinder collects far more raw points but is less accurate.
    seedAttempt({ playerId: grinder, unitId: "unit-01", score: 600, maxScore: 1000 });
    seedAttempt({ playerId: sharp, unitId: "unit-02", score: 100, maxScore: 100 });

    const rows = await getOverallRanking();
    expect(rows.map((r) => r.name)).toEqual(["Sharp", "Grinder"]);
  });
});
