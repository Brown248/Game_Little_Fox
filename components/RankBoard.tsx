"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Failure from "@/components/Failure";
import { downloadCertificate, warmCertificate } from "@/lib/certificate";
import {
  certificateNeeds,
  earnsCertificate,
  formatTime,
  playedItAll,
} from "@/lib/format";
import { loadPlayer } from "@/lib/session";
import {
  describeFailure,
  getPlayerAttempts,
  getUnitRanking,
  type ScoreboardFailure,
} from "@/lib/supabase";
import type { AttemptRow, Player, UnitRankingRow } from "@/lib/types";

interface Props {
  gameId: string;
  /** Shown in the certificate; the game has one name now. */
  gameTitle: string;
  /** How many scored questions a complete run has. */
  fullQuestionCount: number;
}

// The one board, and the end of every run.
//
// The teacher asked for four things on it and nothing else: place, name, score,
// time. It is also where a finished run lands (PlayClient replaces the history
// entry with this page), so it carries the certificate button too — there is no
// separate result screen any more.
export default function RankBoard({
  gameId,
  gameTitle,
  fullQuestionCount,
}: Props) {
  const [rows, setRows] = useState<UnitRankingRow[] | null>(null);
  /** The player's own best run, read whole so the certificate rule can count
   *  answers rather than infer them from a score. `null` once looked up and
   *  they have none; `undefined` while the answer is still unknown. */
  const [best, setBest] = useState<AttemptRow | null | undefined>(undefined);
  const [ownRunsFailed, setOwnRunsFailed] = useState(false);
  const [failure, setFailure] = useState<ScoreboardFailure | null>(null);
  const [me, setMe] = useState<Player | null>(null);
  const [checked, setChecked] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    setMe(loadPlayer());
    setChecked(true);
  }, []);

  // Both queries, together, so Refresh really does refresh everything. They
  // used to be separate effects and only the board was re-run — a child whose
  // own-runs query had failed could press Refresh all day and still be told to
  // go and play every question.
  const load = useCallback(
    async (playerId: string | null) => {
      setFailure(null);
      try {
        // Order comes from v_unit_ranking: each player's best run, highest
        // score first, faster time breaks a tie. Never re-sort here or the
        // board stops matching the database.
        setRows(await getUnitRanking(gameId));
      } catch (err) {
        const described = describeFailure(err);
        console.error(`[little-fox] board failed (${described.kind}):`, described.detail);
        setFailure(described);
        return;
      }

      if (!playerId) {
        setBest(null);
        return;
      }

      // The board view carries score and time but not the answer count, and
      // the certificate rule is counted in answers, so the player's own runs
      // are read whole.
      setOwnRunsFailed(false);
      try {
        const runs = (await getPlayerAttempts(playerId)).filter(
          (row) => row.unit_id === gameId
        );
        setBest(certificateRun(runs, fullQuestionCount));
      } catch (err) {
        // The board is the point of this screen, so this must not blank the
        // page — but it must not quietly claim the run was never finished
        // either.
        console.error("[little-fox] own runs failed:", describeFailure(err).detail);
        setOwnRunsFailed(true);
        setBest(null);
      }
    },
    [gameId, fullQuestionCount]
  );

  useEffect(() => {
    if (!checked) return;
    void load(me?.id ?? null);
  }, [checked, me, load]);

  // Fetch jspdf and the logo as soon as this player has a run on the board,
  // rather than when the button is tapped: iOS Safari will not start a
  // download from a handler that went away to the network first.
  useEffect(() => {
    if (best) warmCertificate();
  }, [best]);

  const myIndex = rows && me ? rows.findIndex((r) => r.player_id === me.id) : -1;
  const mine = myIndex >= 0 && rows ? rows[myIndex] : null;

  async function certificate() {
    if (!mine || !me) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadCertificate({
        name: me.name,
        unitId: gameId,
        unitTitle: gameTitle,
        score: mine.score,
        maxScore: mine.max_score,
        timeSeconds: mine.time_seconds,
        accuracy: mine.max_score > 0 ? mine.score / mine.max_score : 0,
        rankLabel: `${myIndex + 1} / ${rows?.length ?? 0}`,
      });
    } catch (err) {
      // Never swallow this: a button that does nothing when pressed is the
      // worst outcome for a child who has earned the certificate.
      console.error("[little-fox] certificate failed:", err);
      setPdfError(err instanceof Error ? err.message : String(err));
    } finally {
      setPdfBusy(false);
    }
  }

  if (failure) {
    return (
      <Failure failure={failure}>
        <button
          className="btn btn--sm"
          type="button"
          onClick={() => void load(me?.id ?? null)}
        >
          Try again
        </button>
      </Failure>
    );
  }

  if (!checked || !rows) return <p className="muted">Please wait…</p>;

  if (rows.length === 0) {
    return (
      <div className="card card--dashed stack" style={{ gap: 12 }}>
        <p className="muted">Nobody has played yet. Be the first!</p>
        <Link className="btn" href="/play">
          Play
        </Link>
      </div>
    );
  }

  // Two things can go wrong, and they need different sentences: the run was
  // stopped early, or it went all the way but did not get enough right.
  const stillLooking = best === undefined;
  const finishedIt = best
    ? playedItAll(best.total_questions, fullQuestionCount)
    : false;
  const earned = best
    ? earnsCertificate(
        gameId,
        best.correct_count,
        best.total_questions,
        fullQuestionCount
      )
    : false;

  return (
    <div className="stack stack--screen">
      {mine && (
        <div className="mine">
          <div className="mine__head">
            <div>
              <div className="stat__label">Your best</div>
              <div className="score-big">
                <span>{mine.score}</span>
                <small>/{mine.max_score}</small>
              </div>
              <div className="mine__time">{formatTime(mine.time_seconds)}</div>
            </div>
            {/* the place, the size it deserves on the screen a finished run
                lands on */}
            <span
              className={`mine__place${myIndex < 3 ? ` mine__place--${myIndex + 1}` : ""}`}
              aria-label={`Place ${myIndex + 1} of ${rows.length}`}
            >
              {myIndex + 1}
            </span>
          </div>

          {earned ? (
            <button
              className="btn btn--block"
              type="button"
              onClick={certificate}
              disabled={pdfBusy}
            >
              {pdfBusy ? "Making it…" : "Get my certificate"}
            </button>
          ) : (
            <p className="muted center">
              {/* Never tell a child they did not finish until we know. This
                  line used to appear in the gap before their own runs had
                  loaded — on the very screen a finished game lands on. */}
              {stillLooking
                ? "Please wait…"
                : ownRunsFailed
                  ? "Could not check your certificate. Try Refresh."
                  : finishedIt
                    ? `Get ${certificateNeeds(fullQuestionCount)} right for a certificate.`
                    : "Play every question for a certificate."}
            </p>
          )}

          {pdfError && (
            <div className="notice notice--error">
              <strong>The certificate would not open.</strong>{" "}
              <details>
                <summary>For the teacher</summary>
                <code>{pdfError}</code>
              </details>
            </div>
          )}
        </div>
      )}

      <div className="board-sheet">
        <div className="board-cols" aria-hidden="true">
          <span className="board-cols__rank">#</span>
          <span className="board-cols__who">Name</span>
          <span className="board-cols__time">Time</span>
          <span className="board-cols__score">Score</span>
        </div>

        <ol className="board">
          {rows.map((row, i) => {
            const isMe = row.player_id === me?.id;
            return (
              <li
                key={row.player_id}
                className={`board__row${i < 3 ? ` board__row--${i + 1}` : ""}${
                  isMe ? " board__row--me" : ""
                }${i > 5 && !isMe ? " board__row--faded" : ""}`}
              >
                {i === 0 && (
                  <span className="board__crown" aria-hidden="true">
                    👑
                  </span>
                )}
                {isMe && <span className="board__you">YOU</span>}
                <span
                  className={`board__place${
                    i < 3 ? ` board__place--top board__place--${i + 1}` : ""
                  }`}
                  aria-label={`Place ${i + 1}`}
                >
                  {i + 1}
                </span>
                <span className="board__who">
                  <span className="board__name">{row.name}</span>
                </span>
                <span className="board__time">{formatTime(row.time_seconds)}</span>
                <span className="board__score">{row.score}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="board-foot">
        <div className="row row--tight">
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => void load(me?.id ?? null)}
          >
            Refresh
          </button>
          <Link className="btn" href="/play">
            Play again
          </Link>
        </div>
      </div>
    </div>
  );
}

/** The best of a player's runs, by the same rule v_unit_ranking uses: highest
 *  score, and the faster time settles a tie. */
function bestRun(runs: AttemptRow[]): AttemptRow | null {
  return runs.reduce<AttemptRow | null>((best, run) => {
    if (!best) return run;
    if (run.score !== best.score) return run.score > best.score ? run : best;
    return run.time_seconds < best.time_seconds ? run : best;
  }, null);
}

/** The run the certificate is judged on: the best COMPLETE one if there is any,
 *  otherwise simply the best.
 *
 *  A certificate, once earned, must not be taken away. Playing all 77 questions
 *  and getting 40 right earns one; coming back, answering 50 and pressing
 *  Finish scores higher, so it becomes the "best" run — and being a partial run
 *  it fails the completeness rule, which withdrew a certificate the child had
 *  already been given. Nothing they did was wrong, and nothing told them why. */
function certificateRun(
  runs: AttemptRow[],
  fullQuestionCount: number
): AttemptRow | null {
  const complete = runs.filter(
    (run) => playedItAll(run.total_questions, fullQuestionCount)
  );
  return bestRun(complete.length > 0 ? complete : runs);
}
