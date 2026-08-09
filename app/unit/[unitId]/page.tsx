// The step between picking a unit and playing it: the whole unit in one run,
// or one part on its own. Both are timed and scored the same way — they just
// keep separate leaderboards, so a part is a real short lesson rather than a
// practice mode.

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import { gameLabel } from "@/lib/format";
import { getUnit, listParts, listUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function UnitPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  const unit = getUnit(unitId);
  if (!unit) notFound();

  const summary = listUnits().find((u) => u.id === unitId);
  const parts = listParts(unitId);
  const label = unitId.replace("-", " ");

  return (
    <Shell active="start" unitId={unitId} kicker={`${label} · ${unit.title}`}>
      <main className="page">
        <header className="stack" style={{ gap: 8 }}>
          <span className="kicker">{label}</span>
          <h1>{unit.title}</h1>
          <p className="lead">
            Play the whole unit in one go, or take one part at a time. Both are
            timed and both have their own leaderboard — a part is a real round,
            not a practice run.
          </p>
        </header>

        <div className="whole">
          <Image
            className="whole__fox"
            src="/little-fox-logo.png"
            alt=""
            width={336}
            height={336}
          />
          <div className="row row--between">
            <div>
              <div className="stat__label">The whole unit</div>
              <div className="join__title">
                {summary?.questionCount ?? 0} questions
              </div>
            </div>
            <span className="tag">counts on Top explorers</span>
          </div>
          <Link className="btn btn--block" href={`/play/${unitId}`}>
            Play the whole unit
          </Link>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          <div className="progress-head">
            <h2>Or one part at a time</h2>
            <span className="kicker kicker--faint">{parts.length} parts</span>
          </div>

          <div className="unit-list">
            {parts.map((part) => (
              <Link
                key={part.scoreId}
                className="unit"
                href={`/play/${unitId}?part=${part.index + 1}`}
              >
                <span className="unit__no">{part.index + 1}</span>
                <span className="unit__body">
                  <span className="unit__title">{part.label}</span>
                  <span className="unit__meta">
                    {gameLabel(part.type)} · {part.questionCount} questions ·{" "}
                    {part.maxScore} points
                  </span>
                </span>
                <span className="unit__go" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))}
          </div>

          {unit.games.some((block) => block.type === "writing") && (
            <div className="card card--dashed">
              <p className="muted">
                The writing part is practice — it is never scored, so it has no
                leaderboard of its own. It plays at the end of the whole unit.
              </p>
            </div>
          )}
        </div>

        <div className="row row--between no-print">
          <Link href="/">← Pick another unit</Link>
          <Link href={`/leaderboard/${unitId}`}>Unit leaderboard →</Link>
        </div>
      </main>
    </Shell>
  );
}
