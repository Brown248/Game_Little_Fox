"use client";

// One way of showing a scoreboard failure everywhere: a short sentence a child
// can act on, and the underlying reason folded away for whoever set the project
// up. Supabase rejects with an object that `console.error` prints as `{}`, so
// without this the real cause never reaches anybody — but a nine-year-old was
// being shown Postgres error codes and the name of a .env file.

import type { ScoreboardFailure } from "@/lib/supabase";

interface Props {
  failure: ScoreboardFailure;
  children?: React.ReactNode;
}

export default function Failure({ failure, children }: Props) {
  return (
    <div className="notice notice--error stack" role="alert">
      <span>{failure.message}</span>
      {failure.detail && (
        <details>
          <summary>For the teacher</summary>
          <span className="kicker kicker--faint" style={{ wordBreak: "break-word" }}>
            {failure.detail}
          </span>
        </details>
      )}
      {children}
    </div>
  );
}
