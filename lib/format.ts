// Display formatting shared by the game, the leaderboards and the admin pages.
// Kept in one place so a score never renders two different ways.
// Must stay client-safe: admin client components import from here.

import type { GameType } from "./types";

/** Human labels for the game types. Add a row when adding a game type. */
export const GAME_LABELS: Record<GameType | string, string> = {
  "quiz-choice": "Guess the animal",
  unscramble: "Unscramble",
  "sentence-builder": "Sentence builder",
  listening: "Listening",
  writing: "Writing",
};

export function gameLabel(gameType: string): string {
  return GAME_LABELS[gameType] ?? gameType;
}

/* --------------------------- parts and scoreboards ------------------------ */

// A unit can be played whole, or one part at a time. Each is timed, scored and
// ranked on its own, so each needs its own scoreboard id — that id is just the
// `unit_id` column, so no schema change was needed to add the second mode.

const PART_ID = /^(unit-\d{2})-part-(\d+)$/;

/** The id a part's attempts are saved under.
 *
 *  Deliberately NOT shaped like `unit-NN`: the overall "Top explorers" ranking
 *  counts whole units only and tells the two apart by that shape, so a student
 *  who plays both a part and its unit is never counted twice. Changing this
 *  format means changing v_overall_ranking in supabase/schema.sql to match. */
export function partScoreId(unitId: string, partIndex: number): string {
  return `${unitId}-part-${partIndex + 1}`;
}

/** Splits a scoreboard id back into its unit and 0-based part index. Returns
 *  null for a whole-unit id, which is how callers tell the two modes apart. */
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
 *   · a WHOLE unit, never a single part — one unit is one certificate, or a
 *     class ends up printing five each;
 *   · at least half the QUESTIONS right, counted in answers rather than points
 *     so the rule holds even if a question is ever worth other than ten.
 *
 *  Lives here, not on a screen, because two screens ask it now: the result at
 *  the end of a run, and /me when re-issuing an old certificate. They must not
 *  be able to disagree. */
export function earnsCertificate(
  scoreId: string,
  correctCount: number,
  totalQuestions: number
): boolean {
  if (parsePartId(scoreId) !== null) return false;
  if (totalQuestions <= 0) return false;
  return correctCount / totalQuestions >= CERTIFICATE_PASS_MARK;
}

/** How many right answers a run of this length needs. */
export function certificateNeeds(totalQuestions: number): number {
  return Math.ceil(totalQuestions * CERTIFICATE_PASS_MARK);
}

/** Where `npm run images` writes the Shadow Animal artwork. */
export const ANIMAL_ART_DIR = "/images/animals";

/** The two halves of one animal's reveal, from a single slug in the unit JSON.
 *  Both the game and the admin content check resolve paths through here, so
 *  the naming convention lives in exactly one place. */
export function animalArt(slug: string): { shadow: string; reveal: string } {
  return {
    shadow: `${ANIMAL_ART_DIR}/${slug}-shadow.webp`,
    reveal: `${ANIMAL_ART_DIR}/${slug}.webp`,
  };
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
