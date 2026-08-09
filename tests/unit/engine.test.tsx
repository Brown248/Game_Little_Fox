import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlayClient from "@/components/PlayClient";
import { savePlayer } from "@/lib/session";
import { getUnit } from "@/lib/units";
import type { AttemptRecord, UnitConfig } from "@/lib/types";
import { routerMock } from "@/tests/setup";

const saveAttempt = vi.fn<(record: AttemptRecord) => Promise<void>>();
const getUnitRanking = vi.fn();
const getOverallRanking = vi.fn();

vi.mock("@/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase")>()),
  saveAttempt: (record: AttemptRecord) => saveAttempt(record),
  getUnitRanking: (unitId: string) => getUnitRanking(unitId),
  getOverallRanking: () => getOverallRanking(),
  findOrCreatePlayer: vi.fn(),
}));

const PLAYER = { id: "player-1", name: "Mint" };

// One small unit with every block type. Deliberately a fixture and not real
// content: these tests are about the engine, and must not churn when a unit's
// questions change.
const UNIT: UnitConfig = {
  id: "unit-09",
  title: "Test Expedition",
  games: [
    {
      type: "unscramble",
      items: [
        { shadow: "🐘", scrambled: "PHETNALE", answer: "ELEPHANT" },
        { scrambled: "NOIL", answer: "LION" },
      ],
    },
    {
      type: "quiz-choice",
      items: [
        { clue: "It has a long neck.", options: ["Zebra", "Giraffe"], answerIndex: 1 },
      ],
    },
    {
      type: "sentence-builder",
      items: [{ prompt: "Hiss!", words: ["snake", "the"], answer: ["the", "snake"] }],
    },
    {
      type: "listening",
      items: [
        {
          audioUrl: "",
          clueText: "I can breathe fire.",
          options: ["Unicorn", "Dragon"],
          answerIndex: 1,
        },
      ],
    },
    { type: "writing", prompt: { questions: ["Why that animal?"] } },
  ],
};

// Fixed clock so the recorded time is deterministic.
let clock = 1_700_000_000_000;
const advance = (ms: number) => {
  clock += ms;
};

beforeEach(() => {
  clock = 1_700_000_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  saveAttempt.mockReset().mockResolvedValue(undefined);
  getUnitRanking.mockReset().mockResolvedValue([
    { player_id: "other", name: "Ann", unit_id: "unit-09", score: 50, max_score: 50, time_seconds: 50, completed_at: "" },
    { player_id: PLAYER.id, name: "Mint", unit_id: "unit-09", score: 30, max_score: 50, time_seconds: 7, completed_at: "" },
  ]);
  getOverallRanking.mockReset().mockResolvedValue([
    { player_id: "other", name: "Ann", overall_accuracy: 1, units_completed: 1 },
    { player_id: PLAYER.id, name: "Mint", overall_accuracy: 0.6, units_completed: 1 },
  ]);
});

/** Answers the whole fixture: 1 of 2 unscramble, quiz right, sentence right,
 *  listening wrong. 3 of 5 correct = 30 / 50. */
async function playWholeUnit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Your answer"), "ELEPHANT{Enter}");
  await user.click(screen.getByRole("button", { name: "Next word" }));
  await user.type(screen.getByLabelText("Your answer"), "WRONG{Enter}");
  await user.click(screen.getByRole("button", { name: "Finish this part" }));

  await user.click(screen.getByRole("button", { name: /Giraffe/ }));
  await user.click(screen.getByRole("button", { name: "Finish this part" }));

  for (const word of ["the", "snake"]) {
    await user.click(screen.getByRole("button", { name: word }));
  }
  await user.click(screen.getByRole("button", { name: "Check" }));
  await user.click(screen.getByRole("button", { name: "Finish this part" }));

  await user.click(screen.getByRole("button", { name: /Unicorn/ }));
  await user.click(screen.getByRole("button", { name: "Finish this part" }));

  await user.type(screen.getAllByRole("textbox")[0], "An owl");
  advance(7_000);
  await user.click(screen.getByRole("button", { name: /Finish and see my score/ }));
}

