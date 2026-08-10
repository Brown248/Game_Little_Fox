"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Failure from "@/components/Failure";
import { downloadCertificate, warmCertificate } from "@/lib/certificate";
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
  /** How many scored questions a complete run of the current game has, and the
   *  id those runs are saved under. Both are needed because a run can be
   *  stopped early: without them this screen would hand a certificate to a
   *  quarter-finished run that /rank had just refused. */
  gameId: string;
  fullQuestionCount: number;
}

// Every run this explorer has finished, and the certificates they have already
// earned — issued again from here, without replaying anything.
//
// Straight from the teacher: "ย้อนดูไม่ได้ด้วย เหมือนต้องเล่นใหม่". A score used
// to live only on the result screen it was won on, so closing the tab lost the
// certificate for good. The rows come from Supabase, so a phone that has been
// closed all week still shows them.
export default function MyScores({
  unitTitles,
  gameId,
  fullQuestionCount,
}: Props) {
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
        completedAt: row.completed_at,
      });
    } catch (err) {
      console.error("[little-fox] certificate failed:", err);
      setPdfError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  if (!checked) return <p className="muted">Please wait…</p>;

  if (!player) {
    return (
      <div className="card card--dashed stack" style={{ gap: 12 }}>
        <p className="muted">Type your name first.</p>
        <Link className="btn" href="/">
          Go to the start
        </Link>
      </div>
    );
  }

  if (failure) return <Failure failure={failure} />;
  if (!rows) return <p className="muted">Please wait…</p>;

  if (rows.length === 0) {
    return (
      <div className="card card--dashed stack" style={{ gap: 12 }}>
        <p className="muted">Nothing here yet, {player.name}.</p>
        <Link className="btn" href="/play">
          Play
        </Link>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      {pdfError && (
        <div className="notice notice--error">
          <strong>The certificate would not open.</strong>{" "}
          <details>
            <summary>For the teacher</summary>
            <code>{pdfError}</code>
          </details>
        </div>
      )}

      {rows.map((row) => {
        // Only runs of the CURRENT game can be judged for completeness — an
        // older row was a different set of questions, so its own length is the
        // only length it can be measured against.
        const fullLength = row.unit_id === gameId ? fullQuestionCount : 0;
        const earned = earnsCertificate(
          row.unit_id,
          row.correct_count,
          row.total_questions,
          fullLength
        );
        const stoppedEarly =
          fullLength > 0 && row.total_questions !== fullLength;

        return (
          <div className="card stack" key={row.id} style={{ gap: 12 }}>
            <div className="row row--between">
              <div>
                {/* Only the older per-unit rows need naming which unit they
                    were: the game has one name and the title below says it. */}
                {row.unit_id.startsWith("unit-") && (
                  <div className="kicker">{scoreIdLabel(row.unit_id)}</div>
                )}
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
                <div className="stat__label">Right</div>
                <div className="stat__value">
                  {formatPercent(
                    row.max_score > 0 ? row.score / row.max_score : 0
                  )}
                </div>
              </div>
            </div>

            <div className="row row--between">
              {/* One board now. This used to be /leaderboard/{unit_id}, which
                  no longer exists — every card on this screen 404'd. */}
              <Link className="textlink" href="/rank">
                Top scores
              </Link>
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
                  {stoppedEarly
                    ? "Play every question"
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
