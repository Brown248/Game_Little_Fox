// Who has earned a certificate, who has not, and why not — plus a button that
// prints anyone's for them.
//
// The teacher asked for both halves: "อยากเพิ่มระบบเช็คว่าใครทำผ่านไปจนได้ใบเซอร์
// แล้วบ้าง และสามารถดาวโหลดใบเซอร์ของคนนั้นได้ด้วย".

import CertificateButton from "@/components/admin/CertificateButton";
import { LoadFailed, ServiceKeyMissing } from "@/components/admin/SetupNotice";
import { certificateRoster, fetchAttempts, fetchPlayers } from "@/lib/admin-data";
import { certificateNeeds, formatDate, formatPercent, formatTime } from "@/lib/format";
import { fullQuestionCount, GAME_ID } from "@/lib/game";
import { SITE_NAME } from "@/lib/site";
import { serviceConfigured } from "@/lib/supabase-admin";
import type { CertificateRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminCertificatesPage() {
  if (!serviceConfigured()) return <ServiceKeyMissing />;

  let players;
  let attempts;
  try {
    [players, attempts] = await Promise.all([fetchPlayers(), fetchAttempts()]);
  } catch (err) {
    return <LoadFailed error={err instanceof Error ? err.message : String(err)} />;
  }

  const full = fullQuestionCount();
  const roster = certificateRoster(players, attempts, GAME_ID, full);
  const earned = roster.filter((r) => r.state === "earned");
  const waiting = roster.filter((r) => r.state !== "earned");
  const needed = certificateNeeds(full);

  return (
    <div className="stack">
      <h1>Certificates</h1>
      <p className="muted">
        Earned by finishing all {full} questions with at least {needed} right.
      </p>

      <div className="tiles">
        <Stat value={`${earned.length}`} label="Have earned one" tone="good" />
        <Stat value={`${waiting.length}`} label="Not yet" />
        <Stat value={`${players.length}`} label="Students" />
      </div>

      <div className="card">
        <div className="row row--between">
          <h2>Earned</h2>
          <span className="kicker kicker--faint">{earned.length} students</span>
        </div>
        {earned.length === 0 ? (
          <p className="muted">Nobody has finished the whole game yet.</p>
        ) : (
          <ul className="roster">
            {earned.map((row) => (
              <li className="roster__row roster__row--earned" key={row.player.id}>
                <span className="roster__medal" aria-hidden="true">
                  🏅
                </span>
                <span className="roster__who">
                  <span className="roster__name">{row.player.name}</span>
                  <span className="roster__meta">
                    {row.correctCount}/{row.totalQuestions} right ·{" "}
                    {formatTime(row.earnedWith!.time_seconds)} ·{" "}
                    {formatDate(row.earnedWith!.completed_at)}
                  </span>
                </span>
                <span className="roster__score">
                  {formatPercent(
                    row.earnedWith!.max_score > 0
                      ? row.earnedWith!.score / row.earnedWith!.max_score
                      : 0
                  )}
                </span>
                <CertificateButton
                  name={row.player.name}
                  gameTitle={SITE_NAME}
                  gameId={GAME_ID}
                  score={row.earnedWith!.score}
                  maxScore={row.earnedWith!.max_score}
                  timeSeconds={row.earnedWith!.time_seconds}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="row row--between">
          <h2>Not yet</h2>
          <span className="kicker kicker--faint">{waiting.length} students</span>
        </div>
        {/* "Everyone has one" is only true if there is anyone. On a fresh
            database both lists are empty and that line congratulated the
            teacher on a class that does not exist yet. */}
        {waiting.length === 0 ? (
          <p className="muted">
            {players.length === 0 ? "No students yet." : "Everyone has one. 🎉"}
          </p>
        ) : (
          <ul className="roster">
            {waiting.map((row) => (
              <li className="roster__row" key={row.player.id}>
                <span className="roster__medal" aria-hidden="true">
                  {row.state === "never-played" ? "·" : "○"}
                </span>
                <span className="roster__who">
                  <span className="roster__name">{row.player.name}</span>
                  <span className="roster__meta">{reason(row, full, needed)}</span>
                </span>
                <span className="roster__score">
                  {row.bestAny
                    ? `${row.bestAny.score}/${row.bestAny.max_score}`
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** What this student needs to do next, in the words the teacher would use. */
function reason(row: CertificateRow, full: number, needed: number): string {
  if (row.state === "never-played") return "has not played yet";
  if (row.state === "stopped-early") {
    return `stopped after ${row.totalQuestions} of ${full} questions`;
  }
  return `finished, but got ${row.correctCount} right — needs ${needed}`;
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: "good";
}) {
  return (
    <div className={`tile${tone === "good" ? " tile--good" : ""}`}>
      <div className="tile__value">{value}</div>
      <div className="tile__label">{label}</div>
    </div>
  );
}
