import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyScores from "@/components/MyScores";
import { certificateNeeds, earnsCertificate } from "@/lib/format";
import { savePlayer } from "@/lib/session";
import type { AttemptRow } from "@/lib/types";

const getPlayerAttempts = vi.fn();
const downloadCertificate = vi.fn();

vi.mock("@/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase")>()),
  getPlayerAttempts: (playerId: string) => getPlayerAttempts(playerId),
}));

vi.mock("@/lib/certificate", () => ({
  downloadCertificate: (data: unknown) => downloadCertificate(data),
  warmCertificate: () => {},
}));

const GAME_ID = "game-01";
/** A complete run of the current game. */
const FULL = 50;

const TITLES = {
  "unit-01": "Shadow Animal Challenge",
  "unit-02": "Wild Life and Wonderful Creatures",
};

function attempt(over: Partial<AttemptRow> = {}): AttemptRow {
  return {
    id: "a1",
    player_id: "p1",
    unit_id: "unit-01",
    score: 300,
    max_score: 350,
    correct_count: 30,
    total_questions: 35,
    time_seconds: 240,
    completed_at: "2026-08-01T09:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  getPlayerAttempts.mockReset().mockResolvedValue([]);
  downloadCertificate.mockReset().mockResolvedValue(undefined);
  savePlayer({ id: "p1", name: "Mint" });
});

// The rule the teacher set, and the reason it moved out of ResultScreen: two
// screens hand out certificates now and they must not be able to disagree.
describe("who earns a certificate", () => {
  it("needs a whole unit and half the questions right", () => {
    expect(earnsCertificate("unit-01", 18, 35)).toBe(true);
    expect(earnsCertificate("unit-01", 17, 35)).toBe(false);
    // exactly half counts
    expect(earnsCertificate("unit-01", 5, 10)).toBe(true);
  });

  it("never counts a single part, however well it went", () => {
    expect(earnsCertificate("unit-01-part-1", 27, 27)).toBe(false);
  });

  it("counts answers rather than points", () => {
    // the bar is 18 of 35 whatever a question happens to be worth
    expect(certificateNeeds(35)).toBe(18);
    expect(certificateNeeds(10)).toBe(5);
  });

  it("refuses a run with no questions in it", () => {
    expect(earnsCertificate("unit-01", 0, 0)).toBe(false);
  });
});

describe("MyScores", () => {
  it("asks for a name first when nobody is signed in", async () => {
    window.localStorage.clear();
    render(<MyScores unitTitles={TITLES} gameId={GAME_ID} fullQuestionCount={FULL} />);

    expect(await screen.findByText(/Type your name first/)).toBeTruthy();
    expect(getPlayerAttempts).not.toHaveBeenCalled();
  });

  it("says so plainly before anything has been played", async () => {
    render(<MyScores unitTitles={TITLES} gameId={GAME_ID} fullQuestionCount={FULL} />);
    expect(await screen.findByText(/Nothing here yet, Mint/)).toBeTruthy();
  });

  it("shows every run, newest first, in the order the query returned", async () => {
    getPlayerAttempts.mockResolvedValue([
      attempt({ id: "a1" }),
      attempt({ id: "a2", unit_id: "unit-02", score: 100, max_score: 740 }),
    ]);
    render(<MyScores unitTitles={TITLES} gameId={GAME_ID} fullQuestionCount={FULL} />);

    await waitFor(() => expect(screen.getByText("300/350")).toBeTruthy());
    expect(screen.getByText("Shadow Animal Challenge")).toBeTruthy();
    expect(screen.getByText("Wild Life and Wonderful Creatures")).toBeTruthy();
    expect(screen.getAllByText("30/35")).toHaveLength(2);
    expect(screen.getAllByText("4:00")).toHaveLength(2);
    expect(getPlayerAttempts).toHaveBeenCalledWith("p1");
  });

  // The whole reason this screen exists: "ย้อนดูไม่ได้ด้วย เหมือนต้องเล่นใหม่".
  it("re-issues an earned certificate without replaying the unit", async () => {
    const user = userEvent.setup();
    getPlayerAttempts.mockResolvedValue([attempt()]);
    render(<MyScores unitTitles={TITLES} gameId={GAME_ID} fullQuestionCount={FULL} />);

    await user.click(await screen.findByRole("button", { name: "Certificate" }));

    await waitFor(() =>
      expect(downloadCertificate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Mint",
          unitId: "unit-01",
          unitTitle: "Shadow Animal Challenge",
          score: 300,
          maxScore: 350,
          timeSeconds: 240,
        })
      )
    );
  });

  // Historic rows from when the game was played one part at a time. The id
  // shape is still what rules them out, so old part runs never hand out a
  // certificate years after the fact.
  it("offers no certificate for an old single-part run", async () => {
    getPlayerAttempts.mockResolvedValue([
      attempt({ unit_id: "unit-01-part-1", correct_count: 27, total_questions: 27 }),
    ]);
    render(<MyScores unitTitles={TITLES} gameId={GAME_ID} fullQuestionCount={FULL} />);

    expect(await screen.findByText(/Needs 14 right/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Certificate" })).toBeNull();
  });

  // /rank and /me both hand out certificates, and they must never disagree.
  // This screen was still asking the old question — "was half of what you
  // played right?" — so a child who answered 20 of 50 and pressed Finish was
  // refused on the ranking and offered one here.
  it("refuses a run of this game that stopped early", async () => {
    getPlayerAttempts.mockResolvedValue([
      attempt({ unit_id: GAME_ID, correct_count: 20, total_questions: 27 }),
    ]);
    render(
      <MyScores unitTitles={TITLES} gameId={GAME_ID} fullQuestionCount={FULL} />
    );

    expect(await screen.findByText(/Play every question/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Certificate" })).toBeNull();
  });

  it("still issues one for a run of this game played all the way", async () => {
    getPlayerAttempts.mockResolvedValue([
      attempt({ unit_id: GAME_ID, correct_count: 39, total_questions: FULL }),
    ]);
    render(
      <MyScores unitTitles={TITLES} gameId={GAME_ID} fullQuestionCount={FULL} />
    );

    expect(await screen.findByRole("button", { name: "Certificate" })).toBeTruthy();
  });

  it("says how many were needed when the run fell short", async () => {
    getPlayerAttempts.mockResolvedValue([
      attempt({ correct_count: 10, total_questions: 35 }),
    ]);
    render(<MyScores unitTitles={TITLES} gameId={GAME_ID} fullQuestionCount={FULL} />);

    expect(await screen.findByText(/Needs 18 right/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Certificate" })).toBeNull();
  });

  // A button that does nothing when pressed is the worst outcome here — it is
  // exactly what the teacher reported ("โหลดไม่ได้ ต้องเเคปเอา").
  it("shows the reason on screen when the PDF will not build", async () => {
    const user = userEvent.setup();
    getPlayerAttempts.mockResolvedValue([attempt()]);
    downloadCertificate.mockRejectedValue(new Error("Incomplete or corrupt PNG file"));
    render(<MyScores unitTitles={TITLES} gameId={GAME_ID} fullQuestionCount={FULL} />);

    await user.click(await screen.findByRole("button", { name: "Certificate" }));

    expect(
      await screen.findByText(/Incomplete or corrupt PNG file/)
    ).toBeTruthy();
  });

  it("surfaces a scoreboard failure instead of an empty page", async () => {
    getPlayerAttempts.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<MyScores unitTitles={TITLES} gameId={GAME_ID} fullQuestionCount={FULL} />);

    expect(await screen.findByText(/No internet/)).toBeTruthy();
  });
});
