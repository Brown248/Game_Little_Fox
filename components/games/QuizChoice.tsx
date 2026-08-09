"use client";

import { useState } from "react";
import type { QuizChoiceItem } from "@/lib/types";
import ChoiceList from "./ChoiceList";
import Progress from "./Progress";

interface Props {
  items: QuizChoiceItem[];
  onAnswer: (isCorrect: boolean) => void;
  onDone: () => void;
}

// A/B/C/D multiple choice, highlights correct/wrong on click.
export default function QuizChoice({ items, onAnswer, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const item = items[index];
  const isLast = index === items.length - 1;
  const answered = picked !== null;
  const wasRight = picked === item.answerIndex;

  function pick(choice: number) {
    if (answered) return; // one shot per question
    setPicked(choice);
    onAnswer(choice === item.answerIndex);
  }

  function next() {
    if (isLast) {
      onDone();
      return;
    }
    setIndex(index + 1);
    setPicked(null);
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <Progress
        title="Guess the animal"
        index={index}
        total={items.length}
        answered={answered}
      />

      {/* clue on one side, answers on the other — one column on a phone */}
      <div className="q split" key={index}>
        <div className="card card--soft stack">
          <span className="kicker kicker--faint">the clue</span>
          <p className="q__text" style={{ margin: 0 }}>
            {item.clue}
          </p>
        </div>

        <div className="stack">
          <ChoiceList
            options={item.options}
            answerIndex={item.answerIndex}
            picked={picked}
            onPick={pick}
          />

          {answered && (
            <>
              <div
                className={`feedback ${wasRight ? "feedback--correct" : "feedback--wrong"}`}
                role="status"
              >
                {wasRight ? "Correct! 🎉" : "Not quite."}
                {!wasRight && (
                  <span className="feedback__answer">
                    The answer is <strong>{item.options[item.answerIndex]}</strong>
                  </span>
                )}
              </div>
              <button className="btn btn--block" type="button" onClick={next}>
                {isLast ? "Finish this part" : "Next question"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
