"use client";

// One shot per question, so this is where the explorer learns the answer.
// Green for right, red for wrong — the teacher's own marking, asked for after
// the first lesson. The design doc kept wrong answers in neutral kraft on a
// "no colour punishment" principle; in the room that read as nothing having
// happened at all, so the classroom convention wins. The wrong answer is never
// scolded, only shown: the real answer comes with it every time.

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
