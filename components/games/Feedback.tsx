"use client";

// One shot per question, so this is where the explorer learns the answer.
// Correct glows orange; wrong is kraft and neutral — the direction is
// deliberately "no colour punishment", so nothing here goes red.

interface Props {
  correct: boolean;
  /** Shown only when they got it wrong. */
  answer: string;
}

export default function Feedback({ correct, answer }: Props) {
  return (
    <div
      className={`feedback ${correct ? "feedback--correct" : "feedback--wrong"}`}
      role="status"
    >
      {correct ? "Correct! 🎉" : "Not quite."}
      {!correct && (
        <span className="feedback__answer">
          The answer is <strong>{answer}</strong>
        </span>
      )}
    </div>
  );
}
