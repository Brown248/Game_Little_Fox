// Step two: the name is in, now choose where to go. This used to share the
// landing card with the name field, which meant two decisions on the very
// first screen. Split out, each screen asks one thing.

import Link from "next/link";
import Shell from "@/components/Shell";
import ExplorerGreeting from "@/components/ExplorerGreeting";
import { listUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default function UnitsPage() {
  const units = listUnits();

  return (
    <Shell active="start">
      <main className="page">
        <header className="stack" style={{ gap: 8 }}>
          <span className="kicker">Choose your unit</span>
          <ExplorerGreeting />
          <p className="lead">
            Each unit is timed and has its own leaderboard. Play the whole thing
            for a certificate, or take one part at a time.
          </p>
        </header>

        {units.length === 0 ? (
          <div className="card card--dashed">
            <p className="muted">
              No units found in <code>content/units/</code> yet.
            </p>
          </div>
        ) : (
          <div className="unit-list">
            {units.map((unit) => (
              <Link key={unit.id} className="unit" href={`/unit/${unit.id}`}>
                <span className="unit__no">{unit.id.replace("unit-", "")}</span>
                <span className="unit__body">
                  <span className="unit__title">{unit.title}</span>
                  <span className="unit__meta">
                    {unit.questionCount} questions · {unit.maxScore} points
                  </span>
                </span>
                <span className="unit__go" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))}
          </div>
        )}

        <div className="row row--between no-print">
          <Link href="/me">My scores</Link>
          <Link href="/leaderboard/overall">Top explorers →</Link>
        </div>
      </main>
    </Shell>
  );
}
