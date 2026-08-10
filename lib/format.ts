// Display formatting shared by the game, the leaderboards and the admin pages.
// Kept in one place so a score never renders two different ways.
// Must stay client-safe: admin client components import from here.

import type { GameType } from "./types";

/** Human labels for the game types. Add a row when adding a game type. */
export const GAME_LABELS: Record<GameType | string, string> = {
  "quiz-choice": "Guess the animal",
  unscramble: "Make the word",
  "sentence-builder": "Sentence builder",
  listening: "Listening",
  writing: "Writing",
};

export function gameLabel(gameType: string): string {
  return GAME_LABELS[gameType] ?? gameType;
}

/* --------------------------- parts and scoreboards ------------------------ */

// Nothing is played a part at a time any more — there is one game. What is
// left here reads the ids of runs that were saved BEFORE that change, which
// still sit in the database and still show up on /me and in /admin.

const PART_ID = /^(unit-\d{2})-part-(\d+)$/;

/** Splits an old part id back into its unit and 0-based part index, or null.
 *  Only ever matches historic rows now; the game id never looks like this. */
export function parsePartId(
  scoreId: string
): { unitId: string; partIndex: number } | null {
  const match = PART_ID.exec(scoreId);
  if (!match) return null;
  return { unitId: match[1], partIndex: Number(match[2]) - 1 };
}

/** "unit 02 · part 3" or "unit 02" — for headings and the mono kicker. */
export function scoreIdLabel(scoreId: string): string {
  const part = parsePartId(scoreId);
  return part
    ? `${part.unitId.replace("-", " ")} · part ${part.partIndex + 1}`
    : scoreId.replace("-", " ");
}

/* ------------------------------ certificates ------------------------------ */

/** Half the questions right. */
export const CERTIFICATE_PASS_MARK = 0.5;

/** Does this run earn a certificate?
 *
 *  Two conditions, both the teacher's:
 *   · the WHOLE game was played, not a part of it;
 *   · at least half the QUESTIONS right, counted in answers rather than points
 *     so the rule holds even if a question is ever worth other than ten.
 *
 *  `fullQuestionCount` is what makes the first condition real. A run can now be
 *  stopped early and still banked — a child taught only the first part needs
 *  that — and without this check one who answered 20 of 27 and stopped would
 *  score 74% and take a certificate for a quarter of the game.
 *
 *  Pass 0 for `fullQuestionCount` when the full length is unknown (an old row
 *  saved under a retired id): the length check is then skipped rather than
 *  failing every historic run.
 *
 *  Lives here, not on a screen, because two screens ask it: the ranking at the
 *  end of a run, and /me when re-issuing an old certificate. They must not be
 *  able to disagree. */
export function earnsCertificate(
  scoreId: string,
  correctCount: number,
  totalQuestions: number,
  fullQuestionCount = 0
): boolean {
  if (parsePartId(scoreId) !== null) return false;
  if (totalQuestions <= 0) return false;
  if (fullQuestionCount > 0 && totalQuestions !== fullQuestionCount) return false;
  return correctCount / totalQuestions >= CERTIFICATE_PASS_MARK;
}

/** Was the whole game played? Kept beside the rule it belongs to so a screen
 *  can tell "stopped early" apart from "did not get enough right". */
export function playedItAll(
  totalQuestions: number,
  fullQuestionCount: number
): boolean {
  return fullQuestionCount > 0 && totalQuestions === fullQuestionCount;
}

/** How many right answers a run of this length needs. */
export function certificateNeeds(totalQuestions: number): number {
  return Math.ceil(totalQuestions * CERTIFICATE_PASS_MARK);
}

export function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "—";
  return `${Math.round(ratio * 100)}%`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
