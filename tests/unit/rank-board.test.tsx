import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RankBoard from "@/components/RankBoard";
import { savePlayer } from "@/lib/session";
import type { AttemptRow, UnitRankingRow } from "@/lib/types";

const getUnitRanking = vi.fn();
const getPlayerAttempts = vi.fn();
const downloadCertificate = vi.fn();

vi.mock("@/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase")>()),
  getUnitRanking: (id: string) => getUnitRanking(id),
  getPlayerAttempts: (playerId: string) => getPlayerAttempts(playerId),
}));

vi.mock("@/lib/certificate", () => ({
  downloadCertificate: (data: unknown) => downloadCertificate(data),
  warmCertificate: () => {},
}));

const GAME_ID = "game-02";
const ME = { id: "p2", name: "Mint" };
/** A complete run is every scored question in the game. */
const FULL = 50;

function row(over: Partial<UnitRankingRow> = {}): UnitRankingRow {
  return {
    player_id: "p1",
    name: "Fai",
    unit_id: GAME_ID,
    score: 470,
    max_score: 500,
    time_seconds: 1104,
    completed_at: "",
    ...over,
  };
}

function attempt(over: Partial<AttemptRow> = {}): AttemptRow {
  return {
    id: "a1",
    player_id: ME.id,
    unit_id: GAME_ID,
    score: 400,
    max_score: 500,
    correct_count: 40,
    total_questions: FULL,
    time_seconds: 1500,
    completed_at: "2026-08-10T09:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  getUnitRanking.mockReset().mockResolvedValue([]);
  getPlayerAttempts.mockReset().mockResolvedValue([]);
  downloadCertificate.mockReset().mockResolvedValue(undefined);
  savePlayer(ME);
});

const mount = () =>
  render(
    <RankBoard
      gameId={GAME_ID}
      gameTitle="Little Fox Game"
      fullQuestionCount={FULL}
    />
  );

