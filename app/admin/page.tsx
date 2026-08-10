// Admin overview: how much has been played, who played most recently, and
// which skill the whole cohort is weakest at.

import Link from "next/link";
import AttemptsTable from "@/components/admin/AttemptsTable";
import { LoadFailed, ServiceKeyMissing } from "@/components/admin/SetupNotice";
import {
  bestAttemptPerUnit,
  certificateRoster,
  fetchAttempts,
  fetchPlayers,
  tallySkills,
} from "@/lib/admin-data";
import { formatDateTime, formatPercent, gameLabel } from "@/lib/format";
import { GAME_ID, fullQuestionCount } from "@/lib/game";
import { serviceConfigured } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!serviceConfigured()) return <ServiceKeyMissing />;

  let players;
  let attempts;
  try {
    [players, attempts] = await Promise.all([fetchPlayers(), fetchAttempts()]);
  } catch (err) {
    return <LoadFailed error={err instanceof Error ? err.message : String(err)} />;
  }

  const best = bestAttemptPerUnit(attempts);
  const cohortSkills = tallySkills(best).filter((s) => s.total > 0);
  const questions = fullQuestionCount();
  const earned = certificateRoster(players, attempts, GAME_ID, questions).filter(
    (row) => row.state === "earned"
  ).length;

  return (
    <div className="stack">
      <h1>Overview</h1>

      <div className="tiles">
        <Stat value={players.length} label="Explorers" />
        {/* The one number the teacher came here for; green, and it goes
            straight to the list of names behind it. */}
        <Stat
          value={earned}
          label="Certificates"
          href="/admin/certificates"
          good
        />
        <Stat value={attempts.length} label="Runs played" />
        <Stat value={questions} label="Questions in the game" />
        <Stat
          value={formatDateTime(attempts[0]?.completed_at)}
          label="Last played"
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

      {/* This used to be printed on the students' own leaderboards — twice per
          screen, in words like "average accuracy" and "dominate". No child read
          it, and the teacher asked for the reading to come down. It is a
          teacher's question, so it lives here now. */}
      <div className="card">
        <details>
          <summary>
            <h2>How the board is ordered</h2>
          </summary>
          <div className="stack" style={{ gap: 10, marginTop: 12 }}>
          <p className="muted">
            There is one game and one board. It shows each explorer&apos;s
            single best run: highest score first, and a faster time breaks a
            tie. Replays are all kept, but only the best one is ever shown.
          </p>
          <p className="muted">
            Every run is saved under <code>{GAME_ID}</code>. Attempts from
            before the game was joined into one — <code>unit-01</code>,{" "}
            <code>unit-02</code> and the <code>-part-</code> rows — are still in
            the database and still listed below, but they are not on the
            board: they were different sets of questions and would not compare.
          </p>
          <p className="muted">
            If the questions change enough to move the total, bump{" "}
            <code>GAME_ID</code> in <code>lib/game.ts</code> so the board starts
            clean rather than mixing two different games.
          </p>
          </div>
        </details>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  href,
  good,
}: {
  value: string | number;
  label: string;
  href?: string;
  good?: boolean;
}) {
  const body = (
    <>
      <div className="tile__value">{value}</div>
      <div className="tile__label">{label}</div>
    </>
  );
  const className = `tile${good ? " tile--good" : ""}${href ? " tile--link" : ""}`;
  return href ? (
    <Link className={className} href={href}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
