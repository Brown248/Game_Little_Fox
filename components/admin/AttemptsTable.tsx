"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteAttemptAction } from "@/app/admin/actions";
import { formatDateTime, formatPercent, formatTime } from "@/lib/format";
import type { AttemptWithPlayer } from "@/lib/types";

interface Props {
  attempts: AttemptWithPlayer[];
  showPlayer?: boolean;
}

export default function AttemptsTable({ attempts, showPlayer = false }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(attempt: AttemptWithPlayer) {
    const who = attempt.players?.name ?? "this student";
    if (
      !window.confirm(
        `Delete this attempt by ${who} on ${attempt.unit_id}? Attempts are meant to be kept — only remove test rows.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteAttemptAction(attempt.id);
      if (result.ok) router.refresh();
      else setError(result.error ?? "Could not delete.");
    });
  }

  if (attempts.length === 0) {
    return <p className="muted">No attempts yet.</p>;
  }

  return (
    <>
      {error && <div className="notice notice--error">{error}</div>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              {showPlayer && <th>Student</th>}
              <th>Unit</th>
              <th>Score</th>
              <th>Accuracy</th>
              <th>Time</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {attempts.map((attempt) => (
              <tr key={attempt.id}>
                <td style={{ fontWeight: 400, color: "inherit" }}>
                  {formatDateTime(attempt.completed_at)}
                </td>
                {showPlayer && (
                  <td>
                    <Link href={`/admin/players/${attempt.player_id}`}>
                      {attempt.players?.name ?? "(deleted)"}
                    </Link>
                  </td>
                )}
                <td>{attempt.unit_id}</td>
                <td>
                  {attempt.score} / {attempt.max_score}
                </td>
                <td>
                  {formatPercent(
                    attempt.max_score > 0 ? attempt.score / attempt.max_score : null
                  )}
                </td>
                <td>{formatTime(attempt.time_seconds)}</td>
                <td>
                  <button
                    className="btn btn--ghost btn--sm"
                    type="button"
                    disabled={pending}
                    onClick={() => remove(attempt)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
