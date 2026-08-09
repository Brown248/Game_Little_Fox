"use client";

// Shared A/B/C/D answer list — used by QuizChoice and Listening.
// Not a game type of its own; it holds no scoring logic, it just renders
// options and reports which one was tapped.
//
// Motion, straight from the direction doc: correct fills glow, a seal pops in
// over one expanding ring and the points float up. Wrong shakes once and turns
// kraft — never red, never a deduction.

interface Props {
  options: string[];
  answerIndex: number;
  /** null while unanswered; the tapped index once answered. */
  picked: number | null;
  onPick: (index: number) => void;
  /** Points awarded for a correct answer, shown floating up. */
  points?: number;
}

const KEYS = ["A", "B", "C", "D", "E", "F"];

export default function ChoiceList({
  options,
  answerIndex,
  picked,
  onPick,
  points = 10,
}: Props) {
  const answered = picked !== null;

  return (
    <div className="choices">
      {options.map((option, i) => {
        const isAnswer = i === answerIndex;
        const isPicked = i === picked;
        let state = "";
        if (answered) {
          if (isAnswer) state = " choice--correct";
          else if (isPicked) state = " choice--wrong";
        }

        return (
          <button
            key={i}
            type="button"
            className={`choice${state}`}
            disabled={answered}
            onClick={() => onPick(i)}
          >
            <span className="choice__key">{KEYS[i] ?? i + 1}</span>
            <span className="choice__text">{option}</span>

            {answered && isAnswer && (
              <>
                <span className="seal" aria-hidden="true">
                  <span className="seal__needle" />
                </span>
                <span className="seal__burst" aria-hidden="true" />
                {isPicked && (
                  <span className="float-points" aria-hidden="true">
                    +{points}
                  </span>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