/** The same walk, but every answer wrong: 0 of 5. */
async function playWholeUnitBadly(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Your answer"), "WRONG{Enter}");
  await user.click(screen.getByRole("button", { name: "Next word" }));
  await user.type(screen.getByLabelText("Your answer"), "WRONG{Enter}");
  await user.click(screen.getByRole("button", { name: "Finish this part" }));

  await user.click(screen.getByRole("button", { name: /Zebra/ }));
  await user.click(screen.getByRole("button", { name: "Finish this part" }));

  for (const word of ["snake", "the"]) {
    await user.click(screen.getByRole("button", { name: word }));
  }
  await user.click(screen.getByRole("button", { name: "Check" }));
  await user.click(screen.getByRole("button", { name: "Finish this part" }));

  await user.click(screen.getByRole("button", { name: /Unicorn/ }));
  await user.click(screen.getByRole("button", { name: "Finish this part" }));

  await user.click(screen.getByRole("button", { name: /Finish and see my score/ }));
}

// The certificate is the one reward with a bar to clear: a whole unit, and at
// least half the questions right. Anything else must not offer the button.
describe("the certificate", () => {
  const CERT = { name: "Get my certificate" };

  it("is offered after a whole unit with half the answers right", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(<PlayClient unit={UNIT} totalUnits={20} />);
    await screen.findByText(UNIT.title);

    await playWholeUnit(user); // 3 of 5 = 60%

    expect(await screen.findByRole("button", CERT)).toBeTruthy();
    expect(screen.queryByText(/right to earn a certificate/)).toBeNull();
  });

  it("is withheld below half, and says how many were needed", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(<PlayClient unit={UNIT} totalUnits={20} />);
    await screen.findByText(UNIT.title);

    await playWholeUnitBadly(user); // 0 of 5

    expect(
      await screen.findByText(/Answer 3 of 5 right to earn a certificate. You got 0./)
    ).toBeTruthy();
    expect(screen.queryByRole("button", CERT)).toBeNull();
  });

  it("is never offered for a single part, however well it went", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    // block 1 is the one-question quiz; answering it right is a perfect score
    render(<PlayClient unit={UNIT} partIndex={1} totalUnits={20} />);
    await screen.findByText(UNIT.title);

    await user.click(screen.getByRole("button", { name: /Giraffe/ }));
    await user.click(screen.getByRole("button", { name: "Finish this part" }));

    expect(
      await screen.findByText(/Certificates come from playing a whole unit/)
    ).toBeTruthy();
    expect(screen.queryByRole("button", CERT)).toBeNull();
    expect(screen.getByRole("button", { name: "Play this part again" })).toBeTruthy();
  });
});

