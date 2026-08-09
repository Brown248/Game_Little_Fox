"use client";

// Catches render/data errors anywhere in the app so a student never sees a
// blank screen mid-game. The scoring state is lost on reset — say so plainly
// rather than pretending the attempt survived.

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page page--narrow">
      <div className="card card--lg stack">
        <h1>Something broke</h1>
        <p className="muted">
          If you were in the middle of a unit, that attempt was not saved — you
          can start it again.
        </p>
        <div className="notice notice--error">
          {error.message || "Unknown error"}
          {error.digest && <span className="muted"> ({error.digest})</span>}
        </div>
        <button className="btn btn--block" type="button" onClick={reset}>
          Try again
        </button>
        <Link href="/" style={{ textAlign: "center" }}>
          Back to the start
        </Link>
      </div>
    </main>
  );
}
