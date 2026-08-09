"use client";

import { useState } from "react";
import type { SentenceBuilderItem } from "@/lib/types";
import Feedback from "./Feedback";
import Progress from "./Progress";

interface Props {
  items: SentenceBuilderItem[];
  onAnswer: (isCorrect: boolean) => void;
  onDone: () => void;
}

// Tap words in order to build the sentence, checks against item.answer array.
export default function SentenceBuilder({ items, onAnswer, onDone }: Props) {
  const [index, setIndex] = useState(0);
  // Words are tracked by their position in item.words, not by text, so a
  // sentence that repeats a word ("the ... the") still behaves correctly.
  const [built, setBuilt] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);

  const item = items[index];
  const isLast = index === items.length - 1;
  const answered = result !== null;
  // A cue with no letters or digits in it is a picture, and gets drawn big.
  // Unit 2's cues used to read "🐍 Hiss! Hiss!" — the teacher had the words
  // taken out, because the sound spelled beside the animal handed over the
  // verb, which is half of the sentence being built.
  const pictureOnly = !/\p{L}|\p{N}/u.test(item.prompt);
  const remaining = item.words.map((_, i) => i).filter((i) => !built.includes(i));

  function check() {
    if (answered || built.length !== item.answer.length) return;
    const isCorrect = built.every(
      (wordIndex, position) =>
        item.words[wordIndex].toLowerCase() === item.answer[position].toLowerCase()
    );
    setResult(isCorrect);
    onAnswer(isCorrect);
  }

  function next() {
    if (isLast) {
      onDone();
      return;
    }
    setIndex(index + 1);
    setBuilt([]);
    setResult(null);
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <Progress
        title="Build the sentence"
        index={index}
        total={items.length}
        answered={answered}
      />

      {/* the sentence to build on one side, the word trays on the other */}
      <div className="q split" key={index}>
        <div className="card card--soft stack" style={{ gap: 10 }}>
          <span className="kicker--faint kicker">tap in order</span>
          <span className={pictureOnly ? "q__emoji" : "q__text q__text--sm"}>
            {item.prompt}
          </span>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div
            className={`tray tray--answer${answered && !result ? " shake" : ""}`}
            style={
              answered && !result
                ? { animation: "weShake .45s ease", borderColor: "var(--kraft)", background: "var(--surface-warm)" }
                : undefined
            }
          >
            {built.length === 0 && (
              <span className="tray__hint">Your sentence appears here</span>
            )}
            {built.map((wordIndex) => (
              <button
                key={wordIndex}
                type="button"
                className="wordchip"
                disabled={answered}
                onClick={() => setBuilt(built.filter((w) => w !== wordIndex))}
              >
                {item.words[wordIndex]}
              </button>
            ))}
          </div>

          <div className="tray">
            {remaining.length === 0 && (
              <span className="tray__hint">All words used</span>
            )}
            {remaining.map((wordIndex) => (
              <button
                key={wordIndex}
                type="button"
                className="wordchip"
                disabled={answered}
                onClick={() => setBuilt([...built, wordIndex])}
              >
                {item.words[wordIndex]}
              </button>
            ))}
          </div>

          {!answered && (
            <div className="row" style={{ gap: 10 }}>
              <button
                className="btn"
                type="button"
                onClick={check}
                disabled={built.length !== item.answer.length}
                style={{ flex: 1 }}
              >
                Check
              </button>
              <button
                className="btn btn--secondary"
                type="button"
                onClick={() => setBuilt([])}
                disabled={built.length === 0}
              >
                Clear
              </button>
            </div>
          )}

          {answered && (
            <>
              <Feedback correct={result} answer={item.answer.join(" ")} />
              <button className="btn btn--block" type="button" onClick={next}>
                {isLast ? "Finish this part" : "Next sentence"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
