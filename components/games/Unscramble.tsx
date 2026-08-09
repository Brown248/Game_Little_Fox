"use client";

import { useState } from "react";
import Image from "next/image";
import { animalArt } from "@/lib/format";
import type { UnscrambleItem } from "@/lib/types";
import Feedback from "./Feedback";
import Progress from "./Progress";

interface Props {
  items: UnscrambleItem[];
  onAnswer: (isCorrect: boolean) => void;
  onDone: () => void;
}

// Text input, checks against item.answer (case-insensitive).
// When the item carries a `shadow` emoji it is shown as a black silhouette
// first — the Shadow Animal Challenge — and lights up in colour on answering.
export default function Unscramble({ items, onAnswer, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState<boolean | null>(null);

  const item = items[index];
  const isLast = index === items.length - 1;
  const answered = result !== null;
  const art = item.art ? animalArt(item.art) : null;

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
        title="Unscramble the word"
        index={index}
        total={items.length}
        answered={answered}
      />

      {/* the shadow and the jumbled letters on one side, the answer box on the
          other — a single column once the glass gets narrow */}
      <div className="q split" key={index}>
        <div className="card card--soft">
          {/* Drawn artwork when the animal has it, the emoji silhouette
              otherwise. Both play the same beat: a black shape first, the
              animal in colour the moment the word is right. */}
          {art ? (
            <div className={`art${answered ? " art--lit" : ""}`}>
              <Image
                className="art__shadow"
                src={art.shadow}
                alt=""
                fill
                sizes="(max-width: 820px) 100vw, 560px"
                priority
              />
              {/* Also priority. It sits under an opacity:0 layer, so without
                  this Next marks it lazy and a phone never fetches it at all —
                  the reveal then had nothing to show and stayed black. */}
              <Image
                className="art__reveal"
                src={art.reveal}
                alt={answered ? item.answer : ""}
                fill
                sizes="(max-width: 820px) 100vw, 560px"
                priority
              />
            </div>
          ) : (
            item.shadow && (
              <div className="shadow-stage">
                <span
                  className={`shadow-animal${answered ? " shadow-animal--lit" : ""}`}
                  role="img"
                  aria-label={answered ? item.answer : "shadow of an animal"}
                >
                  {item.shadow}
                </span>
              </div>
            )
          )}

          {!answered && (item.shadow || art) && (
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
