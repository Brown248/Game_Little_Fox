// Shared scoring/timer state used across every game type in a unit.
// Each game component reports correct/incorrect answers here;
// the play page reads this to build the final AttemptRecord.

export interface ScoringState {
  score: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
  breakdown: Record<string, { correct: number; total: number }>;
  startedAt: number;
}

export function createScoringState(): ScoringState {
  return {
    score: 0,
    maxScore: 0,
    correctCount: 0,
    totalQuestions: 0,
    breakdown: {},
    startedAt: Date.now(),
  };
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

export function elapsedSeconds(state: ScoringState): number {
  return Math.floor((Date.now() - state.startedAt) / 1000);
}
