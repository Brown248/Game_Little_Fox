"use client";

import { useState } from "react";
import type { WritingPrompt } from "@/lib/types";

interface Props {
  prompt: WritingPrompt;
  onDone: (text: string) => void;
}

// Free-text textarea, not scored — always the last block in a unit.
export default function Writing({ prompt, onDone }: Props) {
  const [answers, setAnswers] = useState<string[]>(() =>
    prompt.questions.map(() => "")
  );

  function update(i: number, value: string) {
    setAnswers(answers.map((a, j) => (j === i ? value : a)));
  }

  const written = answers.filter((a) => a.trim().length > 0).length;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="progress-head">
        <h2>Write about your animal</h2>
        <span className="progress-head__count">
          {written} / {prompt.questions.length}
        </span>
      </div>

      <div className="card card--dashed">
        <p className="muted">
          <strong>Not scored.</strong> Copy it down to keep it.
        </p>
      </div>

      {/* two prompts abreast on a laptop, one on a phone */}
      <div className="split">
        {prompt.questions.map((question, i) => (
          <div className="card field" key={i}>
            <label className="field__label" htmlFor={`writing-${i}`}>
              <span className="kicker" style={{ marginRight: 8 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              {question}
            </label>
            <textarea
              id={`writing-${i}`}
              className="textarea"
              value={answers[i]}
              onChange={(e) => update(i, e.target.value)}
              placeholder="Write your answer in English…"
            />
          </div>
        ))}
      </div>

      <button
        className="btn btn--block"
        type="button"
        onClick={() =>
          onDone(
            prompt.questions.map((q, i) => `${q}\n${answers[i]}`).join("\n\n")
          )
        }
      >
        Finish and see my score
      </button>
    </div>
  );
}
