import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Failure from "@/components/Failure";
import MyScores from "@/components/MyScores";
import RankBoard from "@/components/RankBoard";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import StartForm from "@/components/StartForm";
import { describeFailure } from "@/lib/supabase";

vi.mock("@/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase")>()),
  findOrCreatePlayer: vi.fn(),
  getUnitRanking: vi.fn().mockResolvedValue([]),
  getOverallRanking: vi.fn().mockResolvedValue([]),
  getPlayerAttempts: vi.fn().mockResolvedValue([]),
}));

// The teacher read the game on a phone and said the English was too hard and
// there was too much of it — "ตัวหนักสือเยอะเกินไปเด็กคงไม่อ่าน...ต้องเป็นคำศัพท์
// ที่เบสิคเท่านั้น". These two rules are what came out of that, and they are
// checked here so a long explanatory paragraph cannot quietly come back.
//
// Only chrome is checked, never the units: a clue like "I am a giant sea
// monster with long arms" is the lesson, and Part D is called "Mythological
// Creatures" on the teacher's own worksheet.

/** Words a nine-year-old learning English does not have yet. */
const TOO_HARD = [
  "explorer",
  "expedition",
  "leaderboard",
  "scoreboard",
  "accuracy",
  "attempt",
  "dominate",
  "averaging",
  "streak",
  "unscramble",
  "responsive",
  "breakpoint",
  "credentials",
  "curiosity",
];

/** Longer than this and it is a paragraph, and a paragraph goes unread. */
const MAX_SENTENCE_WORDS = 12;

function visibleText(): string {
  return document.body.textContent ?? "";
}

function hardWordsOnScreen(): string[] {
  const text = visibleText().toLowerCase();
  return TOO_HARD.filter((word) => text.includes(word));
}

/** Every run of prose on the screen, one element at a time.
 *
 *  Measured per element rather than by splitting the whole page on full stops:
 *  a screen of short labels has no full stops at all, so the naive version read
 *  the entire page as one enormous sentence. What matters is whether any single
 *  thing a child looks at has turned into a paragraph. */
function longSentences(): string[] {
  const blocks = document.body.querySelectorAll(
    "p, li, span, label, summary, h1, h2, h3, button, a"
  );

  const tooLong: string[] = [];
  for (const el of blocks) {
    // direct text only, so a wrapper is never blamed for its children
    const own = [...el.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join(" ");

    for (const sentence of own.split(/(?<=[.!?])\s+/)) {
      const words = sentence.trim().split(/\s+/).filter(Boolean);
      if (words.length > MAX_SENTENCE_WORDS) tooLong.push(sentence.trim());
    }
  }
  return tooLong;
}

describe("the English on screen", () => {
  const screens: [string, () => void][] = [
    ["the door", () => render(<StartForm questionCount={104} />)],
    ["the app bar", () => render(<SiteHeader active="start" />)],
    ["the footer", () => render(<SiteFooter />)],
    [
      "my scores",
      () =>
        render(
          <MyScores unitTitles={{}} gameId="game-01" fullQuestionCount={62} />
        ),
    ],
    [
      "the ranking",
      () =>
        render(
          <RankBoard
            gameId="game-01"
            gameTitle="Little Fox Game"
            fullQuestionCount={96}
          />
        ),
    ],
  ];

  for (const [name, mount] of screens) {
    it(`uses only basic words on ${name}`, () => {
      mount();
      expect(hardWordsOnScreen()).toEqual([]);
    });

    it(`writes short sentences on ${name}`, () => {
      mount();
      expect(longSentences()).toEqual([]);
    });
  }

  // Whatever went wrong, the child gets a sentence they can act on. The reason
  // itself is real and worth keeping — it is what found a mis-pasted key once —
  // but it is folded away under a summary aimed at the teacher.
  it("keeps Postgres and .env out of a child's way", () => {
    const failure = describeFailure({
      message: 'relation "public.players" does not exist',
      code: "42P01",
    });
    render(<Failure failure={failure} />);

    expect(screen.getByText(/Something went wrong/)).toBeTruthy();
    expect(screen.getByText("For the teacher")).toBeTruthy();
    // the detail sits inside the <details>, closed until someone opens it
    expect(screen.getByText(/42P01/).closest("details")).not.toBeNull();
  });
});
