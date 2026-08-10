// One student: every attempt they have made, plus their per-skill totals so BB
// can see what to reteach.

import Link from "next/link";
import { notFound } from "next/navigation";
import AttemptsTable from "@/components/admin/AttemptsTable";
import CertificateButton from "@/components/admin/CertificateButton";
import { LoadFailed, ServiceKeyMissing } from "@/components/admin/SetupNotice";
import {
  certificateRoster,
  fetchAttemptsForPlayer,
  fetchPlayer,
  summarisePlayer,
} from "@/lib/admin-data";
import {
  certificateNeeds,
  formatDate,
  formatDateTime,
  formatPercent,
  formatTime,
  gameLabel,
} from "@/lib/format";
import { GAME_ID, fullQuestionCount } from "@/lib/game";
import { SITE_NAME } from "@/lib/site";
import { serviceConfigured } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AdminPlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  if (!serviceConfigured()) return <ServiceKeyMissing />;

  let player;
  let attempts;
  try {
    player = await fetchPlayer(playerId);
    // notFound() throws a control-flow error that must not be swallowed by the
    // catch below, so it is called after the try block.
    if (player) attempts = await fetchAttemptsForPlayer(playerId);
  } catch (err) {
    return <LoadFailed error={err instanceof Error ? err.message : String(err)} />;
  }

  if (!player) notFound();

  const allAttempts = attempts ?? [];
  const summary = summarisePlayer(player, allAttempts);
  // Runs of the one game, ignoring anything saved before the units were joined
  // into it. "Units played" used to be a tile here; with one game it could only
  // ever read "1 / 2", and the card underneath insisted every unit was
  // unstarted for a child who had in fact finished the lot.
  const runs = allAttempts.filter((a) => a.unit_id === GAME_ID).length;

  // Same roster the Certificates page builds, for one student. Building it the
  // same way is the point: a teacher who opens a name from the list must not be
  // told something different from the list itself.
  const full = fullQuestionCount();
  const certificate = certificateRoster(
    [player],
    allAttempts.map((a) => ({ ...a, players: { name: player.name } })),
    GAME_ID,
    full
  )[0];
  const won = certificate.state === "earned" ? certificate.earnedWith : null;

  return (
    <div className="stack">
      <Link href="/admin/players">← All explorers</Link>
      <h1>{summary.player.name}</h1>
      <p className="muted">
        joined {formatDateTime(summary.player.created_at)}
      </p>

      <div className="tiles">
        <div className="tile">
          <div className="tile__value">{formatPercent(summary.accuracy)}</div>
          <div className="tile__label">Accuracy</div>
        </div>
        <div className="tile">
          <div className="tile__value">{runs}</div>
          <div className="tile__label">Runs of the game</div>
        </div>
        <div className="tile">
          <div className="tile__value">{summary.attemptCount}</div>
          <div className="tile__label">Attempts</div>
        </div>
        <div className="tile">
          <div className="tile__value">{formatTime(summary.totalTimeSeconds)}</div>
          <div className="tile__label">Total time</div>
        </div>
      </div>

      <div className={`card${won ? " card--won" : ""}`}>
        <div className="row row--between">
          <h2>Certificate</h2>
          {won && <span className="pill pill--good">earned</span>}
        </div>
        {won ? (
          <div className="stack" style={{ gap: 12 }}>
            <p className="muted">
              {certificate.correctCount}/{certificate.totalQuestions} right ·{" "}
              {formatTime(won.time_seconds)} · {formatDate(won.completed_at)}
            </p>
            <CertificateButton
              name={player.name}
              gameTitle={SITE_NAME}
              gameId={GAME_ID}
              score={won.score}
              maxScore={won.max_score}
              timeSeconds={won.time_seconds}
              completedAt={won.completed_at}
            />
          </div>
        ) : (
          <p className="muted">
            {certificate.state === "never-played"
              ? "Has not played yet."
              : certificate.state === "stopped-early"
                ? `Stopped after ${certificate.totalQuestions} of ${full} questions. The whole game has to be played.`
                : `Finished, but got ${certificate.correctCount} right — needs ${certificateNeeds(full)}.`}
          </p>
        )}
      </div>

      <div className="card">
        <h2>Skills</h2>
        <p className="muted">Counting their best attempt at each unit.</p>
        {summary.skills.length === 0 ? (
          <p className="muted">No scored answers yet.</p>
        ) : (
          <div className="breakdown">
            {summary.skills.map((skill) => (
              <div className="breakdown__row" key={skill.gameType}>
                <span>{gameLabel(skill.gameType)}</span>
                <span className="breakdown__score">
                  {formatPercent(skill.total > 0 ? skill.correct / skill.total : null)}{" "}
                  <span className="muted">
                    ({skill.correct}/{skill.total})
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Every attempt</h2>
        <p className="muted">
          Every run is kept. The board shows only the best one.
        </p>
        <AttemptsTable attempts={allAttempts} />
      </div>
    </div>
  );
}
