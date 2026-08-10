import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlayClient from "@/components/PlayClient";
import { buildGame } from "@/lib/game";
import { clearProgress } from "@/lib/progress";
import { savePlayer } from "@/lib/session";
import type { AttemptRecord, GameBlock, UnitConfig } from "@/lib/types";
import { routerMock } from "@/tests/setup";

const saveAttempt = vi.fn<(record: AttemptRecord) => Promise<void>>();

vi.mock("@/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase")>()),
  saveAttempt: (record: AttemptRecord) => saveAttempt(record),
  findOrCreatePlayer: vi.fn(),
}));

const GAME_ID = "game-01";
const PLAYER = { id: "player-1", name: "Mint" };

// One small game with every block type. Deliberately a fixture and not real
// content: these tests are about the engine, and must not churn when the
// questions change.
const UNIT: UnitConfig = {
  id: "unit-09",
  title: "Test Expedition",
  games: [
    {
      type: "unscramble",
      items: [
        { emoji: "🐘", scrambled: "PHETNALE", answer: "ELEPHANT" },
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

const GAMES: GameBlock[] = UNIT.games;

// Fixed clock so the recorded time is deterministic.
let clock = 1_700_000_000_000;
const advance = (ms: number) => {
  clock += ms;
};

beforeEach(() => {
  clock = 1_700_000_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  saveAttempt.mockReset().mockResolvedValue(undefined);
  clearProgress();
});

/** Mounts the engine the only way it can be mounted now: the whole game. */
function play() {
  return render(<PlayClient games={GAMES} gameId={GAME_ID} />);
}

/** Plays the whole game: 1 of 2 unscramble, quiz right, sentence right,
 *  listening wrong. 3 of 5 correct = 30 / 50. */
async function playItAll(user: ReturnType<typeof userEvent.setup>) {
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

/** Finishes only the first block, which leaves a saved run behind. */
async function playFirstBlock(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Your answer"), "ELEPHANT{Enter}");
  await user.click(screen.getByRole("button", { name: "Next word" }));
  await user.type(screen.getByLabelText("Your answer"), "LION{Enter}");
  await user.click(screen.getByRole("button", { name: "Finish this part" }));
}

describe("PlayClient — one game, no choosing", () => {
  it("sends a player with no session back to the start", async () => {
    play();
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByText(/Make the word/)).toBeNull();
  });

  // The teacher's instruction in one test: there is nothing to pick, and the
  // very first thing on screen is question one.
  it("opens on the first question of the first block", async () => {
    savePlayer(PLAYER);
    play();

    expect(
      await screen.findByRole("heading", { name: "Make the word" })
    ).toBeTruthy();
    expect(screen.getByText(/part 1 of 5/i)).toBeTruthy();
    expect(screen.getByText(/Mint/)).toBeTruthy();
    expect(screen.getByText("Score")).toBeTruthy();
    expect(screen.getByText("In a row")).toBeTruthy();
    expect(screen.getByText("0:00")).toBeTruthy();
    expect(screen.getAllByText("0")).toHaveLength(2);
  });

  it("walks every block in order", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    play();
    await screen.findByRole("heading", { name: "Make the word" });

    await playFirstBlock(user);
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
    play();
    await screen.findByRole("heading", { name: "Make the word" });

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
    play();
    await screen.findByRole("heading", { name: "Make the word" });

    await user.type(screen.getByLabelText("Your answer"), "ELEPHANT{Enter}");
    await user.click(screen.getByRole("button", { name: "Next word" }));
    await user.type(screen.getByLabelText("Your answer"), "LION{Enter}");

    expect(screen.getByText("20")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Finish this part" }));
    await user.click(screen.getByRole("button", { name: /Zebra/ }));
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("saves exactly one attempt under the game id, even under StrictMode", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    render(
      <StrictMode>
        <PlayClient games={GAMES} gameId={GAME_ID} />
      </StrictMode>
    );
    await screen.findByRole("heading", { name: "Make the word" });

    await playItAll(user);

    await waitFor(() => expect(saveAttempt).toHaveBeenCalled());
    expect(saveAttempt).toHaveBeenCalledTimes(1);
    expect(saveAttempt.mock.calls[0][0]).toEqual({
      player_id: PLAYER.id,
      unit_id: GAME_ID,
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

  // The whole point of the back-button fix. push would leave a finished game
  // sitting in history, and backing out of the ranking would walk straight into
  // it and start it over — exactly what the teacher reported.
  it("replaces the game with the ranking so back goes to the start", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    play();
    await screen.findByRole("heading", { name: "Make the word" });

    await playItAll(user);

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/rank"));
    expect(routerMock.push).not.toHaveBeenCalledWith("/rank");
  });

  it("never scores the writing block", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    play();
    await screen.findByRole("heading", { name: "Make the word" });

    await playItAll(user);

    await waitFor(() => expect(saveAttempt).toHaveBeenCalled());
    const record = saveAttempt.mock.calls[0][0];
    expect(record.total_questions).toBe(5);
    expect(record.game_type_breakdown?.writing).toBeUndefined();
  });

  it("asks before finishing early, in its own dialog", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    play();
    await screen.findByRole("heading", { name: "Make the word" });

    await user.type(screen.getByLabelText("Your answer"), "ELEPHANT{Enter}");
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.getByText("Finish here?")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Keep playing" }));
    expect(saveAttempt).not.toHaveBeenCalled();
    // still in the game, on the same question
    expect(screen.getByRole("heading", { name: "Make the word" })).toBeTruthy();
  });
});

// One run is every question there is, but a class only reaches them a part at a
// time. Without a way out that keeps the score, a child taught up to Part 1
// would face 69 questions from lessons they have not had — and lose everything
// by closing the tab, because a score is only written at the very end.
describe("stopping early", () => {
  async function finishNow(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Finish" }));
    await user.click(screen.getByRole("button", { name: "Finish now" }));
  }

  it("banks only the questions that were answered", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    play();
    await screen.findByRole("heading", { name: "Make the word" });

    await user.type(screen.getByLabelText("Your answer"), "ELEPHANT{Enter}");
    await user.click(screen.getByRole("button", { name: "Next word" }));
    await user.type(screen.getByLabelText("Your answer"), "LION{Enter}");
    advance(4_000);

    await finishNow(user);

    await waitFor(() => expect(saveAttempt).toHaveBeenCalled());
    const record = saveAttempt.mock.calls[0][0];
    expect(record.total_questions).toBe(2);
    expect(record.correct_count).toBe(2);
    expect(record.score).toBe(20);
    expect(record.max_score).toBe(20);
    expect(record.time_seconds).toBe(4);
    // and it lands on the ranking, same as a run played to the end
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/rank"));
  });

  // Opened by mistake and answered nothing: a 0-of-0 row would be noise on the
  // board and nothing to be proud of.
  it("saves nothing when no question has been answered", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    play();
    await screen.findByRole("heading", { name: "Make the word" });

    await finishNow(user);

    expect(saveAttempt).not.toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith("/");
  });

  it("throws the half-finished run away once it is banked", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    const first = play();
    await screen.findByRole("heading", { name: "Make the word" });

    await playFirstBlock(user); // finishes block 1, so progress is saved
    await finishNow(user);
    await waitFor(() => expect(saveAttempt).toHaveBeenCalled());
    first.unmount();

    play();
    expect(await screen.findByText(/part 1 of 5/i)).toBeTruthy();
    expect(screen.queryByText("Carry on where you stopped?")).toBeNull();
  });

  it("keeps the score and offers a retry when saving fails", async () => {
    savePlayer(PLAYER);
    saveAttempt.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    play();
    await screen.findByRole("heading", { name: "Make the word" });

    await playItAll(user);

    expect(await screen.findByText(/did not save/i)).toBeTruthy();
    expect(screen.getByText(/No internet/)).toBeTruthy();
    expect(routerMock.replace).not.toHaveBeenCalledWith("/rank");

    saveAttempt.mockResolvedValue(undefined);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/rank"));
  });
});

// One run is every question there is, and the teacher wants it played at home
// too. Losing it to a closed tab would mean nobody ever reaches the end.
describe("carrying a half-finished run", () => {
  it("offers to carry on, and keeps the score and the clock", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    const first = play();
    await screen.findByRole("heading", { name: "Make the word" });

    await playFirstBlock(user); // 2 right = 20 points
    advance(9_000);
    first.unmount(); // the tab closes here

    play();
    expect(await screen.findByText("Carry on where you stopped?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Carry on" }));

    // straight back to block 2, with the score intact
    expect(screen.getByRole("heading", { name: "Guess the animal" })).toBeTruthy();
    expect(screen.getByText(/part 2 of 5/i)).toBeTruthy();
    expect(screen.getByText("20")).toBeTruthy();
  });

  // Time away is not time played. Without this a child who stopped overnight
  // would come back to a clock reading eight hours.
  it("does not count the time the tab was closed", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    const first = play();
    await screen.findByRole("heading", { name: "Make the word" });

    await playFirstBlock(user);
    first.unmount();

    advance(8 * 60 * 60 * 1000); // asleep
    play();
    await user.click(await screen.findByRole("button", { name: "Carry on" }));

    expect(screen.getByText("0:00")).toBeTruthy();
    expect(screen.queryByText(/8:00:00/)).toBeNull();
  });

  it("starts clean when the player asks to", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    const first = play();
    await screen.findByRole("heading", { name: "Make the word" });

    await playFirstBlock(user);
    first.unmount();

    const second = play();
    await user.click(await screen.findByRole("button", { name: "Start again" }));

    expect(screen.getByRole("heading", { name: "Make the word" })).toBeTruthy();
    expect(screen.getByText(/part 1 of 5/i)).toBeTruthy();
    expect(screen.getAllByText("0")).toHaveLength(2);
    second.unmount();

    // and the offer is gone for good
    play();
    expect(screen.queryByText("Carry on where you stopped?")).toBeNull();
  });

  it("does not offer someone else's run", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    const first = play();
    await screen.findByRole("heading", { name: "Make the word" });
    await playFirstBlock(user);
    first.unmount();

    savePlayer({ id: "player-2", name: "Ploy" });
    play();

    expect(await screen.findByText(/part 1 of 5/i)).toBeTruthy();
    expect(screen.queryByText("Carry on where you stopped?")).toBeNull();
  });

  // The trap this actually walked into: Part C2 went from 25 sentences to 10
  // and the game still had the same six blocks, so a run saved that morning
  // would have been offered back — carrying 25 answers to questions that no
  // longer exist, and finishing with more answers than the game contains. That
  // run can never earn a certificate and its row cannot be compared with
  // anyone else's, and nothing would have said why.
  it("does not offer a run saved against different questions", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    const first = play();
    await screen.findByRole("heading", { name: "Make the word" });
    await playFirstBlock(user);
    first.unmount();

    // same five blocks, one of them a question shorter
    const trimmed = GAMES.map((block, i) =>
      i === 1 && block.type === "quiz-choice"
        ? { ...block, items: block.items.slice(0, -1) }
        : block
    );
    render(<PlayClient games={trimmed} gameId={GAME_ID} />);

    expect(await screen.findByText(/part 1 of 5/i)).toBeTruthy();
    expect(screen.queryByText("Carry on where you stopped?")).toBeNull();
  });

  it("throws the saved run away once the score is banked", async () => {
    savePlayer(PLAYER);
    const user = userEvent.setup();
    const first = play();
    await screen.findByRole("heading", { name: "Make the word" });

    await playItAll(user);
    await waitFor(() => expect(saveAttempt).toHaveBeenCalled());
    first.unmount();

    play();
    expect(await screen.findByText(/part 1 of 5/i)).toBeTruthy();
    expect(screen.queryByText("Carry on where you stopped?")).toBeNull();
  });
});

// The real content, played through the same engine.
describe("the real game", () => {
  it("is every question in every unit, in file order", () => {
    const blocks = buildGame();

    expect(blocks.map((b) => b.type)).toEqual([
      "unscramble", // unit-01 — the 15 animal words
      "quiz-choice", // unit-02 Part B
      "quiz-choice", // unit-02 Part C1
      "sentence-builder", // unit-02 Part C2
      "listening", // unit-02 Part D
      "writing", // unit-02 Part E — never scored
    ]);

    const questions = blocks.reduce(
      (n, b) => n + (b.type === "writing" ? 0 : b.items.length),
      0
    );
    expect(questions).toBe(50);
    expect(questions * 10).toBe(500);
  });

  it("opens on the very first animal", async () => {
    savePlayer(PLAYER);
    render(<PlayClient games={buildGame()} gameId={GAME_ID} />);

    expect(
      await screen.findByRole("heading", { name: "Make the word" })
    ).toBeTruthy();
    expect(screen.getByText("PHETNALE")).toBeTruthy();
    expect(screen.getByLabelText("elephant")).toBeTruthy();
    expect(screen.getByText("1 / 15")).toBeTruthy();
    expect(screen.getByText(/part 1 of 6/i)).toBeTruthy();
  });
});