describe("PlayClient — the engine loop", () => {
  it("sends a player with no session back to the start", async () => {
    render(<PlayClient unit={UNIT} totalUnits={20} />);
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByText(/Unscramble the word/)).toBeNull();
  });

  it("starts the unit for a known player", async () => {
    savePlayer(PLAYER);
    render(<PlayClient unit={UNIT} totalUnits={20} />);

    expect(await screen.findByText(UNIT.title)).toBeTruthy();
    expect(screen.getByText(/part 1 of 5/i)).toBeTruthy();
    expect(screen.getByText(/Mint/)).toBeTruthy();
    // HUD: score, timer ring, streak — all at zero
    expect(screen.getByText("Score")).toBeTruthy();
    expect(screen.getByText("Streak")).toBeTruthy();
    expect(screen.getByText("0:00")).toBeTruthy();
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Unscramble the word" })).toBeTruthy();
  });

  it("walks every block in the JSON order", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(<PlayClient unit={UNIT} totalUnits={20} />);
    await screen.findByText(UNIT.title);

    expect(screen.getByRole("heading", { name: "Unscramble the word" })).toBeTruthy();
    await user.type(screen.getByLabelText("Your answer"), "ELEPHANT{Enter}");
    await user.click(screen.getByRole("button", { name: "Next word" }));
    await user.type(screen.getByLabelText("Your answer"), "LION{Enter}");
    await user.click(screen.getByRole("button", { name: "Finish this part" }));

    expect(screen.getByText(/part 2 of 5/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Guess the animal" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Giraffe/ }));
    await user.click(screen.getByRole("button", { name: "Finish this part" }));
    expect(screen.getByRole("heading", { name: "Build the sentence" })).toBeTruthy();

    for (const word of ["the", "snake"]) {
      await user.click(screen.getByRole("button", { name: word }));
    }
    await user.click(screen.getByRole("button", { name: "Check" }));
    await user.click(screen.getByRole("button", { name: "Finish this part" }));
    expect(screen.getByRole("heading", { name: "Listen and choose" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Dragon/ }));
    await user.click(screen.getByRole("button", { name: "Finish this part" }));
    expect(
      screen.getByRole("heading", { name: "Write about your animal" })
    ).toBeTruthy();
    expect(screen.getByText(/part 5 of 5/i)).toBeTruthy();
  });

  it("keeps the running score in the HUD", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(<PlayClient unit={UNIT} totalUnits={20} />);
    await screen.findByText(UNIT.title);

    await user.type(screen.getByLabelText("Your answer"), "ELEPHANT{Enter}");
    expect(screen.getByText("10")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Next word" }));
    await user.type(screen.getByLabelText("Your answer"), "NOPE{Enter}");
    expect(screen.getByText("10")).toBeTruthy();
  });

  // Display only — the streak is never stored or ranked.
  it("counts a streak of correct answers and resets it on a miss", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(<PlayClient unit={UNIT} totalUnits={20} />);
    await screen.findByText(UNIT.title);

    await user.type(screen.getByLabelText("Your answer"), "ELEPHANT{Enter}");
    await user.click(screen.getByRole("button", { name: "Next word" }));
    await user.type(screen.getByLabelText("Your answer"), "LION{Enter}");

    expect(screen.getByText("20")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Finish this part" }));
    await user.click(screen.getByRole("button", { name: /Zebra/ }));
    expect(screen.getByText("0")).toBeTruthy();
  });

  // A part is played and ranked on its own. It must score only its own block
  // and save under its own id, or it would land on the unit's leaderboard with
  // a fraction of the questions and beat everyone on time.
  it("plays one part on its own and ranks it separately", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(<PlayClient unit={UNIT} partIndex={1} totalUnits={20} />);
    await screen.findByText(UNIT.title);

    // only the chosen block is in play — the block track has one segment, not
    // five. (The per-question track inside the game also uses .seg, so this
    // picks the engine's own one by its aria-hidden.)
    expect(
      document.querySelectorAll('.segs[aria-hidden="true"] > .seg')
    ).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Guess the animal" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Giraffe/ }));
    await user.click(screen.getByRole("button", { name: "Finish this part" }));

    await waitFor(() => expect(saveAttempt).toHaveBeenCalled());
    const record = saveAttempt.mock.calls[0][0];
    expect(record.unit_id).toBe("unit-09-part-2");
    expect(record.total_questions).toBe(1);
    expect(record.max_score).toBe(10);
  });

  it("saves exactly one attempt with the right record, even under StrictMode", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(
      <StrictMode>
        <PlayClient unit={UNIT} totalUnits={20} />
      </StrictMode>
    );
    await screen.findByText(UNIT.title);

    await playWholeUnit(user);

    await waitFor(() => expect(saveAttempt).toHaveBeenCalled());
    expect(saveAttempt).toHaveBeenCalledTimes(1);
    expect(saveAttempt.mock.calls[0][0]).toEqual({
      player_id: PLAYER.id,
      unit_id: "unit-09",
      score: 30,
      max_score: 50,
      correct_count: 3,
      total_questions: 5,
      time_seconds: 7,
      game_type_breakdown: {
        unscramble: { correct: 1, total: 2 },
        "quiz-choice": { correct: 1, total: 1 },
        "sentence-builder": { correct: 1, total: 1 },
        listening: { correct: 0, total: 1 },
      },
    });
  });

  it("never scores the writing block", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(<PlayClient unit={UNIT} totalUnits={20} />);
    await screen.findByText(UNIT.title);
    await playWholeUnit(user);

    await waitFor(() => expect(saveAttempt).toHaveBeenCalled());
    const record = saveAttempt.mock.calls[0][0];
    expect(record.game_type_breakdown).not.toHaveProperty("writing");
    expect(record.total_questions).toBe(5);
  });

  it("shows the result screen with score, accuracy, time and breakdown", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(<PlayClient unit={UNIT} totalUnits={20} />);
    await screen.findByText(UNIT.title);
    await playWholeUnit(user);

    expect(await screen.findByText(/Great expedition/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText("30")).toBeTruthy());
    expect(screen.getByText("/50")).toBeTruthy();
    expect(screen.getByText("60%")).toBeTruthy(); // 30/50
    expect(screen.getByText("0:07")).toBeTruthy();
    expect(screen.getByText("3/5")).toBeTruthy();
    expect(screen.getByText(/writing part is practice only/)).toBeTruthy();
  });

  it("shows both ranks only after the attempt is stored", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(<PlayClient unit={UNIT} totalUnits={20} />);
    await screen.findByText(UNIT.title);
    await playWholeUnit(user);

    // 2nd of 2 on both boards: the unit board and the overall board
    expect(await screen.findAllByText("#2")).toHaveLength(2);
    expect(screen.getAllByText(/of 2 explorers/)).toHaveLength(2);
    expect(screen.getByText(/1 of 20 units played/)).toBeTruthy();
    expect(getUnitRanking).toHaveBeenCalledWith("unit-09");
    expect(getOverallRanking).toHaveBeenCalled();
  });

  it("keeps the score visible and offers a retry when saving fails", async () => {
    savePlayer(PLAYER);
    saveAttempt.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<PlayClient unit={UNIT} totalUnits={20} />);
    await screen.findByText(UNIT.title);
    await playWholeUnit(user);

    expect(await screen.findByText(/Could not reach the scoreboard/)).toBeTruthy();
    expect(screen.getByText(/result above is still correct/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText("30")).toBeTruthy());
    expect(screen.queryByText("Your ranking")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(saveAttempt).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Your ranking")).toBeTruthy();
  });

  it("still shows the result when the leaderboard query fails", async () => {
    savePlayer(PLAYER);
    getUnitRanking.mockRejectedValue({ message: "view missing", code: "42P01" });
    const user = userEvent.setup();
    render(<PlayClient unit={UNIT} totalUnits={20} />);
    await screen.findByText(UNIT.title);
    await playWholeUnit(user);

    expect(await screen.findByText(/leaderboard could not be loaded/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText("30")).toBeTruthy());
  });

  it("confirms before abandoning a unit", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(<PlayClient unit={UNIT} totalUnits={20} />);
    await screen.findByText(UNIT.title);

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "Exit" }));
    expect(routerMock.push).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Exit" }));
    expect(routerMock.push).toHaveBeenCalledWith("/");
    expect(saveAttempt).not.toHaveBeenCalled();
  });

  it("runs a unit that has no writing block at all", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(
      <PlayClient
        unit={{
          id: "unit-11",
          title: "Quiz only",
          games: [
            {
              type: "quiz-choice",
              items: [{ clue: "c", options: ["yes", "no"], answerIndex: 0 }],
            },
          ],
        }}
        totalUnits={20}
      />
    );
    await screen.findByText("Quiz only");

    await user.click(screen.getByRole("button", { name: /yes/ }));
    advance(3_000);
    await user.click(screen.getByRole("button", { name: "Finish this part" }));

    await waitFor(() => expect(saveAttempt).toHaveBeenCalled());
    expect(saveAttempt.mock.calls[0][0]).toMatchObject({
      unit_id: "unit-11",
      score: 10,
      max_score: 10,
      total_questions: 1,
      time_seconds: 3,
    });
  });
});

