"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deletePlayerAction, renamePlayerAction } from "@/app/admin/actions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatDateTime, formatPercent, gameLabel } from "@/lib/format";
import type { PlayerSummary } from "@/lib/types";

interface Props {
  summaries: PlayerSummary[];
  /** Ids of the students who have earned a certificate.
   *
   *  Worked out on the server by certificateRoster(), never re-derived here:
   *  the teacher scanning this list and the child looking at /rank have to be
   *  told the same thing about the same run. */
  certifiedIds: string[];
}

export default function PlayersTable({ summaries, certifiedIds }: Props) {
  const certified = new Set(certifiedIds);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (summaries.length === 0) {
    return (
      <div className="card card--dashed">
        <p className="muted">
          No explorers yet — nobody has played.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      {error && <div className="notice notice--error">{error}</div>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Explorer</th>
              <th>Certificate</th>
              <th>Accuracy</th>
              <th>Attempts</th>
              <th>Weakest skill</th>
              <th>Last played</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) =>
              editing === summary.player.id ? (
                <EditRow
                  key={summary.player.id}
                  summary={summary}
                  onClose={() => setEditing(null)}
                  onError={setError}
                />
              ) : (
                <tr key={summary.player.id}>
                  <td style={{ fontWeight: 700 }}>
                    <Link href={`/admin/players/${summary.player.id}`}>
                      {summary.player.name}
                    </Link>
                  </td>
                  <td>
                    {certified.has(summary.player.id) ? (
                      <span className="pill pill--good">earned</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{formatPercent(summary.accuracy)}</td>
                  <td>{summary.attemptCount}</td>
                  <td>
                    {summary.weakestSkill ? (
                      <>
                        {gameLabel(summary.weakestSkill.gameType)}{" "}
                        <span className="muted">
                          (
                          {formatPercent(
                            summary.weakestSkill.correct / summary.weakestSkill.total
                          )}
                          )
                        </span>
                      </>
                    ) : (
                      <span className="muted">not enough data</span>
                    )}
                  </td>
                  <td>{formatDateTime(summary.lastPlayedAt)}</td>
                  <td>
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={() => {
                        setError(null);
                        setEditing(summary.player.id);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditRow({
  summary,
  onClose,
  onError,
}: {
  summary: PlayerSummary;
  onClose: () => void;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(summary.player.name);
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    onError(null);
    startTransition(async () => {
      const result = await renamePlayerAction(summary.player.id, name);
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        onError(result.error ?? "Could not save.");
      }
    });
  }

  function remove() {
    onError(null);
    startTransition(async () => {
      const result = await deletePlayerAction(summary.player.id);
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        onError(result.error ?? "Could not delete.");
      }
    });
  }

  return (
    <tr>
      <td>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Name"
        />
      </td>
      <td colSpan={5} className="muted" style={{ whiteSpace: "normal" }}>
        Renaming keeps every attempt — the leaderboard follows the record, not
        the spelling.
      </td>
      <td>
        <div className="row row--tight">
          <button
            className="btn btn--sm"
            type="button"
            onClick={save}
            disabled={pending}
          >
            Save
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => setAsking(true)}
            disabled={pending}
          >
            Delete
          </button>
        </div>

        <ConfirmDialog
          open={asking}
          title={`Delete ${summary.player.name}?`}
          body={`All ${summary.attemptCount} of their attempts go too, and this cannot be undone. To fix a duplicate name, merge instead.`}
          confirmLabel="Delete them"
          cancelLabel="Keep them"
          onConfirm={() => {
            setAsking(false);
            remove();
          }}
          onCancel={() => setAsking(false)}
        />
      </td>
    </tr>
  );
}
