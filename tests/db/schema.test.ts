import { beforeEach, describe, expect, it } from "vitest";
import {
  expectSqlError,
  resetDb,
  scalar,
  seedAttempt,
  seedPlayer,
  sql,
  sqlAs,
} from "./helpers";

// These run against supabase/schema.sql itself, applied to a real Postgres.
// If the file stops being valid SQL, or a ranking rule changes meaning, these
// fail — which is the point.

beforeEach(() => {
  resetDb();
});

describe("schema objects", () => {
  it("creates both tables, both views and the ranking indexes", () => {
    const objects = sql(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name;`
    ).flat();
    expect(objects).toEqual(["attempts", "players", "v_overall_ranking", "v_unit_ranking"]);

    const indexes = sql(
      `select indexname from pg_indexes where schemaname = 'public' order by indexname;`
    ).flat();
    expect(indexes).toContain("players_name_key");
    expect(indexes).toContain("idx_attempts_unit");
    expect(indexes).toContain("idx_attempts_player");
  });

  it("has no class column — identity is the name alone", () => {
    const columns = sql(
      `select column_name from information_schema.columns where table_name = 'players' order by column_name;`
    ).flat();
    expect(columns).toEqual(["created_at", "id", "name"]);
  });

  it("generates uuids for new rows", () => {
    const id = seedPlayer("Mint");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("deletes an explorer's attempts with them", () => {
    const playerId = seedPlayer("Mint");
    seedAttempt({ playerId, unitId: "unit-02", score: 50 });
    sql(`delete from players where id = '${playerId}';`);
    expect(scalar("select count(*) from attempts;")).toBe("0");
  });
});

describe("explorer identity", () => {
  it("treats different case and stray spaces as the same explorer", () => {
    seedPlayer("Mint");

    const error = expectSqlError(
      "postgres",
      `insert into players (name) values ('  mINt ');`
    );
    expect(error).toMatch(/players_name_key|duplicate key/);
  });

  it("still allows two genuinely different names", () => {
    seedPlayer("Mint");
    expect(() => seedPlayer("Mintra")).not.toThrow();
    expect(scalar("select count(*) from players;")).toBe("2");
  });

  // findOrCreatePlayer branches on error.code === "23505" to recover when two
  // devices resolve the same explorer at the same moment.
  it("raises SQLSTATE 23505 on a duplicate", () => {
    seedPlayer("Mint");

    const error = expectSqlError(
      "postgres",
      `insert into players (name) values ('MINT');`
    );
    expect(error).toContain("23505");
    expect(error).toContain("duplicate key value");
  });
});

describe("v_unit_ranking", () => {
  it("keeps only each explorer's best attempt per unit", () => {
    const p1 = seedPlayer("Ann");
    seedAttempt({ playerId: p1, unitId: "unit-02", score: 30 });
    seedAttempt({ playerId: p1, unitId: "unit-02", score: 90 });
    seedAttempt({ playerId: p1, unitId: "unit-02", score: 60 });

    const rows = sql(`select score from v_unit_ranking where unit_id = 'unit-02';`);
    expect(rows).toEqual([["90"]]);
  });

  it("breaks a tie with the faster time", () => {
    const p1 = seedPlayer("Ann");
    seedAttempt({ playerId: p1, unitId: "unit-02", score: 60, timeSeconds: 240 });
    seedAttempt({ playerId: p1, unitId: "unit-02", score: 60, timeSeconds: 75 });

    expect(scalar(`select time_seconds from v_unit_ranking;`)).toBe("75");
  });

  it("never lets a fast low score beat a slow high score", () => {
    const p1 = seedPlayer("Ann");
    seedAttempt({ playerId: p1, unitId: "unit-02", score: 100, timeSeconds: 900 });
    seedAttempt({ playerId: p1, unitId: "unit-02", score: 20, timeSeconds: 5 });

    expect(scalar(`select score from v_unit_ranking;`)).toBe("100");
  });

  it("carries the explorer's name for the leaderboard", () => {
    const p1 = seedPlayer("Ann");
    seedAttempt({ playerId: p1, unitId: "unit-02", score: 40 });

    expect(sql(`select name from v_unit_ranking;`)).toEqual([["Ann"]]);
  });

  it("keeps explorers and units apart", () => {
    const p1 = seedPlayer("Ann");
    const p2 = seedPlayer("Ben");
    seedAttempt({ playerId: p1, unitId: "unit-01", score: 10 });
    seedAttempt({ playerId: p1, unitId: "unit-02", score: 20 });
    seedAttempt({ playerId: p2, unitId: "unit-01", score: 30 });

    expect(scalar(`select count(*) from v_unit_ranking;`)).toBe("3");
  });
});

describe("v_overall_ranking", () => {
  it("weights by score across units instead of averaging percentages", () => {
    const p1 = seedPlayer("Ann");
    // 10/10 on a tiny unit and 0/100 on a big one.
    seedAttempt({ playerId: p1, unitId: "unit-01", score: 10, maxScore: 10 });
    seedAttempt({ playerId: p1, unitId: "unit-02", score: 0, maxScore: 100 });

    const accuracy = Number(scalar(`select overall_accuracy from v_overall_ranking;`));
    expect(accuracy).toBeCloseTo(10 / 110, 6);
    // An average of the two unit percentages would be 0.5 — the rule the
    // project explicitly rejects, because it lets short units dominate.
    expect(accuracy).not.toBeCloseTo(0.5, 2);
  });

  it("counts distinct units, not attempts", () => {
    const p1 = seedPlayer("Ann");
    seedAttempt({ playerId: p1, unitId: "unit-01", score: 50 });
    seedAttempt({ playerId: p1, unitId: "unit-01", score: 70 });
    seedAttempt({ playerId: p1, unitId: "unit-02", score: 60 });

    expect(scalar(`select units_completed from v_overall_ranking;`)).toBe("2");
  });

  it("uses only the best attempt per unit", () => {
    const p1 = seedPlayer("Ann");
    seedAttempt({ playerId: p1, unitId: "unit-01", score: 0, maxScore: 100 });
    seedAttempt({ playerId: p1, unitId: "unit-01", score: 100, maxScore: 100 });

    expect(Number(scalar(`select overall_accuracy from v_overall_ranking;`))).toBe(1);
  });

  it("exposes the name directly, because PostgREST cannot embed through it", () => {
    const p1 = seedPlayer("Ann");
    seedAttempt({ playerId: p1, unitId: "unit-01", score: 50 });

    const columns = sql(
      `select column_name from information_schema.columns where table_name = 'v_overall_ranking' order by column_name;`
    ).flat();
    expect(columns).toEqual([
      "name",
      "overall_accuracy",
      "player_id",
      "units_completed",
    ]);
  });

  it("returns null accuracy rather than dividing by zero", () => {
    const p1 = seedPlayer("Ann");
    seedAttempt({ playerId: p1, unitId: "unit-01", score: 0, maxScore: 0, correct: 0, total: 0 });

    expect(scalar(`select coalesce(overall_accuracy::text, 'NULL') from v_overall_ranking;`)).toBe(
      "NULL"
    );
  });

  it("leaves out explorers who have never played", () => {
    seedPlayer("Never");
    expect(scalar(`select count(*) from v_overall_ranking;`)).toBe("0");
  });
});

describe("row level security", () => {
  it("is enabled on both tables", () => {
    const rows = sql(
      `select relname, relrowsecurity from pg_class where relname in ('players','attempts') order by relname;`
    );
    expect(rows).toEqual([
      ["attempts", "t"],
      ["players", "t"],
    ]);
  });

  it("lets a student read the leaderboard data", () => {
    const p1 = seedPlayer("Ann");
    seedAttempt({ playerId: p1, unitId: "unit-01", score: 50 });

    expect(sqlAs("anon", "select count(*) from players;")).toEqual([["1"]]);
    expect(sqlAs("anon", "select count(*) from attempts;")).toEqual([["1"]]);
    expect(sqlAs("anon", "select count(*) from v_unit_ranking;")).toEqual([["1"]]);
    expect(sqlAs("anon", "select count(*) from v_overall_ranking;")).toEqual([["1"]]);
  });

  it("lets a student sign themselves up and record an attempt", () => {
    expect(
      expectSqlError("anon", `insert into players (name) values ('Self');`)
    ).toBeNull();

    const playerId = scalar(`select id from players where name = 'Self';`)!;
    expect(
      expectSqlError(
        "anon",
        `insert into attempts (player_id, unit_id, score, max_score, correct_count, total_questions, time_seconds)
         values ('${playerId}', 'unit-02', 40, 60, 4, 6, 30);`
      )
    ).toBeNull();
  });

  // The rule the whole ranking depends on: attempts are permanent.
  it("stops a student changing or deleting any attempt", () => {
    const p1 = seedPlayer("Ann");
    seedAttempt({ playerId: p1, unitId: "unit-01", score: 10 });

    expect(expectSqlError("anon", `update attempts set score = 999;`)).toMatch(
      /permission denied/i
    );
    expect(expectSqlError("anon", `delete from attempts;`)).toMatch(/permission denied/i);
    expect(scalar("select score from attempts;")).toBe("10");
  });

  it("stops a student renaming or deleting an explorer", () => {
    seedPlayer("Ann");
    expect(expectSqlError("anon", `update players set name = 'Hacked';`)).toMatch(
      /permission denied/i
    );
    expect(expectSqlError("anon", `delete from players;`)).toMatch(/permission denied/i);
    expect(scalar("select name from players;")).toBe("Ann");
  });

  it("rejects an attempt that scores more than the maximum", () => {
    const p1 = seedPlayer("Ann");
    const error = expectSqlError(
      "anon",
      `insert into attempts (player_id, unit_id, score, max_score, correct_count, total_questions, time_seconds)
       values ('${p1}', 'unit-02', 1000, 60, 6, 6, 30);`
    );
    expect(error).toMatch(/attempts_create|row-level security/i);
  });

  it("rejects negative scores, negative time and impossible correct counts", () => {
    const p1 = seedPlayer("Ann");
    const bad = ["-10, 60, 4, 6, 30", "40, 60, 4, 6, -1", "40, 60, 99, 6, 30"];
    for (const values of bad) {
      expect(
        expectSqlError(
          "anon",
          `insert into attempts (player_id, unit_id, score, max_score, correct_count, total_questions, time_seconds)
           values ('${p1}', 'unit-02', ${values});`
        ),
        `values: ${values}`
      ).toMatch(/attempts_create|row-level security/i);
    }
    expect(scalar("select count(*) from attempts;")).toBe("0");
  });

  it("rejects a blank explorer name", () => {
    expect(
      expectSqlError("anon", `insert into players (name) values ('   ');`)
    ).toMatch(/players_create|row-level security/i);
  });

  it("lets the admin's service role do what students cannot", () => {
    const p1 = seedPlayer("Ann");
    seedAttempt({ playerId: p1, unitId: "unit-01", score: 10 });

    expect(
      expectSqlError("service_role", `update players set name = 'Ann Fixed' where id = '${p1}';`)
    ).toBeNull();
    expect(expectSqlError("service_role", `delete from attempts;`)).toBeNull();
    expect(scalar("select name from players;")).toBe("Ann Fixed");
  });
});
