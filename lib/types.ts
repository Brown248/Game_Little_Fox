export type GameType =
  | "quiz-choice"
  | "unscramble"
  | "sentence-builder"
  | "listening"
  | "writing";

export interface QuizChoiceItem {
  clue: string;
  options: string[];
  answerIndex: number;
}

export interface UnscrambleItem {
  scrambled: string;
  answer: string;
  /** Optional emoji shown as a black silhouette above the letters — the
   *  "shadow" of the Shadow Animal Challenge. Revealed in colour once answered. */
  shadow?: string;
  /** Artwork slug, used instead of the emoji when the animal has been drawn.
   *  One word covers both halves of the reveal: `<slug>-shadow.webp` is shown
   *  before answering and `<slug>.webp` after, both from public/images/animals
   *  (built by `npm run images`). See animalArt() in lib/format.ts. */
  art?: string;
}

export interface SentenceBuilderItem {
  prompt: string; // e.g. sound or emoji cue
  words: string[];
  answer: string[];
}

export interface ListeningItem {
  audioUrl?: string; // path under public/audio/, e.g. "unit-04/clue-1.mp3"
  /** Video clue, path under public/videos/ (e.g. "unit-05/clue-1.mp4") or a
   *  full https:// URL. When present it replaces the audio player: the class
   *  watches instead of listening, and the block titles itself accordingly. */
  videoUrl?: string;
  clueText: string; // shown when "show clue text" is toggled
  options: string[];
  answerIndex: number;
}

export interface WritingPrompt {
  questions: string[];
}

// One block per game type. These form a discriminated union on `type` so the
// play engine can switch on it and get the right item shape without casting.
// Adding a new game type = add a block interface + add it to the GameBlock union.

/** Shared by every block. A block is also a separately playable "part", so it
 *  carries the worksheet's own name for it — "Part C · Build the Sentence" —
 *  which is what the teacher and the student pick from. Without it two blocks
 *  of the same game type are indistinguishable in the list. */
interface BlockBase {
  title?: string;
}

export interface QuizChoiceBlock extends BlockBase {
  type: "quiz-choice";
  items: QuizChoiceItem[];
}

export interface UnscrambleBlock extends BlockBase {
  type: "unscramble";
  items: UnscrambleItem[];
}

export interface SentenceBuilderBlock extends BlockBase {
  type: "sentence-builder";
  items: SentenceBuilderItem[];
}

export interface ListeningBlock extends BlockBase {
  type: "listening";
  items: ListeningItem[];
}

export interface WritingBlock extends BlockBase {
  type: "writing";
  prompt: WritingPrompt;
}

export type GameBlock =
  | QuizChoiceBlock
  | UnscrambleBlock
  | SentenceBuilderBlock
  | ListeningBlock
  | WritingBlock;

export interface UnitConfig {
  id: string; // "unit-01"
  title: string;
  games: GameBlock[];
}

/** An explorer. Identity is the name alone — there is no login and no class. */
export interface Player {
  id: string;
  name: string;
}

export interface AttemptRecord {
  player_id: string;
  unit_id: string;
  score: number;
  max_score: number;
  correct_count: number;
  total_questions: number;
  time_seconds: number;
  game_type_breakdown?: Record<string, { correct: number; total: number }>;
}

/** A stored attempt row, as the admin pages read it (service-role client). */
export interface AttemptRow extends AttemptRecord {
  id: string;
  completed_at: string;
}

/** Attempt row with the player joined in — used by the admin tables. */
export interface AttemptWithPlayer extends AttemptRow {
  players: { name: string } | null;
}

export interface PlayerRow extends Player {
  created_at: string;
}

// Rows returned by the ranking views in supabase/schema.sql.
export interface UnitRankingRow {
  player_id: string;
  name: string;
  unit_id: string;
  score: number;
  max_score: number;
  time_seconds: number;
  completed_at: string;
}

export interface OverallRankingRow {
  player_id: string;
  name: string;
  overall_accuracy: number | null;
  units_completed: number;
}

/* Admin summaries. The shapes live here rather than in lib/admin-data.ts so
   client components can import them without pulling in a server-only module. */

export interface SkillTally {
  gameType: string;
  correct: number;
  total: number;
}

export interface PlayerSummary {
  player: PlayerRow;
  attemptCount: number;
  unitsPlayed: number;
  /** SUM(score)/SUM(max_score) over best attempt per unit — same rule as the
   *  overall leaderboard, so admin numbers match what students see. */
  accuracy: number | null;
  bestScoreTotal: number;
  maxScoreTotal: number;
  totalTimeSeconds: number;
  lastPlayedAt: string | null;
  skills: SkillTally[];
  weakestSkill: SkillTally | null;
}

export interface UnitStats {
  unitId: string;
  attemptCount: number;
  playerCount: number;
  averageAccuracy: number | null;
  bestTimeSeconds: number | null;
  skills: SkillTally[];
  weakestSkill: SkillTally | null;
}
