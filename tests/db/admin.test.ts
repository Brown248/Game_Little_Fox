import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, scalar, seedAttempt, seedPlayer, sql } from "./helpers";

// Next's cache and the cookie-based admin gate aren't available outside a
// request, so they're stubbed. Everything else â€” the service-role client, the
// queries, the merge â€” is the real thing against the real database.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireAdmin = vi.fn(async () => {});
vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: () => requireAdmin(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  isAdmin: vi.fn(async () => true),
  adminPasswordConfigured: () => true,
}));

const {
  deleteAttemptAction,
  deletePlayerAction,
  mergePlayersAction,
  renamePlayerAction,
} = await import("@/app/admin/actions");
const {
  fetchAttempts,
  fetchAttemptsForPlayer,
  fetchPlayer,
  fetchPlayers,
  summarisePlayers,
  summariseUnits,
} = await import("@/lib/admin-data");
const { serviceConfigured } = await import("@/lib/supabase-admin");

/** Simulates a request with no valid admin cookie, for one action call. */
function withoutAdminSession() {
  requireAdmin.mockImplementationOnce(async () => {
    throw new Error("Not authorised");
  });
}

beforeEach(() => {
  resetDb();
  // Set the implementation outright rather than relying on mockReset: a
  // rejection configured by a previous test must not leak into this one.
  requireAdmin.mockImplementation(async () => {});
});

describe("service-role setup", () => {
  it("is configured in this environment", () => {
    expect(serviceConfigured()).toBe(true);
  });
});

describe("admin reads", () => {
  it("lists explorers in name order", async () => {
    seedPlayer("Zoe");
    seedPlayer("Ann");
    seedPlayer("Ben");

    const players = await fetchPlayers();
    expect(players.map((p) => p.name)).toEqual(["Ann", "Ben", "Zoe"]);
  });

  it("joins the explorer onto each attempt, newest first", async () => {
    const ann = seedPlayer("Ann");
    seedAttempt({ playerId: ann, unitId: "unit-01", score: 10 });
    seedAttempt({ playerId: ann, unitId: "unit-02", score: 20 });

    const attempts = await fetchAttempts();
    expect(attempts).toHaveLength(2);
    expect(attempts[0].players).toEqual({ name: "Ann" });
    expect(new Date(attempts[0].completed_at).getTime()).toBeGreaterThanOrEqual(
      new Date(attempts[1].completed_at).getTime()
    );
  });

  it("fetches one player and only their attempts", async () => {
    const ann = seedPlayer("Ann");
    const ben = seedPlayer("Ben");
    seedAttempt({ playerId: ann, unitId: "unit-01", score: 10 });
    seedAttempt({ playerId: ben, unitId: "unit-01", score: 20 });

    expect((await fetchPlayer(ann))?.name).toBe("Ann");
    expect(await fetchPlayer("00000000-0000-0000-0000-000000000000")).toBeNull();

    const attempts = await fetchAttemptsForPlayer(ann);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].score).toBe(10);
  });

  it("summarises real rows the same way the leaderboard ranks them", async () => {
    const ann = seedPlayer("Ann");
    seedAttempt({
      playerId: ann,
      unitId: "unit-01",
      score: 10,
      maxScore: 10,
      breakdown: { listening: { correct: 1, total: 1 } },
    });
    seedAttempt({
      playerId: ann,
      unitId: "unit-02",
      score: 0,
      maxScore: 100,
      correct: 0,
      total: 10,
      breakdown: { listening: { correct: 0, total: 10 } },
    });

    const [summary] = summarisePlayers(await fetchPlayers(), await fetchAttempts());
    expect(summary.accuracy).toBeCloseTo(10 / 110, 6);
    expect(summary.unitsPlayed).toBe(2);
    expect(summary.weakestSkill).toMatchObject({ gameType: "listening", total: 11 });
  });

  it("summarises units from real rows", async () => {
    const ann = seedPlayer("Ann");
    const ben = seedPlayer("Ben");
    seedAttempt({ playerId: ann, unitId: "unit-02", score: 60, maxScore: 100, timeSeconds: 300 });
    seedAttempt({ playerId: ann, unitId: "unit-02", score: 80, maxScore: 100, timeSeconds: 400 });
    seedAttempt({ playerId: ben, unitId: "unit-02", score: 100, maxScore: 100, timeSeconds: 150 });

    const [unit] = summariseUnits(await fetchAttempts());
    expect(unit).toMatchObject({
      unitId: "unit-02",
      attemptCount: 3,
      playerCount: 2,
      bestTimeSeconds: 150,
    });
    expect(unit.averageAccuracy).toBeCloseTo(180 / 200, 6);
  });
});

