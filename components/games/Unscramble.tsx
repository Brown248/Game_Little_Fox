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

// The animal, then its name spelled out of the jumbled letters.
//
// The emoji used to be blacked out into a silhouette until the child answered —
// "whose shadow is this?" — and the teacher had that taken out. The question in
// this part is how the word is spelled, and a child who cannot make out the
// silhouette is stuck on something this part was never asking.
//
// Drawn animal pictures went the same way earlier — "เอาพวกภาพที่ฉัน add เข้าไป
// อะพวกภาพสัตว์เอาออกให้หมด เอาแค่อิโมจิมาใน Part เเรก" — artwork, build script
// and files. One emoji, in colour, and nothing else.
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

      {/* the animal and the jumbled letters on one side, the answer box on the
          other — a single column once the glass gets narrow */}
      <div className="q split" key={index}>
        <div className="card card--soft">
          {item.emoji && (
            <div className="animal-stage">
              {/* Named for a screen reader, because the emoji is named for
                  everyone else. Lower case: a reader spells out ALL CAPS. */}
              <span
                className="animal-emoji"
                role="img"
                aria-label={item.answer.toLowerCase()}
              >
                {item.emoji}
              </span>
            </div>
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
