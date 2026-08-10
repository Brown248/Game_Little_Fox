// Shared scoring/timer state used across every game type in a unit.
// Each game component reports correct/incorrect answers here;
// the play page reads this to build the final AttemptRecord.

export interface ScoringState {
  score: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
  breakdown: Record<string, { correct: number; total: number }>;
  /** When the CURRENT sitting began. */
  startedAt: number;
  /** Seconds already played in earlier sittings, before this one resumed.
   *
   *  The game is one long run now, and a child can close the tab and come back
   *  tomorrow. Without this the clock would read the wall time since they first
   *  started — eight hours for a run they slept through the middle of. */
  accumulatedSeconds: number;
}

export function createScoringState(): ScoringState {
  return {
    score: 0,
    maxScore: 0,
    correctCount: 0,
    totalQuestions: 0,
    breakdown: {},
    startedAt: Date.now(),
    accumulatedSeconds: 0,
  };
}

/** Picks a saved run back up: the clock restarts from now, on top of whatever
 *  had already been played. */
export function resumeScoringState(
  saved: ScoringState,
  playedSeconds: number
): ScoringState {
  return { ...saved, startedAt: Date.now(), accumulatedSeconds: playedSeconds };
}

export function recordAnswer(
  state: ScoringState,
  gameType: string,
  isCorrect: boolean,
  points = 10
): ScoringState {
  // Copy the bucket — mutating the one held by the previous state would double
  // count under React StrictMode, which invokes state updaters twice in dev.
  const prev = state.breakdown[gameType] ?? { correct: 0, total: 0 };
  const bucket = {
    correct: prev.correct + (isCorrect ? 1 : 0),
    total: prev.total + 1,
  };

  return {
    ...state,
    score: state.score + (isCorrect ? points : 0),
    maxScore: state.maxScore + points,
    correctCount: state.correctCount + (isCorrect ? 1 : 0),
    totalQuestions: state.totalQuestions + 1,
    breakdown: { ...state.breakdown, [gameType]: bucket },
  };
}

/** Time actually spent playing, across every sitting. */
export function elapsedSeconds(state: ScoringState): number {
  const thisSitting = Math.floor((Date.now() - state.startedAt) / 1000);
  return state.accumulatedSeconds + Math.max(0, thisSitting);
}
