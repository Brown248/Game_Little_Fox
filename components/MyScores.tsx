"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Failure from "@/components/Failure";
import { downloadCertificate } from "@/lib/certificate";
import {
  certificateNeeds,
  earnsCertificate,
  formatDateTime,
  formatPercent,
  formatTime,
  scoreIdLabel,
} from "@/lib/format";
import { loadPlayer } from "@/lib/session";
import {
  describeFailure,
  getPlayerAttempts,
  type ScoreboardFailure,
} from "@/lib/supabase";
import type { AttemptRow, Player } from "@/lib/types";

interface Props {
  /** unit id → title, resolved on the server: unit JSON is read with fs and
   *  cannot be touched from a client component. */
  unitTitles: Record<string, string>;
}

// Every run this explorer has finished, and the certificates they have already
// earned — issued again from here, without replaying anything.
//
// Straight from the teacher: "ย้อนดูไม่ได้ด้วย เหมือนต้องเล่นใหม่". A score used
// to live only on the result screen it was won on, so closing the tab lost the
// certificate for good. The rows come from Supabase, so a phone that has been
// closed all week still shows them.
export default function MyScores({ unitTitles }: Props) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [checked, setChecked] = useState(false);
  const [rows, setRows] = useState<AttemptRow[] | null>(null);
  const [failure, setFailure] = useState<ScoreboardFailure | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    setPlayer(loadPlayer());
    setChecked(true);
  }, []);

  useEffect(() => {
    if (!player) return;
    let active = true;

    (async () => {
      try {
        const attempts = await getPlayerAttempts(player.id);
        if (active) setRows(attempts);
      } catch (err) {
        const described = describeFailure(err);
        console.error(`[little-fox] history failed (${described.kind}):`, described.detail);
        if (active) setFailure(described);
      }
    })();

    return () => {
      active = false;
    };
  }, [player]);

  async function issue(row: AttemptRow) {
    if (!player) return;
    setBusyId(row.id);
    setPdfError(null);
    try {
      await downloadCertificate({
        name: player.name,
        unitId: row.unit_id,
        unitTitle: unitTitles[row.unit_id] ?? row.unit_id,
        score: row.score,
        maxScore: row.max_score,
        timeSeconds: row.time_seconds,
        accuracy: row.max_score > 0 ? row.score / row.max_score : 0,
      });
    } catch (err) {
      console.error("[little-fox] certificate failed:", err);
      setPdfError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  if (!checked) return <p className="muted">Loading…</p>;

  if (!player) {
    return (
      <div className="card card--dashed stack" style={{ gap: 12 }}>
        <p className="muted">
          Type your name first and your scores will be waiting here.
        </p>
        <Link className="btn" href="/">
          Go to the start
        </Link>
      </div>
    );
  }

  if (failure) return <Failure failure={failure} />;
  if (!rows) return <p className="muted">Looking up your scores…</p>;

  if (rows.length === 0) {
    return (
      <div className="card card--dashed stack" style={{ gap: 12 }}>
        <p className="muted">
          Nothing here yet, {player.name} — finish a unit and it will appear.
        </p>
        <Link className="btn" href="/units">
          Pick a unit
        </Link>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      {pdfError && (
        <div className="notice notice--error">
          <strong>The certificate would not open.</strong> Show this to your
          teacher: <code>{pdfError}</code>
        </div>
      )}

      {rows.map((row) => {
        const earned = earnsCertificate(
          row.unit_id,
          row.correct_count,
          row.total_questions
        );

        return (
          <div className="card stack" key={row.id} style={{ gap: 12 }}>
            <div className="row row--between">
              <div>
                <div className="kicker">{scoreIdLabel(row.unit_id)}</div>
                <div style={{ fontWeight: 800 }}>
                  {unitTitles[row.unit_id] ?? "This run"}
                </div>
              </div>
              <span className="muted">{formatDateTime(row.completed_at)}</span>
            </div>

            <div className="stats">
              <div className="stat">
                <div className="stat__label">Score</div>
                <div className="stat__value">
                  {row.score}/{row.max_score}
                </div>
              </div>
              <div className="stat">
                <div className="stat__label">Correct</div>
                <div className="stat__value">
                  {row.correct_count}/{row.total_questions}
                </div>
              </div>
              <div className="stat">
                <div className="stat__label">Time</div>
                <div className="stat__value">{formatTime(row.time_seconds)}</div>
              </div>
              <div className="stat">
                <div className="stat__label">Accuracy</div>
                <div className="stat__value">
                  {formatPercent(
                    row.max_score > 0 ? row.score / row.max_score : 0
                  )}
                </div>
              </div>
            </div>

            <div className="row row--between">
              <Link href={`/leaderboard/${row.unit_id}`}>See the board</Link>
              {earned ? (
                <button
                  className="btn btn--sm"
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void issue(row)}
                >
                  {busyId === row.id ? "Making it…" : "Certificate"}
                </button>
              ) : (
                // Say why, rather than leaving a gap where a button is on the
                // row above it.
                <span className="muted">
                  {scoreIdLabel(row.unit_id).includes("part")
                    ? "Parts don't earn a certificate"
                    : `Needs ${certificateNeeds(row.total_questions)} right`}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
