"use client";

import { useState } from "react";
import type { UnscrambleItem } from "@/lib/types";
import Feedback from "./Feedback";
import Progress from "./Progress";

interface Props {
  items: UnscrambleItem[];
  onAnswer: (isCorrect: boolean) => void;
  onDone: () => void;
}

// Whose shadow is this? The emoji shows as a black silhouette, the child spells
// the animal's name out of the jumbled letters, and the shadow lights up in
// colour once they answer.
//
// There was a second kind of question here for a while: eight animals that had
// been drawn properly, shown as a picture instead of an emoji. The teacher had
// them taken out — "เอาพวกภาพที่ฉัน add เข้าไปอะพวกภาพสัตว์เอาออกให้หมด เอาแค่
// อิโมจิมาใน Part เเรก" — so the artwork, the build script and the files all
// went with them. One kind of question, one silhouette.
export default function Unscramble({ items, onAnswer, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState<boolean | null>(null);

  const item = items[index];
  const isLast = index === items.length - 1;
  const answered = result !== null;

  function submit() {
    if (answered || !guess.trim()) return;
    const isCorrect =
      guess.trim().toUpperCase() === item.answer.trim().toUpperCase();
    setResult(isCorrect);
    onAnswer(isCorrect);
  }

  function next() {
    if (isLast) {
      onDone();
      return;
    }
    setIndex(index + 1);
    setGuess("");
    setResult(null);
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <Progress
        title="Make the word"
        index={index}
        total={items.length}
        answered={answered}
      />

      {/* the shadow and the jumbled letters on one side, the answer box on the
          other — a single column once the glass gets narrow */}
      <div className="q split" key={index}>
        <div className="card card--soft">
          {item.shadow && (
            <div className="shadow-stage">
              <span
                className={`shadow-animal${answered ? " shadow-animal--lit" : ""}`}
                role="img"
                aria-label={answered ? item.answer : "shadow of an animal"}
              >
                {item.shadow}
              </span>
            </div>
          )}

          {!answered && item.shadow && (
            <p className="shadow-stage__hint kicker kicker--faint center">
              whose shadow is this?
            </p>
          )}

          <p className="scrambled">{item.scrambled}</p>
        </div>

        <div className="stack">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              className="input input--answer"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              disabled={answered}
              placeholder="the animal"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="done"
              aria-label="Your answer"
              autoFocus
            />
            {!answered && (
              <button
                className="btn btn--block"
                type="submit"
                disabled={!guess.trim()}
                style={{ marginTop: 14 }}
              >
                Check
              </button>
            )}
          </form>

          {answered && (
            <>
              <Feedback correct={result} answer={item.answer.toUpperCase()} />
              <button className="btn btn--block" type="button" onClick={next}>
                {isLast ? "Finish this part" : "Next word"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
