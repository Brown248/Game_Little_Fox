// Two things on this page:
// 1. Content health — which JSON files load, how many questions each unit is
//    worth, and which listening clips have no recording yet.
// 2. Play stats per unit — how many students, average accuracy, weakest skill.

import Link from "next/link";
import { LoadFailed, ServiceKeyMissing } from "@/components/admin/SetupNotice";
import { fetchAttempts, summariseUnits } from "@/lib/admin-data";
import { formatPercent, formatTime, gameLabel } from "@/lib/format";
import { serviceConfigured } from "@/lib/supabase-admin";
import type { UnitStats } from "@/lib/types";
import { auditUnits, listBrokenUnitFiles } from "@/lib/units";

export const dynamic = "force-dynamic";

const PLANNED_UNITS = 20;

export default async function AdminUnitsPage() {
  const audits = auditUnits();
  const broken = listBrokenUnitFiles();
  const missingAudio = audits.flatMap((a) => a.audio.filter((c) => !c.fileExists));

  let stats: UnitStats[] | null = null;
  let loadError: string | null = null;
  if (serviceConfigured()) {
    try {
      stats = summariseUnits(await fetchAttempts());
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
    }
  }

  return (
    <div className="stack">
      <h1>Units</h1>

      <div className="tiles">
        <div className="tile">
          <div className="tile__value">
            {audits.length} / {PLANNED_UNITS}
          </div>
          <div className="tile__label">JSON files written</div>
        </div>
        <div className="tile">
          <div className="tile__value">{broken.length}</div>
          <div className="tile__label">Files with errors</div>
        </div>
        <div className="tile">
          <div className="tile__value">{missingAudio.length}</div>
          <div className="tile__label">Clips without audio</div>
        </div>
      </div>

      {broken.length > 0 && (
        <div className="notice notice--error">
          <strong>These files did not load</strong> (the reason is printed in the
          server console): {broken.join(", ")}. A unit only appears to students
          once its file is valid and its <code>id</code> matches the filename.
        </div>
      )}

      <div className="card">
        <h2>Content</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Title</th>
                <th>Blocks</th>
                <th>Questions</th>
                <th>Max score</th>
                <th>Writing last?</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id}>
                  <td>{audit.id}</td>
                  <td style={{ whiteSpace: "normal" }}>{audit.title}</td>
                  <td style={{ whiteSpace: "normal" }}>
                    {audit.blocks
                      .map((b) => `${gameLabel(b.type)} x${b.count}`)
                      .join(", ")}
                  </td>
                  <td>{audit.questionCount}</td>
                  <td>{audit.maxScore}</td>
                  <td>
                    {!audit.hasWriting
                      ? "—"
                      : audit.writingIsLast
                        ? "yes"
                        : "⚠ no"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Add a unit by dropping <code>unit-NN.json</code> into{" "}
          <code>content/units/</code> — see <code>_template.json</code> there. No
          code change and no deploy config is needed.
        </p>
      </div>

      <div className="card">
        <h2>Listening audio</h2>
        {missingAudio.length === 0 ? (
          <p className="muted">
            Every listening clip has a file. Students hear the recording, not the
            browser voice.
          </p>
        ) : (
          <>
            <p className="muted">
              These clips fall back to the browser voice until an mp3 exists at{" "}
              <code>public/audio/&lt;path&gt;</code>:
            </p>
            <div className="breakdown">
              {missingAudio.map((clip, i) => (
                <div className="breakdown__row" key={`${clip.unitId}-${i}`}>
                  <span>{clip.unitId}</span>
                  <span className="muted">
                    {clip.audioUrl || "(no audioUrl set)"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Play stats</h2>
        {!serviceConfigured() && <ServiceKeyMissing />}
        {loadError && <LoadFailed error={loadError} />}
        {stats && stats.length === 0 && (
          <p className="muted">Nothing has been played yet.</p>
        )}
        {stats && stats.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Students</th>
                  <th>Attempts</th>
                  <th>Avg accuracy</th>
                  <th>Best time</th>
                  <th>Weakest skill</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stats.map((unit) => (
                  <tr key={unit.unitId}>
                    <td>{unit.unitId}</td>
                    <td>{unit.playerCount}</td>
                    <td>{unit.attemptCount}</td>
                    <td>{formatPercent(unit.averageAccuracy)}</td>
                    <td>
                      {unit.bestTimeSeconds === null
                        ? "—"
                        : formatTime(unit.bestTimeSeconds)}
                    </td>
                    <td>
                      {unit.weakestSkill
                        ? `${gameLabel(unit.weakestSkill.gameType)} (${formatPercent(
                            unit.weakestSkill.correct / unit.weakestSkill.total
                          )})`
                        : "—"}
                    </td>
                    <td>
                      <Link href={`/leaderboard/${unit.unitId}`}>Board</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