describe("the ranking", () => {
  // Exactly what the teacher asked to see on it: "ควรโชว์ อันดับ ชื่อ
  // คะแนนที่ทำได้ เวลาที่ใช้ไป".
  it("shows place, name, score and time", async () => {
    getUnitRanking.mockResolvedValue([
      row({ player_id: "p1", name: "Fai", score: 470, time_seconds: 1104 }),
      row({ player_id: ME.id, name: "Mint", score: 400, time_seconds: 1500 }),
    ]);
    mount();

    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(2);

    const first = within(rows[0]);
    expect(first.getByLabelText("Place 1")).toBeTruthy();
    expect(first.getByText("Fai")).toBeTruthy();
    expect(first.getByText("470")).toBeTruthy();
    expect(first.getByText("18:24")).toBeTruthy();

    expect(getUnitRanking).toHaveBeenCalledWith(GAME_ID);
  });

  it("keeps the order the database gave it", async () => {
    // Mint is faster but scored less: a client-side re-sort would move her up
    // and quietly break the ranking rule.
    getUnitRanking.mockResolvedValue([
      row({ player_id: "p1", name: "Fai", score: 470, time_seconds: 3000 }),
      row({ player_id: ME.id, name: "Mint", score: 800, time_seconds: 60 }),
    ]);
    mount();

    const names = (await screen.findAllByRole("listitem")).map(
      (li) => li.querySelector(".board__name")?.textContent
    );
    expect(names).toEqual(["Fai", "Mint"]);
  });

  it("marks the row of whoever is on this device", async () => {
    getUnitRanking.mockResolvedValue([
      row({ player_id: "p1", name: "Fai" }),
      row({ player_id: ME.id, name: "Mint" }),
    ]);
    mount();

    await screen.findAllByRole("listitem");
    const mine = screen
      .getAllByRole("listitem")
      .filter((li) => li.className.includes("board__row--me"));
    expect(mine).toHaveLength(1);
    expect(within(mine[0]).getByText("Mint")).toBeTruthy();
  });

  // A leaderboard whose top three look like every other row is not really a
  // leaderboard. Gold, silver and bronze are one class each, and only first
  // place gets the crown.
  it("marks the top three, each in its own colour", async () => {
    getUnitRanking.mockResolvedValue([
      row({ player_id: "a", name: "Fai" }),
      row({ player_id: "b", name: "Pim" }),
      row({ player_id: "c", name: "Nut" }),
      row({ player_id: "d", name: "Ploy" }),
    ]);
    mount();

    const listed = await screen.findAllByRole("listitem");
    expect(listed[0].className).toContain("board__row--1");
    expect(listed[1].className).toContain("board__row--2");
    expect(listed[2].className).toContain("board__row--3");
    expect(listed[3].className).not.toMatch(/board__row--[123]/);

    const discs = listed.map(
      (li) => li.querySelector(".board__place")?.className ?? ""
    );
    expect(discs[0]).toContain("board__place--1");
    expect(discs[1]).toContain("board__place--2");
    expect(discs[2]).toContain("board__place--3");
    expect(discs[3]).not.toContain("board__place--top");

    // the crown belongs to first place alone
    expect(document.querySelectorAll(".board__crown")).toHaveLength(1);
    expect(listed[0].querySelector(".board__crown")).not.toBeNull();
  });

  it("invites the first player when nobody has finished", async () => {
    mount();
    expect(await screen.findByText(/Nobody has played yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Play" }).getAttribute("href")).toBe(
      "/play"
    );
  });

  it("surfaces a failure instead of a blank page", async () => {
    getUnitRanking.mockRejectedValue(new TypeError("Failed to fetch"));
    mount();
    expect(await screen.findByText(/No internet/)).toBeTruthy();
  });
});

// Two conditions, and a run can now be stopped early, so both have to be
// checked here: the whole game played, and at least half of it right.
describe("the certificate", () => {
  const CERT = { name: "Get my certificate" };

  // The trap the "Finish here?" button opens. A child taught only the first
  // part answers 20 of 27 and stops: 74% right, and without the length check
  // that is a certificate for a quarter of the game.
  it("is withheld from a run that stopped early, however good it was", async () => {
    getUnitRanking.mockResolvedValue([row({ player_id: ME.id, name: "Mint" })]);
    getPlayerAttempts.mockResolvedValue([
      attempt({ correct_count: 27, total_questions: 27 }),
    ]);
    mount();

    expect(await screen.findByText(/Play every question/)).toBeTruthy();
    expect(screen.queryByRole("button", CERT)).toBeNull();
  });

  it("is offered when at least half the answers were right", async () => {
    getUnitRanking.mockResolvedValue([row({ player_id: ME.id, name: "Mint" })]);
    getPlayerAttempts.mockResolvedValue([attempt({ correct_count: 25 })]);
    mount();

    expect(await screen.findByRole("button", CERT)).toBeTruthy();
  });

  it("is withheld below half, and says how many are needed", async () => {
    getUnitRanking.mockResolvedValue([row({ player_id: ME.id, name: "Mint" })]);
    getPlayerAttempts.mockResolvedValue([attempt({ correct_count: 24 })]);
    mount();

    expect(await screen.findByText(/Get 25 right/)).toBeTruthy();
    expect(screen.queryByRole("button", CERT)).toBeNull();
  });

  // Replays are kept, and the board ranks the best of them — so the certificate
  // has to be judged on the best one too, not on whichever came back first.
  it("judges the best run, not the latest", async () => {
    getUnitRanking.mockResolvedValue([row({ player_id: ME.id, name: "Mint" })]);
    getPlayerAttempts.mockResolvedValue([
      attempt({ id: "latest", score: 100, correct_count: 10 }),
      attempt({ id: "best", score: 700, correct_count: 70 }),
    ]);
    mount();

    expect(await screen.findByRole("button", CERT)).toBeTruthy();
  });

  it("ignores runs saved under an older game id", async () => {
    getUnitRanking.mockResolvedValue([row({ player_id: ME.id, name: "Mint" })]);
    getPlayerAttempts.mockResolvedValue([
      attempt({ unit_id: "unit-01", correct_count: 50 }),
    ]);
    mount();

    // the old unit run does not count towards this game's certificate
    await screen.findAllByRole("listitem");
    expect(screen.queryByRole("button", CERT)).toBeNull();
  });

  it("hands the run's real numbers to the PDF", async () => {
    const user = userEvent.setup();
    getUnitRanking.mockResolvedValue([
      row({ player_id: ME.id, name: "Mint", score: 400, time_seconds: 1500 }),
    ]);
    getPlayerAttempts.mockResolvedValue([attempt({ correct_count: 40 })]);
    mount();

    await user.click(await screen.findByRole("button", CERT));

    await waitFor(() =>
      expect(downloadCertificate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Mint",
          unitId: GAME_ID,
          score: 400,
          maxScore: 500,
          timeSeconds: 1500,
          rankLabel: "1 / 1",
        })
      )
    );
  });

  // A button that does nothing when pressed is what the teacher reported the
  // first time round: "โหลดไม่ได้ ต้องเเคปเอา".
  it("shows the reason on screen when the PDF will not build", async () => {
    const user = userEvent.setup();
    getUnitRanking.mockResolvedValue([row({ player_id: ME.id, name: "Mint" })]);
    getPlayerAttempts.mockResolvedValue([attempt({ correct_count: 40 })]);
    downloadCertificate.mockRejectedValue(new Error("Incomplete or corrupt PNG"));
    mount();

    await user.click(await screen.findByRole("button", CERT));
    expect(await screen.findByText(/Incomplete or corrupt PNG/)).toBeTruthy();
  });
});
