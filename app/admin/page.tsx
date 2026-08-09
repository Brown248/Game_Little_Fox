// Admin overview: how much has been played, who played most recently, and
// which skill the whole cohort is weakest at.

import Link from "next/link";
import AttemptsTable from "@/components/admin/AttemptsTable";
import { LoadFailed, ServiceKeyMissing } from "@/components/admin/SetupNotice";
import {
  bestAttemptPerUnit,
  fetchAttempts,
  fetchPlayers,
  tallySkills,
} from "@/lib/admin-data";
import { formatDateTime, formatPercent, gameLabel } from "@/lib/format";
import { serviceConfigured } from "@/lib/supabase-admin";
import { listUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!serviceConfigured()) return <ServiceKeyMissing />;

  const units = listUnits();

  let players;
  let attempts;
  try {
    [players, attempts] = await Promise.all([fetchPlayers(), fetchAttempts()]);
  } catch (err) {
    return <LoadFailed error={err instanceof Error ? err.message : String(err)} />;
  }

  const best = bestAttemptPerUnit(attempts);
  const cohortSkills = tallySkills(best).filter((s) => s.total > 0);
  const unitsWithData = new Set(attempts.map((a) => a.unit_id)).size;

  return (
    <div className="stack">
      <h1>Overview</h1>

      <div className="tiles">
        <Stat value={players.length} label="Explorers" />
        <Stat value={attempts.length} label="Attempts" />
        {/* Two separate numbers, not a ratio: attempts can outlive a unit's
            JSON file, and "2 / 1 units played" would just look broken. */}
        <Stat value={unitsWithData} label="Units with attempts" />
        <Stat value={units.length} label="Unit files" />
        <Stat
          value={formatDateTime(attempts[0]?.completed_at)}
          label="Last attempt"
        />
      </div>

      <div className="card">
        <h2>Where the group is struggling</h2>
        <p className="muted">
          Correct answers per skill, counting each explorer&apos;s best attempt at
          each unit.
        </p>
        {cohortSkills.length === 0 ? (
          <p className="muted">No scored answers yet.</p>
        ) : (
          <div className="breakdown">
            {cohortSkills
              .slice()
              .sort((a, b) => a.correct / a.total - b.correct / b.total)
              .map((skill) => (
                <div className="breakdown__row" key={skill.gameType}>
                  <span>{gameLabel(skill.gameType)}</span>
                  <span>
                    {formatPercent(skill.correct / skill.total)}{" "}
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
        <div className="row row--between">
          <h2>Recent attempts</h2>
          <Link href="/admin/players">All explorers →</Link>
        </div>
        <AttemptsTable attempts={attempts.slice(0, 25)} showPlayer />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="tile">
      <div className="tile__value">{value}</div>
      <div className="tile__label">{label}</div>
    </div>
  );
}