describe("renamePlayerAction", () => {
  it("fixes a mistyped name and keeps the attempts", async () => {
    const ann = seedPlayer("Annn");
    seedAttempt({ playerId: ann, unitId: "unit-01", score: 50 });

    const result = await renamePlayerAction(ann, "  Ann  ");

    expect(result).toEqual({ ok: true });
    expect(sql(`select name from players;`)).toEqual([["Ann"]]);
    expect(scalar(`select count(*) from attempts where player_id = '${ann}';`)).toBe("1");
  });

  it("refuses to create a duplicate and says to merge instead", async () => {
    seedPlayer("Mint");
    const dup = seedPlayer("Ploy");

    const result = await renamePlayerAction(dup, "mint");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/merge them instead/);
    expect(scalar(`select name from players where id = '${dup}';`)).toBe("Ploy");
  });

  it("rejects an empty name", async () => {
    const ann = seedPlayer("Ann");
    expect((await renamePlayerAction(ann, "   ")).ok).toBe(false);
    expect(scalar("select name from players;")).toBe("Ann");
  });

  it("does nothing at all without an admin session", async () => {
    const ann = seedPlayer("Ann");
    withoutAdminSession();

    const result = await renamePlayerAction(ann, "Hacked");

    expect(result).toMatchObject({ ok: false, error: "Not authorised" });
    expect(scalar("select name from players;")).toBe("Ann");
  });
});

describe("mergePlayersAction", () => {
  it("moves every attempt onto the kept record and removes the duplicate", async () => {
    const keep = seedPlayer("Mint");
    const dup = seedPlayer("Mintra"); // spelled their name differently once
    seedAttempt({ playerId: keep, unitId: "unit-01", score: 50 });
    seedAttempt({ playerId: dup, unitId: "unit-02", score: 70 });
    seedAttempt({ playerId: dup, unitId: "unit-03", score: 90 });

    const result = await mergePlayersAction(dup, keep);

    expect(result).toEqual({ ok: true });
    expect(scalar("select count(*) from players;")).toBe("1");
    expect(scalar("select count(*) from attempts;")).toBe("3");
    expect(scalar(`select count(*) from attempts where player_id = '${keep}';`)).toBe("3");
  });

  it("combines the two histories into one ranking entry per unit", async () => {
    const keep = seedPlayer("Mint");
    const dup = seedPlayer("Mint2");
    seedAttempt({ playerId: keep, unitId: "unit-02", score: 40, maxScore: 100 });
    seedAttempt({ playerId: dup, unitId: "unit-02", score: 90, maxScore: 100 });

    await mergePlayersAction(dup, keep);

    // one player, one row for the unit, and the better score wins
    expect(sql(`select count(*), max(score) from v_unit_ranking;`)).toEqual([["1", "90"]]);
    expect(scalar(`select units_completed from v_overall_ranking;`)).toBe("1");
  });

  it("refuses the same record twice, or a missing choice", async () => {
    const keep = seedPlayer("Mint");
    expect((await mergePlayersAction(keep, keep)).ok).toBe(false);
    expect((await mergePlayersAction("", keep)).ok).toBe(false);
    expect((await mergePlayersAction(keep, "")).ok).toBe(false);
    expect(scalar("select count(*) from players;")).toBe("1");
  });

  it("keeps the attempts if it cannot finish", async () => {
    const keep = seedPlayer("Mint");
    const dup = seedPlayer("Ploy");
    seedAttempt({ playerId: dup, unitId: "unit-01", score: 50 });
    withoutAdminSession();

    const result = await mergePlayersAction(dup, keep);

    expect(result.ok).toBe(false);
    expect(scalar("select count(*) from players;")).toBe("2");
    expect(scalar(`select count(*) from attempts where player_id = '${dup}';`)).toBe("1");
  });
});

describe("deletePlayerAction", () => {
  it("removes the student and their attempts", async () => {
    const ann = seedPlayer("Ann");
    const ben = seedPlayer("Ben");
    seedAttempt({ playerId: ann, unitId: "unit-01", score: 10 });
    seedAttempt({ playerId: ben, unitId: "unit-01", score: 20 });

    expect(await deletePlayerAction(ann)).toEqual({ ok: true });
    expect(scalar("select count(*) from players;")).toBe("1");
    expect(scalar("select count(*) from attempts;")).toBe("1");
    expect(scalar("select name from players;")).toBe("Ben");
  });

  it("needs an admin session", async () => {
    const ann = seedPlayer("Ann");
    withoutAdminSession();

    expect((await deletePlayerAction(ann)).ok).toBe(false);
    expect(scalar("select count(*) from players;")).toBe("1");
  });
});

describe("deleteAttemptAction", () => {
  it("removes one attempt and leaves the rest", async () => {
    const ann = seedPlayer("Ann");
    const first = seedAttempt({ playerId: ann, unitId: "unit-01", score: 10 });
    seedAttempt({ playerId: ann, unitId: "unit-01", score: 90 });

    const result = await deleteAttemptAction(first);
    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(scalar("select count(*) from attempts;")).toBe("1");
    expect(scalar("select score from attempts;")).toBe("90");
    expect(scalar("select count(*) from players;")).toBe("1");
  });

  it("needs an admin session", async () => {
    const ann = seedPlayer("Ann");
    const attemptId = seedAttempt({ playerId: ann, unitId: "unit-01", score: 10 });
    withoutAdminSession();

    expect((await deleteAttemptAction(attemptId)).ok).toBe(false);
    expect(scalar("select count(*) from attempts;")).toBe("1");
  });
});
