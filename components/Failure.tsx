"use client";

// One way of showing a scoreboard failure everywhere: a plain sentence for the
// explorer, and the underlying reason in small type for whoever set the project
// up. Supabase rejects with an object that `console.error` prints as `{}`, so
// without this the real cause never reaches anybody.

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
        <span className="kicker kicker--faint" style={{ wordBreak: "break-word" }}>
          {failure.detail}
        </span>
      )}
      {children}
    </div>
  );
}