// The engine is exercised above with a fixture; these prove the shipped
// content is actually playable through the same engine.
describe("the real units are playable", () => {
  it("opens the Shadow Animal Challenge on its first silhouette", async () => {
    savePlayer(PLAYER);
    const unit = getUnit("unit-01")!;
    render(<PlayClient unit={unit} totalUnits={20} />);

    expect(await screen.findByText("Shadow Animal Challenge")).toBeTruthy();
    expect(screen.getByText("PHETNALE")).toBeTruthy();
    expect(screen.getByText("1 / 30")).toBeTruthy();
    expect(screen.getByText(/whose shadow is this/)).toBeTruthy();
    // this unit is the emoji silhouette version
    expect(screen.getByLabelText("shadow of an animal")).toBeTruthy();
  });

  it("answers a shadow word and reveals the animal", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(<PlayClient unit={getUnit("unit-01")!} totalUnits={20} />);
    await screen.findByText("Shadow Animal Challenge");

    await user.type(screen.getByLabelText("Your answer"), "elephant{Enter}");

    expect(screen.getByText(/Correct/)).toBeTruthy();
    // the silhouette lights up and is now named
    expect(screen.getByLabelText("ELEPHANT").className).toContain(
      "shadow-animal--lit"
    );
    expect(screen.queryByText(/whose shadow is this/)).toBeNull();
    expect(screen.getByText("10")).toBeTruthy();
  });

  // Part 2 of the same unit is the illustrated one: real artwork, no emoji.
  // Played on its own so the test doesn't have to type Part 1's thirty words.
  it("plays Part 2 with drawn animals instead of emoji", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    const unit = getUnit("unit-01")!;
    render(
      <PlayClient unit={{ ...unit, games: [unit.games[1]] }} totalUnits={20} />
    );
    await screen.findByText("Shadow Animal Challenge");

    expect(screen.getByText("POTAMUSHIPPO")).toBeTruthy();
    expect(screen.queryByLabelText("shadow of an animal")).toBeNull();
    expect(document.querySelector(".art")!.className).not.toContain("art--lit");
    expect(screen.queryByAltText("HIPPOPOTAMUS")).toBeNull();

    await user.type(screen.getByLabelText("Your answer"), "hippopotamus{Enter}");

    expect(document.querySelector(".art")!.className).toContain("art--lit");
    expect(screen.getByAltText("HIPPOPOTAMUS")).toBeTruthy();
  });

  it("opens unit-02 on Part B's first clue", async () => {
    savePlayer(PLAYER);
    render(<PlayClient unit={getUnit("unit-02")!} totalUnits={20} />);

    expect(await screen.findByText("Wild Life and Wonderful Creatures")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Guess the animal" })).toBeTruthy();
    expect(screen.getByText(/It has a long neck/)).toBeTruthy();
    expect(screen.getByText("1 / 30")).toBeTruthy();
    expect(screen.getByText(/part 1 of 5/i)).toBeTruthy();
  });

  // Part D's clues are video, which is a different player from the audio one
  // and must not fall back to the device voice.
  it("ships every Part D clip as a real file the player can load", () => {
    const unit = getUnit("unit-02")!;
    const listening = unit.games.find((g) => g.type === "listening");
    if (listening?.type !== "listening") throw new Error("no listening block");

    const withVideo = listening.items.filter((item) => item.videoUrl);
    expect(withVideo).toHaveLength(6);
    expect(withVideo[0].videoUrl).toBe("unit-02/clue-1.mp4");
  });
});
