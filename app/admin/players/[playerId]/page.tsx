// One student: every attempt they have made, plus their per-skill totals so BB
// can see what to reteach.

import Link from "next/link";
import { notFound } from "next/navigation";
import AttemptsTable from "@/components/admin/AttemptsTable";
import { LoadFailed, ServiceKeyMissing } from "@/components/admin/SetupNotice";
import {
  fetchAttemptsForPlayer,
  fetchPlayer,
  summarisePlayer,
} from "@/lib/admin-data";
import {
  formatDateTime,
  formatPercent,
  formatTime,
  gameLabel,
} from "@/lib/format";
import { serviceConfigured } from "@/lib/supabase-admin";
import { listUnits } from "@/lib/units";

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
  const units = listUnits();
  const totalUnits = units.length;
  const playedUnits = new Set(allAttempts.map((a) => a.unit_id));
  const notStarted = units.filter((u) => !playedUnits.has(u.id));

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
          <div className="tile__value">
            {summary.unitsPlayed} / {totalUnits}
          </div>
          <div className="tile__label">Units played</div>
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
        <h2>Units not started</h2>
        {notStarted.length === 0 ? (
          <p className="muted">Every unit has been played at least once. 🎉</p>
        ) : (
          <p>{notStarted.map((u) => u.id).join(", ")}</p>
        )}
      </div>

      <div className="card">
        <h2>Every attempt</h2>
        <p className="muted">
          All attempts are kept — the leaderboard uses the best one per unit.
        </p>
        <AttemptsTable attempts={allAttempts} />
      </div>
    </div>
  );
}
