// A half-finished run, kept on the device so it survives a closed tab.
//
// The game is one sitting of every question there is, and the teacher wants it
// played at home as well as in class — "อยากให้เด็กกลับไปเล่นที่บ้านด้วย". A
// score is only written to Supabase when the whole run ends, so without this a
// child who closed the tab three quarters of the way through would lose
// everything and would have to start from question one. Nobody does that twice.
//
// Saved at the end of each block rather than each question: which question a
// child is on lives inside each game component's own state, and prising that
// out of all five of them buys one block's worth of questions at the cost of
// touching every game. A block is a small enough thing to lose.

import type { ScoringState } from "./scoring";

const KEY = "we.progress";

export interface SavedRun {
  /** Whose run this is — a different name on the same device starts fresh. */
  playerId: string;
  /** The block to resume at: everything before it is finished. */
  blockIndex: number;
  scoring: ScoringState;
  /** Seconds already played, so the clock does not count time away. */
  playedSeconds: number;
  /** How many blocks the game had when this was saved. A saved run from before
   *  a content change would resume into the wrong place, so it is discarded. */
  blockCount: number;
  /** How many scored questions the game had when this was saved.
   *
   *  The block count alone is not enough. Part C2 went from 25 sentences to 10
   *  and the game still had its six blocks, so a run saved that morning would
   *  have resumed happily — carrying 25 answers to questions that no longer
   *  exist. It would then finish with more answers than the game has, which
   *  fails the certificate rule in silence and puts a row on the board that
   *  cannot be compared with anyone else's. */
  questionCount: number;
}

export function saveProgress(run: SavedRun): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(run));
  } catch {
    // Private-mode Safari throws on setItem. Not fatal — the run still plays
    // through to the end, it just cannot be picked up again after a close.
  }
}

/** The saved run, if there is one worth offering.
 *
 *  Returns null when it belongs to someone else, when the game has changed
 *  under it, or when it is finished or malformed — a bad resume is worse than
 *  no resume. */
export function loadProgress(
  playerId: string,
  blockCount: number,
  questionCount: number
): SavedRun | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;

    const saved = JSON.parse(raw) as Partial<SavedRun>;
    if (saved?.playerId !== playerId) return null;
    if (saved.blockCount !== blockCount) return null;
    if (saved.questionCount !== questionCount) return null;
    if (typeof saved.blockIndex !== "number") return null;
    if (saved.blockIndex <= 0 || saved.blockIndex >= blockCount) return null;
    if (!saved.scoring || typeof saved.scoring.score !== "number") return null;

    return {
      playerId,
      blockIndex: saved.blockIndex,
      scoring: saved.scoring as ScoringState,
      playedSeconds: Math.max(0, saved.playedSeconds ?? 0),
      blockCount,
      questionCount,
    };
  } catch {
    return null;
  }
}

export function clearProgress(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
